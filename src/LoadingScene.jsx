// ============================================================================
// LOADING ANIMATION
// ----------------------------------------------------------------------------
// Charming hen + egg + chick scene that plays while data loads.
// SVG-only, no images. The whole sequence is keyframe-driven CSS.
//
// Sequence (8 seconds total, then loops):
//   0.0s — Hen sits on the nest (egg hidden under her)
//   2.0s — Hen stands up; egg becomes visible underneath
//   3.0s — Egg starts wiggling
//   4.0s — Egg cracks (top half lifts)
//   4.5s — Chick emerges from the egg
//   5.0s — Hen begins waddling off to the right
//   6.0s — Chick toddles after the hen
//   8.0s — Both off-screen; loop
// ============================================================================

import React from "react";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  card: "#FAF5EA", line: "#2C181030",
};

export default function LoadingScene({ message = "Loading homestead…" }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      background: palette.bg,
      backgroundImage: `radial-gradient(${palette.line} 0.5px, transparent 0.5px)`,
      backgroundSize: "20px 20px",
      padding: 20,
    }}>
      <style>{LOADING_CSS}</style>

      <svg
        viewBox="0 0 320 180"
        width="100%"
        style={{ maxWidth: 360, height: "auto" }}
        aria-hidden="true"
      >
        {/* Ground line */}
        <line x1="0" y1="160" x2="320" y2="160" stroke={palette.feather} strokeWidth="1.5" opacity="0.4" />

        {/* Nest (sits on the ground) */}
        <g className="hen-nest">
          <ellipse cx="120" cy="158" rx="42" ry="8" fill={palette.feather} opacity="0.6" />
          {/* Twigs */}
          <line x1="85" y1="158" x2="100" y2="148" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="100" y1="158" x2="115" y2="146" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="125" y1="146" x2="140" y2="158" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="140" y1="148" x2="155" y2="158" stroke={palette.feather} strokeWidth="1.5" />
        </g>

        {/* Egg — initially hidden, revealed at 2s, cracks at 4s, chick comes out at 4.5s */}
        <g className="hen-egg-group">
          {/* Whole egg */}
          <g className="hen-egg-whole">
            <ellipse cx="120" cy="148" rx="11" ry="14" fill={palette.card} stroke={palette.ink} strokeWidth="1.2" />
            {/* tiny shine */}
            <ellipse cx="116" cy="143" rx="2" ry="3" fill="#fff" opacity="0.7" />
          </g>

          {/* Cracked egg (revealed during crack phase) */}
          <g className="hen-egg-cracked">
            {/* Bottom half of shell */}
            <path
              d="M 109 148 Q 109 162 120 162 Q 131 162 131 148 L 130 146 L 127 149 L 122 144 L 117 149 L 113 145 L 110 148 Z"
              fill={palette.card} stroke={palette.ink} strokeWidth="1.2"
            />
            {/* Top half of shell — pops upward */}
            <g className="hen-egg-top">
              <path
                d="M 110 148 L 113 145 L 117 149 L 122 144 L 127 149 L 130 146 Q 131 138 120 134 Q 109 138 110 148 Z"
                fill={palette.card} stroke={palette.ink} strokeWidth="1.2"
              />
            </g>
          </g>

          {/* Chick — appears after egg cracks, then walks off after the hen */}
          <g className="hen-chick">
            <Chick />
          </g>
        </g>

        {/* Hen — sits on nest, then stands, then walks off */}
        <g className="hen-hen">
          <Hen />
        </g>
      </svg>

      <div style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 22,
        color: palette.ink,
        textAlign: "center",
      }}>
        {message}
      </div>
      <div style={{
        fontSize: 13,
        color: palette.inkSoft,
        textAlign: "center",
        fontStyle: "italic",
      }}>
        gathering your homestead's data…
      </div>
    </div>
  );
}

// ============================================================================
// HEN — drawn at "standing" position (around x=120, ground y=160).
// The CSS animation moves it through sit → stand → walk-off.
// ============================================================================
function Hen() {
  return (
    <g>
      {/* Body */}
      <ellipse cx="120" cy="135" rx="22" ry="18" fill={palette.feather} stroke={palette.ink} strokeWidth="1.5" />
      {/* Wing */}
      <ellipse cx="115" cy="135" rx="12" ry="10" fill={palette.featherSoft} stroke={palette.ink} strokeWidth="1.2" transform="rotate(-15 115 135)" />
      {/* Tail feathers */}
      <path d="M 138 130 L 152 122 L 150 132 L 154 138 L 144 138 Z" fill={palette.feather} stroke={palette.ink} strokeWidth="1.2" />
      {/* Head */}
      <circle cx="105" cy="118" r="10" fill={palette.feather} stroke={palette.ink} strokeWidth="1.5" />
      {/* Comb */}
      <path d="M 101 109 Q 99 104 102 105 Q 100 100 105 102 Q 104 98 108 101 L 108 110 Z" fill={palette.accent} stroke={palette.ink} strokeWidth="1" />
      {/* Beak */}
      <path d="M 96 119 L 91 121 L 96 122 Z" fill={palette.yolk} stroke={palette.ink} strokeWidth="1" />
      {/* Eye */}
      <circle cx="103" cy="116" r="1.5" fill={palette.ink} />
      {/* Wattle */}
      <path d="M 99 124 Q 97 128 100 128 Q 103 127 102 124 Z" fill={palette.accent} stroke={palette.ink} strokeWidth="0.8" />
      {/* Legs (only visible when standing) */}
      <g className="hen-legs">
        <line x1="115" y1="153" x2="115" y2="160" stroke={palette.ink} strokeWidth="1.5" />
        <line x1="125" y1="153" x2="125" y2="160" stroke={palette.ink} strokeWidth="1.5" />
        {/* feet */}
        <line x1="112" y1="160" x2="118" y2="160" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="122" y1="160" x2="128" y2="160" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
  );
}

