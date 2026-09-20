// Generates index.html from the scene data below.
//
// The spine is Barko's own broadcast. It runs in a full-width panel for all 60
// seconds, and HE STATES EACH CLAIM IN HIS OWN VOICE before the number answers
// it. Nothing on screen is ever still.
//
// The cuts come from his transcript matched to detected pauses in his audio, so
// every scene starts and ends on a sentence boundary:
//
//   8.35–13.83  "וואלה… תראו לבנימין נתניהו את המצגת שהכנתי לו. קדימה."
//   16.01–19.56 "1996, מצאתי חבר, הוא אמר על ערפאת."
//   20.36–22.92 "1997, הסכם הנסיגה מחברון."
//   23.63–28.02 "1998, הסכם וואי, נסיגה מהשטחים. הכול זה נתניהו."
//   28.10–31.57 "2004, 2005, הצבעה, הוא מצביע בעד ההתנתקות."
//   31.60–34.37 "הימני הגדול מצביע בעד ההתנתקות."
//   34.40–37.38 "2009, נאום בר-אילן, כולם זוכרים."
//   37.40–41.34 "מכיר במדינה פלסטינאית והקפאת בניית ההתנחלויות."
//   45.16–48.88 "2010, משא ומתן ישיר עם אבו מאזן במעון ראש הממשלה."
//   49.26–56.86 "2011, הוא משחרר 1,027 אסירים… בהם סנוואר. במסגרת ישראלית."
//   57.26–60.66 "2013, שחרור עוד 104 אסירים נוספים."
//   61.28–64.94 "2018, פתיחת מסלול מזוודות הכסף הקטרי לעזה."
//   65.61–69.37 "אז אני שואל אותך, מר נתניהו, מי באמת ימין ומשמאל?"
//   69.66–76.59 "במשך 20 שנה אתה מרמה פה את כולם… אתה הכי שמאלני מכולם."
//
// His graphic carries slides 1996–2009 from 14s to 39s and 2010–2018 from 44s
// to 66s; the studio two-shots run 4–13s and 67–77s. Where his face is on
// screen, video and audio cut from the same point so the lips match. On the
// cards his graphic is full-frame and his face is not, so the panel can hold a
// clean stretch of graphic while the audio plays his matching sentence.
//
// HIS_VOICE = false mutes him and the video falls back to cue SFX.
//
//   node build.mjs && npx hyperframes check && npx hyperframes render --output ../brag.mp4

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const VIDEO_EXT = ['mp4', 'webm'];
const VID = 'media/source/barko-full.mp4';
const AUD = 'media/source/barko-audio.m4a';

const HIS_VOICE = true;
const VOICE_VOL = 0.9;

// at/dur: position in the 60s. vid: panel in-point. aud/audLen: his sentence.
const CARDS = [
  {
    year: '1997',
    topic: 'הסכם חברון',
    at: 10.5,
    dur: 5.5,
    vid: 16.5,
    aud: 20.36,
    audLen: 2.56,
    figure: '87–17',
    figureLtr: true,
    line: 'הסכם שירש מרבין ופרס. הכנסת אישרה — כולל העבודה.',
  },
  {
    year: '1998',
    topic: 'מזכר וואי',
    at: 16.0,
    dur: 6.0,
    vid: 22.0,
    aud: 23.63,
    audLen: 4.39,
    figure: '2%',
    figureLtr: true,
    line: 'מתוך 13% שהותנו בביטחון. בדצמבר הוקפא.',
  },
  {
    year: '2005',
    topic: 'ההתנתקות',
    at: 22.0,
    dur: 5.5,
    vid: 28.0,
    aud: 28.1,
    audLen: 3.47,
    figure: '7.8.2005',
    figureLtr: true,
    line: 'הצביע בעד — והתפטר שבוע לפני הפינוי.',
  },
  {
    year: '2009',
    topic: 'נאום בר-אילן',
    at: 27.5,
    dur: 6.0,
    vid: 33.0,
    aud: 37.4,
    audLen: 3.94,
    figure: '10 חודשים',
    figureLtr: false,
    line: 'מדינה מפורזת, בתנאים. ואז ההקפאה נגמרה.',
  },
  {
    year: '2011',
    topic: 'עסקת שליט',
    at: 33.5,
    dur: 8.5,
    vid: 45.5,
    aud: 49.26,
    audLen: 7.6,
    figure: '26–3',
    figureLtr: true,
    line: 'הקבינט אישר. חייל חי, אחרי חמש שנים בשבי.',
  },
  {
    year: '2013',
    topic: '104 אסירים',
    at: 42.0,
    dur: 5.5,
    vid: 54.0,
    aud: 57.26,
    audLen: 3.4,
    figure: '13–7',
    figureLtr: true,
    line: 'הקבינט אישר. המנה הרביעית בוטלה — 26 לא שוחררו.',
  },
];

