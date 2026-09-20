// Generates index.html from the scene data below.
//
// Drop a still or a clip into media/ named after the card's year — 1997.jpg,
// 2005.mp4, 2011.webm — and this script wires it in as that card's background
// plate. With media/ empty the composition still renders exactly as committed,
// so the video never depends on footage that isn't there.
//
//   node build.mjs && npx hyperframes check && npx hyperframes render --output ../brag.mp4

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const VIDEO_EXT = ['mp4', 'webm'];

const CARDS = [
  {
    year: '1997',
    topic: 'הסכם חברון',
    at: 10.5,
    slide: '״נסוג מחברון.״',
    missing: 'הסכם שירש מרבין ופרס. הכנסת אישרה <b>87 מול 17</b> — כולל העבודה.',
    verdict: 'ירש הסכם. צמצם אותו.',
    figure: '87–17',
    figureLtr: true,
    figureSub: 'הצבעת הכנסת',
  },
  {
    year: '1998',
    topic: 'מזכר וואי',
    at: 17.0,
    slide: '״חתם על נסיגה.״',
    missing: '13% הותנו בביטחון. <b>הועברו 2%.</b> בדצמבר הכול הוקפא.',
    verdict: 'חתם על 13%. מסר 2%.',
    figure: '2%',
    figureLtr: true,
    figureSub: 'מתוך 13%',
  },
  {
    year: '2005',
    topic: 'ההתנתקות',
    at: 23.5,
    slide: '״הצביע בעד.״',
    missing: '<b>נכון.</b> ושבוע לפני הפינוי התפטר מהממשלה וויתר על משרד האוצר.',
    verdict: 'הצביע בעד. שילם על ההתנגדות.',
    figure: '7.8.2005',
    figureLtr: true,
    figureSub: 'יום ההתפטרות',
  },
  {
    year: '2009',
    topic: 'נאום בר-אילן',
    at: 30.0,
    slide: '״הכיר במדינה פלסטינית.״',
    missing:
      'מפורזת, <b>בלי צבא.</b> בתנאי הכרה בישראל כמדינת הלאום היהודי וירושלים מאוחדת.',
    verdict: 'תנאים שאיש לא קיבל.',
    figure: '10 חודשים',
    figureLtr: false,
    figureSub: 'ואז ההקפאה נגמרה',
  },
  {
    year: '2011',
    topic: 'עסקת שליט',
    at: 36.5,
    slide: '״שחרר 1,027.״',
    missing: 'הקבינט אישר <b>26 מול 3</b>. חייל חי, אחרי חמש שנים בשבי.',
    verdict: 'עסקה. לא אידאולוגיה.',
    figure: '26–3',
    figureLtr: true,
    figureSub: 'הצבעת הקבינט',
  },
  {
    year: '2013',
    topic: '104 אסירים',
    at: 43.0,
    slide: '״שחרר עוד 104.״',
    missing: 'בלחץ אמריקאי, <b>תמורת התחייבות פלסטינית לא לפנות לאו״ם.</b>',
    verdict: 'המנה הרביעית לא שוחררה.',
    figure: '26 אסירים',
    figureLtr: false,
    figureSub: 'שנשארו בכלא',
  },
];

const CARD_DUR = 6.5;

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

const plates = CARDS.map((c) => ({ ...c, plate: findPlate(c.year) }));
const withPlates = plates.filter((c) => c.plate);

const plateMarkup = withPlates
  .map(({ year, at, plate }) =>
    plate.kind === 'video'
      ? `      <video id="plate-${year}" class="clip plate" muted data-start="${at}" data-duration="${CARD_DUR}" data-media-start="0" data-track-index="4" src="${plate.src}"></video>`
      : `      <img id="plate-${year}" class="clip plate" data-start="${at}" data-duration="${CARD_DUR}" data-track-index="4" src="${plate.src}" alt="" />`
  )
  .join('\n');

