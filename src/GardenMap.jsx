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

const newId = () => Math.random().toString(36).substring(2, 11);
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

// Resolves the display info for a pin. Supports the "other" / custom-plant
// option where the user typed a free-form name when placing the pin.
// Returns { name, emoji } — falls back to "Unknown plant" / 🌱 if neither
// the CROPS list nor a customName is available.
const pinDisplay = (pin) => {
  if (pin?.cropId === "other") {
    return { name: pin.customName || "Custom plant", emoji: "🌱" };
  }
  const crop = CROPS.find((c) => c.id === pin?.cropId);
  if (crop) return { name: crop.name, emoji: crop.emoji };
  return { name: "Unknown plant", emoji: "🌱" };
};

// GARDEN_GRID: early-access gate for the "garden_grid" feature.
// A self-contained copy of the same pure date logic used by the 2A gate
// in HomesteadApp.jsx (GardenMap.jsx cannot cleanly import from there).
// Returns "public" | "supporter" | "early-locked" | "hidden" | "ungated".
function gardenGridGateState(config, isSupporter, now) {
  const today = now instanceof Date ? now : new Date();
  const features = config && config.features;
  if (!features || typeof features !== "object") return "ungated";
  const f = features["garden_grid"];
  if (!f || typeof f !== "object" || !f.publicDate) return "ungated";
  const parts = String(f.publicDate).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "ungated";
  const publicAt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  if (isNaN(publicAt.getTime())) return "ungated";
  if (today.getTime() >= publicAt.getTime()) return "public";
  if (f.supporterEarlyAccess !== true) return "hidden";
  const days = Number(f.earlyAccessDays);
  const windowDays = (Number.isFinite(days) && days > 0) ? days : 7;
  const earlyAt = new Date(publicAt.getTime() - windowDays * 86400000);
  if (today.getTime() < earlyAt.getTime()) return "hidden";
  return isSupporter ? "supporter" : "early-locked";
}

