// ============================================================================
// PEDIGREE VIEW — shared family-tree component for livestock hobbies
// ----------------------------------------------------------------------------
// Used by: Goats, Cows, Pigs, Sheep, Horses. Each hobby imports both
// SireDamPicker (for the Add/Edit Animal form) and PedigreeView (for the
// "View pedigree" button on each animal card).
//
// Data shape on each animal (set by each hobby's AnimalModal):
//   sireId:           string|null   — id of linked sire (when picked from list)
//   sire:             string        — sire display name (always populated)
//   damId:            string|null   — id of linked dam
//   dam:              string        — dam display name (always populated)
//   registryNumber:   string        — optional, e.g. "ADGA #1234567"
//   registryName:     string        — optional, e.g. "Sycamore Sky Buttercup"
//
// Why both sireId AND sire (and same for dam): the picker lets users either
// pick from existing animals OR type a name freely. Linked animals get
// sireId populated (so the family tree can follow the chain). Free-text
// outside animals get sireId=null but still have sire="Daisy" so the tree
// still shows the name as a terminal leaf. This handles the common case
// where someone bought a doe but never registered her parents in the app.
// ============================================================================

import React, { useRef, useState } from "react";
import { X } from "lucide-react";

// Match the rest of the app's design tokens. Duplicated rather than imported
// to avoid a circular dependency with HomesteadApp.jsx, which doesn't export
// its palette. Keep these in sync if the main palette changes.
const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", yolk: "#E8B547", yolkSoft: "#F2D58A",
  feather: "#8B6F47", line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

// ============================================================================
// SireDamPicker — used inside Add/Edit Animal forms
// ----------------------------------------------------------------------------
// Lets the user either:
//   (a) Pick a sire/dam from the existing animals of opposite sex in the
//       same hobby (links them via id), OR
//   (b) Type a name freely for outside animals (no id link)
//
// Props:
//   label:        "Sire" or "Dam"
//   animals:      hobby.animals[] (live + archived; we filter inside)
//   eligibleSexes: array of sex strings that count as this parent
//                  (e.g. ["Doe"] for goat dams; ["male"] for horse sires)
//   excludeId:    don't show this animal as a parent option (typically the
//                 animal being edited — prevents self-parenthood)
//   selectedId:   currently-linked id (or empty string)
//   selectedName: currently-set name (always present, even when id is empty)
//   onChange:     called with { id, name } whenever selection or text changes
//
// UX: shows a dropdown with eligible animals. Picking one fills both id and
// name. The "Other / not in list" option clears id and reveals a labeled
// free-text input (auto-focused) so users can type a name. When editing an
// animal whose linked parent was archived or deleted, we still show the
// parent name in the dropdown label (with a "(no longer in list)" hint) so
// the link doesn't quietly drop.
// ============================================================================

