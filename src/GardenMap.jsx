// ============================================================================
// GARDEN MAP — v2
// ----------------------------------------------------------------------------
// Photo-based garden visualizer. Users can:
//   - Create multiple "areas" (Back beds, Front yard, etc.), each with its own photo + pins
//   - Drop pins by tapping the photo
//   - Drag pins to reposition them
//   - Edit plant date (back or forward) and notes
//   - Remove pins
//   - Browse archived seasons' garden maps (year-over-year)
//
// Data shape:
//   season.gardenMap = {
//     areas: [{ id, name, photoPath, pins: [{ id, x, y, cropId, plantedDate, note }] }]
//   }
//
// Backwards-compat: old data with { photoPath, pins[] } at the top level is
// auto-migrated to { areas: [{ name: "Garden", ... }] } on load.
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { X, Trash2, Upload, ChevronLeft, ChevronRight, Plus, Edit3, Archive } from "lucide-react";
import { CROPS } from "./gardenAlmanac.js";
import { uploadPhoto, getPhotoUrl, deletePhoto } from "./sync.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  card: "#FAF5EA", line: "#2C181030",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const newId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
};
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ---- Crop colors (same as before) ----
const CROP_COLORS = {
  tomatoes: "#C84B31", peppers: "#E8531C", eggplant: "#8B4789",
  cucumbers: "#5A7A3C", summer_squash: "#7A9F4A", winter_squash: "#D2691E", melons: "#FF6F61",
  bush_beans: "#8B7355", pole_beans: "#A0855B", peas: "#A8C078",
  broccoli: "#4A6741", cauliflower: "#E8DCC4", cabbage: "#7B9F4F",
  kale: "#3D5A2E", brussels_sprouts: "#5A7A3C",
  carrots: "#E8851C", beets: "#8B2635", radishes: "#D63864",
  turnips: "#C9A77B", potatoes: "#8B6F47", sweet_potatoes: "#A0522D",
  onions: "#D9C7A1", garlic: "#E8DCC4",
  lettuce: "#A8C078", spinach: "#3D5A2E", swiss_chard: "#9F4A3C", arugula: "#7B9F4F",
  basil: "#5A7A3C", cilantro: "#7B9F4F", parsley: "#3D5A2E", dill: "#A8C078",
  sweet_corn: "#E8B547",
};
const colorForCrop = (cropId) => CROP_COLORS[cropId] || palette.feather;

// ============================================================================
// GARDEN MAP DATA MIGRATION
// ============================================================================
// Old shape: { photoPath, pins[] }
// New shape: { areas: [{ id, name, photoPath, pins[] }] }
function migrateGardenMap(map) {
  if (!map) return { areas: [] };
  if (Array.isArray(map.areas)) return map; // Already migrated
  // Old single-photo shape — wrap it as one area
  if (map.photoPath) {
    return {
      areas: [{
        id: newId(),
        name: "Garden",
        photoPath: map.photoPath,
        pins: map.pins || [],
      }],
    };
  }
  return { areas: [] };
}

// ============================================================================
// MAIN MODAL
// ============================================================================

