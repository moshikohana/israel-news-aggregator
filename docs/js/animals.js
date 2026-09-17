/*
 * animals.js - חיות תלת ממד פרוצדורליות בגודל אמיתי
 *
 * כל המידות כאן הן במטרים אמיתיים, כדי שבמצב AR החיה תופיע
 * בגודל שלה בעולם האמיתי (1 יחידת THREE = 1 מטר).
 * המודלים נבנים מפרימיטיבים בזמן ריצה - בלי קבצי GLB חיצוניים,
 * כך שהפיצ'ר עובד גם בלי רשת/CDN של נכסים.
 */
import * as THREE from 'three';

/* ---------------------------------------------------------------- טקסטורות */

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const PATTERNS = {
    zebra: () => canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f2ece0';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#17171a';
        for (let i = 0; i < 22; i++) {
            const x = (i / 22) * w;
            const width = 4 + Math.abs(Math.sin(i * 1.7)) * 9;
            ctx.save();
            ctx.translate(x, 0);
            ctx.rotate((Math.sin(i) * 8 * Math.PI) / 180);
            ctx.fillRect(0, -10, width, h + 20);
            ctx.restore();
        }
    }, 2, 1),

    tiger: () => canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#e08a2b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fbf3e6';
        ctx.fillRect(0, h * 0.72, w, h * 0.28);
        ctx.fillStyle = '#1d1712';
        for (let i = 0; i < 18; i++) {
            const x = (i / 18) * w + Math.sin(i * 3.1) * 6;
            ctx.save();
            ctx.translate(x, 0);
            ctx.rotate((Math.sin(i * 2) * 14 * Math.PI) / 180);
            ctx.fillRect(0, -6, 3 + Math.abs(Math.cos(i)) * 5, h * (0.45 + Math.abs(Math.sin(i)) * 0.4));
            ctx.restore();
        }
    }, 2, 1),

    giraffe: () => canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f0d9a8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#9a6021';
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const cx = (x + 0.5 + (y % 2) * 0.4) * (w / 8);
                const cy = (y + 0.5) * (h / 8);
                const r = w / 22;
                ctx.beginPath();
                for (let a = 0; a < 7; a++) {
                    const ang = (a / 7) * Math.PI * 2;
                    const rr = r * (0.75 + Math.abs(Math.sin(a * 2 + x + y)) * 0.5);
                    ctx[a ? 'lineTo' : 'moveTo'](cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
    }, 2, 2),

    leopard: () => canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 160; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 4 + Math.random() * 6;
            ctx.strokeStyle = '#2b1d0e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0.4, Math.PI * 1.9);
            ctx.stroke();
        }
    }, 2, 2),

    cow: () => canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f6f2ec';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2a2724';
        for (let i = 0; i < 12; i++) {
            const cx = Math.random() * w;
            const cy = Math.random() * h;
            ctx.beginPath();
            for (let a = 0; a < 9; a++) {
                const ang = (a / 9) * Math.PI * 2;
                const rr = (18 + Math.random() * 26);
                ctx[a ? 'lineTo' : 'moveTo'](cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
            }
            ctx.closePath();
            ctx.fill();
        }
    }, 2, 2),

    fur: (light, dark) => canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = dark;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        for (let i = 0; i < 700; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 6, y + 4 + Math.random() * 6);
            ctx.stroke();
        }
    }, 3, 3),
};

const textureCache = new Map();
function pattern(name, a, b) {
    const key = `${name}|${a}|${b}`;
    if (!textureCache.has(key)) textureCache.set(key, PATTERNS[name](a, b));
    return textureCache.get(key);
}


/* ------------------------------------------------------------ עזרי חומרים */

function mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: opts.roughness ?? 0.9,
        metalness: 0,
        map: opts.map || null,
        flatShading: opts.flat || false,
    });
}

function ball(radius, material) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
    m.castShadow = true;
    return m;
}

/** כדור מתוח לצירים שונים - הבסיס לראשים, ללחיים ולכריות */
function ellipsoid(rx, ry, rz, material) {
    const m = ball(1, material);
    m.scale.set(rx, ry, rz);
    return m;
}

/** גליל מתחדד שמצביע לכיוון +Y, עם קצוות מעוגלים */
function taper(rBottom, rTop, length, material, round = true) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBottom, length, 14, 1, true),
        material
    );
    body.position.y = length / 2;
    body.castShadow = true;
    g.add(body);
    if (round) {
        const bottom = ball(rBottom, material);
        bottom.scale.y = 0.75;
        const top = ball(rTop, material);
        top.scale.y = 0.75;
        top.position.y = length;
        g.add(bottom, top);
    }
    return g;
}

function cone(radius, height, material) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 14), material);
    m.castShadow = true;
    return m;
}

const EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x0d0c0a, roughness: 0.15 });
const NOSE_MAT = new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.5 });

/* ------------------------------------------------- גוף לפי עמוד שדרה מעוקל */

/**
 * בונה גוף אורגני: מעבירים עקומה חלקה דרך נקודות עמוד השדרה,
 * וסביב כל נקודה נמתחת טבעת אליפטית ברדיוס וברוחב משתנים.
 * ככה מתקבל גוף שמתעבה בחזה, נכנס במותן ומתדקק לצוואר -
 * במקום קפסולה אחידה שנראית כמו נקניק.
 *
 * points: [{ z, y, r, w }] מהזנב קדימה. r = רדיוס אנכי, w = מכפיל רוחב.
 */
function spineBody(points, material, opts = {}) {
    const segments = opts.segments ?? 60;
    const radial = opts.radial ?? 18;
    const widthScale = opts.width ?? 1;

    const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(0, p.y, p.z)), false, 'catmullrom', 0.5
    );

    // מיפוי t על העקומה לפרופיל הרדיוסים של נקודות הבקרה
    const profile = (t) => {
        const x = t * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(x));
        const f = x - i;
        const smooth = f * f * (3 - 2 * f);
        return {
            r: points[i].r + (points[i + 1].r - points[i].r) * smooth,
            w: (points[i].w ?? 1) + ((points[i + 1].w ?? 1) - (points[i].w ?? 1)) * smooth,
        };
    };

    const pos = [];
    const uv = [];
    const idx = [];
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const point = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        curve.getPoint(t, point);
        curve.getTangent(t, tangent);
        // הגוף שטוח במישור x=0, אז "ימינה" הוא תמיד ציר X - בלי פיתולים
        right.crossVectors(up, tangent).normalize();
        if (right.lengthSq() < 0.5) right.set(1, 0, 0);
        normal.crossVectors(tangent, right).normalize();

        const { r, w } = profile(t);
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            pos.push(
                point.x + right.x * cos * r * w * widthScale + normal.x * sin * r,
                point.y + right.y * cos * r * w * widthScale + normal.y * sin * r,
                point.z + right.z * cos * r * w * widthScale + normal.z * sin * r
            );
            uv.push(t * (opts.repeat ?? 2), j / radial);
        }
    }

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * (radial + 1) + j;
            const b = a + radial + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;

    // סגירת הקצוות בכדורים, כדי שלא יישארו חורים
    const head = profile(1);
    const tail = profile(0);
    const capA = ellipsoid(tail.r * tail.w * widthScale, tail.r, tail.r, material);
    capA.position.copy(curve.getPoint(0));
    const capB = ellipsoid(head.r * head.w * widthScale, head.r, head.r, material);
    capB.position.copy(curve.getPoint(1));

    const group = new THREE.Group();
    group.add(mesh, capA, capB);
    group.userData.curve = curve;
    group.userData.mesh = mesh;
    return group;
}

/* ----------------------------------------------------------------- רגליים */

/**
 * רגל בעלת שלושה מקטעים (ירך, שוק, כף) עם זוויות מפרק שונות
 * לחיות שהולכות על כפות (digitigrade) ולחיות שהולכות על פרסות.
 */
