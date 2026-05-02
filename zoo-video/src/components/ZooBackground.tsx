import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface ZooBackgroundProps {
  sceneLabel: string;
  startFrame: number;
}

export const ZooBackground: React.FC<ZooBackgroundProps> = ({
  sceneLabel,
  startFrame,
}) => {
  const frame = useCurrentFrame();

  const cloudX1 = interpolate(frame, [0, 300], [0, 60], {
    extrapolateRight: "wrap",
  });
  const cloudX2 = interpolate(frame, [0, 300], [0, -40], {
    extrapolateRight: "wrap",
  });

  const opacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
      }}
    >
      {/* Sky */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #87CEEB 0%, #B3E5FC 60%, #81C784 60%, #4CAF50 100%)",
        }}
      />

      {/* Sun */}
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 80,
          fontSize: 60,
          filter: "drop-shadow(0 0 20px rgba(255, 200, 0, 0.8))",
        }}
      >
        ☀️
      </div>

      {/* Clouds */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 80 + cloudX1,
          fontSize: 50,
          opacity: 0.8,
        }}
      >
        ☁️
      </div>
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 350 + cloudX2,
          fontSize: 40,
          opacity: 0.7,
        }}
      >
        ☁️
      </div>

      {/* Ground path */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: "#8D6E63",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 30,
          background: "#BCAAA4",
          borderRadius: 15,
        }}
      />

      {/* Trees */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 20,
          fontSize: 70,
          filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        }}
      >
        🌳
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 100,
          right: 20,
          fontSize: 60,
          filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        }}
      >
        🌴
      </div>

      {/* Scene label */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 24,
          background: "rgba(0,0,0,0.55)",
          color: "white",
          padding: "6px 16px",
          borderRadius: 20,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "Arial, sans-serif",
          direction: "rtl",
        }}
      >
        {sceneLabel}
      </div>
    </div>
  );
};
