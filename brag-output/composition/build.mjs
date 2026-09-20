// Generates index.html from the scene data below.
//
// The spine is Barko's own broadcast: media/source/barko-full.mp4 runs in a
// full-width panel for all 60 seconds, each scene seeking its own in-point via
// data-media-start. Nothing on screen is ever still.
//
// Source alignment is real, not decorative. His graphic carries slides
// 1996–2009 from 14s to 39s and slides 2010–2018 from 44s to 66s, so each card
// is cut from the stretch where his own deck is showing that half. The studio
// two-shots (4–13s, 67–77s) carry the open and the close.
//
// media/<year>.*  — optional Netanyahu footage per card. Present: replaces the
//                   panel for that card. Absent: the panel stays on Barko.
//
//   node build.mjs && npx hyperframes check && npx hyperframes render --output ../brag.mp4

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const VIDEO_EXT = ['mp4', 'webm'];
const SRC = 'media/source/barko-full.mp4';
const CARD_DUR = 6.5;

// at = where the card sits in the 60s; src = where it cuts from in his broadcast
const CARDS = [
  {
    year: '1997',
    topic: 'הסכם חברון',
    at: 11.0,
    src: 14.0, // his panel A is up: slides 1996–2009
    figure: '87–17',
    figureLtr: true,
    line: 'הסכם שירש מרבין ופרס. הכנסת אישרה — כולל העבודה.',
  },
  {
    year: '1998',
    topic: 'מזכר וואי',
    at: 17.5,
    src: 20.5,
    figure: '2%',
    figureLtr: true,
    line: 'מתוך 13% שהותנו בביטחון. בדצמבר הוקפא.',
  },
  {
    year: '2005',
    topic: 'ההתנתקות',
    at: 24.0,
    src: 27.0,
    figure: '7.8.2005',
    figureLtr: true,
    line: 'הצביע בעד — והתפטר שבוע לפני הפינוי.',
  },
  {
    year: '2009',
    topic: 'נאום בר-אילן',
    at: 30.5,
    src: 32.5,
    figure: '10 חודשים',
    figureLtr: false,
    line: 'מדינה מפורזת, בתנאים. ואז ההקפאה נגמרה.',
  },
  {
    year: '2011',
    topic: 'עסקת שליט',
    at: 37.0,
    src: 45.0, // panel B is up: slides 2010–2018
    figure: '26–3',
    figureLtr: true,
    line: 'הקבינט אישר. חייל חי, אחרי חמש שנים בשבי.',
  },
  {
    year: '2013',
    topic: '104 אסירים',
    at: 43.5,
    src: 51.5,
    figure: '13–7',
    figureLtr: true,
    line: 'הקבינט אישר. המנה הרביעית בוטלה — 26 לא שוחררו.',
  },
];

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

/** A panel clip cut from Barko's broadcast at the given in-point. */
function panel(id, at, dur, srcIn) {
  return `      <video id="panel-${id}" class="clip panel" muted data-start="${at}" data-duration="${dur}" data-media-start="${srcIn}" data-track-index="4" src="${SRC}"></video>`;
}

const panels = [
  panel('hook', 0, 5.5, 4.0),
  panel('deck', 5.5, 5.5, 8.0),
  ...cards.map(({ year, at, src, plate }) =>
    plate
      ? plate.kind === 'video'
        ? `      <video id="panel-${year}" class="clip panel" muted data-start="${at}" data-duration="${CARD_DUR}" data-media-start="0" data-track-index="4" src="${plate.src}"></video>`
        : `      <img id="panel-${year}" class="clip panel" data-start="${at}" data-duration="${CARD_DUR}" data-track-index="4" src="${plate.src}" alt="" />`
      : panel(year, at, CARD_DUR, src)
  ),
  panel('missing', 50.0, 5.0, 67.0),
  panel('close', 55.0, 5.0, 71.5),
].join('\n');

const cardMarkup = cards
  .map(
    ({ year, topic, at, figure, figureLtr, line }) => `
      <section id="s-${year}" class="clip card" data-start="${at}" data-duration="${CARD_DUR}" data-track-index="5">
        <div class="card-topic">${year} · ${topic}</div>
        <div class="card-figure${figureLtr ? ' ltr' : ''}">${figure}</div>
        <div class="card-line">${line}</div>
      </section>`
  )
  .join('\n');

const cardSfx = cards
  .map(
    ({ year, at }) =>
      `      <audio id="sfx-${year}-cut" data-start="${at.toFixed(
        2
      )}" data-duration="1" data-track-index="20" data-volume="0.5" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
      <audio id="sfx-${year}-figure" data-start="${(at + 1.5).toFixed(
        2
      )}" data-duration="1" data-track-index="21" data-volume="0.42" src="assets/sfx/interface/drop_001.ogg"></audio>`
  )
  .join('\n');

