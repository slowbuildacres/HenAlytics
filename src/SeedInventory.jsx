// ============================================================================
// SEED INVENTORY — the garden's "Seeds" tab
// ----------------------------------------------------------------------------
// What's in the seed box: crop, variety, the year it was packed, how much is
// left, and where it came from. Each packet gets a viability estimate from the
// usual seed-life tables (onions ~1 year, tomatoes ~4, cucumbers/lettuce ~5),
// so people know what to use first and what to germination-test. "To buy" is
// a shopping list (low, out, or past its seed life) that can be shared or
// copied right before ordering seeds.
//
// Data: hobby.seeds = [{ id, crop, variety, year, packets, amount, source,
//   notes, added }], amount ∈ plenty | some | low | out. Stored on the garden
// hobby, so it syncs and survives season close-outs.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { loadSeedAffiliate, seedShopUrl, AFFILIATE_DISCLOSURE } from "./affiliate.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};
const newId = () => Math.random().toString(36).slice(2, 10);

// Typical years seed stays reliably viable when stored cool and dry
// (cooperative-extension seed-life tables, rounded down). First match wins,
// so more specific names come first ("watermelon" before "melon").
const SEED_LIFE = [
  ["onion", 1], ["leek", 1], ["chive", 1], ["parsnip", 1], ["salsify", 1],
  ["sweet corn", 2], ["corn", 2], ["pepper", 2], ["spinach", 2], ["okra", 2], ["parsley", 2], ["cilantro", 2],
  ["bean", 3], ["pea", 3], ["carrot", 3], ["dill", 3], ["sunflower", 3], ["marigold", 3],
  ["watermelon", 4], ["beet", 4], ["chard", 4], ["kale", 4], ["broccoli", 4], ["cabbage", 4],
  ["cauliflower", 4], ["brussels", 4], ["kohlrabi", 4], ["collard", 4], ["mustard", 4], ["turnip", 4],
  ["arugula", 4], ["tomato", 4], ["eggplant", 4], ["pumpkin", 4], ["squash", 4], ["zucchini", 4],
  ["cucumber", 5], ["cantaloupe", 5], ["melon", 5], ["lettuce", 5], ["endive", 5], ["radish", 5],
  ["celery", 5], ["basil", 5], ["zinnia", 5],
];
const DEFAULT_LIFE = 3;

export function seedLifeYears(crop) {
  const n = String(crop || "").toLowerCase();
  for (const [kw, yrs] of SEED_LIFE) if (n.includes(kw)) return yrs;
  return DEFAULT_LIFE;
}

// { status: "good" | "use" | "test", goodThrough, label }
export function seedViability(packet, now = new Date()) {
  const year = Number(packet && packet.year);
  const thisYear = now.getFullYear();
  if (!year || year > thisYear + 1) return { status: "good", goodThrough: null, label: "Year unknown" };
  const life = seedLifeYears(packet.crop);
  const goodThrough = year + life;
  if (thisYear < goodThrough) return { status: "good", goodThrough, label: `Good through ${goodThrough}` };
  if (thisYear === goodThrough) return { status: "use", goodThrough, label: `Use up this year` };
  return { status: "test", goodThrough, label: `Past ${goodThrough}: test before planting` };
}

export function needsBuying(packet, now = new Date()) {
  return packet.amount === "low" || packet.amount === "out" || seedViability(packet, now).status === "test";
}

const AMOUNTS = [
  { key: "plenty", label: "Plenty" },
  { key: "some", label: "Some" },
  { key: "low", label: "Low" },
  { key: "out", label: "Out" },
];
const STATUS_STYLE = {
  good: { bg: "#A8C07840", fg: palette.leaf },
  use: { bg: "#F2D58A80", fg: "#8A6200" },
  test: { bg: "#E8A07A55", fg: palette.accent },
};

function Chip({ active, onClick, children, tone }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 10px", borderRadius: 999, fontSize: 12, fontFamily: FONT_BODY, cursor: "pointer",
      border: `1.5px solid ${active ? (tone || palette.ink) : palette.line}`,
      background: active ? (tone || palette.ink) : "transparent",
      color: active ? palette.bg : palette.ink, fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}

