/*
 * desktop.js - שכבת שולחן העבודה שהדמות מתייחסת אליה.
 *
 * האייקונים והחלונות מצוירים בקנבס (ולא ב-DOM) בדיוק כדי שהדמות תוכל
 * להתעסק איתם פיזית: להרים, לתפוס אייקון שזרקו, ולאסוף הכל מתחת לידיים
 * כשמתחיל גשם. יש פיזיקה קלה - כבידה, קפיצה מהקרקע, וזריקה לפי מהירות
 * הגרירה.
 *
 * כשמריצים את העמוד כטפט אמיתי (Lively / Plash), האייקונים האמיתיים של
 * מערכת ההפעלה יושבים מעל השכבה הזו - ואלה כאן משמשים כתצוגה מקדימה
 * ובובות משחק לדמות.
 */

const ICON_KINDS = ['folder', 'doc', 'image', 'music', 'code', 'trash'];

const LABELS = {
    folder: 'מסמכים',
    doc: 'דוח סופי.docx',
    image: 'חופשה.jpg',
    music: 'פלייליסט',
    code: 'פרויקט',
    trash: 'אשפה',
};

const rnd = (a, b) => a + Math.random() * (b - a);

export class Desktop {
    constructor() {
        this.icons = [];
        this.windows = [];
        this.groundY = 0;
        this.w = 0;
        this.h = 0;
        this.size = 64;
        this.drag = null;
        this.protect = false;      // מצב "תשמרי על המסמכים"
        this.shelter = null;       // נקודת המחסה (הידיים של הדמות)
        this.caught = null;        // אייקון שהדמות מחזיקה
        this.onCatch = () => {};
        this.onPoke = () => {};
    }

    resize(w, h, groundY) {
        this.w = w;
        this.h = h;
        this.groundY = groundY;
        this.size = Math.max(46, Math.min(78, Math.round(h * 0.075)));
        if (!this.icons.length) this.spawn();
        for (const ic of this.icons) {
            ic.x = Math.min(Math.max(this.size, ic.x), w - this.size);
            ic.homeY = Math.min(ic.homeY, groundY - this.size * 0.6);
        }
        const narrow = w < 760;
        for (const wn of this.windows) {
            wn.w = narrow ? Math.min(w - 96, 300) : Math.min(Math.max(280, w * 0.26), 420);
            wn.h = Math.round(wn.w * (narrow ? 0.52 : 0.62));
            wn.x = Math.max(8, Math.min(wn.x, w - wn.w - 12));
        }
    }

    spawn() {
        // טור אייקונים בפינה, כמו בשולחן עבודה אמיתי (RTL - צד ימין)
        const s = this.size;
        const perCol = this.h < 700 ? 3 : this.w < 760 ? 6 : 4;
        ICON_KINDS.forEach((kind, i) => {
            const col = Math.floor(i / perCol);
            const row = i % perCol;
            const x = this.w - s * 1.1 - col * s * 1.7;
            const y = s * 1.2 + row * s * 1.75;
            this.icons.push({
                kind, label: LABELS[kind],
                x, y, homeX: x, homeY: y,
                vx: 0, vy: 0, held: false, grounded: false, loose: false,
                wet: 0, sheltered: false, rot: 0, vr: 0, flash: 0,
            });
        });

        this.windows.push({
            id: 'news',
            title: '📰 מה קורה עכשיו',
            x: 28, y: Math.round(this.h * 0.10),
            w: 340, h: 210,
            lines: ['טוען כותרות…'],
            scroll: 0, held: false, vx: 0, vy: 0, wet: 0, open: true,
        });
    }

    setNews(lines) {
        const wn = this.windows.find((x) => x.id === 'news');
        if (wn) wn.lines = lines.length ? lines : ['אין כותרות כרגע'];
    }

    /* ------------------------------------------------------- אינטראקציה */

    hit(px, py) {
        for (let i = this.windows.length - 1; i >= 0; i--) {
            const wn = this.windows[i];
            if (wn.open && px >= wn.x && px <= wn.x + wn.w && py >= wn.y && py <= wn.y + 34) {
                return { type: 'window', obj: wn };
            }
        }
        const r = this.size * 0.62;
        for (let i = this.icons.length - 1; i >= 0; i--) {
            const ic = this.icons[i];
            if (Math.abs(px - ic.x) < r && Math.abs(py - ic.y) < r) return { type: 'icon', obj: ic };
        }
        return null;
    }

