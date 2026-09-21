/*
 * photo.js - מצב פוטו: דמות ורקע אמיתיים במקום הציור הווקטורי.
 *
 * הסרטון שהשראה ממנו נוצר הפיצ'ר הזה הוא וידאו שנוצר במודל AI ומנוגן
 * כטפט. כאן אותו רעיון, רק שהוידאו לא "מת": מסביבו רצים הגשם, הרוח,
 * הקול, האייקונים והתגובות - וה-PhotoLayer הוא מה שמנגן את החומר האמיתי
 * ומרכיב אותו לתוך הסצנה.
 *
 * שלושה דברים קורים כאן:
 *   MediaStore - שמירת הקבצים ב-IndexedDB, כדי שהטפט ייפתח איתם גם אופליין.
 *   Keyer      - חיתוך רקע ב-WebGL (chroma key ב-CbCr), כי פלט של מודלי
 *                תמונה/וידאו כמעט אף פעם לא מגיע עם שקיפות.
 *   PhotoLayer - שכבה אחת - רקע מלא מסך או דמות - עם נשימה, פרלקסה
 *                לפי הסמן, גוון לפי השעה ומזג האוויר, וברק של רטיבות.
 */

/* ------------------------------------------------------ אחסון מקומי */

const DB_NAME = 'live-wallpaper-media';
const STORE = 'files';

export class MediaStore {
    static open() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
            };
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    }

    static async put(key, blob) {
        const db = await MediaStore.open();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(blob, key);
            tx.oncomplete = () => res(true);
            tx.onerror = () => rej(tx.error);
        });
    }

    static async get(key) {
        const db = await MediaStore.open();
        return new Promise((res) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => res(null);
        });
    }

    static async del(key) {
        const db = await MediaStore.open();
        return new Promise((res) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
        });
    }
}

/* ------------------------------------------------- חיתוך רקע ב-WebGL */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    v_uv = (a_pos + 1.0) * 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// המרחק נמדד במישור הצבע (CbCr) ולא ב-RGB, כדי שצללים וקיפולי בד
// - שהם אותו גוון בבהירות אחרת - לא ייחתכו יחד עם הרקע.
const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_key;
uniform float u_tol;      // מתחת לזה: שקוף לגמרי
uniform float u_soft;     // רוחב המעבר לאטום
uniform float u_spill;    // ניקוי גלישת הצבע מהשוליים
uniform float u_enabled;
varying vec2 v_uv;

vec2 chroma(vec3 c) {
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    return vec2(c.b - y, c.r - y);
}

