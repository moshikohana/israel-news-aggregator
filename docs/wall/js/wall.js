/*
 * wall.js - חיבור הכל יחד: לולאת הרינדור, הקלט, וממשק המשתמש.
 *
 * סדר הציור בכל פריים:
 *   1. העולם (שמיים, ים, חוף, דקלים)      - scene.js
 *   2. חלונות ואייקונים שמאחורי הדמות
 *   3. הדמות                                - character.js
 *   4. אייקונים שהדמות מחזיקה / מגינה עליהם - desktop.js
 *   5. גשם, שלג, ערפל, ברקים (חזית)        - scene.js
 *   6. בועת דיבור ו-HUD (DOM)
 */

import { World, WEATHER_HE } from './scene.js';
import { Character, OUTFITS } from './character.js';
import { Desktop } from './desktop.js';
import { Brain } from './brain.js';
import { Voice, Speaker, AudioMeter, matchCommand } from './voice.js';
import { Keyer, PhotoLayer } from './photo.js';

const SETTINGS_KEY = 'live-wallpaper-settings';
const el = (id) => document.getElementById(id);

const settings = Object.assign({
    sound: true, mic: false, music: false, hud: true,
    // שכבת שולחן העבודה היא מטאפורה של מסך גדול; בטלפון היא רק מסתירה
    // את הסצנה, אז היא כבויה כברירת מחדל שם (ואפשר להדליק בכפתור 🗂️).
    icons: window.innerWidth > 760,
    quality: 'auto', outfit: 'teal', liveWeather: false, news: true,
}, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));

const saveSettings = () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
};

const params = new URLSearchParams(location.search);
const wallpaperMode = params.get('mode') === 'wallpaper';   // בלי HUD, לשימוש כטפט אמיתי

/* ----------------------------------------------------------- אובייקטים */

