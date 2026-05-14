// ============================================================================
// IAP MANAGER — RevenueCat wrapper for Apple In-App Purchases
// ----------------------------------------------------------------------------
// This module is the iOS/Android equivalent of the Stripe checkout flow in
// HomesteadApp.jsx (`startCheckout`). It wraps RevenueCat's Capacitor SDK to
// give us a clean async API for: initialization, fetching products, making
// purchases, restoring purchases, and identifying the user.
//
// Why RevenueCat instead of raw StoreKit:
//   - RevenueCat handles receipt validation server-side for free at our scale
//     (free up to $2.5K/mo MTR; we're far below).
//   - One API key works across iOS + Android, so adding Android later is cheap.
//   - Built-in webhooks → we get RC events → our /api/revenuecat-webhook →
//     same `supporters` table our Stripe flow already writes to.
//   - Subscription state (active/canceled/past_due/grace) is computed by RC
//     instead of us having to track Apple's notification types.
//
// Architecture:
//   - Web (non-native): this module is a NO-OP. The web SupportModal continues
//     to use Stripe Checkout. RevenueCat doesn't support web purchases anyway.
//   - Native (iOS/Android): RC initializes on app load (after auth), purchases
//     are made through Apple's purchase sheet, RC webhooks tell our server
//     when subscriptions renew/cancel/fail, our server updates `supporters`.
//
// Product IDs (must match App Store Connect EXACTLY — Apple is case-sensitive):
//   Consumable:
//     com.henalytics.app.tip.one_time      — $4.99 one-time tip
//   Auto-renewable subscriptions (in subscription group "Supporter Tiers"):
//     com.henalytics.app.sub.seedling      — $0.99/mo (web tier: $1 Seedling)
//     com.henalytics.app.sub.coffee        — $2.99/mo (web tier: $3 Coffee)
//     com.henalytics.app.sub.sustaining    — $4.99/mo (web tier: $5 Sustaining)
//     com.henalytics.app.sub.generous      — $9.99/mo (web tier: $10 Generous)
//
// NOTE: Apple's pricing tiers force amounts ending in .99 or .49. The closest
// matches for our Stripe-era $1/$3/$5/$10 tiers are .99 amounts, which is why
// these don't exactly match. The webhook handler maps the actual amounts paid
// back to tier-equivalents ($1, $3, $5, $10) for the supporter wall so the UI
// stays consistent across platforms.
//
// Tier→Stripe mapping (for supporter wall display compatibility):
//   com.henalytics.app.sub.seedling   → "monthly_1"   (display: $1 tier)
//   com.henalytics.app.sub.coffee     → "monthly_3"   (display: $3 tier)
//   com.henalytics.app.sub.sustaining → "monthly_5"   (display: $5 tier)
//   com.henalytics.app.sub.generous   → "monthly_10"  (display: $10 tier)
//   com.henalytics.app.tip.one_time   → "one_time"    (display: one-time)
//
// Required setup (already done if you're reading this in production):
//   1. npm install @revenuecat/purchases-capacitor
//   2. npx cap sync ios
//   3. Set VITE_REVENUECAT_IOS_API_KEY in Vercel env vars
//   4. Create the 5 products in App Store Connect with the IDs above
//   5. Sign Apple's "Paid Applications" agreement
//   6. Connect RevenueCat to App Store Connect (Issuer ID + Auth Key + SubKey)
//   7. Set up RC webhook → https://henalytics.com/api/revenuecat-webhook
// ============================================================================

// Product ID constants — single source of truth. Keep in sync with:
//   - App Store Connect product setup
//   - RevenueCat dashboard product setup
//   - api/revenuecat-webhook.js tierMetaFromProductId switch
export const IAP_PRODUCTS = {
  TIP_ONE_TIME:    "com.henalytics.app.tip.one_time",
  SUB_SEEDLING:    "com.henalytics.app.sub.seedling",
  SUB_COFFEE:      "com.henalytics.app.sub.coffee",
  SUB_SUSTAINING:  "com.henalytics.app.sub.sustaining",
  SUB_GENEROUS:    "com.henalytics.app.sub.generous",
};