function buildLeg(cfg, material, isFront) {
    const len = cfg.length;
    const hip = new THREE.Group();

    const upperLen = len * 0.42;
    const lowerLen = len * 0.36;
    const footLen = len * 0.22;
    const r = cfg.thickness;

    const upper = taper(r, r * 0.8, upperLen, material);
    upper.rotation.x = Math.PI; // מצביע כלפי מטה
    hip.add(upper);

    const knee = new THREE.Group();
    knee.position.y = -upperLen;
    hip.add(knee);
    const lower = taper(r * 0.8, r * 0.6, lowerLen, material);
    lower.rotation.x = Math.PI;
    knee.add(lower);

    const ankle = new THREE.Group();
    ankle.position.y = -lowerLen;
    knee.add(ankle);
    const pastern = taper(r * 0.6, r * 0.5, footLen, material);
    pastern.rotation.x = Math.PI;
    ankle.add(pastern);

    // תנוחת מנוחה: הברך והקרסול כפופים קלות כמו בחיה עומדת
    const bend = cfg.digitigrade ? 1 : 0.45;
    knee.rotation.x = (isFront ? -0.22 : 0.4) * bend;
    ankle.rotation.x = (isFront ? 0.18 : -0.45) * bend;

    if (cfg.hoof) {
        const hoof = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.75, r * 0.95, r * 1.5, 12),
            mat(cfg.hoofColor || 0x2f2a25)
        );
        hoof.position.y = -footLen + r * 0.6;
        hoof.castShadow = true;
        ankle.add(hoof);
    } else {
        const paw = ellipsoid(r * 1.1, r * 0.7, r * 1.7, material);
        paw.position.set(0, -footLen + r * 0.5, r * 0.7);
        ankle.add(paw);
        for (let i = -1; i <= 1; i++) {
            const toe = ellipsoid(r * 0.32, r * 0.3, r * 0.45, material);
            toe.position.set(i * r * 0.62, -footLen + r * 0.35, r * 1.75);
            ankle.add(toe);
        }
    }

    return { hip, knee, ankle };
}

/* -------------------------------------------------------------------- זנב */

function buildTail(cfg, material) {
    const root = new THREE.Group();
    const joints = [];
    const segs = cfg.segments ?? 6;
    const segLen = cfg.length / segs;
    let parent = root;
    for (let i = 0; i < segs; i++) {
        const joint = new THREE.Group();
        if (i > 0) joint.position.y = -segLen;
        parent.add(joint);
        const r0 = cfg.radius * (1 - (i / segs) * (cfg.taper ?? 0.75));
        const r1 = cfg.radius * (1 - ((i + 1) / segs) * (cfg.taper ?? 0.75));
        const seg = taper(r0, r1, segLen, material, i === segs - 1);
        seg.rotation.x = Math.PI;
        joint.add(seg);
        joints.push(joint);
        parent = joint;
    }
    if (cfg.tuft) {
        const tuft = ellipsoid(cfg.radius * 1.6, cfg.radius * 2.4, cfg.radius * 1.6, mat(cfg.tuft));
        tuft.position.y = -segLen;
        joints[joints.length - 1].add(tuft);
    }
    return { root, joints };
}

/* -------------------------------------------------------------------- ראש */

function buildHead(cfg, skinMat) {
    const head = new THREE.Group();
    const size = cfg.size;                       // אורך הגולגולת
    const w = size * (cfg.width ?? 0.62);
    const h = size * (cfg.height ?? 0.66);

    const skull = ellipsoid(w, h, size, skinMat);
    head.add(skull);

    // לחיים / רכס גבות - מה שנותן לראש אופי
    if (cfg.cheeks !== false) {
        for (const side of [-1, 1]) {
            const cheek = ellipsoid(w * 0.55, h * 0.5, size * 0.5, skinMat);
            cheek.position.set(side * w * 0.55, -h * 0.15, size * 0.1);
            head.add(cheek);
        }
    }

    // חוטם מתחדד קדימה
    const muzzleLen = size * (cfg.muzzle ?? 1.1);
    const muzzleR = w * (cfg.muzzleWidth ?? 0.62);
    if (muzzleLen > 0.01) {
        const muzzle = taper(muzzleR, muzzleR * (cfg.muzzleTaper ?? 0.72), muzzleLen, skinMat, false);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, -h * (cfg.muzzleDrop ?? 0.18), size * 0.62);
        head.add(muzzle);

        const tipR = muzzleR * (cfg.muzzleTaper ?? 0.72);
        const tip = ellipsoid(tipR, tipR * 0.9, tipR * 0.8, skinMat);
        tip.position.set(0, -h * (cfg.muzzleDrop ?? 0.18), size * 0.62 + muzzleLen);
        head.add(tip);

        const nose = ellipsoid(tipR * 0.55, tipR * 0.42, tipR * 0.35, NOSE_MAT);
        nose.position.set(0, -h * (cfg.muzzleDrop ?? 0.18) + tipR * 0.25, size * 0.62 + muzzleLen + tipR * 0.6);
        head.add(nose);

        // לסת תחתונה
        const jaw = ellipsoid(muzzleR * 0.85, h * 0.3, muzzleLen * 0.55, skinMat);
        jaw.position.set(0, -h * ((cfg.muzzleDrop ?? 0.18) + 0.42), size * 0.62 + muzzleLen * 0.45);
        head.add(jaw);
    }

    // עיניים בצדי הגולגולת, נוטות קדימה אצל טורפים
    const eyeR = size * (cfg.eye ?? 0.11);
    const eyeFwd = cfg.eyeForward ?? 0.55;
    for (const side of [-1, 1]) {
        const eye = ball(eyeR, EYE_MAT);
        eye.castShadow = false;
        eye.position.set(side * w * (1 - eyeFwd * 0.35), h * 0.35, size * eyeFwd);
        head.add(eye);
        if (cfg.brow !== false) {
            const brow = ellipsoid(w * 0.3, h * 0.16, size * 0.3, skinMat);
            brow.position.set(side * w * 0.62, h * 0.55, size * 0.35);
            head.add(brow);
        }
    }

    return { head, skull, size, w, h };
}

function addEars(head, cfg, skinMat, size, w, h) {
    const s = size * (cfg.size ?? 0.45);
    for (const side of [-1, 1]) {
        let ear;
        if (cfg.shape === 'fan') {                    // פיל
            ear = ellipsoid(s * 0.95, s * 1.25, s * 0.12, skinMat);
            ear.rotation.set(0.15, side * 0.85, side * 0.12);
            ear.position.set(side * w * 0.9, -h * 0.35, -size * 0.55);
        } else if (cfg.shape === 'round') {           // חתוליים ודובים
            ear = ellipsoid(s * 0.9, s * 0.9, s * 0.28, skinMat);
            ear.position.set(side * w * 0.78, h * 0.92, -size * 0.1);
            ear.rotation.y = side * 0.4;
        } else if (cfg.shape === 'tall') {            // קנגורו וארנביים
            ear = ellipsoid(s * 0.45, s * 1.5, s * 0.3, skinMat);
            ear.position.set(side * w * 0.6, h * 1.5, -size * 0.1);
            ear.rotation.z = side * 0.18;
        } else {                                       // מחודד - כלביים, סוסיים
            ear = cone(s * 0.55, s * 1.7, skinMat);
            ear.position.set(side * w * 0.62, h * 1.0, -size * 0.12);
            ear.rotation.set(-0.15, 0, side * 0.28);
        }
        ear.castShadow = true;
        head.add(ear);
    }
}

/* ------------------------------------------------------------ תוספות מינים */

