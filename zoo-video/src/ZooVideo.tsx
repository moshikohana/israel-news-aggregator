import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { TitleScene } from "./components/TitleScene";
import { ZooBackground } from "./components/ZooBackground";
import { Cage } from "./components/Cage";
import { AnimalVisitor } from "./components/AnimalVisitor";
import { SpeechBubble } from "./components/SpeechBubble";
import { FinaleScene } from "./components/FinaleScene";

export const zooVideoMeta = {
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 30 * 28, // 28 seconds
};

const TITLE_DURATION = 90; // 3s
const SCENE1_START = TITLE_DURATION;
const SCENE1_DURATION = 150; // 5s
const SCENE2_START = SCENE1_START + SCENE1_DURATION;
const SCENE2_DURATION = 150; // 5s
const SCENE3_START = SCENE2_START + SCENE2_DURATION;
const SCENE3_DURATION = 150; // 5s
const SCENE4_START = SCENE3_START + SCENE3_DURATION;
const SCENE4_DURATION = 150; // 5s
const FINALE_START = SCENE4_START + SCENE4_DURATION;
const FINALE_DURATION = 90; // 3s

// Scene 1: Lion visitor looking at a caged deer 🦌
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ZooBackground sceneLabel="🦁 אריה בגן חיות" startFrame={0} />
      <Cage
        animal="🦌"
        animalName="צבי"
        sign="🦌 צבי"
        startFrame={10}
        x={680}
        y={200}
        width={220}
        height={240}
      />
      <AnimalVisitor
        animal="🦁"
        name="לאו - מבקר"
        startFrame={5}
        x={120}
        y={300}
        walkToX={380}
        hat
      />
      <SpeechBubble
        text="סליחה, למה הצבי הזה כלוא שם? מה הוא עשה? 🤔"
        startFrame={60}
        style={{ left: 160, top: 140 }}
      />
      <SpeechBubble
        text="שלט: 'צבי טבעי' - מה זה אומר בכלל?!"
        startFrame={100}
        style={{ left: 500, top: 120 }}
      />
    </AbsoluteFill>
  );
};

// Scene 2: Elephant visitor reading a sign about elephants
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ZooBackground sceneLabel="🐘 פיל בגן חיות" startFrame={0} />
      <Cage
        animal="🐘"
        animalName="פיל"
        sign="🐘 פיל אפריקאי"
        startFrame={10}
        x={660}
        y={180}
        width={240}
        height={260}
      />
      {/* Info sign */}
      <div
        style={{
          position: "absolute",
          left: 560,
          top: 490,
          background: "#795548",
          color: "white",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "Arial",
          direction: "rtl",
          border: "2px solid #5D4037",
          opacity: interpolate(frame, [15, 30], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          }),
        }}
      >
        🐘 פיל אפריקאי | בית גידול: ספרייה | מזון: עלים
      </div>
      <AnimalVisitor
        animal="🐘"
        name="אלי - מבקרת"
        startFrame={5}
        x={100}
        y={280}
        walkToX={350}
        hat
      />
      <SpeechBubble
        text="חכו רגע... זה נראה בדיוק כמוני!"
        startFrame={50}
        style={{ left: 130, top: 150 }}
      />
      <SpeechBubble
        text="הם שמים אותנו בכלובים ומכנים זה 'שמורת טבע'?! 😤"
        startFrame={95}
        style={{ left: 100, top: 100 }}
      />
    </AbsoluteFill>
  );
};

// Scene 3: Penguin visitor at a fish tank
const Scene3: React.FC = () => {
  return (
    <AbsoluteFill>
      <ZooBackground sceneLabel="🐧 פינגווין בגן חיות" startFrame={0} />
      {/* Fish tank */}
      <div
        style={{
          position: "absolute",
          left: 650,
          top: 150,
          width: 260,
          height: 300,
          background: "linear-gradient(180deg, #0288D1 0%, #01579B 100%)",
          border: "5px solid #37474F",
          borderRadius: "8px 8px 4px 4px",
          overflow: "hidden",
        }}
      >
        {/* Bubbles */}
        {[20, 60, 120, 180, 220].map((x, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              bottom: 40 + i * 30,
              width: 8,
              height: 8,
              background: "rgba(255,255,255,0.4)",
              borderRadius: "50%",
            }}
          />
        ))}
        {/* Fish */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 52,
            textAlign: "center",
          }}
        >
          🐟🐠🐡
        </div>
        {/* Sign */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#37474F",
            color: "white",
            padding: "6px",
            fontSize: 13,
            textAlign: "center",
            fontFamily: "Arial",
            direction: "rtl",
          }}
        >
          🐟 דגי הים התיכון
        </div>
      </div>
      <AnimalVisitor
        animal="🐧"
        name="פינגי - מבקרת"
        startFrame={5}
        x={120}
        y={300}
        walkToX={370}
        hat
      />
      <SpeechBubble
        text="הדגים נראים עצובים... אבל יש להם אוכיינוס שלם! 🌊"
        startFrame={45}
        style={{ left: 110, top: 160 }}
      />
      <SpeechBubble
        text="רגע... אני אוכלת דגים... ואני מבקרת בגן חיות... 😶"
        startFrame={90}
        style={{ left: 80, top: 100 }}
      />
    </AbsoluteFill>
  );
};

// Scene 4: Giraffe visitor at a giraffe enclosure
const Scene4: React.FC = () => {
  return (
    <AbsoluteFill>
      <ZooBackground sceneLabel="🦒 ג'ירף בגן חיות" startFrame={0} />
      <Cage
        animal="🦒"
        animalName="ג'ירף"
        sign="🦒 ג'ירפה"
        startFrame={10}
        x={660}
        y={120}
        width={220}
        height={320}
      />
      <AnimalVisitor
        animal="🦒"
        name="ג'ירי - מבקר"
        startFrame={5}
        x={120}
        y={230}
        walkToX={380}
        hat
      />
      <SpeechBubble
        text="הוא נראה אליי... אני נראה אליו... 👀"
        startFrame={50}
        style={{ left: 150, top: 120 }}
      />
      <SpeechBubble
        text="אנחנו מסתכלים אחד על השני ולא מבינים מי האסיר! 🤯"
        startFrame={95}
        style={{ left: 100, top: 70 }}
      />
    </AbsoluteFill>
  );
};

export const ZooVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#1a1a2e" }}>
      <Sequence from={0} durationInFrames={TITLE_DURATION}>
        <TitleScene />
      </Sequence>

      <Sequence from={SCENE1_START} durationInFrames={SCENE1_DURATION}>
        <Scene1 />
      </Sequence>

      <Sequence from={SCENE2_START} durationInFrames={SCENE2_DURATION}>
        <Scene2 />
      </Sequence>

      <Sequence from={SCENE3_START} durationInFrames={SCENE3_DURATION}>
        <Scene3 />
      </Sequence>

      <Sequence from={SCENE4_START} durationInFrames={SCENE4_DURATION}>
        <Scene4 />
      </Sequence>

      <Sequence from={FINALE_START} durationInFrames={FINALE_DURATION}>
        <FinaleScene />
      </Sequence>
    </AbsoluteFill>
  );
};