    pointerDown(px, py) {
        const h = this.hit(px, py);
        if (!h) return false;
        if (this.caught === h.obj) { this.caught = null; }
        h.obj.held = true;
        h.obj.loose = true;
        h.obj.tidy = false;
        h.obj.grounded = false;
        this.drag = { ...h, dx: px - h.obj.x, dy: py - h.obj.y, lx: px, ly: py, vx: 0, vy: 0 };
        this.onPoke(h.type, h.obj);
        return true;
    }

    pointerMove(px, py) {
        if (!this.drag) return;
        const o = this.drag.obj;
        o.x = px - this.drag.dx;
        o.y = py - this.drag.dy;
        this.drag.vx = (px - this.drag.lx) * 12;
        this.drag.vy = (py - this.drag.ly) * 12;
        this.drag.lx = px;
        this.drag.ly = py;
    }

    pointerUp() {
        if (!this.drag) return;
        const o = this.drag.obj;
        o.held = false;
        o.vx = Math.max(-1600, Math.min(1600, this.drag.vx));
        o.vy = Math.max(-1600, Math.min(1600, this.drag.vy));
        if (this.drag.type === 'icon') o.vr = o.vx * 0.004;
        this.drag = null;
    }

    /** מחזיר הכול למקום המקורי - "תסדרי לי את השולחן". */
    tidy() {
        for (const ic of this.icons) {
            ic.held = false;
            ic.grounded = false;
            ic.tidy = true;
            ic.vx = ic.vy = 0;
        }
        this.protect = false;
        this.caught = null;
    }

    /* ------------------------------------------------------------ עדכון */

    update(dt, env, character) {
        const raining = env.weather === 'rain' || env.weather === 'storm';
        const s = this.size;
        const grasp = character ? character.graspPoint() : null;
        this.shelter = this.protect && grasp ? grasp : null;

        for (const ic of this.icons) {
            ic.flash = Math.max(0, ic.flash - dt * 3);

            if (ic === this.caught && grasp) {
                // נישא בידיים של הדמות
                ic.x += (grasp.x - ic.x) * Math.min(1, dt * 14);
                ic.y += (grasp.y - s * 0.35 - ic.y) * Math.min(1, dt * 14);
                ic.rot += (0 - ic.rot) * Math.min(1, dt * 8);
                ic.sheltered = true;
            } else if (ic.held) {
                ic.rot += (0 - ic.rot) * Math.min(1, dt * 10);
                ic.sheltered = false;
            } else if (this.shelter && !ic.tidy) {
                ic.loose = true;
                // מצב הגנה: כל האייקונים נאספים מתחת לידיים
                const idx = this.icons.indexOf(ic);
                const tx = this.shelter.x + ((idx % 3) - 1) * s * 0.85;
                const ty = this.shelter.y - s * 0.30 + Math.floor(idx / 3) * s * 0.78;
                ic.x += (tx - ic.x) * Math.min(1, dt * 6);
                ic.y += (ty - ic.y) * Math.min(1, dt * 6);
                ic.rot += (Math.sin(idx) * 0.08 - ic.rot) * Math.min(1, dt * 5);
                ic.sheltered = true;
                ic.vx = ic.vy = 0;
            } else if (ic.tidy || !ic.loose) {
                // יושב במקומו על שולחן העבודה, עם ריחוף עדין ברוח
                const drift = Math.sin(performance.now() / 1400 + ic.homeY) * env.wind * 2.5;
                ic.x += (ic.homeX + drift - ic.x) * Math.min(1, dt * 5);
                ic.y += (ic.homeY - ic.y) * Math.min(1, dt * 5);
                ic.rot += (0 - ic.rot) * Math.min(1, dt * 6);
                ic.vx = ic.vy = 0;
                ic.sheltered = false;
                if (Math.hypot(ic.x - ic.homeX, ic.y - ic.homeY) < 2) { ic.tidy = false; ic.loose = false; }
            } else {
                // פיזיקה חופשית
                ic.vy += 1500 * dt;
                ic.vx += env.wind * 40 * dt;
                ic.x += ic.vx * dt;
                ic.y += ic.vy * dt;
                ic.rot += ic.vr * dt * 6;
                const floor = this.groundY - s * 0.32;
                if (ic.y > floor) {
                    ic.y = floor;
                    ic.vy *= -0.32;
                    ic.vx *= 0.72;
                    ic.vr *= 0.6;
                    if (Math.abs(ic.vy) < 40) { ic.vy = 0; ic.grounded = true; }
                }
                if (ic.x < s * 0.55) { ic.x = s * 0.55; ic.vx *= -0.5; }
                if (ic.x > this.w - s * 0.55) { ic.x = this.w - s * 0.55; ic.vx *= -0.5; }
                ic.vx *= (1 - dt * 0.6);
                ic.sheltered = false;

                // תפיסה: אייקון שעף לכיוון הידיים - הדמות קולטת אותו
                if (grasp && !this.caught && (Math.abs(ic.vx) > 200 || Math.abs(ic.vy) > 200)) {
                    const reach = s * 2.1;
                    const near = Math.hypot(ic.x - grasp.x, ic.y - grasp.y) < reach
                        || Math.hypot(ic.x + ic.vx * 0.09 - grasp.x, ic.y + ic.vy * 0.09 - grasp.y) < reach;
                    if (near) {
                        this.caught = ic;
                        ic.vx = ic.vy = 0;
                        ic.flash = 1;
                        this.onCatch(ic);
                    }
                }
            }

            // הרטבה והתייבשות
            const exposed = raining && !ic.sheltered;
            ic.wet += (exposed ? 1 : -0.25) * dt * (exposed ? 0.35 : 0.2);
            ic.wet = Math.max(0, Math.min(1, ic.wet));
        }

        for (const wn of this.windows) {
            if (wn.held) {
                wn.loose = true;
            } else if (wn.loose) {
                // נזרק - נופל ונח על החול
                wn.vy += 1200 * dt;
                wn.x += wn.vx * dt;
                wn.y += wn.vy * dt;
                const floor = this.groundY - wn.h * 0.5;
                if (wn.y > floor) {
                    wn.y = floor;
                    wn.vy *= -0.25;
                    wn.vx *= 0.7;
                    if (Math.abs(wn.vy) < 30) { wn.vy = 0; wn.loose = false; }
                }
                wn.x = Math.max(8, Math.min(this.w - wn.w - 8, wn.x));
                wn.vx *= (1 - dt * 0.8);
            }
            const exposed = raining && !this.protect;
            wn.wet = Math.max(0, Math.min(1, wn.wet + (exposed ? 0.3 : -0.2) * dt));
            wn.scroll += dt * 16;
        }
    }