// GARDEN_GRID: format a YYYY-MM-DD date for display, e.g. "July 1".
function gardenGridPublicDateLabel(config) {
  const f = config && config.features && config.features['garden_grid'];
  const parts = String((f && f.publicDate) || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// ============================================================================
// GARDEN MAP DATA MIGRATION
// ============================================================================
// Old shape: { photoPath, pins[] }
// New shape: { areas: [{ id, name, photoPath, pins[] }] }
function migrateGardenMap(map) {
  if (!map) return { areas: [] };
  if (Array.isArray(map.areas)) {
    // GARDEN_GRID: ensure every area has a mode. Absent => "photo",
    // so all pre-grid areas keep behaving exactly as before. No rewrite
    // of pins or anything else — only a default on a missing field.
    map.areas.forEach((a) => { if (!a.mode) a.mode = "photo"; });
    return map;
  }
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

export default function GardenMapModal({ data, update, user, onClose, /* GARDEN_GRID */ earlyAccessConfig = null, isSupporter = false }) {
  const hobby = data.hobbies.find((h) => h.id === "garden");
  const season = hobby?.currentSeason;
  if (!season) {
    onClose();
    return null;
  }

  const map = migrateGardenMap(season.gardenMap);
  const archivedSeasons = (hobby.archivedSeasons || []).filter((s) => s.gardenMap);

  // GARDEN_GRID: resolve whether the Grid area option is available.
  // gridGate is one of public | supporter | early-locked | hidden | ungated.
  // The Grid CHOICE is offered when public/supporter/ungated, shown locked
  // when early-locked, and omitted when hidden. Existing grid areas are
  // never affected — only the option to create a NEW one.
  const gridGate = gardenGridGateState(earlyAccessConfig, isSupporter);
  const gridChoiceOffered = gridGate === "public" || gridGate === "supporter" || gridGate === "ungated";
  const gridChoiceLocked = gridGate === "early-locked";
  const gridPublicLabel = gardenGridPublicDateLabel(earlyAccessConfig);

  // Active area index (0 = first area, etc). Start at 0 if any areas exist.
  const [activeIdx, setActiveIdx] = useState(0);
  const [showArchive, setShowArchive] = useState(false);

  // Reset active idx if it points past the end (e.g. after deleting an area)
  useEffect(() => {
    if (activeIdx >= map.areas.length && map.areas.length > 0) {
      setActiveIdx(map.areas.length - 1);
    }
  }, [map.areas.length, activeIdx]);

  const activeArea = map.areas[activeIdx];

  // GARDEN_GRID: unified area creation. Asks Photo vs Grid (when the
  // grid option is available), then name, then for a grid the dimensions.
  // Uses window.prompt/confirm to match the file's existing creation UX.
  const createArea = () => {
    let mode = "photo";
    if (gridChoiceOffered) {
      // Ask which layout. OK = Grid, Cancel = Photo — phrased so the
      // dialog text makes the mapping obvious.
      const wantGrid = window.confirm(
        "How do you want to lay out this area?\n\n" +
        "OK = Grid (rows and columns, one plant per cell)\n" +
        "Cancel = Photo (drop pins on a photo)"
      );
      mode = wantGrid ? "grid" : "photo";
    }
    const name = window.prompt("Name this area (e.g. 'Back beds', 'Raised beds'):", "Garden");
    if (!name || !name.trim()) return;
    let rows = 0, cols = 0;
    if (mode === "grid") {
      const r = parseInt(window.prompt("How many rows? (1-20)", "4"), 10);
      if (!Number.isFinite(r) || r < 1 || r > 20) { window.alert("Rows must be 1-20."); return; }
      const c = parseInt(window.prompt("How many columns? (1-20)", "6"), 10);
      if (!Number.isFinite(c) || c < 1 || c > 20) { window.alert("Columns must be 1-20."); return; }
      rows = r; cols = c;
    }
    const newArea = (mode === "grid")
      ? { id: newId(), name: name.trim(), mode: "grid", rows, cols, photoPath: null, pins: [] }
      : { id: newId(), name: name.trim(), mode: "photo", photoPath: null, pins: [] };
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      if (!h?.currentSeason) return d;
      h.currentSeason.gardenMap = migrateGardenMap(h.currentSeason.gardenMap);
      h.currentSeason.gardenMap.areas.push(newArea);
      return d;
    });
    setActiveIdx(map.areas.length);
  };

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
            /* GARDEN_GRID: unified createArea (Photo/Grid chooser) */
            onAddArea={createArea}
          />
        )}

        {/* Empty state — no areas at all */}
        {!showArchive && map.areas.length === 0 && (
          <EmptyState
            /* GARDEN_GRID: unified createArea (Photo/Grid chooser) */
            onCreateFirst={createArea}
            gridChoiceLocked={gridChoiceLocked}
            gridPublicLabel={gridPublicLabel}
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
              const name = prompt("Rename area:", activeArea.name);
              if (!name?.trim()) return;
              update((d) => {
                const h = d.hobbies.find((x) => x.id === "garden");
                if (!h?.currentSeason?.gardenMap?.areas?.[activeIdx]) return d;
                h.currentSeason.gardenMap.areas[activeIdx].name = name.trim();
                return d;
              });
            }}
            onDeleteArea={() => {
              if (!confirm(`Delete area "${activeArea.name}" and all its pins?`)) return;
              const oldPath = activeArea.photoPath;
              update((d) => {
                const h = d.hobbies.find((x) => x.id === "garden");
                if (!h?.currentSeason?.gardenMap?.areas) return d;
                h.currentSeason.gardenMap.areas.splice(activeIdx, 1);
                return d;
              });
              if (oldPath) deletePhoto(oldPath).catch(() => {});
              setActiveIdx(0);
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
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ onCreateFirst, archivedSeasons, onShowArchive, /* GARDEN_GRID */ gridChoiceLocked = false, gridPublicLabel = "" }) {
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
        Add areas (e.g. "Back beds", "Front yard") — lay each out as a photo with plant pins, or as a grid of rows and columns. Compare layouts year-over-year.
      </div>
      {/* GARDEN_GRID: grid early-access hint for non-supporters */}
      {gridChoiceLocked && (
        <div style={{
          fontSize: 11, color: palette.inkSoft, lineHeight: 1.5,
          marginBottom: 14, fontStyle: "italic",
        }}>
          🔒 The new grid layout is in early access for Supporters{gridPublicLabel ? ` — available to everyone on ${gridPublicLabel}` : ""}.
        </div>
      )}
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
  useEffect(() => {
    if (!area.photoPath) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    getPhotoUrl(area.photoPath).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
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

  const placePin = (cropId, customName) => {
    if (!showCropPicker) return;
    const newPin = {
      id: newId(),
      x: showCropPicker.x,
      y: showCropPicker.y,
      cropId,
      plantedDate: todayStr(),
      note: "",
    };
    // For the "other" / custom-plant option, attach the typed name.
    // Pins without a customName still fall back to the CROPS list lookup.
    if (cropId === "other" && customName) newPin.customName = customName;
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

  // GARDEN_GRID: grid areas use a different placement surface. Render
  // GridEditor and skip the photo editor entirely. Photo areas (mode
  // "photo" or absent) fall through to the unchanged code below.
  if (area.mode === "grid") {
    return (
      <GridEditor
        area={area}
        areaIdx={areaIdx}
        update={update}
        onRenameArea={onRenameArea}
        onDeleteArea={onDeleteArea}
      />
    );
  }

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

      {/* Photo with pins */}
      {area.photoPath && photoUrl && (
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
              const display = pinDisplay(pin);
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
                  title={display.name}
                >
                  <span style={{ transform: "rotate(45deg)", fontSize: 14, pointerEvents: "none" }}>
                    {display.emoji}
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
// GARDEN_GRID: GRID EDITOR — rows x cols placement surface for grid areas
// ----------------------------------------------------------------------------
// A grid area's pins carry { row, col } instead of { x, y }. Empty-cell tap
// opens the shared CropPicker; planted-cell tap opens the shared
// PinInfoPanel. Resize: grow adds empty cells; shrink warns-and-discards
// any plantings outside the new bounds.
// ============================================================================
function GridEditor({ area, areaIdx, update, onRenameArea, onDeleteArea }) {
  const [activePin, setActivePin] = useState(null);
  const [showCropPicker, setShowCropPicker] = useState(null); // { row, col }

  const rows = Math.max(1, Number(area.rows) || 1);
  const cols = Math.max(1, Number(area.cols) || 1);
  const pins = Array.isArray(area.pins) ? area.pins : [];

  // Quick lookup: "row,col" -> pin
  const pinAt = {};
  pins.forEach((p) => {
    if (typeof p.row === "number" && typeof p.col === "number") {
      pinAt[p.row + "," + p.col] = p;
    }
  });

  const placePin = (cropId, customName) => {
    if (!showCropPicker) return;
    const { row, col } = showCropPicker;
    const newPin = { id: newId(), row, col, cropId, plantedDate: todayStr(), note: "" };
    if (cropId === "other" && customName) newPin.customName = customName;
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      const a = h?.currentSeason?.gardenMap?.areas?.[areaIdx];
      if (!a) return d;
      if (!Array.isArray(a.pins)) a.pins = [];
      // Guard: never two pins in one cell.
      if (a.pins.some((p) => p.row === row && p.col === col)) return d;
      a.pins.push(newPin);
      return d;
    });
    setShowCropPicker(null);
  };

  const resizeGrid = () => {
    const r = parseInt(window.prompt("Rows? (1-20)", String(rows)), 10);
    if (!Number.isFinite(r) || r < 1 || r > 20) { window.alert("Rows must be 1-20."); return; }
    const c = parseInt(window.prompt("Columns? (1-20)", String(cols)), 10);
    if (!Number.isFinite(c) || c < 1 || c > 20) { window.alert("Columns must be 1-20."); return; }
    if (r === rows && c === cols) return;
    // Warn-and-discard: any planted cell outside the new bounds is removed.
    const orphaned = pins.filter((p) => p.row >= r || p.col >= c);
    if (orphaned.length > 0) {
      const ok = window.confirm(
        "Resizing to " + r + " x " + c + " will remove " + orphaned.length + " " +
        (orphaned.length === 1 ? "planting" : "plantings") +
        " that fall outside the new grid. Continue?"
      );
      if (!ok) return;
    }
    update((d) => {
      const h = d.hobbies.find((x) => x.id === "garden");
      const a = h?.currentSeason?.gardenMap?.areas?.[areaIdx];
      if (!a) return d;
      a.rows = r; a.cols = c;
      a.pins = (Array.isArray(a.pins) ? a.pins : []).filter((p) => p.row < r && p.col < c);
      return d;
    });
  };

  // Cell size: fit cols across the ~520px-wide modal body, clamped so a
  // big grid stays tappable (min 28px) and a small grid is not huge
  // (max 64px). The grid container scrolls if it overflows.
  const cellSize = Math.max(28, Math.min(64, Math.floor(520 / cols)));

  return (
    <div>
      {/* Area header — name + actions (mirrors the photo AreaEditor) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {area.name}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={resizeGrid} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, fontSize: 11, textDecoration: "underline", padding: 4 }} title="Resize grid">
            Resize
          </button>
          <button onClick={onRenameArea} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }} title="Rename area">
            <Edit3 size={14} />
          </button>
          <button onClick={onDeleteArea} style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, padding: 4 }} title="Delete area">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.5 }}>
        {rows} x {cols} grid. Tap an empty cell to plant; tap a planted cell to view or edit.
      </div>

      {/* The grid */}
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "max-content" }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: cols }).map((_, c) => {
                const pin = pinAt[r + "," + c];
                const disp = pin ? pinDisplay(pin) : null;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      if (pin) { setActivePin(pin); setShowCropPicker(null); }
                      else { setShowCropPicker({ row: r, col: c }); setActivePin(null); }
                    }}
                    title={pin ? disp.name : "Empty cell"}
                    style={{
                      width: cellSize, height: cellSize, flexShrink: 0,
                      border: `1.5px solid ${palette.line}`, borderRadius: 6,
                      cursor: "pointer", padding: 0,
                      background: pin ? colorForCrop(pin.cropId) : palette.card,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: Math.max(12, Math.floor(cellSize * 0.42)),
                    }}
                  >
                    {pin ? disp.emoji : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Shared edit panel / crop picker — same components the photo editor uses */}
      {activePin && (
        <PinInfoPanel
          pin={activePin}
          areaIdx={areaIdx}
          update={update}
          onClose={() => setActivePin(null)}
        />
      )}
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
  const isCustom = pin.cropId === "other";
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(pin.plantedDate || todayStr());
  const [note, setNote] = useState(pin.note || "");

  // Allow display for "other" pins (no crop entry in CROPS list) and for
  // legacy/unknown cropIds (just show a placeholder rather than blank).
  if (!crop && !isCustom) return null;

  const display = pinDisplay(pin);

  // Re-sync local state if a different pin gets opened
  useEffect(() => {
    setEditing(false);
    setDate(pin.plantedDate || todayStr());
    setNote(pin.note || "");
  }, [pin.id]);

  const plantedDate = new Date(date + "T12:00");
  // Custom plants don't have a known daysToHarvest, so no auto harvest date.
  const harvestDate = (crop && crop.daysToHarvest)
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
          <span style={{ fontSize: 22 }}>{display.emoji}</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink }}>{display.name}</span>
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
            {crop?.notes && !pin.note && (
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
  // Inline state for the "Other" / custom-plant flow: when the user taps
  // the Other tile, we switch this small picker into an input mode so they
  // can type any plant name. Pressing Enter (or Add) pins it as cropId:"other"
  // with a customName attached.
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const customInputRef = useRef(null);

  useEffect(() => {
    if (customMode) {
      // Slight delay so the input is mounted before we focus it
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [customMode]);

  const submitCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    onPick("other", trimmed);
  };

  return (
    <div style={{
      marginTop: 14, padding: 14,
      background: palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: palette.ink }}>
          {customMode ? "Name your plant" : "Pick a plant"}
        </div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {customMode ? (
        // ---- Custom plant name input mode ----
        <div>
          <input
            ref={customInputRef}
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCustom();
              if (e.key === "Escape") { setCustomMode(false); setCustomName(""); }
            }}
            placeholder="e.g. Watermelon radish, marigold, yarrow…"
            maxLength={60}
            style={{
              width: "100%", padding: "10px 12px",
              fontSize: 14, fontFamily: FONT_BODY,
              border: `1.5px solid ${palette.line}`, borderRadius: 8,
              background: palette.bg, color: palette.ink,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={submitCustom}
              disabled={!customName.trim()}
              style={{
                padding: "8px 14px", fontSize: 13,
                background: customName.trim() ? palette.ink : palette.line,
                color: palette.bg, border: "none", borderRadius: 6,
                cursor: customName.trim() ? "pointer" : "default",
                fontFamily: FONT_BODY, fontWeight: 600,
              }}
            >
              Add pin
            </button>
            <button
              onClick={() => { setCustomMode(false); setCustomName(""); }}
              style={{
                padding: "8px 14px", fontSize: 13,
                background: "transparent", color: palette.inkSoft,
                border: `1.5px solid ${palette.line}`, borderRadius: 6,
                cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600,
              }}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        // ---- Default crop-tile grid ----
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
          {/* "Other" tile — opens the custom-name input */}
          <button
            onClick={() => setCustomMode(true)}
            style={{
              padding: "8px 6px",
              background: palette.bg,
              border: `1.5px dashed ${palette.feather}`,
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT_BODY, fontSize: 11, color: palette.ink,
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
            title="Type any plant name"
          >
            <span style={{ fontSize: 18 }}>🌱</span>
            <span>Other…</span>
          </button>
        </div>
      )}
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
          const display = pinDisplay(pin);
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
              title={display.name}
            >
              <span style={{ transform: "rotate(45deg)", fontSize: 13 }}>
                {display.emoji}
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
            const isCustom = activePin.cropId === "other";
            if (!crop && !isCustom) return null;
            const display = pinDisplay(activePin);
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{display.emoji}</span>
                    <strong style={{ fontSize: 14 }}>{display.name}</strong>
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
