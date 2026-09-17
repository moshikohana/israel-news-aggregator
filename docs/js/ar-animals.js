/*
 * ar-animals.js - מנוע ה-AR
 *
 * שני מצבי עבודה:
 *  1. WebXR (אנדרואיד/Chrome, משקפי AR) - זיהוי משטח אמיתי עם hit-test
 *     והצבת החיה על הרצפה בגודל אמיתי.
 *  2. מצב מצלמה (iOS Safari, דפדפנים בלי WebXR) - וידאו חי מהמצלמה כרקע,
 *     שכבת תלת ממד מעליו, וסיבוב המבט לפי חיישני המכשיר.
 *
 * בשני המצבים 1 יחידה = 1 מטר, כך שהחיה מוצגת בגודלה האמיתי.
 */
import * as THREE from 'three';
import { ANIMALS, getAnimal, createAnimal, animateAnimal, buildHumanReference } from './animals.js';
import { createModelAnimal, hasModel, measure } from './models.js';

const EYE_HEIGHT = 1.6;          // גובה עין ממוצע במצב מצלמה (מטר)
const DEFAULT_FOV = 65;          // ברירת מחדל לכיול שדה הראייה
const STORAGE_KEY = 'ar-animals-settings';
const APP_VERSION = '3';

const state = {
    mode: 'idle',                // idle | xr | camera | preview
    animalId: ANIMALS[0].id,
    animation: 'idle',           // idle | walk
    showHuman: false,
    distance: 6,
    pitch: 0,
    yaw: Math.PI,                // כיוון החיה, נשמר בין מיקומים מחדש
    spin: false,                 // סיבוב אוטומטי לתצוגת 360 מעלות
    fov: DEFAULT_FOV,
    placed: false,
};

const el = (id) => document.getElementById(id);
const dom = {};
let renderer, scene, camera, clock;
let animalGroup = null, humanRef = null, reticle = null, shadowPlane = null, grid = null;
let xrSession = null, hitTestSource = null, localSpace = null;
let videoEl = null, videoStream = null;
let orientation = { alpha: 0, beta: 0, gamma: 0, screen: 0, active: false };

/* ------------------------------------------------------------ אתחול הסצנה */

function initScene() {
    const canvas = el('gl');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(state.fov, window.innerWidth / window.innerHeight, 0.05, 400);
    camera.position.set(0, EYE_HEIGHT, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8778, 2.2));
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
    sun.position.set(4, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 14;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.far = 60;
    scene.add(sun);
    scene.add(sun.target);

    // צל בלבד - כדי שהחיה תיראה מונחת על הרצפה האמיתית
    shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.ShadowMaterial({ opacity: 0.32 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // רשת עזר - מוצגת רק בתצוגה מקדימה בלי מצלמה
    grid = new THREE.GridHelper(40, 40, 0x35c8b0, 0x224a45);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.visible = false;
    scene.add(grid);

    reticle = buildReticle();
    scene.add(reticle);

    clock = new THREE.Clock();
    window.addEventListener('resize', onResize);
    renderer.setAnimationLoop(render);
}

function buildReticle() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.13, 0.16, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x35e0c0, transparent: true, opacity: 0.95 })
    );
    const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.03, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    g.add(ring, dot);
    g.visible = false;
    g.matrixAutoUpdate = false;
    return g;
}

function onResize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ------------------------------------------------------------- טעינת חיה */

let spawnToken = 0;