export function SireDamPicker({
  label,
  animals,
  eligibleSexes,
  excludeId,
  selectedId,
  selectedName,
  onChange,
  placeholder,
}) {
  // Push 7a-fix: ref to the free-text input so we can auto-focus it when the
  // user picks "Other / not in this list". Without focus + a visible label,
  // users were missing the input and assumed the picker stayed on "None".
  const freeTextRef = useRef(null);

  // Push 7a-fix-2: local "free mode" state. The bug was that when a user
  // selected "Other / not in this list" with no prior parent set, the parent
  // state would be { id: "", name: "" } — which on re-render makes
  // dropdownValue evaluate to "" (None), snapping the dropdown back. The
  // user couldn't type because the input disappeared the instant they
  // selected Other. We fix this by tracking the user's INTENT to be in free
  // mode locally: it persists across renders even when the name is empty.
  //
  // Initial state: if the parent has selectedName but no selectedId AND
  // no matching animal in the list, that's already "free mode" persisted
  // from a previous save. Otherwise default to false (controlled by dropdown).
  const [freeMode, setFreeMode] = useState(
    !selectedId && !!selectedName
  );

  // Live, eligible animals. Archived animals are still shown but marked —
  // a goat's dam may have been sold off years ago, but the link is still
  // meaningful for pedigree. We include archived in the list but flag them.
  const eligible = (animals || []).filter((a) => {
    if (a.id === excludeId) return false;            // never self
    if (!a.sex) return false;                         // sex unset → can't classify
    return eligibleSexes.includes(a.sex);
  });

  // Detect orphan link: the saved sireId/damId no longer exists in animals.
  // This happens if the linked parent was hard-deleted (not archived). We
  // display the name from `selectedName` so nothing visibly breaks, but the
  // dropdown can't show the option, so we add a synthetic disabled entry.
  const orphan = selectedId && !eligible.some((a) => a.id === selectedId)
    ? { id: selectedId, name: selectedName || "(unknown)" }
    : null;

  // The dropdown value: "free" sentinel when user opted into typing freely
  // (either because freeMode is set locally, OR there's a saved name with
  // no id), or the actual id otherwise. Empty string is "no parent set".
  const dropdownValue = selectedId
    ? (eligible.some((a) => a.id === selectedId) || orphan ? selectedId : "free")
    : (freeMode || selectedName ? "free" : "");

  const showFreeText = dropdownValue === "free";

  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{
        fontSize: 11, color: palette.inkSoft, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
      }}>
        {label} (optional)
      </div>
      <select
        style={inputStyle}
        value={dropdownValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            setFreeMode(false);
            onChange({ id: "", name: "" });
          } else if (v === "free") {
            // Switching to free-text mode. Keep any existing name the user
            // had typed, but drop the linked id. Setting freeMode locally
            // ensures the input stays visible even when the name is blank.
            // Auto-focus the input on the next tick — it's about to mount.
            setFreeMode(true);
            onChange({ id: "", name: selectedName || "" });
            setTimeout(() => freeTextRef.current?.focus(), 0);
          } else {
            setFreeMode(false);
            const a = eligible.find((x) => x.id === v) || orphan;
            onChange({ id: v, name: a ? a.name : "" });
          }
        }}
      >
        <option value="">— None / unknown —</option>
        {eligible.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}{a.archived ? " (archived)" : ""}
          </option>
        ))}
        {orphan && (
          <option value={orphan.id}>
            {orphan.name} (no longer in list)
          </option>
        )}
        <option value="free">Other / not in this list — type a name</option>
      </select>
      {showFreeText && (
        // Push 7a-fix: labeled wrapper around the free-text input so users
        // see clearly what to do. Previously this was a bare input with just
        // a placeholder, which was easy to miss.
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: palette.yolkSoft, borderRadius: 8,
          border: `1.5px solid ${palette.line}`,
        }}>
          <div style={{
            fontSize: 11, color: palette.inkSoft, marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
          }}>
            {label}'s name
          </div>
          <input
            ref={freeTextRef}
            style={{ ...inputStyle, background: palette.bg }}
            value={selectedName || ""}
            onChange={(e) => onChange({ id: "", name: e.target.value })}
            placeholder={placeholder || `Type the ${label.toLowerCase()}'s name`}
          />
        </div>
      )}
    </label>
  );
}

// ============================================================================
// PedigreeView — modal showing ancestors (above) + descendants (below)
// ----------------------------------------------------------------------------
// Two visual sections:
//   Top:    Classic horizontal pedigree chart — focal animal at the bottom,
//           dam + sire branching up, then their parents (4 grandparents),
//           then theirs (8 great-grandparents). 3 generations total.
//   Bottom: Descendants — focal at top, kids branching down, then grandkids.
//
// Why SVG and not a CSS grid: SVG gives us clean connector lines between
// nodes and natural horizontal scrolling on overflow. The 8-wide top row
// of a full 3-gen ancestor chart is ~1160px and won't fit on a phone, so the
// SVG sits inside a horizontally-scrollable container. Mobile users can
// swipe; desktop users see everything at once.
//
// Both sections gracefully handle:
//   - Animals with no parents recorded → empty section with friendly note
//   - Linked parents (sireId) → tappable, opens that animal's pedigree
//   - Free-text parents (no id) → shown but not tappable (terminal)
//   - Linked parents whose animal was deleted → shown with "(removed)" note
// ============================================================================

