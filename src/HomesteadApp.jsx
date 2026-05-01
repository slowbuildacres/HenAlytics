import React, { useState, useEffect, useRef } from "react";
import {
  Sprout, Egg, Drumstick, Plus, Droplet, Sun, Scissors, AlertTriangle,
  Skull, Bird, Home, BarChart3, X, ChevronDown, Calendar, DollarSign,
  Snowflake, Archive, Trash2, Edit3, Save, Settings, ArrowLeft,
  Mail, Lightbulb, UserCircle, Lock, Heart, NotebookPen, Hammer, Leaf, LogOut
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import AuthModal from "./AuthModal.jsx";
import { supabase, isSupabaseConfigured } from "./supabase.js";

// ============ DESIGN TOKENS ============
const palette = {
  bg: "#F4EDE0",         // warm parchment
  bgAlt: "#EBE0CC",      // deeper parchment
  ink: "#2C1810",        // dark coffee
  inkSoft: "#5C4530",    // softer brown
  accent: "#C84B31",     // barn red
  accentSoft: "#E8A07A", // terracotta
  leaf: "#5A7A3C",       // garden green
  leafSoft: "#A8C078",
  yolk: "#E8B547",       // egg yellow
  yolkSoft: "#F2D58A",
  feather: "#8B6F47",    // chicken brown
  featherSoft: "#C9A77B",
  line: "#2C181030",
  card: "#FAF5EA",
};

// ============ STORAGE HELPERS ============
const STORAGE_KEY = "homestead_data_v1";

const defaultData = () => ({
  homesteadName: "",
  hobbies: [
    { id: "garden", name: "Garden", type: "garden", icon: "sprout", currentSeason: null, archivedSeasons: [] },
    { id: "egg_layers", name: "Egg Layers", type: "egg_layers", icon: "egg", flockSize: 0, flockHistory: [] },
    { id: "meat_chickens", name: "Meat Chickens", type: "meat_chickens", icon: "drumstick", currentBatch: null, archivedBatches: [] },
  ],
  entries: {}, // { hobbyId: [entries] }
  plantings: [], // garden plantings to track
  butchered: [], // butcher events for current batch
});

// Migrate older data shapes to the current schema. Safe to call on fresh data too.
function migrateData(data) {
  if (!data || typeof data !== "object") return defaultData();
  if (!Array.isArray(data.hobbies)) data.hobbies = defaultData().hobbies;
  if (!data.entries || typeof data.entries !== "object") data.entries = {};
  if (!Array.isArray(data.plantings)) data.plantings = [];
  if (typeof data.homesteadName !== "string") data.homesteadName = "";

  data.hobbies.forEach((h) => {
    if (h.type === "garden") {
      if (!("currentSeason" in h)) h.currentSeason = null;
      if (!Array.isArray(h.archivedSeasons)) h.archivedSeasons = [];
    }
    if (h.type === "egg_layers") {
      if (typeof h.flockSize !== "number") h.flockSize = 0;
      if (!Array.isArray(h.flockHistory)) h.flockHistory = [];
    }
    if (h.type === "meat_chickens") {
      if (!("currentBatch" in h)) h.currentBatch = null;
      if (!Array.isArray(h.archivedBatches)) h.archivedBatches = [];
    }
  });

  return data;
}

async function loadData() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return migrateData(JSON.parse(v));
  } catch (e) {}
  return defaultData();
}

async function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Save failed", e);
  }
}

// ============ UTIL ============
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtMoney = (n) => {
  const num = Number(n) || 0;
  return `$${num.toFixed(2)}`;
};
const newId = () => Math.random().toString(36).slice(2, 10);

const getSeason = (dateStr) => {
  const d = new Date(dateStr);
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  if (m >= 8 && m <= 10) return `Fall ${y}`;
  return `Winter ${y}`;
};

// ============ STYLED PRIMITIVES ============
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

function Tile({ icon: Icon, label, sub, onClick, color = palette.ink, bg = palette.card, big = false }) {
  return (
    <button
      onClick={onClick}
      className="tile"
      style={{
        background: bg,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 14,
        padding: big ? "20px 14px" : "16px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        color: palette.ink,
        boxShadow: "2px 3px 0 " + palette.line,
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
        minHeight: big ? 110 : 90,
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translate(2px, 3px)";
        e.currentTarget.style.boxShadow = "0 0 0 " + palette.line;
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "2px 3px 0 " + palette.line;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "2px 3px 0 " + palette.line;
      }}
    >
      <Icon size={big ? 30 : 24} color={color} strokeWidth={1.5} />
      <div style={{ fontSize: big ? 15 : 13, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, textAlign: "center" }}>{sub}</div>}
    </button>
  );
}

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{
      background: palette.card,
      border: `1.5px solid ${palette.line}`,
      borderRadius: 12,
      padding: 14,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontFamily: FONT_BODY, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontFamily: FONT_BODY }}>{sub}</div>}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
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
          background: palette.bg, borderRadius: 16, maxWidth: 460, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "6px 8px 0 " + palette.line,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14, fontFamily: FONT_BODY }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

