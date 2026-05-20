import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Camera as CameraIcon, Image as ImageIcon, Leaf, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";
import { apiUrl } from "./apiBase.js";
import { IAP_PRODUCTS, SCAN_PACK_PRODUCTS } from "./IapManager.js";
import { purchaseProduct, restorePurchases } from "./IapManager.js";

// ============================================================================
// PLANT SCANNER MODAL
// ----------------------------------------------------------------------------
// Camera-based plant + disease identification via Plant.id API.
//
// Flow:
//   1. Load quota status (free remaining, extra remaining, supporter math)
//   2. If quota > 0: enable scan button → take photo → submit
//   3. If quota = 0: show transparency block + pack purchase CTAs
//
// Photo capture:
//   - Native (Capacitor): @capacitor/camera plugin (we lazy-load so web bundle
//     doesn't pull in native-only deps).
//   - Web: <input type="file" accept="image/*" capture="environment">
//
// Photo storage:
//   - Per-scan toggle. When ON, photo is sent to /api/scan-plant with
//     save_photo=true, server uploads to Supabase Storage.
//
// Purchase paths:
//   - Native (iOS/Android): IAP via RevenueCat (purchaseProduct from IapManager)
//   - Web: Stripe Checkout via /api/create-scan-pack-checkout → redirect
// ============================================================================

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
  warn: "#D97706", warnSoft: "#FED7AA",
  danger: "#B91C1C", dangerSoft: "#FECACA",
  success: "#15803D", successSoft: "#BBF7D0",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const isNative = () => {
  if (typeof window === "undefined") return false;
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
};

function Btn({ children, onClick, variant = "primary", small = false, style = {}, type = "button", disabled = false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger:  { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
    leaf:    { background: palette.leaf, color: palette.bg, border: `1.5px solid ${palette.leaf}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 18px", borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT_BODY,
      fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "2px 2px 0 " + palette.line, ...styles[variant], ...style,
    }}>{children}</button>
  );
}

function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${palette.line}`, borderTopColor: palette.ink,
      borderRadius: "50%", animation: "scan-spin 0.8s linear infinite",
      verticalAlign: "middle",
    }} />
  );
}

// ============================================================================
// PHOTO CAPTURE HELPERS
// ============================================================================

// Native Capacitor camera. Lazy-loaded to avoid web bundle bloat.
async function captureNativePhoto(source = "camera") {
  try {
    const mod = await import("@capacitor/camera");
    const { Camera, CameraResultType, CameraSource } = mod;
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      width: 1600,
    });
    return { base64: photo.base64String, dataUrl: `data:image/${photo.format || "jpeg"};base64,${photo.base64String}` };
  } catch (e) {
    if (e?.message?.toLowerCase().includes("cancel")) return null; // user backed out
    throw e;
  }
}

