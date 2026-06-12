// ============================================================================
// GamesHub.jsx — the Homestead Games page (trophy icon in the header)
// ----------------------------------------------------------------------------
// Olympics-style standings built from the community's logged numbers:
//   Countries → States & provinces → US counties, per category, with a
//   Total board and a Per-homestead ("pound for pound") board for each.
//
// Reads ONLY the pre-aggregated region_stats table (one query per visit).
// Never sees another homestead's individual data. Regions below the
// k-anonymity threshold arrive with total=0 / visible=false and render as
// a "N more to unlock" recruitment card instead of numbers.
//
// Region datasets (ISO 3166-2 subdivisions, US county FIPS) are lazy-loaded
// via dynamic import so they live in their own chunks, not the main bundle.
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { X, Trophy, MapPin, Pencil } from "lucide-react";
import {
  GAMES_CATEGORIES, REGION_K, countryFlag,
  loadMyRegion, saveMyRegion, fetchRegionBoards, pushGamesContribution,
} from "./games.js";
// Achievements tab reuses Year in Review's badge system wholesale — same
// component, same supporter gating, same computeStats source of truth.
import { BadgesCard, StandingsLockedCard, computeStats } from "./YearInReview.jsx";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

// Fair-ribbon colors for the podium — 1st/2nd/3rd.
const RIBBON = [
  { fill: "#E8B547", edge: "#B98A1F", label: "1st" },
  { fill: "#C9CBCE", edge: "#8E9296", label: "2nd" },
  { fill: "#C98A5B", edge: "#8B5A2B", label: "3rd" },
];

const selectStyle = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

function Card({ children, accent, style }) {
  return (
    <div style={{
      background: accent || palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 14, padding: 16, marginBottom: 14, ...style,
    }}>
      {children}
    </div>
  );
}

