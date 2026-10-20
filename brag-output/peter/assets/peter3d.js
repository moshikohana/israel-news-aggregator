import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const R = window.REGION, TL = window.BEATS3D;
const W = 540, H = 960, HB = 278;
let curH = 960;
const c2d = document.getElementById('c2d'); const rctx = c2d.getContext('2d');
const canvas = document.getElementById("c3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(32, W / H, 0.5, 4000);

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- helpers
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(7);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
}
const GLOW = glowTex();
function particles(n, box, color, size, seed = 3) {
  const r = mulberry(seed); const pos = new Float32Array(n * 3), base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { base[i * 3] = (r() - 0.5) * box[0]; base[i * 3 + 1] = r() * box[1]; base[i * 3 + 2] = (r() - 0.5) * box[2]; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: GLOW, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { base, n, box };
  return pts;
}
function updateParticles(p, t, speed = 1) {
  const { base, n, box } = p.userData; const a = p.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const y = (base[i * 3 + 1] + t * (2 + (i % 5)) * speed) % box[1];
    a[i * 3] = base[i * 3] + Math.sin(t * 0.4 + i) * 2; a[i * 3 + 1] = y; a[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.3 + i * 1.7) * 2;
  }
  p.geometry.attributes.position.needsUpdate = true;
}
const MAT = {
  gold: new THREE.MeshPhysicalMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15, emissive: 0x1a1200, emissiveIntensity: 0.35 }),
  goldHot: new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffb800, emissiveIntensity: 2.6, metalness: 0.2, roughness: 0.4 }),
  slate: new THREE.MeshPhysicalMaterial({ color: 0x141c27, metalness: 0.7, roughness: 0.4, clearcoat: 0.3 }),
  slate2: new THREE.MeshPhysicalMaterial({ color: 0x1b2635, metalness: 0.7, roughness: 0.35, clearcoat: 0.4 }),
  obsidian: new THREE.MeshPhysicalMaterial({ color: 0x07090d, metalness: 0.9, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }),
  sea: new THREE.MeshPhysicalMaterial({ color: 0x03101c, metalness: 0.4, roughness: 0.4, clearcoat: 0.4 }),
};