function Btn({ children, onClick, variant = "primary", style = {}, type = "button", small = false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: small ? "6px 12px" : "10px 18px",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: small ? 13 : 14,
        ...styles[variant],
        boxShadow: "2px 2px 0 " + palette.line,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ============ ICON RESOLVER ============
const iconMap = { sprout: Sprout, egg: Egg, drumstick: Drumstick };
const HobbyIcon = ({ name, ...props }) => {
  const I = iconMap[name] || Sprout;
  return <I {...props} />;
};

// ============ MAIN APP ============
export default function HomesteadApp() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("home");
  const [activeHobby, setActiveHobby] = useState("garden");
  const [hobbyMenuOpen, setHobbyMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData().then((d) => setData(d));
  }, []);

  // Track Supabase auth state. The listener fires on signup, signin, signout,
  // and on initial load (it tells us if there's already a saved session).
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Get the current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    // Subscribe to changes (sign in, sign out, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const update = (mutator) => {
    setData((prev) => {
      const next = mutator(JSON.parse(JSON.stringify(prev)));
      saveData(next);
      return next;
    });
  };

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: palette.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, color: palette.ink }}>
        Loading homestead...
      </div>
    );
  }

  const hobby = data.hobbies.find((h) => h.id === activeHobby);
  const entries = data.entries[activeHobby] || [];

  return (
    <div style={{
      minHeight: "100vh",
      background: palette.bg,
      backgroundImage: `radial-gradient(${palette.line} 0.5px, transparent 0.5px)`,
      backgroundSize: "20px 20px",
      fontFamily: FONT_BODY,
      color: palette.ink,
      paddingBottom: 100,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
        body { margin: 0; }
        input, select, textarea { font-family: ${FONT_BODY}; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${palette.accent}; outline-offset: -1px; }
        button { font-family: ${FONT_BODY}; }
        .tile:hover { background: ${palette.bgAlt} !important; }
      `}</style>

      {/* HEADER */}
      <header style={{
        padding: "20px 20px 12px",
        borderBottom: `2px solid ${palette.ink}`,
        background: palette.bg,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", maxWidth: 720, margin: "0 auto" }}>
          <button
            onClick={() => setModal({ type: "renameHomestead" })}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              textAlign: "left", color: palette.ink,
            }}
            title="Rename homestead"
          >
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: palette.inkSoft, marginBottom: 2 }}>
              {data.homesteadName ? "your homestead" : "tap to name your homestead"}
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, margin: 0, color: palette.ink, lineHeight: 1 }}>
              {data.homesteadName || "the homestead"}
            </h1>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setModal({ type: "settings" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: palette.ink }}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* HOBBY PICKER */}
        <div style={{ maxWidth: 720, margin: "16px auto 0", position: "relative" }}>
          <button
            onClick={() => setHobbyMenuOpen(!hobbyMenuOpen)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              background: palette.card, border: `1.5px solid ${palette.ink}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", fontSize: 16, fontWeight: 600, color: palette.ink,
              boxShadow: "2px 2px 0 " + palette.line,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HobbyIcon name={hobby.icon} size={20} strokeWidth={1.5} />
              {hobby.name}
            </span>
            <ChevronDown size={18} style={{ transform: hobbyMenuOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
          </button>
          {hobbyMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: palette.card, border: `1.5px solid ${palette.ink}`,
              borderRadius: 10, zIndex: 60, overflow: "hidden",
              boxShadow: "3px 4px 0 " + palette.line,
            }}>
              {data.hobbies.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setActiveHobby(h.id); setSeasonFilter("all"); setHobbyMenuOpen(false); }}
                  style={{
                    width: "100%", padding: "12px 16px", background: h.id === activeHobby ? palette.bgAlt : "transparent",
                    border: "none", borderBottom: `1px solid ${palette.line}`,
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                    color: palette.ink, fontWeight: 500,
                  }}
                >
                  <HobbyIcon name={h.icon} size={18} strokeWidth={1.5} />
                  {h.name}
                </button>
              ))}
              <button
                onClick={() => { setHobbyMenuOpen(false); setModal({ type: "feedback", presetCategory: "hobby" }); }}
                style={{
                  width: "100%", padding: "12px 16px", background: palette.yolkSoft,
                  border: "none", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 10, color: palette.ink, fontWeight: 600,
                }}
              >
                <Plus size={18} strokeWidth={2} /> More hobbies?
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 40px" }}>
        {page === "home" ? (
          <HomePage hobby={hobby} data={data} update={update} setModal={setModal} />
        ) : (
          <AnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} />
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: palette.ink, padding: "12px 16px",
        display: "flex", justifyContent: "center", gap: 4, zIndex: 50,
      }}>
        <button
          onClick={() => setPage("home")}
          style={{
            flex: 1, maxWidth: 200, padding: "10px",
            background: page === "home" ? palette.yolk : "transparent",
            color: page === "home" ? palette.ink : palette.bg,
            border: "none", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontWeight: 600,
          }}
        >
          <Home size={18} strokeWidth={2} /> Home
        </button>
        <button
          onClick={() => setPage("analytics")}
          style={{
            flex: 1, maxWidth: 200, padding: "10px",
            background: page === "analytics" ? palette.yolk : "transparent",
            color: page === "analytics" ? palette.ink : palette.bg,
            border: "none", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontWeight: 600,
          }}
        >
          <BarChart3 size={18} strokeWidth={2} /> Analytics
        </button>
      </nav>

      {/* MODALS */}
      <ModalRouter modal={modal} setModal={setModal} data={data} update={update} activeHobby={activeHobby} user={user} />
    </div>
  );
}

