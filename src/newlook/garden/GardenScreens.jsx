// ============================================================================
// Garden (3.0) — Today · Plants · Plan · Stats
// ----------------------------------------------------------------------------
// The old garden page stacked everything (tips, quick log, checklist, money
// card, then Growing/Perennials/Seeds/Map tabs ~1,100px down). Same features,
// sorted into four tabs:
//   Today  — frost, watering, quick log, this week's jobs, food grown
//   Plants — growing annuals, perennials and trees, seed starts
//   Plan   — garden map, seed box, what to start for your zone
//   Stats  — harvest, value vs. cost, fun facts, harvest by crop
// Detail screens (annual, perennial, seed start, map, seasons) are the
// existing ones, opened from here.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Snowflake, Droplet, ShoppingBasket, Sprout, MoreHorizontal, Share2, BookOpen, Map as MapIcon,
  Package, CalendarDays, MapPin, Trophy, Leaf, ChevronDown, Plus, Archive,
  Recycle,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Sheet } from "../ui.jsx";
import { winterSeason, WINTER_ITEMS } from "../../winterChecklist.js";
import { getWeeklyPrecip } from "../../weather.js";
import { needsBuying, seedViability } from "../../SeedInventory.jsx";
import { fmtMoney, fmtWeightWhole } from "../../units.js";
import { isoDay, parseDay, prettyDay, DAY } from "../eggs/eggFacts.js";
import { annualRows, perennialRows, seedStartRows, plantingWindows, seasonHarvests, harvestByCrop, gardenFunFacts } from "./gardenData.js";
import { computeHarvestValue } from "../../gardenValue.js";
import { compostDue, compostOf, compostSummary } from "./Compost.jsx";
import { totalHarvestLbs } from "../../analytics.js";

const money0 = (v) => fmtMoney(Math.round(v)).replace(/\.00$/, "");
const STATUS = {
  growing: ["quiet", "Growing"], harvesting: ["good", "Harvesting"], harvested: ["quiet", "Picked"],
  done: ["quiet", "Done"], sprouting: ["quiet", "Sprouting"], ready: ["ready", "Ready to move"],
};
const Ico = ({ I }) => <I size={20} strokeWidth={1.8} />;