function fmtTotal(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}
function fmtPer(n) {
  const v = Number(n) || 0;
  return v >= 100 ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// County-fair prize ribbon — the page's one signature flourish. A rosette
// with two tails, pure CSS, sized for the podium cards.
function FairRibbon({ place, size = 44 }) {
  const r = RIBBON[place] || RIBBON[2];
  const tailW = Math.round(size * 0.26);
  const tailH = Math.round(size * 0.52);
  return (
    <div style={{ position: "relative", width: size, height: size + tailH * 0.6, flexShrink: 0 }}>
      {/* tails */}
      <div style={{
        position: "absolute", top: size * 0.62, left: size * 0.16,
        width: tailW, height: tailH, background: r.fill,
        border: `1.5px solid ${r.edge}`, transform: "rotate(14deg)",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
      }} />
      <div style={{
        position: "absolute", top: size * 0.62, right: size * 0.16,
        width: tailW, height: tailH, background: r.fill,
        border: `1.5px solid ${r.edge}`, transform: "rotate(-14deg)",
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
      }} />
      {/* pleated edge (dashed ring) + rosette center */}
      <div style={{
        position: "absolute", inset: 0, width: size, height: size, borderRadius: "50%",
        background: r.fill, border: `2px dashed ${r.edge}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: size * 0.66, height: size * 0.66, borderRadius: "50%",
          background: palette.card, border: `1.5px solid ${r.edge}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_DISPLAY, fontSize: size * 0.34, color: palette.ink,
        }}>
          {r.label}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Region picker modal — country → state/province → US county (optional).
// Anonymous by default; the only other choice is staying out entirely.
// ============================================================================
function RegionModal({ initial, subsData, data, onClose, onSaved }) {
  const [country, setCountry] = useState(initial?.country_code || "US");
  const [subdivision, setSubdivision] = useState(initial?.subdivision_code || "");
  const [county, setCounty] = useState(initial?.county_code || "");
  const [included, setIncluded] = useState(initial ? initial.display_mode !== "hidden" : true);
  const [counties, setCounties] = useState(null); // { ABBR: [[fips,name],...] }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const countryList = useMemo(() => {
    if (!subsData) return [];
    return Object.entries(subsData)
      .map(([cc, info]) => [cc, info.name])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [subsData]);

  const subs = subsData?.[country]?.subs || [];
  const isUS = country === "US";
  const stateAbbr = isUS && subdivision ? subdivision.split("-")[1] : null;

  // Lazy-load the US county list only when a US state is picked.
  useEffect(() => {
    let cancelled = false;
    if (isUS && stateAbbr && !counties) {
      import("./data/us_counties.json").then((m) => {
        if (!cancelled) setCounties(m.default || m);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isUS, stateAbbr, counties]);

  const countyList = (isUS && stateAbbr && counties) ? (counties[stateAbbr] || []) : [];

  const save = async () => {
    setErr("");
    if (!country) { setErr("Pick a country."); return; }
    if (subs.length > 0 && !subdivision) { setErr("Pick your state or region."); return; }
    setSaving(true);
    const res = await saveMyRegion({
      country_code: country,
      subdivision_code: subdivision || null,
      county_code: isUS ? (county || null) : null,
      display_mode: included ? "anonymous" : "hidden",
    });
    if (!res.ok) {
      setSaving(false);
      setErr(res.reason === "signed_out"
        ? "Sign in to join the Games."
        : "Couldn't save just now — try again in a moment.");
      return;
    }
    // Land in the next nightly rollup right away.
    if (included) await pushGamesContribution(data, { force: true });
    setSaving(false);
    onSaved(res.region);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#2C181088", zIndex: 1000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
          background: palette.bg, borderRadius: "18px 18px 0 0", padding: 18,
          boxSizing: "border-box", fontFamily: FONT_BODY,
          paddingBottom: "calc(18px + env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>
            Where's your homestead?
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: palette.ink }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>
          Your region puts your homestead's numbers on its team — country, state,
          and county standings. Your name is never shown, and we never ask for
          anything more precise than a county.
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: palette.inkSoft, marginBottom: 5 }}>
          Country
        </label>
        <select
          value={country}
          onChange={(e) => { setCountry(e.target.value); setSubdivision(""); setCounty(""); }}
          style={{ ...selectStyle, marginBottom: 13 }}
        >
          {countryList.map(([cc, name]) => (
            <option key={cc} value={cc}>{countryFlag(cc)} {name}</option>
          ))}
        </select>

        {subs.length > 0 && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: palette.inkSoft, marginBottom: 5 }}>
              {isUS ? "State" : "State / province / region"}
            </label>
            <select
              value={subdivision}
              onChange={(e) => { setSubdivision(e.target.value); setCounty(""); }}
              style={{ ...selectStyle, marginBottom: 13 }}
            >
              <option value="">Choose…</option>
              {subs.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </>
        )}

        {isUS && stateAbbr && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: palette.inkSoft, marginBottom: 5 }}>
              County <span style={{ fontWeight: 400, fontStyle: "italic" }}>(optional — unlocks county boards)</span>
            </label>
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              style={{ ...selectStyle, marginBottom: 13 }}
            >
              <option value="">Skip for now</option>
              {countyList.map(([fips, name]) => (
                <option key={fips} value={fips}>{name}</option>
              ))}
            </select>
          </>
        )}

        <div style={{
          padding: "11px 13px", borderRadius: 10, marginBottom: 13,
          background: palette.bgAlt, border: `1.5px solid ${palette.line}`,
        }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 8 }}>
            <input type="radio" name="games-include" checked={included} onChange={() => setIncluded(true)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, color: palette.ink, lineHeight: 1.45 }}>
              <strong>Count my homestead in</strong> — always anonymous; only
              your region's combined totals are ever shown.
            </span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="radio" name="games-include" checked={!included} onChange={() => setIncluded(false)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, color: palette.ink, lineHeight: 1.45 }}>
              <strong>Leave my homestead out</strong> — keep a region for weather
              and almanac features, contribute nothing to the boards.
            </span>
          </label>
        </div>

        {err && (
          <div style={{ fontSize: 13, color: palette.accent, marginBottom: 10 }}>{err}</div>
        )}

        <button
          onClick={save}
          disabled={saving}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
            background: palette.leaf, color: palette.card, fontFamily: FONT_BODY,
            fontWeight: 700, fontSize: 15, cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save my region"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Board pieces