// ============ HOME PAGE ============
function HomePage({ hobby, data, update, setModal }) {
  const entries = data.entries[hobby.id] || [];
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created).slice(0, 8);

  return (
    <div>
      {/* HOBBY-SPECIFIC SUMMARY */}
      {hobby.type === "egg_layers" && <EggLayersSummary hobby={hobby} update={update} setModal={setModal} />}
      {hobby.type === "meat_chickens" && <MeatChickensSummary hobby={hobby} entries={entries} update={update} setModal={setModal} />}
      {hobby.type === "garden" && <GardenSummary hobby={hobby} data={data} setModal={setModal} />}

      {/* QUICK LOG TILES */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "24px 0 12px", color: palette.ink }}>
        quick log
      </h2>
      <QuickLogTiles hobby={hobby} setModal={setModal} />

      {/* RECENT ACTIVITY */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "28px 0 12px", color: palette.ink }}>
        recent activity
      </h2>
      {recent.length === 0 ? (
        <div style={{
          padding: 24, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft,
        }}>
          No entries yet — tap a tile above to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((e) => (
            <ActivityRow key={e.id} entry={e} hobbyType={hobby.type} onDelete={() => {
              update((d) => {
                d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((x) => x.id !== e.id);
                return d;
              });
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickLogTiles({ hobby, setModal }) {
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 };

  if (hobby.type === "garden") {
    // If no active season, hide the action tiles — Summary handles the "start season" CTA
    if (!hobby.currentSeason) {
      return (
        <div style={{
          padding: 16, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          Start a garden season to begin logging.
        </div>
      );
    }
    return (
      <div style={grid}>
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Sprout} label="Planted" color={palette.leaf} onClick={() => setModal({ type: "log", action: "planted" })} />
        <Tile icon={Scissors} label="Harvested" color={palette.accent} onClick={() => setModal({ type: "log", action: "harvested" })} />
        <Tile icon={AlertTriangle} label="Report Issue" color={palette.yolk} onClick={() => setModal({ type: "log", action: "issue" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.feather} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Leaf} label="Close Season" color={palette.ink} onClick={() => setModal({ type: "closeGardenSeason" })} />
      </div>
    );
  }
  if (hobby.type === "egg_layers") {
    return (
      <div style={grid}>
        <Tile icon={Sun} label="Fed" color={palette.feather} onClick={() => setModal({ type: "log", action: "fed" })} />
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Bird} label="Free Range" color={palette.leaf} onClick={() => setModal({ type: "log", action: "free_range" })} />
        <Tile icon={Egg} label="Eggs Laid" color={palette.yolk} onClick={() => setModal({ type: "log", action: "eggs" })} />
        <Tile icon={DollarSign} label="Sold Eggs" color={palette.accent} onClick={() => setModal({ type: "log", action: "sold_eggs" })} />
        <Tile icon={Archive} label="Bedding" color={palette.featherSoft} onClick={() => setModal({ type: "log", action: "bedding" })} />
        <Tile icon={Skull} label="Report Death" color={palette.accent} onClick={() => setModal({ type: "log", action: "death" })} />
        <Tile icon={Hammer} label="Infrastructure" color={palette.feather} onClick={() => setModal({ type: "log", action: "infrastructure" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.inkSoft} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Plus} label="Add Birds" color={palette.ink} onClick={() => setModal({ type: "addBirds" })} />
      </div>
    );
  }
  if (hobby.type === "meat_chickens") {
    // Disable actions until a batch is started (the Summary card has the Hatch CTA)
    if (!hobby.currentBatch) {
      return (
        <div style={{
          padding: 16, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          Hatch a batch above to begin logging.
        </div>
      );
    }
    return (
      <div style={grid}>
        <Tile icon={Sun} label="Fed" color={palette.feather} onClick={() => setModal({ type: "log", action: "fed" })} />
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Skull} label="Report Death" color={palette.accent} onClick={() => setModal({ type: "log", action: "death" })} />
        <Tile icon={Hammer} label="Infrastructure" color={palette.feather} onClick={() => setModal({ type: "log", action: "infrastructure" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.inkSoft} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Snowflake} label="Butcher" color={palette.ink} onClick={() => setModal({ type: "butcher" })} />
      </div>
    );
  }
  return (
    <div style={grid}>
      <Tile icon={Plus} label="Quick Note" onClick={() => setModal({ type: "log", action: "note" })} />
    </div>
  );
}

// ============ HOBBY SUMMARIES ============
function GardenSummary({ hobby, data, setModal }) {
  if (!hobby.currentSeason) {
    const seasonCount = (hobby.archivedSeasons || []).length;
    return (
      <div style={{
        background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12,
        padding: 24, textAlign: "center",
      }}>
        <Sprout size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No active season</div>
        <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>
          {seasonCount > 0
            ? `${seasonCount} past season${seasonCount > 1 ? "s" : ""} archived. Start a new one when you're ready to plant.`
            : "Start a new season when you're ready to plant."}
        </div>
        <Btn variant="accent" onClick={() => setModal({ type: "startGardenSeason" })}>
          🌱 Start new season
        </Btn>
      </div>
    );
  }
  const season = hobby.currentSeason;
  const seasonEntries = (data.entries.garden || []).filter((e) => e.seasonId === season.id);
  const harvests = seasonEntries.filter((e) => e.action === "harvested");
  const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const plantings = seasonEntries.filter((e) => e.action === "planted").length;
  const days = Math.floor((Date.now() - new Date(season.startDate).getTime()) / (1000 * 60 * 60 * 24));
  return (
    <div>
      <div style={{
        background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Active Season · {season.name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: palette.leafSoft, lineHeight: 1 }}>{plantings}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>plantings · {totalHarvest.toFixed(1)} harvested · day {days}</div>
        </div>
      </div>
    </div>
  );
}

function EggLayersSummary({ hobby, update, setModal }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div style={{
        flex: 1, minWidth: 160, background: palette.card, border: `1.5px solid ${palette.line}`,
        borderRadius: 12, padding: 14,
      }}>
        <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Current Flock
        </div>
        <div style={{ fontSize: 32, fontFamily: FONT_DISPLAY, color: palette.yolk, lineHeight: 1 }}>
          {hobby.flockSize || 0}
        </div>
        <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 6 }}>
          {hobby.flockSize ? "hens" : "Tap +Add Birds to start"}
        </div>
      </div>
      {(hobby.flockHistory || []).length > 0 && (
        <div style={{
          flex: 1, minWidth: 160, background: palette.card, border: `1.5px solid ${palette.line}`,
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Flock Started
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {fmtDate(hobby.flockHistory[0].date)}
          </div>
        </div>
      )}
    </div>
  );
}

function MeatChickensSummary({ hobby, entries, update, setModal }) {
  if (!hobby.currentBatch) {
    return (
      <div style={{
        background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12,
        padding: 24, textAlign: "center",
      }}>
        <Bird size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No active batch</div>
        <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>
          Start a new batch when your chicks arrive.
        </div>
        <Btn variant="accent" onClick={() => setModal({ type: "hatchBatch" })}>
          🐣 Hatch new batch
        </Btn>
      </div>
    );
  }
  const batch = hobby.currentBatch;
  const days = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const weeks = (days / 7).toFixed(1);
  const deaths = entries
    .filter((e) => e.action === "death" && e.batchId === batch.id)
    .reduce((s, e) => s + (Number(e.count) || 1), 0);
  const alive = batch.startCount - deaths;
  return (
    <div>
      <div style={{
        background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Active Batch · {batch.name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: palette.yolk, lineHeight: 1 }}>{alive}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>birds · {weeks} weeks · started {fmtDate(batch.startDate)}</div>
        </div>
      </div>
    </div>
  );
}

// ============ ACTIVITY ROW ============
function ActivityRow({ entry, hobbyType, onDelete }) {
  const labels = {
    watered: "Watered", planted: "Planted", harvested: "Harvested", issue: "Issue Reported",
    fed: "Fed", free_range: "Free range", eggs: "Eggs collected", bedding: "Bedding",
    death: "Death reported", note: "Note", butcher: "Butchered",
    sold_eggs: "Eggs sold", infrastructure: "Infrastructure",
  };
  const icons = {
    watered: Droplet, planted: Sprout, harvested: Scissors, issue: AlertTriangle,
    fed: Sun, free_range: Bird, eggs: Egg, bedding: Archive, death: Skull,
    butcher: Snowflake, note: NotebookPen, sold_eggs: DollarSign, infrastructure: Hammer,
  };
  const Icon = icons[entry.action] || Edit3;
  let detail = "";
  switch (entry.action) {
    case "watered": detail = entry.gallons ? `${entry.gallons} gal` : (entry.amount || ""); break;
    case "planted": detail = `${entry.plant || ""} ${entry.quantity ? "× " + entry.quantity : ""}`.trim(); break;
    case "harvested": detail = `${entry.plant || ""} · ${entry.quantity || 0} ${entry.unit || "lbs"}`; break;
    case "fed": detail = `${entry.lbs || 0} lbs · ${fmtMoney(entry.cost)}`; break;
    case "eggs": detail = `${entry.count || 0} eggs`; break;
    case "sold_eggs": {
      const dozens = (Number(entry.count) || 0) / 12;
      const revenue = dozens * (Number(entry.pricePerDozen) || 0);
      detail = `${entry.count || 0} eggs · ${fmtMoney(revenue)} @ ${fmtMoney(entry.pricePerDozen)}/dz`;
      break;
    }
    case "infrastructure": detail = `${entry.item || "item"} · ${fmtMoney(entry.cost)}`; break;
    case "bedding": detail = `${entry.changeType || ""} · ${entry.cuft || 0} cu ft · ${fmtMoney(entry.cost)}`; break;
    case "death": {
      const n = Number(entry.count) || 1;
      detail = `${n > 1 ? n + " birds · " : ""}${entry.cause || "cause unknown"}`;
      break;
    }
    case "issue": detail = `${entry.issueType}${entry.detail ? ": " + entry.detail : ""}${entry.plant ? " on " + entry.plant : ""}`; break;
    case "free_range": detail = entry.note || ""; break;
    case "butcher": detail = `${entry.count || 0} birds · avg ${entry.avgWeight || 0} lbs`; break;
    case "note": detail = entry.note ? (entry.note.length > 50 ? entry.note.slice(0, 50) + "…" : entry.note) : ""; break;
    default: detail = entry.note || "";
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: palette.bgAlt,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={1.8} color={palette.ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{labels[entry.action] || entry.action}</div>
        <div style={{ fontSize: 12, color: palette.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fmtDate(entry.date)} {detail && "· " + detail}
        </div>
      </div>
      <button
        onClick={onDelete}
        style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ============ ANALYTICS PAGE ============
function AnalyticsPage({ hobby, data, seasonFilter, setSeasonFilter }) {
  // Garden uses explicit seasons; other hobbies use date-derived seasons
  if (hobby.type === "garden") {
    return <GardenAnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} />;
  }

  let entries = data.entries[hobby.id] || [];
  const allSeasons = Array.from(new Set(entries.map((e) => getSeason(e.date)))).sort();

  if (seasonFilter !== "all") {
    entries = entries.filter((e) => getSeason(e.date) === seasonFilter);
  }

  return (
    <div>
      {/* SEASON FILTER */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
          View
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small variant={seasonFilter === "all" ? "primary" : "ghost"} onClick={() => setSeasonFilter("all")}>
            All-time
          </Btn>
          {allSeasons.map((s) => (
            <Btn key={s} small variant={seasonFilter === s ? "primary" : "ghost"} onClick={() => setSeasonFilter(s)}>
              {s}
            </Btn>
          ))}
        </div>
      </div>

      {hobby.type === "egg_layers" && <EggLayersAnalytics hobby={hobby} entries={entries} />}
      {hobby.type === "meat_chickens" && <MeatChickensAnalytics hobby={hobby} entries={entries} seasonFilter={seasonFilter} />}
    </div>
  );
}

function GardenAnalyticsPage({ hobby, data, seasonFilter, setSeasonFilter }) {
  // Build season list: archived + (currently active, if any)
  const archived = hobby.archivedSeasons || [];
  const current = hobby.currentSeason;
  const allSeasons = [
    ...archived.map((s) => ({ id: s.id, name: s.name, archived: true })),
    ...(current ? [{ id: current.id, name: current.name + " (active)", archived: false }] : []),
  ];

  // Determine which entries to analyze based on filter
  let analyticsEntries = [];
  let seasonName = "All-time";
  if (seasonFilter === "all") {
    // Combine all archived season entries + current season entries
    analyticsEntries = [
      ...archived.flatMap((s) => s.finalEntries || []),
      ...(data.entries.garden || []),
    ];
  } else {
    // Find that specific season
    const archivedMatch = archived.find((s) => s.id === seasonFilter);
    if (archivedMatch) {
      analyticsEntries = archivedMatch.finalEntries || [];
      seasonName = archivedMatch.name;
    } else if (current && current.id === seasonFilter) {
      analyticsEntries = (data.entries.garden || []).filter((e) => e.seasonId === current.id);
      seasonName = current.name + " (active)";
    }
  }

  return (
    <div>
      {/* SEASON FILTER */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: palette.inkSoft, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
          View
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small variant={seasonFilter === "all" ? "primary" : "ghost"} onClick={() => setSeasonFilter("all")}>
            All-time
          </Btn>
          {allSeasons.map((s) => (
            <Btn key={s.id} small variant={seasonFilter === s.id ? "primary" : "ghost"} onClick={() => setSeasonFilter(s.id)}>
              {s.name}
            </Btn>
          ))}
        </div>
      </div>

      {allSeasons.length === 0 && !analyticsEntries.length && (
        <EmptyState text="No garden seasons yet. Start one from the Home page." />
      )}

      <GardenAnalytics entries={analyticsEntries} data={data} seasonName={seasonName} />
    </div>
  );
}

function GardenAnalytics({ entries, data, seasonName }) {
  const harvests = entries.filter((e) => e.action === "harvested");
  const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalCost = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const waterings = entries.filter((e) => e.action === "watered").length;
  const plantings = entries.filter((e) => e.action === "planted").length;

  // by-plant aggregate
  const byPlant = {};
  harvests.forEach((e) => {
    const p = e.plant || "Unknown";
    byPlant[p] = (byPlant[p] || 0) + (Number(e.quantity) || 0);
  });
  const plantData = Object.entries(byPlant).map(([name, value]) => ({ name, value }));

  const issues = entries.filter((e) => e.action === "issue");
  const issueTypes = {};
  issues.forEach((e) => { issueTypes[e.issueType || "other"] = (issueTypes[e.issueType || "other"] || 0) + 1; });

  if (entries.length === 0) {
    return <EmptyState text={`No entries in ${seasonName || "this view"}.`} />;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Plantings" value={plantings} accent={palette.leaf} />
        <StatCard label="Total Harvest" value={totalHarvest.toFixed(1)} sub="lbs / units" accent={palette.leaf} />
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} accent={palette.accent} />
        <StatCard label="Waterings" value={waterings} accent="#3F7CAC" />
      </div>

      {plantData.length > 0 && (
        <ChartCard title="Harvest by crop">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plantData}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Bar dataKey="value" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {issues.length > 0 && (
        <ChartCard title={`Issues reported (${issues.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(issueTypes).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: palette.bgAlt, borderRadius: 6 }}>
                <span style={{ textTransform: "capitalize" }}>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function EggLayersAnalytics({ hobby, entries }) {
  const eggs = entries.filter((e) => e.action === "eggs");
  const feeds = entries.filter((e) => e.action === "fed");
  const beddings = entries.filter((e) => e.action === "bedding");
  const deaths = entries.filter((e) => e.action === "death");
  const totalDeathCount = deaths.reduce((s, e) => s + (Number(e.count) || 1), 0);
  const sold = entries.filter((e) => e.action === "sold_eggs");
  const infra = entries.filter((e) => e.action === "infrastructure");

  const totalEggs = eggs.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const feedCost = feeds.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const beddingCost = beddings.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const infraCost = infra.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalCost = feedCost + beddingCost + infraCost;
  const costPerEgg = totalEggs > 0 ? totalCost / totalEggs : 0;
  const costPerDozen = costPerEgg * 12;
  const flockSize = hobby.flockSize || 0;
  const eggsPerHen = flockSize > 0 ? (totalEggs / flockSize).toFixed(1) : "—";

  // Revenue from selling eggs
  const totalEggsSold = sold.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const totalRevenue = sold.reduce((s, e) => {
    const dozens = (Number(e.count) || 0) / 12;
    return s + dozens * (Number(e.pricePerDozen) || 0);
  }, 0);
  const dozensSold = totalEggsSold / 12;
  const avgPricePerDozen = dozensSold > 0 ? totalRevenue / dozensSold : 0;
  const profitPerDozen = avgPricePerDozen - costPerDozen;
  const netProfit = totalRevenue - totalCost;

  // egg trend
  const byDate = {};
  eggs.forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + (Number(e.count) || 0); });
  const eggTrend = Object.entries(byDate).map(([date, count]) => ({ date: date.slice(5), count })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total Eggs Laid" value={totalEggs} accent={palette.yolk} />
        <StatCard label="Cost / Egg" value={fmtMoney(costPerEgg)} sub={`${fmtMoney(costPerDozen)}/dozen`} accent={palette.accent} />
        <StatCard label="Eggs / Hen" value={eggsPerHen} sub="lifetime" accent={palette.leaf} />
        {totalDeathCount > 0 && <StatCard label="Deaths" value={totalDeathCount} accent={palette.ink} />}
      </div>

      {(sold.length > 0 || totalRevenue > 0) && (
        <ChartCard title="💰 Revenue & profit">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Eggs Sold" value={totalEggsSold} sub={`${dozensSold.toFixed(1)} dozen`} accent={palette.yolk} />
            <StatCard label="Total Revenue" value={fmtMoney(totalRevenue)} accent={palette.leaf} />
            <StatCard label="Avg Price / Dozen" value={fmtMoney(avgPricePerDozen)} accent={palette.feather} />
            <StatCard
              label="Profit / Dozen"
              value={fmtMoney(profitPerDozen)}
              sub={`sold ${fmtMoney(avgPricePerDozen)} − cost ${fmtMoney(costPerDozen)}`}
              accent={profitPerDozen >= 0 ? palette.leaf : palette.accent}
            />
            <StatCard
              label="Net Profit"
              value={fmtMoney(netProfit)}
              sub="revenue − all costs"
              accent={netProfit >= 0 ? palette.leaf : palette.accent}
            />
          </div>
        </ChartCard>
      )}

      <ChartCard title="📊 Cost breakdown">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <CostRow label="Feed" value={feedCost} total={totalCost} />
          <CostRow label="Bedding" value={beddingCost} total={totalCost} />
          {infraCost > 0 && <CostRow label="Infrastructure" value={infraCost} total={totalCost} />}
          <div style={{
            display: "flex", justifyContent: "space-between", padding: "10px 12px",
            background: palette.ink, color: palette.bg, borderRadius: 6, marginTop: 4, fontWeight: 600,
          }}>
            <span>Total</span>
            <span>{fmtMoney(totalCost)}</span>
          </div>
        </div>
      </ChartCard>

      {eggTrend.length > 0 && (
        <ChartCard title="Egg production">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={eggTrend}>
              <XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke={palette.yolk} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {infra.length > 0 && (
        <ChartCard title={`🔨 Infrastructure (${infra.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {infra.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13 }}>
                <span>{e.item || "Item"} <span style={{ color: palette.inkSoft, fontSize: 11 }}>· {fmtDate(e.date)}</span></span>
                <strong>{fmtMoney(e.cost)}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {entries.length === 0 && <EmptyState text="No egg layer entries yet for this view." />}
    </div>
  );
}

function CostRow({ label, value, total }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13 }}>
      <span>{label} <span style={{ color: palette.inkSoft, fontSize: 11 }}>({pct.toFixed(0)}%)</span></span>
      <strong>{fmtMoney(value)}</strong>
    </div>
  );
}

function MeatChickensAnalytics({ hobby, entries, seasonFilter }) {
  // Combine current batch (in-progress) + archived batches
  const currentBatch = hobby.currentBatch;
  const archived = hobby.archivedBatches || [];

  // For all-time: show summary across all batches (archived + active)
  // For seasonal filter: filter batches whose start date falls in that season
  let batches = [...archived];
  if (currentBatch) batches.push({
    ...currentBatch,
    isActive: true,
    butchered: currentBatch.butchered || [],
    finalEntries: entries.filter(e => e.batchId === currentBatch.id),
  });

  if (seasonFilter !== "all") {
    batches = batches.filter((b) => getSeason(b.startDate) === seasonFilter);
  }

  if (batches.length === 0) {
    return <EmptyState text="No meat chicken batches in this view." />;
  }

  // Aggregate stats
  let totalStart = 0, totalDeaths = 0, totalButchered = 0, totalFeedCost = 0, totalInfraCost = 0, totalChickCost = 0, totalWeight = 0;
  const deathCauses = {};
  const deathAges = []; // weeks at death

  batches.forEach((b) => {
    totalStart += b.startCount || 0;
    totalChickCost += Number(b.chickCost) || 0;
    const bEntries = b.finalEntries || [];
    bEntries.forEach((e) => {
      if (e.action === "fed") totalFeedCost += Number(e.cost) || 0;
      if (e.action === "infrastructure") totalInfraCost += Number(e.cost) || 0;
      if (e.action === "death") {
        const n = Number(e.count) || 1;
        totalDeaths += n;
        deathCauses[e.cause || "unknown"] = (deathCauses[e.cause || "unknown"] || 0) + n;
        if (e.date && b.startDate) {
          const days = (new Date(e.date) - new Date(b.startDate)) / (1000 * 60 * 60 * 24);
          // Push the age once per dead bird so the histogram and average reflect each death
          for (let i = 0; i < n; i++) deathAges.push(days / 7);
        }
      }
    });
    (b.butchered || []).forEach((bu) => {
      totalButchered += bu.count || 0;
      totalWeight += (bu.count || 0) * (bu.avgWeight || 0);
    });
  });

  const totalCost = totalFeedCost + totalInfraCost + totalChickCost;
  const mortalityRate = totalStart > 0 ? ((totalDeaths / totalStart) * 100).toFixed(1) : 0;
  const avgWeight = totalButchered > 0 ? (totalWeight / totalButchered).toFixed(2) : 0;
  const costPerBird = totalButchered > 0 ? (totalCost / totalButchered).toFixed(2) : "—";
  const leadingCause = Object.entries(deathCauses).sort((a, b) => b[1] - a[1])[0];
  const avgDeathAge = deathAges.length > 0 ? (deathAges.reduce((a, b) => a + b, 0) / deathAges.length).toFixed(1) : null;

  // distribution of death age in weeks (rounded)
  const ageBuckets = {};
  deathAges.forEach((w) => {
    const bucket = Math.floor(w);
    ageBuckets[bucket] = (ageBuckets[bucket] || 0) + 1;
  });
  const ageData = Object.entries(ageBuckets).map(([w, count]) => ({
    week: `${w}w`,
    count,
    pct: ((count / totalDeaths) * 100).toFixed(0),
  })).sort((a, b) => parseInt(a.week) - parseInt(b.week));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total Birds Started" value={totalStart} accent={palette.feather} />
        <StatCard label="Total Butchered" value={totalButchered} accent={palette.ink} />
        <StatCard label="Mortality Rate" value={`${mortalityRate}%`} sub={`${totalDeaths} deaths`} accent={palette.accent} />
        <StatCard label="Avg Final Weight" value={`${avgWeight} lbs`} accent={palette.leaf} />
        <StatCard label="Cost / Bird" value={typeof costPerBird === "string" ? costPerBird : fmtMoney(costPerBird)} sub="all-in" accent={palette.yolk} />
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} sub={`feed ${fmtMoney(totalFeedCost)}${totalInfraCost > 0 ? " + infra " + fmtMoney(totalInfraCost) : ""}`} accent={palette.feather} />
      </div>

      {(totalChickCost > 0 || totalInfraCost > 0) && (
        <ChartCard title="📊 Cost breakdown">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {totalChickCost > 0 && <CostRow label="Chicks" value={totalChickCost} total={totalCost} />}
            <CostRow label="Feed" value={totalFeedCost} total={totalCost} />
            {totalInfraCost > 0 && <CostRow label="Infrastructure" value={totalInfraCost} total={totalCost} />}
            <div style={{
              display: "flex", justifyContent: "space-between", padding: "10px 12px",
              background: palette.ink, color: palette.bg, borderRadius: 6, marginTop: 4, fontWeight: 600,
            }}>
              <span>Total</span>
              <span>{fmtMoney(totalCost)}</span>
            </div>
          </div>
        </ChartCard>
      )}

      {leadingCause && (
        <div style={{
          background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Leading cause of death
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.yolk, marginTop: 4 }}>
            {leadingCause[0]} <span style={{ fontSize: 14, color: palette.bg, opacity: 0.7 }}>({leadingCause[1]} of {totalDeaths})</span>
          </div>
          {avgDeathAge && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Avg age at death: {avgDeathAge} weeks
            </div>
          )}
        </div>
      )}

      {ageData.length > 0 && (
        <ChartCard title="Deaths by age (weeks old)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ageData}>
              <XAxis dataKey="week" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip
                contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }}
                formatter={(v, n, p) => [`${v} (${p.payload.pct}%)`, "deaths"]}
              />
              <Bar dataKey="count" fill={palette.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title={`Batches ${seasonFilter === "all" ? "(all-time)" : "(" + seasonFilter + ")"}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map((b) => {
            const bd = (b.butchered || []).reduce((s, x) => s + (x.count || 0), 0);
            const bDeaths = (b.finalEntries || [])
              .filter((e) => e.action === "death")
              .reduce((s, e) => s + (Number(e.count) || 1), 0);
            return (
              <div key={b.id} style={{
                padding: "10px 12px", background: palette.bgAlt, borderRadius: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6,
              }}>
                <div>
                  <strong>{b.name}</strong>
                  {b.isActive && <span style={{ background: palette.yolk, color: palette.ink, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>ACTIVE</span>}
                  <div style={{ fontSize: 12, color: palette.inkSoft }}>
                    Started {fmtDate(b.startDate)} · {b.startCount} birds
                  </div>
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, textAlign: "right" }}>
                  {bd > 0 && <div>{bd} butchered</div>}
                  {bDeaths > 0 && <div>{bDeaths} deaths</div>}
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
      borderRadius: 12, textAlign: "center", color: palette.inkSoft,
    }}>
      {text}
    </div>
  );
}

// ============ MODAL ROUTER & FORMS ============
function ModalRouter({ modal, setModal, data, update, activeHobby, user }) {
  const close = () => setModal(null);
  if (!modal) return null;

  const hobby = data.hobbies.find((h) => h.id === activeHobby);

  if (modal.type === "settings") return <SettingsModal data={data} update={update} onClose={close} setModal={setModal} user={user} />;
  if (modal.type === "renameHomestead") return <RenameHomesteadModal data={data} update={update} onClose={close} />;
  if (modal.type === "feedback") return <FeedbackModal onClose={close} presetCategory={modal.presetCategory} />;
  if (modal.type === "signin") return <AuthModal onClose={close} initialMode="signin" />;
  if (modal.type === "signup") return <AuthModal onClose={close} initialMode="signup" />;
  if (modal.type === "addHobby") return <AddHobbyModal update={update} onClose={close} />;
  if (modal.type === "addBirds") return <AddBirdsModal hobby={hobby} update={update} onClose={close} />;
  if (modal.type === "hatchBatch") return <HatchBatchModal hobby={hobby} update={update} onClose={close} />;
  if (modal.type === "butcher") return <ButcherModal hobby={hobby} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "startGardenSeason") return <StartGardenSeasonModal hobby={hobby} update={update} onClose={close} />;
  if (modal.type === "closeGardenSeason") return <CloseGardenSeasonModal hobby={hobby} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "log") return <LogModal hobby={hobby} action={modal.action} data={data} update={update} onClose={close} />;
  return null;
}

function SettingsModal({ data, update, onClose, setModal, user }) {
  const [showReset, setShowReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out failed", e);
    }
    setSigningOut(false);
    onClose();
  };

  const SectionBtn = ({ icon: Icon, label, sub, onClick, accent = palette.ink }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "14px 14px", marginBottom: 8,
        background: palette.card, border: `1.5px solid ${palette.line}`,
        borderRadius: 10, cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "2px 2px 0 " + palette.line,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: palette.bgAlt,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={1.8} color={accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
    </button>
  );

  return (
    <Modal open onClose={onClose} title="Settings">
      <SectionBtn
        icon={Edit3}
        label="Name your homestead"
        sub={data.homesteadName || "Untitled"}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "renameHomestead" }), 0); }}
      />

      {user ? (
        <>
          <div style={{
            padding: "14px 14px", marginBottom: 8,
            background: palette.card, border: `1.5px solid ${palette.line}`,
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "2px 2px 0 " + palette.line,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: palette.leafSoft,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <UserCircle size={18} strokeWidth={1.8} color={palette.ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>Signed in</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            </div>
          </div>

          <SectionBtn
            icon={LogOut}
            label={signingOut ? "Signing out..." : "Sign out"}
            sub="You'll need to sign back in to access your account"
            accent={palette.accent}
            onClick={signingOut ? () => {} : handleSignOut}
          />
        </>
      ) : (
        <SectionBtn
          icon={UserCircle}
          label="Sign in or create account"
          sub={isSupabaseConfigured ? "Save your homestead with an account" : "Coming soon"}
          accent={palette.leaf}
          onClick={() => { onClose(); setTimeout(() => setModal({ type: "signin" }), 0); }}
        />
      )}

      <SectionBtn
        icon={Lightbulb}
        label="How can I improve?"
        sub="Send the maker your ideas"
        accent={palette.yolk}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "feedback" }), 0); }}
      />

      <div style={{
        marginTop: 16, padding: 12, background: palette.bgAlt, borderRadius: 8,
        fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        <strong style={{ color: palette.ink }}>Privacy:</strong> {user
          ? "Your account email is stored only for support and account recovery. Your homestead data still saves locally to this browser for now — cross-device sync is coming soon. Nothing is shared or sold."
          : "Your data is saved only to your own browser right now. Nothing is shared or sold. When you sign in, your email is used only for support — never sold or shared."}
      </div>

      {!showReset ? (
        <button
          onClick={() => setShowReset(true)}
          style={{
            marginTop: 14, background: "none", border: "none",
            color: palette.inkSoft, fontSize: 12, cursor: "pointer",
            textDecoration: "underline", padding: 4,
          }}
        >
          Reset all data
        </button>
      ) : (
        <div style={{ marginTop: 14, padding: 12, background: palette.card, borderRadius: 8, border: `1.5px solid ${palette.accent}` }}>
          <div style={{ fontSize: 13, marginBottom: 10, color: palette.accent, fontWeight: 600 }}>
            This will delete everything. Are you sure?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="danger" small onClick={async () => {
              try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
              const fresh = defaultData();
              update(() => fresh);
              onClose();
            }}>Yes, reset</Btn>
            <Btn variant="ghost" small onClick={() => setShowReset(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RenameHomesteadModal({ data, update, onClose }) {
  const [name, setName] = useState(data.homesteadName || "");
  return (
    <Modal open onClose={onClose} title="Name your homestead">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14 }}>
        Give your place a name. It'll show at the top of every page.
      </div>
      <Field label="Homestead name">
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Slow Build Acres, Willow Creek Farm..."
          autoFocus
          maxLength={40}
        />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={() => {
          update((d) => { d.homesteadName = name.trim(); return d; });
          onClose();
        }}>Save name</Btn>
        {data.homesteadName && (
          <Btn variant="ghost" onClick={() => {
            update((d) => { d.homesteadName = ""; return d; });
            onClose();
          }}>Clear</Btn>
        )}
      </div>
    </Modal>
  );
}

function FeedbackModal({ onClose, presetCategory }) {
  const isHobbyRequest = presetCategory === "hobby";
  const [message, setMessage] = useState(
    isHobbyRequest
      ? "I'd love to see this hobby added:\n\n(Hobby name)\n\nWhat I'd want to track:\n- \n- \n- "
      : ""
  );
  const [category, setCategory] = useState(presetCategory || "idea");
  const [copied, setCopied] = useState(false);

  const subject = `Homestead app feedback: ${category}`;
  const body = `Category: ${category}\n\n${message}\n\n---\nSent from the Homestead Tracker app.`;
  const mailtoHref = `mailto:slowbuildacres@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=slowbuildacres@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyMessage = async () => {
    const text = `To: slowbuildacres@gmail.com\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e2) {}
      document.body.removeChild(ta);
    }
  };

  const linkStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "10px 14px", borderRadius: 8, textDecoration: "none",
    fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
    boxShadow: "2px 2px 0 " + palette.line, cursor: "pointer",
  };

  return (
    <Modal open onClose={onClose} title={isHobbyRequest ? "Request a hobby" : "How can I improve?"}>
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        <Heart size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        {isHobbyRequest
          ? <>What hobby would you like to see added? Tell me what you'd want to track and I'll work on adding it. Your message goes to <strong>slowbuildacres@gmail.com</strong>.</>
          : <>Got an idea, bug, or feature request? Pick how you'd like to send it — your message goes to <strong>slowbuildacres@gmail.com</strong>.</>
        }
      </div>

      <Field label="Type of feedback">
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="idea">💡 New idea</option>
          <option value="bug">🐛 Bug report</option>
          <option value="hobby">🌱 New hobby/category request</option>
          <option value="other">💬 Other</option>
        </select>
      </Field>

      <Field label="Your message">
        <textarea
          style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would make this app better for you?"
          autoFocus
        />
      </Field>

      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
        Send via
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a
          href={message.trim() ? gmailHref : "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!message.trim()) e.preventDefault(); }}
          style={{
            ...linkStyle,
            background: message.trim() ? palette.ink : palette.line,
            color: palette.bg,
            border: `1.5px solid ${palette.ink}`,
            opacity: message.trim() ? 1 : 0.5,
            pointerEvents: message.trim() ? "auto" : "none",
          }}
        >
          <Mail size={14} /> Open in Gmail
        </a>

        <a
          href={message.trim() ? mailtoHref : "#"}
          onClick={(e) => { if (!message.trim()) e.preventDefault(); }}
          style={{
            ...linkStyle,
            background: message.trim() ? palette.yolk : palette.line,
            color: palette.ink,
            border: `1.5px solid ${palette.ink}`,
            opacity: message.trim() ? 1 : 0.5,
            pointerEvents: message.trim() ? "auto" : "none",
          }}
        >
          <Mail size={14} /> Open mail app
        </a>

        <button
          onClick={copyMessage}
          disabled={!message.trim()}
          style={{
            ...linkStyle,
            background: copied ? palette.leafSoft : "transparent",
            color: palette.ink,
            border: `1.5px solid ${palette.line}`,
            opacity: message.trim() ? 1 : 0.5,
            cursor: message.trim() ? "pointer" : "not-allowed",
          }}
        >
          {copied ? "✓ Copied!" : "Copy text"}
        </button>
      </div>

      <div style={{
        fontSize: 11, color: palette.inkSoft, lineHeight: 1.5,
        padding: 10, background: palette.bgAlt, borderRadius: 6, marginBottom: 12,
      }}>
        <strong>Tip:</strong> "Open in Gmail" works best in browsers. "Open mail app" uses your phone or computer's default mail app. Or just tap "Copy text" and paste it into any email.
      </div>

      <div style={{ fontSize: 11, color: palette.inkSoft, fontStyle: "italic" }}>
        Your email is only used to read & reply to your feedback — never shared.
      </div>
    </Modal>
  );
}

function AddHobbyModal({ update, onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("garden");
  return (
    <Modal open onClose={onClose} title="Add a hobby">
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bees, Goats" />
      </Field>
      <Field label="Behavior template">
        <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="garden">Like Garden (planting/harvest)</option>
          <option value="egg_layers">Like Egg Layers (ongoing flock)</option>
          <option value="meat_chickens">Like Meat Chickens (seasonal batches)</option>
          <option value="custom">Custom (just notes)</option>
        </select>
      </Field>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update((d) => {
          const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + newId().slice(0, 4);
          const newHobby = { id, name: name.trim(), type, icon: "sprout" };
          if (type === "egg_layers") { newHobby.flockSize = 0; newHobby.flockHistory = []; }
          if (type === "meat_chickens") { newHobby.currentBatch = null; newHobby.archivedBatches = []; }
          d.hobbies.push(newHobby);
          return d;
        });
        onClose();
      }}>Add hobby</Btn>
    </Modal>
  );
}

function AddBirdsModal({ hobby, update, onClose }) {
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  return (
    <Modal open onClose={onClose} title="Add birds to flock">
      <Field label="How many birds?">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Date acquired">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <Btn variant="primary" onClick={() => {
        const n = parseInt(count);
        if (!n || n < 1) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          h.flockSize = (h.flockSize || 0) + n;
          h.flockHistory = h.flockHistory || [];
          h.flockHistory.push({ date, count: n, cost: parseFloat(cost) || 0 });
          return d;
        });
        onClose();
      }}>Add {count || "0"} birds</Btn>
    </Modal>
  );
}

function HatchBatchModal({ hobby, update, onClose }) {
  const [name, setName] = useState(`Batch ${(hobby.archivedBatches || []).length + 1}`);
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  return (
    <Modal open onClose={onClose} title="🐣 Hatch new batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Number of chicks">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost of chicks (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Btn variant="primary" onClick={() => {
        const n = parseInt(count);
        if (!n || n < 1 || !name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          h.currentBatch = {
            id: newId(),
            name: name.trim(),
            startDate: date,
            startCount: n,
            chickCost: parseFloat(cost) || 0,
          };
          return d;
        });
        onClose();
      }}>Start batch</Btn>
    </Modal>
  );
}

function ButcherModal({ hobby, entries, update, onClose }) {
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [showFinalize, setShowFinalize] = useState(false);
  const batch = hobby.currentBatch;

  if (!batch) {
    return (
      <Modal open onClose={onClose} title="Butcher">
        <div>No active batch. Hatch one first.</div>
      </Modal>
    );
  }

  const deaths = entries
    .filter((e) => e.action === "death" && e.batchId === batch.id)
    .reduce((s, e) => s + (Number(e.count) || 1), 0);
  const previouslyButchered = (hobby.currentBatch.butchered || []).reduce((s, x) => s + (x.count || 0), 0);
  const remaining = batch.startCount - deaths - previouslyButchered;

  return (
    <Modal open onClose={onClose} title={showFinalize ? "Send to freezer camp?" : `Butcher · ${batch.name}`}>
      {!showFinalize ? (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
            {remaining} birds remaining in this batch.
          </div>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="How many butchered?">
            <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Average weight (lbs)">
            <input type="number" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={() => {
              const n = parseInt(count);
              const w = parseFloat(avgWeight);
              if (!n || !w) return;
              update((d) => {
                const h = d.hobbies.find((x) => x.id === hobby.id);
                h.currentBatch.butchered = h.currentBatch.butchered || [];
                h.currentBatch.butchered.push({ date, count: n, avgWeight: w });
                d.entries[hobby.id] = d.entries[hobby.id] || [];
                d.entries[hobby.id].push({
                  id: newId(), date, action: "butcher", count: n, avgWeight: w,
                  batchId: batch.id, created: Date.now(),
                });
                return d;
              });
              setCount(""); setAvgWeight("");
              onClose();
            }}>Save butcher entry</Btn>
            <Btn variant="accent" onClick={() => setShowFinalize(true)}>❄️ Send to freezer camp</Btn>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: palette.bgAlt, borderRadius: 8, fontSize: 14 }}>
            This will <strong>finalize {batch.name}</strong>, archive its data to analytics, and clear the dashboard so you can hatch a new batch.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="danger" onClick={() => {
              update((d) => {
                const h = d.hobbies.find((x) => x.id === hobby.id);
                const finalBatch = JSON.parse(JSON.stringify(h.currentBatch));
                finalBatch.endDate = todayStr();
                // attach all entries that belong to this batch
                finalBatch.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.batchId === batch.id);
                h.archivedBatches = h.archivedBatches || [];
                h.archivedBatches.push(finalBatch);
                // remove batch entries from active log
                d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.batchId !== batch.id);
                h.currentBatch = null;
                return d;
              });
              onClose();
            }}>Yes, finalize batch</Btn>
            <Btn variant="ghost" onClick={() => setShowFinalize(false)}>Back</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ============ GARDEN SEASON MODALS ============
function StartGardenSeasonModal({ hobby, update, onClose }) {
  const guess = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    if (m >= 1 && m <= 5) return `Spring ${y}`;
    if (m >= 6 && m <= 8) return `Summer ${y}`;
    if (m >= 9 && m <= 10) return `Fall ${y}`;
    return `Winter ${y}`;
  })();
  const [name, setName] = useState(guess);
  const [date, setDate] = useState(todayStr());

  return (
    <Modal open onClose={onClose} title="🌱 Start new garden season">
      <Field label="Season name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring 2026" />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 14 }}>
        Plantings, harvests, waterings, issues, and notes you log during this season will be archived together when you close it out.
      </div>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          h.currentSeason = {
            id: newId(),
            name: name.trim(),
            startDate: date,
          };
          return d;
        });
        onClose();
      }}>Start season</Btn>
    </Modal>
  );
}

function CloseGardenSeasonModal({ hobby, entries, update, onClose }) {
  const season = hobby.currentSeason;
  if (!season) {
    return (
      <Modal open onClose={onClose} title="Close season">
        <div>No active season.</div>
      </Modal>
    );
  }
  const seasonEntries = entries.filter((e) => e.seasonId === season.id);
  const harvests = seasonEntries.filter((e) => e.action === "harvested");
  const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalCost = seasonEntries.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <Modal open onClose={onClose} title={`Close out ${season.name}?`}>
      <div style={{
        padding: 12, background: palette.bgAlt, borderRadius: 8,
        marginBottom: 14, fontSize: 14, lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: 6 }}>
          <strong>Season summary:</strong>
        </div>
        <div style={{ fontSize: 13, color: palette.inkSoft }}>
          {seasonEntries.length} entries · {harvests.length} harvests · {totalHarvest.toFixed(1)} total yield · {fmtMoney(totalCost)} costs
        </div>
      </div>

      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        Closing the season archives all entries to your analytics and clears the dashboard. You can start a new season after.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="danger" onClick={() => {
          update((d) => {
            const h = d.hobbies.find((x) => x.id === hobby.id);
            const finalSeason = JSON.parse(JSON.stringify(h.currentSeason));
            finalSeason.endDate = todayStr();
            // attach all entries that belong to this season
            finalSeason.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.seasonId === season.id);
            h.archivedSeasons = h.archivedSeasons || [];
            h.archivedSeasons.push(finalSeason);
            // remove season entries from active log
            d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.seasonId !== season.id);
            h.currentSeason = null;
            return d;
          });
          onClose();
        }}>Yes, close season</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ============ LOG MODAL (DIFFERENT BY ACTION) ============
function LogModal({ hobby, action, data, update, onClose }) {
  const [date, setDate] = useState(todayStr());
  const [fields, setFields] = useState({});

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  const submit = () => {
    // Coerce numeric fields from string inputs to actual numbers
    const numericKeys = ["quantity", "cost", "lbs", "gallons", "count", "cuft", "avgWeight", "pricePerDozen"];
    const cleanFields = { ...fields };
    numericKeys.forEach((k) => {
      if (cleanFields[k] !== undefined && cleanFields[k] !== "") {
        const n = parseFloat(cleanFields[k]);
        cleanFields[k] = isNaN(n) ? 0 : n;
      }
    });

    update((d) => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const entry = { id: newId(), date, action, created: Date.now(), ...cleanFields };

      // attach to current batch for meat chickens
      if (hobby.type === "meat_chickens" && hobby.currentBatch) {
        entry.batchId = hobby.currentBatch.id;
      }

      // attach to current season for garden
      if (hobby.type === "garden") {
        const h = d.hobbies.find((x) => x.id === hobby.id);
        if (h && h.currentSeason) {
          entry.seasonId = h.currentSeason.id;
        }
      }

      // garden planting -> create planting record
      if (action === "planted" && cleanFields.plant) {
        d.plantings = d.plantings || [];
        d.plantings.push({
          id: newId(), plant: cleanFields.plant, quantity: cleanFields.quantity,
          date, harvested: false,
        });
      }

      // egg layer death decrements flock by the quantity (default 1)
      if (action === "death" && hobby.type === "egg_layers") {
        const h = d.hobbies.find((x) => x.id === hobby.id);
        const n = Math.max(1, Number(cleanFields.count) || 1);
        h.flockSize = Math.max(0, (h.flockSize || 0) - n);
      }

      d.entries[hobby.id].push(entry);
      return d;
    });
    onClose();
  };

  const titles = {
    watered: "Log watering", planted: "Log planting", harvested: "Log harvest",
    issue: "Report issue", fed: "Log feed", free_range: "Log free-range",
    eggs: "Log eggs collected", bedding: "Log bedding change", death: "Report death",
    note: "Add a note", butcher: "Butcher",
    sold_eggs: "Log eggs sold", infrastructure: "Log infrastructure",
  };

  // existing plant names from history (for the autocomplete-ish helper)
  const plants = Array.from(new Set((data.plantings || []).map((p) => p.plant).filter(Boolean)));

  return (
    <Modal open onClose={onClose} title={titles[action] || "Log entry"}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {action === "watered" && hobby.type === "garden" && (
        <Field label="Notes (amount, beds, etc.)">
          <input style={inputStyle} value={fields.amount || ""} onChange={(e) => set("amount", e.target.value)} placeholder="e.g. soaked all beds" />
        </Field>
      )}

      {action === "watered" && hobby.type !== "garden" && (
        <Field label="Gallons">
          <input type="number" step="0.1" style={inputStyle} value={fields.gallons || ""} onChange={(e) => set("gallons", e.target.value)} />
        </Field>
      )}

      {action === "planted" && (
        <>
          <Field label="Plant / crop">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} placeholder="Tomato, Kale..." />
            <datalist id="plant-list">{plants.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="How many">
            <input type="number" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Bed / location (optional)">
            <input style={inputStyle} value={fields.bed || ""} onChange={(e) => set("bed", e.target.value)} />
          </Field>
          <Field label="Cost (seeds, soil — optional)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "harvested" && (
        <>
          <Field label="Plant / crop">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} placeholder="Tomato, Kale..." />
            <datalist id="plant-list">{plants.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Quantity">
            <input type="number" step="0.01" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Unit">
            <select style={inputStyle} value={fields.unit || "lbs"} onChange={(e) => set("unit", e.target.value)}>
              <option value="lbs">lbs</option>
              <option value="oz">oz</option>
              <option value="count">count</option>
              <option value="bunch">bunches</option>
            </select>
          </Field>
        </>
      )}

      {action === "issue" && (
        <>
          <Field label="Type">
            <select style={inputStyle} value={fields.issueType || "disease"} onChange={(e) => set("issueType", e.target.value)}>
              <option value="disease">Disease</option>
              <option value="pest">Pest</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Plant affected (optional)">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} />
          </Field>
          <Field label="Specific (e.g. powdery mildew, aphids)">
            <input style={inputStyle} value={fields.detail || ""} onChange={(e) => set("detail", e.target.value)} />
          </Field>
          <Field label="Notes / solution">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="What you'll try..." />
          </Field>
        </>
      )}

      {action === "fed" && (
        <>
          <Field label="Pounds of feed">
            <input type="number" step="0.1" style={inputStyle} value={fields.lbs || ""} onChange={(e) => set("lbs", e.target.value)} />
          </Field>
          <Field label="Cost of bag (or this feeding)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "free_range" && (
        <Field label="Notes (optional)">
          <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. 4 hours in pasture" />
        </Field>
      )}

      {action === "eggs" && (
        <Field label="Eggs collected">
          <input type="number" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} />
        </Field>
      )}

      {action === "bedding" && (
        <>
          <Field label="Type of change">
            <select style={inputStyle} value={fields.changeType || "Partial"} onChange={(e) => set("changeType", e.target.value)}>
              <option value="Full">Full clean-out</option>
              <option value="Partial">Partial / topped up</option>
            </select>
          </Field>
          <Field label="Cubic feet of bedding">
            <input type="number" step="0.1" style={inputStyle} value={fields.cuft || ""} onChange={(e) => set("cuft", e.target.value)} />
          </Field>
          <Field label="Cost">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "death" && (
        <>
          <Field label="How many died?">
            <input type="number" min="1" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} placeholder="1" />
          </Field>
          <Field label="Cause / reason (optional)">
            <input style={inputStyle} value={fields.cause || ""} onChange={(e) => set("cause", e.target.value)} placeholder="predator, illness, unknown..." />
          </Field>
        </>
      )}

      {action === "sold_eggs" && (
        <>
          <Field label="Number of eggs sold">
            <input type="number" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} placeholder="e.g. 24 (= 2 dozen)" />
          </Field>
          <Field label="Price per dozen ($)">
            <input type="number" step="0.01" style={inputStyle} value={fields.pricePerDozen || ""} onChange={(e) => set("pricePerDozen", e.target.value)} placeholder="e.g. 6.00" />
          </Field>
          <Field label="Sold to / notes (optional)">
            <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="neighbor, farmer's market..." />
          </Field>
          {fields.count && fields.pricePerDozen && (
            <div style={{
              padding: 10, background: palette.yolkSoft, borderRadius: 6,
              fontSize: 13, color: palette.ink, marginBottom: 14, textAlign: "center",
            }}>
              Revenue: <strong>{fmtMoney(((Number(fields.count) || 0) / 12) * (Number(fields.pricePerDozen) || 0))}</strong>
            </div>
          )}
        </>
      )}

      {action === "infrastructure" && (
        <>
          <Field label="What was built / repaired / bought?">
            <input style={inputStyle} value={fields.item || ""} onChange={(e) => set("item", e.target.value)} placeholder="new coop, run extension, fencing..." />
          </Field>
          <Field label="Cost ($)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="materials, who built it, etc." />
          </Field>
        </>
      )}

      {action === "note" && (
        <Field label="Note">
          <textarea style={{ ...inputStyle, minHeight: 100 }} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="Anything you want to remember about this hobby..." autoFocus />
        </Field>
      )}

      <Btn variant="primary" onClick={submit}>Save entry</Btn>
    </Modal>
  );
}
