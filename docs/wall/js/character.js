/*
 * character.js - הדמות שחיה על הטפט.
 *
 * דמות וקטורית שנבנית כולה בקוד: שלד עם מפרקים, מערכת תנוחות עם מעבר
 * רך ביניהן, שיער עם פיזיקה של קפיצים, הבעות פנים, ומבט שעוקב אחרי הסמן.
 * אין קבצי ספרייט ואין מודלים - הכל מצויר בזמן ריצה, ולכן נראה חד בכל רזולוציה.
 *
 * מערכת צירים מקומית: המוצא ברגליים, y גדל כלפי מעלה, x חיובי = "קדימה"
 * (לכיוון שאליו הדמות פונה). המרה לעולם נעשית ב-`world()`.
 * זווית 0 של איבר = מצביע ישר למטה; זווית חיובית מסובבת קדימה.
 */

/* --------------------------------------------------------- פרופורציות */

const P = {
    ankle: 0.045, knee: 0.265, hip: 0.500,     // גבהים יחסיים לגובה הדמות
    chest: 0.720, shoulder: 0.775, neck: 0.800,
    headY: 0.905, headR: 0.080,                // ~5.3 ראשים לגובה - סגנון נקי
    hipHalf: 0.068, shoulderHalf: 0.098,
    thigh: 0.235, shin: 0.220, foot: 0.080,
    upperArm: 0.185, foreArm: 0.170, hand: 0.052,
};

export const OUTFITS = {
    teal: { name: 'טורקיז', skin: '#f0c9a8', skinDark: '#d7a681', hair: '#c9643a', hairDark: '#8f3f22', top: '#18a999', topDark: '#0e6f66', pants: '#2a3550', pantsDark: '#1b2338', shoe: '#f2f5f8' },
    sunset: { name: 'שקיעה', skin: '#e9bc93', skinDark: '#cd9a6d', hair: '#2b2118', hairDark: '#140f0a', top: '#f0704f', topDark: '#b8462c', pants: '#f4e2c4', pantsDark: '#d3bd99', shoe: '#3b3b44' },
    night: { name: 'לילה', skin: '#c99b77', skinDark: '#a97b59', hair: '#1c1c26', hairDark: '#0c0c12', top: '#5b46d6', topDark: '#3a2b96', pants: '#21212c', pantsDark: '#141419', shoe: '#e8e8f0' },
    mint: { name: 'מנטה', skin: '#f6d9c0', skinDark: '#dcb493', hair: '#f0c862', hairDark: '#c39a34', top: '#eaf4ef', topDark: '#c2d4ca', pants: '#3aa76d', pantsDark: '#24714a', shoe: '#2f3640' },
};

/* --------------------------------------------------------------- עזרים */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blankPose() {
    return {
        bob: 0, sway: 0, lean: 0, spine: 0, head: 0,
        armL: [-0.06, 0.05], armR: [0.06, 0.05],
        legL: [-0.02, 0.02], legR: [0.02, 0.02],
        crouch: 0,
    };
}

function blendPose(a, b, t) {
    const out = blankPose();
    for (const k of ['bob', 'sway', 'lean', 'spine', 'head', 'crouch']) {
        out[k] = lerp(a[k], b[k], t);
    }
    for (const k of ['armL', 'armR', 'legL', 'legR']) {
        out[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)];
    }
    return out;
}

/* ------------------------------------------------------------- תנוחות */