const MAX_GEN_UP = 3;     // parents + grandparents + great-grandparents
const MAX_GEN_DOWN = 3;   // kids + grandkids + great-grandkids

// Node + spacing constants for the charts.
const NODE_W = 130;
const NODE_H = 44;
const COL_GAP = 18;     // horizontal gap between sibling nodes in same row
const ROW_GAP = 36;     // vertical gap between generations

export function PedigreeView({ animal, animals, onClose, onJumpTo }) {
  // Index animals by id for O(1) lookup. Includes archived — archived
  // animals are still valid pedigree nodes.
  const byId = {};
  (animals || []).forEach((a) => { byId[a.id] = a; });

  // Build the ancestor tree.
  const ancestorChart = buildAncestorChart(animal, byId);

  // Find offspring of a given animal: every animal in the hobby that
  // lists this one as sire OR dam.
  const offspringOf = (id) => (animals || []).filter(
    (a) => a.sireId === id || a.damId === id
  );

  // Build descendant tree. Width varies based on family size.
  const descendantChart = buildDescendantChart(animal, offspringOf);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 110, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16,
          maxWidth: 720, width: "100%", maxHeight: "92vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: `6px 8px 0 ${palette.line}`, fontFamily: FONT_BODY,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
          position: "sticky", top: 0, background: palette.bg, zIndex: 1,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>
            🧬 {animal.name}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: palette.ink, padding: 4,
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Registry header — only if either field is set */}
          {(animal.registryNumber || animal.registryName) && (
            <div style={{
              padding: "10px 12px", background: palette.bgAlt,
              border: `1.5px solid ${palette.line}`, borderRadius: 8,
              marginBottom: 14, fontSize: 13, color: palette.ink,
            }}>
              {animal.registryName && (
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {animal.registryName}
                </div>
              )}
              {animal.registryNumber && (
                <div style={{ fontSize: 12, color: palette.inkSoft }}>
                  Registry # {animal.registryNumber}
                </div>
              )}
            </div>
          )}

          {/* ========== ANCESTORS ========== */}
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink,
            marginBottom: 4, marginTop: 4,
          }}>
            Ancestors
          </div>
          <div style={{
            fontSize: 11, color: palette.inkSoft, marginBottom: 10,
          }}>
            {(animal.sire || animal.dam)
              ? "Tap any ancestor to view their pedigree"
              : "No parents recorded yet — edit this animal to add a sire and dam"}
          </div>
          {(animal.sire || animal.dam) && (
            <div style={{
              overflowX: "auto", overflowY: "hidden",
              marginBottom: 22, paddingBottom: 4,
              border: `1.5px solid ${palette.line}`, borderRadius: 10,
              background: palette.card,
            }}>
              <svg
                width={ancestorChart.width + 24}
                height={ancestorChart.height + 16}
                style={{ display: "block", margin: "8px 12px" }}
              >
                {ancestorChart.connectors.map((c, i) => (
                  <path
                    key={`a-conn-${i}`}
                    d={c}
                    stroke={palette.feather}
                    strokeWidth="1.5"
                    fill="none"
                  />
                ))}
                {ancestorChart.nodes.map((n) => (
                  <TreeNode
                    key={n.key}
                    x={n.x}
                    y={n.y}
                    animal={n.animal}
                    label={n.label}
                    fallbackName={n.fallbackName}
                    isFocal={n.isFocal}
                    onJumpTo={onJumpTo}
                  />
                ))}
              </svg>
            </div>
          )}

          {/* ========== DESCENDANTS ========== */}
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink,
            marginBottom: 4,
          }}>
            Descendants
          </div>
          <div style={{
            fontSize: 11, color: palette.inkSoft, marginBottom: 10,
          }}>
            {descendantChart.hasKids
              ? "Tap any descendant to view their pedigree"
              : "No offspring recorded yet"}
          </div>
          {descendantChart.hasKids ? (
            <div style={{
              overflowX: "auto", overflowY: "hidden",
              paddingBottom: 4,
              border: `1.5px solid ${palette.line}`, borderRadius: 10,
              background: palette.card,
            }}>
              <svg
                width={descendantChart.width + 24}
                height={descendantChart.height + 16}
                style={{ display: "block", margin: "8px 12px" }}
              >
                {descendantChart.connectors.map((c, i) => (
                  <path
                    key={`d-conn-${i}`}
                    d={c}
                    stroke={palette.feather}
                    strokeWidth="1.5"
                    fill="none"
                  />
                ))}
                {descendantChart.nodes.map((n) => (
                  <TreeNode
                    key={n.key}
                    x={n.x}
                    y={n.y}
                    animal={n.animal}
                    label={null}
                    isFocal={n.isFocal}
                    onJumpTo={onJumpTo}
                  />
                ))}
              </svg>
            </div>
          ) : (
            <div style={{
              padding: 14, background: palette.card,
              border: `1.5px dashed ${palette.line}`, borderRadius: 8,
              fontSize: 13, color: palette.inkSoft, lineHeight: 1.5,
            }}>
              When you add another animal and pick this one as a parent, they'll appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// buildAncestorChart — compute node positions + connector paths for the
// ancestor chart. Returns { nodes, connectors, width, height }.
//
// Layout: fixed-slot grid. Row at depth d from focal has 2^d slots, evenly
// distributed across the chart width. The focal animal sits centered at the
// bottom (depth 0). Dam is always left of sire at each generation.
//
// Slot indexing: slots[d] is an array of 2^d entries. The entry at slot
// 2*i (depth d+1) is the DAM of slots[d][i]; 2*i+1 is the SIRE. So traversal
// is straightforward: build slots[0] from the focal animal, then for each
// subsequent depth read parent's damId/dam and sireId/sire.
//
// Empty slots (parent never recorded) are still tracked as null, so the
// row widths stay consistent — but we don't render any node or connector
// for them, which keeps sparse trees looking clean rather than cluttered.
// ----------------------------------------------------------------------------
function buildAncestorChart(focal, byId) {
  const TOP_SLOTS = Math.pow(2, MAX_GEN_UP); // 8
  const totalW = TOP_SLOTS * NODE_W + (TOP_SLOTS - 1) * COL_GAP;
  const nodes = [];
  const connectors = [];

  // Build slots[d][i] = entry or null.
  const slots = [];
  slots[0] = [{
    animal: focal,
    label: null,
    fallbackName: focal.name,
    isFocal: true,
  }];

  let deepestRow = 0; // track how deep we actually have data, for height calc

  for (let d = 1; d <= MAX_GEN_UP; d++) {
    slots[d] = [];
    let rowHasData = false;
    for (let i = 0; i < slots[d - 1].length; i++) {
      const parent = slots[d - 1][i];
      if (!parent || !parent.animal) {
        // Parent slot has no linked animal → can't traverse upward.
        slots[d].push(null, null);
        continue;
      }
      const parentAnimal = parent.animal;
      const damEntry = makeAncestorEntry("Dam", parentAnimal.damId, parentAnimal.dam, byId);
      const sireEntry = makeAncestorEntry("Sire", parentAnimal.sireId, parentAnimal.sire, byId);
      if (damEntry || sireEntry) rowHasData = true;
      slots[d].push(damEntry, sireEntry);
    }
    if (rowHasData) deepestRow = d;
  }

  // Compute the rendered height based on how many generations actually have data.
  // The focal is at row 0 (bottom); each ancestor generation adds NODE_H + ROW_GAP.
  const renderedGenerations = deepestRow;
  const totalHeight = (renderedGenerations + 1) * NODE_H + renderedGenerations * ROW_GAP;

  // Now place nodes. Row at depth d has 2^d slots distributed across totalW.
  // Focal (d=0) is at the bottom row → y = totalHeight - NODE_H.
  for (let d = 0; d <= renderedGenerations; d++) {
    const slotsInRow = Math.pow(2, d);
    const colW = totalW / slotsInRow;
    const y = (renderedGenerations - d) * (NODE_H + ROW_GAP);

    for (let i = 0; i < slotsInRow; i++) {
      const entry = slots[d][i];
      if (!entry) continue;
      const cx = (i + 0.5) * colW;
      const x = cx - NODE_W / 2;
      nodes.push({
        key: `a-${d}-${i}`,
        x, y,
        animal: entry.animal,
        label: entry.label,
        fallbackName: entry.fallbackName,
        isFocal: !!entry.isFocal,
      });

      // Connector from this node up to its child slot (depth d-1, slot i/2),
      // which on screen is BELOW this node (closer to focal). We draw the
      // line going down from this node's bottom to the child's top, with an
      // orthogonal mid-step for a clean tree look.
      if (d > 0) {
        const parentI = Math.floor(i / 2);
        const parentSlot = slots[d - 1][parentI];
        if (parentSlot) {
          const parentColW = totalW / Math.pow(2, d - 1);
          const parentCx = (parentI + 0.5) * parentColW;
          const parentY = (renderedGenerations - (d - 1)) * (NODE_H + ROW_GAP);
          const x1 = cx, y1 = y + NODE_H;
          const x2 = parentCx, y2 = parentY;
          const midY = (y1 + y2) / 2;
          connectors.push(
            `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
          );
        }
      }
    }
  }

  return {
    nodes, connectors,
    width: totalW,
    height: totalHeight,
  };
}

// Helper: build an ancestor entry from a parent's link or free-text name.
function makeAncestorEntry(kind, parentId, parentName, byId) {
  if (!parentName && !parentId) return null;
  const linked = parentId ? byId[parentId] : null;
  return {
    animal: linked,                            // null for free-text or removed
    label: kind,
    fallbackName: parentName || "(unknown)",
    isFocal: false,
  };
}

// ----------------------------------------------------------------------------
// buildDescendantChart — recursive layout for the descendants chart.
// Focal at top, each generation of offspring below. Subtree widths are
// computed bottom-up so siblings don't overlap regardless of family size.
//
// Returns { nodes, connectors, width, height, hasKids }.
// ----------------------------------------------------------------------------
function buildDescendantChart(focal, offspringOf) {
  // Cycle protection: nothing in the data model prevents a user from saving
  // a pedigree loop (A's sire = B, B's sire = A, for example), and a loop
  // in offspring direction would cause measureDescendant to recurse until
  // the stack overflows. Track every animal id we've already placed and
  // refuse to revisit it — they're shown once and then capped.
  const visited = new Set();
  const root = measureDescendant(focal, offspringOf, 0, true, visited);

  const nodes = [];
  const connectors = [];
  // Position the tree starting at xOffset=0, yOffset=0.
  positionDescendant(root, 0, 0, nodes, connectors);

  return {
    nodes, connectors,
    width: Math.max(NODE_W, root.subtreeW),
    height: (root.maxDepth + 1) * NODE_H + root.maxDepth * ROW_GAP,
    hasKids: root.children.length > 0,
  };
}

// First pass: measure subtree widths and depths.
function measureDescendant(animal, offspringOf, depth, isFocal, visited) {
  visited.add(animal.id);
  const children = depth < MAX_GEN_DOWN
    ? offspringOf(animal.id)
        .filter((kid) => !visited.has(kid.id))
        .map((kid) => measureDescendant(kid, offspringOf, depth + 1, false, visited))
    : [];
  const childrenW = children.length === 0
    ? 0
    : children.reduce((s, k) => s + k.subtreeW, 0) + (children.length - 1) * COL_GAP;
  const subtreeW = Math.max(NODE_W, childrenW);
  const maxDepth = children.length === 0
    ? 0
    : 1 + Math.max(...children.map((k) => k.maxDepth));
  return { animal, isFocal, children, subtreeW, maxDepth };
}

// Second pass: assign x,y and emit nodes + connectors.
// Returns the center x of this node so the parent can draw a connector.
function positionDescendant(node, xOffset, y, nodes, connectors) {
  const cx = xOffset + node.subtreeW / 2;
  nodes.push({
    key: `d-${node.animal.id}-${y}`,
    x: cx - NODE_W / 2,
    y,
    animal: node.animal,
    isFocal: !!node.isFocal,
  });

  if (node.children.length > 0) {
    const childY = y + NODE_H + ROW_GAP;
    const childrenTotalW = node.children.reduce((s, k) => s + k.subtreeW, 0)
      + (node.children.length - 1) * COL_GAP;
    let childXOffset = cx - childrenTotalW / 2;

    for (const child of node.children) {
      const childCx = positionDescendant(child, childXOffset, childY, nodes, connectors);
      const midY = (y + NODE_H + childY) / 2;
      connectors.push(
        `M ${cx} ${y + NODE_H} L ${cx} ${midY} L ${childCx} ${midY} L ${childCx} ${childY}`
      );
      childXOffset += child.subtreeW + COL_GAP;
    }
  }

  return cx;
}

// ----------------------------------------------------------------------------
// TreeNode — a single node in either chart, rendered as an SVG <g>.
// Shows the parent label (Dam/Sire) for ancestor nodes, plus the animal's
// name and breed if present. Tappable iff there's a linked animal AND
// onJumpTo is provided. The focal animal gets a highlighted style.
// ----------------------------------------------------------------------------
function TreeNode({ x, y, animal, label, fallbackName, isFocal, onJumpTo }) {
  // Resolve display data. If animal is null (free-text or removed parent),
  // we still want to show fallbackName as a terminal leaf.
  const hasAnimal = !!animal;
  const displayName = animal ? animal.name : fallbackName;
  const breed = animal?.breed;
  const archived = animal?.archived;
  const tappable = hasAnimal && onJumpTo && !isFocal;

  if (!displayName) return null;

  // Truncate long names so they don't overflow the node box.
  const maxNameLen = 16;
  const shownName = displayName.length > maxNameLen
    ? displayName.slice(0, maxNameLen - 1) + "…"
    : displayName;

  // Compose the subtitle row: breed, archived flag, or "outside" indicator
  // for free-text ancestors.
  let subtitle = "";
  if (!hasAnimal) {
    subtitle = "outside";
  } else if (archived && breed) {
    subtitle = `${breed} · archived`;
  } else if (archived) {
    subtitle = "archived";
  } else if (breed) {
    subtitle = breed;
  }

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={tappable ? () => onJumpTo(animal.id) : undefined}
      style={{ cursor: tappable ? "pointer" : "default" }}
    >
      <rect
        width={NODE_W} height={NODE_H} rx="6" ry="6"
        fill={isFocal ? palette.yolkSoft : (hasAnimal ? palette.bg : palette.bgAlt)}
        stroke={isFocal ? palette.ink : palette.line}
        strokeWidth={isFocal ? "2" : "1.5"}
      />
      {label && (
        <text
          x={NODE_W / 2} y={12}
          textAnchor="middle"
          fontFamily={FONT_BODY}
          fontSize="9"
          fill={palette.inkSoft}
          fontWeight="600"
        >
          {label.toUpperCase()}
        </text>
      )}
      <text
        x={NODE_W / 2}
        y={label ? 26 : (subtitle ? 19 : 27)}
        textAnchor="middle"
        fontFamily={FONT_BODY}
        fontSize="12"
        fill={palette.ink}
        fontWeight="600"
      >
        {shownName}
      </text>
      {subtitle && (
        <text
          x={NODE_W / 2}
          y={label ? 38 : 33}
          textAnchor="middle"
          fontFamily={FONT_BODY}
          fontSize="10"
          fill={palette.inkSoft}
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}
