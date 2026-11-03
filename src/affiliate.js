// ============================================================================
// SEED SHOP LINKS (affiliate) — remote config, off until set up
// ----------------------------------------------------------------------------
// The seed box's "To buy" list and the winter "Order seeds" item can link to
// a seed shop through an affiliate link, so Henalytics earns a small
// commission at no cost to the buyer. Which shop, and the tracking link, live
// in the app_config row id = "seed_affiliate", so it can be switched on,
// changed or switched off without an app update:
//
//   { "enabled": true,
//     "name": "True Leaf Market",
//     "homeUrl":   "https://www.trueleafmarket.com/?aff=YOURID",
//     "searchUrl": "https://www.trueleafmarket.com/search?q={q}&aff=YOURID" }
//
// {q} is replaced with the URL-encoded crop (+ variety). No row, or
// enabled != true → no shop buttons anywhere. Links always carry the
// disclosure text below (FTC rules require it next to affiliate links).
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

export const AFFILIATE_DISCLOSURE = 'Henalytics may earn a small commission on seed purchases, at no extra cost to you. It helps keep the app free.';

let _p = null;
export function loadSeedAffiliate() {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(null);
  if (!_p) {
    _p = supabase.from('app_config').select('value').eq('id', 'seed_affiliate').maybeSingle()
      .then(({ data, error }) => {
        const v = !error && data && data.value && typeof data.value === 'object' ? data.value : null;
        if (!v || v.enabled !== true) return null;
        const okUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u);
        if (!okUrl(v.homeUrl) && !okUrl(v.searchUrl)) return null;
        return {
          name: String(v.name || 'our seed partner').slice(0, 40),
          homeUrl: okUrl(v.homeUrl) ? v.homeUrl : null,
          searchUrl: okUrl(v.searchUrl) && v.searchUrl.includes('{q}') ? v.searchUrl : null,
        };
      })
      .catch(() => null);
  }
  return _p;
}

// URL for one crop (falls back to the shop's home page).
export function seedShopUrl(cfg, crop, variety) {
  if (!cfg) return null;
  const q = [variety, crop].filter(Boolean).join(' ').trim();
  if (cfg.searchUrl && q) return cfg.searchUrl.replace('{q}', encodeURIComponent(q));
  return cfg.homeUrl || null;
}