const OPEN = { at: 0, dur: 5.5, vid: 8.35, aud: 8.35, audLen: 5.48 };
const DECK = { at: 5.5, dur: 5.0, vid: 16.0 }; // silent: the thesis needs the room
const MISSING = { at: 47.5, dur: 5.2, vid: 65.61, aud: 65.61, audLen: 3.76 };
const CLOSE = { at: 52.7, dur: 7.3, vid: 69.6, aud: 69.66, audLen: 6.93 };

/** Finds media/<year>.<ext>, preferring video, and returns its kind + path. */
function findPlate(year) {
  const dir = join(HERE, 'media');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  for (const ext of [...VIDEO_EXT, ...IMAGE_EXT]) {
    const name = `${year}.${ext}`;
    if (files.includes(name)) {
      return { kind: VIDEO_EXT.includes(ext) ? 'video' : 'image', src: `media/${name}` };
    }
  }
  return null;
}

const cards = CARDS.map((c) => ({ ...c, plate: findPlate(c.year) }));

const panelClip = (id, at, dur, vid) =>
  `      <video id="panel-${id}" class="clip panel" muted data-start="${at}" data-duration="${dur}" data-media-start="${vid}" data-track-index="4" src="${VID}"></video>`;

const panels = [
  panelClip('open', OPEN.at, OPEN.dur, OPEN.vid),
  panelClip('deck', DECK.at, DECK.dur, DECK.vid),
  ...cards.map(({ year, at, dur, vid, plate }) =>
    plate
      ? plate.kind === 'video'
        ? `      <video id="panel-${year}" class="clip panel" muted data-start="${at}" data-duration="${dur}" data-media-start="0" data-track-index="4" src="${plate.src}"></video>`
        : `      <img id="panel-${year}" class="clip panel" data-start="${at}" data-duration="${dur}" data-track-index="4" src="${plate.src}" alt="" />`
      : panelClip(year, at, dur, vid)
  ),
  panelClip('missing', MISSING.at, MISSING.dur, MISSING.vid),
  panelClip('close', CLOSE.at, CLOSE.dur, CLOSE.vid),
].join('\n');

/** His sentence, cut to length, on its own track so nothing overlaps. */
const voiceClips = HIS_VOICE
  ? [
      { id: 'open', ...OPEN },
      ...cards.filter((c) => !c.plate).map((c) => ({ id: c.year, ...c })),
      { id: 'missing', ...MISSING },
      { id: 'close', ...CLOSE },
    ]
      .map(
        ({ id, at, aud, audLen }, i) =>
          `      <audio id="voice-${id}" data-start="${at.toFixed(2)}" data-duration="${audLen.toFixed(
            2
          )}" data-media-start="${aud}" data-track-index="${30 + i}" data-volume="${VOICE_VOL}" src="${AUD}"></audio>`
      )
      .join('\n')
  : '';

/** With his voice on, per-card cues would just fight the speech. */
const cardSfx = HIS_VOICE
  ? ''
  : cards
      .map(
        ({ year, at }) =>
          `      <audio id="sfx-${year}-cut" data-start="${at.toFixed(
            2
          )}" data-duration="1" data-track-index="20" data-volume="0.5" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>`
      )
      .join('\n');

const cardMarkup = cards
  .map(
    ({ year, topic, at, dur, figure, figureLtr, line }) => `
      <section id="s-${year}" class="clip card" data-start="${at}" data-duration="${dur}" data-track-index="5">
        <div class="card-topic">${year} · ${topic}</div>
        <div class="card-figure${figureLtr ? ' ltr' : ''}">${figure}</div>
        <div class="card-line">${line}</div>
      </section>`
  )
  .join('\n');

// the number lands right after he finishes saying the claim
const cardTimeline = cards
  .map(
    ({ year, at, dur, audLen }) =>
      `        { id: '#s-${year}', at: ${at}, dur: ${dur}, answer: ${(
        at + (HIS_VOICE ? Math.min(audLen + 0.2, dur - 1.8) : 0.55)
      ).toFixed(2)} },`
  )
  .join('\n');

