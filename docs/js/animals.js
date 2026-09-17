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

/* ------------------------------------------------------------ עזרי גיאומטריה */

function mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: opts.roughness ?? 0.85,
        metalness: opts.metalness ?? 0.02,
        map: opts.map || null,
        flatShading: opts.flat || false,
    });
}

function capsule(radius, length, material) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(length, 0.001), 6, 14), material);
    m.castShadow = true;
    return m;
}

function ball(radius, material) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material);
    m.castShadow = true;
    return m;
}

function box(w, h, d, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = true;
    return m;
}

function cone(radius, height, material) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 14), material);
    m.castShadow = true;
    return m;
}

const EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x10100e, roughness: 0.25 });

function addEyes(head, spread, forward, up, radius) {
    for (const side of [-1, 1]) {
        const eye = ball(radius, EYE_MAT);
        eye.castShadow = false;
        eye.position.set(side * spread, up, forward);
        head.add(eye);
    }
}

/* ------------------------------------------------------- בניית רגל דו-מפרקית */

function buildLeg(cfg, material) {
    // הירך היא נקודת הסיבוב; הברך מאפשרת הליכה אמינה יותר
    const hip = new THREE.Group();
    const upperLen = cfg.legLength * 0.52;
    const lowerLen = cfg.legLength * 0.48;

    const upper = capsule(cfg.legRadius, upperLen - cfg.legRadius * 2, material);
    upper.position.y = -upperLen / 2;
    hip.add(upper);

    const knee = new THREE.Group();
    knee.position.y = -upperLen;
    hip.add(knee);

    const lower = capsule(cfg.legRadius * 0.78, lowerLen - cfg.legRadius * 1.6, material);
    lower.position.y = -lowerLen / 2;
    knee.add(lower);

    if (cfg.hoof) {
        const hoof = new THREE.Mesh(
            new THREE.CylinderGeometry(cfg.legRadius * 0.95, cfg.legRadius * 1.05, cfg.legRadius * 0.9, 12),
            mat(cfg.hoofColor || 0x2e2a26)
        );
        hoof.position.y = -lowerLen + cfg.legRadius * 0.45;
        hoof.castShadow = true;
        knee.add(hoof);
    } else {
        const paw = ball(cfg.legRadius * 1.15, material);
        paw.scale.set(1, 0.7, 1.35);
        paw.position.set(0, -lowerLen + cfg.legRadius * 0.6, cfg.legRadius * 0.4);
        knee.add(paw);
    }

    return { hip, knee };
}

/* ---------------------------------------------------------- בניית זנב מפרקי */

function buildTail(segments, length, radius, material, taper = 0.6) {
    const root = new THREE.Group();
    const joints = [];
    let parent = root;
    const segLen = length / segments;
    for (let i = 0; i < segments; i++) {
        const joint = new THREE.Group();
        joint.position.y = i === 0 ? 0 : -segLen;
        parent.add(joint);
        const r = radius * Math.pow(taper, i / segments);
        const seg = capsule(r, segLen * 0.7, material);
        seg.position.y = -segLen / 2;
        joint.add(seg);
        joints.push(joint);
        parent = joint;
    }
    return { root, joints };
}

/* ------------------------------------------------------------- ארבע-רגליים */