async function spawnAnimal(keepTransform = true) {
    const spec = getAnimal(state.animalId);
    const token = ++spawnToken;
    const prevPos = animalGroup ? animalGroup.position.clone() : null;
    const prevRot = animalGroup ? animalGroup.rotation.y : Math.PI;

    let next;
    if (hasModel(spec)) {
        setStatus(`טוען את ${spec.name}…`);
        try {
            next = await createModelAnimal(spec);
        } catch (err) {
            console.warn('model load failed', spec.model, err);
            next = createAnimal(spec);   // נפילה למודל הפרוצדורלי
        }
    } else {
        next = createAnimal(spec);
    }

    // בזמן הטעינה המשתמש אולי כבר בחר חיה אחרת
    if (token !== spawnToken) return;

    if (animalGroup) {
        scene.remove(animalGroup);
        disposeTree(animalGroup);
    }
    animalGroup = next;
    scene.add(animalGroup);

    if (keepTransform && prevPos) {
        animalGroup.position.copy(prevPos);
        animalGroup.rotation.y = prevRot;
    } else {
        placeInFront(state.distance);
        animalGroup.rotation.y = state.yaw;
    }
    applyAnimation();
    updateHumanRef();
    updateInfoPanel(spec);
}

/** מסנכרן את מצב עמידה/הליכה גם במודלים עם אנימציות מובנות */
function applyAnimation() {
    const model = animalGroup?.userData.model;
    if (model) model.play(state.animation === 'walk' ? 'walk' : 'idle');
}

function disposeTree(obj) {
    // מודלי GLB חולקים גיאומטריה וחומרים עם העותק שבמטמון,
    // ולכן אסור לשחרר אותם - רק המודלים הפרוצדורליים משוחררים
    if (obj.userData.model) return;
    obj.traverse((o) => {
        if (o.isMesh) {
            o.geometry?.dispose?.();
            // החומרים משתמשים בטקסטורות משותפות מהמטמון - לא משחררים אותן
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
            else o.material?.dispose?.();
        }
    });
}

function placeInFront(distance, reface = false) {
    if (!animalGroup) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    animalGroup.position.set(camPos.x + dir.x * distance, groundY(), camPos.z + dir.z * distance);
    // הכיוון שהמשתמש בחר נשמר; רק "מיקום מחדש" מפנה את החיה אליו בחזרה
    if (reface) state.yaw = Math.atan2(-dir.x, -dir.z);
    animalGroup.rotation.y = state.yaw;
    updateHumanRef();
    aimAtAnimal();
}

function groundY() {
    return shadowPlane.position.y;
}

function updateHumanRef() {
    if (!humanRef) {
        humanRef = buildHumanReference(1.75);
        humanRef.visible = false;
        scene.add(humanRef);
    }
    humanRef.visible = state.showHuman && !!animalGroup;
    if (animalGroup && humanRef.visible) {
        const spec = getAnimal(state.animalId);
        const side = Math.max(1.0, spec.lengthM * 0.55);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), animalGroup.rotation.y);
        humanRef.position.copy(animalGroup.position).addScaledVector(right, side);
        humanRef.rotation.y = animalGroup.rotation.y;
    }
}

/* ------------------------------------------------------------- מצב WebXR */

async function startXR() {
    try {
        setStatus('מבקש הרשאת AR…');
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test', 'local-floor'],
            optionalFeatures: ['dom-overlay', 'light-estimation'],
            domOverlay: { root: el('overlay') },
        });
        xrSession = session;
        state.mode = 'xr';
        state.placed = false;
        document.body.classList.add('in-xr');
        renderer.xr.setReferenceSpaceType('local-floor');
        await renderer.xr.setSession(session);

        localSpace = await session.requestReferenceSpace('local-floor');
        const viewerSpace = await session.requestReferenceSpace('viewer');
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        session.addEventListener('select', onXRSelect);
        session.addEventListener('end', onXREnd);

        grid.visible = false;
        if (!animalGroup) await spawnAnimal(false);
        animalGroup.visible = false;
        setStatus('כוון את המצלמה לרצפה ולחץ על המסך כדי להציב את החיה');
        showScreen(null);
    } catch (err) {
        console.warn('XR failed', err);
        setStatus('לא הצלחתי להפעיל AR מלא - עוברים למצב מצלמה');
        startCamera();
    }
}

