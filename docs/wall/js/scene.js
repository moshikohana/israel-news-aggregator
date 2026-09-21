/*
 * scene.js - העולם שמאחורי הדמות.
 *
 * חוף ים חי שנבנה כולו בקנבס בזמן ריצה - בלי תמונות, בלי CDN.
 * השמיים נגזרים מגובה השמש האמיתי לפי השעון של המכשיר, מזג האוויר
 * משנה עננים/גשם/שלג/ערפל, והרוח מזיזה את הדקלים, הגלים והחלקיקים.
 *
 * כל הפונקציות כאן מקבלות `env` - מצב העולם הנוכחי (ראו brain.js):
 *   { time, sunAlt, weather, wind, wet, temp, night }
 */

export const WEATHERS = ['clear', 'clouds', 'rain', 'storm', 'snow', 'fog'];

export const WEATHER_HE = {
    clear: 'בהיר',
    clouds: 'מעונן',
    rain: 'גשום',
    storm: 'סערה',
    snow: 'שלג',
    fog: 'ערפילי',
};

/* --------------------------------------------------------------- שמש וירח */

/** גובה השמש: 1 = צהריים, 0 = אופק, שלילי = לילה. */
export function sunAltitude(date, sunrise = 6, sunset = 19) {
    const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    const p = (h - sunrise) / Math.max(1, sunset - sunrise);
    return Math.max(-1, Math.min(1, Math.sin(p * Math.PI)));
}

/** שלב הירח 0..1 (0 = מולד) - מחושב מהתאריך האמיתי. */
export function moonPhase(date) {
    const known = Date.UTC(2000, 0, 6, 18, 14);      // מולד ידוע
    const days = (date.getTime() - known) / 86400000;
    return ((days / 29.530588853) % 1 + 1) % 1;
}

/* ------------------------------------------------------------ צבעי שמיים */

// מפתחות לפי גובה השמש. כל מפתח: שלושה עצירות גרדיאנט (מלמעלה למטה).
const SKY_KEYS = [
    { alt: -1.00, sky: ['#04060f', '#080f27', '#11193c'], sun: '#dfe8ff', haze: '#1a2350' },
    { alt: -0.18, sky: ['#0b1130', '#2b2356', '#6b4570'], sun: '#ffd9b0', haze: '#4a3564' },
    { alt: 0.04, sky: ['#26407f', '#b86a5c', '#f0a06a'], sun: '#fff0c8', haze: '#c9825f' },
    { alt: 0.22, sky: ['#1e63b8', '#7fb0e0', '#f3cf9a'], sun: '#fff6d8', haze: '#cfd9e6' },
    { alt: 1.00, sky: ['#1668cf', '#58a9ea', '#b6e0f5'], sun: '#ffffff', haze: '#dfeefb' },
];

/* מפרק צבע ל-[r,g,b]. חייב לקבל גם '#rrggbb' וגם 'rgb(r,g,b)', כי הפלטה
 * המעורבבת מוחזרת כמחרוזות rgb() ומעורבבת שוב בהמשך (ים, חול, עננים). */