// כל תנוחה מקבלת (t, c) ומחזירה pose. t = זמן בתוך המצב בשניות.
export const POSES = {
    idle(t) {
        const p = blankPose();
        const br = Math.sin(t * 1.5);
        p.bob = br * 0.006;
        p.sway = Math.sin(t * 0.42) * 0.012;
        p.spine = Math.sin(t * 0.42) * 0.035;
        p.lean = Math.sin(t * 0.31) * 0.02;
        p.head = Math.sin(t * 0.55 + 1) * 0.05;
        p.armL = [-0.15 + Math.sin(t * 0.7) * 0.035, 0.20 + br * 0.04];
        p.armR = [0.15 + Math.sin(t * 0.7 + 0.6) * 0.035, 0.22 + br * 0.04];
        p.legL = [-0.035, 0.05];
        p.legR = [0.035, 0.05];
        return p;
    },

    wave(t) {
        const p = POSES.idle(t * 0.6);
        const w = Math.sin(t * 8.5);
        p.armR = [2.35 + w * 0.22, 0.55 - w * 0.35];
        p.head = 0.10 + w * 0.03;
        p.bob += Math.sin(t * 4) * 0.008;
        return p;
    },

    cheer(t) {
        const p = blankPose();
        const j = Math.abs(Math.sin(t * 4.6));
        p.bob = j * 0.055;
        p.armL = [-2.5 - Math.sin(t * 9) * 0.1, -0.3];
        p.armR = [2.5 + Math.sin(t * 9) * 0.1, 0.3];
        p.legL = [-0.12 + j * 0.08, 0.18 + j * 0.4];
        p.legR = [0.12 - j * 0.08, 0.18 + j * 0.4];
        p.head = -0.08;
        return p;
    },

    walk(t) {
        const p = blankPose();
        const s = t * 5.4;
        p.bob = Math.abs(Math.sin(s)) * 0.018 - 0.008;
        p.lean = 0.06;
        p.spine = 0.04;
        p.legL = [Math.sin(s) * 0.52, 0.12 + Math.max(0, -Math.sin(s)) * 0.75];
        p.legR = [Math.sin(s + Math.PI) * 0.52, 0.12 + Math.max(0, -Math.sin(s + Math.PI)) * 0.75];
        p.armL = [Math.sin(s + Math.PI) * 0.42, 0.28];
        p.armR = [Math.sin(s) * 0.42, 0.28];
        p.head = Math.sin(s * 2) * 0.02;
        return p;
    },

    dance(t, c) {
        const p = blankPose();
        const b = c && c.beat ? c.beat : 1;
        const s = t * 5.0;
        p.bob = Math.abs(Math.sin(s)) * 0.045 * b;
        p.sway = Math.sin(s * 0.5) * 0.055 * b;
        p.lean = Math.sin(s * 0.5) * 0.10;
        p.spine = Math.sin(s * 0.5 + 1) * 0.10;
        p.head = Math.sin(s * 0.5 + 0.4) * 0.14;
        p.armL = [-1.9 - Math.sin(s) * 0.7, -0.5 - Math.sin(s * 0.5) * 0.5];
        p.armR = [1.9 + Math.sin(s + 2.1) * 0.7, 0.5 + Math.sin(s * 0.5 + 1) * 0.5];
        p.legL = [-0.16 - Math.sin(s) * 0.14, 0.2];
        p.legR = [0.16 + Math.sin(s) * 0.14, 0.2];
        return p;
    },

    hold(t) {
        const p = POSES.idle(t * 0.5);
        // שתי הידיים קדימה - בתצוגת צד זה אומר שתיהן בזווית חיובית
        p.armL = [1.32, 1.02];
        p.armR = [1.52, 0.96];
        p.spine = -0.04;
        p.head = 0.06;
        return p;
    },

    shield(t) {
        const p = blankPose();
        p.bob = Math.sin(t * 2.2) * 0.005;
        p.crouch = 0.05;
        p.spine = 0.16;
        p.head = 0.22;
        p.armL = [-2.45, -0.95];            // ידיים גבוה מעל הראש
        p.armR = [2.45, 0.95];
        p.legL = [-0.1, 0.22];
        p.legR = [0.1, 0.22];
        return p;
    },

    shiver(t) {
        const p = blankPose();
        const q = Math.sin(t * 26) * 0.006;
        p.sway = q;
        p.bob = Math.abs(q) - 0.004;
        p.crouch = 0.06;
        p.spine = 0.2;
        p.head = 0.18;
        p.armL = [1.05, 1.5];
        p.armR = [0.88, 1.7];
        p.legL = [-0.05, 0.16];
        p.legR = [0.05, 0.16];
        return p;
    },

    towel(t) {
        const p = blankPose();
        p.bob = Math.sin(t * 6) * 0.008;
        p.spine = 0.10;
        p.head = Math.sin(t * 6) * 0.14;
        p.armL = [-2.45 - Math.sin(t * 6) * 0.25, -0.7];
        p.armR = [2.45 + Math.sin(t * 6 + 1.3) * 0.25, 0.7];
        return p;
    },

    point(t, c) {
        const p = POSES.idle(t * 0.5);
        const a = c && c.pointAngle != null ? c.pointAngle : 1.5;
        p.armR = [a, 0.05];
        p.spine = 0.05;
        p.head = 0.08;
        return p;
    },

    sit(t) {
        const p = blankPose();
        p.crouch = 0.44;                    // האגן יורד כמעט עד החול
        p.bob = Math.sin(t * 1.2) * 0.004;
        p.spine = 0.05;
        p.lean = -0.10;                     // נשענת קצת אחורה
        p.legL = [1.46, 0.18];              // רגליים מתוחות קדימה על החול
        p.legR = [1.62, -0.02];
        p.armL = [-0.85, 0.18];             // כף יד נשענת מאחור
        p.armR = [0.62, 0.42];
        p.head = Math.sin(t * 0.6) * 0.06;
        return p;
    },

    sleep(t) {
        const p = POSES.sit(t * 0.3);
        p.spine = 0.3;
        p.head = 0.45 + Math.sin(t * 0.8) * 0.05;
        p.armL = [-0.6, 0.5];
        p.armR = [0.72, 0.9];
        return p;
    },

    stretch(t) {
        const p = blankPose();
        const k = Math.sin(clamp(t, 0, Math.PI * 0.99) * 1.6);
        p.bob = k * 0.03;
        p.spine = -k * 0.18;
        p.head = -k * 0.3;
        p.armL = [-2.6 * k, -0.35 * k];
        p.armR = [2.6 * k, 0.35 * k];
        return p;
    },

    focus(t) {
        const p = blankPose();
        p.crouch = 0.03;
        p.spine = 0.18;
        p.lean = 0.06;
        p.head = 0.16;
        p.bob = Math.sin(t * 1.1) * 0.004;
        p.armL = [0.80, 1.15];
        p.armR = [0.95, 1.05];
        p.legL = [-0.06, 0.1];
        p.legR = [0.06, 0.1];
        return p;
    },

    peek(t) {
        const p = POSES.idle(t * 0.6);
        p.lean = 0.22;
        p.spine = 0.12;
        p.head = 0.10;
        p.armL = [-0.3, 0.5];
        return p;
    },
};

/* ----------------------------------------------------------- הבעות פנים */

