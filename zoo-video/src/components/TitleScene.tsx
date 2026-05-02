import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.7 },
  });

  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const emojiScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #81C784 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Decorative animals */}
      <div
        style={{
          fontSize: 50,
          marginBottom: 16,
          transform: `scale(${frame > 15 ? emojiScale : 0})`,
          filter: "drop-shadow(3px 3px 6px rgba(0,0,0,0.4))",
        }}
      >
        🦁 🐘 🦒 🐧 🦓
      </div>

      {/* Main title */}
      <div
        style={{
          fontSize: 72,
          fontWeight: "900",
          color: "white",
          textAlign: "center",
          transform: `scale(${titleScale})`,
          textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
          direction: "rtl",
          lineHeight: 1.2,
          padding: "0 40px",
        }}
      >
        יום בגן החיות
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 32,
          color: "#FFEB3B",
          marginTop: 20,
          opacity: subtitleOpacity,
          textAlign: "center",
          direction: "rtl",
          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
          padding: "0 40px",
          fontWeight: "bold",
        }}
      >
        כשהמבקרים הם החיות...
      </div>

      {/* Bottom decoration */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          fontSize: 40,
          opacity: subtitleOpacity,
          filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        }}
      >
        🎟️ ברוכים הבאים! 🎟️
      </div>
    </div>
  );
};