const cardMarkup = plates
  .map(
    ({ year, topic, at, slide, missing, verdict, figure, figureLtr, figureSub }) => `
      <section id="s-${year}" class="clip card" data-start="${at}" data-duration="${CARD_DUR}" data-track-index="5">
        <div class="card-head">
          <div class="card-year">${year}</div>
          <div class="card-topic">${topic}</div>
        </div>
        <div class="card-body">
          <div class="claim">
            <div class="label">השקופית שלו</div>
            <div class="claim-text">${slide}</div>
          </div>
          <div class="rule"></div>
          <div class="fact">
            <div class="label">מה שלא בשקופית</div>
            <div class="fact-text">${missing}</div>
          </div>
          <div class="verdict">${verdict}</div>
        </div>
        <div class="figure">
          <div class="figure-value${figureLtr ? ' ltr' : ''}">${figure}</div>
          <div class="figure-sub">${figureSub}</div>
        </div>
      </section>`
  )
  .join('\n');

/* --- audio: one soft impact as each card lands, one drop as its fine print rises --- */
const cardSfx = plates
  .map(
    ({ year, at }) => `      <audio id="sfx-${year}-impact" data-start="${at.toFixed(
      2
    )}" data-duration="1" data-track-index="20" data-volume="0.5" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
      <audio id="sfx-${year}-drop" data-start="${(at + 1.15).toFixed(
        2
      )}" data-duration="1" data-track-index="21" data-volume="0.42" src="assets/sfx/interface/drop_001.ogg"></audio>`
  )
  .join('\n');

const cardTimeline = plates
  .map(({ year }) => `        { id: '#s-${year}', at: ${plates.find((c) => c.year === year).at} },`)
  .join('\n');