function buildQuadruped(cfg) {
    const group = new THREE.Group();
    const bodyMat = mat(cfg.color, { map: cfg.pattern ? pattern(cfg.pattern) : null, flat: cfg.flat });
    const skinMat = mat(cfg.skinColor || cfg.color, { flat: cfg.flat });

    const bodyY = cfg.legLength + cfg.bodyDepth / 2;

    // גו
    const torsoPivot = new THREE.Group();
    torsoPivot.position.y = bodyY;
    group.add(torsoPivot);

    const torso = capsule(cfg.bodyDepth / 2, cfg.bodyLength - cfg.bodyDepth, bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(cfg.bodyWidth / cfg.bodyDepth, 1, 1);
    torsoPivot.add(torso);

    if (cfg.hump) {
        const hump = ball(cfg.bodyDepth * 0.42, bodyMat);
        hump.scale.set(0.9, 0.7, 1.2);
        hump.position.set(0, cfg.bodyDepth * 0.35, cfg.bodyLength * 0.2);
        torsoPivot.add(hump);
    }

    // צוואר
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, cfg.bodyDepth * 0.22, cfg.bodyLength * 0.42);
    torsoPivot.add(neckPivot);

    const neck = capsule(cfg.neckRadius, cfg.neckLength, skinMat.clone());
    if (cfg.pattern && cfg.patternNeck !== false) neck.material.map = pattern(cfg.pattern);
    neck.position.y = cfg.neckLength / 2;
    neck.rotation.x = -(cfg.neckTilt ?? 0.35);
    neck.position.z = Math.sin(cfg.neckTilt ?? 0.35) * cfg.neckLength * 0.5;
    neckPivot.add(neck);

    // ראש
    const headPivot = new THREE.Group();
    headPivot.position.set(
        0,
        Math.cos(cfg.neckTilt ?? 0.35) * cfg.neckLength,
        Math.sin(cfg.neckTilt ?? 0.35) * cfg.neckLength
    );
    neckPivot.add(headPivot);

    const head = new THREE.Group();
    headPivot.add(head);

    const skull = ball(cfg.headSize, skinMat);
    skull.scale.set(0.85, 0.9, 1.15);
    head.add(skull);

    const snout = capsule(cfg.headSize * (cfg.snoutRadius ?? 0.55), cfg.headSize * (cfg.snoutLength ?? 0.9), skinMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -cfg.headSize * 0.18, cfg.headSize * (0.75 + (cfg.snoutLength ?? 0.9) * 0.4));
    head.add(snout);

    addEyes(head, cfg.headSize * 0.52, cfg.headSize * 0.62, cfg.headSize * 0.35, cfg.headSize * 0.13);

    // אוזניים
    const earSize = cfg.headSize * (cfg.earSize ?? 0.4);
    for (const side of [-1, 1]) {
        let ear;
        if (cfg.earShape === 'round') {
            ear = ball(earSize, skinMat);
            ear.scale.set(1, 1, 0.35);
        } else if (cfg.earShape === 'fan') {
            // אוזני פיל: מניפות מעוגלות ושטוחות שנתלות מצדי הראש
            ear = ball(earSize, skinMat);
            ear.scale.set(0.95, 1.25, 0.12);
            ear.rotation.set(0.15, side * 0.85, side * 0.12);
        } else {
            ear = cone(earSize * 0.62, earSize * 1.8, skinMat);
            ear.rotation.z = side * 0.3;
        }
        // אוזני פיל נתלות מצדי הראש ולאחור; שאר האוזניים יושבות על קודקוד הראש
        ear.position.set(
            side * cfg.headSize * (cfg.earShape === 'fan' ? 0.8 : 0.6),
            cfg.headSize * (cfg.earShape === 'fan' ? -0.45 : 0.75),
            cfg.headSize * (cfg.earShape === 'fan' ? -0.75 : -0.1)
        );
        head.add(ear);
    }

    // קרניים
    if (cfg.horns) {
        for (const side of [-1, 1]) {
            const horn = cone(cfg.headSize * 0.16, cfg.headSize * (cfg.horns === 'long' ? 1.6 : 0.7), mat(0x2e2a24));
            horn.position.set(side * cfg.headSize * 0.42, cfg.headSize * 0.95, -cfg.headSize * 0.05);
            horn.rotation.z = side * (cfg.horns === 'long' ? -0.9 : -0.45);
            head.add(horn);
        }
    }

    // חדק (פיל)
    if (cfg.trunk) {
        const trunk = buildTail(6, cfg.trunk, cfg.headSize * 0.32, skinMat, 0.35);
        trunk.root.position.set(0, -cfg.headSize * 0.35, cfg.headSize * 1.0);
        head.add(trunk.root);
        trunk.joints.forEach((j, i) => { j.rotation.x = i === 0 ? 0.25 : 0.18; });
        group.userData.trunk = trunk.joints;

        for (const side of [-1, 1]) {
            const tusk = capsule(cfg.headSize * 0.09, cfg.headSize * 1.1, mat(0xf2ead5));
            tusk.position.set(side * cfg.headSize * 0.38, -cfg.headSize * 0.5, cfg.headSize * 0.85);
            tusk.rotation.set(0.9, 0, side * 0.12);
            head.add(tusk);
        }
    }

    // רעמה (אריה)
    if (cfg.mane) {
        const maneMat = mat(cfg.maneColor || 0x6b4423, { map: pattern('fur', '#7a5228', '#3a2411'), flat: true });
        const mane = new THREE.Mesh(new THREE.SphereGeometry(cfg.headSize * 1.55, 16, 12), maneMat);
        mane.scale.set(1, 1, 0.8);
        mane.position.z = -cfg.headSize * 0.25;
        mane.castShadow = true;
        head.add(mane);
    }

    // קרן (קרנף)
    if (cfg.nasalHorn) {
        const h1 = cone(cfg.headSize * 0.22, cfg.nasalHorn, mat(0x8d8477));
        h1.position.set(0, cfg.headSize * 0.3, cfg.headSize * 1.5);
        h1.rotation.x = -0.25;
        head.add(h1);
        const h2 = cone(cfg.headSize * 0.15, cfg.nasalHorn * 0.45, mat(0x8d8477));
        h2.position.set(0, cfg.headSize * 0.4, cfg.headSize * 0.95);
        head.add(h2);
    }

    // רגליים
    const legs = [];
    const xOff = cfg.bodyWidth * 0.36;
    const zFront = cfg.bodyLength * 0.33;
    const zBack = -cfg.bodyLength * 0.33;
    for (const [x, z, id] of [[-xOff, zFront, 'fl'], [xOff, zFront, 'fr'], [-xOff, zBack, 'bl'], [xOff, zBack, 'br']]) {
        const leg = buildLeg(cfg, skinMat);
        leg.hip.position.set(x, -cfg.bodyDepth * 0.25, z);
        leg.id = id;
        torsoPivot.add(leg.hip);
        legs.push(leg);
    }

    // זנב
    let tail = null;
    if (cfg.tailLength > 0) {
        tail = buildTail(cfg.tailSegments || 4, cfg.tailLength, cfg.tailRadius || cfg.legRadius * 0.45, skinMat);
        tail.root.position.set(0, cfg.bodyDepth * 0.2, -cfg.bodyLength * 0.46);
        // מפרק ראשון קובע את זווית היציאה לאחור, השאר מוסיפים עקומה עדינה
        tail.joints.forEach((j, i) => { j.rotation.x = i === 0 ? (cfg.tailAngle ?? 0.7) : 0.12; });
        torsoPivot.add(tail.root);
        if (cfg.tailTuft) {
            const tuft = ball(cfg.tailRadius * 2.4, mat(cfg.tailTuft));
            tuft.position.y = -cfg.tailLength / (cfg.tailSegments || 4);
            tail.joints[tail.joints.length - 1].add(tuft);
        }
    }

    group.userData.rig = { torsoPivot, neckPivot, headPivot, legs, tail, type: 'quadruped' };
    return group;
}