const canvas = el('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const world = new World();
const character = new Character({ outfit: settings.outfit });
const desktop = new Desktop();
const speaker = new Speaker();
const brain = new Brain(character, desktop, speaker);
const voice = new Voice();
const meter = new AudioMeter();
const keyer = new Keyer();
const photoActor = new PhotoLayer('actor', keyer);
const photoBg = new PhotoLayer('bg', keyer);

let W = 0, H = 0, dpr = 1;
let pointer = { x: 0, y: 0, inside: false };
let running = false;
let last = performance.now();
let fpsAvg = 60;
let recorder = null, recChunks = [];

/* ------------------------------------------------------------- גודל */

function resize() {
    const maxDpr = settings.quality === 'low' ? 1 : settings.quality === 'high' ? 3 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    world.resize(W, H, dpr);
    const groundY = world.shore + (H - world.shore) * 0.62;
    desktop.resize(W, H, groundY);

    character.dpr = dpr;
    brain.bounds = W;
    // במסך צר הרוחב הוא המגביל, אבל לא עד כדי דמות זעירה
    character.height = Math.max(150, Math.min(H * 0.44, W * 0.72));
    character.y = groundY;
    if (!character.x) character.x = W * 0.40;
    character.x = Math.max(character.height * 0.4, Math.min(W - character.height * 0.4, character.x));
}

window.addEventListener('resize', resize);

/* ------------------------------------------------------------- לולאה */

function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAvg += (1 / Math.max(dt, 0.001) - fpsAvg) * 0.05;

    // מוזיקה בחדר -> קצב ריקוד
    if (meter.active) {
        meter.sample();
        character.ctxParams.beat = 1 + meter.beat * 0.5;
        if (meter.level > 0.13 && brain.busy <= 0 && !brain.focusMode) {
            brain.act('dance', 6);
            if (Math.random() < 0.02) character.pop('note');
        }
    }

    brain.update(dt, pointer.inside ? pointer : null);
    const env = brain.env;

    // פרלקסה של המדיה האמיתית לפי מיקום הסמן
    const nx = pointer.inside ? (pointer.x / W) * 2 - 1 : 0;
    const ny = pointer.inside ? (pointer.y / H) * 2 - 1 : 0;
    photoActor.aim(nx, ny);
    photoBg.aim(nx, ny);

    // מבט וכיוון פנייה לפי הסמן
    if (pointer.inside) {
        character.look.x = pointer.x;
        character.look.y = pointer.y;
        const d = pointer.x - character.x;
        if (Math.abs(d) > character.height * 0.22 && character.state !== 'walk') {
            character.facing = d > 0 ? 1 : -1;
        }
    } else {
        character.look.x = character.x + character.facing * character.height * 0.6;
        character.look.y = character.y - character.height * 0.85;
    }

    world.update(dt, env);
    character.update(dt, env);
    photoActor.update(dt);
    photoBg.update(dt);

    // הדמות האמיתית לא מחזיקה שלד, אז נקודת האחיזה שלה מכוונת ידנית
    const holder = photoActor.ready
        ? { graspPoint: () => photoActor.graspPoint(actorBox()) }
        : character;
    desktop.update(dt, env, holder);

    // ---- ציור
    const photoBackdrop = photoBg.ready && photoBg.drawBg(ctx, W, H, env);
    if (!photoBackdrop) {
        world.draw(ctx, env);
        world.drawGloom(ctx, env);      // מכהה את הרקע לפי מזג האוויר
    }
    if (settings.icons && !wallpaperMode) {
        ctx.save();
        // מה שלא בידיים של הדמות מצויר מאחוריה
        for (const wn of desktop.windows) if (wn.open) desktop.drawWindow(ctx, wn, env);
        for (const ic of desktop.icons) if (ic !== desktop.caught && !ic.sheltered) desktop.drawIcon(ctx, ic, env);
        ctx.restore();
    }

    if (!brain.hidden) {
        if (!(photoActor.ready && photoActor.drawActor(ctx, actorBox()))) {
            character.draw(ctx, env);
        }
    }

    if (settings.icons && !wallpaperMode) {
        for (const ic of desktop.icons) if (ic === desktop.caught || ic.sheltered) desktop.drawIcon(ctx, ic, env);
    }

    world.drawForeground(ctx, env);
    drawVignette(env);
    updateBubble();
    updateReadout(env);
}

let vignette = null, vignetteKey = '';

/** הפרמטרים שהדמות האמיתית מצוירת לפיהם - אותם מיקום/גובה של הווקטורית. */
function actorBox() {
    return {
        x: character.x,
        y: character.y,
        height: character.height,
        facing: character.facing,
        wet: brain.env.wet,
        env: brain.env,
        dpr,
    };
}

