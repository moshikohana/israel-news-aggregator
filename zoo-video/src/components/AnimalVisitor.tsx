import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface AnimalVisitorProps {
  animal: string;
  name: string;
  startFrame: number;
  x: number;
  y: number;
  walkToX?: number;
  hat?: boolean;
}

export const AnimalVisitor: React.FC<AnimalVisitorProps> = ({
  animal,
  name,
  startFrame,
  x,
  y,
  walkToX,
  hat = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const walkProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });

  const currentX = walkToX
    ? interpolate(walkProgress, [0, 1], [x, walkToX])
    : x;

  const opacity = interpolate(frame - startFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const walkBounce =
    frame >= startFrame ? Math.sin((frame - startFrame) * 0.4) * 3 : 0;

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: currentX,
        top: y + walkBounce,
        opacity,
        textAlign: "center",
      }}
    >
      {/* Tourist hat */}
      {hat && (
        <div
          style={{
            fontSize: 28,
            lineHeight: 1,
            marginBottom: -8,
            filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.3))",
          }}
        >
          🎩
        </div>
      )}

      {/* Animal emoji */}
      <div
        style={{
          fontSize: 64,
          lineHeight: 1,
          filter: "drop-shadow(2px 2px 3px rgba(0,0,0,0.3))",
        }}
      >
        {animal}
      </div>

      {/* Tourist camera */}
      <div style={{ fontSize: 22, marginTop: -8 }}>📷</div>

      {/* Name tag */}
      <div
        style={{
          background: "#FFF9C4",
          border: "2px solid #F9A825",
          borderRadius: 8,
          padding: "3px 8px",
          fontSize: 14,
          fontWeight: "bold",
          color: "#333",
          marginTop: 4,
          fontFamily: "Arial, sans-serif",
          direction: "rtl",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </div>
    </div>
  );
};