const cardTimeline = cards.map(({ year, at }) => `        { id: '#s-${year}', at: ${at} },`).join('\n');

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

      /* ---- S0 : the concession ---- */
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

      /* ---- S1 : his nine slides ---- */
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

      /* ---- the cards : year, number, one line ---- */
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

      /* ---- S8 / S9 ---- */
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

      <!-- S0 — the concession -->
      <section id="s0" class="clip" data-start="0" data-duration="5.5" data-track-index="5">
        <div id="s0-a">ברקו צודק.</div>
        <div id="s0-b">כל תשע השקופיות.</div>
      </section>

      <!-- S1 — his nine slides, off his own screen -->
      <section id="s1" class="clip" data-start="5.5" data-duration="5.5" data-track-index="5">
        <img id="deck-a" class="deck-shot" src="media/source/deck-a.jpg" alt="" />
        <img id="deck-b" class="deck-shot" src="media/source/deck-b.jpg" alt="" />
        <div id="s1-line">סופרת חתימות. לא תוצאות.</div>
      </section>
${cardMarkup}

      <!-- S8 — the slide that was never in the deck -->
      <section id="s8" class="clip" data-start="50" data-duration="5" data-track-index="5">
        <div id="s8-a">ושקופית אחת לא הייתה שם בכלל:</div>
        <div id="s8-b">מדינה פלסטינית לא קמה.</div>
      </section>

      <!-- S9 — close -->
      <section id="s9" class="clip" data-start="55" data-duration="5" data-track-index="5">
        <div id="s9-a">מי שסופר חתימות ולא תוצאות</div>
        <div id="s9-b">בונה מצגת. לא טיעון.</div>
      </section>

      <!-- ---- audio ---- -->
      <audio id="sfx-hook-bell" data-start="0.15" data-duration="2" data-track-index="11" data-volume="0.5" src="assets/sfx/interface/bong_001.ogg"></audio>
      <audio id="sfx-deck-a" data-start="5.60" data-duration="0.8" data-track-index="12" data-volume="0.45" src="assets/sfx/casino/card-place-1.ogg"></audio>
      <audio id="sfx-deck-b" data-start="8.10" data-duration="0.8" data-track-index="13" data-volume="0.45" src="assets/sfx/casino/card-place-1.ogg"></audio>
      <audio id="sfx-method" data-start="9.90" data-duration="1" data-track-index="14" data-volume="0.45" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
${cardSfx}
      <audio id="sfx-missing" data-start="51.60" data-duration="1" data-track-index="15" data-volume="0.5" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
      <audio id="sfx-close-bell" data-start="57.40" data-duration="1.8" data-track-index="16" data-volume="0.55" src="assets/sfx/impact/impactBell_heavy_000.ogg"></audio>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });

      tl.fromTo('#progress-fill', { scaleX: 0 }, { scaleX: 1, duration: 60, ease: 'none' }, 0);

      /* ---- S0 ---- */
      tl.fromTo('#s0-a', { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 1.2);
      tl.fromTo('#s0-b', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 2.9);
      tl.fromTo('#s0', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 5.2);

      /* ---- S1 : the deck, pushing in so it never sits still ---- */
      tl.fromTo('#deck-a', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 5.6);
      tl.fromTo('#deck-a', { scale: 1 }, { scale: 1.06, duration: 2.5, ease: 'none' }, 5.6);
      tl.fromTo('#deck-a', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.inOut' }, 8.1);
      tl.fromTo('#deck-b', { opacity: 0, scale: 1 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.inOut' }, 8.25);
      tl.fromTo('#deck-b', { scale: 1 }, { scale: 1.06, duration: 2.5, ease: 'none' }, 8.25);
      tl.fromTo('#s1-line', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 9.9);
      tl.fromTo('#s1', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 10.7);

      /* ---- the cards ---- */
      const CARD_DUR = ${CARD_DUR};
      const cards = [
${cardTimeline}
      ];

      cards.forEach(({ id, at }) => {
        tl.fromTo(\`\${id} .card-topic\`, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, at + 0.25);
        tl.fromTo(\`\${id} .card-figure\`, { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, at + 0.55);
        tl.fromTo(\`\${id} .card-line\`, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, at + 1.5);
        tl.fromTo(id, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.in' }, at + CARD_DUR - 0.25);
      });

      /* ---- S8 / S9 ---- */
      tl.fromTo('#s8-a', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 50.3);
      tl.fromTo('#s8-b', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 51.6);
      tl.fromTo('#s8', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 54.75);

      tl.fromTo('#s9-a', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 55.4);
      tl.fromTo('#s9-b', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 57.4);

      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;

writeFileSync(join(HERE, 'index.html'), html);
const plated = cards.filter((c) => c.plate);
console.log(
  `index.html written — panel runs all 60s; ${cards.length} cards, ` +
    (plated.length
      ? `${plated.length} on Netanyahu footage: ${plated.map((c) => c.plate.src).join(', ')}`
      : 'all on Barko (no media/<year>.* supplied yet)')
);
