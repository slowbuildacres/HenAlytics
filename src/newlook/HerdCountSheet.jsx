// ============================================================================
// New look (3.0) — herd count sheet (animals you count but don't name)
// ----------------------------------------------------------------------------
// Writes hobby.herdTally = { Doe: 3, Buck: 1, ... } exactly like each animal
// hobby's old HerdTallySection, keeping only counts above zero.
// ============================================================================

import React, { useEffect, useState } from "react";
import { nl, font } from "./theme.js";
import { Sheet, Button, RoundButton } from "./ui.jsx";

export default function HerdCountSheet({ open, onClose, hobby, update, categories, noun = "animals" }) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!open) return;
    const t = (hobby && hobby.herdTally) || {};
    const init = {};
    categories.forEach((k) => { init[k] = Number(t[k]) || 0; });
    setCounts(init);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = categories.reduce((s, k) => s + (Number(counts[k]) || 0), 0);
  const save = () => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h) return d;
      const next = {};
      categories.forEach((k) => { const n = Math.max(0, Math.floor(Number(counts[k]) || 0)); if (n > 0) next[k] = n; });
      h.herdTally = next;
      return d;
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="Herd count" showClose>
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Herd count</h2>
      <p style={{ margin: "0 4px 12px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>
        For {noun} you count but don't name. It's separate from your named {noun} and doesn't change their records.
      </p>
      <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 18 }}>
        {categories.map((k, i) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{k}</span>
            <RoundButton kind="minus" size={44} label={`One fewer ${k}`} disabled={!counts[k]} onClick={() => setCounts((c) => ({ ...c, [k]: Math.max(0, (Number(c[k]) || 0) - 1) }))} />
            <input type="number" inputMode="numeric" min={0} aria-label={`${k} count`} value={counts[k] ?? 0}
              onChange={(e) => setCounts((c) => ({ ...c, [k]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0) }))}
              style={{ width: 56, minHeight: 44, textAlign: "center", border: `1.5px solid ${nl.field}`, borderRadius: 12, background: nl.paper, font: `600 18px ${font.body}`, color: nl.ink }} />
            <RoundButton kind="plus" size={44} label={`One more ${k}`} onClick={() => setCounts((c) => ({ ...c, [k]: (Number(c[k]) || 0) + 1 }))} />
          </div>
        ))}
      </div>
      <Button onClick={save} style={{ width: "100%", marginTop: 14 }}>Save · {total} total</Button>
    </Sheet>
  );
}
