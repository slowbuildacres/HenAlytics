// ============================================================================
// Egg layers (3.0) — Birds tab
// ----------------------------------------------------------------------------
// Each flock with its birds: named birds with breed, age (from hatch date) and
// broody day; a count of unnamed birds; flock tools (add a bird, edit, move
// birds); the brooder and its history; adding a flock.
// ============================================================================

import React, { useEffect, useState } from "react";
import { Plus, Pencil, ArrowLeftRight, Egg, History } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button } from "../ui.jsx";
import { broodyDay, ageLabel, brooderHistory } from "../../flockTools.js";
import { profilePhotoOf, resolveAnimalPhotoUrl } from "../../animalPhotos.js";
import { isoDay, prettyDay } from "./eggFacts.js";
import { birdWord } from "./EggToday.jsx";

function sexWords(t) {
  if (t === "Duck") return ["duck", "ducks", "drake", "drakes"];
  if (t === "Goose") return ["goose", "geese", "gander", "ganders"];
  if (t === "Turkey") return ["hen", "hens", "tom", "toms"];
  if (t === "Quail") return ["hen", "hens", "cock", "cocks"];
  if (t === "Peafowl") return ["peahen", "peahens", "peacock", "peacocks"];
  return ["hen", "hens", "rooster", "roosters"];
}

// Profile photo, else initials. Shared by every animal list in the new look.
export function Avatar({ bird, size = 40 }) {
  const profile = profilePhotoOf(bird);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let off = false;
    if (!profile) { setUrl(null); return undefined; }
    resolveAnimalPhotoUrl(profile.path).then((u) => { if (!off) setUrl(u || null); });
    return () => { off = true; };
  }, [profile && profile.path]); // eslint-disable-line react-hooks/exhaustive-deps
  const initials = String(bird.name || "?").slice(0, 2).toUpperCase();
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: url ? `center / cover url(${url})` : "#EADFCB",
      display: "flex", alignItems: "center", justifyContent: "center", font: `700 ${Math.round(size * 0.35)}px ${font.body}`, color: "#5A4433",
    }}>{url ? null : initials}</span>
  );
}