function onXRSelect() {
    if (!animalGroup) return;
    const pos = new THREE.Vector3();

    if (reticle.visible) {
        pos.setFromMatrixPosition(reticle.matrix);
    } else {
        // אין זיהוי רצפה (תאורה חלשה, רצפה חלקה, משטח לא מזוהה) -
        // מציבים בכל זאת: על הרצפה המשוערת, לפני הצופה
        const camPos = new THREE.Vector3();
        camera.getWorldPosition(camPos);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
        dir.normalize();
        const spec = getAnimal(state.animalId);
        const away = THREE.MathUtils.clamp(spec.heightM * 1.6, 1.5, 8);
        pos.set(camPos.x + dir.x * away, camPos.y - EYE_HEIGHT, camPos.z + dir.z * away);
        setStatus('לא זוהתה רצפה - הצבתי את החיה לפניך');
    }

    animalGroup.position.copy(pos);
    shadowPlane.position.y = pos.y;
    animalGroup.visible = true;
    state.placed = true;

    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    state.yaw = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
    animalGroup.rotation.y = state.yaw;
    updateHumanRef();
    if (reticle.visible) {
        setStatus(`${getAnimal(state.animalId).name} הוצב/ה בגודל אמיתי - התרחק/י כדי לראות הכל`);
    }
}

function onXREnd() {
    hitTestSource = null;
    xrSession = null;
    state.mode = 'idle';
    reticle.visible = false;
    document.body.classList.remove('in-xr');
    showScreen('start');
}

/* ------------------------------------------------------- מצב מצלמה (fallback) */

async function startCamera() {
    try {
        // חייב לרוץ ראשון: ב-iOS ההרשאה לחיישנים תקפה רק בתוך מחוות המשתמש
        const orientationPromise = enableOrientation();
        setStatus('מבקש גישה למצלמה…');
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });
        videoEl = el('cam');
        videoEl.srcObject = videoStream;
        await videoEl.play();
        document.body.classList.add('has-camera');
        scene.background = null;
        state.mode = 'camera';
        grid.visible = false;
        await orientationPromise;
        if (!animalGroup) await spawnAnimal(false);
        else placeInFront(state.distance);
        animalGroup.visible = true;
        state.placed = true;
        showScreen(null);
        setStatus('גרור/י כדי לסובב · החלק/י מעלה ומטה כדי להרחיק ולקרב');
    } catch (err) {
        console.warn('camera failed', err);
        startPreview(`לא הצלחתי לפתוח את המצלמה (${err.name || 'שגיאה'}). מציג תצוגה מקדימה ללא מצלמה.`);
    }
}

async function startPreview(message) {
    state.mode = 'preview';
    grid.visible = true;
    scene.background = new THREE.Color(0x0d1117);
    if (!animalGroup) await spawnAnimal(false);
    else placeInFront(state.distance);
    animalGroup.visible = true;
    state.placed = true;
    showScreen(null);
    setStatus(message || 'תצוגה מקדימה - גרור/י כדי להסתכל מסביב');
}

async function enableOrientation() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
        try {
            const res = await DOE.requestPermission();
            if (res !== 'granted') return false;
        } catch { return false; }
    }
    window.addEventListener('deviceorientation', (e) => {
        if (e.alpha === null) return;
        orientation.alpha = e.alpha;
        orientation.beta = e.beta;
        orientation.gamma = e.gamma;
        orientation.screen = (screen.orientation?.angle ?? window.orientation ?? 0);
        orientation.active = true;
    }, true);
    return true;
}

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function applyDeviceOrientation() {
    const alpha = THREE.MathUtils.degToRad(orientation.alpha);
    const beta = THREE.MathUtils.degToRad(orientation.beta);
    const gamma = THREE.MathUtils.degToRad(orientation.gamma);
    const orient = THREE.MathUtils.degToRad(orientation.screen);
    _euler.set(beta, alpha, -gamma, 'YXZ');
    camera.quaternion.setFromEuler(_euler);
    camera.quaternion.multiply(_q1);
    camera.quaternion.multiply(_q0.setFromAxisAngle(_zee, -orient));
}