function drawVignette(env) {
    const a = env.sunAlt < 0 ? 0.42 : 0.24;
    const key = `${W}x${H}:${a}`;
    if (vignetteKey !== key) {
        const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.78);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${a})`);
        vignette = g;
        vignetteKey = key;
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------- בועת דיבור */

const bubble = el('bubble');

function updateBubble() {
    if (!brain.bubble) { bubble.classList.remove('on'); return; }
    const head = character.world(0, 0.95);
    bubble.textContent = brain.bubble.text;
    bubble.classList.add('on');
    const bw = bubble.offsetWidth || 220;
    bubble.style.left = Math.max(12, Math.min(W - bw - 12, head.x - bw / 2)) + 'px';
    bubble.style.top = Math.max(12, head.y - bubble.offsetHeight - 26) + 'px';
}

function updateReadout(env) {
    const r = el('readout');
    if (!r || !settings.hud || wallpaperMode) return;
    const d = env.time;
    const pom = brain.pomodoro
        ? ` · 🍅 ${String(Math.floor(brain.pomodoro.left / 60)).padStart(2, '0')}:${String(Math.floor(brain.pomodoro.left % 60)).padStart(2, '0')}`
        : '';
    r.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        + ` · ${WEATHER_HE[env.weather]} ${Math.round(env.temp)}°`
        + ` · ${Math.round(fpsAvg)}fps${pom}`;
}

/* --------------------------------------------------------------- קלט */

function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointermove', (e) => {
    const p = canvasPoint(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
    desktop.pointerMove(p.x, p.y);
});

canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    canvas.setPointerCapture(e.pointerId);
    if (settings.icons && !wallpaperMode && desktop.pointerDown(p.x, p.y)) return;
    // לחיצה על הדמות = דגדוג; לחיצה על החול = היא הולכת לשם
    const dx = Math.abs(p.x - character.x);
    const dy = character.y - p.y;
    if (dx < character.height * 0.28 && dy > 0 && dy < character.height * 1.05) {
        brain.poke();
    } else if (p.y > world.shore) {
        brain.walkTarget = p.x;
        brain.act('walk', 8);
    }
});

canvas.addEventListener('pointerup', (e) => {
    desktop.pointerUp();
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
});

canvas.addEventListener('dblclick', () => brain.handle('dance'));

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    brain.keyActivity();
    const map = {
        r: 'rain', t: 'storm', s: 'clear', c: 'clouds', f: 'fog', w: 'snow',
        n: 'night', m: 'day', g: 'sunset', d: 'dance', p: 'protect',
        o: 'tidy', k: 'focus', j: 'joke', b: 'outfit', e: 'news',
    };
    const id = map[e.key.toLowerCase()];
    if (id && !e.metaKey && !e.ctrlKey) { brain.handle(id); return; }
    if (e.key === 'h') toggleHud();
    if (e.key === 'i') { settings.icons = !settings.icons; saveSettings(); syncButtons(); }
});

/* --------------------------------------------------------------- HUD */

function toggleHud() {
    settings.hud = !settings.hud;
    document.body.classList.toggle('no-hud', !settings.hud);
    saveSettings();
}

function syncButtons() {
    el('b-mic').classList.toggle('on', voice.wantRunning);
    el('b-sound').classList.toggle('on', settings.sound);
    el('b-music').classList.toggle('on', meter.active);
    el('b-icons').classList.toggle('on', settings.icons);
    el('b-protect').classList.toggle('on', desktop.protect);
    el('b-focus').classList.toggle('on', brain.focusMode);
    el('b-live').classList.toggle('on', settings.liveWeather);
}

function wireHud() {
    document.querySelectorAll('[data-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
            brain.handle(btn.dataset.cmd);
            syncButtons();
        });
    });

    el('b-mic').addEventListener('click', () => {
        if (!voice.supported) {
            brain.say('הדפדפן הזה לא תומך בזיהוי דיבור. בכרום זה עובד.');
            return;
        }
        voice.toggle('he-IL');
        settings.mic = voice.wantRunning;
        saveSettings();
        syncButtons();
        if (voice.wantRunning) brain.say('אני מקשיבה. תגיד "שיירד גשם".', 'happy');
    });

    el('b-sound').addEventListener('click', () => {
        settings.sound = !settings.sound;
        speaker.enabled = settings.sound;
        if (!settings.sound) speaker.shush();
        saveSettings();
        syncButtons();
    });

    el('b-music').addEventListener('click', async () => {
        if (meter.active) { meter.stop(); syncButtons(); return; }
        const ok = await meter.start();
        if (!ok) brain.say('לא קיבלתי גישה למיקרופון.');
        else brain.say('תפעיל מוזיקה ואני ארקוד 🎵', 'happy');
        syncButtons();
    });

    el('b-icons').addEventListener('click', () => {
        settings.icons = !settings.icons;
        saveSettings();
        syncButtons();
    });

    el('b-live').addEventListener('click', async () => {
        settings.liveWeather = !settings.liveWeather;
        saveSettings();
        syncButtons();
        if (settings.liveWeather) {
            brain.say('בודקת מה באמת קורה בחוץ…');
            const w = await brain.fetchWeather();
            brain.say(w ? `בחוץ ${WEATHER_HE[w]}, ${Math.round(brain.env.temp)} מעלות.` : 'לא הצלחתי להביא מזג אוויר.');
        }
    });

    el('b-shot').addEventListener('click', shot);
    el('b-rec').addEventListener('click', toggleRecord);
    el('b-hud').addEventListener('click', toggleHud);

    el('outfits').innerHTML = Object.entries(OUTFITS)
        .map(([k, o]) => `<button class="swatch" data-outfit="${k}" title="${o.name}"
             style="--a:${o.top};--b:${o.hair}"></button>`).join('');
    el('outfits').addEventListener('click', (e) => {
        const k = e.target.dataset.outfit;
        if (!k) return;
        character.setOutfit(k);
        settings.outfit = k;
        brain.mem.outfit = k;
        brain.save();
        saveSettings();
        brain.act('cheer', 1.6);
    });

    const say = el('say');
    el('say-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = say.value.trim();
        if (!text) return;
        say.value = '';
        const hit = matchCommand(text);
        if (hit) brain.handle(hit.id, text);
        else brain.say('לא הבנתי, אבל בסדר.', 'surprised');
    });
}

/* ------------------------------------------------ חלונית מצב פוטו */

const MEDIA_CTLS = {
    actor: {
        layer: () => photoActor,
        drop: 'drop-actor', file: 'file-actor', name: 'name-actor',
        map: {
            'a-scale': ['scale', (v) => v.toFixed(2) + '×'],
            'a-x': ['offsetX', (v) => Math.round(v) + 'px'],
            'a-y': ['offsetY', (v) => Math.round(v) + 'px'],
            'a-anchor': ['anchorY', (v) => Math.round(v * 100) + '%'],
            'a-hands': ['handsY', (v) => Math.round(v * 100) + '%'],
            'a-tol': ['tolerance', (v) => v.toFixed(3)],
            'a-soft': ['softness', (v) => v.toFixed(3)],
            'a-spill': ['spill', (v) => Math.round(v * 100) + '%'],
        },
        checks: { 'a-key': 'enabled', 'a-flip': 'flip' },
    },
    bg: {
        layer: () => photoBg,
        drop: 'drop-bg', file: 'file-bg', name: 'name-bg',
        map: {
            'g-scale': ['scale', (v) => v.toFixed(2) + '×'],
            'g-x': ['offsetX', (v) => Math.round(v) + 'px'],
            'g-y': ['offsetY', (v) => Math.round(v) + 'px'],
            'g-par': ['parallax', (v) => v.toFixed(2)],
        },
        checks: {},
    },
};

const rgbToHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const hexToRgbArr = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** מסנכרן את כל הפקדים עם הערכים בפועל של השכבה. */
function syncMedia() {
    for (const [kind, spec] of Object.entries(MEDIA_CTLS)) {
        const layer = spec.layer();
        for (const [id, [key, fmt]] of Object.entries(spec.map)) {
            const input = el(id);
            if (!input) continue;
            input.value = layer.cfg[key];
            const out = input.parentElement.querySelector('output');
            if (out) out.textContent = fmt(Number(layer.cfg[key]));
        }
        for (const [id, key] of Object.entries(spec.checks)) {
            const box = el(id);
            if (box) box.checked = !!layer.cfg[key];
        }
        const nameEl = el(spec.name);
        if (nameEl) {
            nameEl.textContent = layer.ready
                ? layer.name
                : (layer.err || (kind === 'bg' ? 'ציור (ברירת מחדל)' : 'לא נטען'));
        }
        el(spec.drop).classList.toggle('loaded', layer.ready);
    }
    const col = el('a-color');
    if (col) col.value = rgbToHex(photoActor.cfg.key);

    const hint = el('a-hint');
    hint.textContent = photoActor.hint || '';
    hint.hidden = !photoActor.hint;
}

async function loadMedia(kind, file) {
    if (!file) return;
    const spec = MEDIA_CTLS[kind];
    const layer = spec.layer();
    el(spec.name).textContent = 'טוען…';
    const ok = await layer.setFile(file);
    syncMedia();
    if (ok) {
        brain.say(kind === 'actor' ? 'זאת אני עכשיו.' : 'החלפתי רקע.', 'happy');
    } else {
        brain.say('לא הצלחתי לפתוח את הקובץ הזה.', 'sad');
    }
}

function wireMedia() {
    const sheet = el('media');
    el('b-media').addEventListener('click', () => {
        sheet.hidden = !sheet.hidden;
        if (!sheet.hidden) syncMedia();
    });
    el('media-close').addEventListener('click', () => { sheet.hidden = true; });

    document.querySelectorAll('.tabs .tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab').forEach((t) => t.classList.toggle('on', t === tab));
            document.querySelectorAll('[data-panel]').forEach((p) => {
                p.hidden = p.dataset.panel !== tab.dataset.tab;
            });
        });
    });

    for (const [kind, spec] of Object.entries(MEDIA_CTLS)) {
        const layer = spec.layer();
        el(spec.file).addEventListener('change', (e) => loadMedia(kind, e.target.files[0]));

        const drop = el(spec.drop);
        ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
            e.preventDefault();
            drop.classList.add('over');
        }));
        ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loadMedia(kind, e.dataTransfer.files[0]);
        });

        for (const [id, [key, fmt]] of Object.entries(spec.map)) {
            const input = el(id);
            input.addEventListener('input', () => {
                layer.cfg[key] = Number(input.value);
                const out = input.parentElement.querySelector('output');
                if (out) out.textContent = fmt(Number(input.value));
                layer.saveCfg();
            });
        }
        for (const [id, key] of Object.entries(spec.checks)) {
            el(id).addEventListener('change', (e) => {
                layer.cfg[key] = e.target.checked;
                layer.saveCfg();
            });
        }
    }

    el('a-color').addEventListener('input', (e) => {
        photoActor.cfg.key = hexToRgbArr(e.target.value);
        photoActor.saveCfg();
    });
    el('a-auto').addEventListener('click', () => {
        photoActor.autoKey();
        photoActor.cfg.enabled = true;
        photoActor.saveCfg();
        syncMedia();
    });
    el('a-clear').addEventListener('click', async () => {
        await photoActor.clear();
        syncMedia();
        brain.say('חזרתי לצורה המצוירת.');
    });
    el('g-clear').addEventListener('click', async () => {
        await photoBg.clear();
        syncMedia();
    });

    // גרירה לכל מקום בעמוד -> נטען כדמות
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
        dragDepth++;
        document.body.classList.add('dropping');
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragleave', () => {
        if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); }
    });
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDepth = 0;
        document.body.classList.remove('dropping');
        const f = e.dataTransfer.files[0];
        if (!f) return;
        sheet.hidden = false;
        loadMedia('actor', f);
    });
}

/* ----------------------------------------------------- צילום והקלטה */

function shot() {
    const hud = settings.hud;
    canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wallpaper-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
    el('flash').classList.add('fire');
    setTimeout(() => el('flash').classList.remove('fire'), 260);
}

function toggleRecord() {
    if (recorder) {
        recorder.stop();
        return;
    }
    if (!canvas.captureStream || !window.MediaRecorder) {
        brain.say('הדפדפן הזה לא תומך בהקלטה.');
        return;
    }
    const stream = canvas.captureStream(30);
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
    recChunks = [];
    recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(recChunks, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wallpaper-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 8000);
        recorder = null;
        el('b-rec').classList.remove('on');
        el('b-rec').textContent = '⏺';
    };
    recorder.start();
    el('b-rec').classList.add('on');
    el('b-rec').textContent = '⏹';
}

/* ------------------------------------------------------------ הפעלה */

function start() {
    el('intro').classList.add('gone');
    document.body.classList.add('live');
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);

    speaker.enabled = settings.sound;
    character.setOutfit(brain.mem.outfit || settings.outfit);
    brain.greet();
    brain.watchBattery();

    if (settings.news) brain.fetchNews().then(() => setInterval(() => brain.fetchNews(), 5 * 60 * 1000));
    if (settings.liveWeather) {
        brain.fetchWeather();
        setInterval(() => { if (settings.liveWeather) brain.fetchWeather(); }, 15 * 60 * 1000);
    }
    if (settings.mic && voice.supported) voice.start('he-IL');
    syncButtons();
}

voice.onCommand = (hit) => {
    el('heard').textContent = hit.text;
    el('heard').classList.add('on');
    brain.handle(hit.id, hit.text);
    syncButtons();
};

voice.onTranscript = (text, final) => {
    const h = el('heard');
    h.textContent = text;
    h.classList.add('on');
    clearTimeout(h._t);
    h._t = setTimeout(() => h.classList.remove('on'), final ? 2600 : 4000);
};

voice.onState = (on, why) => {
    el('b-mic').classList.toggle('on', on);
    if (why === 'denied') brain.say('לא נתת לי גישה למיקרופון, אז אני לא שומעת.');
};

speaker.onBoundary = () => { character.talk = 1; };
speaker.onEnd = () => { character.talk = 0; };

desktop.onCatch = (ic) => brain.caught(ic);
desktop.onPoke = (type, obj) => {
    if (type === 'icon' && brain.busy <= 0 && Math.random() < 0.35) {
        brain.act('peek', 1.8);
    }
};
brain.onShot = shot;

/* ---------------------------------------------------- התקנה כאפליקציה */

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    el('b-install').classList.remove('hidden');
});
el('b-install').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    el('b-install').classList.add('hidden');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* -------------------------------------------------------------- אתחול */

resize();
wireHud();
wireMedia();
loadSavedMedia().then(syncMedia).catch(() => syncMedia());

/**
 * סדר העדיפות: מה שהמשתמש העלה במכשיר הזה, ואם אין - נכסים שנשמרו
 * בריפו עצמו תחת docs/wall/media/ (ראו media/README.md).
 */
async function loadSavedMedia() {
    const [actorSaved, bgSaved] = await Promise.all([
        photoActor.restore().catch(() => false),
        photoBg.restore().catch(() => false),
    ]);
    if (actorSaved && bgSaved) return;

    let manifest = null;
    try {
        const res = await fetch('media/manifest.json', { cache: 'no-store' });
        if (res.ok) manifest = await res.json();
    } catch (_) { /* אין תיקיית מדיה - זה המצב הרגיל */ }
    if (!manifest) return;

    if (!actorSaved && manifest.actor) {
        photoActor.loadCfg();
        if (manifest.actorConfig) Object.assign(photoActor.cfg, manifest.actorConfig);
        await photoActor.attachUrl('media/' + manifest.actor);
    }
    if (!bgSaved && manifest.bg) {
        photoBg.loadCfg();
        if (manifest.bgConfig) Object.assign(photoBg.cfg, manifest.bgConfig);
        await photoBg.attachUrl('media/' + manifest.bg);
    }
}
el('b-start').addEventListener('click', start);
if (!voice.supported) el('mic-note').textContent = 'זיהוי דיבור זמין בכרום ובאדג\'.';
if (wallpaperMode) {
    document.body.classList.add('no-hud', 'wallpaper');
    start();
}

// תצוגה סטטית מאחורי מסך הפתיחה, כדי שיראו לאן נכנסים.
// במצב טפט הלולאה כבר רצה, ואז אין מה לצייר כאן.
if (!running) {
    brain.update(0.016, null);
    character.update(0.016, brain.env);
    world.update(0.016, brain.env);
    world.draw(ctx, brain.env);
    world.drawGloom(ctx, brain.env);
    character.draw(ctx, brain.env);
    world.drawForeground(ctx, brain.env);
}