// ---------- SET: MAP
const mapSet = new THREE.Group(); scene.add(mapSet);
const gazaTop = 6;
function addRegion(group, polys, depth, mat, edgeColor, edgeOp = 0.85) {
  for (const p of polys) {
    const sh = new THREE.Shape(p.ext.map(([x, s]) => new THREE.Vector2(x, -s)));
    for (const h of p.holes) sh.holes.push(new THREE.Path(h.map(([x, s]) => new THREE.Vector2(x, -s))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth > 4 ? 0.5 : 0.3, bevelSize: depth > 4 ? 0.4 : 0.3, bevelSegments: 2, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
    if (edgeColor) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOp, blending: THREE.AdditiveBlending }));
      group.add(e);
    }
  }
}
addRegion(mapSet, R.egypt, 2, MAT.slate, 0x2a4a6a, 0.45);
addRegion(mapSet, R.jordan, 2, MAT.slate, 0x2a4a6a, 0.45);
addRegion(mapSet, R.saudi, 2, MAT.slate, 0x2a4a6a, 0.35);
addRegion(mapSet, R.syria, 2, MAT.slate, 0x2a4a6a, 0.45);
addRegion(mapSet, R.lebanon, 2, MAT.slate, 0x2a4a6a, 0.45);
addRegion(mapSet, R.israel, 3, MAT.slate2, 0x5f90c0, 0.7);
addRegion(mapSet, R.westbank, 3, MAT.slate2, 0x5f90c0, 0.6);
addRegion(mapSet, R.gaza, gazaTop, MAT.gold, 0xffe08a, 1.0);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), MAT.sea); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.8; sea.receiveShadow = true; mapSet.add(sea);
const grid = new THREE.GridHelper(2400, 120, 0x1d4468, 0x0d2238); grid.position.y = -0.7; grid.material.transparent = true; grid.material.opacity = 0.35; mapSet.add(grid);
// corridor
const cpts = R.corridor.map(([x, s]) => new THREE.Vector3(x, gazaTop + 0.8, s));
const ccurve = new THREE.CatmullRomCurve3(cpts, false, "catmullrom", 0.3);
const ctube = new THREE.Mesh(new THREE.TubeGeometry(ccurve, 64, 0.9, 10, false), new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffb300, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2 }));
mapSet.add(ctube);
const cpulse = []; for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xfff1b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(7, 7, 1); mapSet.add(s); cpulse.push(s); }
// Gaza halo
const halo = new THREE.Mesh(new THREE.RingGeometry(38, 40, 96), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
halo.rotation.x = -Math.PI / 2; halo.position.set(R.gaza_center[0], 0.2, R.gaza_center[1]); mapSet.add(halo);
const mapDust = particles(500, [520, 90, 520], 0xffd9a0, 2.6, 11); mapDust.position.set(-40, 0, 20); mapSet.add(mapDust);
// gauge (ring) – camera-space
const gaugeGroup = new THREE.Group(); mapSet.add(gaugeGroup);
const gaugeBack = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 16, 120), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: 0.6, roughness: 0.4 })); gaugeGroup.add(gaugeBack);
let gaugeFill = null;
function setGauge(frac) {
  if (gaugeFill) { gaugeGroup.remove(gaugeFill); gaugeFill.geometry.dispose(); }
  gaugeFill = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 16, 120, Math.max(0.001, Math.PI * 2 * frac)), MAT.goldHot);
  gaugeFill.rotation.z = Math.PI / 2; gaugeGroup.add(gaugeFill);
}
setGauge(0.01);
const mapKey = new THREE.DirectionalLight(0xfff0d0, 1.5); mapKey.position.set(120, 200, 140); mapKey.castShadow = true;
mapKey.shadow.mapSize.set(1024, 1024); const sc = mapKey.shadow.camera; sc.left = -400; sc.right = 400; sc.top = 400; sc.bottom = -400; sc.far = 800; mapSet.add(mapKey);
mapSet.add(new THREE.PointLight(0xffc040, 900, 140).translateX(R.gaza_center[0]).translateY(40).translateZ(R.gaza_center[1]));

// ---------- SET: COMMAND (org tree)
const cmdSet = new THREE.Group(); cmdSet.position.set(3000, 0, 0); scene.add(cmdSet);
const nodes = [];
(function () {
  const levels = [1, 3, 9, 18]; const ys = [13, 5, -3, -11]; const rad = [1.9, 1.3, 0.9, 0.55];
  let id = 0, prev = [];
  levels.forEach((n, li) => {
    const cur = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (li === 0 ? 0 : [0, 13, 4.6, 2.3][li]);
      const mat = new THREE.MeshPhysicalMaterial({ color: li < 2 ? 0xd4af37 : 0x6f8aa8, metalness: 0.9, roughness: 0.2, clearcoat: 0.8, emissive: li < 2 ? 0x4a3300 : 0x0a1a2a, emissiveIntensity: 0.9 });
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rad[li], 3), mat); m.castShadow = true;
      m.position.set(x, ys[li], 0); cmdSet.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: li < 2 ? 0xffc83a : 0x7fb0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 })); halo.scale.set(rad[li] * 6, rad[li] * 6, 1); m.add(halo);
      const parent = li === 0 ? null : prev[Math.floor(i / (n / prev.length))];
      const o = { mesh: m, halo, li, id: id++, parent, home: m.position.clone(), vel: new THREE.Vector3((rnd() - 0.5) * 6, rnd() * 4, (rnd() - 0.5) * 6), spin: new THREE.Vector3(rnd() * 3, rnd() * 3, rnd() * 3) };
      nodes.push(o); cur.push(o);
    }
    prev = cur;
  });
})();
const lineGeo = new THREE.BufferGeometry(); const linePos = new Float32Array(nodes.length * 6); lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
const linkMat = new THREE.LineBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
const links = new THREE.LineSegments(lineGeo, linkMat); links.frustumCulled = false; cmdSet.add(links);
const cmdFloor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), MAT.obsidian); cmdFloor.rotation.x = -Math.PI / 2; cmdFloor.position.y = -18; cmdFloor.receiveShadow = true; cmdSet.add(cmdFloor);
const cmdDust = particles(300, [80, 50, 40], 0x9fc4ff, 1.6, 5); cmdDust.position.set(0, -18, -5); cmdSet.add(cmdDust);
cmdSet.add(new THREE.DirectionalLight(0xfff0d0, 2.2).translateX(20).translateY(30).translateZ(30));
cmdSet.add(new THREE.PointLight(0x4f8cff, 1500, 80).translateY(5).translateZ(15));