/* ------------------------------------------------------------ מגע ועכבר */

let drag = null;
let pinchStart = null;

function bindPointer() {
    const surface = el('stage');

    surface.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.ui')) return;
        closeSheets();
        drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
        surface.setPointerCapture(e.pointerId);
    });

    surface.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId || !animalGroup) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;

        // סיבוב החיה - 360 מעלות מלאות, והזווית נשמרת
        state.yaw -= dx * 0.008;
        animalGroup.rotation.y = state.yaw;
        if (dx) state.spin = false;          // נגיעה עוצרת את הסיבוב האוטומטי

        if (state.mode === 'camera' || state.mode === 'preview') {
            if (orientation.active) {
                // עם ג'ירוסקופ המבט מגיע מהחיישנים, אז הגרירה משנה מרחק
                setDistance(state.distance + dy * 0.02);
            } else {
                // בלי חיישנים (מחשב) - גרירה אנכית מטה ומרימה את המבט
                setPitch(state.pitch + dy * 0.004);
            }
        }
        updateHumanRef();
    });

    const endDrag = (e) => {
        if (drag && drag.id === e.pointerId) drag = null;
    };
    surface.addEventListener('pointerup', endDrag);
    surface.addEventListener('pointercancel', endDrag);

    surface.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2) return;
        const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinchStart === null) { pinchStart = d; return; }
        setDistance(state.distance * (pinchStart / d));
        pinchStart = d;
    }, { passive: true });

    surface.addEventListener('touchend', () => { pinchStart = null; });

    surface.addEventListener('wheel', (e) => {
        if (state.mode === 'xr') return;
        e.preventDefault();
        setDistance(state.distance + e.deltaY * 0.01);
    }, { passive: false });
}

function setPitch(v) {
    state.pitch = THREE.MathUtils.clamp(v, -1.2, 1.2);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(state.pitch, 0, 0);
}

/** מכוון את המבט למרכז החיה - רלוונטי כשאין חיישני תנועה */
function aimAtAnimal() {
    if (orientation.active || !animalGroup) return;
    const spec = getAnimal(state.animalId);
    const dy = spec.heightM * 0.55 - EYE_HEIGHT;
    setPitch(Math.atan2(dy, Math.max(state.distance, 0.5)));
}

function setDistance(v) {
    state.distance = THREE.MathUtils.clamp(v, 1.2, 60);
    dom.distance.value = state.distance.toFixed(1);
    dom.distanceOut.textContent = `${state.distance.toFixed(1)} מ'`;
    if (state.mode !== 'xr') placeInFront(state.distance);
}

/* ------------------------------------------------- מחוון "החיה מחוץ לפריים" */

const _animalPos = new THREE.Vector3();
const _ndc = new THREE.Vector3();

function updateOffscreenHint() {
    const hint = dom.hint;
    if (!animalGroup || !animalGroup.visible || !state.placed) {
        hint.classList.remove('show');
        return;
    }

    // מרכז החיה (בערך באמצע הגובה שלה) בקואורדינטות מסך
    const spec = getAnimal(state.animalId);
    animalGroup.getWorldPosition(_animalPos);
    _animalPos.y += spec.heightM * 0.5;
    _ndc.copy(_animalPos).project(camera);

    const behind = _ndc.z > 1;
    const outside = behind || Math.abs(_ndc.x) > 1 || Math.abs(_ndc.y) > 1;
    if (!outside) {
        hint.classList.remove('show');
        return;
    }

    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const distance = camPos.distanceTo(_animalPos);

    // כשהחיה מאחור, ההיטל מתהפך - מתקנים כדי שהחץ יצביע נכון
    const x = behind ? -_ndc.x : _ndc.x;
    const y = behind ? -_ndc.y : _ndc.y;
    let arrow = '⬆️';
    if (behind && Math.abs(x) < 0.4) arrow = '🔄';
    else if (Math.abs(x) > Math.abs(y)) arrow = x > 0 ? '➡️' : '⬅️';
    else arrow = y > 0 ? '⬆️' : '⬇️';

    hint.innerHTML = `<span class="hint-arrow">${arrow}</span>`
        + `<span>${spec.emoji} ${spec.name} כאן, ${distance.toFixed(1)} מ' - הפנה/י את המצלמה</span>`;
    hint.classList.add('show');
}