/* ----------------------------------------------------------------- דו-רגליים */

function buildBiped(cfg) {
    const group = new THREE.Group();
    const bodyMat = mat(cfg.color, { map: cfg.pattern ? pattern(cfg.pattern) : null, flat: cfg.flat });
    const skinMat = mat(cfg.skinColor || cfg.color, { flat: cfg.flat });

    const hipY = cfg.legLength;
    const torsoPivot = new THREE.Group();
    torsoPivot.position.y = hipY;
    group.add(torsoPivot);

    const torso = capsule(cfg.bodyDepth / 2, cfg.bodyLength - cfg.bodyDepth, bodyMat);
    if (cfg.horizontal) {
        torso.rotation.x = Math.PI / 2;
    }
    torso.scale.set(cfg.bodyWidth / cfg.bodyDepth, 1, 1);
    torsoPivot.add(torso);

    if (cfg.belly) {
        const belly = ball(cfg.bodyDepth * 0.5, mat(cfg.belly));
        belly.scale.set(0.85, cfg.horizontal ? 0.8 : 1.15, 0.7);
        belly.position.set(0, cfg.horizontal ? -cfg.bodyDepth * 0.25 : -cfg.bodyLength * 0.05, cfg.bodyDepth * 0.28);
        torsoPivot.add(belly);
    }

    const neckPivot = new THREE.Group();
    neckPivot.position.set(
        0,
        cfg.horizontal ? cfg.bodyDepth * 0.2 : cfg.bodyLength * 0.45,
        cfg.horizontal ? cfg.bodyLength * 0.42 : cfg.bodyDepth * 0.1
    );
    torsoPivot.add(neckPivot);

    const neck = capsule(cfg.neckRadius, cfg.neckLength, skinMat);
    neck.position.y = cfg.neckLength / 2;
    neck.position.z = cfg.horizontal ? cfg.neckLength * 0.35 : 0;
    neck.rotation.x = cfg.horizontal ? -0.7 : 0;
    neckPivot.add(neck);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, cfg.neckLength * (cfg.horizontal ? 0.75 : 1), cfg.horizontal ? cfg.neckLength * 0.7 : 0);
    neckPivot.add(headPivot);

    const head = new THREE.Group();
    headPivot.add(head);
    const skull = ball(cfg.headSize, skinMat);
    skull.scale.set(0.85, 0.95, 1.2);
    head.add(skull);

    if (cfg.beak) {
        const beak = cone(cfg.headSize * 0.3, cfg.beak, mat(cfg.beakColor || 0xe0913a));
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -cfg.headSize * 0.1, cfg.headSize + cfg.beak * 0.4);
        head.add(beak);
    }
    if (cfg.jaw) {
        const jaw = box(cfg.headSize * 1.1, cfg.headSize * 0.75, cfg.headSize * 2.4, skinMat);
        jaw.position.set(0, -cfg.headSize * 0.15, cfg.headSize * 1.25);
        head.add(jaw);
        const teethMat = mat(0xf3ece0);
        for (let i = 0; i < 5; i++) {
            for (const side of [-1, 1]) {
                const tooth = cone(cfg.headSize * 0.07, cfg.headSize * 0.26, teethMat);
                tooth.rotation.x = Math.PI;
                tooth.position.set(side * cfg.headSize * 0.5, -cfg.headSize * 0.34, cfg.headSize * (0.5 + i * 0.4));
                head.add(tooth);
            }
        }
    }
    addEyes(head, cfg.headSize * 0.55, cfg.headSize * 0.7, cfg.headSize * 0.42, cfg.headSize * 0.12);

    if (cfg.earShape === 'tall') {
        for (const side of [-1, 1]) {
            const ear = capsule(cfg.headSize * 0.16, cfg.headSize * 1.1, skinMat);
            ear.position.set(side * cfg.headSize * 0.45, cfg.headSize * 1.1, -cfg.headSize * 0.1);
            ear.rotation.z = side * 0.2;
            head.add(ear);
        }
    }

    // זרועות / כנפיים
    const arms = [];
    if (cfg.armLength) {
        for (const side of [-1, 1]) {
            const shoulder = new THREE.Group();
            shoulder.position.set(
                side * cfg.bodyWidth * 0.5,
                cfg.horizontal ? 0 : cfg.bodyLength * 0.28,
                cfg.horizontal ? cfg.bodyLength * 0.2 : cfg.bodyDepth * 0.1
            );
            torsoPivot.add(shoulder);
            const arm = cfg.wing
                ? box(cfg.armLength * 0.4, cfg.armLength, cfg.armLength * 0.12, bodyMat)
                : capsule(cfg.armLength * 0.16, cfg.armLength * 0.7, skinMat);
            arm.position.y = -cfg.armLength / 2;
            shoulder.add(arm);
            shoulder.rotation.z = side * 0.18;
            arms.push({ shoulder, side });
        }
    }

    // רגליים
    const legs = [];
    for (const side of [-1, 1]) {
        const leg = buildLeg(cfg, skinMat);
        leg.hip.position.set(side * cfg.bodyWidth * 0.3, cfg.horizontal ? -cfg.bodyDepth * 0.15 : -cfg.bodyLength * 0.42, 0);
        torsoPivot.add(leg.hip);
        legs.push(leg);
    }

    let tail = null;
    if (cfg.tailLength > 0) {
        tail = buildTail(cfg.tailSegments || 5, cfg.tailLength, cfg.tailRadius || cfg.bodyDepth * 0.25, bodyMat, 0.4);
        tail.root.position.set(0, cfg.horizontal ? 0 : -cfg.bodyLength * 0.35, -cfg.bodyLength * (cfg.horizontal ? 0.45 : 0.1));
        tail.joints.forEach((j, i) => { j.rotation.x = cfg.horizontal ? (i === 0 ? 1.5 : 0.04) : 0.9; });
        torsoPivot.add(tail.root);
    }

    group.userData.rig = { torsoPivot, neckPivot, headPivot, legs, arms, tail, type: 'biped' };
    return group;
}