// Map our existing Stripe tier strings → IAP product IDs.
// The tier strings appear in our existing supporters table as `payment_type`
// / amount combos. Keeping them lets the supporter wall logic stay unchanged.
export const TIER_TO_IAP_PRODUCT = {
  "one_time":   IAP_PRODUCTS.TIP_ONE_TIME,
  "monthly_1":  IAP_PRODUCTS.SUB_SEEDLING,
  "monthly_3":  IAP_PRODUCTS.SUB_COFFEE,
  "monthly_5":  IAP_PRODUCTS.SUB_SUSTAINING,
  "monthly_10": IAP_PRODUCTS.SUB_GENEROUS,
};

// Inverse — used by the webhook handler when an Apple receipt comes in.
export const IAP_PRODUCT_TO_TIER = Object.fromEntries(
  Object.entries(TIER_TO_IAP_PRODUCT).map(([tier, id]) => [id, tier])
);

// Module state. Single instance per app session.
let _purchases = null;       // RevenueCat Purchases object (lazy-loaded)
let _initialized = false;    // true after configure() succeeds
let _initPromise = null;     // dedupe parallel init calls
let _currentUserId = null;   // last-known Supabase user ID we identified to RC

// Detect native at the module level — safer than redefining everywhere.
const isNative = () => {
  if (typeof window === "undefined") return false;
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
};

// ============================================================================
// INIT
// ----------------------------------------------------------------------------
// Call once at app startup, after Supabase auth has resolved (so we can pass
// the user ID to RevenueCat for cross-device subscription linking).
//
// Safe to call multiple times — subsequent calls return the existing init
// promise. Safe to call from web — no-ops out.
// ============================================================================
export async function initIap(supabaseUserId) {
  if (!isNative()) return; // Web build — Stripe flow handles tips here

  // Re-init on user change (sign in / sign out) — RC needs to know which
  // user this device belongs to.
  if (_initialized && _currentUserId === supabaseUserId) return;

  if (_initPromise && _currentUserId === supabaseUserId) {
    return _initPromise;
  }

  _currentUserId = supabaseUserId;

  _initPromise = (async () => {
    try {
      // Lazy-import so the web bundle doesn't try to parse native-only deps.
      const mod = await import("@revenuecat/purchases-capacitor");
      _purchases = mod.Purchases;

      // API key. Stored as VITE_ env var so Vite inlines it at build time.
      // RevenueCat keys are intended to be public — they identify the app,
      // not the merchant. Receipt validation happens server-side at RC.
      const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
      if (!apiKey) {
        console.warn("[iap] VITE_REVENUECAT_IOS_API_KEY not set — IAP disabled");
        return;
      }

      // configure() identifies the app + sets the user. appUserID lets RC
      // associate purchases on this device with our Supabase user across
      // device reinstalls. If they sign in on another device, they keep
      // their subscription state.
      //
      // Note: pass null appUserID for anonymous users (pre-signin). RC
      // will assign a random ID and we can call logIn() later to merge.
      await _purchases.configure({
        apiKey,
        appUserID: supabaseUserId || null,
      });

      _initialized = true;
    } catch (e) {
      console.error("[iap] init failed:", e);
      _initialized = false;
    }
  })();

  return _initPromise;
}

// ============================================================================
// IDENTIFY — call when user signs in or out
// ----------------------------------------------------------------------------
// Apple subscriptions are tied to the Apple ID, not our user ID. But our
// supporters table is keyed by Supabase user ID. RC's logIn() merges the
// device's anonymous purchase history into the new user identity, so a tip
// made pre-signin still credits the right account once they sign in.
// ============================================================================
export async function identifyIapUser(supabaseUserId) {
  if (!isNative()) return;
  if (!_initialized || !_purchases) {
    // Init hasn't run yet — defer. The next initIap call picks up the new id.
    return initIap(supabaseUserId);
  }
  if (_currentUserId === supabaseUserId) return; // no-op

  try {
    if (supabaseUserId) {
      await _purchases.logIn({ appUserID: supabaseUserId });
    } else {
      await _purchases.logOut();
    }
    _currentUserId = supabaseUserId;
  } catch (e) {
    console.error("[iap] identify failed:", e);
  }
}