function addMane(head, size, color) {
    const maneMat = mat(color, { map: pattern('fur', '#7a5228', '#3a2411'), flat: true });
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const lobe = ellipsoid(size * 0.62, size * 0.62, size * 0.42, maneMat);
        lobe.position.set(Math.cos(a) * size * 1.05, Math.sin(a) * size * 1.05 + size * 0.1, -size * 0.45);
        head.add(lobe);
    }
    const back = ellipsoid(size * 1.25, size * 1.3, size * 0.75, maneMat);
    back.position.z = -size * 0.75;
    head.add(back);
}

function addTusks(head, size, w, h) {
    for (const side of [-1, 1]) {
        const tusk = new THREE.Group();
        let parent = tusk;
        for (let i = 0; i < 5; i++) {
            const seg = taper(size * 0.1 * (1 - i * 0.15), size * 0.1 * (1 - (i + 1) * 0.15), size * 0.42, mat(0xefe6d2), i === 4);
            const joint = new THREE.Group();
            joint.position.y = i === 0 ? 0 : size * 0.42;
            joint.rotation.x = i === 0 ? 0 : 0.2;   // עיקול עדין קדימה ומעלה
            joint.add(seg);
            parent.add(joint);
            parent = joint;
        }
        tusk.position.set(side * w * 0.55, -h * 0.55, size * 0.75);
        tusk.rotation.set(Math.PI * 0.62, 0, side * 0.1);
        head.add(tusk);
    }
}

function addHorns(head, kind, size, w, h, color = 0x33302a) {
    const hornMat = mat(color);
    for (const side of [-1, 1]) {
        if (kind === 'antlers') {
            const beam = new THREE.Group();
            let parent = beam;
            for (let i = 0; i < 4; i++) {
                const joint = new THREE.Group();
                joint.position.y = i === 0 ? 0 : size * 0.5;
                joint.rotation.set(-0.18, 0, side * (i === 0 ? 0.45 : 0.12));
                joint.add(taper(size * 0.09 * (1 - i * 0.18), size * 0.09 * (1 - (i + 1) * 0.18), size * 0.5, hornMat, i === 3));
                parent.add(joint);
                if (i > 0) {                     // ענפים צדדיים
                    const tine = taper(size * 0.055, size * 0.02, size * 0.42, hornMat);
                    tine.rotation.set(-0.5, 0, side * 0.75);
                    joint.add(tine);
                }
                parent = joint;
            }
            beam.position.set(side * w * 0.5, h * 0.85, -size * 0.05);
            head.add(beam);
        } else if (kind === 'curved') {
            const horn = new THREE.Group();
            let parent = horn;
            for (let i = 0; i < 4; i++) {
                const joint = new THREE.Group();
                joint.position.y = i === 0 ? 0 : size * 0.26;
                joint.rotation.z = side * (i === 0 ? 0.9 : -0.28);
                joint.add(taper(size * 0.1 * (1 - i * 0.2), size * 0.1 * (1 - (i + 1) * 0.2), size * 0.26, hornMat, i === 3));
                parent.add(joint);
                parent = joint;
            }
            horn.position.set(side * w * 0.6, h * 0.8, -size * 0.05);
            head.add(horn);
        } else {                                  // קצר וישר
            const horn = taper(size * 0.09, size * 0.02, size * 0.42, hornMat);
            horn.position.set(side * w * 0.55, h * 0.8, -size * 0.05);
            horn.rotation.z = side * -0.55;
            head.add(horn);
        }
    }
}

function addJaws(head, size, w, h, skinMat) {
    // לסת טורפת: לסת תחתונה ארוכה עם שיניים בשתי הלסתות
    const jawLen = size * 1.5;
    const jaw = new THREE.Group();
    jaw.position.set(0, -h * 0.5, size * 0.35);
    const jawMesh = ellipsoid(w * 0.78, h * 0.34, jawLen * 0.55, skinMat);
    jawMesh.position.z = jawLen * 0.35;
    jaw.add(jawMesh);
    head.add(jaw);

    const toothMat = mat(0xf0e8d8);
    for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const z = size * 0.45 + t * jawLen * 0.78;
        const scale = 1 - t * 0.45;
        for (const side of [-1, 1]) {
            const upper = cone(size * 0.055 * scale, size * 0.24 * scale, toothMat);
            upper.rotation.x = Math.PI;
            upper.position.set(side * w * 0.62, -h * 0.42, z);
            head.add(upper);
            const lower = cone(size * 0.05 * scale, size * 0.2 * scale, toothMat);
            lower.position.set(side * w * 0.6, h * 0.12, z - size * 0.35);
            jaw.add(lower);
        }
    }
    return jaw;
}

/* ------------------------------------------------------------ בניית החיה */

const DEFAULTS = {
    bodyWidth: 0.95,
    withersLift: 0,
    rumpLift: 0,
    bellySag: 0,
    tilt: 0,
    legPairs: 2,
    neck: { length: 0.4, angle: 35, r0: 0.2, r1: 0.16 },
    head: { size: 0.25 },
    ears: { shape: 'pointy', size: 0.45 },
    legs: { thickness: 0.08 },
};

function rotateAboutX(y, z, pivotY, pivotZ, angle) {
    const dy = y - pivotY;
    const dz = z - pivotZ;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { y: pivotY + dy * cos - dz * sin, z: pivotZ + dy * sin + dz * cos };
}