/* ---------------------------------------------------------- דמות ייחוס אנושית */

export function buildHumanReference(heightM = 1.75) {
    const group = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
        color: 0x3ad6c0,
        transparent: true,
        opacity: 0.55,
        roughness: 0.4,
        emissive: 0x0d5e52,
        emissiveIntensity: 0.4,
    });
    const s = heightM / 1.75;
    const legs = capsule(0.09 * s, 0.78 * s, m);
    legs.position.y = 0.48 * s;
    const body = capsule(0.17 * s, 0.4 * s, m);
    body.position.y = 1.15 * s;
    const head = ball(0.12 * s, m);
    head.position.y = 1.62 * s;
    for (const side of [-1, 1]) {
        const arm = capsule(0.055 * s, 0.5 * s, m);
        arm.position.set(side * 0.22 * s, 1.15 * s, 0);
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
        build: () => buildQuadruped({
            color: 0x8d8b86, skinColor: 0x93918c, flat: true,
            legLength: 1.75, legRadius: 0.3, hoof: true, hoofColor: 0x6f6b64,
            bodyLength: 5.857, bodyWidth: 1.7, bodyDepth: 2.1,
            neckLength: 0.45, neckRadius: 0.62, neckTilt: 0.2,
            headSize: 0.72, snoutLength: 0.25, snoutRadius: 0.5,
            earShape: 'fan', earSize: 1.25, trunk: 2.0,
            tailLength: 2.474, tailSegments: 4, tailRadius: 0.07, tailTuft: 0x4a453e,
        }),
    },
    {
        id: 'giraffe', name: "ג'ירפה", emoji: '🦒', category: 'ספארי',
        heightM: 5.5, lengthM: 4.8, weightKg: 1200, speedKmh: 60,
        fact: 'הצוואר של הג\'ירפה מגיע ל-2.4 מטר, אבל יש בו בדיוק 7 חוליות - בדיוק כמו אצל בני אדם.',
        build: () => buildQuadruped({
            color: 0xe8cf9a, skinColor: 0xe8cf9a, pattern: 'giraffe',
            legLength: 2.0, legRadius: 0.13, hoof: true,
            bodyLength: 2.595, bodyWidth: 0.95, bodyDepth: 1.25,
            neckLength: 2.15, neckRadius: 0.24, neckTilt: 0.22,
            headSize: 0.3, snoutLength: 1.0, snoutRadius: 0.5,
            earShape: 'pointy', earSize: 0.7, horns: 'short', hump: true,
            tailLength: 1.141, tailSegments: 4, tailRadius: 0.035, tailTuft: 0x3a2f20,
        }),
    },
    {
        id: 'lion', name: 'אריה', emoji: '🦁', category: 'טורפים',
        heightM: 1.2, lengthM: 2.9, weightKg: 190, speedKmh: 80,
        fact: 'שאגת האריה נשמעת למרחק של עד 8 קילומטרים.',
        build: () => buildQuadruped({
            color: 0xd0a463, skinColor: 0xd0a463, mane: true, maneColor: 0x6d4a22,
            legLength: 0.72, legRadius: 0.1,
            bodyLength: 2.206, bodyWidth: 0.52, bodyDepth: 0.62,
            neckLength: 0.28, neckRadius: 0.22, neckTilt: 0.35,
            headSize: 0.22, snoutLength: 0.7, snoutRadius: 0.6,
            earShape: 'round', earSize: 0.42,
            tailLength: 1.469, tailSegments: 5, tailRadius: 0.03, tailTuft: 0x4a3418,
        }),
    },
    {
        id: 'tiger', name: 'טיגריס בנגלי', emoji: '🐅', category: 'טורפים',
        heightM: 1.05, lengthM: 3.3, weightKg: 230, speedKmh: 65,
        fact: 'לכל טיגריס דפוס פסים ייחודי - כמו טביעת אצבע. גם העור מתחת לפרווה מפוספס.',
        build: () => buildQuadruped({
            color: 0xe08a2b, skinColor: 0xdd8e37, pattern: 'tiger',
            legLength: 0.62, legRadius: 0.11,
            bodyLength: 2.57, bodyWidth: 0.54, bodyDepth: 0.6,
            neckLength: 0.24, neckRadius: 0.21, neckTilt: 0.3,
            headSize: 0.22, snoutLength: 0.65, snoutRadius: 0.62,
            earShape: 'round', earSize: 0.4,
            tailLength: 1.744, tailSegments: 6, tailRadius: 0.045,
        }),
    },
    {
        id: 'cheetah', name: 'ברדלס', emoji: '🐆', category: 'טורפים',
        heightM: 0.85, lengthM: 2.1, weightKg: 60, speedKmh: 110,
        fact: 'הברדלס הוא בעל החיים היבשתי המהיר בעולם - מ-0 ל-100 קמ"ש בשלוש שניות.',
        build: () => buildQuadruped({
            color: 0xd9a441, skinColor: 0xd9a441, pattern: 'leopard',
            legLength: 0.55, legRadius: 0.07,
            bodyLength: 1.608, bodyWidth: 0.36, bodyDepth: 0.44,
            neckLength: 0.2, neckRadius: 0.13, neckTilt: 0.35,
            headSize: 0.16, snoutLength: 0.55, snoutRadius: 0.6,
            earShape: 'round', earSize: 0.42,
            tailLength: 1.124, tailSegments: 6, tailRadius: 0.03,
        }),
    },
    {
        id: 'zebra', name: 'זברה', emoji: '🦓', category: 'ספארי',
        heightM: 1.4, lengthM: 2.7, weightKg: 350, speedKmh: 65,
        fact: 'הפסים של הזברה מבלבלים זבובים טורפים ומקשים עליהם לנחות עליה.',
        build: () => buildQuadruped({
            color: 0xf2ece0, skinColor: 0xf2ece0, pattern: 'zebra',
            legLength: 0.82, legRadius: 0.075, hoof: true,
            bodyLength: 2.223, bodyWidth: 0.5, bodyDepth: 0.72,
            neckLength: 0.62, neckRadius: 0.2, neckTilt: 0.42,
            headSize: 0.2, snoutLength: 1.1, snoutRadius: 0.55,
            earShape: 'pointy', earSize: 0.55,
            tailLength: 1.183, tailSegments: 3, tailRadius: 0.028, tailTuft: 0x1c1a17,
        }),
    },
    {
        id: 'horse', name: 'סוס', emoji: '🐎', category: 'משק',
        heightM: 1.65, lengthM: 2.9, weightKg: 500, speedKmh: 55,
        fact: 'סוסים ישנים בעמידה בזכות מנגנון נעילה בברכיים, אבל לשינה עמוקה הם נשכבים.',
        build: () => buildQuadruped({
            color: 0x6b432a, skinColor: 0x6b432a,
            legLength: 0.95, legRadius: 0.08, hoof: true,
            bodyLength: 2.143, bodyWidth: 0.55, bodyDepth: 0.78,
            neckLength: 0.7, neckRadius: 0.22, neckTilt: 0.45,
            headSize: 0.22, snoutLength: 1.15, snoutRadius: 0.55,
            earShape: 'pointy', earSize: 0.5,
            tailLength: 1.294, tailSegments: 3, tailRadius: 0.05, tailTuft: 0x2a1c12,
        }),
    },
    {
        id: 'cow', name: 'פרה', emoji: '🐄', category: 'משק',
        heightM: 1.5, lengthM: 2.5, weightKg: 720, speedKmh: 25,
        fact: 'פרה לועסת כ-40,000 לעיסות ביום ומייצרת עד 190 ליטר רוק.',
        build: () => buildQuadruped({
            color: 0xf6f2ec, skinColor: 0xf4efe8, pattern: 'cow',
            legLength: 0.8, legRadius: 0.085, hoof: true,
            bodyLength: 1.832, bodyWidth: 0.65, bodyDepth: 0.9,
            neckLength: 0.35, neckRadius: 0.24, neckTilt: 0.35,
            headSize: 0.24, snoutLength: 0.9, snoutRadius: 0.62, patternNeck: false,
            earShape: 'pointy', earSize: 0.6, horns: 'short',
            tailLength: 0.949, tailSegments: 4, tailRadius: 0.03, tailTuft: 0x3b352e,
        }),
    },
    {
        id: 'bear', name: 'דוב גריזלי', emoji: '🐻', category: 'טורפים',
        heightM: 1.35, lengthM: 2.2, weightKg: 400, speedKmh: 55,
        fact: 'גריזלי בעמידה על הרגליים האחוריות מגיע ל-2.7 מטר - גבוה מכל שחקן NBA.',
        build: () => buildQuadruped({
            color: 0x6a4a2f, skinColor: 0x6a4a2f, flat: true,
            legLength: 0.68, legRadius: 0.15,
            bodyLength: 2.158, bodyWidth: 0.75, bodyDepth: 0.85, hump: true,
            neckLength: 0.2, neckRadius: 0.28, neckTilt: 0.3,
            headSize: 0.26, snoutLength: 0.75, snoutRadius: 0.55,
            earShape: 'round', earSize: 0.42,
            tailLength: 0.12, tailSegments: 2, tailRadius: 0.06,
        }),
    },
    {
        id: 'wolf', name: 'זאב', emoji: '🐺', category: 'טורפים',
        heightM: 0.85, lengthM: 1.9, weightKg: 45, speedKmh: 60,
        fact: 'להקת זאבים יכולה לעבור 80 קילומטר ביממה אחת במרדף אחרי טרף.',
        build: () => buildQuadruped({
            color: 0x7d7c78, skinColor: 0x7d7c78, flat: true,
            legLength: 0.52, legRadius: 0.06,
            bodyLength: 1.41, bodyWidth: 0.3, bodyDepth: 0.38,
            neckLength: 0.18, neckRadius: 0.13, neckTilt: 0.3,
            headSize: 0.15, snoutLength: 1.0, snoutRadius: 0.5,
            earShape: 'pointy', earSize: 0.6,
            tailLength: 0.827, tailSegments: 4, tailRadius: 0.06,
        }),
    },
    {
        id: 'dog', name: 'רועה גרמני', emoji: '🐕', category: 'בית',
        heightM: 0.64, lengthM: 1.1, weightKg: 35, speedKmh: 48,
        fact: 'חוש הריח של כלב רגיש פי 10,000 עד 100,000 משל בן אדם.',
        build: () => buildQuadruped({
            color: 0x5a4127, skinColor: 0x3a2a18,
            legLength: 0.36, legRadius: 0.045,
            bodyLength: 0.768, bodyWidth: 0.22, bodyDepth: 0.3,
            neckLength: 0.14, neckRadius: 0.1, neckTilt: 0.35,
            headSize: 0.11, snoutLength: 0.95, snoutRadius: 0.5,
            earShape: 'pointy', earSize: 0.7,
            tailLength: 0.471, tailSegments: 4, tailRadius: 0.035,
        }),
    },
    {
        id: 'cat', name: 'חתול', emoji: '🐈', category: 'בית',
        heightM: 0.3, lengthM: 0.75, weightKg: 4.5, speedKmh: 48,
        fact: 'חתול יכול לקפוץ לגובה פי שישה מאורך גופו.',
        build: () => buildQuadruped({
            color: 0x8a8681, skinColor: 0x8a8681, pattern: 'tiger',
            legLength: 0.17, legRadius: 0.022,
            bodyLength: 0.501, bodyWidth: 0.11, bodyDepth: 0.14,
            neckLength: 0.05, neckRadius: 0.05, neckTilt: 0.3,
            headSize: 0.06, snoutLength: 0.45, snoutRadius: 0.6,
            earShape: 'pointy', earSize: 0.75,
            tailLength: 0.411, tailSegments: 6, tailRadius: 0.018,
        }),
    },
    {
        id: 'rhino', name: 'קרנף לבן', emoji: '🦏', category: 'ספארי',
        heightM: 1.8, lengthM: 4.0, weightKg: 2300, speedKmh: 50,
        fact: 'הקרן של הקרנף עשויה קרטין - אותו חומר שממנו עשויות הציפורניים שלנו.',
        build: () => buildQuadruped({
            color: 0x9a9791, skinColor: 0x9a9791, flat: true,
            legLength: 0.95, legRadius: 0.2, hoof: true,
            bodyLength: 3.291, bodyWidth: 1.1, bodyDepth: 1.15,
            neckLength: 0.25, neckRadius: 0.45, neckTilt: 0.5,
            headSize: 0.38, snoutLength: 1.0, snoutRadius: 0.62,
            earShape: 'pointy', earSize: 0.5, nasalHorn: 0.9,
            tailLength: 1.247, tailSegments: 3, tailRadius: 0.04, tailTuft: 0x4a463f,
        }),
    },
    {
        id: 'deer', name: 'אייל אדום', emoji: '🦌', category: 'ספארי',
        heightM: 1.3, lengthM: 2.0, weightKg: 200, speedKmh: 70,
        fact: 'האיילים משילים את הקרניים כל שנה ומגדלים חדשות וגדולות יותר.',
        build: () => buildQuadruped({
            color: 0x9a6a3c, skinColor: 0x9a6a3c,
            legLength: 0.78, legRadius: 0.05, hoof: true,
            bodyLength: 2.1, bodyWidth: 0.38, bodyDepth: 0.55,
            neckLength: 0.45, neckRadius: 0.13, neckTilt: 0.4,
            headSize: 0.15, snoutLength: 0.9, snoutRadius: 0.55,
            earShape: 'pointy', earSize: 0.8, horns: 'long',
            tailLength: 0.18, tailSegments: 2, tailRadius: 0.03,
        }),
    },
    {
        id: 'penguin', name: 'פינגווין קיסר', emoji: '🐧', category: 'קוטב',
        heightM: 1.15, lengthM: 0.5, weightKg: 35, speedKmh: 9, upright: true,
        fact: 'פינגווין קיסר צולל לעומק 500 מטר ונשאר מתחת למים עד 20 דקות.',
        build: () => buildBiped({
            color: 0x25292e, skinColor: 0x25292e, belly: 0xf3efe4,
            legLength: 0.2, legRadius: 0.04, hoof: false,
            bodyLength: 0.7, bodyWidth: 0.3, bodyDepth: 0.34,
            neckLength: 0.08, neckRadius: 0.1,
            headSize: 0.11, beak: 0.13, beakColor: 0xe09a3a,
            armLength: 0.42, wing: true, tailLength: 0,
        }),
    },
    {
        id: 'kangaroo', name: 'קנגורו אדום', emoji: '🦘', category: 'ספארי',
        heightM: 1.8, lengthM: 1.6, weightKg: 85, speedKmh: 70, upright: true,
        fact: 'קנגורו אדום קופץ 9 מטר בקפיצה אחת ומגיע לגובה 3 מטר.',
        build: () => buildBiped({
            color: 0xa9663d, skinColor: 0xa9663d,
            legLength: 0.75, legRadius: 0.08,
            bodyLength: 0.85, bodyWidth: 0.34, bodyDepth: 0.4,
            neckLength: 0.14, neckRadius: 0.1,
            headSize: 0.14, snoutLength: 0.8, earShape: 'tall',
            armLength: 0.4, tailLength: 1.0, tailSegments: 5, tailRadius: 0.1,
        }),
    },
    {
        id: 'trex', name: 'טי-רקס', emoji: '🦖', category: 'דינוזאורים',
        heightM: 4.0, lengthM: 12.0, weightKg: 8000, speedKmh: 27,
        fact: 'נשיכת הטי-רקס הפעילה כוח של 5.8 טון - החזקה ביותר של חיה יבשתית אי פעם.',
        build: () => buildBiped({
            color: 0x5c6b4a, skinColor: 0x5c6b4a, flat: true, horizontal: true,
            legLength: 1.9, legRadius: 0.26,
            bodyLength: 4.254, bodyWidth: 1.1, bodyDepth: 1.4,
            neckLength: 0.9, neckRadius: 0.36,
            headSize: 0.55, jaw: true,
            armLength: 0.55, tailLength: 5.299, tailSegments: 7, tailRadius: 0.5,
        }),
    },
];

