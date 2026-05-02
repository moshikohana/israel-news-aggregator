import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SpeechBubbleProps {
  text: string;
  startFrame: number;
  style?: React.CSSProperties;
  thought?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  startFrame,
  style,
  thought = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });

  const opacity = interpolate(frame - startFrame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        background: "white",
        border: "3px solid #333",
        borderRadius: thought ? "50%" : "16px",
        padding: "12px 18px",
        maxWidth: 280,
        fontSize: 20,
        fontWeight: "bold",
        color: "#222",
        textAlign: "center",
        lineHeight: 1.4,
        boxShadow: "4px 4px 0px #333",
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "bottom left",
        fontFamily: "Arial, sans-serif",
        direction: "rtl",
        ...style,
      }}
    >
      {text}
      {!thought && (
        <div
          style={{
            position: "absolute",
            bottom: -18,
            left: 20,
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "18px solid #333",
          }}
        />
      )}
      {!thought && (
        <div
          style={{
            position: "absolute",
            bottom: -12,
            left: 23,
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "14px solid white",
          }}
        />
      )}
    </div>
  );
};