// ============================================================================
// PURCHASE
// ----------------------------------------------------------------------------
// Kicks off Apple's purchase sheet for a given product ID. Returns a result
// object: { success: true, purchase } on success, { success: false, error,
// userCanceled: bool } on failure.
//
// The native UI (purchase sheet, Touch ID/Face ID, "Subscribe" button) is
// handled entirely by Apple — we just receive the result.
// ============================================================================
export async function purchaseProduct(productId) {
  if (!isNative()) {
    return { success: false, error: "Not on native platform" };
  }
  if (!_initialized || !_purchases) {
    return { success: false, error: "IAP not initialized" };
  }

  try {
    // RC API: first fetch the StoreProduct, then call purchaseStoreProduct.
    const productsResult = await _purchases.getProducts({
      productIdentifiers: [productId],
    });
    const products = productsResult.products || [];
    if (products.length === 0) {
      return {
        success: false,
        error: `Product ${productId} not available — check App Store Connect setup`,
      };
    }

    const result = await _purchases.purchaseStoreProduct({
      product: products[0],
    });
    // RC returns customerInfo + productIdentifier on success. The webhook
    // will already have credited the supporters table by the time we get
    // here (RC sends webhooks server-to-server BEFORE returning to the app).
    return {
      success: true,
      purchase: result,
      productId,
    };
  } catch (e) {
    // RC throws on user cancel; check for that specifically so the UI can
    // distinguish "user backed out" from "actual failure."
    const userCanceled = e?.code === "PurchaseCancelledError"
      || /cancel/i.test(e?.message || "");
    return {
      success: false,
      userCanceled,
      error: e?.message || "Purchase failed",
    };
  }
}

// ============================================================================
// RESTORE PURCHASES
// ----------------------------------------------------------------------------
// Required by Apple for any app with non-consumable or subscription IAPs.
// A "Restore Purchases" button must be visible in the app — if user reinstalls
// the app or signs in on a new device, they need to get their entitlements back.
//
// The webhook handler will have re-synced supporters already if any restored
// purchase was an active subscription.
// ============================================================================
export async function restorePurchases() {
  if (!isNative()) return { success: false, error: "Not on native platform" };
  if (!_initialized || !_purchases) {
    return { success: false, error: "IAP not initialized" };
  }

  try {
    const result = await _purchases.restorePurchases();
    return { success: true, customerInfo: result };
  } catch (e) {
    return { success: false, error: e?.message || "Restore failed" };
  }
}

// ============================================================================
// GET CUSTOMER INFO — useful for showing active subscription status
// ----------------------------------------------------------------------------
// Returns the RC customerInfo blob with active entitlements. We use this to
// hide the "Subscribe" CTA when the user already has an active subscription,
// and show a "Manage subscription" link instead.
// ============================================================================
export async function getCustomerInfo() {
  if (!isNative()) return null;
  if (!_initialized || !_purchases) return null;

  try {
    const result = await _purchases.getCustomerInfo();
    return result.customerInfo || result;
  } catch (e) {
    console.warn("[iap] getCustomerInfo failed:", e);
    return null;
  }
}

// ============================================================================
// HAS ACTIVE SUBSCRIPTION — quick boolean check
// ----------------------------------------------------------------------------
// Returns true if the user has any active subscription right now. Useful for
// gating UI — e.g. don't show subscription tier buttons if they're already
// subscribed; show "Manage subscription" instead.
// ============================================================================
export async function hasActiveSubscription() {
  const info = await getCustomerInfo();
  if (!info) return false;
  // RC structures: customerInfo.entitlements.active is an object keyed by
  // entitlement ID. We don't use entitlements (we use product IDs directly),
  // so check activeSubscriptions array instead.
  const active = info.activeSubscriptions || [];
  return Array.isArray(active) && active.length > 0;
}

// ============================================================================
// OPEN MANAGE SUBSCRIPTIONS — iOS-only deep link
// ----------------------------------------------------------------------------
// Apple requires that users can manage their subscriptions from inside the app
// OR from iOS Settings. We use Apple's deep link to the subscriptions screen
// so users don't have to hunt through Settings.
// ============================================================================
export async function openManageSubscriptions() {
  if (!isNative()) return;
  if (!_initialized || !_purchases) return;
  try {
    await _purchases.showManageSubscriptions();
  } catch (e) {
    console.error("[iap] showManageSubscriptions failed:", e);
  }
}