function buildCreature(raw) {
    const cfg = { ...DEFAULTS, ...raw };
    const neck = { ...DEFAULTS.neck, ...(raw.neck || {}) };
    const legsCfg = { ...DEFAULTS.legs, ...(raw.legs || {}) };
    const earsCfg = { ...DEFAULTS.ears, ...(raw.ears || {}) };
    const headCfg = { ...DEFAULTS.head, ...(raw.head || {}) };

    const root = new THREE.Group();
    const torso = new THREE.Group();
    root.add(torso);

    const bodyMat = mat(cfg.color, { map: cfg.pattern ? pattern(cfg.pattern) : null, flat: cfg.flat });
    const skinMat = mat(cfg.skinColor || cfg.color, { flat: cfg.flat });

    const L = cfg.bodyLength;
    const back = cfg.back;                          // גובה קו הגב מהרצפה
    const chestR = cfg.chestR;
    const cy = back - chestR;                       // מרכז הגו

    // --- עמוד השדרה: מבסיס הזנב, דרך האגן והחזה, אל בסיס הצוואר ---
    const spine = [
        { z: -L * 0.50, y: cy + cfg.rumpLift * 0.8, r: cfg.rumpR * 0.62, w: 0.78 },
        { z: -L * 0.34, y: cy + cfg.rumpLift, r: cfg.rumpR, w: 1 },
        { z: -L * 0.10, y: cy - cfg.bellySag, r: cfg.waistR, w: 0.98 },
        { z: L * 0.14, y: cy, r: chestR, w: 1 },
        { z: L * 0.34, y: cy + cfg.withersLift, r: chestR * 0.9, w: 0.9 },
    ];

    // --- הצוואר ממשיך את אותה עקומה, בזווית שלו ---
    const neckAngle = THREE.MathUtils.degToRad(neck.angle);
    const start = spine[spine.length - 1];
    const dir = { y: Math.sin(neckAngle), z: Math.cos(neckAngle) };
    for (let i = 1; i <= 3; i++) {
        const t = i / 3;
        spine.push({
            z: start.z + dir.z * neck.length * t,
            y: start.y + dir.y * neck.length * t + neck.r0 * 0.35,
            r: neck.r0 + (neck.r1 - neck.r0) * t,
            w: 0.9 - t * 0.1,
        });
    }

    // --- הטיית הגו (חיות זקופות: קנגורו, פינגווין) ---
    const hips = spine[1];
    const tilt = THREE.MathUtils.degToRad(-cfg.tilt);
    if (cfg.tilt) {
        const pivotY = hips.y;
        const pivotZ = hips.z;
        for (const p of spine) {
            const rotated = rotateAboutX(p.y, p.z, pivotY, pivotZ, tilt);
            p.y = rotated.y;
            p.z = rotated.z;
        }
    }

    const body = spineBody(spine, bodyMat, { width: cfg.bodyWidth, repeat: cfg.textureRepeat ?? 2 });
    torso.add(body);

    if (cfg.bellyPatch) {
        const patch = ellipsoid(chestR * 0.78, chestR * 1.15, chestR * 0.55, mat(cfg.bellyPatch));
        patch.position.set(0, cy + chestR * 0.15, spine[3].z + chestR * 0.55);
        torso.add(patch);
    }

    // --- ראש ---
    const neckEnd = spine[spine.length - 1];
    const headPivot = new THREE.Group();
    headPivot.position.set(0, neckEnd.y + neck.r1 * 0.3, neckEnd.z);
    headPivot.rotation.x = -(neckAngle + tilt) * (headCfg.align ?? 0.35);
    torso.add(headPivot);

    const built = buildHead(headCfg, skinMat);
    headPivot.add(built.head);
    addEars(built.head, earsCfg, skinMat, built.size, built.w, built.h);

    if (cfg.mane) addMane(built.head, built.size, cfg.maneColor || 0x6b4423);
    if (cfg.tusks) addTusks(built.head, built.size, built.w, built.h);
    if (cfg.horns) addHorns(built.head, cfg.horns, built.size, built.w, built.h, cfg.hornColor);
    if (cfg.jaws) addJaws(built.head, built.size, built.w, built.h, skinMat);

    if (cfg.nasalHorn) {
        const big = cone(built.size * 0.2, cfg.nasalHorn, mat(0x8f867a));
        big.position.set(0, -built.h * 0.1, built.size * 1.35);
        big.rotation.x = -0.35;
        built.head.add(big);
        const small = cone(built.size * 0.14, cfg.nasalHorn * 0.42, mat(0x8f867a));
        small.position.set(0, built.h * 0.2, built.size * 0.72);
        small.rotation.x = -0.15;
        built.head.add(small);
    }

    if (cfg.beak) {
        const beak = cone(built.size * 0.26, cfg.beak, mat(cfg.beakColor || 0xdd8f34));
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -built.h * 0.1, built.size * 0.9 + cfg.beak * 0.4);
        built.head.add(beak);
    }

    let trunkJoints = null;
    if (cfg.trunk) {
        const trunk = buildTail({ length: cfg.trunk, radius: built.size * 0.3, segments: 7, taper: 0.62 }, skinMat);
        trunk.root.position.set(0, -built.h * 0.35, built.size * 0.95);
        built.head.add(trunk.root);
        trunk.joints.forEach((j, i) => { j.rotation.x = i === 0 ? 0.45 : 0.16; });
        trunkJoints = trunk.joints;
    }

    // --- רגליים ---
    const legs = [];
    const attach = [];
    if (cfg.legPairs === 2) attach.push({ point: spine[4], id: 'front', front: true });
    attach.push({ point: spine[1], id: 'back', front: false });

    for (const a of attach) {
        const spread = a.point.r * a.point.w * cfg.bodyWidth * 0.66;
        for (const side of [-1, 1]) {
            const leg = buildLeg({
                ...legsCfg,
                length: a.point.y * 1.04,
                thickness: a.front ? legsCfg.thickness : legsCfg.thickness * (legsCfg.backScale ?? 1.05),
            }, skinMat, a.front);
            leg.hip.position.set(side * spread, a.point.y, a.point.z);
            leg.id = `${a.id}${side < 0 ? 'L' : 'R'}`;
            leg.front = a.front;
            torso.add(leg.hip);
            legs.push(leg);

            // שריר הכתף/הירך שמחבר את הרגל לגוף
            const shoulder = ellipsoid(a.point.r * 0.42, a.point.r * 0.72, a.point.r * 0.62, skinMat);
            shoulder.position.set(side * spread, a.point.y - a.point.r * 0.15, a.point.z);
            torso.add(shoulder);
        }
    }

    // --- זרועות / כנפיים ---
    const arms = [];
    if (cfg.arms) {
        const at = spine[4];
        for (const side of [-1, 1]) {
            const shoulder = new THREE.Group();
            shoulder.position.set(side * at.r * at.w * cfg.bodyWidth * 0.9, at.y + at.r * 0.2, at.z);
            const limb = cfg.arms.flipper
                ? ellipsoid(cfg.arms.length * 0.16, cfg.arms.length * 0.55, cfg.arms.length * 0.1, bodyMat)
                : taper(cfg.arms.length * 0.18, cfg.arms.length * 0.1, cfg.arms.length, skinMat);
            if (cfg.arms.flipper) limb.position.y = -cfg.arms.length * 0.5;
            else limb.rotation.x = Math.PI;
            shoulder.add(limb);
            shoulder.rotation.set(cfg.arms.flipper ? 0 : 0.8, 0, side * 0.25);
            torso.add(shoulder);
            arms.push({ shoulder, side });
        }
    }

    // --- זנב ---
    let tail = null;
    if (cfg.tail) {
        const at = spine[0];
        tail = buildTail({ ...cfg.tail, radius: cfg.tail.radius ?? at.r * 0.5 }, skinMat);
        tail.root.position.set(0, at.y, at.z);
        tail.joints.forEach((j, i) => {
            j.rotation.x = i === 0 ? THREE.MathUtils.degToRad(cfg.tail.angle ?? 55) : (cfg.tail.curve ?? 0.1);
        });
        torso.add(tail.root);
    }

    root.userData.rig = {
        torso, body: body.userData.mesh, headPivot, legs, tail, arms,
        trunk: trunkJoints, baseY: torso.position.y,
    };
    return root;
}

/* ---------------------------------------------------------- דמות ייחוס אנושית */

export function buildHumanReference(heightM = 1.75) {
    const group = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
        color: 0x3ad6c0, transparent: true, opacity: 0.55,
        roughness: 0.4, emissive: 0x0d5e52, emissiveIntensity: 0.4,
    });
    const s = heightM / 1.75;
    const legs = ellipsoid(0.12 * s, 0.45 * s, 0.12 * s, m);
    legs.position.y = 0.45 * s;
    const body = ellipsoid(0.19 * s, 0.32 * s, 0.13 * s, m);
    body.position.y = 1.18 * s;
    const head = ball(0.12 * s, m);
    head.position.y = 1.62 * s;
    for (const side of [-1, 1]) {
        const arm = ellipsoid(0.055 * s, 0.28 * s, 0.055 * s, m);
        arm.position.set(side * 0.23 * s, 1.15 * s, 0);
        group.add(arm);
    }
    group.add(legs, body, head);
    group.userData.heightM = heightM;
    return group;
}

/* ------------------------------------------------------------ קטלוג החיות */