void main() {
    vec4 src = texture2D(u_tex, v_uv);
    if (u_enabled < 0.5) {
        gl_FragColor = vec4(src.rgb * src.a, src.a);
        return;
    }
    float d = distance(chroma(src.rgb), chroma(u_key));
    float a = smoothstep(u_tol, u_tol + max(u_soft, 0.001), d);

    // הסרת גלישה: בפיקסלים חצי-שקופים מושכים את הצבע לעבר אפור ניטרלי
    vec3 rgb = src.rgb;
    float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(rgb, vec3(lum), (1.0 - a) * u_spill);

    a *= src.a;
    gl_FragColor = vec4(rgb * a, a);   // alpha מוכפל מראש, כמו שקנבס דו-ממדי מצפה
}`;

export class Keyer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
        this.ok = !!this.gl;
        if (!this.ok) return;

        const gl = this.gl;
        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                console.warn('shader:', gl.getShaderInfoLog(sh));
                return null;
            }
            return sh;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) { this.ok = false; return; }

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.ok = false; return; }
        gl.useProgram(prog);
        this.prog = prog;

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        this.u = {
            key: gl.getUniformLocation(prog, 'u_key'),
            tol: gl.getUniformLocation(prog, 'u_tol'),
            soft: gl.getUniformLocation(prog, 'u_soft'),
            spill: gl.getUniformLocation(prog, 'u_spill'),
            enabled: gl.getUniformLocation(prog, 'u_enabled'),
        };

        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        for (const [k, v] of [
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
            [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        ]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }

    /** מצייר את המקור (וידאו/תמונה) לקנבס הפנימי כשהרקע חתוך. */
    render(source, w, h, cfg) {
        if (!this.ok) return null;
        const gl = this.gl;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } catch (_) {
            return null;                       // פריים עוד לא מוכן
        }
        gl.uniform3f(this.u.key, cfg.key[0] / 255, cfg.key[1] / 255, cfg.key[2] / 255);
        gl.uniform1f(this.u.tol, cfg.tolerance);
        gl.uniform1f(this.u.soft, cfg.softness);
        gl.uniform1f(this.u.spill, cfg.spill);
        gl.uniform1f(this.u.enabled, cfg.enabled ? 1 : 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return this.canvas;
    }
}

/* ------------------------------------------------------- שכבת מדיה */

const DEFAULTS = {
    actor: {
        scale: 1.22, anchorX: 0.5, anchorY: 0.97, offsetX: 0, offsetY: 0,
        flip: false, breathe: true, parallax: 1,
        handsX: 0, handsY: 0.80,          // איפה הידיים, ביחס לגובה הדמות
    },
    bg: { scale: 1, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, flip: false, breathe: false, parallax: 0.35 },
};

export class PhotoLayer {
    /** kind: 'actor' (דמות חתוכה) או 'bg' (רקע מלא מסך) */
    constructor(kind, keyer) {
        this.kind = kind;
        this.keyer = keyer;
        this.el = null;                   // <video> או <img>
        this.isVideo = false;
        this.ready = false;
        this.name = '';
        this.t = 0;
        this.err = '';
        this.cfg = {
            ...DEFAULTS[kind],
            key: [0, 177, 64],            // ירוק סטנדרטי
            tolerance: 0.16,
            softness: 0.11,
            spill: 0.7,
            enabled: false,               // נדלק אוטומטית לפי סוג הקובץ
        };
    }

    get storeKey() { return `media:${this.kind}`; }
    get cfgKey() { return `live-wallpaper-photo-${this.kind}`; }

    loadCfg() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.cfgKey) || 'null');
            if (raw) Object.assign(this.cfg, raw);
        } catch (_) { /* ברירות מחדל */ }
    }

    saveCfg() {
        try { localStorage.setItem(this.cfgKey, JSON.stringify(this.cfg)); } catch (_) {}
    }

    /** קובץ חדש מהמשתמש. מחזיר true אם נטען בהצלחה. */
    async setFile(file) {
        if (!file) return false;
        const ok = await this.attach(file, file.name);
        if (ok) {
            try { await MediaStore.put(this.storeKey, file); } catch (_) { /* מצב פרטי */ }
            if (this.kind === 'actor') this.autoDetect();
            this.saveCfg();
        }
        return ok;
    }

    /** טעינה מחדש ממה שנשמר בביקור הקודם. */
    async restore() {
        this.loadCfg();
        let blob = null;
        try { blob = await MediaStore.get(this.storeKey); } catch (_) { return false; }
        if (!blob) return false;
        return this.attach(blob, blob.name || 'saved');
    }

    /**
     * טעינה מקובץ שיושב באתר עצמו (docs/wall/media/...). כך אפשר לשמור
     * את הדמות בריפו ולקבל אותה בכל מכשיר - גם בטלפון וגם ב-GitHub Pages -
     * בלי להעלות מחדש. קובץ שהמשתמש העלה בעצמו תמיד גובר על זה.
     */
    async attachUrl(url) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return false;
            const blob = await res.blob();
            const ok = await this.attach(blob, url.split('/').pop());
            if (ok) {
                this.fromRepo = true;
                if (this.kind === 'actor' && this.cfg.enabled === undefined) this.autoDetect();
            }
            return ok;
        } catch (_) {
            return false;
        }
    }

    async attach(blob, name) {
        this.dispose();
        const url = URL.createObjectURL(blob);
        this.url = url;
        this.name = name;
        const type = blob.type || '';
        this.isVideo = /^video\//.test(type) || /\.(mp4|webm|mov|m4v)$/i.test(name);

        return new Promise((res) => {
            const fail = (why) => { this.err = why; this.ready = false; res(false); };
            if (this.isVideo) {
                const v = document.createElement('video');
                v.src = url;
                v.loop = true;
                v.muted = true;
                v.playsInline = true;
                v.autoplay = true;
                v.crossOrigin = 'anonymous';
                v.addEventListener('loadeddata', () => {
                    this.el = v;
                    this.ready = true;
                    v.play().catch(() => { /* מחכה למחווה של המשתמש */ });
                    res(true);
                }, { once: true });
                v.addEventListener('error', () => fail('הדפדפן לא הצליח לפתוח את הווידאו'), { once: true });
            } else {
                const img = new Image();
                img.src = url;
                img.decoding = 'async';
                img.onload = () => { this.el = img; this.ready = true; res(true); };
                img.onerror = () => fail('הדפדפן לא הצליח לפתוח את התמונה');
            }
        });
    }

    dispose() {
        if (this.el && this.isVideo) { try { this.el.pause(); } catch (_) {} }
        if (this.url) URL.revokeObjectURL(this.url);
        this.el = null;
        this.url = null;
        this.ready = false;
        this.err = '';
    }

    async clear() {
        this.dispose();
        this.name = '';
        try { await MediaStore.del(this.storeKey); } catch (_) {}
    }

    get srcW() { return this.el ? (this.isVideo ? this.el.videoWidth : this.el.naturalWidth) : 0; }
    get srcH() { return this.el ? (this.isVideo ? this.el.videoHeight : this.el.naturalHeight) : 0; }

    /**
     * בודק את מסגרת השוליים של הפריים ומחליט מה לעשות:
     *   - אם יש שם שקיפות, הקובץ כבר חתוך ואין מה לחתוך.
     *   - אם השוליים בצבע אחיד, זה מסך ירוק (או כל צבע אחר) - מדליקים
     *     חיתוך ולוקחים את הצבע הזה.
     *   - אחרת זה רקע צילומי אמיתי, שאי אפשר לחתוך בצבע.
     * מחזיר 'alpha' | 'flat' | 'photo' | null.
     */
    probe() {
        if (!this.ready || !this.srcW) return null;
        const N = 48;
        const c = document.createElement('canvas');
        c.width = c.height = N;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.clearRect(0, 0, N, N);
        try { g.drawImage(this.el, 0, 0, N, N); } catch (_) { return null; }
        let d;
        try { d = g.getImageData(0, 0, N, N).data; } catch (_) { return null; }

        // טבעת השוליים: שתי שורות/עמודות מכל צד
        const ring = [];
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue;
                const i = (y * N + x) * 4;
                ring.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
            }
        }
        if (!ring.length) return null;

        const clear = ring.filter((p) => p[3] < 24).length / ring.length;
        if (clear > 0.3) return 'alpha';

        const mean = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
            .map((v) => v / ring.length);
        const chroma = (p) => {
            const y = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
            return [p[2] - y, p[0] - y];
        };
        const mc = chroma(mean);
        const alike = ring.filter((p) => {
            const pc = chroma(p);
            return Math.hypot(pc[0] - mc[0], pc[1] - mc[1]) < 26;
        }).length / ring.length;

        this.detected = { mean: mean.map(Math.round), alike };
        return alike > 0.82 ? 'flat' : 'photo';
    }

    /** מפעיל את מה ש-probe מצא. */
    autoDetect() {
        const kind = this.probe();
        this.hint = '';
        if (kind === 'alpha') {
            this.cfg.enabled = false;
            this.hint = 'הקובץ כבר חתוך (יש בו שקיפות) - לא צריך חיתוך רקע.';
        } else if (kind === 'flat') {
            this.cfg.key = this.detected.mean;
            this.cfg.enabled = true;
            this.hint = 'זיהיתי רקע אחיד והדלקתי חיתוך. כוונו את הסף אם נשארו שאריות.';
        } else if (kind === 'photo') {
            this.cfg.enabled = false;
            this.hint = 'הרקע בתמונה הוא צילום ולא צבע אחיד, ולכן אי אפשר לחתוך אותו לפי צבע. '
                + 'העלו PNG עם שקיפות, או וידאו על רקע ירוק.';
        }
        this.saveCfg();
        return kind;
    }

    /** חיתוך לפי הצבע שבשוליים, גם אם הזיהוי האוטומטי החליט אחרת. */
    autoKey() {
        this.probe();
        if (this.detected) {
            this.cfg.key = this.detected.mean;
            this.cfg.enabled = true;
            this.hint = '';
            this.saveCfg();
        }
    }

    update(dt) { this.t += dt; }

    /** מחזיר את המקור אחרי חיתוך (או את המקור עצמו אם אין חיתוך). */
    frame() {
        if (!this.ready) return null;
        if (this.isVideo && this.el.readyState < 2) return null;
        if (!this.cfg.enabled || !this.keyer || !this.keyer.ok) return this.el;
        const w = Math.min(this.srcW, 1280);
        const h = Math.round(w * (this.srcH / Math.max(1, this.srcW)));
        return this.keyer.render(this.el, w, h, this.cfg) || this.el;
    }

    /* --------------------------------------------------------- רקע */

    drawBg(ctx, W, H, env) {
        const src = this.frame();
        if (!src) return false;
        const sw = this.srcW, sh = this.srcH;
        if (!sw || !sh) return false;

        // כיסוי מלא מסך, עם פרלקסה עדינה לפי הסמן
        const k = Math.max(W / sw, H / sh) * this.cfg.scale;
        const dw = sw * k, dh = sh * k;
        const px = (this.parX || 0) * this.cfg.parallax * 18;
        const py = (this.parY || 0) * this.cfg.parallax * 12;
        ctx.save();
        ctx.drawImage(src,
            (W - dw) / 2 + this.cfg.offsetX + px,
            (H - dh) / 2 + this.cfg.offsetY + py, dw, dh);
        this.tintScreen(ctx, W, H, env);
        ctx.restore();
        return true;
    }

    /** מיישר את התמונה האמיתית לשעה ולמזג האוויר של הסצנה. */
    tintScreen(ctx, W, H, env) {
        const night = Math.max(0, Math.min(1, (-env.sunAlt + 0.1) * 1.6));
        const gloom = { storm: 0.34, rain: 0.2, snow: 0.14, fog: 0.16, clouds: 0.07 }[env.weather] || 0;
        if (night > 0.02) {
            ctx.fillStyle = `rgba(12,20,48,${night * 0.55})`;
            ctx.fillRect(0, 0, W, H);
        } else if (env.sunAlt < 0.25) {
            ctx.fillStyle = `rgba(255,150,70,${(0.25 - env.sunAlt) * 0.5})`;   // שעת זהב
            ctx.fillRect(0, 0, W, H);
        }
        if (gloom) {
            ctx.fillStyle = `rgba(38,48,66,${gloom})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* -------------------------------------------------------- דמות */

    /**
     * מצייר את הדמות כך שהנקודה (anchorX, anchorY) שבתמונה נוחתת על
     * (o.x, o.y) - כלומר כפות הרגליים על החול - וגובהה o.height פיקסלים.
     */
    drawActor(ctx, o) {
        const src = this.frame();
        if (!src) return false;
        const sw = this.srcW, sh = this.srcH;
        if (!sw || !sh) return false;

        const c = this.cfg;
        const dh = o.height * c.scale;
        const dw = dh * (sw / sh);
        // נשימה: שינוי גובה זעיר, מעוגן ברגליים
        const breathe = c.breathe ? 1 + Math.sin(this.t * 1.35) * 0.0055 : 1;
        const bh = dh * breathe;

        // הדמות נבנית קודם בקנבס פנימי. זה הכרחי: הגוון והרטיבות מצוירים
        // עם source-atop, וה-composite הזה חל על *כל* קנבס היעד - על הקנבס
        // הראשי הוא היה צובע מלבן אפור על הסצנה מאחורי הדמות.
        const dpr = o.dpr || 1;
        const bufW = Math.max(1, Math.ceil(dw * dpr));
        const bufH = Math.max(1, Math.ceil(bh * dpr));
        if (!this.buf || this.buf.width !== bufW || this.buf.height !== bufH) {
            this.buf = document.createElement('canvas');
            this.buf.width = bufW;
            this.buf.height = bufH;
            this.bctx = this.buf.getContext('2d');
        }
        const b = this.bctx;
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, bufW, bufH);
        b.setTransform(dpr, 0, 0, dpr, 0, 0);
        b.drawImage(src, 0, 0, dw, bh);
        this.tintActor(b, 0, 0, dw, bh, o);

        // פרלקסה: התמונה נעה קצת לכיוון הסמן, מה שנותן תחושת מבט
        const px = (this.parX || 0) * c.parallax * o.height * 0.018;
        const py = (this.parY || 0) * c.parallax * o.height * 0.010;
        const flip = (c.flip ? -1 : 1) * (o.facing < 0 ? -1 : 1);

        ctx.save();
        this.drawGroundShadow(ctx, o, dw);
        ctx.translate(o.x + c.offsetX + px, o.y + c.offsetY + py);
        ctx.scale(flip, 1);
        ctx.shadowColor = 'rgba(8,14,26,0.45)';
        ctx.shadowBlur = o.height * 0.03;
        ctx.drawImage(this.buf, -dw * c.anchorX, -bh * c.anchorY, dw, bh);
        ctx.restore();
        return true;
    }

    drawGroundShadow(ctx, o, dw) {
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, dw * 0.42);
        const a = o.env && o.env.sunAlt < -0.05 ? 0.2 : 0.32;
        g.addColorStop(0, `rgba(28,22,14,${a})`);
        g.addColorStop(1, 'rgba(28,22,14,0)');
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(1, 0.24);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, dw * 0.42, 0, 6.2832);
        ctx.fill();
        ctx.restore();
    }

    /** גוון לילה/סערה וברק של רטיבות - רק על הפיקסלים של הדמות. */
    tintActor(ctx, x, y, w, h, o) {
        const env = o.env || {};
        const night = Math.max(0, Math.min(1, (-(env.sunAlt || 0) + 0.1) * 1.5));
        const gloom = { storm: 0.3, rain: 0.18, snow: 0.12, fog: 0.14 }[env.weather] || 0;
        const shade = Math.min(0.6, night * 0.5 + gloom);

        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';    // צובע רק את מה שכבר צויר
        if (shade > 0.02) {
            ctx.fillStyle = `rgba(14,22,46,${shade})`;
            ctx.fillRect(x, y, w, h);
        } else if ((env.sunAlt || 0) < 0.25) {
            ctx.fillStyle = `rgba(255,160,80,${(0.25 - (env.sunAlt || 0)) * 0.45})`;
            ctx.fillRect(x, y, w, h);
        }
        if (o.wet > 0.05) {
            const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
            g.addColorStop(0, `rgba(190,225,255,${o.wet * 0.22})`);
            g.addColorStop(0.5, 'rgba(190,225,255,0)');
            g.addColorStop(1, `rgba(190,225,255,${o.wet * 0.14})`);
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
    }

    /** לאן נצמדים אייקונים שהדמות "מחזיקה" - נקודה שהמשתמש מכוון. */
    graspPoint(o) {
        const c = this.cfg;
        return {
            x: o.x + c.offsetX + c.handsX * o.height,
            y: o.y + c.offsetY - c.handsY * o.height,
        };
    }

    /** עדכון כיוון הפרלקסה לפי מיקום הסמן ביחס למרכז המסך. */
    aim(nx, ny) {
        const s = 0.12;
        this.parX = (this.parX || 0) + (nx - (this.parX || 0)) * s;
        this.parY = (this.parY || 0) + (ny - (this.parY || 0)) * s;
    }
}
