// =====================================================================
// Khung nhìn 3D công trình dựng từ bản vẽ CAD (cột, dầm, sàn, vách, tường, móng theo tầng)
// Tô màu theo mức sử dụng khả năng chịu lực; biến dạng phóng đại; minh họa kịch bản (gió, ngập)
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { levels } from '../struct/design.js';

const TYPE_COL = { col: '#cbd5e1', beam: '#e2e8f0', slab: '#f1f5f9', wall: '#a78bfa', brick: '#d6b49a', foot: '#94a3b8' };
export const uColor = (u) => (u == null ? null : u > 1 ? '#dc2626' : u > 0.9 ? '#f97316' : u > 0.7 ? '#facc15' : u > 0.4 ? '#22c55e' : '#3b82f6');

export class Building3D {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dbe7f3');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 5000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a9a7a', 1.1));
    const sun = new THREE.DirectionalLight('#fff7e6', 1.8);
    sun.position.set(-60, 120, 80); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 500 });
    this.scene.add(sun);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.fx = new THREE.Group(); this.scene.add(this.fx);
    const loop = () => { this._raf = requestAnimationFrame(loop); this.controls.update(); this._anim?.(); this.renderer.render(this.scene, this.camera); };
    loop();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(el);
    this.resize();
  }
  resize() { const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() { cancelAnimationFrame(this._raf); this._ro.disconnect(); this.controls.dispose(); this.root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); }
  _clear(g) { g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); g.clear(); }
  // st (mm), b (building), res: kết quả check() hoặc null, disp: {A, combo, scale} hoặc null
  build(st, b, { res = null, deform = null, sel = null } = {}) {
    this._clear(this.root);
    const Z = levels(b), H = Z.at(-1), uOf = new Map();
    if (res) for (const it of res.items) uOf.set(`${it.id}@${it.storey}`, it.u);
    const baseU = new Map(); if (res) res.base.forEach((p) => p.foot && baseU.set(p.foot.id, p.u));
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.02 });
    const mats = {};
    const M = (c) => (mats[c] ||= mat(c));
    const box = (w, h, d, x, y, z, color, rotY = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color)); m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = m.receiveShadow = true; this.root.add(m); return m; };
    // tọa độ: X → x, Y(bản vẽ) → −z, cao độ → y ; mm → m
    const X = (v) => v / 1000, Y = (v) => -v / 1000;
    const dsp = deform ? deform.fn : null; // (x,y,z) → [dx,dy,dz] (m, đã phóng đại)
    const hi = (id) => sel && sel.has(id);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#cfd8c2', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; this.root.add(ground);
    for (const f of st.foots) box(X(f.B), f.H / 1000, X(f.L), X(f.x), -f.H / 2000 - 0.02, Y(f.y), hi(f.id) ? '#f97316' : uColor(baseU.get(f.id)) || TYPE_COL.foot);
    for (let k = 0; k < b.storeys; k++) {
      const z0 = Z[k], z1 = Z[k + 1], h = z1 - z0;
      for (const c of st.cols) {
        const col = hi(c.id) ? '#f97316' : uColor(uOf.get(`${c.id}@${k + 1}`)) || TYPE_COL.col;
        if (dsp) { const a = dsp(c.x, c.y, z0), d = dsp(c.x, c.y, z1); const p0 = new THREE.Vector3(X(c.x) + a[0], z0 + a[2], Y(c.y) - a[1]), p1 = new THREE.Vector3(X(c.x) + d[0], z1 + d[2], Y(c.y) - d[1]); const m = box(X(c.b), p0.distanceTo(p1), X(c.h), (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2, col); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); }
        else box(X(c.b), h, X(c.h), X(c.x), z0 + h / 2, Y(c.y), col);
      }
      for (const w of st.walls) {
        const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 1000, rot = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
        const col = hi(w.id) ? '#f97316' : w.kind === 'rc' ? uColor(uOf.get(`${w.id}@${k + 1}`)) || TYPE_COL.wall : TYPE_COL.brick;
        if (w.kind === 'brick' && k === b.storeys - 1) continue;
        box(L, w.kind === 'rc' ? h : h - 0.6, w.t / 1000, X((w.x1 + w.x2) / 2), z0 + (w.kind === 'rc' ? h / 2 : (h - 0.6) / 2), Y((w.y1 + w.y2) / 2), col, rot);
      }
      for (const bm of st.beams) {
        const L = Math.hypot(bm.x2 - bm.x1, bm.y2 - bm.y1) / 1000, rot = Math.atan2(bm.y2 - bm.y1, bm.x2 - bm.x1), hh = bm.h / 1000;
        const col = hi(bm.id) ? '#f97316' : uColor(uOf.get(`${bm.id}@${k + 1}`)) || TYPE_COL.beam;
        let ox = 0, oy = 0, oz = 0;
        if (dsp) { const d = dsp((bm.x1 + bm.x2) / 2, (bm.y1 + bm.y2) / 2, z1); ox = d[0]; oz = -d[1]; oy = d[2]; }
        box(L, hh, bm.b / 1000, X((bm.x1 + bm.x2) / 2) + ox, z1 - hh / 2 + oy, Y((bm.y1 + bm.y2) / 2) + oz, col, rot);
      }
      for (const s of st.slabs) {
        const sh = new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(X(x), -Y(y))));
        const t = (s.t || 120) / 1000, g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
        const m = new THREE.Mesh(g, M(hi(s.id) ? '#f97316' : TYPE_COL.slab));
        m.rotation.x = -Math.PI / 2; m.position.y = z1 - t;
        if (dsp) { const c = s.pts.reduce((a, p) => [a[0] + p[0] / s.pts.length, a[1] + p[1] / s.pts.length], [0, 0]), d = dsp(c[0], c[1], z1); m.position.x += d[0]; m.position.z -= d[1]; m.position.y += d[2]; }
        m.castShadow = m.receiveShadow = true; this.root.add(m);
      }
    }
    // khung kính mặt ngoài nhẹ (chỉ minh họa) — bỏ khi đang xem kết quả
    if (!res && !dsp && st.cols.length) {
      const xs = st.cols.map((c) => c.x), ys = st.cols.map((c) => c.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const g = new THREE.MeshStandardMaterial({ color: '#7fb3d5', transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.3, depthWrite: false });
      for (const [w, d, x, z, r] of [[X(x1 - x0), 0, X((x0 + x1) / 2), Y(y0), 0], [X(x1 - x0), 0, X((x0 + x1) / 2), Y(y1), 0], [X(y1 - y0), 0, X(x0), Y((y0 + y1) / 2), Math.PI / 2], [X(y1 - y0), 0, X(x1), Y((y0 + y1) / 2), Math.PI / 2]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H - Z[1]), g); m.position.set(x, Z[1] + (H - Z[1]) / 2, z); m.rotation.y = r; this.root.add(m);
      }
    }
    if (!this._framed) this.frame(st, b);
  }
  frame(st, b) {
    const xs = st.cols.map((c) => c.x / 1000), ys = st.cols.map((c) => -c.y / 1000);
    if (!xs.length) return;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...ys) + Math.max(...ys)) / 2, H = levels(b).at(-1), R = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), H);
    this.controls.target.set(cx, H * 0.4, cz);
    this.camera.position.set(cx - R * 1.1, H * 0.9 + R * 0.4, cz + R * 1.3);
    this._framed = true;
  }
  // minh họa kịch bản: mũi tên gió, mặt nước ngập, mưa
  setScenario(sc, st, b) {
    this._clear(this.fx); this._anim = null;
    if (!sc || !st.cols.length) return;
    const xs = st.cols.map((c) => c.x / 1000), ys = st.cols.map((c) => -c.y / 1000), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...ys), z1 = Math.max(...ys), H = levels(b).at(-1);
    if (sc.type === 'storm' || sc.type === 'flood') {
      const n = 900, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = x0 - 30 + Math.random() * (x1 - x0 + 60); pos[i * 3 + 1] = Math.random() * (H + 20); pos[i * 3 + 2] = z0 - 30 + Math.random() * (z1 - z0 + 60); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const rain = new THREE.Points(g, new THREE.PointsMaterial({ color: '#5b7da8', size: 0.35, transparent: true, opacity: 0.7 }));
      this.fx.add(rain);
      const wind = sc.type === 'storm' ? 0.4 + (sc.level - 10) * 0.12 : 0.05;
      this._anim = () => { for (let i = 0; i < n; i++) { pos[i * 3 + 1] -= 0.9; pos[i * 3] += wind; if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = H + 20; pos[i * 3] = x0 - 30 + Math.random() * (x1 - x0 + 60); } } g.attributes.position.needsUpdate = true; };
    }
    if (sc.type === 'storm') {
      for (let k = 1; k <= 6; k++) { const y = (H * k) / 6.5, len = 6 + sc.level - 10; const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(x0 - len - 4, y, (z0 + z1) / 2), len, '#0ea5e9', 2, 1.4); this.fx.add(a); }
    }
    if (sc.type === 'flood' && sc.water > -2) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 80, z1 - z0 + 80), new THREE.MeshStandardMaterial({ color: '#2563eb', transparent: true, opacity: 0.45, depthWrite: false }));
      w.rotation.x = -Math.PI / 2; w.position.set((x0 + x1) / 2, Math.max(0.02, sc.water), (z0 + z1) / 2); this.fx.add(w);
    }
    if (sc.type === 'quake') { const t0 = performance.now(), amp = sc.agR * 2; this._anim = () => { this.root.position.x = Math.sin((performance.now() - t0) / 60) * amp; }; }
    else this.root.position.x = 0;
  }
  screenshot() { return this.renderer.domElement.toDataURL('image/png'); }
}

