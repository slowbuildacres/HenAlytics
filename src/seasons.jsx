// ============================================================================
// SEASONAL DECORATIONS
// ----------------------------------------------------------------------------
// Subtle ambient animations that match the current season:
//   - Spring: wildflowers grow up from the bottom edge
//   - Summer: no decoration (parchment already feels summery)
//   - Fall: leaves drift down from the top
//   - Winter: snowflakes drift down
//
// All decorations are pointer-events: none so they never interfere with taps.
// They're rendered behind everything else (low z-index, inside the app
// container with the main content layered above).
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { getCurrentHemisphere } from "./units.js";

// Get the current season based on month. Defaults to Northern hemisphere
// mapping when no hemisphere argument is provided (existing call sites that
// pre-date hemisphere support continue working). For Southern hemisphere users,
// pass "south" — the mapping is inverted (Jan = summer there, July = winter).
//
// Returns "spring" | "summer" | "fall" | "winter"
export function getSeason(now = new Date(), hemisphere) {
  const m = now.getMonth(); // 0 = Jan
  const h = hemisphere || "north";
  if (h === "south") {
    // Invert: their March is autumn, their July is winter, etc.
    if (m >= 2 && m <= 4) return "fall";
    if (m >= 5 && m <= 7) return "winter";
    if (m >= 8 && m <= 10) return "spring";
    return "summer";
  }
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

export function SeasonalDecorations() {
  // Read the user's hemisphere from the units module so Australia/NZ users
  // see flowers in November, not July.
  const season = getSeason(new Date(), getCurrentHemisphere());
  if (season === "summer") return null;
  if (season === "spring") return <SpringFlowers />;
  if (season === "fall") return <FallLeaves />;
  if (season === "winter") return <WinterSnow />;
  return null;
}

// ============================================================================
// SPRING — wildflowers growing up from the bottom
// ============================================================================
function SpringFlowers() {
  // Spawn 6 flower slots at random horizontal positions. Each one has its own
  // animation cycle that loops independently.
  const slots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      arr.push({
        id: i,
        leftPct: 5 + Math.random() * 90,        // 5-95% horizontal
        delay: Math.random() * 8,                // stagger so they don't all bloom in unison
        duration: 14 + Math.random() * 6,        // 14-20s full cycle
        type: ["pink", "white", "yellow", "sprout"][Math.floor(Math.random() * 4)],
        scale: 0.7 + Math.random() * 0.5,        // size variety
      });
    }
    return arr;
  }, []);

  return (
    <div style={overlayStyle} aria-hidden="true">
      <style>{springCss}</style>
      {slots.map((s) => (
        <div
          key={s.id}
          className="hen-flower-slot"
          style={{
            left: `${s.leftPct}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            transform: `translateX(-50%) scale(${s.scale})`,
          }}
        >
          {s.type === "sprout" ? <SproutShape /> : <FlowerShape color={s.type} />}
        </div>
      ))}
    </div>
  );
}

const springCss = `
  @keyframes hen-grow {
    0%   { transform: translateY(20px) scaleY(0); opacity: 0; }
    15%  { transform: translateY(0) scaleY(0.3); opacity: 0.5; }
    50%  { transform: translateY(0) scaleY(1); opacity: 0.7; }
    75%  { transform: translateY(0) scaleY(1); opacity: 0.7; }
    100% { transform: translateY(0) scaleY(1.05); opacity: 0; }
  }
  @keyframes hen-sway {
    0%, 100% { transform: rotate(-2deg); }
    50%      { transform: rotate(2deg); }
  }
  .hen-flower-slot {
    position: absolute;
    bottom: 70px; /* clear the bottom nav (~60px) plus a small gap */
    width: 30px;
    height: 60px;
    transform-origin: bottom center;
    animation: hen-grow linear infinite;
    pointer-events: none;
  }
  .hen-flower-slot > * {
    transform-origin: bottom center;
    animation: hen-sway 4s ease-in-out infinite;
  }
`;

function FlowerShape({ color }) {
  // Petal color palettes (soft, low-saturation)
  const palettes = {
    pink:   { petal: "#E8A8B8", center: "#E8B547" },
    white:  { petal: "#FAF5EA", center: "#E8B547" },
    yellow: { petal: "#F2D58A", center: "#C84B31" },
  };
  const c = palettes[color] || palettes.pink;
  return (
    <svg viewBox="0 0 30 60" width="30" height="60">
      {/* Stem */}
      <line x1="15" y1="60" x2="15" y2="22" stroke="#5A7A3C" strokeWidth="1.5" strokeLinecap="round" />
      {/* Leaf */}
      <ellipse cx="20" cy="38" rx="4" ry="2" fill="#5A7A3C" transform="rotate(30 20 38)" opacity="0.9" />
      {/* Flower petals */}
      <circle cx="15" cy="20" r="3.5" fill={c.petal} opacity="0.9" />
      <circle cx="11" cy="17" r="3" fill={c.petal} opacity="0.9" />
      <circle cx="19" cy="17" r="3" fill={c.petal} opacity="0.9" />
      <circle cx="12" cy="23" r="3" fill={c.petal} opacity="0.9" />
      <circle cx="18" cy="23" r="3" fill={c.petal} opacity="0.9" />
      {/* Center */}
      <circle cx="15" cy="20" r="1.8" fill={c.center} opacity="0.95" />
    </svg>
  );
}

function SproutShape() {
  return (
    <svg viewBox="0 0 30 60" width="30" height="60">
      <line x1="15" y1="60" x2="15" y2="32" stroke="#5A7A3C" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="22" cy="38" rx="5" ry="2.5" fill="#5A7A3C" transform="rotate(-25 22 38)" opacity="0.9" />
      <ellipse cx="8" cy="33" rx="5" ry="2.5" fill="#5A7A3C" transform="rotate(25 8 33)" opacity="0.9" />
    </svg>
  );
}

// ============================================================================
// FALL — leaves drifting down from the top
// ============================================================================
function FallLeaves() {
  const slots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push({
        id: i,
        leftPct: Math.random() * 100,
        delay: Math.random() * 12,
        duration: 14 + Math.random() * 10,
        color: ["#C84B31", "#E8A07A", "#E8B547", "#8B6F47"][Math.floor(Math.random() * 4)],
        rotateStart: Math.random() * 360,
        scale: 0.6 + Math.random() * 0.5,
      });
    }
    return arr;
  }, []);

  return (
    <div style={overlayStyle} aria-hidden="true">
      <style>{fallCss}</style>
      {slots.map((s) => (
        <div
          key={s.id}
          className="hen-leaf"
          style={{
            left: `${s.leftPct}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            transform: `scale(${s.scale}) rotate(${s.rotateStart}deg)`,
          }}
        >
          <LeafShape color={s.color} />
        </div>
      ))}
    </div>
  );
}