/* --------------------------------------------------------------- לולאת ציור */

function render(timestamp, frame) {
    const delta = clock.getDelta();
    const t = clock.elapsedTime;

    if (state.mode === 'xr' && frame && hitTestSource && !state.placed) {
        const results = frame.getHitTestResults(hitTestSource);
        if (results.length) {
            const pose = results[0].getPose(localSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
        } else {
            reticle.visible = false;
        }
    } else {
        reticle.visible = false;
    }

    if ((state.mode === 'camera') && orientation.active) applyDeviceOrientation();

    if (animalGroup) {
        const model = animalGroup.userData.model;
        if (model) model.mixer?.update(delta);
        else animateAnimal(animalGroup, t, state.animation);

        if (state.spin) {
            animalGroup.rotation.y += delta * 0.6;
            state.yaw = animalGroup.rotation.y;
        }
    }
    updateOffscreenHint();
    if (t - (render.lastDiag || 0) > 0.5) { render.lastDiag = t; updateDiagnostics(); }
    renderer.render(scene, camera);
}

/* ----------------------------------------------------------------- ממשק */

function setStatus(text) {
    dom.status.textContent = text;
    dom.status.classList.add('show');
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => dom.status.classList.remove('show'), 5200);
}

function showScreen(name) {
    dom.start.classList.toggle('hidden', name !== 'start');
    dom.hud.classList.toggle('hidden', name === 'start');
}

function updateInfoPanel(spec) {
    dom.infoName.textContent = `${spec.emoji} ${spec.name}`;
    dom.infoDims.innerHTML = `
        <span><b>${spec.heightM}</b> מ' גובה</span>
        <span><b>${spec.lengthM}</b> מ' אורך</span>
        <span><b>${spec.weightKg.toLocaleString('he-IL')}</b> ק"ג</span>
        <span><b>${spec.speedKmh}</b> קמ"ש</span>`;
    dom.infoFact.textContent = spec.fact;
    // גובה יחסי לאדם ממוצע
    const ratio = (spec.heightM / 1.75);
    dom.infoRatio.textContent = ratio >= 1
        ? `פי ${ratio.toFixed(1)} מגובה אדם ממוצע`
        : `${Math.round(ratio * 100)}% מגובה אדם ממוצע`;
}

function buildPicker() {
    const categories = [...new Set(ANIMALS.map((a) => a.category))];
    dom.picker.innerHTML = '';
    for (const cat of categories) {
        const group = document.createElement('div');
        group.className = 'pick-group';
        group.innerHTML = `<div class="pick-label">${cat}</div>`;
        const row = document.createElement('div');
        row.className = 'pick-row';
        for (const a of ANIMALS.filter((x) => x.category === cat)) {
            const btn = document.createElement('button');
            btn.className = 'pick ui';
            btn.dataset.id = a.id;
            btn.innerHTML = `<span class="pick-emoji">${a.emoji}</span><span class="pick-name">${a.name}</span>`
                + `<span class="pick-size">${a.heightM} מ'${hasModel(a) ? ' ✦' : ''}</span>`;
            if (hasModel(a)) btn.title = 'מודל תלת ממד מלא עם אנימציות';
            btn.addEventListener('click', () => selectAnimal(a.id));
            row.appendChild(btn);
        }
        group.appendChild(row);
        dom.picker.appendChild(group);
    }
    markSelected();
}

function markSelected() {
    dom.picker.querySelectorAll('.pick').forEach((b) => {
        b.classList.toggle('active', b.dataset.id === state.animalId);
    });
}

