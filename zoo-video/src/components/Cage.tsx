import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CageProps {
  animal: string;
  animalName: string;
  sign: string;
  startFrame: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export const Cage: React.FC<CageProps> = ({
  animal,
  animalName,
  sign,
  startFrame,
  x,
  y,
  width = 200,
  height = 220,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
  });

  const translateX = interpolate(slideIn, [0, 1], [300, 0]);
  const opacity = interpolate(frame - startFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const bounce = Math.sin((frame - startFrame) * 0.15) * 4;

  if (frame < startFrame) return null;

  const barCount = 6;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {/* Sign above cage */}
      <div
        style={{
          background: "#8B4513",
          color: "white",
          padding: "6px 12px",
          borderRadius: "8px 8px 0 0",
          fontSize: 16,
          fontWeight: "bold",
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          direction: "rtl",
          border: "2px solid #5D2E0C",
          marginBottom: -2,
        }}
      >
        {sign}
      </div>

      {/* Cage container */}
      <div
        style={{
          width,
          height,
          background: "#e8f5e9",
          border: "3px solid #5D4037",
          borderRadius: "0 0 12px 12px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ground */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: "#A5D6A7",
            borderTop: "2px solid #66BB6A",
          }}
        />

        {/* Animal */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: `translateX(-50%) translateY(${bounce}px)`,
            fontSize: 56,
            textAlign: "center",
            filter: "drop-shadow(2px 2px 2px rgba(0,0,0,0.3))",
          }}
        >
          {animal}
        </div>

        {/* Cage bars overlay */}
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${(i / (barCount - 1)) * 90 + 5}%`,
              width: 6,
              height: "100%",
              background: "rgba(93, 64, 55, 0.75)",
              borderRadius: 3,
              zIndex: 10,
            }}
          />
        ))}

        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#5D4037",
            zIndex: 11,
          }}
        />
      </div>
    </div>
  );
};