export const ANIMALS = [
    {
        id: 'elephant', name: 'פיל אפריקאי', emoji: '🐘', category: 'ספארי',
        heightM: 3.3, lengthM: 6.5, weightKg: 6000, speedKmh: 40,
        fact: 'הפיל האפריקאי הוא בעל החיים היבשתי הגדול בעולם. האוזניים שלו יכולות להגיע לרוחב 2 מטר.',
        build: () => buildCreature({
            color: 0x8d8b86, skinColor: 0x929089, flat: true,
            back: 3.05, bodyLength: 4.0, chestR: 1.05, waistR: 1.0, rumpR: 1.0,
            bodyWidth: 0.92, withersLift: 0.14,
            neck: { length: 0.45, angle: 10, r0: 0.82, r1: 0.62 },
            head: { size: 0.72, width: 0.85, height: 0.92, muzzle: 0.12, muzzleWidth: 0.75, eye: 0.06, align: 0.2, brow: false },
            ears: { shape: 'fan', size: 1.45 },
            tusks: true, trunk: 1.9,
            legs: { thickness: 0.3, hoof: true, hoofColor: 0x5f5952 },
            tail: { length: 1.15, radius: 0.075, segments: 5, angle: 18, tuft: 0x403a33 },
        }),
    },
    {
        id: 'giraffe', name: "ג'ירפה", emoji: '🦒', category: 'ספארי',
        heightM: 5.5, lengthM: 4.8, weightKg: 1200, speedKmh: 60,
        fact: "הצוואר של הג'ירפה מגיע ל-2.4 מטר, אבל יש בו בדיוק 7 חוליות - כמו אצל בני אדם.",
        build: () => buildCreature({
            color: 0xe8cf9a, skinColor: 0xe6cb95, pattern: 'giraffe', textureRepeat: 3,
            back: 3.15, bodyLength: 2.3, chestR: 0.6, waistR: 0.5, rumpR: 0.52,
            bodyWidth: 0.82, withersLift: 0.26, rumpLift: -0.12,
            neck: { length: 2.1, angle: 72, r0: 0.3, r1: 0.19 },
            head: { size: 0.3, width: 0.5, height: 0.55, muzzle: 0.8, muzzleWidth: 0.62, align: 0.6, eye: 0.14 },
            ears: { shape: 'pointy', size: 0.8 },
            horns: 'short', hornColor: 0x5a452c,
            legs: { thickness: 0.115, hoof: true },
            tail: { length: 0.95, radius: 0.05, segments: 5, angle: 22, tuft: 0x38301f },
        }),
    },
    {
        id: 'lion', name: 'אריה', emoji: '🦁', category: 'טורפים',
        heightM: 1.2, lengthM: 2.9, weightKg: 190, speedKmh: 80,
        fact: 'שאגת האריה נשמעת למרחק של עד 8 קילומטרים.',
        build: () => buildCreature({
            color: 0xcfa367, skinColor: 0xcfa367, mane: true, maneColor: 0x6d4a22,
            back: 1.08, bodyLength: 1.52, chestR: 0.3, waistR: 0.25, rumpR: 0.29,
            bodyWidth: 0.86, withersLift: 0.04,
            neck: { length: 0.3, angle: 20, r0: 0.24, r1: 0.2 },
            head: { size: 0.24, width: 0.72, height: 0.72, muzzle: 0.5, muzzleWidth: 0.78, eye: 0.11, eyeForward: 0.72 },
            ears: { shape: 'round', size: 0.4 },
            legs: { thickness: 0.075, digitigrade: true, backScale: 1.12 },
            tail: { length: 0.92, radius: 0.035, segments: 7, angle: 42, curve: 0.16, taper: 0.4, tuft: 0x4a3418 },
        }),
    },
    {
        id: 'tiger', name: 'טיגריס בנגלי', emoji: '🐅', category: 'טורפים',
        heightM: 1.05, lengthM: 3.3, weightKg: 230, speedKmh: 65,
        fact: 'לכל טיגריס דפוס פסים ייחודי - כמו טביעת אצבע. גם העור מתחת לפרווה מפוספס.',
        build: () => buildCreature({
            color: 0xe08a2b, skinColor: 0xdb8b33, pattern: 'tiger', textureRepeat: 3,
            back: 0.95, bodyLength: 1.6, chestR: 0.29, waistR: 0.25, rumpR: 0.28,
            bodyWidth: 0.88,
            neck: { length: 0.26, angle: 16, r0: 0.23, r1: 0.2 },
            head: { size: 0.23, width: 0.78, height: 0.72, muzzle: 0.45, muzzleWidth: 0.82, eye: 0.11, eyeForward: 0.72 },
            ears: { shape: 'round', size: 0.38 },
            legs: { thickness: 0.078, digitigrade: true, backScale: 1.1 },
            tail: { length: 1.0, radius: 0.045, segments: 7, angle: 48, curve: 0.14, taper: 0.35 },
        }),
    },
    {
        id: 'cheetah', name: 'ברדלס', emoji: '🐆', category: 'טורפים',
        heightM: 0.85, lengthM: 2.1, weightKg: 60, speedKmh: 110,
        fact: 'הברדלס הוא בעל החיים היבשתי המהיר בעולם - מ-0 ל-100 קמ"ש בשלוש שניות.',
        build: () => buildCreature({
            color: 0xd9a441, skinColor: 0xd9a441, pattern: 'leopard', textureRepeat: 3,
            back: 0.8, bodyLength: 1.15, chestR: 0.19, waistR: 0.14, rumpR: 0.185,
            bodyWidth: 0.8, bellySag: 0.03,
            neck: { length: 0.22, angle: 25, r0: 0.14, r1: 0.12 },
            head: { size: 0.15, width: 0.8, height: 0.78, muzzle: 0.4, muzzleWidth: 0.75, eye: 0.13, eyeForward: 0.7 },
            ears: { shape: 'round', size: 0.42 },
            legs: { thickness: 0.048, digitigrade: true },
            tail: { length: 0.78, radius: 0.03, segments: 7, angle: 55, curve: 0.2, taper: 0.3 },
        }),
    },
    {
        id: 'zebra', name: 'זברה', emoji: '🦓', category: 'ספארי',
        heightM: 1.4, lengthM: 2.7, weightKg: 350, speedKmh: 65,
        fact: 'הפסים של הזברה מבלבלים זבובים טורפים ומקשים עליהם לנחות עליה.',
        build: () => buildCreature({
            color: 0xf2ece0, skinColor: 0xeee7da, pattern: 'zebra', textureRepeat: 4,
            back: 1.32, bodyLength: 2.0, chestR: 0.36, waistR: 0.32, rumpR: 0.36,
            bodyWidth: 0.82, withersLift: 0.05,
            neck: { length: 0.68, angle: 52, r0: 0.23, r1: 0.17 },
            head: { size: 0.24, width: 0.46, height: 0.5, muzzle: 0.9, muzzleWidth: 0.6, align: 0.5 },
            ears: { shape: 'pointy', size: 0.6 },
            legs: { thickness: 0.07, hoof: true },
            tail: { length: 0.68, radius: 0.03, segments: 4, angle: 26, tuft: 0x1b1917 },
        }),
    },
    {
        id: 'horse', name: 'סוס', emoji: '🐎', category: 'משק',
        model: 'models/horse.glb',
        heightM: 1.65, lengthM: 2.9, weightKg: 500, speedKmh: 55,
        fact: 'סוסים ישנים בעמידה בזכות מנגנון נעילה בברכיים, אבל לשינה עמוקה הם נשכבים.',
        build: () => buildCreature({
            color: 0x6b432a, skinColor: 0x6b432a,
            back: 1.55, bodyLength: 1.78, chestR: 0.4, waistR: 0.36, rumpR: 0.41,
            bodyWidth: 0.82, withersLift: 0.07,
            neck: { length: 0.72, angle: 50, r0: 0.25, r1: 0.19 },
            head: { size: 0.26, width: 0.46, height: 0.52, muzzle: 0.95, muzzleWidth: 0.6, align: 0.5 },
            ears: { shape: 'pointy', size: 0.55 },
            legs: { thickness: 0.08, hoof: true },
            tail: { length: 0.9, radius: 0.06, segments: 5, angle: 22, taper: 0.5, tuft: 0x2a1c12 },
        }),
    },
    {
        id: 'cow', name: 'פרה', emoji: '🐄', category: 'משק',
        model: 'models/cow.glb',
        heightM: 1.5, lengthM: 2.5, weightKg: 720, speedKmh: 25,
        fact: 'פרה לועסת כ-40,000 לעיסות ביום ומייצרת עד 190 ליטר רוק.',
        build: () => buildCreature({
            color: 0xf6f2ec, skinColor: 0xf2ede4, pattern: 'cow', textureRepeat: 3,
            back: 1.4, bodyLength: 1.65, chestR: 0.46, waistR: 0.45, rumpR: 0.47,
            bodyWidth: 0.92, withersLift: 0.06, bellySag: 0.06, rumpLift: 0.03,
            neck: { length: 0.3, angle: 22, r0: 0.32, r1: 0.26 },
            head: { size: 0.26, width: 0.56, height: 0.56, muzzle: 0.65, muzzleWidth: 0.82, align: 0.4 },
            ears: { shape: 'pointy', size: 0.6 },
            horns: 'curved', hornColor: 0x2f2a24,
            legs: { thickness: 0.085, hoof: true },
            tail: { length: 0.9, radius: 0.035, segments: 5, angle: 14, taper: 0.6, tuft: 0x3a342d },
        }),
    },
    {
        id: 'bear', name: 'דוב גריזלי', emoji: '🐻', category: 'יער',
        heightM: 1.35, lengthM: 2.2, weightKg: 400, speedKmh: 55,
        fact: 'גריזלי בעמידה על הרגליים האחוריות מגיע ל-2.7 מטר - גבוה מכל שחקן NBA.',
        build: () => buildCreature({
            color: 0x6a4a2f, skinColor: 0x684829, flat: true,
            back: 1.12, bodyLength: 1.5, chestR: 0.42, waistR: 0.38, rumpR: 0.4,
            bodyWidth: 1.0, withersLift: 0.16,
            neck: { length: 0.18, angle: 14, r0: 0.34, r1: 0.29 },
            head: { size: 0.28, width: 0.68, height: 0.64, muzzle: 0.55, muzzleWidth: 0.62, eye: 0.09, eyeForward: 0.68 },
            ears: { shape: 'round', size: 0.4 },
            legs: { thickness: 0.14 },
            tail: { length: 0.14, radius: 0.06, segments: 2, angle: 35 },
        }),
    },
    {
        id: 'wolf', name: 'זאב', emoji: '🐺', category: 'יער',
        model: 'models/wolf.glb',
        heightM: 0.85, lengthM: 1.9, weightKg: 45, speedKmh: 60,
        fact: 'להקת זאבים יכולה לעבור 80 קילומטר ביממה אחת במרדף אחרי טרף.',
        build: () => buildCreature({
            color: 0x81807b, skinColor: 0x7c7b76, flat: true,
            back: 0.78, bodyLength: 0.98, chestR: 0.185, waistR: 0.155, rumpR: 0.175,
            bodyWidth: 0.82,
            neck: { length: 0.2, angle: 22, r0: 0.155, r1: 0.13 },
            head: { size: 0.16, width: 0.6, height: 0.62, muzzle: 0.85, muzzleWidth: 0.55, eye: 0.12, eyeForward: 0.68 },
            ears: { shape: 'pointy', size: 0.62 },
            legs: { thickness: 0.045, digitigrade: true },
            tail: { length: 0.45, radius: 0.06, segments: 5, angle: 58, curve: 0.12, taper: 0.35 },
        }),
    },
    {
        id: 'dog', name: 'האסקי סיבירי', emoji: '🐕', category: 'בית',
        model: 'models/husky.glb',
        heightM: 0.6, lengthM: 1.0, weightKg: 25, speedKmh: 45,
        fact: 'חוש הריח של כלב רגיש פי 10,000 עד 100,000 משל בן אדם.',
        build: () => buildCreature({
            color: 0x5a4127, skinColor: 0x3f2d18,
            back: 0.6, bodyLength: 0.64, chestR: 0.145, waistR: 0.115, rumpR: 0.13,
            bodyWidth: 0.82, withersLift: 0.04, rumpLift: -0.05,
            neck: { length: 0.16, angle: 32, r0: 0.115, r1: 0.1 },
            head: { size: 0.12, width: 0.62, height: 0.62, muzzle: 0.85, muzzleWidth: 0.52, eye: 0.13, eyeForward: 0.68 },
            ears: { shape: 'pointy', size: 0.8 },
            legs: { thickness: 0.032, digitigrade: true },
            tail: { length: 0.38, radius: 0.04, segments: 5, angle: 78, curve: 0.18, taper: 0.4 },
        }),
    },
    {
        id: 'cat', name: 'חתול', emoji: '🐈', category: 'בית',
        model: 'models/cat.glb',
        heightM: 0.3, lengthM: 0.75, weightKg: 4.5, speedKmh: 48,
        fact: 'חתול יכול לקפוץ לגובה פי שישה מאורך גופו.',
        build: () => buildCreature({
            color: 0x8a8681, skinColor: 0x8a8681, pattern: 'tiger', textureRepeat: 3,
            back: 0.27, bodyLength: 0.33, chestR: 0.062, waistR: 0.052, rumpR: 0.062,
            bodyWidth: 0.8,
            neck: { length: 0.05, angle: 24, r0: 0.05, r1: 0.045 },
            head: { size: 0.055, width: 0.88, height: 0.82, muzzle: 0.3, muzzleWidth: 0.85, eye: 0.17, eyeForward: 0.74 },
            ears: { shape: 'pointy', size: 0.85 },
            legs: { thickness: 0.016, digitigrade: true },
            tail: { length: 0.3, radius: 0.017, segments: 7, angle: 45, curve: 0.22, taper: 0.25 },
        }),
    },
    {
        id: 'rhino', name: 'קרנף לבן', emoji: '🦏', category: 'ספארי',
        heightM: 1.8, lengthM: 4.0, weightKg: 2300, speedKmh: 50,
        fact: 'הקרן של הקרנף עשויה קרטין - אותו חומר שממנו עשויות הציפורניים שלנו.',
        build: () => buildCreature({
            color: 0x9a9791, skinColor: 0x969390, flat: true,
            back: 1.62, bodyLength: 2.4, chestR: 0.62, waistR: 0.58, rumpR: 0.6,
            bodyWidth: 0.95, withersLift: 0.1, bellySag: 0.04,
            neck: { length: 0.22, angle: 8, r0: 0.48, r1: 0.4 },
            head: { size: 0.42, width: 0.52, height: 0.48, muzzle: 0.65, muzzleWidth: 0.78, align: 0.3, eye: 0.07 },
            ears: { shape: 'pointy', size: 0.42 },
            nasalHorn: 0.9,
            legs: { thickness: 0.2, hoof: true, hoofColor: 0x635e57 },
            tail: { length: 0.62, radius: 0.045, segments: 4, angle: 22, tuft: 0x494540 },
        }),
    },
    {
        id: 'deer', name: 'אייל אדום', emoji: '🦌', category: 'יער',
        model: 'models/stag.glb',
        heightM: 1.9, lengthM: 2.1, weightKg: 200, speedKmh: 70,
        fact: 'האיילים משילים את הקרניים כל שנה ומגדלים חדשות וגדולות יותר.',
        build: () => buildCreature({
            color: 0x96683c, skinColor: 0x8d6137,
            back: 1.2, bodyLength: 1.2, chestR: 0.26, waistR: 0.22, rumpR: 0.25,
            bodyWidth: 0.8, withersLift: 0.04,
            neck: { length: 0.45, angle: 58, r0: 0.15, r1: 0.115 },
            head: { size: 0.18, width: 0.48, height: 0.5, muzzle: 0.7, muzzleWidth: 0.58, align: 0.55 },
            ears: { shape: 'pointy', size: 0.85 },
            horns: 'antlers', hornColor: 0x6b5533,
            legs: { thickness: 0.042, hoof: true },
            tail: { length: 0.18, radius: 0.035, segments: 2, angle: 20 },
        }),
    },
    {
        id: 'penguin', name: 'פינגווין קיסר', emoji: '🐧', category: 'קוטב',
        heightM: 1.15, lengthM: 0.5, weightKg: 35, speedKmh: 9, upright: true,
        fact: 'פינגווין קיסר צולל לעומק 500 מטר ונשאר מתחת למים עד 20 דקות.',
        build: () => buildCreature({
            color: 0x25292e, skinColor: 0x25292e,
            back: 0.95, bodyLength: 0.66, chestR: 0.17, waistR: 0.16, rumpR: 0.13,
            bodyWidth: 0.95, tilt: 84, hipY: 0.2,
            neck: { length: 0.1, angle: 12, r0: 0.12, r1: 0.1 },
            head: { size: 0.1, width: 0.82, height: 0.88, muzzle: 0, eye: 0.15, align: 0.9, brow: false, cheeks: false },
            ears: { shape: 'none' },
            beak: 0.12, beakColor: 0xdd9a3c,
            bellyPatch: 0xf1ece0,
            arms: { length: 0.4, flipper: true },
            legPairs: 1,
            legs: { thickness: 0.035, hoof: false },
        }),
    },
    {
        id: 'kangaroo', name: 'קנגורו אדום', emoji: '🦘', category: 'ספארי',
        heightM: 1.8, lengthM: 1.6, weightKg: 85, speedKmh: 70, upright: true,
        fact: 'קנגורו אדום קופץ 9 מטר בקפיצה אחת ומגיע לגובה 3 מטר.',
        build: () => buildCreature({
            color: 0xa9663d, skinColor: 0xa9663d,
            back: 1.45, bodyLength: 0.95, chestR: 0.25, waistR: 0.23, rumpR: 0.3,
            bodyWidth: 0.85, tilt: 48, hipY: 0.72,
            neck: { length: 0.2, angle: 32, r0: 0.16, r1: 0.13 },
            head: { size: 0.16, width: 0.58, height: 0.6, muzzle: 0.75, muzzleWidth: 0.55, align: 0.5 },
            ears: { shape: 'tall', size: 0.8 },
            arms: { length: 0.4 },
            legPairs: 1,
            legs: { thickness: 0.075, digitigrade: true },
            tail: { length: 1.1, radius: 0.15, segments: 6, angle: 72, curve: 0.06, taper: 0.7 },
        }),
    },
    {
        id: 'trex', name: 'טי-רקס', emoji: '🦖', category: 'דינוזאורים',
        heightM: 4.0, lengthM: 12.0, weightKg: 8000, speedKmh: 27,
        fact: 'נשיכת הטי-רקס הפעילה כוח של 5.8 טון - החזקה ביותר של חיה יבשתית אי פעם.',
        build: () => buildCreature({
            color: 0x5c6b4a, skinColor: 0x596848, flat: true,
            back: 2.9, bodyLength: 3.3, chestR: 0.78, waistR: 0.7, rumpR: 0.88,
            bodyWidth: 0.82, withersLift: 0.05,
            neck: { length: 1.0, angle: 42, r0: 0.44, r1: 0.32 },
            head: { size: 0.62, width: 0.5, height: 0.6, muzzle: 0.35, muzzleWidth: 0.85, align: 0.55, eye: 0.09 },
            ears: { shape: 'none' },
            jaws: true,
            arms: { length: 0.6 },
            legPairs: 1,
            legs: { thickness: 0.26, digitigrade: true },
            tail: { length: 4.4, radius: 0.55, segments: 8, angle: 88, curve: 0.015, taper: 0.88 },
        }),
    },
    {
        id: 'fox', name: 'שועל אדום', emoji: '🦊', category: 'יער',
        heightM: 0.4, lengthM: 1.1, weightKg: 7, speedKmh: 50,
        model: 'models/fox.glb', clips: { idle: 'Survey', walk: 'Walk' },
        fact: 'שועל שומע מכרסם שזז מתחת לשלג ממרחק שני מטרים, וקופץ עליו בצלילה מדויקת.',
        build: () => buildCreature({
            color: 0xc45a20, skinColor: 0xc45a20,
            back: 0.36, bodyLength: 0.52, chestR: 0.1, waistR: 0.085, rumpR: 0.095,
            bodyWidth: 0.8,
            neck: { length: 0.1, angle: 24, r0: 0.085, r1: 0.075 },
            head: { size: 0.1, width: 0.6, height: 0.6, muzzle: 0.9, muzzleWidth: 0.5, eye: 0.13, eyeForward: 0.7 },
            ears: { shape: 'pointy', size: 0.8 },
            legs: { thickness: 0.026, digitigrade: true },
            tail: { length: 0.38, radius: 0.06, segments: 5, angle: 50, taper: 0.3 },
        }),
    },
    {
        id: 'alpaca', name: 'אלפקה', emoji: '🦙', category: 'משק',
        heightM: 1.5, lengthM: 1.4, weightKg: 70, speedKmh: 55,
        model: 'models/alpaca.glb',
        fact: 'אלפקה יורקת כשהיא כועסת - בעיקר על אלפקות אחרות שמנסות לגנוב לה אוכל.',
        build: () => buildCreature({
            color: 0xd9c4a3, skinColor: 0xd9c4a3,
            back: 1.0, bodyLength: 0.85, chestR: 0.26, waistR: 0.24, rumpR: 0.25,
            bodyWidth: 0.85,
            neck: { length: 0.55, angle: 78, r0: 0.14, r1: 0.11 },
            head: { size: 0.15, width: 0.55, height: 0.6, muzzle: 0.6, muzzleWidth: 0.6, align: 0.6 },
            ears: { shape: 'tall', size: 0.5 },
            legs: { thickness: 0.05, hoof: true },
            tail: { length: 0.15, radius: 0.04, segments: 2, angle: 30 },
        }),
    },
    {
        id: 'pig', name: 'חזיר', emoji: '🐖', category: 'משק',
        heightM: 0.9, lengthM: 1.6, weightKg: 250, speedKmh: 17,
        model: 'models/pig.glb',
        fact: 'לחזירים אין בלוטות זיעה - הם מתגלגלים בבוץ כדי להתקרר ולהגן על העור מהשמש.',
        build: () => buildCreature({
            color: 0xe0a3a0, skinColor: 0xe0a3a0,
            back: 0.72, bodyLength: 1.0, chestR: 0.26, waistR: 0.26, rumpR: 0.27,
            bodyWidth: 0.95, bellySag: 0.04,
            neck: { length: 0.1, angle: 8, r0: 0.22, r1: 0.2 },
            head: { size: 0.2, width: 0.6, height: 0.55, muzzle: 0.75, muzzleWidth: 0.75 },
            ears: { shape: 'pointy', size: 0.6 },
            legs: { thickness: 0.05, hoof: true },
            tail: { length: 0.2, radius: 0.02, segments: 4, angle: 70, curve: 0.5 },
        }),
    },
    {
        id: 'sheep', name: 'כבשה', emoji: '🐑', category: 'משק',
        heightM: 1.0, lengthM: 1.3, weightKg: 80, speedKmh: 40,
        model: 'models/sheep.glb',
        fact: 'כבשה מזהה ומזכרת פרצופים של עד 50 כבשים אחרות במשך שנתיים.',
        build: () => buildCreature({
            color: 0xeee8dc, skinColor: 0xd8cfc0,
            back: 0.75, bodyLength: 0.8, chestR: 0.24, waistR: 0.23, rumpR: 0.24,
            bodyWidth: 0.95,
            neck: { length: 0.15, angle: 35, r0: 0.15, r1: 0.12 },
            head: { size: 0.14, width: 0.55, height: 0.6, muzzle: 0.6, muzzleWidth: 0.6 },
            ears: { shape: 'pointy', size: 0.6 },
            legs: { thickness: 0.035, hoof: true },
            tail: { length: 0.14, radius: 0.04, segments: 2, angle: 25 },
        }),
    },
    {
        id: 'goat', name: 'עז', emoji: '🐐', category: 'משק',
        heightM: 0.9, lengthM: 1.2, weightKg: 60, speedKmh: 25,
        model: 'models/goat.glb',
        fact: 'לעזים אישונים מלבניים, שנותנים להן שדה ראייה של כמעט 320 מעלות.',
        build: () => buildCreature({
            color: 0xb9a992, skinColor: 0xb9a992,
            back: 0.7, bodyLength: 0.72, chestR: 0.19, waistR: 0.18, rumpR: 0.19,
            bodyWidth: 0.85,
            neck: { length: 0.18, angle: 40, r0: 0.13, r1: 0.11 },
            head: { size: 0.13, width: 0.5, height: 0.55, muzzle: 0.7, muzzleWidth: 0.55 },
            ears: { shape: 'pointy', size: 0.7 },
            horns: 'curved', hornColor: 0x4a4238,
            legs: { thickness: 0.032, hoof: true },
            tail: { length: 0.12, radius: 0.03, segments: 2, angle: 100 },
        }),
    },
    {
        id: 'donkey', name: 'חמור', emoji: '🫏', category: 'משק',
        heightM: 1.3, lengthM: 1.9, weightKg: 200, speedKmh: 40,
        model: 'models/donkey.glb',
        fact: 'חמור זוכר מקומות וחברים לעדר גם אחרי 25 שנה.',
        build: () => buildCreature({
            color: 0x8d8579, skinColor: 0x8d8579,
            back: 1.2, bodyLength: 1.3, chestR: 0.3, waistR: 0.28, rumpR: 0.3,
            bodyWidth: 0.82,
            neck: { length: 0.5, angle: 55, r0: 0.19, r1: 0.15 },
            head: { size: 0.2, width: 0.46, height: 0.52, muzzle: 0.9, muzzleWidth: 0.6, align: 0.5 },
            ears: { shape: 'tall', size: 0.85 },
            legs: { thickness: 0.055, hoof: true },
            tail: { length: 0.6, radius: 0.035, segments: 4, angle: 20, tuft: 0x33302a },
        }),
    },
    {
        id: 'chicken', name: 'תרנגולת', emoji: '🐓', category: 'משק',
        heightM: 0.45, lengthM: 0.45, weightKg: 2.5, speedKmh: 14, upright: true,
        model: 'models/chicken.glb', clips: { idle: 'idle', walk: 'walk' },
        fact: 'תרנגולת מטילה כ-300 ביצים בשנה, ומזהה יותר מ-100 פרצופים של בני אדם ותרנגולות.',
        build: () => buildCreature({
            color: 0xf0ece4, skinColor: 0xf0ece4,
            back: 0.33, bodyLength: 0.26, chestR: 0.09, waistR: 0.085, rumpR: 0.08,
            bodyWidth: 0.9, tilt: 55, hipY: 0.14,
            neck: { length: 0.08, angle: 45, r0: 0.05, r1: 0.04 },
            head: { size: 0.05, width: 0.8, height: 0.85, muzzle: 0, eye: 0.16, align: 0.8, brow: false, cheeks: false },
            ears: { shape: 'none' },
            beak: 0.05, beakColor: 0xe0a02c,
            legPairs: 1,
            legs: { thickness: 0.015 },
            tail: { length: 0.14, radius: 0.05, segments: 3, angle: 120, taper: 0.7 },
        }),
    },
];