// ----------------------------------------------------------------- SA BÀN: khối công trình thiết kế để đặt lên bản đồ
// Trả về THREE.Group (đơn vị m, trục Y hướng lên, gốc = tâm mặt bằng tại cao độ ±0). progress 0..1 = tỉ lệ số tầng đã thi công.
// Hình học gộp theo vật liệu (1 mesh/vật liệu) để đặt nhiều khối trên bản đồ vẫn nhẹ.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const SB_MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.85 }),
  spandrel: new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: '#6f9fc2', roughness: 0.12, metalness: 0.45, transparent: true, opacity: 0.62 }),
  roof: new THREE.MeshStandardMaterial({ color: '#8b9198', roughness: 0.9 }),
  site: new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.8 }),
};
export function designGroup(st, b, { progress = 1 } = {}) {
  const g = new THREE.Group();
  if (!st.cols.length) return g;
  const Z = levels(b), N = b.storeys, built = Math.max(0, Math.min(N, Math.round(N * progress)));
  const xs = st.cols.map((c) => c.x), ys = st.cols.map((c) => c.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2000, cy = (Math.min(...ys) + Math.max(...ys)) / 2000;
  const W = (Math.max(...xs) - Math.min(...xs)) / 1000 + 0.8, D = (Math.max(...ys) - Math.min(...ys)) / 1000 + 0.8;
  const X = (v) => v / 1000 - cx, Zc = (v) => -(v / 1000 - cy);
  const parts = { concrete: [], spandrel: [], glass: [], roof: [], site: [] };
  const box = (k, w, h, d, x, y, z, rot = 0) => { const geo = new THREE.BoxGeometry(w, h, d); if (rot) geo.rotateY(rot); geo.translate(x, y, z); parts[k].push(geo); };
  for (let k = 0; k < built; k++) {
    const z0 = Z[k], z1 = Z[k + 1], h = z1 - z0, inProgress = progress < 1 && k >= built - 2;
    for (const c of st.cols) box('concrete', c.b / 1000, h, c.h / 1000, X(c.x), z0 + h / 2, Zc(c.y));
    for (const w of st.walls.filter((q) => q.kind === 'rc')) box('concrete', Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 1000, h, w.t / 1000, X((w.x1 + w.x2) / 2), z0 + h / 2, Zc((w.y1 + w.y2) / 2), -Math.atan2(w.y2 - w.y1, w.x2 - w.x1));
    for (const s of st.slabs) { const sh = new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(X(x), -Zc(y)))); const t = (s.t || 120) / 1000; const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, z1 - t, 0); parts.concrete.push(geo); }
    if (inProgress) continue; // tầng đang thi công: chỉ có khung
    // dải sàn đặc + vách kính bao quanh (bao chữ nhật của lưới cột)
    box('spandrel', W + 0.2, 0.9, D + 0.2, 0, z1 - 0.45, 0);
    for (const [w, d, x, z] of [[W, 0.04, 0, D / 2], [W, 0.04, 0, -D / 2], [0.04, D, W / 2, 0], [0.04, D, -W / 2, 0]]) box('glass', w, h - 0.9, d, x, z0 + (h - 0.9) / 2, z);
  }
  if (built === N) { const H = Z[N]; box('roof', W + 0.2, 1.1, 0.25, 0, H + 0.55, D / 2); box('roof', W + 0.2, 1.1, 0.25, 0, H + 0.55, -D / 2); box('roof', 0.25, 1.1, D, W / 2, H + 0.55, 0); box('roof', 0.25, 1.1, D, -W / 2, H + 0.55, 0); box('roof', Math.min(10, W / 3), 3, Math.min(8, D / 3), 0, H + 1.5, 0); }
  else if (built < N) box('site', 1.2, Z[built] + 25, 1.2, W / 2 + 4, (Z[built] + 25) / 2, 0); // thân cẩu tháp khi đang thi công
  for (const [k, list] of Object.entries(parts)) { if (!list.length) continue; const m = new THREE.Mesh(mergeGeometries(list.map((q) => (q.index ? q.toNonIndexed() : q))), SB_MAT[k]); m.castShadow = m.receiveShadow = true; g.add(m); list.forEach((q) => q.dispose()); }
  g.userData = { W, D, H: Z[built] || 0, built, N };
  return g;
}
