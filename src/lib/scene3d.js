// =====================================================================
// CẢNH 3D DIGITAL TWIN (Three.js / WebGL)
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { SITE, demGrid, heightAt, obstacles, contours, pointInPoly, sunPos } from './engine.js';
import { rng } from './util.js';
const rngLocal = (s) => rng(s);

const VEX = 1.6; // phóng đại chiều đứng địa hình
const H0 = 10; // cao độ quy chiếu

// trục: X = Đông (x), Z = -Nam/Bắc (y → -z), Y = cao
const P = (x, y, h) => new THREE.Vector3(x - SITE.W / 2, (h - H0) * VEX, -(y - SITE.H / 2));

function ramp(t) {
  // xanh lá → vàng → nâu (bản đồ địa hình)
  const stops = [[0, [0.16, 0.45, 0.32]], [0.35, [0.45, 0.66, 0.33]], [0.6, [0.86, 0.79, 0.45]], [0.85, [0.72, 0.5, 0.3]], [1, [0.95, 0.93, 0.9]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i], [b, cb] = stops[i + 1];
    if (t <= b) {
      const u = (t - a) / (b - a);
      return ca.map((v, k) => v + (cb[k] - v) * u);
    }
  }
  return stops[stops.length - 1][1];
}

function orthoTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 768;
  const g = c.getContext('2d');
  const r = rng(9);
  const dem = demGrid();
  const img = g.createImageData(c.width, c.height);
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      const x = (px / c.width) * SITE.W, y = (1 - py / c.height) * SITE.H;
      const h = heightAt(x, y);
      const t = (h - dem.min) / (dem.max - dem.min);
      const n = r() * 0.12;
      let col = [0.42 + n - t * 0.1, 0.55 + n + t * 0.05, 0.28 + n];
      if (t < 0.18) col = [0.33 + n, 0.42 + n, 0.3 + n]; // ven suối ẩm
      if (t > 0.78) col = [0.62 + n, 0.55 + n, 0.38 + n]; // đất trống đồi
      const i = (py * c.width + px) * 4;
      img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // đường đất hiện hữu + mái nhà tạm
  g.strokeStyle = 'rgba(190,160,120,.9)'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 620); g.bezierCurveTo(300, 560, 600, 680, 1024, 590); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(520, 768); g.bezierCurveTo(500, 500, 640, 300, 700, 0); g.stroke();
  for (const o of obstacles()) {
    const px = (o.x / SITE.W) * c.width, py = (1 - o.y / SITE.H) * c.height;
    if (o.type === 'tree') { g.fillStyle = `rgba(30,${80 + r() * 50},40,.95)`; g.beginPath(); g.arc(px, py, o.r * 2.4, 0, 7); g.fill(); }
    else { g.fillStyle = '#b8b8c0'; g.fillRect(px - 6, py - 4, 12, 8); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class TwinScene {
  constructor(container) {
    this.el = container;
    const w = container.clientWidth, h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#b9d8ef');
    this.scene.fog = new THREE.FogExp2('#dbe8ef', 0.00082);
    this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 4000);
    this.camera.position.set(-260, 260, 330);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enableDamping = true;

    this.hemi = new THREE.HemisphereLight('#ffffff', '#6b7c5c', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e5', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 220; sc.bottom = -220; sc.far = 1500;
    this.scene.add(this.sun, this.sun.target);
    this.setSun(9, 6);
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    const sky = this.sky.material.uniforms;
    sky.turbidity.value = 7; sky.rayleigh.value = 2.2; sky.mieCoefficient.value = 0.006; sky.mieDirectionalG.value = 0.82;
    sky.sunPosition.value.set(0.35, 0.72, -0.4);
    this.scene.add(this.sky);

    this.groups = {};
    ['terrain', 'cloud', 'trees', 'contours', 'boundary', 'plan', 'water', 'cranes', 'scenario', 'heat', 'wind'].forEach((k) => {
      this.groups[k] = new THREE.Group();
      this.scene.add(this.groups[k]);
    });
    this.buildTerrain();
    this.buildBoundary();
    this.buildTrees();
    this.buildContours();
    this.layer('contours', false);

    // lưới nền ngoài khu đất
    const grid = new THREE.GridHelper(1200, 60, '#b9c6d3', '#cfd9e3');
    grid.position.y = (8 - H0) * VEX;
    this.scene.add(grid);

    this._raf = 0;
    this._anim = [];
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const t = performance.now();
      this._anim = this._anim.filter((f) => f(t) !== false);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // trả ngữ cảnh WebGL khi rời trang
    this.renderer.domElement.remove();
  }
  layer(k, on) { this.groups[k].visible = on; }

  // ---------- Địa hình ----------
  buildTerrain() {
    const g = demGrid();
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(g.nx * g.ny * 3);
    const uv = new Float32Array(g.nx * g.ny * 2);
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        const k = j * g.nx + i;
        const v = P(i * g.c, j * g.c, g.h[k]);
        pos.set([v.x, v.y, v.z], k * 3);
        uv.set([i / (g.nx - 1), j / (g.ny - 1)], k * 2);
      }
    const idx = [];
    for (let j = 0; j < g.ny - 1; j++)
      for (let i = 0; i < g.nx - 1; i++) {
        const a = j * g.nx + i, b = a + 1, c = a + g.nx, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.nx * g.ny * 3), 3));
    geo.computeVertexNormals();
    this.terrainGeo = geo;
    this.ortho = orthoTexture();
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false });
    this.terrain = new THREE.Mesh(geo, this.terrainMat);
    this.terrain.receiveShadow = true;
    this.groups.terrain.add(this.terrain);
    this.setTerrainStyle('height');
  }
  setSurface(H) {
    const g = demGrid();
    const pos = this.terrainGeo.attributes.position;
    for (let k = 0; k < g.h.length; k++) pos.setY(k, (H[k] - H0) * VEX);
    pos.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();
    this._surface = H;
  }
  setMeasuredTerrain(data) {
    if (!data?.values?.length) return;
    const g = demGrid();
    const sampled = new Float32Array(g.nx * g.ny);
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        const si = Math.round((i / Math.max(1, g.nx - 1)) * (data.nx - 1));
        const sj = Math.round((j / Math.max(1, g.ny - 1)) * (data.ny - 1));
        // Giữ hệ cao độ hiển thị của sandbox, nhưng bảo toàn chênh cao đo thực.
        sampled[j * g.nx + i] = g.mean + (data.values[sj * data.nx + si] - data.mean);
      }
    this._measuredStats = {
      name: data.name, min: data.min, max: data.max, mean: data.mean,
      cellSize: data.cellSize, nx: data.nx, ny: data.ny, crs: data.crs,
    };
    this.setSurface(sampled);
    this.setTerrainStyle('height');
  }
  terrainStats() { return this._measuredStats || null; }
  setTerrainStyle(style, data = null) {
    const g = demGrid();
    const H = this._surface || g.h;
    const min = this._measuredStats ? Math.min(...H) : g.min;
    const max = this._measuredStats ? Math.max(...H) : g.max;
    const col = this.terrainGeo.attributes.color;
    this.terrainMat.map = null;
    if (style === 'ortho') {
      this.terrainMat.map = this.ortho;
      for (let k = 0; k < g.h.length; k++) col.setXYZ(k, 1, 1, 1);
    } else if (style === 'heat' && data) {
      // data: pad → màu đào (đỏ) / đắp (xanh)
      for (let k = 0; k < g.h.length; k++) {
        if (!g.inside[k]) { col.setXYZ(k, 0.75, 0.78, 0.72); continue; }
        const d = g.h[k] - data.pad;
        const t = Math.min(1, Math.abs(d) / 4);
        if (d > 0) col.setXYZ(k, 0.95, 0.9 - t * 0.65, 0.85 - t * 0.7);
        else col.setXYZ(k, 0.85 - t * 0.7, 0.9 - t * 0.45, 0.98);
      }
    } else {
      for (let k = 0; k < g.h.length; k++) {
        const t = (H[k] - min) / Math.max(1e-9, max - min);
        const c = ramp(Math.max(0, Math.min(1, t)));
        const dim = g.inside[k] ? 1 : 0.82;
        col.setXYZ(k, c[0] * dim, c[1] * dim, c[2] * dim);
      }
    }
    col.needsUpdate = true;
    this.terrainMat.needsUpdate = true;
  }
  buildBoundary() {
    const pts = [];
    const b = SITE.boundary;
    for (let i = 0; i < b.length; i++) {
      const [x1, y1] = b[i], [x2, y2] = b[(i + 1) % b.length];
      const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4);
      for (let s = 0; s < n; s++) {
        const x = x1 + ((x2 - x1) * s) / n, y = y1 + ((y2 - y1) * s) / n;
        pts.push(P(x, y, heightAt(x, y) + 0.6));
      }
    }
    pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#dc2626', dashSize: 6, gapSize: 3, linewidth: 2 }));
    line.computeLineDistances();
    this.groups.boundary.add(line);
    // cọc mốc ranh giới
    for (const [x, y] of b) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
      m.position.copy(P(x, y, heightAt(x, y))).add(new THREE.Vector3(0, 3, 0));
      this.groups.boundary.add(m);
    }
  }
  buildTrees() {
    const obs = obstacles();
    const crownMats = ['#2f6b3a', '#3f7d3a', '#527d39'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.96 }));
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4f32', roughness: 1 });
    const shedMat = new THREE.MeshStandardMaterial({ color: '#8f969e', roughness: 0.85 });
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 1, 7);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const o of obs) {
      const base = P(o.x, o.y, heightAt(o.x, o.y));
      if (o.type === 'tree') {
        const g = new THREE.Group(), trunkH = Math.max(2.5, o.h * 0.38), crownY = trunkH + o.h * 0.28;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.scale.set(1, trunkH, 1); trunk.position.y = trunkH / 2;
        const crown = new THREE.Mesh(crownGeo, crownMats[Math.abs(Math.round(o.x + o.y)) % crownMats.length]); crown.scale.set(o.r * 0.95, o.h * 0.35, o.r * 0.95); crown.position.y = crownY;
        const crown2 = new THREE.Mesh(crownGeo, crown.material); crown2.scale.set(o.r * 0.7, o.h * 0.25, o.r * 0.7); crown2.position.set(o.r * 0.32, crownY + o.h * 0.18, -o.r * 0.18);
        trunk.castShadow = crown.castShadow = crown2.castShadow = true; g.add(trunk, crown, crown2); g.position.copy(base); this.groups.trees.add(g);
      } else {
        const m = new THREE.Mesh(box, shedMat); m.scale.set(8, 3.5, 6); m.position.copy(base).add(new THREE.Vector3(0, 1.75, 0)); m.castShadow = true; this.groups.trees.add(m);
      }
    }
  }
  buildContours(src = null) {
    this.groups.contours.clear();
    const segs = contours(1, src);
    const pos = [], col = [];
    const g = demGrid();
    for (const s of segs) {
      const hz = s.lv + 0.15;
      const a = P(s.a[0], s.a[1], hz), b = P(s.b[0], s.b[1], hz);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const c = s.lv % 5 === 0 ? [0.45, 0.25, 0.05] : [0.55, 0.42, 0.25];
      col.push(...c, ...c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.groups.contours.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true })));
  }

  // ---------- Đám mây điểm hiện trạng đa nguồn ----------
  buildCloud() {
    this.groups.cloud.clear();
    const r = rng(3);
    const obs = obstacles();
    const N = 60000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const order = [];
    const g = demGrid();
    for (let i = 0; i < N; i++) {
      let x = r() * SITE.W, y = r() * SITE.H, h = heightAt(x, y);
      let c = ramp((h - g.min) / (g.max - g.min));
      if (i % 9 === 0 && obs.length) {
        const o = obs[i % obs.length];
        const a = r() * 6.28, rr = r() * o.r;
        x = o.x + Math.cos(a) * rr; y = o.y + Math.sin(a) * rr;
        h = heightAt(x, y) + r() * o.h;
        c = o.type === 'tree' ? [0.15, 0.45 + r() * 0.2, 0.2] : [0.7, 0.7, 0.75];
      }
      h += (r() - 0.5) * 0.25; // nhiễu đo
      const v = P(x, y, h);
      pos.set([v.x, v.y, v.z], i * 3);
      col.set(c, i * 3);
      // thứ tự lộ ra theo tuyến bay zig-zag
      const lane = Math.floor(y / 40);
      order.push({ i, t: lane * 1000 + (lane % 2 ? SITE.W - x : x) });
    }
    order.sort((a, b) => a.t - b.t);
    const p2 = new Float32Array(N * 3), c2 = new Float32Array(N * 3);
    order.forEach((o, k) => { p2.set(pos.subarray(o.i * 3, o.i * 3 + 3), k * 3); c2.set(col.subarray(o.i * 3, o.i * 3 + 3), k * 3); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c2, 3));
    geo.setDrawRange(0, 0);
    this.cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: true }));
    this.groups.cloud.add(this.cloud);
    return N;
  }

  showFullCloud() {
    if (!this.cloud) this.buildCloud();
    this.cloud.geometry.setDrawRange(0, Infinity);
  }

  // ---------- Quy hoạch ----------
  buildPlan(plan, pad, progress = null) {
    const G = this.groups.plan;
    G.clear();
    if (!plan) return;
    const lvl = pad ?? demGrid().mean;
    const mats = {
      road: new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.9 }),
      res: new THREE.MeshStandardMaterial({ color: '#f1e3c6', roughness: 0.7 }),
      public: new THREE.MeshStandardMaterial({ color: '#f0a8a0', roughness: 0.7 }),
      green: new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 1 }),
      block: new THREE.MeshStandardMaterial({ color: '#e7dcc8', roughness: 1 }),
      lake: new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
      tree: new THREE.MeshStandardMaterial({ color: '#166534' }),
    };
    const y0 = (lvl - H0) * VEX;
    for (const r of plan.roads) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.x2 - r.x1, 0.5, r.y2 - r.y1), mats.road);
      const c = P((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, lvl);
      m.position.set(c.x, y0 + 0.3, c.z);
      m.receiveShadow = true;
      G.add(m);
    }
    const r = rng(77);
    for (const b of plan.blocks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.x2 - b.x1, 0.4, b.y2 - b.y1), b.use === 'green' ? mats.green : mats.block);
      const c = P((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, lvl);
      m.position.set(c.x, y0 + 0.45, c.z);
      m.receiveShadow = true;
      G.add(m);
      if (b.use === 'green') {
        const n = Math.round(b.area / 260);
        for (let i = 0; i < n; i++) {
          const tx = b.x1 + 4 + r() * (b.x2 - b.x1 - 8), ty = b.y1 + 4 + r() * (b.y2 - b.y1 - 8);
          const t = new THREE.Mesh(new THREE.SphereGeometry(2.4 + r() * 1.5, 7, 6), mats.tree);
          const p = P(tx, ty, lvl);
          t.position.set(p.x, y0 + 5, p.z);
          t.castShadow = true;
          G.add(t);
        }
      }
    }
    for (const l of plan.lakes) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 48), mats.lake);
      m.scale.set(l.rx, 1, l.ry);
      const p = P(l.cx, l.cy, lvl);
      m.position.set(p.x, y0 + 0.7, p.z);
      G.add(m);
    }
    const pmap = progress ? Object.fromEntries(progress.map((p) => [p.id, p])) : null;
    this.buildingMeshes = [];
    for (const b of plan.buildings) {
      const materialColors = { 'BT-C30': '#d8dde3', 'THEP-CB400': '#7c8794', 'GACH-AAC': '#ead4b5', 'KINH-ELOW': '#6da9c7' };
      let frac = 1, color = materialColors[b.materialCode] || (b.use === 'public' ? '#d99b8f' : '#e8e4da');
      if (pmap) {
        const p = pmap[b.id];
        frac = Math.max(0.02, p.actual);
        color = p.status === 'đúng' ? '#22c55e' : p.status === 'chậm' ? '#f59e0b' : p.status === 'chưa' ? '#cbd5e1' : '#ef4444';
      }
      const hgt = b.floors * b.fh * frac;
      const isGlass = b.materialCode === 'KINH-ELOW';
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, hgt, b.d), new THREE.MeshStandardMaterial({ color, roughness: isGlass ? 0.22 : 0.58, metalness: isGlass ? 0.16 : 0.02 }));
      const p = P(b.cx, b.cy, lvl);
      m.position.set(p.x, y0 + 0.6 + hgt / 2, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = b;
      G.add(m);
      if (!pmap) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.8, 0.7, b.d + 0.8), new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.75 }));
        roof.position.y = hgt / 2 + 0.35; roof.castShadow = true; m.add(roof);
      }
      // khung bóng mờ cho phần chưa thi công
      if (pmap && frac < 1) {
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.floors * b.fh, b.d), new THREE.MeshBasicMaterial({ color: '#64748b', wireframe: true, transparent: true, opacity: 0.25 }));
        ghost.position.set(p.x, y0 + 0.6 + (b.floors * b.fh) / 2, p.z);
        G.add(ghost);
      }
      // cửa sổ (sọc tầng)
      if (!pmap) {
        const lines = [];
        for (let f = 1; f < b.floors; f++) {
          const yy = -hgt / 2 + f * b.fh;
          lines.push(-b.w / 2, yy, b.d / 2 + 0.05, b.w / 2, yy, b.d / 2 + 0.05, -b.w / 2, yy, -b.d / 2 - 0.05, b.w / 2, yy, -b.d / 2 - 0.05);
        }
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
        const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#94a3b8' }));
        m.add(ls);
      }
    }
  }

  // ---------- Kịch bản BR-01 (lớp trình diễn L0, không phải kết quả kết cấu) ----------
  setBridgeTraffic(run = null) {
    const G = this.groups.scenario;
    G.clear();
    if (!run?.result || run.errorCode) return;
    const deckMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.8 });
    const concrete = new THREE.MeshStandardMaterial({ color: '#a8b1bb', roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(320, 4, 34), deckMat);
    deck.position.y = 22;
    G.add(deck);
    for (const x of [-110, 0, 110]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(12, 45, 18), concrete);
      pier.position.set(x, 0, 0);
      G.add(pier);
    }
    const lineMat = new THREE.LineBasicMaterial({ color: '#f8fafc' });
    for (const z of [-8.5, 8.5]) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-158, 24.2, z), new THREE.Vector3(158, 24.2, z),
      ]), lineMat);
      G.add(line);
    }
    const carGeo = new THREE.BoxGeometry(5.5, 2.2, 2.5);
    const carMats = ['#0ea5e9', '#f59e0b', '#22c55e', '#e2e8f0'].map((color) => new THREE.MeshStandardMaterial({ color }));
    const vehicles = [];
    const count = run.result.uniqueVehicleIds || 500;
    const visibleFraction = Math.max(0.01, Math.min(0.12, (run.result.peakOnBridge || 34) / count));
    for (let i = 0; i < count; i++) {
      const car = new THREE.Mesh(carGeo, carMats[i % carMats.length]);
      car.userData.vehicleId = `VEH-${String(i + 1).padStart(3, '0')}`;
      car.userData.offset = i / count;
      car.userData.lane = i % 2;
      car.visible = false;
      G.add(car);
      vehicles.push(car);
    }
    const started = performance.now();
    this._anim.push((now) => {
      if (!G.children.length) return false;
      const elapsed = ((now - started) / 15000) % 1;
      for (const car of vehicles) {
        const phase = (elapsed + car.userData.offset) % 1;
        car.visible = phase < visibleFraction;
        if (car.visible) {
          const u = phase / visibleFraction;
          car.position.set(-170 + u * 340, 25.5, car.userData.lane ? 8.5 : -8.5);
        }
      }
    });
  }

  // Hình học sandbox cho các nhóm kịch bản. Kích thước/mực nước/vùng giao nhau
  // lấy từ input của run L1; lớp này chỉ trực quan hóa kết quả screening.
  setScenarioVisualization(run = null) {
    if (run?.scenarioId === 'BR-01') { this.setBridgeTraffic(run); return; }
    const G = this.groups.scenario;
    G.clear();
    if (!run?.result || run.errorCode) return;
    const id = run.scenarioId, input = run.input || {};
    const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...opts });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(230, 64), mat('#a8b58b'));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1; ground.receiveShadow = true; G.add(ground);
    if (id.startsWith('BR-')) {
      const fake = { ...run, result: { ...run.result, uniqueVehicleIds: Math.min(120, Math.max(20, Math.round((input.grossMass || input.axleLoad || 60) * 2))), peakOnBridge: 12 } };
      this.setBridgeTraffic(fake);
      return;
    }
    if (id.startsWith('BD-')) {
      const glass = mat('#7cb5cf', { metalness: 0.15, roughness: 0.25 });
      const concrete = mat('#d8dde2');
      const floors = Math.max(8, Math.min(45, Math.round((input.height || 120) / 3.5)));
      for (let f = 0; f < floors; f++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(58, 1, 38), concrete); slab.position.y = f * 3.5; G.add(slab);
        const facade = new THREE.Mesh(new THREE.BoxGeometry(55, 2.7, 35), glass); facade.position.y = f * 3.5 + 1.8; facade.castShadow = true; G.add(facade);
      }
      if (id === 'BD-04') {
        for (let i = 0; i < 80; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), mat(i % 5 ? '#f59e0b' : '#ef4444')); p.position.set((i % 16 - 8) * 2.6, 1, (Math.floor(i / 16) - 2) * 3); G.add(p); }
      }
    } else if (id.startsWith('TU-')) {
      const wall = mat('#8b929a'), water = mat('#0ea5e9', { transparent: true, opacity: 0.62, roughness: 0.15 });
      const tunnel = new THREE.Mesh(new THREE.BoxGeometry(170, 35, 70), wall); tunnel.position.y = 12; G.add(tunnel);
      const voidMesh = new THREE.Mesh(new THREE.BoxGeometry(160, 28, 60), mat('#263544')); voidMesh.position.y = 14; G.add(voidMesh);
      const depth = Math.min(24, Math.max(1, (run.result.metrics?.find((m) => m.label.includes('Độ sâu'))?.value || input.groundwater || 4) * 8));
      const w = new THREE.Mesh(new THREE.BoxGeometry(158, depth, 58), water); w.position.y = depth / 2; G.add(w);
    } else if (id.startsWith('CS-')) {
      const craneMat = mat('#f59e0b');
      const addCrane = (x, r) => { const g = new THREE.Group(), mast = new THREE.Mesh(new THREE.BoxGeometry(3, 75, 3), craneMat), jib = new THREE.Mesh(new THREE.BoxGeometry(r, 2, 2), craneMat); mast.position.y = 37; jib.position.set(r / 2 - 8, 74, 0); g.add(mast, jib); g.position.x = x; G.add(g); return g; };
      const a = addCrane(-(input.craneDistance || 70) / 2, input.radiusA || 55), b = addCrane((input.craneDistance || 70) / 2, input.radiusB || 50);
      this._anim.push((time) => { if (!a.parent) return false; a.rotation.y = time / 6000; b.rotation.y = -time / 7200; });
      if (id === 'CS-02') { const stock = new THREE.Mesh(new THREE.BoxGeometry(35, 10, 28), mat('#64748b')); stock.position.set(0, 5, 0); G.add(stock); }
    } else if (id.startsWith('RD-')) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(360, 1.2, 42), mat('#424b55')); road.position.y = 1; road.receiveShadow = true; G.add(road);
      for (const z of [-10, 10]) { const line = new THREE.Mesh(new THREE.BoxGeometry(360, 0.15, 0.5), mat('#f8fafc')); line.position.set(0, 1.7, z); G.add(line); }
      for (let i = 0; i < 22; i++) { const truck = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 4), mat(i % 3 ? '#0ea5e9' : '#f97316')); truck.position.set(-170 + i * 16, 4, i % 2 ? -10 : 10); G.add(truck); }
      if (id === 'RD-02') { ground.rotation.z = -(input.slope || 30) * Math.PI / 180 * 0.28; }
    } else if (id === 'HY-01') {
      const dam = new THREE.Mesh(new THREE.BoxGeometry(24, 75, 270), mat('#9ca3af')); dam.position.set(70, 35, 0); dam.rotation.z = -0.08; G.add(dam);
      const water = new THREE.Mesh(new THREE.BoxGeometry(230, 7, 260), mat('#0284c7', { transparent: true, opacity: 0.7, roughness: 0.12 })); water.position.set(-55, 20 + Math.min(20, (run.result.metrics?.[1]?.value || 0) * 6), 0); G.add(water);
    } else if (id === 'UR-01') {
      const r = rngLocal(7);
      for (let i = 0; i < 70; i++) { const h = 6 + r() * 40, b = new THREE.Mesh(new THREE.BoxGeometry(10 + r() * 14, h, 10 + r() * 14), mat(i % 4 ? '#d6d3cc' : '#9fb7c9')); b.position.set((r() - 0.5) * 380, h / 2, (r() - 0.5) * 380); b.castShadow = true; G.add(b); }
      const lv = Math.min(14, Math.max(0.6, (run.result.metrics?.[1]?.value || 0.5) * 6));
      const w = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), mat('#2563eb', { transparent: true, opacity: 0.5, roughness: 0.1 })); w.rotation.x = -Math.PI / 2; w.position.y = lv; G.add(w);
    } else if (id === 'IN-01') {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(220, 35, 140), mat('#cbd5e1')); shed.position.y = 17; G.add(shed);
      const machine = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 24), mat('#1d4ed8')); machine.position.y = 8; G.add(machine);
      const amp = Math.min(2.5, run.result.metrics?.find((m) => m.label.includes('khuếch đại'))?.value / 4 || 0.3);
      this._anim.push((time) => { if (!machine.parent) return false; machine.position.x = Math.sin(time * 0.018) * amp; });
    }
  }

  // ---------- Nước ngập ----------
  setWater(level) {
    this.groups.water.clear();
    if (level == null) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SITE.W, SITE.H), new THREE.MeshStandardMaterial({ color: '#2563eb', transparent: true, opacity: 0.55, roughness: 0.1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = (level - H0) * VEX;
    this.groups.water.add(m);
  }
  animateWater(level, ms = 2000) {
    const g = demGrid();
    const from = g.min - 0.5;
    const t0 = performance.now();
    this.setWater(from);
    const m = this.groups.water.children[0];
    this._anim.push((t) => {
      const u = Math.min(1, (t - t0) / ms);
      m.position.y = (from + (level - from) * u - H0) * VEX;
      if (u >= 1) return false;
    });
  }

  // ---------- Cẩu tháp ----------
  setCranes(cranes, pad) {
    this.groups.cranes.clear();
    if (!cranes) return;
    const y0 = ((pad ?? demGrid().mean) - H0) * VEX;
    const yel = new THREE.MeshStandardMaterial({ color: '#f59e0b' });
    for (const c of cranes) {
      const p = P(c.x, c.y, pad ?? 0);
      const g = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 70, 2), yel);
      mast.position.y = 35;
      const jib = new THREE.Mesh(new THREE.BoxGeometry(c.r, 1.6, 1.6), yel);
      jib.position.set(c.r / 2 - 8, 70, 0);
      g.add(mast, jib);
      const ring = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.8, c.r, 64), new THREE.MeshBasicMaterial({ color: '#d97706', side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1.2;
      g.add(ring);
      g.position.set(p.x, y0, p.z);
      mast.castShadow = jib.castShadow = true;
      this.groups.cranes.add(g);
      const t0 = Math.random() * 1000;
      this._anim.push((t) => { if (!g.parent) return false; jib.parent.rotation.y = ((t + t0) / 9000) * Math.PI; });
    }
  }

  // ---------- Nắng / gió ----------
  setSun(hour, month) {
    const s = sunPos(hour, month);
    const alt = Math.max(2, s.alt) * (Math.PI / 180), az = s.az * (Math.PI / 180);
    const R = 500;
    this.sun.position.set(R * Math.cos(alt) * Math.sin(az), R * Math.sin(alt), -R * Math.cos(alt) * Math.cos(az));
    this.sun.intensity = s.alt > 0 ? 2.2 : 0.2;
    return s;
  }
  setWind(dirDeg, on) {
    this.groups.wind.clear();
    if (!on) return;
    const mat = new THREE.MeshBasicMaterial({ color: '#0ea5e9', transparent: true, opacity: 0.8 });
    const arrows = [];
    for (let i = 0; i < 24; i++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 8), mat);
      a.rotation.z = -Math.PI / 2;
      const g = new THREE.Group();
      g.add(a);
      g.position.set((Math.random() - 0.5) * SITE.W, 40 + Math.random() * 25, (Math.random() - 0.5) * SITE.H);
      g.rotation.y = -((dirDeg + 180 - 90) * Math.PI) / 180;
      this.groups.wind.add(g);
      arrows.push(g);
    }
    const rad = ((dirDeg + 180) * Math.PI) / 180; // hướng gió thổi tới
    const vx = Math.sin(rad), vz = -Math.cos(rad);
    this._anim.push(() => {
      if (!this.groups.wind.children.length) return false;
      for (const g of arrows) {
        g.position.x += vx * 1.4; g.position.z += vz * 1.4;
        if (Math.abs(g.position.x) > SITE.W / 2) g.position.x *= -0.98;
        if (Math.abs(g.position.z) > SITE.H / 2) g.position.z *= -0.98;
      }
    });
  }

  view(name) {
    const v = { iso: [-260, 260, 330], top: [0, 520, 1], south: [0, 120, 420], east: [460, 140, 0], bridge: [-260, 150, 260] }[name];
    this.camera.position.set(...v);
    this.controls.target.set(0, 0, 0);
  }
  screenshot() { return this.renderer.domElement.toDataURL('image/png'); }
  exportGLB() {
    return new Promise((resolve, reject) => {
      const root = new THREE.Group();
      ['terrain', 'plan', 'boundary'].forEach((k) => root.add(this.groups[k].clone()));
      new GLTFExporter().parse(root, (r) => resolve(new Blob([r], { type: 'model/gltf-binary' })), reject, { binary: true });
    });
  }
}