export const MOODS = {
    neutral: { brow: 0, browTilt: 0, eye: 1, smile: 0.25, blush: 0 },
    happy: { brow: -0.05, browTilt: -0.1, eye: 0.82, smile: 1, blush: 0.25 },
    love: { brow: -0.06, browTilt: -0.15, eye: 0.7, smile: 0.9, blush: 0.8, hearts: true },
    surprised: { brow: -0.22, browTilt: 0, eye: 1.35, smile: 0.1, open: 0.8, blush: 0 },
    sad: { brow: 0.05, browTilt: 0.35, eye: 0.85, smile: -0.7, blush: 0 },
    sleepy: { brow: 0.06, browTilt: 0.15, eye: 0.25, smile: 0.1, blush: 0 },
    annoyed: { brow: 0.08, browTilt: -0.45, eye: 0.7, smile: -0.35, blush: 0 },
    focused: { brow: 0.05, browTilt: -0.25, eye: 0.85, smile: 0, blush: 0 },
    cold: { brow: 0.04, browTilt: 0.3, eye: 0.6, smile: -0.4, blush: 0.5, blue: true },
};

/* ============================================================== הדמות */

export class Character {
    constructor(opts = {}) {
        this.x = 0;
        this.y = 0;
        this.height = 300;
        this.facing = 1;
        this.outfit = OUTFITS[opts.outfit] || OUTFITS.teal;

        this.state = 'idle';
        this.prev = 'idle';
        this.stateT = 0;
        this.prevT = 0;
        this.blend = 1;                 // 1 = המצב הנוכחי לבדו
        this.ctxParams = {};

        this.mood = 'happy';
        this.moodMix = { ...MOODS.happy };
        this.blink = 0;
        this.nextBlink = 2;
        this.talk = 0;                  // 0..1 - פתיחת פה בזמן דיבור
        this.wet = 0;
        this.look = { x: 0, y: 0 };     // יעד מבט בעולם
        this.lookAmt = { x: 0, y: 0 };  // ערך מוחלק
        this.hold = null;               // { w, h, draw(ctx,w,h) }
        this.hearts = [];

        // שיער - שרשראות קפיצים שמגיבות לרוח ולתנועת הראש
        this.strands = [];
        // base = הזווית על הגולגולת שממנה יוצאת הקווצה (0 = קודקוד,
        // חיובי = לכיוון הפנים). הקווצות האחוריות הן המסה הארוכה; הקדמית
        // היא קווצה דקה לצד הלחי, שלא מכסה את הפנים.
        const defs = [
            { base: -2.35, len: 0.30, w: 0.075, back: true },
            { base: -1.75, len: 0.36, w: 0.085, back: true },
            { base: -1.10, len: 0.34, w: 0.070, back: true },
            { base: -0.45, len: 0.26, w: 0.050, back: true },
            { base: 1.62, len: 0.20, w: 0.030, back: false },
        ];
        for (const d of defs) {
            const n = 6;
            this.strands.push({
                ...d,
                pts: Array.from({ length: n }, (_, i) => ({ x: 0, y: 0, px: 0, py: 0, i })),
                n,
            });
        }
        this.strandsReady = false;
        this.pose = blankPose();
        this.skeleton = null;
    }

    setOutfit(key) { if (OUTFITS[key]) this.outfit = OUTFITS[key]; }

    /** מעבר למצב חדש עם מיזוג רך. */
    play(state, params = {}) {
        if (!POSES[state]) return;
        if (this.state === state && !params.force) { Object.assign(this.ctxParams, params); return; }
        this.prev = this.state;
        this.prevT = this.stateT;
        this.state = state;
        this.stateT = 0;
        this.blend = 0;
        this.ctxParams = params;
    }

    setMood(mood) { if (MOODS[mood]) this.mood = mood; }

    /* ------------------------------------------------------------ עדכון */

    update(dt, env) {
        this.stateT += dt;
        this.prevT += dt;
        this.blend = Math.min(1, this.blend + dt / 0.32);

        const cur = POSES[this.state](this.stateT, this.ctxParams);
        this.pose = this.blend >= 1 ? cur
            : blendPose(POSES[this.prev](this.prevT, this.ctxParams), cur, this.blend * this.blend * (3 - 2 * this.blend));

        // מצמוץ
        this.nextBlink -= dt;
        if (this.nextBlink <= 0) {
            this.blink = 1;
            this.nextBlink = 1.6 + Math.random() * 4.2;
        }
        this.blink = Math.max(0, this.blink - dt * 7);

        // מעבר רך בין הבעות
        const target = MOODS[this.mood];
        for (const k of Object.keys(this.moodMix)) {
            if (typeof this.moodMix[k] === 'number') {
                this.moodMix[k] += ((target[k] || 0) - this.moodMix[k]) * Math.min(1, dt * 6);
            }
        }
        this.moodMix.hearts = !!target.hearts;
        this.moodMix.blue = !!target.blue;
        this.moodMix.open = lerp(this.moodMix.open || 0, target.open || 0, Math.min(1, dt * 6));

        this.talk = Math.max(0, this.talk - dt * 3.2);
        this.wet = clamp(this.wet, 0, 1);

        this.buildSkeleton();
        this.updateHair(dt, env);
        this.updateHearts(dt);
    }

    /* ------------------------------------------------------------- שלד */

    world(x, y) {
        const S = this.height;
        return { x: this.x + x * S * this.facing, y: this.y - y * S };
    }

