// ============================================================================
// Brooder history + Purchase history sheets
// ----------------------------------------------------------------------------
// BrooderHistoryModal: every brooder batch (incubator runs and broody-hen
//   hatches), newest first: hatch date, age, where the chicks went.
// PurchaseHistoryModal: "when did I last buy…?" Last-bought per item (date,
//   price, how often) and the full purchase list, searchable.
// Data comes from flockTools.js (pure helpers, tested).
// ============================================================================

import { legacyPalette } from "./newlook/legacyTheme.js";
import React, { useMemo, useState } from "react";
import { brooderHistory, ageLabel, collectPurchases, lastBoughtByItem, agoLabel, isoDay } from "./flockTools.js";
import { fmtMoney } from "./units.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530", accent: "#C84B31",
  leaf: "#5A7A3C", yolk: "#E8B547", yolkSoft: "#F2D58A", line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const fmtDate = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "max(16px, env(safe-area-inset-top)) 12px 24px" }}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onClick={(e) => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, border: `2px solid ${palette.ink}`, width: "100%", maxWidth: 520, padding: 16, fontFamily: FONT_BODY, color: palette.ink }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, flex: 1 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: palette.ink, padding: 4, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const pill = (text, tone) => (
  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: tone || palette.bgAlt, color: palette.ink, whiteSpace: "nowrap" }}>{text}</span>
);

export function BrooderHistoryModal({ data, onClose, onOpenIncubator }) {
  const batches = useMemo(() => brooderHistory(data), [data]);
  const today = isoDay();
  const hatched = batches.reduce((n, b) => n + b.initial, 0);
  return (
    <Sheet title="🐣 Brooder history" onClose={onClose}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        {batches.length} {batches.length === 1 ? "batch" : "batches"} · {hatched} chicks hatched in all. Hatches from the incubator and from broody hens both land here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {batches.map((b) => (
          <div key={b.id} style={{ background: palette.card, border: `1.5px solid ${b.active ? palette.yolk : palette.line}`, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{b.name}</div>
              {b.active ? pill("In the brooder", palette.yolkSoft) : pill("Done")}
            </div>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
              {b.hatchDate ? `Hatched ${fmtDate(b.hatchDate)} · ${ageLabel(b.hatchDate, today)}` : "Hatch date not set"}
              {b.source ? ` · ${b.source}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {pill(`${b.initial} hatched`)}
              {b.moved > 0 && pill(`${b.moved} → ${b.movedTo.join(", ")}`, "#E3EDD3")}
              {b.sold > 0 && pill(`${b.sold} sold`)}
              {b.died > 0 && pill(`${b.died} lost`, "#FBE5DE")}
              {b.remaining > 0 && pill(`${b.remaining} still in brooder`, palette.yolkSoft)}
            </div>
          </div>
        ))}
      </div>
      {onOpenIncubator && (
        <button type="button" onClick={onOpenIncubator} style={{ marginTop: 12, width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${palette.ink}`, background: "transparent", color: palette.ink, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Manage brooder batches
        </button>
      )}
    </Sheet>
  );
}

export function PurchaseHistoryModal({ data, onClose }) {
  const purchases = useMemo(() => collectPurchases(data), [data]);
  const items = useMemo(() => lastBoughtByItem(purchases, isoDay()), [purchases]);
  const [tab, setTab] = useState("items");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (txt) => !needle || String(txt || "").toLowerCase().includes(needle);
  const shownItems = items.filter((it) => match(it.item) || match(it.category));
  const shownAll = purchases.filter((p) => match(p.item) || match(p.category) || match(p.detail) || match(p.hobby));
  const tabBtn = (k, label) => (
    <button type="button" onClick={() => setTab(k)} style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, background: tab === k ? palette.card : "transparent", color: palette.ink }}>{label}</button>
  );
  return (
    <Sheet title="🧾 Purchase history" onClose={onClose}>
      {purchases.length === 0 ? (
        <div style={{ fontSize: 14, color: palette.inkSoft, lineHeight: 1.55, padding: 12, background: palette.bgAlt, borderRadius: 10 }}>
          No purchases logged yet. Use <strong>💵 Add Expense</strong> on any hobby page (or log feed you bought in the feed supply tracker) and they'll show up here with the date you bought them.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, padding: 4, background: palette.bgAlt, borderRadius: 10, marginBottom: 10 }}>
            {tabBtn("items", "Last bought")}
            {tabBtn("all", `Every purchase (${purchases.length})`)}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (e.g. pellets, vet, bedding)" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.card, fontFamily: FONT_BODY, fontSize: 14, color: palette.ink, boxSizing: "border-box", marginBottom: 10 }} />
          {tab === "items" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shownItems.map((it) => (
                <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.item}</div>
                    <div style={{ fontSize: 12, color: palette.inkSoft }}>
                      Last bought {fmtDate(it.lastDate)} ({agoLabel(it.daysAgo)})
                      {it.times > 1 ? ` · bought ${it.times}×${it.everyDays ? `, about every ${it.everyDays} days` : ""}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: palette.leaf, whiteSpace: "nowrap" }}>{fmtMoney(it.lastAmount)}</div>
                </div>
              ))}
              {shownItems.length === 0 && <div style={{ fontSize: 13, color: palette.inkSoft }}>Nothing matches “{q}”.</div>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shownAll.slice(0, 200).map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 2px", borderBottom: `1px solid ${palette.line}` }}>
                  <div style={{ width: 86, fontSize: 12, color: palette.inkSoft, flexShrink: 0 }}>{fmtDate(p.date)}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.item}</div>
                    <div style={{ fontSize: 11, color: palette.inkSoft }}>{[p.category !== p.item ? p.category : null, p.detail, p.hobby, p.repeats ? `repeats ${p.repeats}` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMoney(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 10, lineHeight: 1.45 }}>
            Includes everything logged with 💵 Add Expense, feed bought through the feed supply tracker, and infrastructure purchases. Tip: name what you bought in the expense note (e.g. “Layer pellets 50 lb”) so repeat buys group together.
          </div>
        </>
      )}
    </Sheet>
  );
}