export default function GardenMapModal({ data, update, user, onClose }) {
  const hobby = data.hobbies.find((h) => h.id === "garden");
  const season = hobby?.currentSeason;
  if (!season) {
    onClose();
    return null;
  }

  const map = migrateGardenMap(season.gardenMap);
  const archivedSeasons = (hobby.archivedSeasons || []).filter((s) => s.gardenMap);

  // Active area index (0 = first area, etc). Start at 0 if any areas exist.
  const [activeIdx, setActiveIdx] = useState(0);
  const [showArchive, setShowArchive] = useState(false);

  // Inline replacement for window.prompt / window.confirm — those don't work
  // reliably in Capacitor / iOS WKWebView. State drives a small overlay.
  // nameInput: { title, initial, placeholder, onSave } when open, else null
  // confirmAsk: { message, onConfirm } when open, else null
  const [nameInput, setNameInput] = useState(null);
  const [confirmAsk, setConfirmAsk] = useState(null);

  // Reset active idx if it points past the end (e.g. after deleting an area)
  useEffect(() => {
    if (activeIdx >= map.areas.length && map.areas.length > 0) {
      setActiveIdx(map.areas.length - 1);
    }
  }, [map.areas.length, activeIdx]);

  const activeArea = map.areas[activeIdx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, padding: 20, borderRadius: 12,
          maxWidth: 560, width: "100%", maxHeight: "92vh", overflowY: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "4px 4px 0 " + palette.line,
          fontFamily: FONT_BODY, color: palette.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, margin: 0 }}>🗺️ Garden Map</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Archive viewer */}
        {showArchive && (
          <ArchiveViewer
            archivedSeasons={archivedSeasons}
            onClose={() => setShowArchive(false)}
          />
        )}

        {/* Area tabs (only show if there's at least one area) */}
        {!showArchive && map.areas.length > 0 && (
          <AreaTabs
            areas={map.areas}
            activeIdx={activeIdx}
            setActiveIdx={setActiveIdx}
            onAddArea={() => {
              setNameInput({
                title: "Name this area",
                initial: "New area",
                placeholder: "e.g. Back beds, Front yard",
                onSave: (name) => {
                  update((d) => {
                    const h = d.hobbies.find((x) => x.id === "garden");
                    if (!h?.currentSeason) return d;
                    h.currentSeason.gardenMap = migrateGardenMap(h.currentSeason.gardenMap);
                    h.currentSeason.gardenMap.areas.push({
                      id: newId(),
                      name: name.trim(),
                      photoPath: null,
                      pins: [],
                    });
                    return d;
                  });
                  setActiveIdx(map.areas.length); // jump to the new tab
                },
              });
            }}
          />
        )}

        {/* Empty state — no areas at all */}
        {!showArchive && map.areas.length === 0 && (
          <EmptyState
            onCreateFirst={() => {
              setNameInput({
                title: "Name this area",
                initial: "Garden",
                placeholder: "e.g. Back beds, Front yard",
                onSave: (name) => {
                  update((d) => {
                    const h = d.hobbies.find((x) => x.id === "garden");
                    if (!h?.currentSeason) return d;
                    h.currentSeason.gardenMap = { areas: [{
                      id: newId(),
                      name: name.trim(),
                      photoPath: null,
                      pins: [],
                    }]};
                    return d;
                  });
                  setActiveIdx(0);
                },
              });
            }}
            archivedSeasons={archivedSeasons}
            onShowArchive={() => setShowArchive(true)}
          />
        )}

        {/* Active area */}
        {!showArchive && activeArea && (
          <AreaEditor
            area={activeArea}
            areaIdx={activeIdx}
            user={user}
            update={update}
            onRenameArea={() => {
              setNameInput({
                title: "Rename area",
                initial: activeArea.name,
                placeholder: "Area name",
                onSave: (name) => {
                  update((d) => {
                    const h = d.hobbies.find((x) => x.id === "garden");
                    if (!h?.currentSeason?.gardenMap?.areas?.[activeIdx]) return d;
                    h.currentSeason.gardenMap.areas[activeIdx].name = name.trim();
                    return d;
                  });
                },
              });
            }}
            onDeleteArea={() => {
              setConfirmAsk({
                message: `Delete area "${activeArea.name}" and all its pins? This can't be undone.`,
                onConfirm: () => {
                  const oldPath = activeArea.photoPath;
                  update((d) => {
                    const h = d.hobbies.find((x) => x.id === "garden");
                    if (!h?.currentSeason?.gardenMap?.areas) return d;
                    h.currentSeason.gardenMap.areas.splice(activeIdx, 1);
                    return d;
                  });
                  if (oldPath) deletePhoto(oldPath).catch(() => {});
                  setActiveIdx(0);
                },
              });
            }}
          />
        )}

        {/* Footer: archive button */}
        {!showArchive && archivedSeasons.length > 0 && (
          <button
            onClick={() => setShowArchive(true)}
            style={{
              marginTop: 14, padding: "10px 14px",
              background: palette.bgAlt, border: `1.5px solid ${palette.line}`,
              borderRadius: 8, cursor: "pointer", width: "100%",
              fontFamily: FONT_BODY, fontSize: 13, color: palette.ink,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Archive size={14} /> View past years ({archivedSeasons.length})
          </button>
        )}
      </div>

      {/* Inline replacements for window.prompt / window.confirm.
          Rendered LAST so they overlay everything else. They sit inside the
          outer onClick-to-close wrapper but stop propagation themselves. */}
      {nameInput && (
        <NamePrompt
          title={nameInput.title}
          initial={nameInput.initial}
          placeholder={nameInput.placeholder}
          onCancel={() => setNameInput(null)}
          onSave={(name) => {
            const trimmed = (name || "").trim();
            if (!trimmed) return;
            nameInput.onSave(trimmed);
            setNameInput(null);
          }}
        />
      )}
      {confirmAsk && (
        <ConfirmInline
          message={confirmAsk.message}
          onCancel={() => setConfirmAsk(null)}
          onConfirm={() => {
            const cb = confirmAsk.onConfirm;
            setConfirmAsk(null);
            cb();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// INLINE NAME PROMPT — replaces window.prompt
// ============================================================================
function NamePrompt({ title, initial, placeholder, onSave, onCancel }) {
  const [value, setValue] = useState(initial || "");
  const inputRef = useRef(null);
  useEffect(() => {
    // Focus + select on mount so the user can immediately type or overwrite.
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 110, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, padding: 20, borderRadius: 12,
          maxWidth: 360, width: "100%",
          border: `2px solid ${palette.ink}`,
          boxShadow: "4px 4px 0 " + palette.line,
          fontFamily: FONT_BODY, color: palette.ink,
        }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 12 }}>{title}</div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(value);
            if (e.key === "Escape") onCancel();
          }}
          placeholder={placeholder || ""}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: `1.5px solid ${palette.line}`,
            fontFamily: FONT_BODY, fontSize: 14, color: palette.ink,
            background: palette.card, boxSizing: "border-box",
            marginBottom: 14,
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "transparent", color: palette.ink,
              border: `1.5px solid ${palette.line}`, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(value)}
            disabled={!value.trim()}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: palette.ink, color: palette.bg,
              border: `1.5px solid ${palette.ink}`,
              cursor: value.trim() ? "pointer" : "not-allowed",
              opacity: value.trim() ? 1 : 0.5,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              boxShadow: "2px 2px 0 " + palette.line,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INLINE CONFIRM — replaces window.confirm
// ============================================================================
function ConfirmInline({ message, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 110, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, padding: 20, borderRadius: 12,
          maxWidth: 360, width: "100%",
          border: `2px solid ${palette.ink}`,
          boxShadow: "4px 4px 0 " + palette.line,
          fontFamily: FONT_BODY, color: palette.ink,
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "transparent", color: palette.ink,
              border: `1.5px solid ${palette.line}`, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: palette.accent, color: palette.bg,
              border: `1.5px solid ${palette.accent}`, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              boxShadow: "2px 2px 0 " + palette.line,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ onCreateFirst, archivedSeasons, onShowArchive }) {
  return (
    <div style={{
      padding: 28, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
      borderRadius: 10, textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 6 }}>
        Map your garden
      </div>
      <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.5, marginBottom: 16 }}>
        Add areas (e.g. "Back beds", "Front yard"), upload a photo of each, and tap to drop plant pins. Compare layouts year-over-year.
      </div>
      <button
        onClick={onCreateFirst}
        style={{
          padding: "10px 18px", background: palette.ink, color: palette.bg,
          border: "none", borderRadius: 8, cursor: "pointer",
          fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: "2px 2px 0 " + palette.line,
        }}
      >
        <Plus size={16} /> Add your first area
      </button>
      {archivedSeasons.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={onShowArchive}
            style={{
              background: "none", border: "none",
              color: palette.inkSoft, fontSize: 12,
              cursor: "pointer", textDecoration: "underline",
            }}
          >
            View past years ({archivedSeasons.length})
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AREA TABS — horizontal scroll of named tabs
// ============================================================================
function AreaTabs({ areas, activeIdx, setActiveIdx, onAddArea }) {
  return (
    <div style={{
      display: "flex", gap: 6, marginBottom: 10,
      overflowX: "auto", paddingBottom: 4,
    }}>
      {areas.map((a, i) => (
        <button
          key={a.id}
          onClick={() => setActiveIdx(i)}
          style={{
            padding: "6px 12px",
            background: i === activeIdx ? palette.ink : palette.card,
            color: i === activeIdx ? palette.bg : palette.ink,
            border: `1.5px solid ${palette.line}`,
            borderRadius: 6, cursor: "pointer",
            fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600,
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {a.name}{a.pins?.length ? ` (${a.pins.length})` : ""}
        </button>
      ))}
      <button
        onClick={onAddArea}
        style={{
          padding: "6px 10px",
          background: palette.bgAlt,
          color: palette.ink,
          border: `1.5px dashed ${palette.line}`,
          borderRadius: 6, cursor: "pointer",
          fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600,
          whiteSpace: "nowrap", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

// ============================================================================
// AREA EDITOR — the photo + pins for one area
// ============================================================================
function AreaEditor({ area, areaIdx, user, update, onRenameArea, onDeleteArea }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activePin, setActivePin] = useState(null);
  const [showCropPicker, setShowCropPicker] = useState(null);
  const [draggingPinId, setDraggingPinId] = useState(null);

  const photoRef = useRef(null);
  const fileInputRef = useRef(null);

  // ---- Resolve photo URL ----
  // Signed URLs expire after 24h (see sync.js#getPhotoUrl). Refresh every
  // 20h so a long planning session never sees a stale 403.
  const [photoLoadError, setPhotoLoadError] = useState(false);
  useEffect(() => {
    if (!area.photoPath) {
      setPhotoUrl(null);
      setPhotoLoadError(false);
      return;
    }
    let cancelled = false;
    const fetchUrl = () => {
      setPhotoLoadError(false);
      getPhotoUrl(area.photoPath).then((url) => {
        if (cancelled) return;
        if (url) {
          setPhotoUrl(url);
        } else {
          setPhotoLoadError(true);
        }
      });
    };
    fetchUrl();
    const refreshId = setInterval(fetchUrl, 20 * 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(refreshId); };
  }, [area.photoPath]);

  // ---- Upload photo ----
  const handlePhotoUpload = async (file) => {
    if (!user) {
      setUploadError("Sign in first to upload a photo.");
      return;
    }
    setUploadError("");
    setPhotoLoading(true);
    try {
      const path = await uploadPhoto(user, `garden-area-${area.id}`, file);
      const oldPath = area.photoPath;
      update((d) => {
        const h = d.hobbies.find((x) => x.id === "garden");
        if (!h?.currentSeason?.gardenMap?.areas?.[areaIdx]) return d;
        h.currentSeason.gardenMap.areas[areaIdx].photoPath = path;
        return d;
      });
      if (oldPath) deletePhoto(oldPath).catch(() => {});
    } catch (e) {
      setUploadError(e.message || "Upload failed.");
    }
    setPhotoLoading(false);
  };

  // ---- Tap photo to add a pin ----
  const handlePhotoClick = (e) => {
    if (!photoRef.current) return;
    if (draggingPinId) return; // ignore clicks during drag
    if (activePin) { setActivePin(null); return; }

    const rect = photoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setShowCropPicker({ x, y });
  };

  const placePin = (cropId) => {
    if (!showCropPicker) return;
    const newPin = {
      id: newId(),
      x: showCropPicker.x,
      y: showCropPicker.y,
      cropId,
      plantedDate: todayStr(),
      note: "",
    };
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      if (!h?.currentSeason?.gardenMap?.areas?.[areaIdx]) return d;
      h.currentSeason.gardenMap.areas[areaIdx].pins.push(newPin);
      return d;
    });
    setShowCropPicker(null);
  };

  // ---- Drag-to-reposition pin ----
  // We use pointer events which work for both mouse and touch.
  const handlePinPointerDown = (pinId, e) => {
    e.stopPropagation();
    setDraggingPinId(pinId);
    if (e.target?.setPointerCapture && e.pointerId != null) {
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handlePinPointerMove = (pinId, e) => {
    if (draggingPinId !== pinId) return;
    if (!photoRef.current) return;
    e.preventDefault();
    const rect = photoRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      const areaPins = h?.currentSeason?.gardenMap?.areas?.[areaIdx]?.pins;
      if (!areaPins) return d;
      const p = areaPins.find((pp) => pp.id === pinId);
      if (p) { p.x = x; p.y = y; }
      return d;
    });
  };

  const handlePinPointerUp = (e) => {
    setDraggingPinId(null);
  };

  const handlePinTap = (pin) => {
    // Only treat as tap (open info) if not coming off a drag
    if (draggingPinId === pin.id) return;
    setActivePin(pin);
    setShowCropPicker(null);
  };

  return (
    <div>
      {/* Area header — name + actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10, gap: 8,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink,
          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {area.name}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={onRenameArea}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
            title="Rename area"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDeleteArea}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, padding: 4 }}
            title="Delete area"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* No photo for this area yet */}
      {!area.photoPath && (
        <div style={{
          padding: 28, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
          borderRadius: 10, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
            Upload a photo of this area to start dropping pins.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) handlePhotoUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoLoading}
            style={{
              padding: "10px 18px", background: palette.ink, color: palette.bg,
              border: "none", borderRadius: 8, cursor: photoLoading ? "wait" : "pointer",
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14,
              display: "inline-flex", alignItems: "center", gap: 6,
              opacity: photoLoading ? 0.7 : 1,
            }}
          >
            <Upload size={16} />
            {photoLoading ? "Uploading…" : "Choose photo"}
          </button>
          {uploadError && <div style={{ fontSize: 12, color: palette.accent, marginTop: 8 }}>{uploadError}</div>}
        </div>
      )}

      {/* Photo path exists but URL fetch failed — surface it instead of
          silently rendering nothing. Common causes: signed URL expired,
          Supabase storage hiccup, or the underlying object was deleted. */}
      {area.photoPath && photoLoadError && (
        <div style={{
          padding: 20, background: palette.bgAlt, border: `1.5px dashed ${palette.accent}`,
          borderRadius: 10, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: palette.ink, marginBottom: 6 }}>
            Couldn't load this photo
          </div>
          <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
            The photo is still saved — this is usually a temporary connection issue.
          </div>
          <button
            onClick={() => {
              setPhotoLoadError(false);
              getPhotoUrl(area.photoPath).then((url) => {
                if (url) setPhotoUrl(url);
                else setPhotoLoadError(true);
              });
            }}
            style={{
              padding: "8px 16px", background: palette.ink, color: palette.bg,
              border: "none", borderRadius: 8, cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              boxShadow: "2px 2px 0 " + palette.line,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Photo with pins */}
      {area.photoPath && photoUrl && !photoLoadError && (
        <>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.5 }}>
            {area.pins.length === 0
              ? "Tap anywhere on the photo to drop your first pin."
              : `${area.pins.length} ${area.pins.length === 1 ? "pin" : "pins"}. Tap a pin to view, drag to reposition, tap photo to add new.`}
          </div>

          <div
            ref={photoRef}
            onClick={handlePhotoClick}
            style={{
              position: "relative",
              width: "100%",
              borderRadius: 10,
              overflow: "hidden",
              border: `1.5px solid ${palette.line}`,
              cursor: "crosshair",
              background: `url(${photoUrl}) center/cover no-repeat`,
              aspectRatio: "4 / 3",
              touchAction: "none", // prevent scroll while dragging pins
            }}
          >
            {area.pins.map((pin) => {
              const crop = CROPS.find((c) => c.id === pin.cropId);
              return (
                <div
                  key={pin.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePinTap(pin);
                  }}
                  onPointerDown={(e) => handlePinPointerDown(pin.id, e)}
                  onPointerMove={(e) => handlePinPointerMove(pin.id, e)}
                  onPointerUp={handlePinPointerUp}
                  onPointerCancel={handlePinPointerUp}
                  style={{
                    position: "absolute",
                    left: `${pin.x * 100}%`,
                    top: `${pin.y * 100}%`,
                    transform: `translate(-50%, -100%) rotate(-45deg)`,
                    background: colorForCrop(pin.cropId),
                    border: "2.5px solid white",
                    borderRadius: "50% 50% 50% 0",
                    width: 30, height: 30,
                    cursor: draggingPinId === pin.id ? "grabbing" : "grab",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: draggingPinId === pin.id ? "0 4px 8px rgba(0,0,0,0.5)" : "0 2px 4px rgba(0,0,0,0.3)",
                    transition: draggingPinId === pin.id ? "none" : "box-shadow 0.15s",
                    zIndex: draggingPinId === pin.id ? 10 : 1,
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  title={crop?.name || "Unknown plant"}
                >
                  <span style={{ transform: "rotate(45deg)", fontSize: 14, pointerEvents: "none" }}>
                    {crop?.emoji || "🌱"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Replace photo */}
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) handlePhotoUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoLoading}
              style={{
                background: "none", border: "none",
                color: palette.inkSoft, fontSize: 11,
                cursor: photoLoading ? "wait" : "pointer",
                textDecoration: "underline", padding: 4,
              }}
            >
              {photoLoading ? "Uploading…" : "Replace photo"}
            </button>
          </div>
        </>
      )}

      {/* Pin info / edit panel */}
      {activePin && (
        <PinInfoPanel
          pin={activePin}
          areaIdx={areaIdx}
          update={update}
          onClose={() => setActivePin(null)}
        />
      )}

      {/* Crop picker */}
      {showCropPicker && (
        <CropPicker
          onPick={placePin}
          onCancel={() => setShowCropPicker(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// PIN INFO PANEL (now editable)
// ============================================================================
function PinInfoPanel({ pin, areaIdx, update, onClose }) {
  const crop = CROPS.find((c) => c.id === pin.cropId);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(pin.plantedDate || todayStr());
  const [note, setNote] = useState(pin.note || "");

  if (!crop) return null;

  // Re-sync local state if a different pin gets opened
  useEffect(() => {
    setEditing(false);
    setDate(pin.plantedDate || todayStr());
    setNote(pin.note || "");
  }, [pin.id]);

  const plantedDate = new Date(date + "T12:00");
  const harvestDate = crop.daysToHarvest
    ? new Date(plantedDate.getTime() + crop.daysToHarvest * 86400000)
    : null;
  const fmtDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysSincePlant = Math.floor((today.getTime() - plantedDate.getTime()) / 86400000);
  const daysToHarvestRemaining = harvestDate
    ? Math.floor((harvestDate.getTime() - today.getTime()) / 86400000)
    : null;

  const save = () => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      const pins = h?.currentSeason?.gardenMap?.areas?.[areaIdx]?.pins;
      if (!pins) return d;
      const p = pins.find((pp) => pp.id === pin.id);
      if (p) {
        p.plantedDate = date;
        p.note = note;
      }
      return d;
    });
    setEditing(false);
  };

  const remove = () => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      const area = h?.currentSeason?.gardenMap?.areas?.[areaIdx];
      if (!area) return d;
      area.pins = area.pins.filter((pp) => pp.id !== pin.id);
      return d;
    });
    onClose();
  };

  return (
    <div style={{
      marginTop: 14, padding: 14,
      background: palette.card, border: `1.5px solid ${colorForCrop(pin.cropId)}`,
      borderLeft: `4px solid ${colorForCrop(pin.cropId)}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>{crop.emoji}</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink }}>{crop.name}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {!editing ? (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
            <div>
              <strong style={{ color: palette.ink }}>Planted:</strong> {fmtDate(plantedDate)}
              {daysSincePlant >= 0 && ` (${daysSincePlant} day${daysSincePlant === 1 ? "" : "s"} ago)`}
              {daysSincePlant < 0 && ` (in ${Math.abs(daysSincePlant)} days)`}
            </div>
            {harvestDate && (
              <div>
                <strong style={{ color: palette.ink }}>Expected harvest:</strong> {fmtDate(harvestDate)}
                {daysToHarvestRemaining > 0 && ` (in ${daysToHarvestRemaining} days)`}
                {daysToHarvestRemaining <= 0 && ` (ready! 🧺)`}
              </div>
            )}
            {pin.note && (
              <div style={{ marginTop: 6, fontStyle: "italic" }}>📝 {pin.note}</div>
            )}
            {crop.notes && !pin.note && (
              <div style={{ marginTop: 6, fontStyle: "italic" }}>💡 {crop.notes}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "6px 10px", fontSize: 12,
                background: palette.ink, color: palette.bg,
                border: "none", borderRadius: 6,
                cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              onClick={remove}
              style={{
                padding: "6px 10px", fontSize: 12,
                background: "transparent", color: palette.accent,
                border: `1.5px solid ${palette.accent}`, borderRadius: 6,
                cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: palette.inkSoft, display: "block", marginBottom: 4 }}>
              Planted date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                border: `1.5px solid ${palette.line}`, borderRadius: 6,
                fontFamily: FONT_BODY, fontSize: 13, background: "white", color: palette.ink,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: palette.inkSoft, display: "block", marginBottom: 4 }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cherokee Purple"
              style={{
                width: "100%", padding: "8px 10px",
                border: `1.5px solid ${palette.line}`, borderRadius: 6,
                fontFamily: FONT_BODY, fontSize: 13, background: "white", color: palette.ink,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={save}
              style={{
                padding: "6px 10px", fontSize: 12,
                background: palette.ink, color: palette.bg,
                border: "none", borderRadius: 6, cursor: "pointer",
                fontFamily: FONT_BODY, fontWeight: 600,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: "6px 10px", fontSize: 12,
                background: "transparent", color: palette.inkSoft,
                border: `1.5px solid ${palette.line}`, borderRadius: 6, cursor: "pointer",
                fontFamily: FONT_BODY, fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// CROP PICKER (unchanged from v1)
// ============================================================================
function CropPicker({ onPick, onCancel }) {
  return (
    <div style={{
      marginTop: 14, padding: 14,
      background: palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: palette.ink }}>Pick a plant</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 6,
        maxHeight: 280,
        overflowY: "auto",
      }}>
        {CROPS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              padding: "8px 6px",
              background: palette.bg,
              border: `1.5px solid ${palette.line}`,
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT_BODY, fontSize: 11, color: palette.ink,
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 18 }}>{c.emoji}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ARCHIVE VIEWER — read-only browser of past seasons' garden maps
// ============================================================================
function ArchiveViewer({ archivedSeasons, onClose }) {
  // Sort newest first
  const sorted = [...archivedSeasons].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [areaIdx, setAreaIdx] = useState(0);

  const season = sorted[seasonIdx];
  const map = migrateGardenMap(season?.gardenMap);
  const area = map.areas[areaIdx];

  return (
    <div>
      <button
        onClick={onClose}
        style={{
          padding: "6px 10px", fontSize: 12, marginBottom: 10,
          background: "transparent", color: palette.ink,
          border: `1.5px solid ${palette.line}`, borderRadius: 6, cursor: "pointer",
          fontFamily: FONT_BODY, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        <ChevronLeft size={12} /> Back to current
      </button>

      {/* Season picker */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: 12, background: palette.bgAlt, borderRadius: 8, marginBottom: 10,
      }}>
        <button
          onClick={() => { setSeasonIdx(Math.max(0, seasonIdx - 1)); setAreaIdx(0); }}
          disabled={seasonIdx === 0}
          style={{
            background: "none", border: "none", cursor: seasonIdx === 0 ? "default" : "pointer",
            color: seasonIdx === 0 ? palette.line : palette.ink, padding: 4,
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: palette.ink, textAlign: "center" }}>
          {season?.name || "—"}
          <div style={{ fontSize: 11, color: palette.inkSoft, fontFamily: FONT_BODY, fontStyle: "italic", fontWeight: "normal" }}>
            {season?.startDate?.slice(0, 4)}
          </div>
        </div>
        <button
          onClick={() => { setSeasonIdx(Math.min(sorted.length - 1, seasonIdx + 1)); setAreaIdx(0); }}
          disabled={seasonIdx === sorted.length - 1}
          style={{
            background: "none", border: "none", cursor: seasonIdx === sorted.length - 1 ? "default" : "pointer",
            color: seasonIdx === sorted.length - 1 ? palette.line : palette.ink, padding: 4,
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Area tabs (read-only) */}
      {map.areas.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
          {map.areas.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setAreaIdx(i)}
              style={{
                padding: "6px 12px",
                background: i === areaIdx ? palette.ink : palette.card,
                color: i === areaIdx ? palette.bg : palette.ink,
                border: `1.5px solid ${palette.line}`,
                borderRadius: 6, cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {a.name}{a.pins?.length ? ` (${a.pins.length})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Read-only photo */}
      {area && area.photoPath && (
        <ReadOnlyAreaView area={area} />
      )}

      {(!area || !area.photoPath) && (
        <div style={{
          padding: 20, background: palette.bgAlt, borderRadius: 8, textAlign: "center",
          fontSize: 13, color: palette.inkSoft, fontStyle: "italic",
        }}>
          No map saved for this {map.areas.length === 0 ? "season" : "area"}.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// READ-ONLY AREA VIEW — used by the archive viewer
// ============================================================================
function ReadOnlyAreaView({ area }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [activePin, setActivePin] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (area.photoPath) {
      getPhotoUrl(area.photoPath).then((url) => { if (!cancelled) setPhotoUrl(url); });
    }
    return () => { cancelled = true; };
  }, [area.photoPath]);

  if (!photoUrl) {
    return <div style={{ padding: 14, textAlign: "center", color: palette.inkSoft, fontSize: 13 }}>Loading photo…</div>;
  }

  return (
    <>
      <div style={{
        position: "relative",
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: `1.5px solid ${palette.line}`,
        background: `url(${photoUrl}) center/cover no-repeat`,
        aspectRatio: "4 / 3",
      }}>
        {area.pins.map((pin) => {
          const crop = CROPS.find((c) => c.id === pin.cropId);
          return (
            <div
              key={pin.id}
              onClick={() => setActivePin(pin)}
              style={{
                position: "absolute",
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: `translate(-50%, -100%) rotate(-45deg)`,
                background: colorForCrop(pin.cropId),
                border: "2.5px solid white",
                borderRadius: "50% 50% 50% 0",
                width: 28, height: 28,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
              title={crop?.name || "Unknown plant"}
            >
              <span style={{ transform: "rotate(45deg)", fontSize: 13 }}>
                {crop?.emoji || "🌱"}
              </span>
            </div>
          );
        })}
      </div>

      {activePin && (
        <div style={{
          marginTop: 10, padding: 12,
          background: palette.card, border: `1.5px solid ${colorForCrop(activePin.cropId)}`,
          borderLeft: `4px solid ${colorForCrop(activePin.cropId)}`,
          borderRadius: 8,
        }}>
          {(() => {
            const crop = CROPS.find((c) => c.id === activePin.cropId);
            if (!crop) return null;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{crop.emoji}</span>
                    <strong style={{ fontSize: 14 }}>{crop.name}</strong>
                  </div>
                  <button onClick={() => setActivePin(null)} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
                {activePin.plantedDate && (
                  <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                    Planted: {new Date(activePin.plantedDate + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
                {activePin.note && (
                  <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>
                    📝 {activePin.note}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}