const fontFaces = ['400', '700', '900']
  .flatMap((w) => [
    `      @font-face {
        font-family: 'Heebo';
        font-style: normal;
        font-weight: ${w};
        font-display: block;
        src: url(assets/fonts/heebo-${w}-he.woff2) format('woff2');
        unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
      }`,
    `      @font-face {
        font-family: 'Heebo';
        font-style: normal;
        font-weight: ${w};
        font-display: block;
        src: url(assets/fonts/heebo-${w}-latin.woff2) format('woff2');
      }`,
  ])
  .join('\n');

const html = `<!doctype html>
<!-- GENERATED BY build.mjs — edit the scene data there, not this file. -->
<html lang="he" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      /* ---- Heebo, vendored so the render never touches the network ---- */
${fontFaces}

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: #0b0d10;
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
        font-family: 'Heebo', sans-serif;
        color: #f2f4f7;
        overflow: hidden;
      }
      .clip {
        position: absolute;
        inset: 0;
      }

      #bg {
        background:
          radial-gradient(120% 60% at 50% 22%, #171c24 0%, #0b0d10 64%),
          linear-gradient(#0b0d10, #0b0d10);
      }
      #grain {
        opacity: 0.5;
        background-image: repeating-linear-gradient(
          0deg,
          rgba(255, 255, 255, 0.022) 0px,
          rgba(255, 255, 255, 0.022) 1px,
          transparent 1px,
          transparent 4px
        );
      }
      #progress-track {
        position: absolute;
        top: 0;
        left: 0;
        width: 1080px;
        height: 7px;
        background: rgba(255, 255, 255, 0.07);
      }
      #progress-fill {
        position: absolute;
        top: 0;
        right: 0;
        width: 1080px;
        height: 7px;
        background: #e8b84b;
        transform-origin: right center;
      }

      /* ---- the panel: his broadcast, running the whole way through ---- */
      .panel {
        inset: auto;
        top: 210px;
        left: 0;
        width: 1080px;
        height: 604px;
        object-fit: cover;
        filter: saturate(0.62) contrast(1.05) brightness(0.9);
      }
      #panel-edge {
        inset: auto;
        top: 210px;
        left: 0;
        width: 1080px;
        height: 604px;
        border-top: 2px solid rgba(255, 255, 255, 0.1);
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      }

      /* direction is scoped per scene — never on <html>, which blanks the render */
      #s0,
      #s1,
      .card,
      #s8,
      #s9 {
        direction: rtl;
      }
      #s0 > div,
      #s1 > div,
      .card > div,
      #s8 > div,
      #s9 > div {
        position: absolute;
        left: 80px;
        width: 920px;
        text-align: center;
      }

      #s0-a {
        top: 1000px;
        font-size: 156px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1.02;
      }
      #s0-b {
        top: 1200px;
        font-size: 76px;
        font-weight: 400;
        color: #9aa3ae;
      }

      .deck-shot {
        position: absolute;
        top: 900px;
        left: 220px;
        width: 640px;
        border: 3px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        filter: saturate(0.45) contrast(1.05) brightness(0.92);
      }
      #s1-line {
        top: 1620px;
        font-size: 80px;
        font-weight: 900;
        line-height: 1.16;
        letter-spacing: -0.02em;
        color: #e8b84b;
      }

      .card-topic {
        top: 930px;
        font-size: 52px;
        font-weight: 700;
        color: #7f8896;
        letter-spacing: 0.02em;
      }
      .card-figure {
        top: 1060px;
        font-size: 150px;
        font-weight: 900;
        color: #e8b84b;
        line-height: 1;
        letter-spacing: -0.03em;
      }
      .card-figure.ltr {
        direction: ltr;
      }
      .card-line {
        top: 1320px;
        font-size: 62px;
        font-weight: 400;
        line-height: 1.34;
        color: #f2f4f7;
      }

      #s8-a,
      #s9-a {
        top: 1000px;
        font-size: 64px;
        font-weight: 400;
        line-height: 1.3;
        color: #9aa3ae;
      }
      #s8-b,
      #s9-b {
        top: 1180px;
        font-size: 104px;
        font-weight: 900;
        line-height: 1.16;
        letter-spacing: -0.025em;
      }
      #s8-b {
        color: #e8b84b;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="60"
      data-width="1080"
      data-height="1920"
    >
      <div id="bg" class="clip" data-start="0" data-duration="60" data-track-index="0"></div>
${panels}
      <div id="panel-edge" class="clip" data-start="0" data-duration="60" data-track-index="6"></div>
      <div id="grain" class="clip" data-start="0" data-duration="60" data-track-index="3"></div>
      <div id="progress-track" class="clip" data-start="0" data-duration="60" data-track-index="1">
        <div id="progress-fill"></div>
      </div>

      <!-- S0 — he introduces his own deck; the concession lands on top of it -->
      <section id="s0" class="clip" data-start="${OPEN.at}" data-duration="${OPEN.dur}" data-track-index="5">
        <div id="s0-a">ברקו צודק.</div>
        <div id="s0-b">כל תשע השקופיות.</div>
      </section>

      <!-- S1 — his nine slides, off his own screen. Silent on purpose. -->
      <section id="s1" class="clip" data-start="${DECK.at}" data-duration="${DECK.dur}" data-track-index="5">
        <img id="deck-a" class="deck-shot" src="media/source/deck-a.jpg" alt="" />
        <img id="deck-b" class="deck-shot" src="media/source/deck-b.jpg" alt="" />
        <div id="s1-line">סופרת חתימות. לא תוצאות.</div>
      </section>
${cardMarkup}

      <!-- S8 — he asks the question; the missing slide answers it -->
      <section id="s8" class="clip" data-start="${MISSING.at}" data-duration="${MISSING.dur}" data-track-index="5">
        <div id="s8-a">ושקופית אחת לא הייתה שם בכלל:</div>
        <div id="s8-b">מדינה פלסטינית לא קמה.</div>
      </section>

      <!-- S9 — he lands his punchline, then the answer -->
      <section id="s9" class="clip" data-start="${CLOSE.at}" data-duration="${CLOSE.dur}" data-track-index="5">
        <div id="s9-a">מי שסופר חתימות ולא תוצאות</div>
        <div id="s9-b">בונה מצגת. לא טיעון.</div>
      </section>

      <!-- ---- audio ---- -->
${voiceClips}
${cardSfx}
      <audio id="sfx-close-bell" data-start="57.60" data-duration="1.8" data-track-index="16" data-volume="0.45" src="assets/sfx/impact/impactBell_heavy_000.ogg"></audio>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });

      tl.fromTo('#progress-fill', { scaleX: 0 }, { scaleX: 1, duration: 60, ease: 'none' }, 0);

      /* ---- S0 ---- */
      tl.fromTo('#s0-a', { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 2.4);
      tl.fromTo('#s0-b', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 3.9);
      tl.fromTo('#s0', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, ${(OPEN.at + OPEN.dur - 0.3).toFixed(2)});

      /* ---- S1 : the deck, pushing in so it never sits still ---- */
      tl.fromTo('#deck-a', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 5.6);
      tl.fromTo('#deck-a', { scale: 1 }, { scale: 1.06, duration: 2.2, ease: 'none' }, 5.6);
      tl.fromTo('#deck-a', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.inOut' }, 7.8);
      tl.fromTo('#deck-b', { opacity: 0, scale: 1 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.inOut' }, 7.95);
      tl.fromTo('#deck-b', { scale: 1 }, { scale: 1.06, duration: 2.2, ease: 'none' }, 7.95);
      tl.fromTo('#s1-line', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 9.0);
      tl.fromTo('#s1', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 10.2);

      /* ---- the cards: he states the claim, then the number answers ---- */
      const cards = [
${cardTimeline}
      ];

      cards.forEach(({ id, at, dur, answer }) => {
        tl.fromTo(\`\${id} .card-topic\`, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, at + 0.25);
        tl.fromTo(\`\${id} .card-figure\`, { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, answer);
        tl.fromTo(\`\${id} .card-line\`, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, answer + 0.55);
        tl.fromTo(id, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.in' }, at + dur - 0.25);
      });

      /* ---- S8 / S9 ---- */
      tl.fromTo('#s8-a', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${(MISSING.at + 0.3).toFixed(2)});
      tl.fromTo('#s8-b', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, ${(MISSING.at + MISSING.audLen + 0.1).toFixed(2)});
      tl.fromTo('#s8', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.in' }, ${(MISSING.at + MISSING.dur - 0.25).toFixed(2)});

      tl.fromTo('#s9-a', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${(CLOSE.at + CLOSE.audLen - 1.6).toFixed(2)});
      tl.fromTo('#s9-b', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, ${(CLOSE.at + CLOSE.audLen + 0.1).toFixed(2)});

      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;

writeFileSync(join(HERE, 'index.html'), html);
const plated = cards.filter((c) => c.plate);
const end = CLOSE.at + CLOSE.dur;
console.log(
  `index.html written — ${end.toFixed(2)}s, his voice ${HIS_VOICE ? 'ON' : 'muted'}, ` +
    (plated.length
      ? `${plated.length} card(s) on Netanyahu footage: ${plated.map((c) => c.plate.src).join(', ')}`
      : 'all cards on Barko')
);