function PacketForm({ initial, cropOptions, onSave, onCancel, onDelete }) {
  const thisYear = new Date().getFullYear();
  const [f, setF] = useState(() => ({
    crop: "", variety: "", year: thisYear, packets: 1, amount: "plenty", source: "", notes: "",
    ...(initial || {}),
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const valid = f.crop.trim().length > 0;
  const years = [];
  for (let y = thisYear + 1; y >= thisYear - 8; y--) years.push(y);
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: palette.inkSoft }}>Crop
          <input list="seed-crop-options" value={f.crop} onChange={set("crop")} placeholder="Tomato" autoFocus={!initial}
            style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: palette.inkSoft }}>Variety
          <input value={f.variety} onChange={set("variety")} placeholder="Cherokee Purple" style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: palette.inkSoft }}>Packed for
          <select value={f.year || ""} onChange={(e) => setF((x) => ({ ...x, year: Number(e.target.value) || null }))} style={{ ...inputStyle, marginTop: 4 }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
            <option value="">Not sure</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: palette.inkSoft }}>Packets
          <input type="number" min="0" inputMode="numeric" value={f.packets}
            onChange={(e) => setF((x) => ({ ...x, packets: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) }))}
            style={{ ...inputStyle, marginTop: 4 }} />
        </label>
      </div>
      <datalist id="seed-crop-options">
        {cropOptions.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 6 }}>How much is left?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {AMOUNTS.map((a) => <Chip key={a.key} active={f.amount === a.key} onClick={() => setF((x) => ({ ...x, amount: a.key }))}>{a.label}</Chip>)}
      </div>
      <label style={{ fontSize: 12, color: palette.inkSoft, display: "block", marginBottom: 8 }}>Where from (optional)
        <input value={f.source} onChange={set("source")} placeholder="Baker Creek, saved seed, swap…" style={{ ...inputStyle, marginTop: 4 }} />
      </label>
      <label style={{ fontSize: 12, color: palette.inkSoft, display: "block", marginBottom: 12 }}>Notes (optional)
        <input value={f.notes} onChange={set("notes")} placeholder="Germinated great, save more" style={{ ...inputStyle, marginTop: 4 }} />
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" disabled={!valid} onClick={() => onSave({ ...f, crop: f.crop.trim(), variety: f.variety.trim() })} style={{
          flex: 1, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${palette.ink}`,
          background: valid ? palette.ink : palette.bgAlt, color: valid ? palette.bg : palette.inkSoft,
          fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: valid ? "pointer" : "default",
        }}>{initial ? "Save" : "Add to seed box"}</button>
        <button type="button" onClick={onCancel} style={{
          padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: "transparent",
          color: palette.ink, fontFamily: FONT_BODY, fontSize: 14, cursor: "pointer",
        }}>Cancel</button>
        {onDelete && (
          <button type="button" onClick={onDelete} style={{
            marginLeft: "auto", background: "none", border: "none", color: palette.accent,
            fontFamily: FONT_BODY, fontSize: 13, cursor: "pointer", textDecoration: "underline",
          }}>Delete</button>
        )}
      </div>
    </div>
  );
}

function shoppingListText(packets) {
  const lines = packets.map((p) => `• ${p.crop}${p.variety ? ` (${p.variety})` : ""}`);
  return `Seeds to buy:\n${lines.join("\n")}\n\nTracked with Henalytics: henalytics.com`;
}

async function shareText(text, toast) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast && toast("Copied your seed list 📋");
  } catch (_) {
    toast && toast("Couldn't copy. Long-press the list to select it.");
  }
}

// props: hobby (garden), update, cropOptions (names), toast
// Packets in the seed box that match a planted crop name ("Cherokee Purple
// Tomato" ↔ a "Tomatoes" packet). Plurals and case don't matter.
const normWord = (w) => w.replace(/oes$/, "o").replace(/ies$/, "y").replace(/(?<=[a-z]{3})s$/, "");
const normWords = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1).map(normWord);
export function matchingPackets(seeds, plantName) {
  const plantWords = new Set(normWords(plantName));
  if (!plantWords.size) return [];
  return (seeds || []).filter((p) => {
    if (!p || p.amount === "out") return false;
    const cropWords = normWords(p.crop);
    const varietyWords = normWords(p.variety);
    // The crop's main word ("Bush Beans" → bean) is enough: the popup only
    // asks, so a loose match costs one tap at most.
    const cropHit = cropWords.length > 0 && plantWords.has(cropWords[cropWords.length - 1]);
    const varietyHit = varietyWords.length > 0 && varietyWords.every((w) => plantWords.has(w));
    return cropHit || varietyHit;
  });
}

// Right after logging a planting: "Did that come from your seed box?" One
// tap to set how much is left in each matching packet.
export function SeedUseModal({ hobby, plantName, update, onClose }) {
  const packets = matchingPackets(hobby.seeds, plantName);
  const [picked, setPicked] = useState({});
  if (!packets.length) return null;
  const save = () => {
    update((d) => {
      const g = (d.hobbies || []).find((h) => h.id === hobby.id);
      if (g && Array.isArray(g.seeds)) {
        g.seeds.forEach((p) => { if (picked[p.id]) { p.amount = picked[p.id]; p.lastUsed = new Date().toISOString().slice(0, 10); } });
      }
      return d;
    });
    onClose();
  };
  const any = Object.keys(picked).length > 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 210, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: palette.bg, border: `2px solid ${palette.ink}`, borderRadius: 16, padding: 16, fontFamily: FONT_BODY, marginBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, color: palette.ink, marginBottom: 4 }}>🌾 From your seed box?</div>
        <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.45 }}>
          You planted {plantName}. How much is left in the packet? Your "To buy" list keeps itself up to date.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {packets.map((p) => (
            <div key={p.id} style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: palette.ink, marginBottom: 6 }}>
                {p.crop}{p.variety ? <span style={{ fontWeight: 400, color: palette.inkSoft }}> · {p.variety}</span> : null}
                {p.year ? <span style={{ fontWeight: 400, color: palette.inkSoft, fontSize: 12 }}> ({p.year})</span> : null}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AMOUNTS.map((a) => (
                  <Chip key={a.key} active={(picked[p.id] || "") === a.key}
                    tone={a.key === "out" || a.key === "low" ? palette.accent : palette.ink}
                    onClick={() => setPicked((x) => ({ ...x, [p.id]: a.key }))}>
                    {a.key === "out" ? "Used it up" : a.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={save} disabled={!any} style={{
            flex: 1, padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${palette.ink}`,
            background: any ? palette.ink : palette.bgAlt, color: any ? palette.bg : palette.inkSoft,
            fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: any ? "pointer" : "default",
          }}>Update seed box</button>
          <button type="button" onClick={onClose} style={{
            padding: "11px 14px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: "transparent",
            color: palette.ink, fontFamily: FONT_BODY, fontSize: 14, cursor: "pointer",
          }}>Not from the box</button>
        </div>
      </div>
    </div>
  );
}