const plateTimeline = withPlates
  .map(({ year, at, plate }) => {
    const fade = `      tl.fromTo('#plate-${year}', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, ${at});`;
    // stills need the motion; footage brings its own
    return plate.kind === 'image'
      ? `${fade}\n      tl.fromTo('#plate-${year}', { scale: 1.06 }, { scale: 1.15, duration: ${CARD_DUR}, ease: 'none' }, ${at});`
      : fade;
  })
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
${['400', '700', '900']
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
  .join('\n')}

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

      /* ---- persistent chrome ---- */
      #bg {
        background:
          radial-gradient(120% 70% at 50% 0%, #171c24 0%, #0b0d10 62%),
          linear-gradient(#0b0d10, #0b0d10);
      }
      /* archive stills and footage sit behind the type, drained and dimmed so
         the copy keeps its contrast no matter what the frame underneath is */
      .plate {
        width: 1080px;
        height: 1920px;
        object-fit: cover;
        filter: grayscale(1) contrast(1.08) brightness(0.5);
        opacity: 0.4;
        transform-origin: center center;
      }
      #scrim {
        background: linear-gradient(
          180deg,
          rgba(11, 13, 16, 0.55) 0%,
          rgba(11, 13, 16, 0.72) 38%,
          rgba(11, 13, 16, 0.94) 72%,
          #0b0d10 100%
        );
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

      /* direction is scoped per scene — never on <html>, which blanks the render */
      #s0,
      #s1,
      .card,
      #s8,
      #s9 {
        direction: rtl;
      }

      /* ---- S0 : hook ---- */
      #s0,
      #s1 {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 100px;
        text-align: center;
      }
      #s0-a {
        font-size: 150px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1.02;
      }
      #s0-b {
        margin-top: 34px;
        font-size: 74px;
        font-weight: 400;
        line-height: 1.25;
        color: #9aa3ae;
      }
      #s0-c {
        margin-top: 64px;
        font-size: 68px;
        font-weight: 700;
        line-height: 1.3;
        color: #e8b84b;
        max-width: 840px;
      }

      /* ---- S1 : the method ---- */
      .method-line {
        font-size: 64px;
        font-weight: 400;
        line-height: 1.32;
        color: #9aa3ae;
        max-width: 880px;
      }
      #s1-b {
        margin-top: 22px;
      }
      #s1-c {
        margin-top: 62px;
        font-size: 78px;
        font-weight: 400;
        color: #f2f4f7;
      }
      #s1-d {
        margin-top: 10px;
        font-size: 108px;
        font-weight: 900;
        letter-spacing: -0.02em;
        color: #e8b84b;
      }

      /* ---- the cards ---- */
      .card {
        padding: 140px 90px 110px;
        display: flex;
        flex-direction: column;
      }
      .card-head {
        position: relative;
      }
      .card-year {
        font-size: 128px;
        font-weight: 900;
        line-height: 0.9;
        color: #e8b84b;
        letter-spacing: -0.03em;
        direction: ltr;
        text-align: right;
      }
      .card-topic {
        margin-top: 10px;
        font-size: 46px;
        font-weight: 700;
        color: #7f8896;
      }
      .label {
        position: relative;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0.16em;
        color: #6b7484;
      }
      .card-body {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .claim {
        position: relative;
      }
      .claim-text {
        margin-top: 18px;
        font-size: 70px;
        font-weight: 400;
        line-height: 1.24;
        color: #8a929e;
        border-right: 9px solid #414954;
        padding-right: 32px;
      }
      .rule {
        position: relative;
        height: 3px;
        background: rgba(255, 255, 255, 0.13);
        margin: 52px 0 0;
        transform-origin: right center;
      }
      .fact {
        position: relative;
        margin-top: 48px;
      }
      .fact .label {
        color: #e8b84b;
      }
      .fact-text {
        margin-top: 20px;
        font-size: 58px;
        font-weight: 400;
        line-height: 1.42;
        color: #f2f4f7;
        border-right: 9px solid #e8b84b;
        padding-right: 32px;
      }
      .fact-text b {
        font-weight: 900;
      }
      .verdict {
        position: relative;
        margin-top: 54px;
        font-size: 66px;
        font-weight: 900;
        line-height: 1.22;
        color: #f2f4f7;
      }
      .figure {
        position: relative;
        padding-top: 20px;
      }
      .figure-value {
        font-size: 108px;
        font-weight: 900;
        color: #e8b84b;
        line-height: 1.02;
        letter-spacing: -0.01em;
      }
      .figure-value.ltr {
        direction: ltr;
        text-align: right;
      }
      .figure-sub {
        margin-top: 10px;
        font-size: 36px;
        font-weight: 400;
        color: #6b7484;
      }

      /* ---- S8 : the missing slide / S9 : close ---- */
      #s8,
      #s9 {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 90px;
        text-align: right;
      }
      .close-line {
        font-size: 66px;
        font-weight: 400;
        line-height: 1.32;
        color: #8a929e;
      }
      #s8-b,
      #s9-b {
        margin-top: 34px;
      }
      #s8-c,
      #s9-c {
        margin-top: 52px;
        font-size: 96px;
        font-weight: 900;
        line-height: 1.18;
        color: #f2f4f7;
        letter-spacing: -0.02em;
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
${plateMarkup || '      <!-- no media/ plates found — drop files into media/ and re-run build.mjs -->'}
      <div id="scrim" class="clip" data-start="0" data-duration="60" data-track-index="2"></div>
      <div id="grain" class="clip" data-start="0" data-duration="60" data-track-index="3"></div>
      <div id="progress-track" class="clip" data-start="0" data-duration="60" data-track-index="1">
        <div id="progress-fill"></div>
      </div>

      <!-- S0 — hook: concede the slides, attack the conclusion -->
      <section id="s0" class="clip" data-start="0" data-duration="5.5" data-track-index="5">
        <div id="s0-a">בקוביץ׳ צודק.</div>
        <div id="s0-b">בכל שבע השקופיות.</div>
        <div id="s0-c">אז איך המסקנה יצאה הפוכה?</div>
      </section>

      <!-- S1 — name the method -->
      <section id="s1" class="clip" data-start="5.5" data-duration="5" data-track-index="5">
        <div id="s1-a" class="method-line">מצגת שמראה מה נחתם</div>
        <div id="s1-b" class="method-line">ולא מה התקבל, מה הותנה, ומה לא קרה —</div>
        <div id="s1-c">היא לא היסטוריה.</div>
        <div id="s1-d">היא עריכה.</div>
      </section>