const fallCss = `
  @keyframes hen-fall {
    0%   { transform: translateY(-40px) translateX(0) rotate(0deg); opacity: 0; }
    8%   { opacity: 0.7; }
    100% { transform: translateY(110vh) translateX(40px) rotate(360deg); opacity: 0; }
  }
  .hen-leaf {
    position: absolute;
    top: 0;
    width: 24px;
    height: 24px;
    animation: hen-fall linear infinite;
    pointer-events: none;
  }
`;

function LeafShape({ color }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <path
        d="M12 2 C 6 8, 4 14, 12 22 C 20 14, 18 8, 12 2 Z"
        fill={color}
        opacity="0.85"
      />
      <line x1="12" y1="3" x2="12" y2="20" stroke="#2C1810" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

// ============================================================================
// WINTER — snowflakes drifting down
// ============================================================================
function WinterSnow() {
  const slots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        id: i,
        leftPct: Math.random() * 100,
        delay: Math.random() * 15,
        duration: 18 + Math.random() * 10,
        scale: 0.5 + Math.random() * 0.6,
        opacity: 0.4 + Math.random() * 0.3,
      });
    }
    return arr;
  }, []);

  return (
    <div style={overlayStyle} aria-hidden="true">
      <style>{winterCss}</style>
      {slots.map((s) => (
        <div
          key={s.id}
          className="hen-snowflake"
          style={{
            left: `${s.leftPct}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            transform: `scale(${s.scale})`,
            opacity: s.opacity,
            fontSize: 14,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

const winterCss = `
  @keyframes hen-snow {
    0%   { transform: translateY(-30px) translateX(0); }
    100% { transform: translateY(110vh) translateX(20px); }
  }
  .hen-snowflake {
    position: absolute;
    top: 0;
    color: #FAF5EA;
    text-shadow: 0 0 2px rgba(44,24,16,0.3);
    animation: hen-snow linear infinite;
    pointer-events: none;
    user-select: none;
  }
`;

// ============================================================================
// SHARED OVERLAY STYLE
// ============================================================================
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: "none",
  zIndex: 1, // above the dotted bg, below all content
  overflow: "hidden",
};

// ============================================================================
// TIME-OF-DAY ACCENT
// ----------------------------------------------------------------------------
// Returns a slightly-shifted accent color based on the time of day. The shift
// is intentional but subtle — never jarring.
// ============================================================================
export function getTimeOfDayAccent(now = new Date()) {
  const h = now.getHours();
  // Dawn (5-7): pale pink-orange
  if (h >= 5 && h < 7)  return "#F4C997";
  // Morning (7-11): standard yolk
  if (h >= 7 && h < 11) return "#E8B547";
  // Midday (11-15): bright golden yolk
  if (h >= 11 && h < 15) return "#F2C94C";
  // Afternoon (15-18): deeper amber
  if (h >= 15 && h < 18) return "#E0A030";
  // Evening (18-21): sunset orange
  if (h >= 18 && h < 21) return "#D88838";
  // Night (21-5): muted lamplight gold
  return "#B8893E";
}

// React hook that re-renders every 10 minutes so the accent stays current.
export function useTimeOfDayAccent() {
  const [color, setColor] = useState(() => getTimeOfDayAccent());
  useEffect(() => {
    const id = setInterval(() => setColor(getTimeOfDayAccent()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return color;
}