export function getAnimal(id) {
    return ANIMALS.find((a) => a.id === id) || ANIMALS[0];
}

/**
 * בונה חיה ומנרמל אותה לגובה ולאורך האמיתיים שלה במטרים,
 * כך שהמודל תמיד יוצא בקנה מידה נכון ביחס לעולם.
 */
export function createAnimal(spec) {
    const group = spec.build();
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(size);
    if (size.y > 0.001) {
        const scale = spec.heightM / size.y;
        group.scale.setScalar(scale);
        // התאמת אורך (חוטם עד קצה הזנב) למידה האמיתית,
        // מוגבלת ל-30% כדי שהחיה לא תימתח ותיראה מעוותת
        if (spec.lengthM && !spec.upright && size.z > 0.001) {
            const wanted = spec.lengthM / (size.z * scale);
            group.scale.z = scale * THREE.MathUtils.clamp(wanted, 0.75, 1.3);
        }
    }
    // הצמדה לרצפה: הנקודה הנמוכה במודל = y 0
    const after = new THREE.Box3().setFromObject(group);
    group.position.y -= after.min.y;

    const wrapper = new THREE.Group();
    wrapper.add(group);
    wrapper.userData.rig = group.userData.rig;
    wrapper.userData.spec = spec;
    wrapper.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return wrapper;
}