function fitDistance(spec) {
    // מרחק שממנו החיה נכנסת בשלמותה לפריים
    const span = Math.max(spec.heightM, spec.lengthM * 0.75);
    return THREE.MathUtils.clamp(span * 1.5 + 1.2, 1.5, 60);
}

function selectAnimal(id) {
    state.animalId = id;
    markSelected();
    const spec = getAnimal(id);
    if (state.mode !== 'xr') setDistance(fitDistance(spec));
    spawnAnimal(state.mode === 'xr');
    closeSheets();
    saveSettings();
    setStatus(`${spec.emoji} ${spec.name} · ${spec.heightM} מ' גובה אמיתי`);
}

function closeSheets() {
    el('sheet').classList.remove('open');
    el('settings').classList.remove('open');
}

function toggleSheet(id) {
    const target = el(id);
    const willOpen = !target.classList.contains('open');
    closeSheets();
    target.classList.toggle('open', willOpen);
}

/* ------------------------------------------------------------- צילום מסך */

async function capture() {
    const w = window.innerWidth * (window.devicePixelRatio > 1 ? 2 : 1);
    const h = window.innerHeight * (window.devicePixelRatio > 1 ? 2 : 1);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');

    if (videoEl && videoEl.videoWidth) {
        // מילוי כמו object-fit: cover
        const vr = videoEl.videoWidth / videoEl.videoHeight;
        const cr = w / h;
        let dw = w, dh = h, dx = 0, dy = 0;
        if (vr > cr) { dw = h * vr; dx = (w - dw) / 2; } else { dh = w / vr; dy = (h - dh) / 2; }
        ctx.drawImage(videoEl, dx, dy, dw, dh);
    } else {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(renderer.domElement, 0, 0, w, h);

    const spec = getAnimal(state.animalId);
    ctx.font = `${Math.round(h * 0.022)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'right';
    ctx.fillText(`${spec.emoji} ${spec.name} · ${spec.heightM} מ' · גודל אמיתי`, w - h * 0.03, h - h * 0.03);

    out.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ar-${spec.id}-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setStatus('התמונה נשמרה 📸');
    }, 'image/png');
}

/* --------------------------------------------------------------- הגדרות */

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            animalId: state.animalId, fov: state.fov, animation: state.animation,
        }));
    } catch { /* אין localStorage - לא נורא */ }
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.animalId && ANIMALS.some((a) => a.id === s.animalId)) state.animalId = s.animalId;
        if (typeof s.fov === 'number') state.fov = THREE.MathUtils.clamp(s.fov, 35, 95);
        if (s.animation) state.animation = s.animation;
    } catch { /* התעלמות מהגדרות פגומות */ }
}

function applyFov(v) {
    state.fov = THREE.MathUtils.clamp(v, 35, 95);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    dom.fovOut.textContent = `${Math.round(state.fov)}°`;
    saveSettings();
}

/* ------------------------------------------------------- התקנה כאפליקציה */

let installPrompt = null;

function setupInstall() {
    const btn = el('btn-install');
    const standalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    // כשהאפליקציה כבר מותקנת - אין מה להציע
    if (standalone) {
        el('back-link').classList.add('hidden');
        return;
    }

    // כרום באנדרואיד: האירוע מגיע כשהאתר עומד בתנאי ההתקנה
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installPrompt = e;
        btn.classList.remove('hidden');
    });

    btn.addEventListener('click', async () => {
        if (!installPrompt) {
            // ספארי ודפדפנים אחרים - התקנה ידנית מתפריט השיתוף
            setStatus('בתפריט הדפדפן: שיתוף ← הוסף למסך הבית');
            return;
        }
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        installPrompt = null;
        if (outcome === 'accepted') btn.classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
        btn.classList.add('hidden');
        setStatus('האפליקציה הותקנה 🎉 אפשר לפתוח אותה ממסך הבית');
    });

    // הקישור לעמוד החדשות רלוונטי רק כשרצים מתוך שרת ה-Flask
    if (!/\/ar\/?$/.test(location.pathname)) el('back-link').classList.add('hidden');
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // דורש הקשר מאובטח (https או localhost) - בלעדיו פשוט מדלגים
    if (!window.isSecureContext) return;

    // אפליקציה מותקנת מגישה את עצמה מהמטמון, ובלי זה גרסה ישנה
    // הייתה יכולה להישאר תקועה על המכשיר גם אחרי עדכון
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;   // בהתקנה ראשונה אין מה לרענן
        reloading = true;
        location.reload();
    });

    navigator.serviceWorker.register('sw.js')
        .then((reg) => reg.update())
        .catch((err) => console.warn('SW failed', err));
}