export function getAnimal(id) {
    return ANIMALS.find((a) => a.id === id) || ANIMALS[0];
}

/**
 * בונה חיה ומנרמל אותה לגובה האמיתי שלה במטרים,
 * כך שהמודל תמיד יוצא בקנה מידה נכון ביחס לעולם.
 */
export function createAnimal(spec) {
    const group = spec.build();
    const boxHelper = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    boxHelper.getSize(size);
    if (size.y > 0.001) {
        const scale = spec.heightM / size.y;
        group.scale.setScalar(scale);
        // התאמת אורך (חוטם עד קצה הזנב) למידה האמיתית.
        // מוגבל ל-30% כדי שהחיה לא תימתח ותיראה מעוותת.
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
    wrapper.userData.trunk = group.userData.trunk;
    wrapper.userData.spec = spec;
    wrapper.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return wrapper;
}

/* ------------------------------------------------------------------ אנימציה */

export function animateAnimal(animal, t, mode) {
    const rig = animal.userData.rig;
    if (!rig) return;
    const walking = mode === 'walk';
    const speed = walking ? 3.4 : 1.1;
    const phase = t * speed;

    // נשימה
    const breathe = 1 + Math.sin(t * 1.4) * 0.012;
    rig.torsoPivot.scale.set(breathe, breathe, 1);

    // רגליים
    rig.legs.forEach((leg, i) => {
        const offset = rig.type === 'biped' ? i * Math.PI : [0, Math.PI, Math.PI, 0][i];
        if (walking) {
            const swing = Math.sin(phase + offset);
            leg.hip.rotation.x = swing * 0.5;
            leg.knee.rotation.x = Math.max(0, -Math.sin(phase + offset + 0.9)) * 0.8;
        } else {
            leg.hip.rotation.x = Math.sin(t * 0.8 + offset) * 0.012;
            leg.knee.rotation.x = 0.02;
        }
    });

    // גוף מתנדנד בהליכה
    if (walking) {
        rig.torsoPivot.position.y = animal.userData.baseTorsoY ?? (animal.userData.baseTorsoY = rig.torsoPivot.position.y);
        rig.torsoPivot.position.y += Math.sin(phase * 2) * 0.008 * (animal.userData.spec?.heightM || 1);
        rig.torsoPivot.rotation.z = Math.sin(phase) * 0.02;
    } else {
        rig.torsoPivot.rotation.z = 0;
    }

    // ראש וצוואר
    rig.headPivot.rotation.x = Math.sin(t * 0.9) * 0.06 + (walking ? Math.sin(phase * 2) * 0.03 : 0);
    rig.headPivot.rotation.y = Math.sin(t * 0.37) * 0.22;
    rig.neckPivot.rotation.x = Math.sin(t * 0.6) * 0.03;

    // זנב
    if (rig.tail) {
        rig.tail.joints.forEach((j, i) => {
            j.rotation.z = Math.sin(t * 2.2 - i * 0.55) * (0.12 + i * 0.03);
        });
    }

    // כנפיים / זרועות
    if (rig.arms) {
        rig.arms.forEach(({ shoulder, side }) => {
            shoulder.rotation.x = walking ? Math.sin(phase + (side > 0 ? Math.PI : 0)) * 0.35 : Math.sin(t * 1.3) * 0.08;
        });
    }

    // חדק הפיל
    if (animal.userData.trunk) {
        animal.userData.trunk.forEach((j, i) => {
            j.rotation.x = 0.2 + Math.sin(t * 1.1 - i * 0.4) * 0.12;
            j.rotation.z = Math.sin(t * 0.8 - i * 0.3) * 0.08;
        });
    }
}