/* ------------------------------------------------------------------ אנימציה */

const LEG_PHASE = { frontL: 0, frontR: Math.PI, backL: Math.PI, backR: 0 };

export function animateAnimal(animal, t, mode) {
    const rig = animal.userData.rig;
    if (!rig) return;
    const walking = mode === 'walk';
    const phase = t * (walking ? 3.2 : 1);

    // נשימה - רק הגוף מתנפח, הרגליים לא נמתחות
    const breathe = 1 + Math.sin(t * 1.3) * 0.015;
    if (rig.body) rig.body.scale.set(breathe, breathe, 1);

    rig.legs.forEach((leg) => {
        const offset = LEG_PHASE[leg.id] ?? 0;
        if (walking) {
            const swing = Math.sin(phase + offset);
            leg.hip.rotation.x = swing * 0.42;
            leg.knee.rotation.x = leg.knee.userData.rest ?? (leg.knee.userData.rest = leg.knee.rotation.x);
            leg.knee.rotation.x += Math.max(0, -Math.sin(phase + offset + 0.7)) * 0.7 * (leg.front ? -1 : 1);
            leg.ankle.rotation.x = (leg.ankle.userData.rest ?? (leg.ankle.userData.rest = leg.ankle.rotation.x))
                + Math.sin(phase + offset + 1.4) * 0.2;
        } else {
            leg.hip.rotation.x = Math.sin(t * 0.7 + offset) * 0.012;
        }
    });

    if (walking) {
        rig.torso.position.y = Math.sin(phase * 2) * 0.012 * (animal.userData.spec?.heightM || 1);
        rig.torso.rotation.z = Math.sin(phase) * 0.018;
    } else {
        rig.torso.position.y = 0;
        rig.torso.rotation.z = 0;
    }

    // ראש: הבטה איטית לצדדים ונדנוד עדין
    rig.headPivot.rotation.y = Math.sin(t * 0.35) * 0.3;
    rig.headPivot.rotation.z = Math.sin(t * 0.5) * 0.05;
    const headRest = rig.headPivot.userData.rest
        ?? (rig.headPivot.userData.rest = rig.headPivot.rotation.x);
    rig.headPivot.rotation.x = headRest + Math.sin(t * 0.9) * 0.05 + (walking ? Math.sin(phase * 2) * 0.03 : 0);

    if (rig.tail) {
        rig.tail.joints.forEach((j, i) => {
            j.rotation.y = Math.sin(t * 2 - i * 0.5) * (0.06 + i * 0.02);
            if (i > 0) j.rotation.x = (j.userData.rest ?? (j.userData.rest = j.rotation.x))
                + Math.sin(t * 1.6 - i * 0.4) * 0.04;
        });
    }

    if (rig.arms) {
        rig.arms.forEach(({ shoulder, side }) => {
            const rest = shoulder.userData.rest ?? (shoulder.userData.rest = shoulder.rotation.x);
            shoulder.rotation.x = rest + (walking
                ? Math.sin(phase + (side > 0 ? Math.PI : 0)) * 0.3
                : Math.sin(t * 1.2) * 0.07);
        });
    }

    if (rig.trunk) {
        rig.trunk.forEach((j, i) => {
            j.rotation.x = (i === 0 ? 0.45 : 0.16) + Math.sin(t * 1.1 - i * 0.35) * 0.1;
            j.rotation.z = Math.sin(t * 0.8 - i * 0.3) * 0.07;
        });
    }
}
