// ============================================================================
// LOADING ANIMATION
// ----------------------------------------------------------------------------
// Simple charming scene: hen sits on the nest, stands up to reveal an egg,
// then sits back down. 3-second cycle, loops.
// ============================================================================

import React from "react";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C",
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
        <line x1="0" y1="160" x2="320" y2="160" stroke={palette.feather} strokeWidth="1.5" opacity="0.4" />
        <g>
          <ellipse cx="160" cy="158" rx="42" ry="8" fill={palette.feather} opacity="0.6" />
          <line x1="125" y1="158" x2="140" y2="148" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="140" y1="158" x2="155" y2="146" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="165" y1="146" x2="180" y2="158" stroke={palette.feather} strokeWidth="1.5" />
          <line x1="180" y1="148" x2="195" y2="158" stroke={palette.feather} strokeWidth="1.5" />
        </g>
        <g className="hen-egg">
          <ellipse cx="160" cy="148" rx="11" ry="14" fill={palette.card} stroke={palette.ink} strokeWidth="1.2" />
          <ellipse cx="156" cy="143" rx="2" ry="3" fill="#fff" opacity="0.7" />
        </g>
        <g className="hen-hen">
          <ellipse cx="160" cy="135" rx="22" ry="18" fill={palette.feather} stroke={palette.ink} strokeWidth="1.5" />
          <ellipse cx="155" cy="135" rx="12" ry="10" fill={palette.featherSoft} stroke={palette.ink} strokeWidth="1.2" transform="rotate(-15 155 135)" />
          <path d="M 178 130 L 192 122 L 190 132 L 194 138 L 184 138 Z" fill={palette.feather} stroke={palette.ink} strokeWidth="1.2" />
          <circle cx="145" cy="118" r="10" fill={palette.feather} stroke={palette.ink} strokeWidth="1.5" />
          <path d="M 141 109 Q 139 104 142 105 Q 140 100 145 102 Q 144 98 148 101 L 148 110 Z" fill={palette.accent} stroke={palette.ink} strokeWidth="1" />
          <path d="M 136 119 L 131 121 L 136 122 Z" fill={palette.yolk} stroke={palette.ink} strokeWidth="1" />
          <circle cx="143" cy="116" r="1.5" fill={palette.ink} />
          <path d="M 139 124 Q 137 128 140 128 Q 143 127 142 124 Z" fill={palette.accent} stroke={palette.ink} strokeWidth="0.8" />
          <g className="hen-legs">
            <line x1="155" y1="153" x2="155" y2="160" stroke={palette.ink} strokeWidth="1.5" />
            <line x1="165" y1="153" x2="165" y2="160" stroke={palette.ink} strokeWidth="1.5" />
            <line x1="152" y1="160" x2="158" y2="160" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="162" y1="160" x2="168" y2="160" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" />
          </g>
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
    </div>
  );
}

const LOADING_CSS = `
  .hen-hen {
    transform-box: fill-box;
    transform-origin: center;
    animation: hen-sit-stand 3s ease-in-out infinite;
  }
  @keyframes hen-sit-stand {
    0%, 40% { transform: translateY(8px) scaleY(0.85); }
    55%, 80% { transform: translateY(0) scaleY(1); }
    100% { transform: translateY(8px) scaleY(0.85); }
  }
  .hen-legs {
    opacity: 0;
    animation: hen-legs-show 3s ease-in-out infinite;
  }
  @keyframes hen-legs-show {
    0%, 45% { opacity: 0; }
    55%, 80% { opacity: 1; }
    100% { opacity: 0; }
  }
  .hen-egg {
    opacity: 0;
    animation: hen-egg-reveal 3s ease-in-out infinite;
  }
  @keyframes hen-egg-reveal {
    0%, 50% { opacity: 0; }
    55%, 80% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