${cardMarkup}

      <!-- S8 — the slide that was never in the deck -->
      <section id="s8" class="clip" data-start="49.5" data-duration="5.5" data-track-index="5">
        <div id="s8-a" class="close-line">ושקופית אחת לא הייתה שם בכלל:</div>
        <div id="s8-b" class="close-line">אחרי כל אלה, ואחרי עשרים שנה —</div>
        <div id="s8-c">מדינה פלסטינית לא קמה.</div>
      </section>

      <!-- S9 — close -->
      <section id="s9" class="clip" data-start="55" data-duration="5" data-track-index="5">
        <div id="s9-a" class="close-line">אפשר להתווכח על נתניהו. הרבה.</div>
        <div id="s9-b" class="close-line">אבל מי שסופר חתימות ולא תוצאות</div>
        <div id="s9-c">בונה מצגת. לא טיעון.</div>
      </section>

      <!-- ---- audio ---- -->
      <audio id="sfx-hook-bell" data-start="0.15" data-duration="2" data-track-index="11" data-volume="0.5" src="assets/sfx/interface/bong_001.ogg"></audio>
      <audio id="sfx-method" data-start="9.30" data-duration="1" data-track-index="12" data-volume="0.45" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
${cardSfx}
      <audio id="sfx-missing" data-start="52.85" data-duration="1" data-track-index="13" data-volume="0.5" src="assets/sfx/impact/impactSoft_medium_000.ogg"></audio>
      <audio id="sfx-close-bell" data-start="58.20" data-duration="1.8" data-track-index="14" data-volume="0.55" src="assets/sfx/impact/impactBell_heavy_000.ogg"></audio>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });

      tl.fromTo('#progress-fill', { scaleX: 0 }, { scaleX: 1, duration: 60, ease: 'none' }, 0);

      /* ---- S0 : hook ---- */
      tl.fromTo('#s0-a', { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.3);
      tl.fromTo('#s0-b', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 1.9);
      tl.fromTo('#s0-c', { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 3.6);
      tl.fromTo('#s0', { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 5.15);

      /* ---- S1 : the method ---- */
      tl.fromTo('#s1-a', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 5.8);
      tl.fromTo('#s1-b', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 6.9);
      tl.fromTo('#s1-c', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 8.5);
      tl.fromTo('#s1-d', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.7)' }, 9.3);
      tl.fromTo('#s1', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 10.2);

      /* ---- the cards ---- */
      const CARD_DUR = ${CARD_DUR};
      const cards = [
${cardTimeline}
      ];

      cards.forEach(({ id, at }) => {
        tl.fromTo(\`\${id} .card-year\`, { opacity: 0, y: 38 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, at);
        tl.fromTo(\`\${id} .card-topic\`, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, at + 0.15);
        tl.fromTo(\`\${id} .claim\`, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, at + 0.35);
        tl.fromTo(\`\${id} .rule\`, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, at + 0.95);
        tl.fromTo(\`\${id} .fact\`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, at + 1.15);
        tl.fromTo(\`\${id} .verdict\`, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, at + 3.6);
        tl.fromTo(\`\${id} .figure\`, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, at + CARD_DUR - 2.1);
      });

${plateTimeline || '      /* no plates in this build */'}

      /* ---- S8 : the missing slide ---- */
      tl.fromTo('#s8-a', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 49.8);
      tl.fromTo('#s8-b', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 51.2);
      tl.fromTo('#s8-c', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 52.9);
      tl.fromTo('#s8', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 54.7);

      /* ---- S9 : close ---- */
      tl.fromTo('#s9-a', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 55.2);
      tl.fromTo('#s9-b', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 56.7);
      tl.fromTo('#s9-c', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 58.3);

      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;

writeFileSync(join(HERE, 'index.html'), html);
console.log(
  `index.html written — ${plates.length} cards, ${withPlates.length} media plate(s)` +
    (withPlates.length ? `: ${withPlates.map((c) => c.plate.src).join(', ')}` : '')
);