function toRgb(c) {
    if (c[0] === '#') {
        const h = c.length === 4
            ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
            : c.slice(1);
        const n = parseInt(h, 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    const m = c.match(/-?\d+(\.\d+)?/g);
    return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}

function mix(a, b, t) {
    const x = toRgb(a), y = toRgb(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}

function mixArr(a, b, t) { return a.map((c, i) => mix(c, b[i], t)); }

/** הצבעים של הרגע הנוכחי - אינטרפולציה בין המפתחות. */
export function skyPalette(alt) {
    let lo = SKY_KEYS[0], hi = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
        if (alt >= SKY_KEYS[i].alt && alt <= SKY_KEYS[i + 1].alt) {
            lo = SKY_KEYS[i];
            hi = SKY_KEYS[i + 1];
            break;
        }
    }
    const t = hi.alt === lo.alt ? 0 : (alt - lo.alt) / (hi.alt - lo.alt);
    return { sky: mixArr(lo.sky, hi.sky, t), sun: mix(lo.sun, hi.sun, t), haze: mix(lo.haze, hi.haze, t) };
}

const rnd = (a, b) => a + Math.random() * (b - a);

/* =========================================================== מחלקת העולם */

export class World {
    constructor() {
        this.w = 1;
        this.h = 1;
        this.dpr = 1;
        this.t = 0;
        this.stars = [];
        this.clouds = [];
        this.palms = [];
        this.drops = [];
        this.flakes = [];
        this.splashes = [];
        this.flies = [];
        this.birds = [];
        this.shooting = null;
        this.flash = 0;          // הבזק ברק 0..1
        this.bolt = null;
        this.nextBolt = 6;
        this.rainbow = 0;        // 0..1, מופיע אחרי גשם כשהשמש חוזרת
        this.skyCache = null;
        this.skyCacheKey = '';
    }

    resize(w, h, dpr) {
        this.w = w;
        this.h = h;
        this.dpr = dpr;
        this.horizon = Math.round(h * 0.52);
        this.shore = Math.round(h * 0.70);      // קו המים על החול
        this.skyCache = null;
        this.build();
    }

    /** בונה מחדש את האלמנטים שתלויים בגודל המסך. */
    build() {
        const { w, h } = this;

        this.stars = Array.from({ length: 170 }, () => ({
            x: Math.random() * w,
            y: Math.random() * this.horizon * 0.95,
            r: rnd(0.5, 1.7),
            tw: rnd(0, Math.PI * 2),
            sp: rnd(0.6, 2.4),
        }));

        this.clouds = Array.from({ length: 14 }, (_, i) => this.makeCloud(Math.random() * w, i));

        // דקלים: שניים גדולים בקצוות ועוד רקע רחוק
        const palmSpots = [0.08, 0.93, 0.2, 0.82, 0.68];
        this.palms = palmSpots.map((p, i) => ({
            x: w * p,
            y: this.shore + (i < 2 ? h * 0.06 : h * 0.005),
            scale: (i < 2 ? rnd(0.85, 1.05) : rnd(0.35, 0.5)) * (Math.min(h, w * 1.1) / 900),
            lean: (p < 0.5 ? 1 : -1) * rnd(0.05, 0.18),
            phase: rnd(0, 6.28),
            fronds: 7 + (i % 3),
        }));

        this.flies = Array.from({ length: 26 }, () => ({
            x: Math.random() * w,
            y: this.horizon + Math.random() * (h - this.horizon) * 0.8,
            ph: rnd(0, 6.28),
            sp: rnd(0.3, 0.9),
            r: rnd(1.1, 2.3),
        }));

        this.birds = Array.from({ length: 7 }, () => ({
            x: Math.random() * w,
            y: rnd(h * 0.12, h * 0.34),
            sp: rnd(14, 30),
            ph: rnd(0, 6.28),
            s: rnd(0.6, 1.2),
        }));
    }

    makeCloud(x, seed = 0) {
        const h = this.h;
        const puffs = 4 + Math.floor(Math.random() * 4);
        return {
            x,
            y: rnd(h * 0.04, h * 0.40),
            s: rnd(0.55, 1.6),
            sp: rnd(3, 11),
            seed,
            puffs: Array.from({ length: puffs }, (_, i) => ({
                dx: (i - puffs / 2) * rnd(26, 44),
                dy: rnd(-14, 14),
                r: rnd(22, 52),
            })),
        };
    }

    /* ------------------------------------------------------------ עדכון */

    update(dt, env) {
        this.t += dt;
        const wind = env.wind;
        const heavy = env.weather === 'storm';
        const raining = env.weather === 'rain' || heavy;
        const snowing = env.weather === 'snow';

        // עננים נעים עם הרוח ונולדים מחדש בצד השני
        for (const c of this.clouds) {
            c.x += (c.sp + wind * 26) * c.s * dt;
            if (c.x - 160 > this.w) { c.x = -160; c.y = rnd(this.h * 0.04, this.h * 0.40); }
            if (c.x + 160 < 0) { c.x = this.w + 160; }
        }

        // ציפורים ביום
        for (const b of this.birds) {
            b.x += (b.sp + wind * 18) * dt;
            if (b.x > this.w + 40) b.x = -40;
        }

        // גשם
        const wantDrops = raining ? (heavy ? 420 : 230) : 0;
        while (this.drops.length < wantDrops) this.drops.push(this.newDrop(true));
        if (this.drops.length > wantDrops) this.drops.length = wantDrops;
        for (const d of this.drops) {
            d.y += d.v * dt;
            d.x += (wind * 120 + d.sway) * dt;
            if (d.y > d.ground) {
                if (Math.random() < 0.28) this.splashes.push({ x: d.x, y: d.ground, r: 1, life: 0.45 });
                Object.assign(d, this.newDrop(false));
            }
            if (d.x > this.w + 30) d.x = -20;
            if (d.x < -30) d.x = this.w + 20;
        }

        // שלג
        const wantFlakes = snowing ? 260 : 0;
        while (this.flakes.length < wantFlakes) this.flakes.push(this.newFlake(true));
        if (this.flakes.length > wantFlakes) this.flakes.length = wantFlakes;
        for (const f of this.flakes) {
            f.y += f.v * dt;
            f.x += Math.sin(this.t * f.sw + f.ph) * 16 * dt + wind * 70 * dt;
            f.spin += dt * f.sp;
            if (f.y > this.h + 10) Object.assign(f, this.newFlake(false));
        }

        // התזות
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.life -= dt;
            s.r += dt * 34;
            if (s.life <= 0) this.splashes.splice(i, 1);
        }

        // ברקים בסערה
        if (heavy) {
            this.nextBolt -= dt;
            if (this.nextBolt <= 0) {
                this.strike();
                this.nextBolt = rnd(2.5, 9);
            }
        }
        this.flash = Math.max(0, this.flash - dt * 2.6);
        if (this.bolt) {
            this.bolt.life -= dt;
            if (this.bolt.life <= 0) this.bolt = null;
        }

        // גחליליות בלילה
        for (const f of this.flies) {
            f.ph += dt * f.sp;
            f.x += Math.cos(f.ph * 0.7) * 10 * dt;
            f.y += Math.sin(f.ph) * 8 * dt;
        }

        // כוכב נופל מדי פעם בלילה בהיר
        if (env.sunAlt < -0.2 && !raining && !this.shooting && Math.random() < dt * 0.06) {
            this.shooting = { x: rnd(this.w * 0.15, this.w * 0.9), y: rnd(20, this.horizon * 0.45), life: 1, a: rnd(0.4, 0.9) };
        }
        if (this.shooting) {
            this.shooting.life -= dt * 1.4;
            this.shooting.x += Math.cos(this.shooting.a) * 520 * dt;
            this.shooting.y += Math.sin(this.shooting.a) * 520 * dt;
            if (this.shooting.life <= 0) this.shooting = null;
        }

        // קשת אחרי גשם
        const wantBow = !raining && env.wet > 0.25 && env.sunAlt > 0.1;
        this.rainbow += ((wantBow ? 1 : 0) - this.rainbow) * Math.min(1, dt * 0.6);
    }

    newDrop(spread) {
        const ground = this.shore + Math.random() * (this.h - this.shore) * 0.9;
        return {
            x: Math.random() * (this.w + 120) - 60,
            y: spread ? Math.random() * this.h : -rnd(10, 120),
            v: rnd(680, 1150),
            len: rnd(9, 24),
            sway: rnd(-12, 12),
            ground,
            a: rnd(0.25, 0.7),
        };
    }

    newFlake(spread) {
        return {
            x: Math.random() * this.w,
            y: spread ? Math.random() * this.h : -rnd(5, 60),
            v: rnd(28, 78),
            r: rnd(1.4, 3.6),
            ph: rnd(0, 6.28),
            sw: rnd(0.6, 1.8),
            spin: rnd(0, 6.28),
            sp: rnd(-2, 2),
            a: rnd(0.5, 0.95),
        };
    }

    strike() {
        this.flash = 1;
        const x = rnd(this.w * 0.15, this.w * 0.85);
        const pts = [[x, -10]];
        let y = 0;
        let cx = x;
        while (y < this.horizon) {
            y += rnd(18, 46);
            cx += rnd(-26, 26);
            pts.push([cx, y]);
        }
        this.bolt = { pts, life: 0.26 };
    }

    /* ------------------------------------------------------------- ציור */

    draw(ctx, env) {
        const { w, h } = this;
        const pal = skyPalette(env.sunAlt);
        const overcast = env.weather === 'clouds' || env.weather === 'rain' || env.weather === 'fog' ? 0.45
            : env.weather === 'snow' ? 0.5
                : env.weather === 'storm' ? 0.75 : 0;

        this.drawSky(ctx, pal, overcast, env);
        this.drawCelestial(ctx, pal, env);
        if (env.sunAlt < -0.05) this.drawStars(ctx, env);
        this.drawClouds(ctx, pal, overcast, env);
        if (this.rainbow > 0.02) this.drawRainbow(ctx);
        this.drawSea(ctx, pal, env);
        this.drawBeach(ctx, pal, env);
        this.drawPalms(ctx, pal, env);
        if (env.sunAlt > 0.05 && env.weather !== 'storm') this.drawBirds(ctx, pal);
    }

    /** עכירות כללית לפי מזג האוויר - מונחת אחרי כל הסצנה כדי שהחול,
     *  הים והדקלים יכהו יחד ולא רק השמיים. */
    drawGloom(ctx, env) {
        const k = { storm: 0.34, rain: 0.18, snow: 0.13, fog: 0.12, clouds: 0.07 }[env.weather] || 0;
        if (!k) return;
        ctx.fillStyle = `rgba(38,48,66,${k})`;
        ctx.fillRect(0, 0, this.w, this.h);
    }

    /** מה שמצויר *מעל* הדמות: גשם קדמי, ערפל, הבזקים. */
    drawForeground(ctx, env) {
        if (this.drops.length) this.drawRain(ctx, env);
        if (this.flakes.length) this.drawSnow(ctx);
        if (env.sunAlt < -0.15 && env.weather === 'clear') this.drawFireflies(ctx);
        if (env.weather === 'fog') this.drawFog(ctx);
        if (this.bolt) this.drawBolt(ctx);
        if (this.flash > 0.01) {
            ctx.fillStyle = `rgba(210,225,255,${this.flash * 0.42})`;
            ctx.fillRect(0, 0, this.w, this.h);
        }
    }

    drawSky(ctx, pal, overcast, env) {
        const key = pal.sky.join('') + overcast.toFixed(2) + this.w + 'x' + this.h;
        if (this.skyCacheKey !== key) {
            const g = ctx.createLinearGradient(0, 0, 0, this.horizon + 8);
            const dull = (c) => overcast ? mix(c, '#7d8794', overcast * 0.75) : c;
            g.addColorStop(0, dull(pal.sky[0]));
            g.addColorStop(0.55, dull(pal.sky[1]));
            g.addColorStop(1, dull(pal.sky[2]));
            this.skyCache = g;
            this.skyCacheKey = key;
        }
        ctx.fillStyle = this.skyCache;
        ctx.fillRect(0, 0, this.w, this.horizon + 8);
    }

    sunPos(env) {
        // השמש נעה בקשת מצד לצד לאורך היום
        const p = Math.acos(Math.max(-1, Math.min(1, -env.sunAlt))) / Math.PI;
        return { x: this.w * (0.12 + p * 0.76), y: this.horizon - env.sunAlt * this.horizon * 0.78 };
    }

    drawCelestial(ctx, pal, env) {
        const night = env.sunAlt < -0.03;
        const p = this.sunPos(env);
        if (night) {
            // ירח בצד הנגדי, עם שלב אמיתי לפי התאריך
            const mx = this.w - p.x;
            const my = this.horizon - Math.abs(env.sunAlt) * this.horizon * 0.62 - 20;
            const r = Math.max(16, this.h * 0.028);
            const glow = ctx.createRadialGradient(mx, my, r * 0.5, mx, my, r * 7);
            glow.addColorStop(0, 'rgba(210,225,255,0.30)');
            glow.addColorStop(1, 'rgba(210,225,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(mx - r * 7, my - r * 7, r * 14, r * 14);

            ctx.save();
            ctx.fillStyle = '#eef3ff';
            ctx.beginPath();
            ctx.arc(mx, my, r, 0, 6.2832);
            ctx.fill();

            // כתמים - לפני החיתוך, כדי שלא יופיעו על החלק המוצל
            ctx.fillStyle = 'rgba(150,165,195,0.24)';
            for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.15, 0.3, 0.16], [0.3, -0.35, 0.12]]) {
                ctx.beginPath();
                ctx.arc(mx + dx * r, my + dy * r, rr * r, 0, 6.2832);
                ctx.fill();
            }

            // חיתוך הצל לפי שלב הירח האמיתי:
            // illum = 0 במולד (הכל נמחק), 1 בירח מלא (ההיסט גדול מספיק
            // כדי שמעגל המחיקה לא ייגע בדיסק בכלל).
            const ph = moonPhase(env.time);
            const illum = (1 - Math.cos(ph * Math.PI * 2)) / 2;
            const dir = ph < 0.5 ? 1 : -1;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(mx + dir * 2 * r * illum, my, r * 1.01, 0, 6.2832);
            ctx.fill();
            ctx.restore();
            return;
        }

        const r = Math.max(18, this.h * 0.032);
        const glow = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 9);
        glow.addColorStop(0, 'rgba(255,238,190,0.55)');
        glow.addColorStop(0.35, 'rgba(255,210,140,0.18)');
        glow.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - r * 9, p.y - r * 9, r * 18, r * 18);
        ctx.fillStyle = pal.sun;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.2832);
        ctx.fill();
    }

    drawStars(ctx, env) {
        const a = Math.min(1, (-env.sunAlt - 0.05) * 3.2);
        const dim = env.weather === 'clear' ? 1 : 0.35;
        for (const s of this.stars) {
            const tw = 0.55 + 0.45 * Math.sin(this.t * s.sp + s.tw);
            ctx.fillStyle = `rgba(255,255,255,${a * tw * dim})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, 6.2832);
            ctx.fill();
        }
        if (this.shooting) {
            const s = this.shooting;
            ctx.strokeStyle = `rgba(255,255,255,${s.life * 0.9})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - Math.cos(s.a) * 90, s.y - Math.sin(s.a) * 90);
            ctx.stroke();
        }
    }

    drawClouds(ctx, pal, overcast, env) {
        const dark = env.weather === 'storm' ? 0.72 : env.weather === 'rain' ? 0.5 : 0.12;
        const visible = env.weather === 'clear' ? 4 : env.weather === 'fog' ? 8 : this.clouds.length;
        const lit = env.sunAlt > 0.05;
        for (let i = 0; i < visible; i++) {
            const c = this.clouds[i];
            const base = lit ? '#ffffff' : '#9aa4bd';
            ctx.globalAlpha = 0.92;

            ctx.fillStyle = mix(base, '#2b3346', dark);
            ctx.beginPath();
            for (const p of c.puffs) {
                const px = c.x + p.dx * c.s, py = c.y + p.dy * c.s, pr = p.r * c.s;
                ctx.moveTo(px + pr, py);
                ctx.arc(px, py, pr, 0, 6.2832);
            }
            ctx.fill();

            // הדגשה עליונה מצד השמש - גם היא מסלול אחד
            ctx.fillStyle = lit ? 'rgba(255,250,232,0.5)' : 'rgba(180,195,230,0.22)';
            ctx.beginPath();
            for (const p of c.puffs) {
                const px = c.x + p.dx * c.s, py = c.y + (p.dy - p.r * 0.3) * c.s, pr = p.r * c.s * 0.68;
                ctx.moveTo(px + pr, py);
                ctx.arc(px, py, pr, 0, 6.2832);
            }
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawRainbow(ctx) {
        const cx = this.w * 0.5;
        const cy = this.horizon + this.h * 0.18;
        const R = Math.max(this.w, this.h) * 0.62;
        const bands = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#4ddb6b', '#4db4ff', '#7d5cff'];
        ctx.save();
        ctx.globalAlpha = this.rainbow * 0.32;
        ctx.lineWidth = Math.max(6, this.h * 0.012);
        bands.forEach((c, i) => {
            ctx.strokeStyle = c;
            ctx.beginPath();
            ctx.arc(cx, cy, R - i * ctx.lineWidth, Math.PI, 0);
            ctx.stroke();
        });
        ctx.restore();
    }

    drawSea(ctx, pal, env) {
        const { w } = this;
        const top = this.horizon;
        const bottom = this.shore + 20;
        const deep = mix(pal.sky[2], '#0b6c8b', 0.62);
        const shallow = mix(pal.sky[2], '#38d8c8', 0.52);
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0, mix(deep, pal.sky[2], 0.28));   // האופק מתמזג עם השמיים
        g.addColorStop(0.18, deep);
        g.addColorStop(0.62, mix(deep, shallow, 0.65));
        g.addColorStop(1, shallow);
        ctx.fillStyle = g;
        ctx.fillRect(0, top, w, bottom - top);

        // נצנוץ דק בדיוק על קו האופק
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(0, top, w, 1.5);

        // נתיב נצנוץ של השמש/הירח על המים
        const night = env.sunAlt < -0.03;
        const p = this.sunPos(env);
        const gx = night ? w - p.x : p.x;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, w, bottom - top);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 46; i++) {
            const y = top + ((i / 46) ** 1.5) * (bottom - top);
            const spread = 8 + (y - top) * 0.55;
            const x = gx + Math.sin(this.t * 1.4 + i * 1.7) * spread;
            const len = 10 + Math.random() * 40 * (1 - i / 46);
            ctx.fillStyle = night ? 'rgba(200,220,255,0.10)' : 'rgba(255,240,200,0.13)';
            ctx.fillRect(x - len / 2, y, len, 1.6);
        }
        ctx.restore();

        // גלים - פסי קצף אופקיים שמתקרבים לחוף
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
            const k = i / 9;
            const y = top + (k ** 1.6) * (bottom - top) + Math.sin(this.t * 0.9 + i) * 2;
            const amp = 2 + k * 7;
            ctx.strokeStyle = `rgba(255,255,255,${0.06 + k * 0.22})`;
            ctx.lineWidth = 1 + k * 2.4;
            ctx.beginPath();
            for (let x = -20; x <= w + 20; x += 18) {
                const yy = y + Math.sin(x * 0.012 + this.t * (1.1 + k) + i) * amp;
                x === -20 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBeach(ctx, pal, env) {
        const { w, h } = this;
        const top = this.shore;
        const sandTop = mix('#e8d5ad', pal.haze, env.sunAlt < 0 ? 0.55 : 0.18);
        const sandBot = mix('#d2b98c', pal.haze, env.sunAlt < 0 ? 0.6 : 0.1);
        const g = ctx.createLinearGradient(0, top, 0, h);
        g.addColorStop(0, sandTop);
        g.addColorStop(1, sandBot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, top + 10);
        for (let x = 0; x <= w; x += 30) {
            ctx.lineTo(x, top + 10 + Math.sin(x * 0.006 + 1.2) * 6);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        // חול רטוב - גדל בגשם ומתייבש אחריו
        if (env.wet > 0.02) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.45, env.wet * 0.45);
            ctx.fillStyle = '#6b5a3e';
            ctx.beginPath();
            ctx.moveTo(0, top + 10);
            for (let x = 0; x <= w; x += 30) ctx.lineTo(x, top + 10 + Math.sin(x * 0.006 + 1.2) * 6);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // קצף על קו המים
        const foamY = top + 8 + Math.sin(this.t * 0.8) * 4;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.beginPath();
        ctx.moveTo(0, foamY + 14);
        for (let x = 0; x <= w; x += 14) {
            ctx.lineTo(x, foamY + Math.sin(x * 0.03 + this.t * 1.6) * 5 + Math.sin(x * 0.011 - this.t) * 3);
        }
        ctx.lineTo(w, foamY - 10);
        ctx.lineTo(0, foamY - 10);
        ctx.closePath();
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.restore();

        // שלג שנערם
        if (env.weather === 'snow') {
            ctx.fillStyle = 'rgba(245,250,255,0.55)';
            ctx.beginPath();
            ctx.moveTo(0, top + 16);
            for (let x = 0; x <= w; x += 30) ctx.lineTo(x, top + 16 + Math.sin(x * 0.006 + 1.2) * 6);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fill();
        }

        // התזות גשם על החול
        for (const s of this.splashes) {
            ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, s.life) * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, s.r, s.r * 0.32, 0, 0, 6.2832);
            ctx.stroke();
        }
    }

    drawPalms(ctx, pal, env) {
        const dark = env.sunAlt < -0.02 ? 0.72 : env.sunAlt < 0.12 ? 0.42 : 0.1;
        for (const p of this.palms) {
            const sway = Math.sin(this.t * 1.05 + p.phase) * (0.02 + env.wind * 0.1);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale);

            // גזע מעוקל
            const H = 260;
            const bend = (p.lean + sway) * H;
            ctx.strokeStyle = mix('#8a6a45', '#10131d', dark);
            ctx.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                ctx.lineWidth = 26 - i * 4;
                ctx.strokeStyle = mix(i % 2 ? '#7a5c3c' : '#93714a', '#10131d', dark);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(bend * 0.35, -H * 0.55, bend, -H);
                ctx.stroke();
                if (i > 0) break;
            }
            // טבעות
            ctx.strokeStyle = mix('#5f472e', '#10131d', dark);
            ctx.lineWidth = 2;
            for (let i = 1; i < 9; i++) {
                const t = i / 9;
                const x = 2 * (1 - t) * t * (bend * 0.35) + t * t * bend;
                const y = -(2 * (1 - t) * t * (H * 0.55) + t * t * H);
                ctx.beginPath();
                ctx.moveTo(x - (12 - t * 6), y);
                ctx.lineTo(x + (12 - t * 6), y);
                ctx.stroke();
            }

            // כפות: לכל כף יש עלה-אם מעוקל, ולאורכו עלעלים שמתקצרים לקצה
            ctx.translate(bend, -H);
            const n = p.fronds;
            for (let i = 0; i < n; i++) {
                // מניפה מהצד השמאלי-תחתון, מעל הראש, עד הימני-תחתון
                const a = -Math.PI * 1.08 + (i / (n - 1)) * Math.PI * 1.16 + sway * 1.4;
                const L = 132 + ((i * 37) % 30);
                const droop = 0.42 + Math.abs(Math.cos(a)) * 0.55;   // כפות צדדיות נוטות יותר
                const lit = Math.sin(a) < 0 ? 1 : 0.78;              // הכפות העליונות מוארות
                ctx.save();
                ctx.rotate(a);

                // עלה-אם
                const rib = (t) => ({
                    x: 2 * (1 - t) * t * (L * 0.52) + t * t * (L * 0.96),
                    y: 2 * (1 - t) * t * (-L * 0.10) + t * t * (L * 0.52 * droop),
                });
                ctx.strokeStyle = mix('#2c7d4c', '#0c1420', dark);
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(L * 0.52, -L * 0.10, L * 0.96, L * 0.52 * droop);
                ctx.stroke();

                // עלעלים משני צדי העלה
                const leaf = mix(lit > 0.9 ? '#4fbb73' : '#37975a', '#0c1420', dark);
                ctx.fillStyle = leaf;
                for (let k = 1; k <= 13; k++) {
                    const t = k / 14;
                    const c = rib(t);
                    const nx = rib(Math.min(1, t + 0.02));
                    const dx = nx.x - c.x, dy = nx.y - c.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const blade = (26 - t * 12) * (1 - Math.pow(t, 3) * 0.6);
                    for (const side of [-1, 1]) {
                        const px = -dy / d * side, py = dx / d * side;
                        ctx.beginPath();
                        ctx.moveTo(c.x, c.y);
                        ctx.quadraticCurveTo(
                            c.x + px * blade * 0.8 + dx / d * blade * 0.5,
                            c.y + py * blade * 0.8 + dy / d * blade * 0.5,
                            c.x + px * blade * 0.45 + dx / d * blade * 1.25,
                            c.y + py * blade * 0.45 + dy / d * blade * 1.25);
                        ctx.quadraticCurveTo(c.x + dx / d * blade * 0.5, c.y + dy / d * blade * 0.5,
                            c.x, c.y);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                ctx.restore();
            }
            // קוקוסים
            ctx.fillStyle = mix('#6b4a2a', '#0c1420', dark);
            for (const [dx, dy] of [[-10, 8], [8, 12], [0, 18]]) {
                ctx.beginPath();
                ctx.arc(dx, dy, 8, 0, 6.2832);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawBirds(ctx, pal) {
        ctx.strokeStyle = 'rgba(30,40,60,0.45)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (const b of this.birds) {
            const flap = Math.sin(this.t * 6 + b.ph) * 0.5 + 0.5;
            const s = b.s * 9;
            ctx.beginPath();
            ctx.moveTo(b.x - s, b.y + flap * s * 0.5);
            ctx.quadraticCurveTo(b.x, b.y - s * 0.4, b.x + s, b.y + flap * s * 0.5);
            ctx.stroke();
        }
    }

    drawRain(ctx, env) {
        ctx.save();
        ctx.strokeStyle = 'rgba(205,230,255,0.72)';
        ctx.lineWidth = env.weather === 'storm' ? 1.8 : 1.35;
        ctx.lineCap = 'round';
        const lean = env.wind * 0.35;
        ctx.beginPath();
        for (const d of this.drops) {
            ctx.globalAlpha = d.a;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - lean * d.len, d.y - d.len);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawSnow(ctx) {
        ctx.save();
        for (const f of this.flakes) {
            ctx.globalAlpha = f.a;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, 6.2832);
            ctx.fill();
        }
        ctx.restore();
    }

    drawFog(ctx) {
        const { w, h } = this;
        ctx.save();
        for (let i = 0; i < 5; i++) {
            const y = this.horizon - 40 + i * (h - this.horizon) * 0.22;
            const off = Math.sin(this.t * (0.12 + i * 0.05) + i) * 120;
            const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
            g.addColorStop(0, 'rgba(226,232,240,0)');
            g.addColorStop(0.5, `rgba(226,232,240,${0.16 + i * 0.03})`);
            g.addColorStop(1, 'rgba(226,232,240,0)');
            ctx.fillStyle = g;
            ctx.fillRect(off - 100, y - 60, w + 200, 120);
        }
        ctx.restore();
    }

    drawFireflies(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const f of this.flies) {
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.ph * 1.7));
            const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
            g.addColorStop(0, `rgba(255,236,150,${a})`);
            g.addColorStop(1, 'rgba(255,236,150,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r * 7, 0, 6.2832);
            ctx.fill();
        }
        ctx.restore();
    }

    drawBolt(ctx) {
        const b = this.bolt;
        ctx.save();
        ctx.strokeStyle = 'rgba(235,245,255,0.95)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#cfe4ff';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        b.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.stroke();
        ctx.restore();
    }
}