// ---------- SET: SHIELD
const shSet = new THREE.Group(); shSet.position.set(6000, 0, 0); scene.add(shSet);
const sh = new THREE.Shape(); sh.moveTo(0, 1.55); sh.bezierCurveTo(0.55, 1.35, 1.1, 1.3, 1.35, 1.2); sh.lineTo(1.35, 0.25); sh.bezierCurveTo(1.35, -0.65, 0.6, -1.15, 0, -1.65); sh.bezierCurveTo(-0.6, -1.15, -1.35, -0.65, -1.35, 0.25); sh.lineTo(-1.35, 1.2); sh.bezierCurveTo(-1.1, 1.3, -0.55, 1.35, 0, 1.55);
const shGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 8, curveSegments: 24 });
const shield = new THREE.Mesh(shGeo, MAT.gold); shield.castShadow = true; shSet.add(shield);
const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4, curveSegments: 24 }), MAT.obsidian); inner.scale.set(0.78, 0.78, 1); inner.position.z = 0.42; shSet.add(inner);
const star = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 12, 6), MAT.goldHot); star.position.z = 0.56; shSet.add(star);
const star2 = star.clone(); star2.rotation.z = Math.PI / 6; shSet.add(star2);
const shRings = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(1.9, 1.96, 96), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })); r.position.z = -0.4; shSet.add(r); shRings.push(r); }
const shFloor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), MAT.obsidian); shFloor.rotation.x = -Math.PI / 2; shFloor.position.y = -3; shFloor.receiveShadow = true; shSet.add(shFloor);
const shDust = particles(260, [24, 16, 20], 0xffd9a0, 0.5, 21); shDust.position.set(0, -3, -4); shSet.add(shDust);
const shKey = new THREE.SpotLight(0xfff2d0, 380, 40, 0.5, 0.6); shKey.position.set(4, 8, 8); shKey.target = shield; shKey.castShadow = true; shSet.add(shKey);
shSet.add(new THREE.PointLight(0xffa020, 140, 30).translateX(-4).translateY(1).translateZ(4));