    buildSkeleton() {
        const p = this.pose;
        const S = this.height;
        const drop = p.crouch;
        const baseY = P.hip - drop + p.bob;

        // אגן, חזה, כתפיים, ראש - שרשרת שנבנית כלפי מעלה עם כיפוף הגב
        const hip = { x: p.sway, y: baseY };
        const torsoLen = P.chest - P.hip;
        const chest = {
            x: hip.x + Math.sin(p.spine) * torsoLen + p.lean * 0.10,
            y: hip.y + Math.cos(p.spine) * torsoLen,
        };
        const shLen = P.shoulder - P.chest;
        const sh = {
            x: chest.x + Math.sin(p.spine + p.lean) * shLen,
            y: chest.y + Math.cos(p.spine + p.lean) * shLen,
        };
        const neckLen = P.neck - P.shoulder;
        const neck = {
            x: sh.x + Math.sin(p.spine + p.lean + p.head * 0.4) * neckLen,
            y: sh.y + Math.cos(p.spine + p.lean + p.head * 0.4) * neckLen,
        };
        const headLen = P.headY - P.neck;
        const headAng = p.spine + p.lean + p.head;
        const head = {
            x: neck.x + Math.sin(headAng) * headLen,
            y: neck.y + Math.cos(headAng) * headLen,
        };

        const limb = (root, a0, a1, l0, l1) => {
            const mid = { x: root.x + Math.sin(a0) * l0, y: root.y - Math.cos(a0) * l0 };
            const end = { x: mid.x + Math.sin(a0 + a1) * l1, y: mid.y - Math.cos(a0 + a1) * l1 };
            return { root, mid, end };
        };

        const shOff = P.shoulderHalf * 0.80;
        const armRoot = (s) => ({ x: sh.x + s * shOff, y: sh.y - 0.012 });
        const hipRoot = (s) => ({ x: hip.x + s * P.hipHalf * 0.62, y: hip.y });

        const armFar = limb(armRoot(-1), p.armL[0], p.armL[1], P.upperArm, P.foreArm);
        const armNear = limb(armRoot(1), p.armR[0], p.armR[1], P.upperArm, P.foreArm);
        const legFar = limb(hipRoot(-1), p.legL[0], p.legL[1], P.thigh, P.shin);
        const legNear = limb(hipRoot(1), p.legR[0], p.legR[1], P.thigh, P.shin);

        this.skeleton = {
            hip, chest, sh, neck, head, headAng, armFar, armNear, legFar, legNear,
            shOff, S,
            headWorld: this.world(head.x, head.y),
            handNear: this.world(armNear.end.x, armNear.end.y),
            handFar: this.world(armFar.end.x, armFar.end.y),
        };
    }

    /** נקודת אחיזה בין שתי הידיים - לשם נצמד חפץ שהדמות מחזיקה. */
    graspPoint() {
        const s = this.skeleton;
        if (!s) return { x: this.x, y: this.y };
        return { x: (s.handNear.x + s.handFar.x) / 2, y: (s.handNear.y + s.handFar.y) / 2 };
    }

    /* ------------------------------------------------------------- שיער */

    updateHair(dt, env) {
        const s = this.skeleton;
        const S = this.height;
        const wind = (env && env.wind ? env.wind : 0) * this.facing * -1;
        const stiff = 0.42 - this.wet * 0.16;      // שיער רטוב נופל יותר ישר
        const grav = 1.55 + this.wet * 0.9;

        for (const st of this.strands) {
            const ang = s.headAng + st.base;
            const anchor = {
                x: s.head.x + Math.sin(ang) * P.headR * 0.95,
                y: s.head.y + Math.cos(ang) * P.headR * 0.95,
            };
            const seg = st.len / (st.n - 1);
            if (!this.strandsReady) {
                st.pts.forEach((pt, i) => {
                    pt.x = anchor.x;
                    pt.y = anchor.y - i * seg;
                    pt.px = pt.x;
                    pt.py = pt.y;
                });
                continue;
            }
            st.pts[0].x = anchor.x;
            st.pts[0].y = anchor.y;
            for (let i = 1; i < st.n; i++) {
                const pt = st.pts[i];
                const vx = (pt.x - pt.px) * 0.86;
                const vy = (pt.y - pt.py) * 0.86;
                pt.px = pt.x;
                pt.py = pt.y;
                pt.x += vx + (wind * 0.9 + Math.sin(performance.now() / 700 + i)) * 0.0016 * (i / st.n);
                pt.y += vy - grav * dt * 0.09;
                // אילוץ אורך מול החוליה הקודמת
                const prev = st.pts[i - 1];
                const dx = pt.x - prev.x, dy = pt.y - prev.y;
                const d = Math.hypot(dx, dy) || 1e-6;
                const k = (d - seg) / d;
                pt.x -= dx * k;
                pt.y -= dy * k;
                // נטייה חזרה לכיוון הטבעי של הקווצה
                const rest = {
                    x: anchor.x + Math.sin(ang + 0.15) * seg * i * 0.35,
                    y: anchor.y - seg * i * 0.94,
                };
                pt.x += (rest.x - pt.x) * stiff * Math.min(1, dt * 9);
                pt.y += (rest.y - pt.y) * stiff * Math.min(1, dt * 9);
            }
        }
        this.strandsReady = true;
    }

    /* ------------------------------------------------------------ לבבות */

