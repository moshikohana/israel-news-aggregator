/*
 * models.js - טעינת מודלי GLB מוכנים והתאמתם לגודל אמיתי
 *
 * מודל שמגיע מקובץ GLB נטען פעם אחת, מנורמל לגובה ולאורך האמיתיים
 * של החיה (כמו המודלים הפרוצדורליים), מוצמד לרצפה, ומנגן את
 * אנימציות העמידה/ההליכה המובנות שלו.
 */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

/** טעינה עם מטמון - אותו קובץ לא נטען פעמיים */
function loadGLB(url) {
    if (!cache.has(url)) {
        cache.set(url, new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        }).catch((err) => {
            cache.delete(url);
            throw err;
        }));
    }
    return cache.get(url);
}

/**
 * תיבה תוחמת של המודל בתנוחה הנוכחית.
 *
 * במודל עם שלד, תיבת הגיאומטריה היא של תנוחת הכבילה (bind pose) ולא
 * של התנוחה שרואים - ולכן מחשבים לכל SkinnedMesh תיבה לפי מצב העצמות,
 * ורק אז מאחדים. בלי זה חיות מסוימות יוצאות בקנה מידה שגוי לגמרי.
 */
export function measure(object) {
    object.updateMatrixWorld(true);
    object.traverse((o) => { if (o.isSkinnedMesh) o.computeBoundingBox(); });
    return new THREE.Box3().setFromObject(object);
}

function findClip(animations, names) {
    for (const name of names) {
        const clip = animations.find((a) => a.name.toLowerCase() === name.toLowerCase());
        if (clip) return clip;
    }
    return null;
}

/**
 * מחזיר קבוצה עם החיה בגודל אמיתי, מוצמדת לרצפה,
 * ועם rig שמאפשר להחליף בין עמידה להליכה.
 */
export async function createModelAnimal(spec) {
    const gltf = await loadGLB(spec.model);

    // שכפול רגיל משאיר את העצמות מקושרות למודל המקורי, ואז החיה
    // מתעלמת מהמיקום ומקנה המידה שלנו - SkeletonUtils משכפל גם את השלד
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) {
            o.castShadow = true;
            o.frustumCulled = false;   // תיבת החיתוך של מודל מונפש אינה אמינה
        }
    });

    const clips = gltf.animations || [];
    const mixer = clips.length ? new THREE.AnimationMixer(model) : null;
    const idleClip = mixer && findClip(clips, spec.clips?.idle ? [spec.clips.idle] : ['idle', 'Idle', 'Survey', 'Idle_2']);
    const walkClip = mixer && findClip(clips, spec.clips?.walk ? [spec.clips.walk] : ['walk', 'Walk', 'trot']);

    const actions = {};
    if (idleClip) actions.idle = mixer.clipAction(idleClip);
    if (walkClip) actions.walk = mixer.clipAction(walkClip);

    // חשוב: מפעילים את תנוחת המנוחה לפני המדידה. חלק מהאנימציות
    // משנות את הטרנספורם של שורש המודל, ובלי זה קנה המידה יוצא שגוי.
    if (actions.idle) { actions.idle.play(); mixer.update(0); }

    // שכבות נפרדות: inner לקנה מידה, offset למרכוז והצמדה לרצפה.
    // שתיהן מעל המודל, שהאנימציה עשויה לשנות את הטרנספורם שלו.
    const offset = new THREE.Group();
    offset.add(model);
    const inner = new THREE.Group();
    inner.add(offset);

    const raw = measure(model);
    const size = new THREE.Vector3();
    raw.getSize(size);

    if (size.y > 0.0001) {
        const scale = spec.heightM / size.y;
        inner.scale.setScalar(scale);
        if (spec.lengthM && !spec.upright && size.z > 0.0001) {
            const wanted = spec.lengthM / (size.z * scale);
            inner.scale.z = scale * THREE.MathUtils.clamp(wanted, 0.8, 1.25);
        }
    }

    const center = new THREE.Vector3();
    raw.getCenter(center);
    offset.position.set(-center.x, -raw.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(inner);
    wrapper.userData.spec = spec;
    wrapper.userData.model = {
        mixer,
        actions,
        current: actions.idle || null,
        /** מעבר רך בין אנימציות */
        play(name) {
            const next = actions[name] || actions.idle || actions.walk;
            if (!next || next === this.current) return;
            next.reset().fadeIn(0.3).play();
            if (this.current) this.current.fadeOut(0.3);
            this.current = next;
        },
    };
    return wrapper;
}

/** האם לחיה הזו יש מודל מוכן */
export function hasModel(spec) {
    return typeof spec.model === 'string' && spec.model.length > 0;
}