/* ---------------------------------------------------------------- אבחון */

const diagnostics = { lastError: null };

window.addEventListener('error', (e) => { diagnostics.lastError = e.message; });
window.addEventListener('unhandledrejection', (e) => {
    diagnostics.lastError = String(e.reason?.message || e.reason);
});

function updateDiagnostics() {
    const box = el('diag');
    if (!box || !el('settings').classList.contains('open')) return;

    const spec = getAnimal(state.animalId);
    const gl = renderer?.getContext?.();
    let gpu = 'לא זמין';
    try {
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : (gl ? 'WebGL פעיל' : 'אין WebGL');
    } catch { gpu = gl ? 'WebGL פעיל' : 'אין WebGL'; }

    let onScreen = '—';
    if (animalGroup) {
        const p = new THREE.Vector3();
        animalGroup.getWorldPosition(p);
        p.y += spec.heightM * 0.5;
        p.project(camera);
        onScreen = (p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1) ? 'כן' : 'לא (מחוץ לפריים)';
    }

    const rows = [
        ['גרסה', APP_VERSION],
        ['מצב', { xr: 'AR מלא', camera: 'מצלמה', preview: 'תצוגה מקדימה', idle: 'לא פעיל' }[state.mode]],
        ['כרטיס מסך', String(gpu).slice(0, 38)],
        ['חיה', `${spec.name} · ${animalGroup ? (animalGroup.userData.model ? 'מודל מלא' : 'פרוצדורלי') : 'לא נטענה'}`],
        ['מוצבת', animalGroup ? (animalGroup.visible && state.placed ? 'כן' : 'לא') : 'לא'],
        ['בתוך הפריים', onScreen],
        ['מרחק', `${state.distance.toFixed(1)} מ'`],
        ['מצלמה חיה', videoEl && videoEl.videoWidth ? `${videoEl.videoWidth}×${videoEl.videoHeight}` : 'לא פעילה'],
        ['שגיאה אחרונה', diagnostics.lastError ? diagnostics.lastError.slice(0, 60) : 'אין'],
    ];
    box.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
}

/* ------------------------------------------------------------------ הפעלה */