    pop(kind = 'heart') {
        const g = this.graspPoint();
        this.hearts.push({
            x: g.x + (Math.random() - 0.5) * this.height * 0.2,
            y: this.world(0, P.headY).y,
            vy: -40 - Math.random() * 30,
            vx: (Math.random() - 0.5) * 30,
            life: 1.6,
            kind,
            s: 0.7 + Math.random() * 0.6,
        });
    }

    updateHearts(dt) {
        for (let i = this.hearts.length - 1; i >= 0; i--) {
            const h = this.hearts[i];
            h.life -= dt;
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            h.vy += 8 * dt;
            if (h.life <= 0) this.hearts.splice(i, 1);
        }
    }

    /* -------------------------------------------------------------- ציור */

    draw(ctx, env) {
        if (!this.skeleton) return;
        const S = this.height;
        const padX = S * 0.95, padTop = S * 1.45, padBot = S * 0.22;
        const bx = Math.floor(this.x - padX), by = Math.floor(this.y - padTop);
        const bw = Math.ceil(padX * 2), bh = Math.ceil(padTop + padBot);
        const dpr = this.dpr || 1;

        if (!this._buf || this._bw !== bw || this._bh !== bh || this._bdpr !== dpr) {
            this._buf = document.createElement('canvas');
            this._buf.width = Math.max(1, Math.round(bw * dpr));
            this._buf.height = Math.max(1, Math.round(bh * dpr));
            this._bctx = this._buf.getContext('2d');
            this._bw = bw;
            this._bh = bh;
            this._bdpr = dpr;
        }

        const b = this._bctx;
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, this._buf.width, this._buf.height);
        b.setTransform(dpr, 0, 0, dpr, -bx * dpr, -by * dpr);
        this.drawBody(b, env);

        this.drawShadow(ctx, env);
        ctx.save();
        ctx.shadowColor = 'rgba(8,14,26,0.5)';
        ctx.shadowBlur = S * 0.032;
        ctx.drawImage(this._buf, bx, by, bw, bh);
        ctx.restore();