// ---------- SET: STUDIO (cabinet table)
const stSet = new THREE.Group(); stSet.position.set(9000, 0, 0); scene.add(stSet);
const stFloor = new THREE.Mesh(new THREE.CircleGeometry(60, 80), new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: 0.9, roughness: 0.12, clearcoat: 1 })); stFloor.rotation.x = -Math.PI / 2; stFloor.receiveShadow = true; stSet.add(stFloor);
const table = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.35, 64), MAT.gold); table.position.y = 2.1; table.castShadow = true; table.receiveShadow = true; stSet.add(table);
const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 2.0, 32), MAT.obsidian); tableBase.position.y = 1.0; tableBase.castShadow = true; stSet.add(tableBase);
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2; const ch = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 1.5), MAT.obsidian); seat.position.y = 1.5; ch.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.22), MAT.obsidian); back.position.set(0, 2.5, 0.7); ch.add(back);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), MAT.gold); leg.position.y = 0.7; ch.add(leg);
  ch.traverse(o => { if (o.isMesh) o.castShadow = true; });
  ch.position.set(Math.cos(a) * 7.4, 0, Math.sin(a) * 7.4); ch.rotation.y = -a - Math.PI / 2; stSet.add(ch);
}
const beams = [];
for (let i = 0; i < 3; i++) {
  const sp = new THREE.SpotLight(i === 1 ? 0xfff0d0 : 0xaecbff, 4200, 110, 0.38, 0.7); sp.position.set((i - 1) * 16, 34, 6); sp.target.position.set(0, 2, 0); sp.castShadow = i === 1; stSet.add(sp); stSet.add(sp.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 40, 1, true), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffe3a0 : 0x9ec4ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.copy(sp.position).multiplyScalar(0.5).setY(17.5); stSet.add(cone); beams.push({ sp, cone, i });
}
const stRing = new THREE.Mesh(new THREE.TorusGeometry(24, 0.25, 12, 120), MAT.goldHot); stRing.rotation.x = Math.PI / 2; stRing.position.y = 30; stSet.add(stRing);
stSet.add(new THREE.PointLight(0xffd9a0, 900, 60).translateY(14));
stSet.add(new THREE.AmbientLight(0x88aaff, 0.5));
const stDust = particles(400, [90, 40, 90], 0xcfe0ff, 0.7, 31); stSet.add(stDust);

// ---------- SET: CHESS
const chSet = new THREE.Group(); chSet.position.set(12000, 0, 0); scene.add(chSet);
const goldM = new THREE.MeshPhysicalMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1, emissive: 0x1a1200, emissiveIntensity: 0.12 });
const obsM = new THREE.MeshPhysicalMaterial({ color: 0x0b0e14, metalness: 0.95, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
const sqA = new THREE.MeshPhysicalMaterial({ color: 0x2c3541, metalness: 0.5, roughness: 0.25, clearcoat: 0.8 });
const sqB = new THREE.MeshPhysicalMaterial({ color: 0x07090c, metalness: 0.6, roughness: 0.2, clearcoat: 1 });
for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), (x + z) % 2 ? sqA : sqB); m.position.set(x - 3.5, 0, z - 3.5); m.receiveShadow = true; chSet.add(m); }
const frame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 9.2), goldM); frame.position.y = -0.3; chSet.add(frame);
const chFloor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshPhysicalMaterial({ color: 0x080a0e, metalness: 0.9, roughness: 0.15, clearcoat: 1 })); chFloor.rotation.x = -Math.PI / 2; chFloor.position.y = -0.6; chFloor.receiveShadow = true; chSet.add(chFloor);
function lathe(pts, mat) { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 36); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
const baseProf = [[0, 0], [0.4, 0], [0.42, 0.06], [0.36, 0.14], [0.26, 0.22]];
function piece(type, mat) {
  const g = new THREE.Group();
  const add = (o) => { o.castShadow = true; g.add(o); return o; };
  if (type === "p") { add(lathe([...baseProf, [0.16, 0.45], [0.2, 0.52], [0.14, 0.58], [0, 0.6]], mat)); const h = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mat)); h.position.y = 0.72; }
  if (type === "r") { add(lathe([...baseProf, [0.24, 0.7], [0.3, 0.74], [0.3, 0.86], [0, 0.86]], mat)); for (let i = 0; i < 4; i++) { const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), mat)); const a = i * Math.PI / 2; c.position.set(Math.cos(a) * 0.22, 0.93, Math.sin(a) * 0.22); } }
  if (type === "n") { add(lathe([...baseProf, [0.22, 0.4], [0.2, 0.46], [0, 0.46]], mat)); const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.5), mat)); b.position.set(0, 0.8, 0); b.rotation.z = -0.15; const hd = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.62), mat)); hd.position.set(0.1, 1.2, 0.1); hd.rotation.x = 0.5; }
  if (type === "b") { add(lathe([...baseProf, [0.14, 0.62], [0.2, 0.7], [0.12, 0.8], [0, 0.86]], mat)); const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), mat)); s.position.y = 0.98; }
  if (type === "q") { add(lathe([...baseProf, [0.17, 0.8], [0.3, 0.92], [0.22, 1.0], [0, 1.0]], mat)); const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), mat)); s.position.y = 1.16; }
  if (type === "k") { add(lathe([...baseProf, [0.18, 0.85], [0.3, 0.98], [0.2, 1.06], [0, 1.06]], mat)); const c1 = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), mat)); c1.position.y = 1.3; const c2 = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), mat)); c2.position.y = 1.3; }
  g.scale.setScalar(1.05);
  return g;
}
const back = "rnbqkbnr", pawns = "pppppppp"; const pieces = [];
for (let i = 0; i < 8; i++) {
  [["g", 3, back[i]], ["g", 2, "p"], ["o", -4, back[i]], ["o", -3, "p"]].forEach(([c, z, t]) => {
    const m = piece(t, c === "g" ? goldM : obsM); const zz = c === "g" ? (z === 3 ? 3.5 : 2.5) : (z === -4 ? -3.5 : -2.5);
    m.position.set(i - 3.5, 0.15, zz); chSet.add(m); pieces.push({ m, c, t, i, home: m.position.clone() });
  });
}
const pcAt = (c, t, i) => pieces.find(p => p.c === c && p.t === t && p.i === i);
const gKnight = pcAt("g", "n", 6), oPawn = pcAt("o", "p", 5), oKing = pcAt("o", "k", 4), gQueen = pcAt("g", "q", 3), oKnight = pcAt("o", "n", 1), gRook = pcAt("g", "r", 7);
const chKey = new THREE.DirectionalLight(0xffeccc, 1.7); chKey.position.set(-8, 14, 9); chKey.castShadow = true; chKey.shadow.mapSize.set(1024, 1024); const csc = chKey.shadow.camera; csc.left = -10; csc.right = 10; csc.top = 10; csc.bottom = -10; csc.far = 50; chSet.add(chKey);
chSet.add(new THREE.PointLight(0x5588ff, 120, 40).translateX(8).translateY(4).translateZ(-6));
const chDust = particles(300, [30, 14, 30], 0xffd9a0, 0.35, 41); chSet.add(chDust);

