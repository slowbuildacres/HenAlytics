// ============================================================================
// LOADING SCENE — quick 500ms splash shown while app and auth initialize
// ============================================================================
import React, { useEffect, useState } from "react";

const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

export default function LoadingScene() {
  const [showEgg, setShowEgg] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Egg pops in after a tiny delay
    const eggTimer = setTimeout(() => setShowEgg(true), 180);
    return () => clearTimeout(eggTimer);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#F4EDE0",
      backgroundImage: "radial-gradient(#2C181012 0.5px, transparent 0.5px)",
      backgroundSize: "20px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT_BODY,
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.3s ease",
      zIndex: 9999,
    }}>

      {/* Chicken + egg */}
      <div style={{ position: "relative", marginBottom: 20, userSelect: "none" }}>
        {/* Chicken */}
        <div style={{
          fontSize: 72,
          lineHeight: 1,
          animation: "henBob 0.6s ease-in-out infinite alternate",
          display: "block",
          textAlign: "center",
        }}>
          🐔
        </div>

        {/* Egg — pops in with a bounce */}
        <div style={{
          fontSize: 36,
          textAlign: "center",
          marginTop: -4,
          transform: showEgg ? "scale(1)" : "scale(0)",
          opacity: showEgg ? 1 : 0,
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease",
          transformOrigin: "top center",
        }}>
          🥚
        </div>
      </div>

      {/* Wordmark */}
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 32,
        color: "#2C1810",
        letterSpacing: 0.5,
        marginBottom: 6,
        opacity: showEgg ? 1 : 0,
        transform: showEgg ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s",
      }}>
        HenAlytics
      </div>

      <div style={{
        fontSize: 12,
        color: "#5C4530",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        opacity: showEgg ? 0.7 : 0,
        transition: "opacity 0.3s ease 0.2s",
      }}>
        Your homestead, tracked
      </div>

      {/* Keyframe animation injected via style tag */}
      <style>{`
        @keyframes henBob {
          from { transform: translateY(0px) rotate(-2deg); }
          to   { transform: translateY(-6px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