// ============================================================================
// CHICK — small fluffy yellow ball with eye, beak, tiny legs.
// Drawn at the egg's position; CSS animation walks it off-screen.
// ============================================================================
function Chick() {
  return (
    <g>
      {/* Body */}
      <circle cx="120" cy="148" r="7" fill={palette.yolk} stroke={palette.ink} strokeWidth="1" />
      {/* Head fluff */}
      <circle cx="120" cy="143" r="5" fill={palette.yolkSoft} stroke={palette.ink} strokeWidth="1" />
      {/* Eye */}
      <circle cx="118" cy="142" r="1" fill={palette.ink} />
      {/* Beak */}
      <path d="M 115 144 L 112 145 L 115 146 Z" fill={palette.accent} stroke={palette.ink} strokeWidth="0.6" />
      {/* Tiny wing */}
      <ellipse cx="122" cy="148" rx="3" ry="2" fill={palette.yolkSoft} stroke={palette.ink} strokeWidth="0.6" />
      {/* Legs */}
      <line x1="118" y1="155" x2="118" y2="158" stroke={palette.ink} strokeWidth="0.8" />
      <line x1="122" y1="155" x2="122" y2="158" stroke={palette.ink} strokeWidth="0.8" />
    </g>
  );
}

// ============================================================================
// ANIMATIONS — total cycle 8 seconds
// ============================================================================
const LOADING_CSS = `
  /* HEN: sit (0-2s) → stand (2-3s) → wait (3-5s) → walk off (5-8s) */
  .hen-hen {
    transform-box: fill-box;
    transform-origin: center;
    animation: hen-sequence 8s ease-in-out infinite;
  }
  @keyframes hen-sequence {
    0%   { transform: translate(0, 8px) scaleY(0.85); }   /* sitting on nest */
    20%  { transform: translate(0, 8px) scaleY(0.85); }   /* still sitting */
    25%  { transform: translate(0, 0) scaleY(1); }         /* standing */
    62%  { transform: translate(0, 0) scaleY(1); }         /* still standing */
    63%  { transform: translate(2px, -1px) scaleY(1); }   /* step */
    65%  { transform: translate(8px, 0) scaleY(1); }
    67%  { transform: translate(14px, -1px) scaleY(1); }  /* step */
    100% { transform: translate(220px, -1px) scaleY(1); } /* off the right */
  }

  /* HEN LEGS: hidden while sitting */
  .hen-legs {
    opacity: 0;
    animation: hen-legs-show 8s ease-in-out infinite;
  }
  @keyframes hen-legs-show {
    0%, 22%   { opacity: 0; }
    25%, 100% { opacity: 1; }
  }

  /* EGG: hidden until hen stands (at 25%); revealed; then cracks at 50% */
  .hen-egg-whole {
    opacity: 0;
    animation: hen-egg-whole 8s ease-in-out infinite;
    transform-origin: 120px 148px;
  }
  @keyframes hen-egg-whole {
    0%, 26%   { opacity: 0; transform: scale(1); }
    27%, 36%  { opacity: 1; transform: scale(1); }
    /* tiny wiggle */
    38% { transform: rotate(-4deg); opacity: 1; }
    40% { transform: rotate(4deg); opacity: 1; }
    42% { transform: rotate(-3deg); opacity: 1; }
    44% { transform: rotate(0deg); opacity: 1; }
    50% { opacity: 1; }
    51% { opacity: 0; }
    100% { opacity: 0; }
  }

  /* CRACKED EGG: visible after the whole egg disappears */
  .hen-egg-cracked {
    opacity: 0;
    animation: hen-egg-cracked 8s ease-in-out infinite;
  }
  @keyframes hen-egg-cracked {
    0%, 50%  { opacity: 0; }
    51%, 80% { opacity: 1; }
    81%, 100% { opacity: 0; } /* fades out as chick walks away */
  }

  /* TOP HALF of cracked shell: pops up and rotates off */
  .hen-egg-top {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: hen-egg-top 8s ease-in-out infinite;
  }
  @keyframes hen-egg-top {
    0%, 50%  { transform: translateY(0) rotate(0deg); }
    52%      { transform: translateY(-6px) rotate(-15deg); }
    54%      { transform: translateY(-3px) rotate(20deg); }
    56%      { transform: translateY(-8px) rotate(-30deg); }
    100%     { transform: translateY(-8px) rotate(-30deg); opacity: 0; }
  }

  /* CHICK: pops out at 56%, waits, then waddles off after the hen */
  .hen-chick {
    opacity: 0;
    animation: hen-chick 8s ease-in-out infinite;
  }
  @keyframes hen-chick {
    0%, 55%  { opacity: 0; transform: translate(0, 8px) scale(0); }
    57%      { opacity: 1; transform: translate(0, -2px) scale(1.1); } /* pops up */
    60%      { transform: translate(0, 0) scale(1); }
    /* tiny bobs in place */
    65%      { transform: translate(0, -1px) scale(1); }
    68%      { transform: translate(0, 0) scale(1); }
    71%      { transform: translate(0, -1px) scale(1); }
    74%      { transform: translate(0, 0) scale(1); }
    /* now toddle after the hen, slower than her */
    80%      { transform: translate(20px, 0) scale(1); }
    90%      { transform: translate(80px, 0) scale(1); }
    100%     { transform: translate(220px, 0) scale(1); opacity: 1; }
  }
`;