// Web fallback. Read a File from an <input>, return base64.
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(",")[1] || "";
      resolve({ base64, dataUrl });
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PlantScannerModal({ onClose }) {
  const [view, setView] = useState("home"); // home | scanning | result | purchase
  const [quotaStatus, setQuotaStatus] = useState(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [error, setError] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [savePhoto, setSavePhoto] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const webInputRef = useRef(null);

  // ---- Load quota status on mount ----
  const refreshQuota = useCallback(async () => {
    setLoadingQuota(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;
      if (!jwt) throw new Error("Not signed in");

      const res = await fetch(apiUrl("/api/scan-quota-status"), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error(`Quota fetch failed (${res.status})`);
      const json = await res.json();
      setQuotaStatus(json);
    } catch (e) {
      setError(e.message || "Could not load scan status");
    } finally {
      setLoadingQuota(false);
    }
  }, []);

  useEffect(() => { refreshQuota(); }, [refreshQuota]);

  // ---- Photo capture handlers ----
  const handleTakePhoto = async () => {
    setError(null);
    try {
      if (isNative()) {
        const photo = await captureNativePhoto("camera");
        if (!photo) return; // user canceled
        setPhotoBase64(photo.base64);
        setPhotoDataUrl(photo.dataUrl);
      } else {
        // Web: trigger file input with capture=environment (mobile back camera)
        webInputRef.current?.click();
      }
    } catch (e) {
      setError(e.message || "Could not capture photo");
    }
  };

  const handlePickFromLibrary = async () => {
    setError(null);
    try {
      if (isNative()) {
        const photo = await captureNativePhoto("photos");
        if (!photo) return;
        setPhotoBase64(photo.base64);
        setPhotoDataUrl(photo.dataUrl);
      } else {
        webInputRef.current?.click();
      }
    } catch (e) {
      setError(e.message || "Could not pick photo");
    }
  };

  const handleWebFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photo = await readFileAsBase64(file);
      setPhotoBase64(photo.base64);
      setPhotoDataUrl(photo.dataUrl);
    } catch (err) {
      setError(err.message || "Could not read photo");
    }
  };

  const handleClearPhoto = () => {
    setPhotoBase64(null);
    setPhotoDataUrl(null);
    setResult(null);
    if (webInputRef.current) webInputRef.current.value = "";
  };

  // ---- Submit scan ----
  const handleSubmitScan = async () => {
    if (!photoBase64) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;
      if (!jwt) throw new Error("Not signed in");

      const res = await fetch(apiUrl("/api/scan-plant"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          image_base64: photoBase64,
          save_photo: savePhoto,
          user_notes: userNotes || undefined,
        }),
      });

      if (res.status === 402) {
        // Quota exhausted — bounce to purchase view
        setView("purchase");
        await refreshQuota();
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Scan failed (${res.status})`);
      }

      const json = await res.json();
      setResult(json);
      setView("result");
      await refreshQuota();
    } catch (e) {
      setError(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  // ---- Purchase pack ----
  const handlePurchasePack = async (packSize) => {
    setPurchasing(true);
    setError(null);
    try {
      if (isNative()) {
        // Native IAP via RevenueCat
        const productId = packSize === 10 ? IAP_PRODUCTS.SCAN_PACK_10 : IAP_PRODUCTS.SCAN_PACK_30;
        const result = await purchaseProduct(productId);
        if (result.success) {
          // Webhook will have credited the user by now. Refresh quota.
          await refreshQuota();
          setView("home");
        } else if (!result.userCanceled) {
          throw new Error(result.error || "Purchase failed");
        }
      } else {
        // Web: Stripe Checkout
        const { data } = await supabase.auth.getSession();
        const jwt = data?.session?.access_token;
        if (!jwt) throw new Error("Not signed in");

        const res = await fetch(apiUrl("/api/create-scan-pack-checkout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ pack: String(packSize) }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Could not start checkout");
        }
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (e) {
      setError(e.message || "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isNative()) return;
    setPurchasing(true);
    setError(null);
    try {
      const result = await restorePurchases();
      if (!result.success) throw new Error(result.error || "Restore failed");
      await refreshQuota();
    } catch (e) {
      setError(e.message || "Restore failed");
    } finally {
      setPurchasing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.6)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto", fontFamily: FONT_BODY,
    }} onClick={onClose}>
      <style>{`@keyframes scan-spin { to { transform: rotate(360deg); } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: palette.bg, borderRadius: 12, maxWidth: 540, width: "100%",
        border: `2px solid ${palette.ink}`, boxShadow: `4px 4px 0 ${palette.line}`,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Leaf size={22} color={palette.leaf} />
            <h2 style={{
              margin: 0, fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink,
            }}>Plant Scanner</h2>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer", padding: 4,
          }} aria-label="Close">
            <X size={22} color={palette.ink} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {error && (
            <div style={{
              background: palette.dangerSoft, border: `1.5px solid ${palette.danger}`,
              borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 14,
              color: palette.danger, display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loadingQuota && (
            <div style={{ textAlign: "center", padding: 30 }}>
              <Spinner size={24} />
              <div style={{ marginTop: 10, fontSize: 14, color: palette.inkSoft }}>Loading scan status...</div>
            </div>
          )}

          {!loadingQuota && view === "home" && (
            <HomeView
              quotaStatus={quotaStatus}
              photoDataUrl={photoDataUrl}
              savePhoto={savePhoto}
              setSavePhoto={setSavePhoto}
              userNotes={userNotes}
              setUserNotes={setUserNotes}
              scanning={scanning}
              onTakePhoto={handleTakePhoto}
              onPickFromLibrary={handlePickFromLibrary}
              onClearPhoto={handleClearPhoto}
              onSubmit={handleSubmitScan}
              onGoToPurchase={() => setView("purchase")}
            />
          )}

          {view === "result" && result && (
            <ResultView
              result={result}
              photoDataUrl={photoDataUrl}
              onScanAnother={() => {
                setView("home");
                setResult(null);
                setPhotoBase64(null);
                setPhotoDataUrl(null);
                setUserNotes("");
              }}
              onClose={onClose}
            />
          )}

          {view === "purchase" && (
            <PurchaseView
              quotaStatus={quotaStatus}
              purchasing={purchasing}
              onBuy={handlePurchasePack}
              onRestore={handleRestorePurchases}
              onBack={() => setView("home")}
            />
          )}
        </div>

        {/* Hidden web file input */}
        <input
          ref={webInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleWebFileSelected}
        />
      </div>
    </div>
  );
}

// ============================================================================
// HOME VIEW — quota display + photo capture + submit
// ============================================================================
function HomeView({
  quotaStatus, photoDataUrl, savePhoto, setSavePhoto, userNotes, setUserNotes,
  scanning, onTakePhoto, onPickFromLibrary, onClearPhoto, onSubmit, onGoToPurchase,
}) {
  if (!quotaStatus) return null;

  const totalRemaining = quotaStatus.total_remaining || 0;
  const canScan = totalRemaining > 0 && !!photoDataUrl && !scanning;

  return (
    <>
      {/* Quota transparency block */}
      <QuotaTransparency quotaStatus={quotaStatus} onGoToPurchase={onGoToPurchase} />

      {totalRemaining > 0 && (
        <>
          {/* Photo capture area */}
          <div style={{ marginTop: 18 }}>
            {!photoDataUrl ? (
              <div style={{
                border: `2px dashed ${palette.line}`, borderRadius: 12,
                padding: "30px 20px", textAlign: "center", background: palette.card,
              }}>
                <CameraIcon size={36} color={palette.inkSoft} />
                <div style={{ marginTop: 8, fontSize: 14, color: palette.inkSoft }}>
                  Take a close-up photo of the affected area for best results.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                  <Btn onClick={onTakePhoto} variant="leaf">
                    <CameraIcon size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
                    Take Photo
                  </Btn>
                  <Btn onClick={onPickFromLibrary} variant="ghost">
                    <ImageIcon size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
                    From Library
                  </Btn>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  borderRadius: 12, overflow: "hidden", border: `1.5px solid ${palette.line}`,
                  marginBottom: 10,
                }}>
                  <img src={photoDataUrl} alt="Plant to identify"
                    style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
                </div>

                <label style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                  fontSize: 14, color: palette.ink, cursor: "pointer",
                }}>
                  <input type="checkbox" checked={savePhoto} onChange={(e) => setSavePhoto(e.target.checked)} />
                  <span>Save this photo to my scan history</span>
                </label>

                <textarea
                  placeholder="Notes (optional, e.g. 'Bottom leaves of tomato plant')"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 8,
                    border: `1.5px solid ${palette.line}`, background: palette.card,
                    fontFamily: FONT_BODY, fontSize: 14, color: palette.ink,
                    boxSizing: "border-box", resize: "vertical", marginBottom: 12,
                  }}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn onClick={onSubmit} disabled={!canScan} variant="primary" style={{ flex: 1 }}>
                    {scanning ? (<>
                      <Spinner size={14} /><span style={{ marginLeft: 8 }}>Identifying...</span>
                    </>) : "Identify Plant"}
                  </Btn>
                  <Btn onClick={onClearPhoto} variant="ghost" disabled={scanning}>
                    Retake
                  </Btn>
                </div>
              </div>
            )}
          </div>

          <div style={{
            marginTop: 14, padding: "8px 12px", background: palette.card,
            borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
          }}>
            AI suggestions — verify before treating. Powered by Plant.id.
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// QUOTA TRANSPARENCY BLOCK
// ============================================================================
function QuotaTransparency({ quotaStatus, onGoToPurchase }) {
  const {
    free_quota_per_user = 0, free_used = 0, free_remaining = 0,
    extra_remaining = 0, supporter_count = 0, active_user_count = 0,
    total_pool_funded = 0, supporters_needed_for_1_scan = 0,
  } = quotaStatus;

  const totalRemaining = free_remaining + extra_remaining;
  const hasFree = free_quota_per_user > 0;

  return (
    <div style={{
      background: hasFree ? palette.successSoft : palette.warnSoft,
      border: `1.5px solid ${hasFree ? palette.success : palette.warn}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 6,
      }}>
        {totalRemaining > 0
          ? `You have ${totalRemaining} scan${totalRemaining === 1 ? "" : "s"} this month`
          : "No free scans available this month"}
      </div>
      <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
        {hasFree ? (
          <>
            <strong>{supporter_count}</strong> monthly supporter{supporter_count === 1 ? "" : "s"} fund{" "}
            <strong>{total_pool_funded}</strong> scans across <strong>{active_user_count}</strong> active homesteads
            = <strong>{free_quota_per_user}</strong> free per homestead.
            {free_used > 0 && <> You've used {free_used}.</>}
            {extra_remaining > 0 && <> You also have <strong>{extra_remaining}</strong> from scan packs.</>}
          </>
        ) : (
          <>
            Scans cost ~$0.10 each. This month, <strong>{supporter_count}</strong> monthly supporter{supporter_count === 1 ? "" : "s"}{" "}
            fund <strong>{total_pool_funded}</strong> scans — not enough to give everyone across{" "}
            <strong>{active_user_count}</strong> active homesteads even one.
            {supporters_needed_for_1_scan > 0 && (
              <> We need <strong>{supporters_needed_for_1_scan}</strong> more supporter{supporters_needed_for_1_scan === 1 ? "" : "s"}{" "}
              to give every homestead 1 free scan.</>
            )}
            {extra_remaining > 0 && <> You have <strong>{extra_remaining}</strong> from scan packs.</>}
          </>
        )}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={onGoToPurchase} small variant={totalRemaining > 0 ? "ghost" : "accent"}>
          {totalRemaining > 0 ? "Buy more scans" : "Buy scans / Become a supporter"}
        </Btn>
      </div>
    </div>
  );
}

// ============================================================================
// RESULT VIEW — show Plant.id findings
// ============================================================================
function ResultView({ result, photoDataUrl, onScanAnother, onClose }) {
  const r = result.result || {};
  const species = r.species;
  const diseases = r.diseases || [];
  const isPlant = r.is_plant;
  const isHealthy = r.is_healthy;

  return (
    <div>
      {photoDataUrl && (
        <div style={{
          borderRadius: 12, overflow: "hidden", border: `1.5px solid ${palette.line}`,
          marginBottom: 14,
        }}>
          <img src={photoDataUrl} alt="Scanned"
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
        </div>
      )}

      {!isPlant && (
        <div style={{
          background: palette.warnSoft, border: `1.5px solid ${palette.warn}`,
          borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 14,
          color: palette.ink,
        }}>
          This doesn't look like a plant. Try a closer, clearer photo of the leaves or stem.
        </div>
      )}

      {/* Species */}
      {species && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>
            Identified as
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink, lineHeight: 1.2, marginTop: 4 }}>
            {species.common_name || species.name}
          </div>
          {species.common_name && (
            <div style={{ fontSize: 13, color: palette.inkSoft, fontStyle: "italic" }}>
              {species.name}
            </div>
          )}
          <div style={{ fontSize: 13, color: palette.inkSoft, marginTop: 4 }}>
            Confidence: {Math.round((species.confidence || 0) * 100)}%
          </div>
          {species.description && (
            <div style={{ fontSize: 13, color: palette.ink, marginTop: 8, lineHeight: 1.55 }}>
              {species.description}
            </div>
          )}
        </div>
      )}

      {/* Health */}
      <div style={{
        background: isHealthy ? palette.successSoft : palette.warnSoft,
        border: `1.5px solid ${isHealthy ? palette.success : palette.warn}`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: palette.ink,
      }}>
        {isHealthy
          ? <><CheckCircle2 size={18} color={palette.success} /><span><strong>Looks healthy.</strong> No disease patterns detected.</span></>
          : <><AlertCircle size={18} color={palette.warn} /><span><strong>Possible issues detected.</strong> See below.</span></>}
      </div>

      {/* Diseases */}
      {diseases.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>
            Possible diseases
          </div>
          {diseases.map((d, i) => (
            <div key={i} style={{
              background: palette.card, border: `1.5px solid ${palette.line}`,
              borderRadius: 8, padding: "10px 12px", marginBottom: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 600, color: palette.ink, fontSize: 14 }}>{d.name}</div>
                <div style={{ fontSize: 13, color: palette.inkSoft, whiteSpace: "nowrap" }}>
                  {Math.round((d.probability || 0) * 100)}%
                </div>
              </div>
              {d.description && (
                <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, marginTop: 4 }}>
                  {typeof d.description === "string" ? d.description : d.description?.value}
                </div>
              )}
              {d.treatment && (
                <div style={{
                  marginTop: 8, padding: "6px 8px", background: palette.bgAlt,
                  borderRadius: 6, fontSize: 13, color: palette.ink, lineHeight: 1.5,
                }}>
                  <strong>Treatment: </strong>
                  {renderTreatment(d.treatment)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={onScanAnother} variant="leaf" style={{ flex: 1 }}>
          <RefreshCw size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
          Scan Another
        </Btn>
        <Btn onClick={onClose} variant="ghost">Done</Btn>
      </div>

      <div style={{
        marginTop: 14, padding: "8px 12px", background: palette.card,
        borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        AI suggestions — verify with a local expert before treating. Powered by Plant.id.
      </div>
    </div>
  );
}

// Plant.id treatment field can be an object with biological/chemical/prevention arrays
function renderTreatment(treatment) {
  if (typeof treatment === "string") return treatment;
  const parts = [];
  if (treatment?.biological?.length) parts.push(`Biological: ${treatment.biological.join("; ")}`);
  if (treatment?.chemical?.length) parts.push(`Chemical: ${treatment.chemical.join("; ")}`);
  if (treatment?.prevention?.length) parts.push(`Prevention: ${treatment.prevention.join("; ")}`);
  return parts.length ? parts.join(" | ") : "See plant care resources.";
}

// ============================================================================
// PURCHASE VIEW — scan pack options + restore purchases
// ============================================================================
function PurchaseView({ quotaStatus, purchasing, onBuy, onRestore, onBack }) {
  const native = isNative();

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Btn onClick={onBack} variant="ghost" small>← Back</Btn>
      </div>

      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 8,
      }}>
        Get more scans
      </div>
      <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55, marginBottom: 16 }}>
        Each scan costs Henalytics about $0.10 in AI API fees. Buy a pack to unlock more,
        or become a monthly supporter to expand the free pool for everyone.
      </div>

      <PackCard
        scans={10}
        price={SCAN_PACK_PRODUCTS[IAP_PRODUCTS.SCAN_PACK_10].priceDisplay}
        onClick={() => onBuy(10)}
        disabled={purchasing}
      />
      <PackCard
        scans={30}
        price={SCAN_PACK_PRODUCTS[IAP_PRODUCTS.SCAN_PACK_30].priceDisplay}
        onClick={() => onBuy(30)}
        disabled={purchasing}
        badge="Best value"
      />

      {native && (
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <button onClick={onRestore} disabled={purchasing} style={{
            background: "transparent", border: "none", color: palette.inkSoft,
            fontSize: 13, textDecoration: "underline", cursor: purchasing ? "not-allowed" : "pointer",
            fontFamily: FONT_BODY, padding: 4,
          }}>
            Restore previous purchases
          </button>
        </div>
      )}

      <div style={{
        marginTop: 16, padding: "8px 12px", background: palette.card,
        borderRadius: 8, fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        Unused scans from packs carry over month-to-month. Free monthly scans don't.
      </div>
    </div>
  );
}

function PackCard({ scans, price, onClick, disabled, badge }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      display: "block", width: "100%", background: palette.card,
      border: `1.5px solid ${palette.line}`, borderRadius: 10, padding: "12px 14px",
      marginBottom: 10, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1, fontFamily: FONT_BODY,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, lineHeight: 1.1 }}>
            {scans} Scan Credits
          </div>
          {badge && (
            <div style={{
              display: "inline-block", marginTop: 4, padding: "2px 8px",
              background: palette.yolkSoft, color: palette.ink, fontSize: 11,
              fontWeight: 600, borderRadius: 4,
            }}>{badge}</div>
          )}
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.accent,
        }}>{price}</div>
      </div>
    </button>
  );
}