// ---------- scheduling
const SETS = { map: mapSet, cmd: cmdSet, shield: shSet, studio: stSet, chess: chSet };
const BG = { map: 0x04070d, cmd: 0x05070d, shield: 0x07060a, studio: 0x05070c, chess: 0x06070b };
scene.fog = new THREE.FogExp2(0x04070d, 0.0014);
const camPath = (b, u) => {
  const e = ease(u); const f = b.cam.from, to = b.cam.to; const L = (a, bb) => a + (bb - a) * e;
  return { p: [0, 1, 2].map(i => L(f.p[i], to.p[i])), l: [0, 1, 2].map(i => L(f.l[i], to.l[i])), fov: L(f.fov, to.fov) };
};
function at(t) {
  let b = TL[0]; for (const x of TL) if (t >= x.t) b = x;
  const u = clamp((t - b.t) / Math.max(0.001, b.d));
  for (const k in SETS) SETS[k].visible = k === b.set;
  scene.background = new THREE.Color(BG[b.set]); scene.fog.color.set(BG[b.set]); scene.fog.density = b.set === "map" ? 0.0011 : 0.004;
  const base = SETS[b.set].position;
  const c = camPath(b, u);
  // set-specific animation
  if (b.set === "map") {
    updateParticles(mapDust, t, 0.4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctube.material.emissiveIntensity = 2.2 + 2 * pulse * (b.pulse ? 1 : 0.4);
    const L = ccurve.getLength();
    cpulse.forEach((s, i) => { const p = ccurve.getPointAt(((t * 0.35 + i / cpulse.length) % 1)); s.position.copy(p); s.material.opacity = 0.9 * (b.pulse ? 1 : 0.5); });
    halo.scale.setScalar(1 + 0.08 * Math.sin(t * 2)); halo.material.opacity = 0.3 + 0.1 * pulse;
    // rise of gaza
    const rise = easeOut((t - b.t) / 0.8 + (b.risePre ? 1 : 0));
    // gauge
    gaugeGroup.visible = !!b.gauge;
    if (b.gauge) {
      const ts = t - b.t; let frac;
      if (ts < 0.2) frac = 0.01; else if (ts < 2.4) frac = 0.65 * easeOut((ts - 0.2) / 2.2); else if (ts < 2.9) frac = 0.65; else frac = 0.65 + 0.35 * ease((ts - 2.9) / 0.9);
      setGauge(clamp(frac, 0.01, 1)); 
    }
  } else if (b.set === "cmd") {
    updateParticles(cmdDust, t, 0.3);
    // elimination + promotion + collapse timeline in global time
    const elim = window.CMD_ELIM || [], promo = window.CMD_PROMO || 1e9, collapse = window.CMD_COLLAPSE || 1e9;
    nodes.forEach((n, idx) => {
      let pos = n.home.clone(); let s = 1; let vis = true; let rot = 0;
      const ei = elim.findIndex(x => x.id === n.id);
      if (ei >= 0) { const te = elim[ei].t; if (t > te) { const d = t - te; pos.y -= 0.5 * 30 * d * d; pos.x += n.vel.x * d; pos.z += n.vel.z * d; rot = d * 6; s = clamp(1 - d * 0.7, 0.05, 1); } }
      if (n.li === 2 && n.id % 3 === 0 && t > promo + (n.id % 9) * 0.18) { const up = easeOut((t - promo - (n.id % 9) * 0.18) / 0.5); const par = n.parent; pos.lerp(par.home.clone().add(new THREE.Vector3(((n.id % 5) - 2) * 1.2, 0, 1.2)), up); s = 1 + 0.6 * up; }
      if (t > collapse) { const d = t - collapse - n.li * 0.05; if (d > 0) { pos.y -= 0.5 * 36 * d * d; pos.x += n.vel.x * d * 1.5; pos.z += n.vel.z * d * 1.5; rot = d * 5; } }
      pos.y = Math.max(pos.y, -17 + n.mesh.geometry.parameters.radius * s);
      n.mesh.position.copy(pos); n.mesh.scale.setScalar(s); n.mesh.rotation.set(rot * n.spin.x * 0.3, rot * n.spin.y * 0.3, rot * n.spin.z * 0.2);
      n.halo.material.opacity = (t > collapse ? 0.25 : 0.8) * (0.8 + 0.2 * Math.sin(t * 4 + n.id));
    });
    const a = linePos; let k = 0; const linkOn = t < collapse;
    nodes.forEach(n => { if (n.parent) { const p = n.parent.mesh.position, q = n.mesh.position; a[k++] = p.x; a[k++] = p.y; a[k++] = p.z; a[k++] = q.x; a[k++] = q.y; a[k++] = q.z; } else { a[k++] = 0; a[k++] = 0; a[k++] = 0; a[k++] = 0; a[k++] = 0; a[k++] = 0; } });
    lineGeo.attributes.position.needsUpdate = true; linkMat.opacity = linkOn ? 0.75 : clamp(0.75 - (t - collapse) * 2.2, 0, 0.75);
  } else if (b.set === "shield") {
    const ts = t - b.t; shield.rotation.y = Math.sin(ts * 1.2) * 0.5; inner.rotation.y = shield.rotation.y; star.rotation.y = star2.rotation.y = shield.rotation.y;
    star.rotation.z = ts * 0.5; star2.rotation.z = Math.PI / 6 + ts * 0.5; shield.position.y = Math.sin(ts * 2) * 0.08; inner.position.y = star.position.y = star2.position.y = shield.position.y;
    shRings.forEach((r, i) => { const ph = ((ts * 0.7 + i / 4) % 1); r.scale.setScalar(1 + ph * 2.4); r.material.opacity = 0.55 * (1 - ph); });
    updateParticles(shDust, t, 0.35);
  } else if (b.set === "studio") {
    updateParticles(stDust, t, 0.25);
    beams.forEach(({ sp, cone, i }) => { const sw = Math.sin(t * 0.8 + i * 2) * 10; sp.position.x = (i - 1) * 16 + sw; cone.position.x = sp.position.x * 0.5; cone.rotation.z = -Math.atan2(sp.position.x, 34) * 0.9; });
    stRing.rotation.z = t * 0.2;
  } else if (b.set === "chess") {
    updateParticles(chDust, t, 0.2);
    pieces.forEach(p => { p.m.position.copy(p.home); p.m.rotation.set(0, 0, 0); p.m.visible = true; });
    const ts = t - b.t, d = b.d;
    // 1: knight hops to capture pawn
    const hop = clamp((ts - 1.0) / 1.1);
    if (hop > 0) { const from = gKnight.home, to = oPawn.home.clone(); gKnight.m.position.lerpVectors(from, to, ease(hop)); gKnight.m.position.y = 0.15 + Math.sin(hop * Math.PI) * 1.7; if (hop > 0.85) { oPawn.m.position.y = 0.15 - (hop - 0.85) * 8; oPawn.m.visible = hop < 0.98; } }
    if (hop >= 1) oPawn.m.visible = false;
    // 2: queen slides diag
    const sl = clamp((ts - 3.2) / 1.3); if (sl > 0) { const to = new THREE.Vector3(3.5 - 0.5, 0.15, -0.5); gQueen.m.position.lerpVectors(gQueen.home, to, ease(sl)); }
    // 3: rook lifts and comes
    const rk = clamp((ts - 5.0) / 1.2); if (rk > 0) { const to = new THREE.Vector3(oKnight.home.x + 0, 0.15, -1.5); gRook.m.position.lerpVectors(gRook.home, to, ease(rk)); gRook.m.position.y = 0.15 + Math.sin(rk * Math.PI) * 0.6; }
    // 4: king tips over
    const kt = clamp((ts - (d - 1.7)) / 0.9); if (kt > 0) { oKing.m.rotation.z = -ease(kt) * 1.45; oKing.m.position.y = 0.15 + ease(kt) * 0.1; oKing.m.position.x += ease(kt) * 0.35; }
  }
  camera.up.set(0, 1, 0);
  const banner = !!b.banner; const Hc = banner ? HB : H;
  if (Hc !== curH) { curH = Hc; renderer.setSize(W, Hc, false); composer.setSize(W, Hc); bloom.resolution.set(W, Hc); }
  canvas.style.height = banner ? "555px" : "1920px";
  c2d.style.display = banner ? "block" : "none";
  camera.position.set(base.x + c.p[0], base.y + c.p[1], base.z + c.p[2]);
  camera.fov = c.fov; camera.aspect = W / Hc;
  camera.lookAt(base.x + c.l[0], base.y + c.l[1], base.z + c.l[2]);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  if (b.set === "map" && b.gauge) {
    const dist = b.gaugeD || 30; const halfH = dist * Math.tan(camera.fov * Math.PI / 360), halfW = halfH * camera.aspect;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize(); const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    gaugeGroup.position.copy(camera.position).addScaledVector(fwd, dist).addScaledVector(right, -halfW * 0.7).addScaledVector(up, 0);
    gaugeGroup.quaternion.copy(camera.quaternion); gaugeGroup.scale.setScalar(halfH * 0.5);
  }
  bloom.strength = b.bloom || 0.5;
  composer.render();
  if (banner) { rctx.clearRect(0, 0, 540, 278); rctx.save(); rctx.translate(0, 278); rctx.scale(1, -1); rctx.drawImage(canvas, 0, 0, 540, 278); rctx.restore(); }
}
window.addEventListener("hf-seek", (e) => at(e.detail.time));
at(window.__hfThreeTime || 0);
window.__peter3d = at;