    /* -------------------------------------------------------------- ציור */

    draw(ctx, env) {
        for (const wn of this.windows) if (wn.open) this.drawWindow(ctx, wn, env);
        for (const ic of this.icons) this.drawIcon(ctx, ic, env);
    }

    drawIcon(ctx, ic, env) {
        const s = this.size;
        ctx.save();
        ctx.translate(ic.x, ic.y);
        ctx.rotate(ic.rot);

        // צל רך - גרדיאנט במקום filter:blur, שעולה הרבה פחות בכל פריים
        ctx.save();
        const lifted = ic.held || ic === this.caught;
        const sg = ctx.createRadialGradient(0, s * 0.1, 0, 0, s * 0.1, s * 0.62);
        sg.addColorStop(0, `rgba(0,0,0,${lifted ? 0.4 : 0.26})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(0, s * 0.1, s * 0.62, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        const lift = ic.held || ic === this.caught ? 1.12 : 1;
        ctx.scale(lift, lift);

        const glyph = {
            folder: ['#f2b23c', '#d6901e', '📁'],
            doc: ['#f3f5f8', '#c6cdd8', '📄'],
            image: ['#57b7f0', '#2c85bd', '🖼️'],
            music: ['#c46ef0', '#8b3fbb', '🎵'],
            code: ['#2e3a4d', '#18202d', '⌨️'],
            trash: ['#8a94a6', '#5d6675', '🗑️'],
        }[ic.kind];

        // גוף האייקון
        const g = ctx.createLinearGradient(0, -s * 0.36, 0, s * 0.36);
        g.addColorStop(0, glyph[0]);
        g.addColorStop(1, glyph[1]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72, s * 0.15);
        ctx.fill();

        if (ic.kind === 'folder') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            ctx.roundRect(-s * 0.3, -s * 0.28, s * 0.32, s * 0.12, s * 0.05);
            ctx.fill();
        }
        if (ic.kind === 'doc') {
            ctx.strokeStyle = 'rgba(80,95,120,0.6)';
            ctx.lineWidth = Math.max(1.5, s * 0.03);
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(-s * 0.22, -s * 0.16 + i * s * 0.12);
                ctx.lineTo(s * (i === 3 ? 0.04 : 0.22), -s * 0.16 + i * s * 0.12);
                ctx.stroke();
            }
        }
        if (ic.kind === 'image') {
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.arc(-s * 0.14, -s * 0.14, s * 0.07, 0, 6.2832);
            ctx.fill();
            ctx.fillStyle = 'rgba(30,60,40,0.55)';
            ctx.beginPath();
            ctx.moveTo(-s * 0.32, s * 0.3);
            ctx.lineTo(-s * 0.05, -s * 0.05);
            ctx.lineTo(s * 0.12, s * 0.12);
            ctx.lineTo(s * 0.28, -s * 0.02);
            ctx.lineTo(s * 0.34, s * 0.3);
            ctx.closePath();
            ctx.fill();
        }
        if (ic.kind === 'music') {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(-s * 0.08, s * 0.14, s * 0.11, s * 0.085, -0.35, 0, 6.2832);
            ctx.fill();
            ctx.fillRect(s * 0.01, -s * 0.22, s * 0.05, s * 0.36);
            ctx.fillRect(s * 0.01, -s * 0.22, s * 0.18, s * 0.07);
        }
        if (ic.kind === 'code') {
            ctx.fillStyle = '#4de0a0';
            ctx.font = `bold ${s * 0.26}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('</>', 0, 0);
        }
        if (ic.kind === 'trash') {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(-s * 0.24, -s * 0.2, s * 0.48, s * 0.07);
            for (let i = -1; i <= 1; i++) ctx.fillRect(i * s * 0.14 - s * 0.02, -s * 0.06, s * 0.05, s * 0.3);
        }

        // הבהוב תפיסה
        if (ic.flash > 0) {
            ctx.strokeStyle = `rgba(255,255,255,${ic.flash})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8, s * 0.17);
            ctx.stroke();
        }

        // רטוב - שכבה כהה וטיפות
        if (ic.wet > 0.03) {
            ctx.save();
            ctx.globalAlpha = ic.wet * 0.45;
            ctx.fillStyle = '#12243a';
            ctx.beginPath();
            ctx.roundRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72, s * 0.15);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = `rgba(200,230,255,${ic.wet * 0.7})`;
            for (let i = 0; i < 3; i++) {
                const t = (performance.now() / 600 + i * 0.4) % 1;
                ctx.beginPath();
                ctx.arc(-s * 0.2 + i * s * 0.2, s * 0.36 + t * s * 0.18, s * 0.035, 0, 6.2832);
                ctx.fill();
            }
        }

        // תווית - מוסתרת כשהאייקון בידיים של הדמות, כדי שהערימה לא תתמלא בטקסט
        ctx.restore();
        if (ic.sheltered || ic === this.caught) return;
        ctx.save();
        ctx.translate(ic.x, ic.y + s * 0.62);
        ctx.font = `${Math.round(s * 0.2)}px system-ui, 'Noto Sans Hebrew', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const tw = ctx.measureText(ic.label).width;
        ctx.beginPath();
        ctx.roundRect(-tw / 2 - 5, -2, tw + 10, s * 0.28, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(ic.label, 0, 0);
        ctx.restore();
    }

    drawWindow(ctx, wn, env) {
        ctx.save();
        ctx.translate(wn.x, wn.y);

        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#05080e';
        ctx.beginPath();
        ctx.roundRect(5, 10, wn.w, wn.h, 16);
        ctx.fill();
        ctx.restore();

        // מסגרת זכוכית
        ctx.fillStyle = 'rgba(16,20,28,0.82)';
        ctx.beginPath();
        ctx.roundRect(0, 0, wn.w, wn.h, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // סרגל עליון
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect(0, 0, wn.w, 34, [14, 14, 0, 0]);
        ctx.fill();
        ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(16 + i * 18, 17, 6, 0, 6.2832);
            ctx.fill();
        });
        ctx.fillStyle = '#e7ecf3';
        ctx.font = "600 14px system-ui, 'Noto Sans Hebrew', sans-serif";
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.fillText(wn.title, wn.w - 14, 18);

        // כותרות גוללות
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 34, wn.w, wn.h - 34);
        ctx.clip();
        ctx.font = "13px system-ui, 'Noto Sans Hebrew', sans-serif";
        ctx.textBaseline = 'top';
        const lh = 26;
        const total = wn.lines.length * lh;
        const off = total > wn.h - 46 ? -(wn.scroll % total) : 0;
        wn.lines.forEach((line, i) => {
            let y = 44 + i * lh + off;
            if (y < 20) y += total;
            if (y > wn.h + 10) return;
            ctx.fillStyle = 'rgba(47,224,189,0.9)';
            ctx.beginPath();
            ctx.arc(wn.w - 18, y + 8, 3.5, 0, 6.2832);
            ctx.fill();
            ctx.fillStyle = 'rgba(232,238,245,0.9)';
            const txt = line.length > 42 ? line.slice(0, 41) + '…' : line;
            ctx.fillText(txt, wn.w - 30, y);
        });
        ctx.restore();

        if (wn.wet > 0.03) {
            ctx.save();
            ctx.globalAlpha = wn.wet * 0.5;
            ctx.fillStyle = '#0d2236';
            ctx.beginPath();
            ctx.roundRect(0, 0, wn.w, wn.h, 14);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
}