async function boot() {
    Object.assign(dom, {
        start: el('start'), hud: el('hud'), status: el('status'), picker: el('picker'),
        infoName: el('info-name'), infoDims: el('info-dims'), infoFact: el('info-fact'),
        infoRatio: el('info-ratio'), distance: el('distance'), distanceOut: el('distance-out'),
        fov: el('fov'), fovOut: el('fov-out'), hint: el('hint'),
    });

    el('version').textContent = `גרסה ${APP_VERSION}`;
    setupInstall();
    registerServiceWorker();

    loadSettings();
    initScene();
    buildPicker();
    bindPointer();
    updateInfoPanel(getAnimal(state.animalId));
    applyFov(state.fov);
    setDistance(fitDistance(getAnimal(state.animalId)));

    const xrSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    el('xr-note').textContent = xrSupported
        ? 'המכשיר שלך תומך ב-AR מלא: החיה תונח על הרצפה האמיתית.'
        : 'המכשיר לא תומך ב-WebXR - נשתמש במצלמה עם חיישני תנועה.';
    el('btn-xr').classList.toggle('hidden', !xrSupported);

    el('btn-xr').addEventListener('click', startXR);
    el('btn-cam').addEventListener('click', startCamera);
    el('btn-preview').addEventListener('click', () => startPreview());

    el('btn-walk').addEventListener('click', (e) => {
        state.animation = state.animation === 'walk' ? 'idle' : 'walk';
        e.currentTarget.classList.toggle('on', state.animation === 'walk');
        e.currentTarget.textContent = state.animation === 'walk' ? '🚶 בתנועה' : '🧍 עומד';
        applyAnimation();
        saveSettings();
    });
    el('btn-human').addEventListener('click', (e) => {
        state.showHuman = !state.showHuman;
        e.currentTarget.classList.toggle('on', state.showHuman);
        updateHumanRef();
        setStatus(state.showHuman ? 'הוספתי דמות אדם בגובה 1.75 מ\' להשוואה' : 'הסרתי את דמות ההשוואה');
    });
    el('btn-center').addEventListener('click', () => {
        if (!animalGroup) return;
        if (state.mode === 'xr') {
            // מציב מיד לפני הצופה, בלי להמתין לזיהוי רצפה
            onXRSelect();
            setStatus('הבאתי את החיה לפניך');
            return;
        }
        // מרחק שממנו רואים את כל החיה, בכיוון שאליו המצלמה מופנית עכשיו
        setDistance(fitDistance(getAnimal(state.animalId)));
        placeInFront(state.distance, true);
        animalGroup.visible = true;
        setStatus('הבאתי את החיה לפניך');
    });
    el('btn-spin').addEventListener('click', (e) => {
        state.spin = !state.spin;
        e.currentTarget.classList.toggle('on', state.spin);
        setStatus(state.spin ? 'סיבוב אוטומטי - נגיעה במסך עוצרת' : 'עצרתי את הסיבוב');
    });
    el('btn-shot').addEventListener('click', capture);
    el('btn-sheet').addEventListener('click', () => toggleSheet('sheet'));
    el('btn-settings').addEventListener('click', () => toggleSheet('settings'));
    el('btn-exit').addEventListener('click', () => {
        if (xrSession) { xrSession.end(); return; }
        if (videoStream) { videoStream.getTracks().forEach((t) => t.stop()); videoStream = null; }
        document.body.classList.remove('has-camera');
        state.mode = 'idle';
        showScreen('start');
    });

    dom.distance.addEventListener('input', (e) => setDistance(parseFloat(e.target.value)));
    dom.fov.value = state.fov;
    dom.fov.addEventListener('input', (e) => applyFov(parseFloat(e.target.value)));

    el('btn-walk').textContent = state.animation === 'walk' ? '🚶 בתנועה' : '🧍 עומד';
    el('btn-walk').classList.toggle('on', state.animation === 'walk');
    showScreen('start');
}

boot();

// עזרי בדיקה אוטומטית (לא בשימוש בממשק עצמו)
window.__pick = (id) => selectAnimal(id);
window.__info = () => {
    if (!animalGroup) return null;
    const box = measure(animalGroup);
    const cam = new THREE.Vector3(); camera.getWorldPosition(cam);
    return {
        pos: animalGroup.position.toArray().map((v) => +v.toFixed(2)),
        min: box.min.toArray().map((v) => +v.toFixed(2)),
        max: box.max.toArray().map((v) => +v.toFixed(2)),
        visible: animalGroup.visible,
        children: animalGroup.children.length,
        isModel: !!animalGroup.userData.model,
        camera: cam.toArray().map((v) => +v.toFixed(2)),
        pitch: +camera.rotation.x.toFixed(2),
    };
};
window.__look = (angle) => { camera.rotation.order = 'YXZ'; camera.rotation.y = angle; };
window.__yaw = () => (animalGroup ? animalGroup.rotation.y : 0);
window.__face = (angle) => { if (animalGroup) animalGroup.rotation.y = angle; };