export default function EggBirds({ hobby, data, update, setModal }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const flocks = (hobby.flocks || []).filter((f) => f && !f.archived);
  const [flockId, setFlockId] = useState(null);
  const flock = flocks.find((f) => f.id === flockId) || flocks[0];
  const brooder = brooderHistory(data);
  const active = brooder.filter((b) => b.active);

  if (!flock) {
    return (
      <Card padded style={{ textAlign: "center" }}>
        <div style={{ fontSize: type.body, color: nl.soft, marginBottom: 10 }}>No flocks yet.</div>
        <Button onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })}>Add a flock</Button>
      </Card>
    );
  }

  const named = (flock.namedBirds || []).filter((b) => b && !b.archived);
  const total = Number(flock.birdCount) || 0;
  const [f1, fN, m1, mN] = sexWords(flock.birdType);
  const fem = typeof flock.females === "number" ? flock.females : null;
  const mal = typeof flock.males === "number" ? flock.males : null;
  const parts = (fem != null && mal != null && fem + mal === total && (fem || mal))
    ? [fem ? `${fem} ${fem === 1 ? f1 : fN}` : null, mal ? `${mal} ${mal === 1 ? m1 : mN}` : null]
    : [`${total} ${birdWord(flock.birdType, total)}`];
  if (flock.startDate) parts.push(`since ${prettyDay(flock.startDate)}, ${flock.startDate.slice(0, 4)}`);
  const unnamed = Math.max(0, total - named.length);
  const openBirds = () => setModal({ type: "namedBirds", hobbyId: hobby.id, flockId: flock.id });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {flocks.length > 1 && (
        <div role="tablist" aria-label="Flocks" style={{ display: "flex", gap: 6, padding: 4, background: "#EDE4D4", borderRadius: 15, overflowX: "auto" }}>
          {flocks.map((f) => {
            const on = f.id === flock.id;
            return (
              <button key={f.id} type="button" role="tab" aria-selected={on} onClick={() => setFlockId(f.id)} style={{
                flex: "1 0 auto", minHeight: 40, padding: "0 12px", borderRadius: 12, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: on ? nl.card : "transparent", color: on ? nl.ink : nl.soft, font: `600 14px ${font.body}`,
              }}>{f.name} · {Number(f.birdCount) || 0}</button>
            );
          })}
        </div>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: type.small, color: nl.soft }}>{parts.filter(Boolean).join(" · ")}</div>
          <Button kind="link" onClick={openBirds} style={{ flexShrink: 0 }}>Add a bird</Button>
        </div>
        {named.map((b) => {
          const dd = b.broody ? broodyDay(b, entries, today) : null;
          const age = b.hatchDate ? ageLabel(b.hatchDate, today).replace(/ old$/, "") : "";
          const sub = [b.breed, b.sex === "male" ? m1 : null, age].filter(Boolean).join(" · ");
          return (
            <button key={b.id} type="button" onClick={openBirds} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 14px", textAlign: "left",
              border: "none", borderTop: `1px solid ${nl.rule}`, background: "transparent", cursor: "pointer", color: nl.ink, font: "inherit",
            }}>
              <Avatar bird={b} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>{b.name}</span>
                {sub && <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>{sub}</span>}
              </span>
              {b.broody && <Badge tone="ready">Broody{dd ? ` · day ${dd}` : ""}</Badge>}
            </button>
          );
        })}
        {unnamed > 0 && (
          <button type="button" onClick={openBirds} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 14px", textAlign: "left",
            border: "none", borderTop: `1px solid ${nl.rule}`, background: "transparent", cursor: "pointer", color: nl.soft, font: "inherit",
          }}>
            <span style={{ width: 40, height: 40, borderRadius: 20, border: `1.5px dashed ${nl.navIdle}`, boxSizing: "border-box", flexShrink: 0 }} />
            <span style={{ fontSize: 14 }}>{named.length ? `${unnamed} more without names` : `${unnamed} ${birdWord(flock.birdType, unnamed)}. Name a favorite to follow it.`}</span>
          </button>
        )}
        <div style={{ display: "flex", gap: 16, padding: "8px 14px", borderTop: `1px solid ${nl.rule}` }}>
          <Button kind="link" icon={<Pencil size={15} />} onClick={() => setModal({ type: "editFlock", hobbyId: hobby.id, flockId: flock.id })}>Edit flock</Button>
          {flocks.length > 1 && <Button kind="link" icon={<ArrowLeftRight size={15} />} onClick={() => setModal({ type: "moveFlockBirds", hobbyId: hobby.id, flockId: flock.id })}>Move birds</Button>}
        </div>
      </Card>

      {(active.length > 0 || brooder.length > 0) && (
        <Card>
          <CardHeader title="In the brooder" right={brooder.length ? <Button kind="link" onClick={() => setModal({ type: "brooderHistory" })}>History ({brooder.length})</Button> : null} />
          {active.length ? active.slice(0, 3).map((b, i) => (
            <Row key={b.id} first={i === 0} icon={<Egg size={20} strokeWidth={1.8} />}
              title={`${b.name} · ${b.remaining} ${b.remaining === 1 ? "chick" : "chicks"}`}
              sub={[b.hatchDate ? `Hatched ${prettyDay(b.hatchDate)}` : null, b.hatchDate ? ageLabel(b.hatchDate, today) : null, b.source || null].filter(Boolean).join(" · ")}
              onClick={() => setModal({ type: "brooderHistory" })} chevron />
          )) : <div style={{ padding: "0 14px 14px", fontSize: 14, color: nl.soft }}>Nothing in the brooder right now.</div>}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button kind="quiet" icon={<Plus size={18} />} onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })} style={{ flex: 1 }}>Add a flock</Button>
        <Button kind="quiet" icon={<Egg size={18} />} onClick={() => setModal({ type: "hatchEggs", hobbyId: hobby.id })} style={{ flex: 1 }}>Hatch eggs</Button>
      </div>
    </div>
  );
}