        this.drawHearts(ctx);
    }

    drawBody(ctx, env) {
        const s = this.skeleton;
        if (!s) return;
        const S = this.height;
        const o = this.outfit;
        const night = env && env.sunAlt < -0.02;
        const gloom = env ? ({ storm: 0.30, rain: 0.16, snow: 0.10, fog: 0.12, clouds: 0.06 }[env.weather] || 0) : 0;
        const shade = Math.min(0.62, (night ? 0.45 : 0) + gloom);

        const tint = (hex, amt) => {
            if (!amt) return hex;
            const n = parseInt(hex.slice(1), 16);
            const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
            return `rgb(${Math.round(r * (1 - amt) + 40 * amt)},${Math.round(g * (1 - amt) + 52 * amt)},${Math.round(b * (1 - amt) + 84 * amt)})`;
        };
        const C = {
            skin: tint(o.skin, shade), skinDark: tint(o.skinDark, shade),
            hair: tint(o.hair, shade + this.wet * 0.2), hairDark: tint(o.hairDark, shade + this.wet * 0.2),
            top: tint(o.top, shade), topDark: tint(o.topDark, shade),
            pants: tint(o.pants, shade), pantsDark: tint(o.pantsDark, shade),
            shoe: tint(o.shoe, shade),
        };

        ctx.save();

        // --- שכבה אחורית: זרוע ורגל רחוקות, שיער מאחור
        this.drawHair(ctx, C, true);
        this.drawLeg(ctx, s.legFar, C, 0.86);
        this.drawArm(ctx, s.armFar, C, 0.88);

        // --- גוף
        this.drawTorso(ctx, C);

        // --- שכבה קדמית
        this.drawLeg(ctx, s.legNear, C, 1);
        this.drawHead(ctx, C, env);
        this.drawArm(ctx, s.armNear, C, 1);

        if (this.hold) this.drawHeld(ctx);
        if (this.wet > 0.15) this.drawDrips(ctx);

        ctx.restore();
    }

    drawShadow(ctx, env) {
        const S = this.height;
        const w = S * 0.30 * (1 - this.pose.crouch * 0.4);
        const alpha = env && env.sunAlt < -0.05 ? 0.18 : 0.30;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, w);
        g.addColorStop(0, `rgba(30,24,16,${alpha})`);
        g.addColorStop(1, 'rgba(30,24,16,0)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1, 0.26);
        ctx.beginPath();
        ctx.arc(0, 0, w, 0, 6.2832);
        ctx.fill();
        ctx.restore();
    }

    /** קפסולה מתחדדת בין שתי נקודות. */
    taper(ctx, a, b, r1, r2) {
        const A = this.world(a.x, a.y);
        const B = this.world(b.x, b.y);
        const S = this.height;
        const ang = Math.atan2(B.y - A.y, B.x - A.x);
        ctx.beginPath();
        ctx.arc(A.x, A.y, r1 * S, ang - Math.PI / 2, ang + Math.PI / 2, true);
        ctx.arc(B.x, B.y, r2 * S, ang + Math.PI / 2, ang - Math.PI / 2, true);
        ctx.closePath();
    }

    drawArm(ctx, arm, C, depth) {
        const sleeve = 0.42;   // עד איפה מגיע השרוול לאורך הזרוע העליונה
        ctx.globalAlpha = depth < 1 ? 0.95 : 1;
        // זרוע עליונה - עור
        ctx.fillStyle = depth < 1 ? C.skinDark : C.skin;
        this.taper(ctx, arm.root, arm.mid, 0.040, 0.031);
        ctx.fill();
        // אמה
        this.taper(ctx, arm.mid, arm.end, 0.031, 0.022);
        ctx.fill();
        // שרוול
        const sl = { x: lerp(arm.root.x, arm.mid.x, sleeve), y: lerp(arm.root.y, arm.mid.y, sleeve) };
        ctx.fillStyle = depth < 1 ? C.topDark : C.top;
        this.taper(ctx, arm.root, sl, 0.048, 0.040);
        ctx.fill();
        // כף יד
        const hd = { x: arm.end.x + (arm.end.x - arm.mid.x) * 0.28, y: arm.end.y + (arm.end.y - arm.mid.y) * 0.28 };
        ctx.fillStyle = depth < 1 ? C.skinDark : C.skin;
        this.taper(ctx, arm.end, hd, 0.026, 0.020);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    drawLeg(ctx, leg, C, depth) {
        const S = this.height;
        ctx.globalAlpha = depth < 1 ? 0.95 : 1;
        // ירך + שוק
        ctx.fillStyle = depth < 1 ? C.pantsDark : C.pants;
        this.taper(ctx, leg.root, leg.mid, 0.058, 0.040);
        ctx.fill();
        ctx.fillStyle = depth < 1 ? C.skinDark : C.skin;
        this.taper(ctx, leg.mid, leg.end, 0.036, 0.024);
        ctx.fill();
        // כף רגל - עקב מעוגל וקצה מתחדד קדימה
        const heel = { x: leg.end.x, y: Math.max(0.022, leg.end.y) };
        const toe = { x: heel.x + P.foot, y: Math.max(0.016, heel.y - 0.008) };
        ctx.fillStyle = C.shoe;
        this.taper(ctx, heel, toe, 0.030, 0.019);
        ctx.fill();
        ctx.fillStyle = 'rgba(20,26,38,0.22)';
        this.taper(ctx, { x: heel.x, y: 0.007 }, { x: toe.x, y: 0.007 }, 0.010, 0.008);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    drawTorso(ctx, C) {
        const s = this.skeleton;
        const S = this.height;
        const p = this.pose;
        const hipW = P.hipHalf, shW = P.shoulderHalf;

        const pts = [
            { x: s.hip.x - hipW, y: s.hip.y },
            { x: s.chest.x - shW * 0.96, y: s.chest.y },
            { x: s.sh.x - shW, y: s.sh.y + 0.012 },
            { x: s.sh.x + shW, y: s.sh.y + 0.012 },
            { x: s.chest.x + shW * 0.96, y: s.chest.y },
            { x: s.hip.x + hipW, y: s.hip.y },
        ].map((q) => this.world(q.x, q.y));

        // חולצה
        ctx.fillStyle = C.top;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.quadraticCurveTo(pts[1].x - (pts[1].x - pts[0].x) * 0.1, (pts[0].y + pts[1].y) / 2, pts[2].x, pts[2].y);
        ctx.quadraticCurveTo((pts[2].x + pts[3].x) / 2, pts[2].y - S * 0.018, pts[3].x, pts[3].y);
        ctx.quadraticCurveTo(pts[4].x + (pts[4].x - pts[5].x) * 0.1, (pts[5].y + pts[4].y) / 2, pts[5].x, pts[5].y);
        ctx.quadraticCurveTo((pts[5].x + pts[0].x) / 2, pts[5].y + S * 0.02, pts[0].x, pts[0].y);
        ctx.closePath();
        ctx.fill();

        // הצללה בצד הרחוק
        ctx.save();
        ctx.clip();
        ctx.fillStyle = C.topDark;
        ctx.globalAlpha = 0.55;
        const far = this.world(s.hip.x - hipW * 1.2, s.sh.y + 0.05);
        ctx.fillRect(Math.min(far.x, far.x - S * 0.2), far.y, S * (this.facing > 0 ? 0.075 : 0.075), S);
        ctx.restore();

        // אגן - צורה מעוגלת שמחברת את החולצה לרגליים
        ctx.fillStyle = C.pants;
        const pL = this.world(s.hip.x - hipW * 1.06, s.hip.y + 0.045);
        const pR = this.world(s.hip.x + hipW * 1.06, s.hip.y + 0.045);
        const bL = this.world(s.hip.x - hipW * 0.95, s.hip.y - 0.035);
        const bR = this.world(s.hip.x + hipW * 0.95, s.hip.y - 0.035);
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.quadraticCurveTo((pL.x + pR.x) / 2, pL.y - S * 0.022, pR.x, pR.y);
        ctx.lineTo(bR.x, bR.y);
        ctx.quadraticCurveTo((bL.x + bR.x) / 2, bR.y + S * 0.026, bL.x, bL.y);
        ctx.closePath();
        ctx.fill();

        // צוואר
        ctx.fillStyle = C.skinDark;
        this.taper(ctx, s.sh, s.neck, 0.030, 0.026);
        ctx.fill();
    }

    drawHair(ctx, C, back) {
        const S = this.height;
        ctx.save();
        for (const st of this.strands) {
            if (!!st.back !== back) continue;
            const w = st.w * S;
            const P0 = this.world(st.pts[0].x, st.pts[0].y);
            ctx.beginPath();
            ctx.moveTo(P0.x, P0.y);
            // צד אחד
            for (let i = 1; i < st.n; i++) {
                const a = this.world(st.pts[i - 1].x, st.pts[i - 1].y);
                const b = this.world(st.pts[i].x, st.pts[i].y);
                const nx = -(b.y - a.y), ny = (b.x - a.x);
                const d = Math.hypot(nx, ny) || 1;
                const k = w * (1 - i / st.n) * 0.5;
                ctx.lineTo(b.x + nx / d * k, b.y + ny / d * k);
            }
            for (let i = st.n - 1; i >= 1; i--) {
                const a = this.world(st.pts[i - 1].x, st.pts[i - 1].y);
                const b = this.world(st.pts[i].x, st.pts[i].y);
                const nx = -(b.y - a.y), ny = (b.x - a.x);
                const d = Math.hypot(nx, ny) || 1;
                const k = w * (1 - i / st.n) * 0.5;
                ctx.lineTo(b.x - nx / d * k, b.y - ny / d * k);
            }
            ctx.closePath();
            ctx.fillStyle = back ? C.hairDark : C.hair;
            ctx.fill();
        }
        ctx.restore();
    }

    drawHead(ctx, C, env) {
        const s = this.skeleton;
        const S = this.height;
        const R = P.headR * S;
        const H = this.world(s.head.x, s.head.y);
        const m = this.moodMix;

        // המבט: כמה הראש "פונה" לכיוון הסמן (מחקים תלת ממד בהיסט תווי הפנים)
        const dx = clamp((this.look.x - H.x) / (S * 1.4), -1, 1);
        const dy = clamp((this.look.y - H.y) / (S * 1.0), -1, 1);
        this.lookAmt.x += (dx - this.lookAmt.x) * 0.12;
        this.lookAmt.y += (dy - this.lookAmt.y) * 0.12;
        const lx = this.lookAmt.x * R * 0.34;
        const ly = this.lookAmt.y * R * 0.24;

        ctx.save();
        ctx.translate(H.x, H.y);
        ctx.rotate(-s.headAng * this.facing * 0.55);

        // גולגולת
        ctx.fillStyle = C.skin;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 0.95, R * 1.06, 0, 0, 6.2832);
        ctx.fill();
        // סנטר
        ctx.beginPath();
        ctx.moveTo(-R * 0.72, R * 0.30);
        ctx.quadraticCurveTo(0, R * 1.42, R * 0.72, R * 0.30);
        ctx.closePath();
        ctx.fill();
        // הצללה צדדית
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = C.skinDark;
        ctx.beginPath();
        ctx.ellipse(-R * 0.45 * this.facing, R * 0.08, R * 0.5, R * 1.0, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        // אוזן
        ctx.fillStyle = C.skinDark;
        ctx.beginPath();
        ctx.ellipse(-R * 0.88 * this.facing + lx * 0.4, R * 0.1, R * 0.16, R * 0.24, 0, 0, 6.2832);
        ctx.fill();

        const eyeY = -R * 0.06 + ly;
        const eyeDX = R * 0.36;
        const open = clamp(m.eye * (1 - this.blink), 0.04, 1.6);

        // עיניים
        for (const side of [-1, 1]) {
            const ex = side * eyeDX + lx;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(ex, eyeY, R * 0.19, R * 0.20 * open, 0, 0, 6.2832);
            ctx.fill();
            // אישון שעוקב אחרי הסמן
            ctx.fillStyle = '#26303f';
            ctx.beginPath();
            ctx.ellipse(ex + this.lookAmt.x * R * 0.07, eyeY + this.lookAmt.y * R * 0.06,
                R * 0.105, R * 0.115 * clamp(open, 0.05, 1.2), 0, 0, 6.2832);
            ctx.fill();
            // נצנוץ
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(ex + R * 0.04, eyeY - R * 0.05, R * 0.035 * clamp(open, 0, 1), 0, 6.2832);
            ctx.fill();
            // ריסים
            ctx.strokeStyle = C.hairDark;
            ctx.lineWidth = R * 0.055;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.ellipse(ex, eyeY, R * 0.19, R * 0.20 * open, 0, Math.PI * 1.08, Math.PI * 1.92);
            ctx.stroke();
            ctx.restore();
        }

        // גבות
        ctx.strokeStyle = C.hairDark;
        ctx.lineWidth = R * 0.07;
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
            const ex = side * eyeDX + lx;
            const by = eyeY - R * (0.36 + m.brow);
            ctx.save();
            ctx.translate(ex, by);
            ctx.rotate(side * m.browTilt);
            ctx.beginPath();
            ctx.moveTo(-R * 0.17, R * 0.03);
            ctx.quadraticCurveTo(0, -R * 0.06, R * 0.17, R * 0.02);
            ctx.stroke();
            ctx.restore();
        }

        // אף
        ctx.strokeStyle = 'rgba(120,80,60,0.35)';
        ctx.lineWidth = R * 0.05;
        ctx.beginPath();
        ctx.moveTo(lx * 1.2 + R * 0.04 * this.facing, eyeY + R * 0.22);
        ctx.lineTo(lx * 1.2 + R * 0.10 * this.facing, eyeY + R * 0.36);
        ctx.stroke();

        // פה - נפתח בדיבור, מתעקל לפי מצב הרוח
        const mouthY = R * 0.52 + ly * 0.6;
        const openAmt = Math.max(this.talk * 0.9, m.open || 0);
        ctx.save();
        ctx.translate(lx * 1.35, mouthY);
        if (openAmt > 0.05) {
            ctx.fillStyle = '#7d3a44';
            ctx.beginPath();
            ctx.ellipse(0, 0, R * (0.20 + openAmt * 0.06), R * (0.06 + openAmt * 0.20), 0, 0, 6.2832);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, -R * (0.04 + openAmt * 0.14), R * 0.17, R * 0.05, 0, 0, 6.2832);
            ctx.fill();
        } else {
            ctx.strokeStyle = '#b5566a';
            ctx.lineWidth = R * 0.062;
            ctx.beginPath();
            ctx.moveTo(-R * 0.17, 0);
            ctx.quadraticCurveTo(0, R * 0.22 * m.smile, R * 0.17, 0);
            ctx.stroke();
        }
        ctx.restore();

        // סומק
        if (m.blush > 0.03) {
            ctx.fillStyle = m.blue ? `rgba(120,170,235,${m.blush * 0.5})` : `rgba(240,120,120,${m.blush * 0.35})`;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.ellipse(side * R * 0.60 + lx, R * 0.26, R * 0.20, R * 0.12, 0, 0, 6.2832);
                ctx.fill();
            }
        }

        // פוני / קו שיער קדמי
        ctx.fillStyle = C.hair;
        ctx.beginPath();
        ctx.moveTo(-R * 1.0, -R * 0.12);
        ctx.quadraticCurveTo(-R * 1.08, -R * 1.22, 0, -R * 1.16);
        ctx.quadraticCurveTo(R * 1.10, -R * 1.20, R * 1.0, -R * 0.06);
        ctx.quadraticCurveTo(R * 0.72, -R * 0.62, R * 0.12, -R * 0.52);
        ctx.quadraticCurveTo(-R * 0.55, -R * 0.44, -R * 1.0, -R * 0.12);
        ctx.closePath();
        ctx.fill();
        // ברק על השיער
        ctx.save();
        ctx.globalAlpha = 0.28 - this.wet * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-R * 0.25, -R * 0.86, R * 0.42, R * 0.10, -0.15, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        ctx.restore();

        // קווצות קדמיות מעל הפנים
        this.drawHair(ctx, C, false);
    }

    drawHeld(ctx) {
        const g = this.graspPoint();
        const s = this.skeleton;
        const ang = Math.atan2(s.handNear.y - s.handFar.y, s.handNear.x - s.handFar.x);
        ctx.save();
        ctx.translate(g.x, g.y - this.height * 0.02);
        ctx.rotate(ang * 0.25);
        this.hold.draw(ctx, this.hold.w, this.hold.h);
        ctx.restore();
    }

    drawDrips(ctx) {
        const S = this.height;
        const s = this.skeleton;
        const a = (this.wet - 0.15) * 0.8;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(190,225,255,0.75)';
        const seed = Math.floor(performance.now() / 260);
        for (let i = 0; i < 6; i++) {
            const r = ((seed * 37 + i * 91) % 100) / 100;
            const base = this.world(s.head.x + (r - 0.5) * 0.12, s.head.y - P.headR * 0.9);
            const fall = ((performance.now() / 700 + i * 0.37) % 1);
            ctx.beginPath();
            ctx.ellipse(base.x, base.y + fall * S * 0.22, S * 0.006, S * 0.012, 0, 0, 6.2832);
            ctx.fill();
        }
        ctx.restore();
        // ברק "רטוב" על הגוף
        ctx.save();
        ctx.globalAlpha = a * 0.35;
        ctx.strokeStyle = '#eaf6ff';
        ctx.lineWidth = S * 0.006;
        const c0 = this.world(s.chest.x - 0.05, s.chest.y + 0.02);
        const c1 = this.world(s.hip.x - 0.03, s.hip.y + 0.02);
        ctx.beginPath();
        ctx.moveTo(c0.x, c0.y);
        ctx.lineTo(c1.x, c1.y);
        ctx.stroke();
        ctx.restore();
    }

    drawHearts(ctx) {
        const S = this.height;
        for (const h of this.hearts) {
            const a = clamp(h.life / 1.6, 0, 1);
            const size = S * 0.045 * h.s;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(h.x, h.y);
            ctx.rotate(Math.sin(h.life * 5) * 0.2);
            if (h.kind === 'heart') {
                ctx.fillStyle = '#ff5f7e';
                ctx.beginPath();
                ctx.moveTo(0, size * 0.45);
                ctx.bezierCurveTo(-size, -size * 0.25, -size * 0.4, -size, 0, -size * 0.35);
                ctx.bezierCurveTo(size * 0.4, -size, size, -size * 0.25, 0, size * 0.45);
                ctx.fill();
            } else if (h.kind === 'note') {
                ctx.fillStyle = '#ffd35c';
                ctx.beginPath();
                ctx.ellipse(-size * 0.25, size * 0.35, size * 0.32, size * 0.24, -0.4, 0, 6.2832);
                ctx.fill();
                ctx.fillRect(size * 0.02, -size * 0.7, size * 0.14, size * 1.1);
            } else {
                ctx.fillStyle = '#cfe3ff';
                ctx.font = `bold ${size * 1.6}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('Z', 0, 0);
            }
            ctx.restore();
        }
    }
}