// "This week": planting windows coming up and the winter checklist. Shown on
// Today, and between seasons too.
function GardenWeek({ data, update, setModal, onTab, onMap }) {
  const today = isoDay();
  const windows = useMemo(() => plantingWindows(data, today, 2), [data, today]);
  const season = winterSeason();
  const wst = season ? ((data.winterChecklist && data.winterChecklist[season]) || {}) : null;
  const winterItems = season && !(wst && wst.hidden) ? (WINTER_ITEMS.garden || []).map((it) => ({ ...it, key: `garden:${it.id}` })) : [];
  const done = (wst && wst.done) || {};
  const toggle = (k) => update((d) => {
    d.winterChecklist = d.winterChecklist || {};
    const cur = d.winterChecklist[season] || {};
    const nd = { ...(cur.done || {}) };
    if (nd[k]) delete nd[k]; else nd[k] = true;
    d.winterChecklist[season] = { ...cur, done: nd };
    return d;
  });
  const soon = windows ? windows.list.filter((w) => (parseDay(w.date) - parseDay(today)) / DAY <= 21) : [];
  const jobAction = (it) => it.action === "seeds" || it.action === "shop" ? { label: "Seed box", run: () => onTab("plan") } : it.action === "map" ? (onMap || { label: "Map", run: () => setModal({ type: "gardenMap" }) }) : null;

  return (
    <>
      {(soon.length > 0 || winterItems.length > 0) && (
        <Card>
          <CardHeader title="This week" right={windows ? windows.label || `Zone ${windows.zone}` : null} />
          {soon.map((w) => (
            <Row key={w.date + w.verb} icon={<Ico I={Sprout} />} iconBg={nl.goodTint}
              title={`${w.verb}: ${w.crops.slice(0, 3).join(", ").toLowerCase()}${w.crops.length > 3 ? ` +${w.crops.length - 3}` : ""}`}
              sub={w.date <= today ? "Now" : prettyDay(w.date)} trailing={<Badge tone="good">Planting</Badge>} />
          ))}
          {winterItems.map((it) => {
            const on = !!done[it.key];
            const act = jobAction(it);
            return (
              <div key={it.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderTop: `1px solid ${nl.rule}` }}>
                <button type="button" aria-pressed={on} aria-label={on ? `Undo: ${it.text}` : `Done: ${it.text}`} onClick={() => toggle(it.key)} style={{
                  // A 28px circle in a 44px tap area.
                  width: 44, height: 44, margin: "-8px", padding: 0, border: "none", background: "transparent", flexShrink: 0, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><span style={{
                  width: 28, height: 28, borderRadius: 14, boxSizing: "border-box",
                  border: on ? "none" : `1.5px solid ${nl.navIdle}`, background: on ? nl.good : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: type.body, fontWeight: 600, textDecoration: on ? "line-through" : "none", color: on ? nl.soft : nl.ink }}>{it.text}</div>
                  {!on && <div style={{ fontSize: type.small, color: nl.soft }}>{it.sub}</div>}
                </div>
                {act && !on && <Button kind="link" onClick={act.run}>{act.label}</Button>}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}


// ------------------------------------------------------------ Between seasons
// When no season is open (it was closed at the end of the year), the garden
// keeps its tabs: Today offers the next season or reopening, and Plants,
// Plan and Stats show the season that just closed. `closed` =
// { season, next, onStart, onReopen, onPast, value, harvestCount }.
export function nextGardenSeasonName(today = new Date()) {
  // From October on, the next garden is next year's.
  return `${today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear()} Garden`;
}

export function GardenClosed({ closed, data, update, setModal, onTab, onOpenJournal }) {
  const s = closed.season;
  const closedOn = s.endDate ? prettyDay(s.endDate) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: nl.deep, color: nl.onDeep, borderRadius: 20, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: nl.accentOnDeep }}>Season closed{closedOn ? ` ${closedOn}` : ""}</div>
          <div style={{ fontFamily: font.display, fontSize: 24, lineHeight: 1.15, marginTop: 4 }}>{s.name || "Last season"}</div>
          <div style={{ fontSize: 13, color: nl.onDeepSoft, marginTop: 2 }}>
            {closed.harvestCount ? `${money0(closed.value)} of food grown · ${closed.harvestCount} harvest${closed.harvestCount === 1 ? "" : "s"}` : "Its plants, map and numbers are saved."}
          </div>
        </div>
        <Button onClick={closed.onStart}>Start the {closed.next}</Button>
        <div style={{ fontSize: 12.5, color: nl.onDeepSoft, lineHeight: 1.4 }}>Your beds carry over, empty and ready to plant. Last season stays saved on the Plants and Stats tabs.</div>
      </div>
      <Card>
        <Row first icon={<Ico I={Archive} />} title={`Reopen ${s.name || "last season"}`} sub="Closed it too soon? Pick up where you left off" onClick={closed.onReopen} chevron />
        {closed.pastCount > 1 && <Row icon={<Ico I={CalendarDays} />} title={`All ${closed.pastCount} past seasons`} sub="Look back at or reopen an older garden" onClick={closed.onPast} chevron />}
      </Card>
      <GardenWeek data={data} update={update} setModal={setModal} onTab={onTab} onMap={{ label: "Start season", run: closed.onStart }} />
      <Card><Row first icon={<Ico I={BookOpen} />} title="Everything you've logged" sub="Every season's logs are in the Journal" onClick={onOpenJournal} chevron /></Card>
    </div>
  );
}

// Asked when a garden log is started with no season open.
export function GardenNeedSeason({ next, onStart, onClose }) {
  return (
    <Sheet open onClose={onClose} label="Start the garden season first" showClose>
      <div style={{ padding: 4, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: font.display, fontSize: 22 }}>Start the {next}</div>
        <div style={{ fontSize: 15, color: nl.soft, lineHeight: 1.5 }}>Garden logs go with a season, so start this year's first. Your beds carry over from last season.</div>
        <Button onClick={onStart}>Start the {next}</Button>
        <Button kind="quiet" onClick={onClose}>Not now</Button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------- Today
export function GardenToday({ hobby, data, update, setModal, frost, onPlanAnnualConfirm, onOpenJournal, onTab, spent }) {
  const today = isoDay();
  const ents = (data.entries && data.entries.garden) || [];
  const loc = data.homesteadLocation;
  const [rain, setRain] = useState(null);
  useEffect(() => {
    let off = false;
    if (loc && loc.lat != null) getWeeklyPrecip(loc.lat, loc.lon).then((r) => { if (!off) setRain(r); }).catch(() => {});
    return () => { off = true; };
  }, [loc && loc.lat, loc && loc.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastWater = ents.filter((e) => e && e.action === "watered" && e.date && e.date <= today).map((e) => e.date).sort().pop() || null;
  const days = lastWater ? Math.round((parseDay(today) - parseDay(lastWater)) / DAY) : null;
  const rainIn = rain && rain.totalIn != null ? rain.totalIn : null;
  const log = (action) => setModal({ type: "log", action, hobbyIdOverride: hobby.id });
  const harvests = useMemo(() => seasonHarvests(data, hobby), [data, hobby]);
  const value = useMemo(() => computeHarvestValue(harvests, hobby.harvestPrices || {}).total, [harvests, hobby.harvestPrices]);
  const compostDueNow = useMemo(() => { try { return compostDue(hobby, today); } catch (_) { return []; } }, [hobby, today]);
  const turnPile = (pileId) => update((d) => {
    const h = (d.hobbies || []).find((x) => x.id === hobby.id);
    if (!h) return d;
    const c = compostOf(h);
    c.logs.push({ id: Math.random().toString(36).slice(2, 10), pileId, date: today, kind: "turn" });
    h.compost = { piles: c.piles, logs: c.logs.slice(-2000) };
    return d;
  });
  const quick = [
    { k: "harvest", label: "Harvest", I: ShoppingBasket, primary: true, run: () => log("harvested") },
    { k: "water", label: "Watered", I: Droplet, run: () => log("watered") },
    { k: "plant", label: "Planted", I: Sprout, run: () => setModal({ type: "planCrop", onConfirm: onPlanAnnualConfirm }) },
    { k: "more", label: "More", I: MoreHorizontal, run: () => setModal({ type: "gardenMore", hobbyId: hobby.id }) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        {frost && (
          <Row first tint={nl.alertTint} iconBg={nl.alertChip} icon={<Snowflake size={20} color={nl.alert} strokeWidth={2} />}
            title={`Frost tonight, ${frost.lowText}`} sub={frost.crops && frost.crops.length ? `Cover ${frost.crops.join(", ").toLowerCase()}` : "Cover anything tender"} />
        )}
        <Row first={!frost} icon={<Ico I={Droplet} />}
          title={rainIn != null && rainIn >= 0.75 ? `${rainIn}" of rain this week` : days == null ? "No watering logged yet" : days === 0 ? "Watered today" : `Watered ${days} day${days === 1 ? "" : "s"} ago`}
          sub={rainIn != null && rainIn >= 0.75 ? "Your beds probably don't need watering today." : rainIn != null ? (rainIn > 0 ? `${rainIn}" of rain in the last 7 days` : "No rain in the last 7 days") : (loc ? null : "Add your location for rain and frost alerts")}
          trailing={days === 0 ? null : <button type="button" onClick={() => log("watered")} style={{ minHeight: 36, padding: "0 12px", borderRadius: 999, border: `1.5px solid ${nl.good}`, background: "transparent", color: nl.goodInk, font: `600 13px ${font.body}`, cursor: "pointer" }}>Watered</button>} />
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.k} type="button" onClick={q.run} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68, borderRadius: 16, cursor: "pointer",
            background: q.primary ? nl.yolk : nl.card, border: `1px solid ${q.primary ? nl.yolk : nl.line}`, color: q.primary ? nl.onYolk : nl.ink, font: `600 12px ${font.body}`,
          }}><q.I size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {compostDueNow.length > 0 && (
        <Card>
          {compostDueNow.slice(0, 3).map(({ pile, st }, i) => (
            <Row key={pile.id} first={i === 0} iconBg={nl.yolkTint} icon={<Ico I={Recycle} />}
              title={`Time to turn ${pile.name}`} sub={st.lastTurn ? `Last turned ${st.sinceTurn} days ago` : `Started ${st.age} day${st.age === 1 ? "" : "s"} ago, not turned yet`}
              trailing={<button type="button" aria-label={`Turned ${pile.name}`} onClick={() => turnPile(pile.id)} style={{ minHeight: 36, padding: "0 12px", borderRadius: 999, border: `1.5px solid ${nl.good}`, background: "transparent", color: nl.goodInk, font: `600 13px ${font.body}`, cursor: "pointer" }}>Turned</button>} />
          ))}
        </Card>
      )}

      <GardenWeek data={data} update={update} setModal={setModal} onTab={onTab} />

      <div style={{ background: nl.deep, color: nl.onDeep, borderRadius: 20, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => setModal({ type: "gardenValue", hobbyId: hobby.id })} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: nl.onDeep, font: "inherit" }}>
          <span style={{ display: "block", fontFamily: font.display, fontSize: 22, lineHeight: 1.1 }}><span style={{ color: nl.accentOnDeep }}>{money0(value)}</span> of food grown</span>
          <span style={{ display: "block", fontSize: 13, color: nl.onDeepSoft, marginTop: 2 }}>
            {hobby.currentSeason ? hobby.currentSeason.name : "This season"}{spent > 0 ? ` · ${value >= spent ? `${money0(value - spent)} ahead of costs` : `${money0(spent - value)} to break even`}` : ""}
          </span>
        </button>
        <button type="button" aria-label="Share what your garden grew" onClick={() => setModal({ type: "gardenShare", hobbyId: hobby.id })} style={{ width: 44, height: 44, borderRadius: 22, border: `1.5px solid ${nl.onDeepSoft}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: nl.onDeep }}>
          <Share2 size={20} strokeWidth={2} />
        </button>
      </div>

      <Card><Row first icon={<Ico I={BookOpen} />} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron /></Card>
    </div>
  );
}

// ------------------------------------------------------------------ Plants
export function GardenPlants({ hobby, data, setModal, onPlanAnnualConfirm, closed, liveHobby }) {
  const [seg, setSeg] = useState("growing");
  const [showDone, setShowDone] = useState(false);
  const annuals = useMemo(() => annualRows(hobby, data), [hobby, data]);
  const perennials = useMemo(() => perennialRows(hobby), [hobby]);
  // Seed starts are often sown before the season opens, so between seasons
  // they come from the live garden, not the closed season.
  const starts = useMemo(() => seedStartRows(closed && liveHobby ? liveHobby : hobby), [hobby, closed, liveHobby]);
  const segs = [["growing", `Growing · ${annuals.active.length}`], ["perennials", `Perennials · ${perennials.length}`], ["starts", `Seed starts${starts.length ? ` · ${starts.length}` : ""}`]];
  const add = seg === "growing" ? (closed ? closed.onStart : () => setModal({ type: "planCrop", onConfirm: onPlanAnnualConfirm }))
    : seg === "perennials" ? () => setModal({ type: "addPerennial", hobbyId: hobby.id })
    : () => setModal({ type: "addSeedStart", hobbyId: hobby.id });
  const addLabel = seg === "growing" ? (closed ? `Start the ${closed.next} to add plants` : "Add a plant") : seg === "perennials" ? "Add a perennial or tree" : "Start seeds";
  const row = (r, i, onClick) => {
    const st = STATUS[r.status];
    return <Row key={r.id} first={i === 0} icon={<Ico I={r.tree ? Leaf : Sprout} />} iconBg={r.status === "harvesting" || r.status === "ready" ? nl.goodTint : undefined}
      title={r.name} sub={r.sub} trailing={st ? <Badge tone={st[0]}>{st[1]}</Badge> : null} onClick={onClick} />;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div role="tablist" aria-label="Plant lists" style={{ display: "flex", gap: 6, padding: 4, background: nl.well, borderRadius: 15 }}>
        {segs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={seg === k} onClick={() => setSeg(k)} style={{
            flex: 1, minHeight: 40, borderRadius: 12, border: "none", cursor: "pointer", padding: "0 6px",
            background: seg === k ? nl.card : "transparent", color: seg === k ? nl.ink : nl.soft, font: `600 13px ${font.body}`,
          }}>{label}</button>
        ))}
      </div>
      {seg === "growing" && closed && <div style={{ fontSize: type.small, color: nl.soft }}>{closed.season.name || "Last season"}, closed</div>}
      {seg === "growing" && (annuals.active.length ? (
        <Card>{annuals.active.map((r, i) => row(r, i, () => setModal({ type: "annualDetail", hobbyId: hobby.id, annualId: r.id })))}</Card>
      ) : <Card padded><div style={{ fontSize: 14, color: nl.soft }}>Nothing growing yet this season. Add what you planted to track harvests.</div></Card>)}
      {seg === "growing" && annuals.done.length > 0 && (
        <>
          <Button kind="link" icon={<Archive size={15} />} onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : `${annuals.done.length} finished this season`}</Button>
          {showDone && <Card>{annuals.done.map((r, i) => row(r, i, () => setModal({ type: "annualDetail", hobbyId: hobby.id, annualId: r.id })))}</Card>}
        </>
      )}
      {seg === "perennials" && (perennials.length
        ? <Card>{perennials.map((r, i) => row(r, i, () => setModal({ type: "perennialDetail", hobbyId: hobby.id, perennialId: r.id })))}</Card>
        : <Card padded><div style={{ fontSize: 14, color: nl.soft }}>Add asparagus, berries, herbs or fruit trees to log harvests year after year.</div></Card>)}
      {seg === "starts" && (starts.length
        ? <Card>{starts.map((r, i) => row(r, i, () => setModal({ type: "seedStartDetail", hobbyId: hobby.id, batchId: r.id })))}</Card>
        : <Card padded><div style={{ fontSize: 14, color: nl.soft }}>Track seeds you start indoors: how many sprouted and when they go out.</div></Card>)}
      <div style={{ display: "flex", gap: 8 }}>
        <Button kind="quiet" icon={<Plus size={18} />} onClick={add} style={{ flex: 1 }}>{addLabel}</Button>
      </div>
      {!closed && <Button kind="link" onClick={() => setModal({ type: "gardenMore", hobbyId: hobby.id })} style={{ color: nl.soft, alignSelf: "center" }}>Wrap up the season and more</Button>}
    </div>
  );
}

// -------------------------------------------------------------------- Plan
export function GardenPlan({ hobby, data, setModal, seedBox, onOpenCalendar, onOpenBarn, closed }) {
  const today = isoDay();
  const [boxOpen, setBoxOpen] = useState(false);
  const season = hobby.currentSeason;
  const areas = season && season.gardenMap && Array.isArray(season.gardenMap.areas) ? season.gardenMap.areas : null;
  // A grid bed (mode "grid") has no photo; it counts as a map as soon as it exists.
  const hasMap = areas ? areas.some((a) => a && (a.photoPath || a.mode === "grid" || (a.grid && a.grid.beds && a.grid.beds.length))) : !!(season && season.gardenMap && season.gardenMap.photoPath);
  const pins = areas ? areas.reduce((n, a) => n + (Array.isArray(a.pins) ? a.pins.length : 0), 0) : 0;
  const seeds = (hobby.seeds || []).filter(Boolean);
  const toBuy = seeds.filter((p) => { try { return needsBuying(p); } catch (_) { return false; } });
  const useFirst = seeds.filter((p) => { try { return seedViability(p).status === "use"; } catch (_) { return false; } });
  const windows = useMemo(() => plantingWindows(data, today, 3), [data, today]);
  const compost = useMemo(() => { try { return compostSummary(hobby, today); } catch (_) { return { active: 0, total: 0, adds: 0, harvests: 0 }; } }, [hobby, today]);
  const compostTurn = useMemo(() => { try { return compostDue(hobby, today); } catch (_) { return []; } }, [hobby, today]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {closed ? (
        <Card>
          <CardHeader title="Garden map" />
          <Row icon={<Ico I={MapIcon} />} title={`Start the ${closed.next} to plan your beds`}
            sub="Your beds carry over from last season, empty and ready to plant, with crop rotation tips from what grew there."
            onClick={closed.onStart} chevron />
        </Card>
      ) : (
      <Card>
          <CardHeader title="Garden map" right={<Button kind="link" onClick={() => setModal({ type: "gardenMap" })}>{hasMap ? "Open map" : "Start a map"}</Button>} />
          <Row icon={<Ico I={MapIcon} />} title={hasMap ? `${pins} plant${pins === 1 ? "" : "s"} pinned` : "Map your beds"}
            sub={hasMap ? "See what's planted where, with crop rotation tips" : "Use a photo or draw a grid. Henalytics flags same-family crops in the same bed."}
            onClick={() => setModal({ type: "gardenMap" })} chevron />
        </Card>
      )}

      <Card>
        <CardHeader title="Seed box" right={`${seeds.length} packet${seeds.length === 1 ? "" : "s"}`} />
        {useFirst.slice(0, 2).map((p) => (
          <Row key={p.id} icon={<Ico I={Package} />} title={[p.crop, p.variety].filter(Boolean).join(", ")} sub={p.year ? `Packed ${p.year} · use up this year` : "Use up this year"} trailing={<Badge tone="ready">Use first</Badge>} />
        ))}
        <Row first={!useFirst.length} icon={<Ico I={Package} />} title={toBuy.length ? `${toBuy.length} on your shopping list` : seeds.length ? "Nothing to buy right now" : "Add the seeds you have"}
          sub="Low, out, or past their seed life" onClick={() => setBoxOpen((v) => !v)}
          trailing={<ChevronDown size={18} color={nl.soft} style={{ transform: boxOpen ? "rotate(180deg)" : "none" }} aria-hidden="true" />} />
        {boxOpen && <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${nl.rule}` }}>{seedBox}</div>}
      </Card>

      <Card>
        <CardHeader title="Compost" right={compost.active ? `${compost.active} going` : null} />
        <Row icon={<Ico I={Recycle} />} title={compost.total ? (compostTurn.length ? `${compostTurn.length} pile${compostTurn.length === 1 ? "" : "s"} due a turn` : `${compost.active} pile${compost.active === 1 ? "" : "s"} going`) : "Track your compost"}
          sub={compost.total ? `${compost.adds} addition${compost.adds === 1 ? "" : "s"} this year${compost.harvests ? ` · ${compost.harvests} batch${compost.harvests === 1 ? "" : "es"} used` : ""}` : "What goes in, turning, temperature, and where it went"}
          onClick={() => setModal({ type: "compost", hobbyId: hobby.id })} chevron />
      </Card>
      <Card>
        <CardHeader title="What to start" right={<Button kind="link" onClick={onOpenCalendar}>Full calendar</Button>} />
        {windows ? (windows.list.length ? windows.list.map((w, i) => (
          <Row key={w.date + w.verb} first={i === 0} icon={<Ico I={CalendarDays} />}
            title={`${w.verb}: ${w.crops.slice(0, 3).join(", ").toLowerCase()}${w.crops.length > 3 ? ` +${w.crops.length - 3} more` : ""}`}
            sub={w.date <= today ? "Now" : prettyDay(w.date)} />
        )) : <div style={{ padding: "0 14px 14px", fontSize: 14, color: nl.soft }}>Nothing to start for a while.</div>)
          : <Row first icon={<Ico I={MapPin} />} title="Add your location" sub="To see planting dates for your zone" onClick={onOpenBarn} chevron />}
        {windows && <div style={{ padding: "0 14px 12px", fontSize: 12, color: nl.soft }}>Last spring frost around {prettyDay(windows.lastFrost)}</div>}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- Stats
export function GardenStats({ hobby, data, setModal, spent, allNumbers, closed }) {
  const [showAll, setShowAll] = useState(false);
  const harvests = useMemo(() => seasonHarvests(data, hobby), [data, hobby]);
  const { total, crops } = useMemo(() => harvestByCrop(harvests, hobby.harvestPrices), [harvests, hobby.harvestPrices]);
  const lbs = totalHarvestLbs(harvests);
  const facts = useMemo(() => gardenFunFacts({ data, hobby, harvests }), [data, hobby, harvests]);
  const top = crops.slice(0, 5);
  const maxV = Math.max(1, ...top.map((c) => c.value || c.lbs));
  const COLORS = ["#B4472E", "#8B6F47", "#E3A92B", "#4C6B2F", "#3F6E8F"];
  const FI = { harvest: ShoppingBasket, trophy: Trophy, water: Droplet, leaf: Leaf };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: type.small, color: nl.soft }}>{hobby.currentSeason ? `${hobby.currentSeason.name}${closed ? ", closed" : ""}` : "This season"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded><div style={{ fontSize: type.small, color: nl.soft }}>Harvested</div><div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{fmtWeightWhole(lbs)}</div><div style={{ fontSize: 12, color: nl.soft }}>{harvests.length} harvest{harvests.length === 1 ? "" : "s"} logged</div></Card>
        <Card padded onClick={closed ? undefined : () => setModal({ type: "gardenValue", hobbyId: hobby.id })}><div style={{ fontSize: type.small, color: nl.soft }}>Food grown</div><div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1, color: nl.good }}>{money0(total)}</div><div style={{ fontSize: 12, color: nl.soft }}>{spent > 0 ? `Spent ${money0(spent)} · ${total >= spent ? `${money0(total - spent)} ahead` : `${money0(spent - total)} to go`}` : "At grocery prices"}</div></Card>
      </div>
      {facts.length > 0 && (
        <div role="region" aria-label="Garden fun facts, swipe for more" style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
          {facts.map((f, i) => {
            const I = FI[f.icon] || Leaf;
            return (
              <div key={f.key} style={{ flex: facts.length === 1 ? "1 0 100%" : "0 0 min(300px, 82%)", scrollSnapAlign: "start", boxSizing: "border-box", background: nl.yolkTint, borderRadius: 20, padding: "12px 12px 14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: nl.yolkInk }}>
                  <I size={14} strokeWidth={2} aria-hidden="true" />Fun fact
                  <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>{i + 1} of {facts.length}</span>
                  <button type="button" aria-label={`Share: ${f.title}`} onClick={() => setModal({ type: "shareCard", card: { kind: `garden_fact_${f.key}`, emoji: "🌱", kicker: data.homesteadName || "Our garden", big: f.big, line: f.line, chips: [], list: [], title: `${f.title} 🌱`, subtitle: f.sub, stats: [] } })}
                    style={{ width: 40, height: 40, marginLeft: 2, border: "none", borderRadius: 16, background: "rgba(255,253,248,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: nl.yolkInk }}><Share2 size={16} strokeWidth={2} /></button>
                </div>
                <div style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.15 }}>{f.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.35, color: nl.quietInk }}>{f.sub}</div>
              </div>
            );
          })}
        </div>
      )}
      <Card padded>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Harvest by crop</div>
        {top.length ? top.map((c, i) => (
          <div key={c.plant} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginTop: i ? 10 : 0 }}>
            <span style={{ width: 92, flexShrink: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.plant}</span>
            <span style={{ flex: 1, height: 14, borderRadius: 7, background: nl.chip, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.max(4, ((c.value || c.lbs) / maxV) * 100)}%`, background: COLORS[i % COLORS.length], borderRadius: 7 }} /></span>
            <span style={{ width: 64, textAlign: "right", color: nl.soft, flexShrink: 0 }}>{c.value ? money0(c.value) : fmtWeightWhole(c.lbs)}</span>
          </div>
        )) : <div style={{ fontSize: 14, color: nl.soft }}>Log a harvest to see what your garden grows best.</div>}
      </Card>
      <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: 14, border: `1.5px solid ${nl.field}`, background: "transparent", cursor: "pointer", color: nl.ink, font: `600 14px ${font.body}` }}>
        {showAll ? "Hide the detailed numbers" : "All the numbers: seasons, by plant, costs, waterings"}
        <ChevronDown size={16} style={{ transform: showAll ? "rotate(180deg)" : "none" }} aria-hidden="true" />
      </button>
      {showAll && <div>{allNumbers}</div>}
    </div>
  );
}
