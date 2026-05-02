import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FinaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.6 },
  });

  const iconBounce = Math.sin(frame * 0.2) * 6;

  const textOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const animals = ["🦁", "🐘", "🦒", "🐧", "🐻"];
  const questions = ["?", "??", "???", "?!", "?!?"];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Animals looking confused */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 30,
          transform: `translateY(${iconBounce}px)`,
        }}
      >
        {animals.map((animal, i) => {
          const animalScale = spring({
            frame: frame - i * 5,
            fps,
            config: { damping: 10, stiffness: 200, mass: 0.5 },
          });
          return (
            <div
              key={i}
              style={{
                position: "relative",
                fontSize: 60,
                transform: `scale(${animalScale})`,
                filter: "drop-shadow(0 0 10px rgba(255,255,255,0.3))",
              }}
            >
              {animal}
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  right: -5,
                  fontSize: 20,
                  color: "#FFEB3B",
                  fontWeight: "900",
                }}
              >
                {questions[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main punchline */}
      <div
        style={{
          fontSize: 48,
          fontWeight: "900",
          color: "#FFEB3B",
          textAlign: "center",
          transform: `scale(${scale})`,
          textShadow: "3px 3px 6px rgba(0,0,0,0.7)",
          direction: "rtl",
          lineHeight: 1.3,
          padding: "0 40px",
          opacity: textOpacity,
        }}
      >
        "רגע... אנחנו גם חיות!"
      </div>

      <div
        style={{
          fontSize: 28,
          color: "#81C784",
          marginTop: 20,
          opacity: textOpacity,
          textAlign: "center",
          direction: "rtl",
          padding: "0 40px",
          lineHeight: 1.5,
        }}
      >
        הם עמדו שם ולא הבינו כלום...
        <br />
        בדיוק כמו שאנחנו לא מבינים אותם.
      </div>

      {/* Question mark explosion */}
      <div
        style={{
          position: "absolute",
          fontSize: 100,
          opacity: interpolate(frame, [0, 10], [0, 0.1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          }),
          color: "white",
        }}
      >
        ❓
      </div>
    </div>
  );
};