// ============================================================================
function PodiumCard({ place, name, value, noun, mode }) {
  return (
    <div style={{
      flex: "1 1 0", minWidth: 0, background: palette.card,
      border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: "12px 8px 10px", textAlign: "center",
      transform: place === 0 ? "translateY(-6px)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <FairRibbon place={place} size={place === 0 ? 48 : 42} />
      </div>
      <div style={{
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: palette.ink,
        marginTop: 4, lineHeight: 1.25, overflowWrap: "break-word",
      }}>
        {name}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginTop: 3 }}>
        {mode === "per" ? fmtPer(value) : fmtTotal(value)}
      </div>
      <div style={{ fontSize: 10, color: palette.inkSoft }}>
        {mode === "per" ? `${noun} per homestead` : noun}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px", borderRadius: 999, whiteSpace: "nowrap",
        border: `1.5px solid ${active ? palette.leaf : palette.line}`,
        background: active ? palette.leaf : palette.card,
        color: active ? palette.card : palette.ink,
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Page
// ============================================================================
export default function GamesHubPage({ data, user, isSupporter = false, onOpenSupport }) {
  const year = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(null);
  const [boards, setBoards] = useState([]);
  const [subsData, setSubsData] = useState(null);
  const [counties, setCounties] = useState(null);
  const [level, setLevel] = useState("subdivision");
  const [mode, setMode] = useState("total");
  const [category, setCategory] = useState("eggs");
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [tab, setTab] = useState("standings"); // 'standings' | 'achievements'
  const yearStats = useMemo(
    () => (tab === "achievements" ? computeStats(data, year) : null),
    [tab, data, year]
  );

  // Load region + boards + the subdivision name dataset; push fresh numbers
  // so the next nightly rollup has today's totals.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, b] = await Promise.all([loadMyRegion(), fetchRegionBoards(year)]);
      if (cancelled) return;
      setRegion(r);
      setBoards(b);
      setLoading(false);
      if (r && r.display_mode !== "hidden") {
        pushGamesContribution(data, { force: true });
      }
    })();
    import("./data/subdivisions.json")
      .then((m) => { if (!cancelled) setSubsData(m.default || m); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // County names load lazily, only when the counties tab is opened.
  useEffect(() => {
    let cancelled = false;
    if (level === "county" && !counties) {
      import("./data/us_counties.json")
        .then((m) => { if (!cancelled) setCounties(m.default || m); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [level, counties]);

  const countyNames = useMemo(() => {
    if (!counties) return {};
    const map = {};
    Object.entries(counties).forEach(([abbr, list]) => {
      list.forEach(([fips, name]) => { map[fips] = `${name}, ${abbr}`; });
    });
    return map;
  }, [counties]);

  const regionName = (lvl, code) => {
    if (!code) return "";
    if (lvl === "country") {
      return `${countryFlag(code)} ${subsData?.[code]?.name || code}`;
    }
    if (lvl === "subdivision") {
      const cc = code.split("-")[0];
      const hit = (subsData?.[cc]?.subs || []).find(([c]) => c === code);
      const nm = hit ? hit[1] : code;
      return cc === "US" ? nm : `${countryFlag(cc)} ${nm}`;
    }
    return countyNames[code] || `County ${code}`;
  };

  const cat = GAMES_CATEGORIES.find((c) => c.key === category) || GAMES_CATEGORIES[0];

  // Visible rows for the current board, sorted by the active mode.
  const rows = useMemo(() => {
    const key = mode === "per" ? "per_homestead" : "total";
    return boards
      .filter((b) => b.region_level === level && b.category === category && b.visible)
      .sort((a, b) => Number(b[key]) - Number(a[key]));
  }, [boards, level, category, mode]);

  // The user's own row at this level (visible or not).
  const myCode =
    level === "country" ? region?.country_code :
    level === "subdivision" ? region?.subdivision_code :
    region?.county_code;
  const myRow = myCode
    ? boards.find((b) => b.region_level === level && b.category === category && b.region_code === myCode)
    : null;
  const myRank = myCode ? rows.findIndex((r) => r.region_code === myCode) : -1;

  const levelNoun =
    level === "country" ? "countries" :
    level === "subdivision" ? "states & provinces" : "counties";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "4px 0 32px", fontFamily: FONT_BODY }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 2px" }}>
        <Trophy size={24} color={palette.yolk} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: palette.ink }}>
          Homestead Games
        </div>
      </div>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14 }}>
        {year} standings, built from what the community logs. Anonymous always —
        regions compete, never names.
      </div>

      {/* Tab bar: regional standings vs personal achievements */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Pill active={tab === "standings"} onClick={() => setTab("standings")}>🌍 Standings</Pill>
        <Pill active={tab === "achievements"} onClick={() => setTab("achievements")}>🎖 My achievements</Pill>
      </div>

      {tab === "achievements" ? (
        <>
          {isSupporter && yearStats ? (
            <BadgesCard stats={yearStats} />
          ) : (
            <StandingsLockedCard onOpenSupport={onOpenSupport} />
          )}
          <div style={{ fontSize: 11, color: palette.inkSoft, fontStyle: "italic", lineHeight: 1.5, marginTop: 4 }}>
            Badges are personal and computed right on your device from your own
            {" "}{year} logs — nothing leaves your homestead.
          </div>
        </>
      ) : loading ? (
        <Card><div style={{ fontSize: 13, color: palette.inkSoft }}>Loading the standings…</div></Card>
      ) : !user ? (
        <Card>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>
            Sign in to join the Games
          </div>
          <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
            The Homestead Games put your region — country, state, and county —
            on a friendly medal table. Sign in, pick your region, and your
            homestead's numbers join the team. Always anonymous.
          </div>
        </Card>
      ) : !region ? (
        <Card accent={palette.bgAlt}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <MapPin size={20} color={palette.accent} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>
              Put your region on the board
            </div>
          </div>
          <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.6, marginBottom: 12 }}>
            Every egg, harvest, hatch, and jar you log can count for your
            country, state, and county — anonymously. Pick your region once
            and your homestead joins the team. Your name is never shown,
            and county is optional.
          </div>
          <button
            onClick={() => setShowRegionModal(true)}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
              background: palette.leaf, color: palette.card, fontWeight: 700,
              fontFamily: FONT_BODY, fontSize: 15, cursor: "pointer",
            }}
          >
            Pick my region
          </button>
        </Card>
      ) : (
        <>
          {/* Level pills */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
            <Pill active={level === "country"} onClick={() => setLevel("country")}>🌍 Countries</Pill>
            <Pill active={level === "subdivision"} onClick={() => setLevel("subdivision")}>🏛 States & provinces</Pill>
            <Pill active={level === "county"} onClick={() => setLevel("county")}>📍 Counties</Pill>
          </div>

          {/* Category chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
            {GAMES_CATEGORIES.map((c) => (
              <Pill key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
                {c.icon} {c.label}
              </Pill>
            ))}
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Pill active={mode === "total"} onClick={() => setMode("total")}>Total</Pill>
            <Pill active={mode === "per"} onClick={() => setMode("per")}>Per homestead</Pill>
          </div>

          {/* Podium + list */}
          {rows.length === 0 ? (
            <Card>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 5 }}>
                No standings here yet
              </div>
              <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
                Totals are gathered once a day, and a board appears once enough
                homesteads in a region are logging {cat.label.toLowerCase()}.
                You might be early — that just means your region needs you.
              </div>
            </Card>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 12, paddingTop: 8 }}>
                {[1, 0, 2].filter((i) => rows[i]).map((i) => (
                  <PodiumCard
                    key={rows[i].region_code}
                    place={i}
                    name={regionName(level, rows[i].region_code)}
                    value={mode === "per" ? rows[i].per_homestead : rows[i].total}
                    noun={cat.noun}
                    mode={mode}
                  />
                ))}
              </div>
              {rows.length > 3 && (
                <Card style={{ padding: "6px 14px" }}>
                  {rows.slice(3, 10).map((r, idx) => (
                    <div
                      key={r.region_code}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 0",
                        borderBottom: idx < Math.min(rows.length - 3, 7) - 1 ? `1px solid ${palette.line}` : "none",
                      }}
                    >
                      <div style={{ width: 30, fontFamily: FONT_DISPLAY, fontSize: 15, color: palette.inkSoft }}>
                        {ordinal(idx + 4)}
                      </div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: palette.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {regionName(level, r.region_code)}
                      </div>
                      <div style={{ fontSize: 14, color: palette.ink }}>
                        {mode === "per" ? fmtPer(r.per_homestead) : fmtTotal(r.total)}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          {/* Your-region pinned card */}
          {!myCode ? (
            level === "county" && (
              <Card accent={palette.bgAlt}>
                <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
                  Add your county in region settings to join the county boards —
                  it's optional, and never anything more precise than that.
                </div>
              </Card>
            )
          ) : myRow && myRow.visible ? (
            <Card accent={palette.yolkSoft}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 22 }}>🏅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: palette.ink }}>
                    {regionName(level, myCode)} — {myRank >= 0 ? `${ordinal(myRank + 1)} of ${rows.length}` : "on the board"}
                  </div>
                  <div style={{ fontSize: 12, color: palette.inkSoft }}>
                    {mode === "per" ? `${fmtPer(myRow.per_homestead)} ${cat.noun} per homestead` : `${fmtTotal(myRow.total)} ${cat.noun}`} · {myRow.homestead_count.toLocaleString()} homesteads logging {cat.icon}
                  </div>
                </div>
              </div>
            </Card>
          ) : myRow ? (
            <Card accent={palette.bgAlt}>
              <div style={{ fontWeight: 700, fontSize: 14, color: palette.ink, marginBottom: 4 }}>
                🌱 {regionName(level, myCode)} is almost on the board
              </div>
              <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
                {myRow.homestead_count} {myRow.homestead_count === 1 ? "homestead is" : "homesteads are"} logging{" "}
                {cat.label.toLowerCase()} here — {Math.max(1, (REGION_K[level] || 3) - myRow.homestead_count)} more
                to unlock the board. Know a neighbor who homesteads? This is the excuse.
              </div>
            </Card>
          ) : (
            <Card accent={palette.bgAlt}>
              <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.55 }}>
                {regionName(level, myCode) || "Your region"} isn't on this board yet —
                your logged {cat.label.toLowerCase()} will count it in after the
                next daily tally.
              </div>
            </Card>
          )}

          {/* Footer: privacy + region settings */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: palette.inkSoft, fontStyle: "italic", lineHeight: 1.5 }}>
              Standings update once a day across {levelNoun}. Individual
              homesteads are never shown — only regional totals, and only once
              enough homesteads share a region.
            </div>
            <button
              onClick={() => setShowRegionModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                background: "none", border: `1.5px solid ${palette.line}`,
                borderRadius: 999, padding: "6px 11px", cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: palette.ink,
              }}
            >
              <Pencil size={12} /> Region
            </button>
          </div>
        </>
      )}

      {showRegionModal && subsData && (
        <RegionModal
          initial={region}
          subsData={subsData}
          data={data}
          onClose={() => setShowRegionModal(false)}
          onSaved={(r) => { setRegion(r); setShowRegionModal(false); }}
        />
      )}
    </div>
  );
}