// Affiliate shop config (null until set up in app_config "seed_affiliate").
export function useSeedShop() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { let on = true; loadSeedAffiliate().then((c) => { if (on) setCfg(c); }); return () => { on = false; }; }, []);
  return cfg;
}

export default function SeedInventory({ hobby, update, cropOptions = [], toast, openUrl }) {
  const shop = useSeedShop();
  const seeds = Array.isArray(hobby.seeds) ? hobby.seeds : [];
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const now = new Date();

  const mutate = (fn) => update((d) => {
    const g = (d.hobbies || []).find((h) => h.id === hobby.id);
    if (!g) return d;
    g.seeds = Array.isArray(g.seeds) ? g.seeds : [];
    fn(g);
    return d;
  });
  const save = (p) => {
    mutate((g) => {
      const i = g.seeds.findIndex((x) => x.id === p.id);
      if (i >= 0) g.seeds[i] = { ...g.seeds[i], ...p };
      else g.seeds.push({ ...p, id: newId(), added: Date.now() });
    });
    setAdding(false); setEditingId(null);
  };
  const setAmount = (id, amount) => mutate((g) => { const p = g.seeds.find((x) => x.id === id); if (p) p.amount = amount; });
  const remove = (id) => { mutate((g) => { g.seeds = g.seeds.filter((x) => x.id !== id); }); setEditingId(null); };

  const toBuy = useMemo(() => seeds.filter((p) => needsBuying(p, now)), [seeds]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const list = (filter === "buy" ? toBuy : seeds).filter((p) => {
      if (!q.trim()) return true;
      const s = `${p.crop} ${p.variety || ""} ${p.source || ""}`.toLowerCase();
      return s.includes(q.trim().toLowerCase());
    });
    return [...list].sort((a, b) => a.crop.localeCompare(b.crop) || String(a.variety || "").localeCompare(String(b.variety || "")));
  }, [seeds, toBuy, filter, q]);

  const options = useMemo(() => {
    const set = new Set(cropOptions);
    seeds.forEach((p) => set.add(p.crop));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [cropOptions, seeds]);

  if (seeds.length === 0 && !adding) {
    return (
      <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 18, textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>🌾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>Your seed box</div>
        <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
          Jot down the seed packets you have. Henalytics tells you which are getting old, what to use first, and builds your shopping list before seed-ordering season.
        </div>
        <button type="button" onClick={() => setAdding(true)} style={{
          padding: "11px 18px", borderRadius: 8, border: `1.5px solid ${palette.ink}`, background: palette.ink,
          color: palette.bg, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>+ Add your first packet</button>
      </div>
    );
  }

  const counts = { good: 0, use: 0, test: 0 };
  seeds.forEach((p) => { counts[seedViability(p, now).status]++; });

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>Seed box</div>
        <div style={{ fontSize: 12, color: palette.inkSoft }}>
          {seeds.length} packet{seeds.length === 1 ? "" : "s"}
          {counts.use ? ` · ${counts.use} to use up` : ""}
          {counts.test ? ` · ${counts.test} getting old` : ""}
        </div>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setEditingId(null); }} style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 8, border: `1.5px dashed ${palette.line}`,
            background: "transparent", color: palette.ink, fontFamily: FONT_BODY, fontSize: 13, cursor: "pointer",
          }}>+ Add packet</button>
        )}
      </div>

      {adding && <PacketForm cropOptions={options} onSave={save} onCancel={() => setAdding(false)} />}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        <Chip active={filter === "buy"} onClick={() => setFilter("buy")} tone={palette.accent}>To buy ({toBuy.length})</Chip>
        {seeds.length > 6 && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
            style={{ ...inputStyle, width: "auto", flex: "1 1 120px", padding: "6px 10px", fontSize: 13 }} />
        )}
      </div>

      {filter === "buy" && toBuy.length > 0 && (
        <button type="button" onClick={() => shareText(shoppingListText(toBuy), toast)} style={{
          width: "100%", padding: "10px 14px", marginBottom: 10, borderRadius: 8, border: `1.5px solid ${palette.ink}`,
          background: palette.yolk, color: palette.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>📤 Share or copy my seed list</button>
      )}
      {filter === "buy" && toBuy.length > 0 && shop && shop.homeUrl && openUrl && (
        <div style={{ marginTop: -2, marginBottom: 10 }}>
          <button type="button" onClick={() => openUrl(shop.homeUrl)} style={{
            width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${palette.ink}`,
            background: palette.card, color: palette.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>🛒 Shop seeds at {shop.name}</button>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{AFFILIATE_DISCLOSURE}</div>
        </div>
      )}

      {shown.length === 0 && (
        <div style={{ fontSize: 13, color: palette.inkSoft, fontStyle: "italic", padding: "6px 2px" }}>
          {filter === "buy" ? "Nothing to buy. Every packet is stocked and fresh. 🌱" : "No packets match."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((p) => {
          if (editingId === p.id) {
            return <PacketForm key={p.id} initial={p} cropOptions={options} onSave={save} onCancel={() => setEditingId(null)} onDelete={() => remove(p.id)} />;
          }
          const v = seedViability(p, now);
          const st = STATUS_STYLE[v.status];
          return (
            <div key={p.id} style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button type="button" onClick={() => { setEditingId(p.id); setAdding(false); }} style={{
                  flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT_BODY,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: palette.ink }}>
                    {p.crop}{p.variety ? <span style={{ fontWeight: 400, color: palette.inkSoft }}> · {p.variety}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
                    {p.year ? `Packed for ${p.year}` : "Year unknown"}
                    {Number(p.packets) > 1 ? ` · ${p.packets} packets` : ""}
                    {p.source ? ` · ${p.source}` : ""}
                  </div>
                </button>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: "nowrap" }}>
                  {v.status === "good" ? "Fresh" : v.status === "use" ? "Use soon" : "Test first"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {AMOUNTS.map((a) => (
                  <Chip key={a.key} active={(p.amount || "plenty") === a.key}
                    tone={a.key === "out" || a.key === "low" ? palette.accent : palette.ink}
                    onClick={() => setAmount(p.id, a.key)}>{a.label}</Chip>
                ))}
                {filter === "buy" && shop && openUrl && seedShopUrl(shop, p.crop, p.variety) && (
                  <button type="button" onClick={() => openUrl(seedShopUrl(shop, p.crop, p.variety))} style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: palette.leaf, fontFamily: FONT_BODY, textDecoration: "underline",
                  }}>Find it 🛒</button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, color: palette.inkSoft }}>{v.label}</span>
              </div>
              {p.notes ? <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 6, fontStyle: "italic" }}>{p.notes}</div> : null}
            </div>
          );
        })}
      </div>

      {counts.test > 0 && (
        <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.5, marginTop: 12, padding: "10px 12px", background: palette.bgAlt, borderRadius: 8 }}>
          <strong>Old seed isn't always dead.</strong> Roll 10 seeds in a damp paper towel, keep it warm in a baggie for a week, and count what sprouts. 8 of 10 = plant normally; 5 of 10 = sow twice as thick.
        </div>
      )}
    </div>
  );
}
