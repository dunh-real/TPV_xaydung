// =====================================================================
// MOD-00 · Trình xem Bản đồ 3D toàn quốc → tỉnh/thành → công trình (Three.js)
// Nền GIS: ảnh vệ tinh/bản đồ Esri (tile Web Mercator, tải khi chạy) · công trình OSM ép khối theo mặt bằng thật
// Thay thế được bằng CesiumJS + 3D Tiles khi triển khai thật (D2 trong sổ tay).
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { designGroup } from './cad/view3d.js';
import { TENANTS, VN_OUTLINE, ISLANDS, natXY, HEIGHT_SOURCES } from '../data/nationwide.js';
import { EXTENT, ZONE_GRID, groundAt, pointInPolygon, zoneAt, inWater, landuseAt, distWater, ZONE_CLASSES, zoneStats, bridgeModel, siteModel, rectPts } from './citygen.js';

const MAT_COLORS = { glass: '#9cc3d9', concrete: '#dcd7cf', plaster: '#efe4cf', brick: '#cf9a7d', metal: '#a9b4bb' };
const WARD_PALETTE = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#818cf8', '#4ade80', '#e879f9', '#facc15', '#38bdf8', '#fca5a5', '#86efac', '#c4b5fd'];
const MODES = {
  day: { bg: '#b9d8ef', sun: '#fff6e5', sunI: 2.0, hemi: 1.05, pos: [0.5, 1, 0.35], ground: '#dfe4d8', emissive: 0, img: '#ffffff' },
  golden: { bg: '#f2c08c', sun: '#ffb469', sunI: 1.7, hemi: 0.65, pos: [-1, 0.28, 0.4], ground: '#e9d5b8', emissive: 0.05, img: '#ffe2bf' },
  night: { bg: '#0b1324', sun: '#9fb6ff', sunI: 0.35, hemi: 0.42, pos: [0.3, 1, -0.4], ground: '#2a3446', emissive: 0.45, img: '#4a5570' },
};
// ------------------------------------------------------------- nền tile Esri
export const BASEMAPS = {
  sat: { label: 'Ảnh vệ tinh', layers: ['World_Imagery'], attr: 'Ảnh: Esri, Maxar, Earthstar Geographics, GIS User Community' },
  hybrid: { label: 'Vệ tinh + nhãn', layers: ['World_Imagery', 'Reference/World_Boundaries_and_Places'], attr: 'Ảnh & nhãn: Esri, Maxar, Earthstar Geographics, HERE, Garmin' },
  street: { label: 'Bản đồ đường phố', layers: ['World_Street_Map'], attr: 'Bản đồ: Esri, HERE, Garmin, © OpenStreetMap contributors, GIS User Community' },
  topo: { label: 'Bản đồ địa hình', layers: ['World_Topo_Map'], attr: 'Bản đồ: Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors' },
  offline: { label: 'Ngoại tuyến (vẽ từ OSM)', layers: [], attr: 'Nền vẽ từ dữ liệu © OpenStreetMap contributors (ODbL) — không cần mạng' },
};
const tileURL = (svc, z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/${z}/${y}/${x}`;
const mercX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const mercY = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const loadImg = (url, ms = 15000) => new Promise((res) => {
  const im = new Image(); let done = false;
  const fin = (v) => { if (!done) { done = true; res(v); } };
  im.crossOrigin = 'anonymous'; im.onload = () => fin(im); im.onerror = () => fin(null);
  setTimeout(() => fin(null), ms); im.src = url;
});
// ghép tile thành 1 canvas; cập nhật dần qua onTile
async function mosaic({ lon0, lon1, lat0, lat1, z, layers, onTile, alive }) {
  const x0 = Math.floor(mercX(lon0, z)), x1 = Math.floor(mercX(lon1, z)), y0 = Math.floor(mercY(lat1, z)), y1 = Math.floor(mercY(lat0, z));
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1, cv = document.createElement('canvas');
  cv.width = nx * 256; cv.height = ny * 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#d9dfd2'; g.fillRect(0, 0, cv.width, cv.height);
  const jobs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push([x, y]);
  let ok = 0, fail = 0, k = 0;
  const worker = async () => {
    while (k < jobs.length && alive()) {
      const [x, y] = jobs[k++];
      const ims = await Promise.all(layers.map((l) => loadImg(tileURL(l, z, x, y))));
      if (!alive()) return;
      if (ims[0]) { ims.forEach((im) => im && g.drawImage(im, (x - x0) * 256, (y - y0) * 256)); ok++; } else fail++;
      onTile?.(ok, fail, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: 10 }, worker));
  return { canvas: cv, x0, y0, nx, ny, z, ok, fail, total: jobs.length };
}

// texture 1 module mặt đứng: tường + cửa sổ (ô góc trái để trơn cho mái)
const _fx = {};
function facadeTex(lit) {
  if (_fx[lit]) return _fx[lit];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = lit ? '#000' : '#fff'; g.fillRect(0, 0, 64, 64);
  if (!lit) { g.fillStyle = '#dcdcdc'; g.fillRect(0, 58, 64, 6); } // gờ sàn
  const gr = g.createLinearGradient(0, 12, 0, 50);
  if (lit) { gr.addColorStop(0, '#ffe7a3'); gr.addColorStop(1, '#ffb347'); } else { gr.addColorStop(0, '#8fa7bb'); gr.addColorStop(1, '#44576a'); }
  g.fillStyle = gr; g.fillRect(16, 12, 36, 38);
  if (!lit) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(16, 12, 36, 3); g.fillStyle = '#56626e'; g.fillRect(33, 12, 2, 38); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.magFilter = THREE.LinearFilter;
  return (_fx[lit] = t);
}
const ROOFS = ['#9b5b3e', '#8d99a6', '#c9c3b5', '#a8664a', '#7d8790'];
export class CityMap3D {
  constructor(el, cb = {}) {
    this.el = el; this.cb = cb;
    const w = el.clientWidth || 800, h = el.clientHeight || 560;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    this.labelBox = document.createElement('div');
    this.labelBox.className = 'map-labels';
    el.appendChild(this.labelBox);
    this.attrEl = document.createElement('div');
    this.attrEl.className = 'map-attr';
    el.appendChild(this.attrEl);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 80000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.screenSpacePanning = false;
    this.controls.listenToKeyEvents(window);
    this.controls.keyPanSpeed = 40;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6b7c5c', 1);
    this.sun = new THREE.DirectionalLight('#fff', 2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.labels = [];
    this.layers = { buildings: true, imagery: true, water: true, jrc: false, wards: true, wardfill: false, facilities: false, flood: false, trueScale: true, projects: true, planning: false, zoning: false, materialDetail: true };
    this.basemap = 'sat';
    this.colorMode = 'material';
    this.overlay = null;
    this.mode = 'day';
    this.vex = 1;
    this.selZone = null;
    this._anim = null; this._tour = null; this._draw = null; this._token = 0;
    this._bindPointer();
    this.controls.addEventListener('start', () => cb.onMove?.(true));
    this.controls.addEventListener('end', () => { cb.onMove?.(false); this._detailSoon(); });
    let lastAz = null, lastD = null;
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      if (this._anim) this._stepAnim(t);
      if (this.cars && this.level === 'city') this._moveCars(t);
      this.controls.update();
      this._sunFollow();
      this.renderer.render(this.scene, this.camera);
      this._updateLabels();
      const az = this.controls.getAzimuthalAngle(), d = this.camera.position.distanceTo(this.controls.target);
      if (az !== lastAz || Math.abs(d - (lastD || 0)) > 1) { lastAz = az; lastD = d; cb.onCamera?.({ azimuth: az, dist: d }); }
    };
    this._raf = requestAnimationFrame(loop);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(el);
    this.setMode('day');
  }

  _sunFollow() {
    if (!this._sunDir) return;
    const t = this.controls.target, d = this.level === 'city' ? Math.min(2500, Math.max(300, this.camera.position.distanceTo(t) * 1.2)) : 3000;
    this.sun.position.copy(t).addScaledVector(this._sunDir, 3000); this.sun.target.position.copy(t);
    const sc = this.sun.shadow.camera; if (sc.right !== d) { Object.assign(sc, { left: -d, right: d, top: d, bottom: -d, near: 100, far: 7000 }); sc.updateProjectionMatrix(); }
    this.sun.castShadow = this.level === 'city';
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  dispose() {
    this._token++; this._imgTok = (this._imgTok || 0) + 1;
    clearTimeout(this._dt);
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.controls.stopListenToKeyEvents();
    this.controls.dispose();
    this._clear();
    this._offTex?.dispose(); this._offTex = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // trả ngữ cảnh WebGL (tránh cạn bộ nhớ đồ họa khi chuyển trang nhiều lần)
    this.renderer.domElement.remove();
    this.labelBox.remove();
    this.attrEl.remove();
  }
  _clear() {
    this._token++;
    this.root.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.root.clear();
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
    this.pickables = [];
    this.bmesh = null; this.amesh = null; this.city = null; this.groups = {}; this.cars = null; this.provinceMeshes = {}; this.ground = null; this.bMat = null; this.overlayMesh = null; this.detail = null; this._detailKey = null;
  }
  _label(text, pos, cls = '') {
    const el = document.createElement('div');
    el.className = 'map-label ' + cls;
    el.textContent = text;
    this.labelBox.appendChild(el);
    const l = { el, pos: pos.clone(), group: null };
    this.labels.push(l);
    return l;
  }
  _updateLabels() {
    const w = this.el.clientWidth, h = this.el.clientHeight, v = new THREE.Vector3();
    for (const l of this.labels) {
      if (l.group && !this.groups[l.group]?.visible) { l.el.style.display = 'none'; continue; }
      v.copy(l.pos).project(this.camera);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-100%)`;
    }
  }
  _group(name) {
    const g = new THREE.Group();
    g.name = name;
    this.groups[name] = g;
    this.root.add(g);
    return g;
  }
  _gy(x, z) { return this.city ? groundAt(this.city.det, x, z) * this.vex : 0; }
  _status(o) { this.imgState = { ...(this.imgState || {}), ...o }; this.cb.onImagery?.(this.imgState); this._attr(); }
  _attr() {
    const bm = this.level === 'city' && this.imgState?.state === 'offline' ? BASEMAPS.offline : BASEMAPS[this.basemap];
    this.attrEl.textContent = (this.layers.imagery ? bm.attr + ' · ' : '') + (this.level === 'city' ? 'Công trình, ranh phường, thủy hệ: © OpenStreetMap contributors (ODbL) · DEM: SRTM/Terrarium' : 'Ranh minh họa — không phải ranh giới pháp lý');
  }

  // -------------------- Cảnh toàn quốc --------------------
  showNational(projectsByTenant = {}, selected = null) {
    this._clear();
    this.level = 'national';
    const tok = this._token;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#9cc9e6' }));
    sea.position.y = -2;
    this.root.add(sea);
    const shape = new THREE.Shape(VN_OUTLINE.map(([lon, lat]) => { const [x, z] = natXY(lon, lat); return new THREE.Vector2(x, -z); }));
    const land = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e7ecd9' }));
    this.root.add(land);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(VN_OUTLINE.map(([lon, lat]) => { const [x, z] = natXY(lon, lat); return new THREE.Vector3(x, 6.5, z); })), new THREE.LineBasicMaterial({ color: '#64748b' }));
    this.root.add(edge);
    // nền vệ tinh toàn quốc (z=7) — khi tải được thì thay khối đất minh họa
    if (this.layers.imagery && this.basemap !== 'offline') {
      const LON0 = 100.5, LON1 = 118, LAT0 = 7, LAT1 = 24;
      this._status({ state: 'loading', loaded: 0, total: 0 });
      mosaic({ lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1, z: 7, layers: BASEMAPS[this.basemap].layers, alive: () => tok === this._token, onTile: (ok, fail, total) => this._status({ state: 'loading', loaded: ok + fail, total }) }).then((m) => {
        if (tok !== this._token) return;
        if (m.ok < m.total * 0.5) { this._status({ state: 'offline', reason: 'Không tải được ảnh nền — dùng khối đất minh họa' }); return; }
        const [ax, az] = natXY(LON0, LAT1), [bx, bz] = natXY(LON1, LAT0);
        const geo = new THREE.PlaneGeometry(bx - ax, bz - az, 64, 64).rotateX(-Math.PI / 2).translate((ax + bx) / 2, 0, (az + bz) / 2);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) { const lon = 106 + p.getX(i) / 108, lat = 16 - p.getZ(i) / 111; uv.setXY(i, (mercX(lon, 7) - m.x0) / m.nx, 1 - (mercY(lat, 7) - m.y0) / m.ny); }
        const tex = new THREE.CanvasTexture(m.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const img = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
        img.position.y = 0.5;
        this.root.add(img);
        land.visible = false; edge.visible = false; sea.visible = false;
        this._status({ state: 'ready', loaded: m.ok, total: m.total });
      });
    }
    this.provinceMeshes = {};
    for (const t of TENANTS) {
      const [x, z] = natXY(t.lon, t.lat);
      const n = projectsByTenant[t.id] || 0;
      const hgt = 8 + n * 26;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, hgt, 24).translate(0, hgt / 2, 0),
        new THREE.MeshLambertMaterial({ color: t.id === selected ? '#f89b1a' : t.has3d ? '#076da5' : '#94a3b8' }));
      m.position.set(x, 6, z);
      m.userData = { type: 'province', id: t.id };
      this.root.add(m);
      this.pickables.push(m);
      this.provinceMeshes[t.id] = m;
      this._label(`${t.name}${n ? ` · ${n}` : ''}`, new THREE.Vector3(x, 6 + hgt + 6, z), t.has3d ? 'prov on' : 'prov');
    }
    for (const isl of ISLANDS) {
      const [x, z] = natXY(isl.lon, isl.lat);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 3, 16), new THREE.MeshLambertMaterial({ color: '#e7ecd9', transparent: true, opacity: 0.7 }));
      d.position.set(x, 1, z);
      this.root.add(d);
      this._label(isl.name, new THREE.Vector3(x, 8, z), 'isl');
    }
    this.home = () => this.flyTo(80, 0, 2300, 900, { tilt: 0.75 });
    this.camera.position.set(80, 1800, 1500);
    this.controls.target.set(80, 0, 0);
    this.controls.minDistance = 150; this.controls.maxDistance = 6000;
    this._attr();
  }
  selectProvince(id) {
    Object.entries(this.provinceMeshes || {}).forEach(([k, m]) => m.material.color.set(k === id ? '#f89b1a' : TENANTS.find((t) => t.id === k).has3d ? '#076da5' : '#94a3b8'));
  }

  // -------------------- Cảnh tỉnh/thành (LOD1 + ảnh nền) --------------------
  showCity(city) {
    this._clear();
    this.level = 'city';
    this.city = city;
    const det = city.det;
    this.vex = this.layers.trueScale ? 1 : 3;
    // địa hình DEM
    const SEG = 240, geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, SEG, SEG).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundAt(det, p.getX(i), p.getZ(i)) * this.vex);
    geo.computeVertexNormals();
    this._uvPlanar = geo.attributes.uv.array.slice();
    this.ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    this.ground.receiveShadow = true;
    this.ground.userData = { type: 'ground' };
    this._group('terrain').add(this.ground);
    // lớp phủ dán theo địa hình (ranh xã, ô quy hoạch, vùng đệm thủy hệ)
    const og = geo.clone(); og.setAttribute('uv', new THREE.Float32BufferAttribute(this._uvPlanar, 2));
    this.ovCanvas = document.createElement('canvas'); this.ovCanvas.width = this.ovCanvas.height = 2048;
    this.ovTex = new THREE.CanvasTexture(this.ovCanvas); this.ovTex.colorSpace = THREE.SRGBColorSpace; this.ovTex.anisotropy = 8;
    this.overlayMesh = new THREE.Mesh(og, new THREE.MeshBasicMaterial({ map: this.ovTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.overlayMesh.renderOrder = 2;
    this._group('overlay').add(this.overlayMesh);
    // mặt nước (lòng sông đã hạ theo lưới nước OSM)
    const wl = det.waterLevel;
    this.waterLevel = wl;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2f6fa8', transparent: true, opacity: 0.55, depthWrite: false }));
    water.position.y = wl * this.vex;
    this._group('water').add(water);
    this.waterMesh = water;
    this.groups.water.visible = this.layers.water;
    // ảnh nền
    this.setBasemap(this.basemap, true);
    // công trình OSM (ép khối theo mặt bằng)
    this.bMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: facadeTex(false), emissiveMap: facadeTex(true) });
    this._buildBuildings();
    this.recolor();
    // ranh xã/phường OSM (cắt theo khung cảnh)
    const wards = this._group('wards');
    const seg = [];
    for (const wd of city.wards) for (const r of wd.rings) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      if (Math.abs(a[0]) > EXTENT || Math.abs(a[1]) > EXTENT || Math.abs(b[0]) > EXTENT || Math.abs(b[1]) > EXTENT) continue;
      seg.push(a[0], this._gy(a[0], a[1]) + 2.5, a[1], b[0], this._gy(b[0], b[1]) + 2.5, b[1]);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    wards.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#c026d3' })));
    for (const wd of city.wards) { const l = this._label(wd.name, new THREE.Vector3(wd.cx, this._gy(wd.cx, wd.cz) + 60, wd.cz), 'ward'); l.group = 'wards'; }
    wards.visible = this.layers.wards;
    // cơ sở dịch vụ
    const fac = this._group('facilities');
    const FC = { school: '#2563eb', health: '#dc2626', service: '#16a34a' };
    for (const f of city.facilities.filter((q) => q.hasCoord)) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(9), new THREE.MeshLambertMaterial({ color: FC[f.type], emissive: FC[f.type], emissiveIntensity: 0.3 }));
      m.position.set(f.x, this._gy(f.x, f.z) + 32, f.z);
      m.userData = { type: 'facility', id: f.id };
      fac.add(m);
      this.pickables.push(m);
    }
    fac.visible = this.layers.facilities;
    if (city.bridge) this._bridge(city);
    if (city.site) this._site(city);
    // ghim dự án
    const pins = this._group('projects');
    for (const pr of city.projects.filter((q) => !q.bridge && !q.live)) {
      const y = this._gy(pr.x, pr.z);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 80, 8).translate(0, 40, 0), new THREE.MeshLambertMaterial({ color: '#f89b1a' }));
      const s = new THREE.Mesh(new THREE.SphereGeometry(13, 16, 12), new THREE.MeshLambertMaterial({ color: '#f89b1a', emissive: '#f89b1a', emissiveIntensity: 0.4 }));
      s.position.y = 86;
      const g = new THREE.Group();
      g.add(m, s);
      g.position.set(pr.x, y, pr.z);
      m.userData = s.userData = { type: 'project', id: pr.id };
      pins.add(g);
      this.pickables.push(m, s);
      const l = this._label(`📌 ${pr.id}`, new THREE.Vector3(pr.x, y + 118, pr.z), 'pin');
      l.group = 'projects';
    }
    this._group('flood').visible = false;
    this._group('shape');
    this._group('draw');
    this._drawOverlay();
    this.home = () => this.flyTo(det.center[0], det.center[1], 5200, 900, { tilt: 0.85 });
    this.controls.minDistance = 40; this.controls.maxDistance = 14000;
    this.camera.position.set(det.center[0] - 1800, 3600, det.center[1] + 3300);
    this.controls.target.set(det.center[0], 0, det.center[1]);
    this.setMode(this.mode);
  }

  // -------------------- ảnh nền & mảnh chi tiết --------------------
  setBasemap(key, initial = false) {
    this.basemap = key;
    if (this.level !== 'city') { if (!initial && this.level === 'national') this._attr(); return; }
    const tok = ++this._imgTok || (this._imgTok = 1);
    this._imgTok = tok;
    this._removeDetail();
    const geo = this.ground.geometry, det = this.city.det;
    if (!this.layers.imagery) { this._applyGroundTex(null); return; }
    if (key === 'offline') { this._useOffline('Đã chọn nền ngoại tuyến'); return; }
    const [o0, o1] = det.gis.origin, kx = 111320 * Math.cos((o1 * Math.PI) / 180);
    const lon = (x) => o0 + x / kx, lat = (z) => o1 - z / 110540;
    const M = EXTENT + 150, Z = 16;
    this._useOffline(null, true); // hiển thị tạm nền ngoại tuyến trong lúc tải
    this._status({ state: 'loading', loaded: 0, total: 0, basemap: key });
    let tex = null, mos = null;
    const sceneTok = this._token;
    mosaic({ lon0: lon(-M), lon1: lon(M), lat0: lat(M), lat1: lat(-M), z: Z, layers: BASEMAPS[key].layers, alive: () => tok === this._imgTok && sceneTok === this._token,
      onTile: (ok, fail, total) => { this._status({ state: 'loading', loaded: ok + fail, total, basemap: key }); if (tex && (ok + fail) % 12 === 0) tex.needsUpdate = true; } })
      .then((m) => {
        if (tok !== this._imgTok || sceneTok !== this._token) return;
        if (m.ok < m.total * 0.5) { this._useOffline(`Không tải được ảnh nền (${m.fail}/${m.total} tile lỗi) — đã chuyển nền ngoại tuyến vẽ từ OSM`); return; }
        mos = m;
        const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) { uv[i * 2] = (mercX(lon(p.getX(i)), Z) - m.x0) / m.nx; uv[i * 2 + 1] = 1 - (mercY(lat(p.getZ(i)), Z) - m.y0) / m.ny; }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        tex = new THREE.CanvasTexture(m.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        this._applyGroundTex(tex);
        this.imageryOnline = true;
        this._status({ state: 'ready', loaded: m.ok, total: m.total, basemap: key, zoom: Z, mpp: (156543.03 * Math.cos((o1 * Math.PI) / 180)) / 2 ** Z });
        this._detailSoon();
      });
    this._mos = () => mos;
  }
  _applyGroundTex(tex) {
    const m = this.ground.material;
    if (m.map && m.map !== tex && m.map !== this._offTex) m.map.dispose();
    m.map = tex; m.needsUpdate = true;
    this.setMode(this.mode);
  }
  _useOffline(reason, temp = false) {
    if (this._offTex && this._offCity !== this.city) { this._offTex.dispose(); this._offTex = null; }
    if (!this._offTex) { this._offCity = this.city; this._offTex = new THREE.CanvasTexture(this.city._offCanvas || (this.city._offCanvas = this._offlineCanvas(this.city))); this._offTex.colorSpace = THREE.SRGBColorSpace; this._offTex.anisotropy = 8; }
    this.ground.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this._uvPlanar, 2));
    this._applyGroundTex(this._offTex);
    this.imageryOnline = false;
    if (!temp) this._status({ state: 'offline', reason, basemap: this.basemap });
  }
  _offlineCanvas(city) {
    const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), k = S / (EXTENT * 2), X = (v) => (v + EXTENT) * k, gis = city.gis;
    const LC = { 0: '#ece8df', 1: '#efe3d0', 2: '#f4d6cf', 3: '#e2dbe8', 4: '#cfe5c3', 5: '#f3e0e6', 7: '#ebe2c8', 8: '#e4eccb', 9: '#d5e3cf', 10: '#dfe1e3' };
    const ls = gis.lcell * k;
    for (let r = 0; r < gis.ln; r++) for (let q = 0; q < gis.ln; q++) { g.fillStyle = LC[gis.land[r * gis.ln + q]] || LC[0]; g.fillRect(q * ls, r * ls, ls + 0.6, ls + 0.6); }
    g.fillStyle = '#9ec5e8'; const ws = gis.wcell * k;
    for (let r = 0; r < gis.wn; r++) for (let q = 0; q < gis.wn; q++) if (gis.water[r * gis.wn + q]) g.fillRect(q * ws, r * ws, ws + 0.6, ws + 0.6);
    const W = { motorway: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3.2, motorway_link: 3, trunk_link: 3, primary_link: 3, residential: 1.6, unclassified: 1.6, living_street: 1.2 };
    g.lineCap = g.lineJoin = 'round';
    for (const pass of [0, 1]) for (const r of gis.roads) {
      const w = (W[r.cls] || 1.4) * (pass ? 1 : 1.5);
      g.strokeStyle = pass ? (['motorway', 'trunk', 'primary'].includes(r.cls) ? '#f9d48b' : '#ffffff') : '#c9c2b6';
      g.lineWidth = w; g.beginPath(); r.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z)))); g.stroke();
    }
    g.fillStyle = '#cdc4b8'; g.strokeStyle = '#a99f92'; g.lineWidth = 0.5;
    for (let i = 0; i < city.baseCount; i++) { const b = city.buildings[i]; g.beginPath(); b._base.pts.forEach(([x, z], j) => (j ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z)))); g.closePath(); g.fill(); g.stroke(); }
    return c;
  }
  _detailSoon() { clearTimeout(this._dt); this._dt = setTimeout(() => this._detail(), 350); }
  _removeDetail() { if (this.detail) { this.detail.geometry.dispose(); this.detail.material.map?.dispose(); this.detail.material.dispose(); this.detail.removeFromParent(); this.detail = null; } this._detailKey = null; }
  // mảnh ảnh độ phân giải cao (z18 ≈ 0,6 m/pixel) quanh tâm nhìn khi phóng gần
  _detail() {
    if (!this.city || !this.ground) return;
    if (this.level !== 'city' || !this.imageryOnline || !this.layers.imagery || this.basemap === 'offline') return;
    const t = this.controls.target, dist = this.camera.position.distanceTo(t);
    if (dist > 1500) { if (this.detail) this.detail.visible = false; return; }
    const SIDE = 1100, cx = Math.round(t.x / 300) * 300, cz = Math.round(t.z / 300) * 300, key = `${this.basemap}:${cx}:${cz}`;
    if (this.detail) this.detail.visible = true;
    if (key === this._detailKey) return;
    this._detailKey = key;
    const det = this.city.det, [o0, o1] = det.gis.origin, kx = 111320 * Math.cos((o1 * Math.PI) / 180), Z = 18;
    const lon = (x) => o0 + x / kx, lat = (z) => o1 - z / 110540, h = SIDE / 2;
    const tok = this._imgTok, sceneTok = this._token;
    this._status({ detail: 'loading' });
    mosaic({ lon0: lon(cx - h), lon1: lon(cx + h), lat0: lat(cz + h), lat1: lat(cz - h), z: Z, layers: BASEMAPS[this.basemap].layers, alive: () => key === this._detailKey && tok === this._imgTok && sceneTok === this._token })
      .then((m) => {
        if (key !== this._detailKey || tok !== this._imgTok || sceneTok !== this._token || m.ok < m.total * 0.6) { if (key === this._detailKey) this._status({ detail: 'fail' }); return; }
        const geo = new THREE.PlaneGeometry(SIDE, SIDE, 60, 60).rotateX(-Math.PI / 2).translate(cx, 0, cz);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) { p.setY(i, this._gy(p.getX(i), p.getZ(i)) + 0.05); uv.setXY(i, (mercX(lon(p.getX(i)), Z) - m.x0) / m.nx, 1 - (mercY(lat(p.getZ(i)), Z) - m.y0) / m.ny); }
        geo.computeVertexNormals();
        const tex = new THREE.CanvasTexture(m.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const mat = new THREE.MeshLambertMaterial({ map: tex, color: this.ground.material.color.clone(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const old = this.detail;
        this.detail = new THREE.Mesh(geo, mat);
        this.detail.userData = { type: 'ground' };
        this.groups.terrain.add(this.detail);
        if (old) { old.geometry.dispose(); old.material.map?.dispose(); old.material.dispose(); old.removeFromParent(); }
        this._status({ detail: 'ready', detailZoom: Z });
      });
  }

  // -------------------- lớp phủ dán địa hình --------------------
  _drawOverlay() {
    if (!this.ovCanvas || !this.city) return;
    const c = this.city, S = this.ovCanvas.width, g = this.ovCanvas.getContext('2d'), k = S / (EXTENT * 2), X = (v) => (v + EXTENT) * k;
    g.clearRect(0, 0, S, S);
    let any = false;
    const path = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z)))); g.closePath(); };
    if (this.layers.jrc) {
      any = true; g.fillStyle = 'rgba(34,211,238,0.45)'; const gis = c.gis, ws = gis.wcell * k;
      for (let r = 0; r < gis.wn; r++) for (let q = 0; q < gis.wn; q++) { const d = gis.dist[r * gis.wn + q]; if (d > 0 && d <= 80) g.fillRect(q * ws, r * ws, ws + 0.6, ws + 0.6); }
    }
    if (this.layers.wardfill) { any = true; g.globalAlpha = 0.33; for (const wd of c.wards) { g.fillStyle = this.wardColors?.[wd.idx] || WARD_PALETTE[wd.idx % 16]; for (const r of wd.rings) { path(r); g.fill(); } } g.globalAlpha = 1; }
    if ((this.layers.zoning || this.layers.planning) && c.zoneLab) {
      any = true;
      const fail = new Set(c.zones.filter((z) => zoneStats(c, z.idx).fail).map((z) => z.idx)), lab = c.zoneLab, n = ZONE_GRID.n, cs = S / n;
      for (let i = 0; i < n * n; i++) { const z = lab[i]; if (z < 0) continue; g.fillStyle = ZONE_CLASSES[c.zones[z].cls].color + (c.zones[z].cls === 'MN' ? '40' : '88'); g.fillRect((i % n) * cs, Math.floor(i / n) * cs, cs + 0.5, cs + 0.5); }
      // gạch chéo lô vượt chỉ tiêu
      const fp = new Path2D(); for (let i = 0; i < n * n; i++) if (fail.has(lab[i])) fp.rect((i % n) * cs, Math.floor(i / n) * cs, cs + 0.5, cs + 0.5);
      g.save(); g.clip(fp); g.strokeStyle = 'rgba(220,38,38,0.85)'; g.lineWidth = 2; g.beginPath(); for (let d = -S; d < S; d += 10) { g.moveTo(d, 0); g.lineTo(d + S, S); } g.stroke(); g.restore();
      // ranh lô: cạnh giữa 2 ô khác lô
      const edge = (sel, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) { const a = lab[r * n + q]; if (a < 0) continue; if (q + 1 < n) { const b = lab[r * n + q + 1]; if (b !== a && (!sel || sel(a) !== sel(b))) { g.moveTo((q + 1) * cs, r * cs); g.lineTo((q + 1) * cs, (r + 1) * cs); } } if (r + 1 < n) { const b = lab[(r + 1) * n + q]; if (b !== a && (!sel || sel(a) !== sel(b))) { g.moveTo(q * cs, (r + 1) * cs); g.lineTo((q + 1) * cs, (r + 1) * cs); } } } g.stroke(); };
      edge(null, 'rgba(255,255,255,0.8)', 1);
      edge((z) => fail.has(z), '#dc2626', 2.5);
      if (this.selZone != null) edge((z) => z === this.selZone, '#1d4ed8', 5);
    }
    this.overlayMesh.visible = any;
    this.ovTex.needsUpdate = true;
  }
  setZoneSel(i) { this.selZone = i; this._drawOverlay(); }

  // -------------------- công trình ép khối --------------------
  _triangulate(pts) {
    const v = pts.map(([x, z]) => new THREE.Vector2(x, z));
    let t = THREE.ShapeUtils.triangulateShape(v, []);
    if (!t.length) t = pts.slice(2).map((_, i) => [0, i + 1, i + 2]);
    return t;
  }
  _vcount(b) { if (!b._tri) b._tri = this._triangulate(b._base ? b._base.pts : b.pts); return b._tri.length * 3 + b.pts.length * 6; }
  _write(b, P, N, o, U) {
    const n0 = o;
    if (b.deleted || !this.layers.buildings) { for (let k = 0; k < this._vcount(b); k++) { P[o * 3] = b.x; P[o * 3 + 1] = -500; P[o * 3 + 2] = b.z; N[o * 3 + 1] = 1; o++; } return o - n0; }
    const y0 = b.ground * this.vex - 0.4, y1 = y0 + Math.max(2.5, b.h) * (this.vex > 1 ? 1.5 : 1), pts = b.pts;
    let uu = 0.02, vv = 0.5;
    const put = (x, y, z, nx, ny, nz) => { P[o * 3] = x; P[o * 3 + 1] = y; P[o * 3 + 2] = z; N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz; if (U) { U[o * 2] = uu; U[o * 2 + 1] = vv; } o++; };
    const fh = (y1 - y0) / Math.max(1, b.floors || b.estFloors || Math.round(b.h / 3.3)); // chiều cao 1 tầng hiển thị
    for (const [a, bb, cc] of b._tri) { put(pts[a][0], y1, pts[a][1], 0, 1, 0); put(pts[cc][0], y1, pts[cc][1], 0, 1, 0); put(pts[bb][0], y1, pts[bb][1], 0, 1, 0); }
    // hướng mái phải lên trên: kiểm tra pháp tuyến tam giác đầu
    if (b._tri.length) { const i = (n0) * 3, ax = P[i + 3] - P[i], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], bz = P[i + 8] - P[i + 2]; if (az * bx - ax * bz < 0) for (let t = 0; t < b._tri.length; t++) { const j = (n0 + t * 3) * 3; for (let q = 0; q < 3; q++) { const tmp = P[j + 3 + q]; P[j + 3 + q] = P[j + 6 + q]; P[j + 6 + q] = tmp; } } }
    // chiều pháp tuyến ra ngoài: thử 1 điểm lệch khỏi cạnh đầu
    let sgn = 1;
    { const [ax, az] = pts[0], [bx, bz] = pts[1 % pts.length], L = Math.hypot(bx - ax, bz - az) || 1, mx = (ax + bx) / 2 + ((bz - az) / L) * 0.3, mz = (az + bz) / 2 - ((bx - ax) / L) * 0.3; if (pointInPolygon(mx, mz, pts)) sgn = -1; }
    const vt = (y1 - y0) / fh;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      let nx = (bz - az) * sgn, nz = -(bx - ax) * sgn; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
      const nw = Math.max(1, Math.round(L / 3.2)); // số module cửa sổ trên cạnh
      const P0 = () => { uu = 0; }, P1 = () => { uu = nw; };
      P0(); vv = 0; put(ax, y0, az, nx, 0, nz); P1(); put(bx, y0, bz, nx, 0, nz); vv = vt; put(bx, y1, bz, nx, 0, nz);
      P0(); vv = 0; put(ax, y0, az, nx, 0, nz); P1(); vv = vt; put(bx, y1, bz, nx, 0, nz); P0(); put(ax, y1, az, nx, 0, nz);
    }
    return o - n0;
  }
  _mesh(list) {
    let total = 0;
    const ranges = new Map();
    for (const b of list) { const n = this._vcount(b); ranges.set(b.i, [total, n]); total += n; }
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3), UV = new Float32Array(total * 2), owner = new Int32Array(total / 3);
    for (const b of list) { const [s, n] = ranges.get(b.i); this._write(b, P, N, s, UV); owner.fill(b.i, s / 3, (s + n) / 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.bMat);
    m.castShadow = m.receiveShadow = true;
    m.userData = { type: 'building', owner, ranges };
    return m;
  }
  _buildBuildings() {
    const grp = this.groups.buildings || this._group('buildings');
    const c = this.city;
    if (!this.bmesh) {
      this.bmesh = this._mesh(c.buildings.slice(0, c.baseCount));
      grp.add(this.bmesh); this.pickables.push(this.bmesh);
    }
    this._rebuildAdded();
    grp.visible = this.layers.buildings;
  }
  _rebuildAdded() {
    const c = this.city, grp = this.groups.buildings;
    if (this.amesh) { this.pickables = this.pickables.filter((o) => o !== this.amesh); this.amesh.geometry.dispose(); this.amesh.removeFromParent(); this.amesh = null; }
    const add = c.buildings.slice(c.baseCount);
    add.forEach((b) => (b._tri = null));
    if (add.length) { this.amesh = this._mesh(add); grp.add(this.amesh); this.pickables.push(this.amesh); }
  }
  // cập nhật hình học 1 công trình (sau biên tập) — tại chỗ, không dựng lại cả lưới
  updateBuilding(i) {
    const c = this.city;
    if (!c || !this.bmesh) return;
    if (i >= c.baseCount) { this._rebuildAdded(); this.recolor(); return; }
    const g = this.bmesh.geometry, [s] = this.bmesh.userData.ranges.get(i);
    this._write(c.buildings[i], g.attributes.position.array, g.attributes.normal.array, s, g.attributes.uv.array);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    g.computeBoundingSphere();
    this.recolor();
    this._drawOverlay();
  }
  refreshAll() { // sau khi nạp phương án
    const c = this.city;
    if (!c) return;
    const g = this.bmesh.geometry;
    for (let i = 0; i < c.baseCount; i++) this._write(c.buildings[i], g.attributes.position.array, g.attributes.normal.array, this.bmesh.userData.ranges.get(i)[0], g.attributes.uv.array);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.computeBoundingSphere();
    this._rebuildAdded();
    this.groups.bridge && this._bridge(c);
    this.groups.site && this._site(c);
    this.recolor(); this._drawOverlay();
  }

  // -------------------- cầu BR-01 theo tham số --------------------
  _bridge(city) {
    const br = city.bridge, g = this.groups.bridge || this._group('bridge');
    this.pickables = this.pickables.filter((o) => o.userData.type !== 'bridge');
    g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    g.clear();
    if (this._brLabel) { this._brLabel.el.remove(); this.labels = this.labels.filter((l) => l !== this._brLabel); }
    const wl = this.waterLevel, model = bridgeModel(br, wl), deckY = model.deckY * this.vex;
    const L = br.length, a = br.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
    const at = (t) => [br.x + ca * t, br.z + sa * t];
    const g0 = this._gy(...at(-L / 2)), g1 = this._gy(...at(L / 2)), main = Math.min(L - 40, br.span || L * 0.7);
    // trắc dọc: phần vượt sông nằm ngang ở cao độ tĩnh không, hai đầu dốc về mặt đất
    const prof = (t) => { const m = main / 2; if (Math.abs(t) <= m) return deckY; const f = (Math.abs(t) - m) / (L / 2 - m); return deckY + ((t < 0 ? g0 : g1) + 1.2 - deckY) * Math.min(1, f); };
    const NS = 48, P = [], idx = [];
    const ribbon = (off, w, th, y0) => {
      const base = P.length / 3;
      for (let k = 0; k <= NS; k++) { const t = -L / 2 + (k / NS) * L, y = prof(t) + y0; for (const [v, dy] of [[-w / 2, 0], [w / 2, 0], [w / 2, -th], [-w / 2, -th]]) P.push(t, y + dy, off + v); }
      for (let k = 0; k < NS; k++) { const q = base + k * 4, r = q + 4; for (const [i0, i1] of [[0, 1], [1, 2], [2, 3], [3, 0]]) idx.push(q + i0, r + i0, r + i1, q + i0, r + i1, q + i1); }
    };
    ribbon(0, br.width, 1.8, 0);
    ribbon(-br.width / 2 + 0.3, 0.5, -1.1, 1.1); ribbon(br.width / 2 - 0.3, 0.5, -1.1, 1.1);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); dg.setIndex(idx); dg.computeVertexNormals();
    const grp = new THREE.Group(); grp.position.set(0, 0, 0);
    const deck = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ color: '#e5e7eb', side: THREE.DoubleSide }));
    const local = new THREE.Group(); local.add(deck);
    // trụ cầu (2 cột + xà mũ) trong phần vượt sông
    const piers = Math.max(0, br.spans - 1), pm = new THREE.MeshLambertMaterial({ color: '#94a3b8' });
    for (let k = 1; k <= piers; k++) {
      const t = -main / 2 + (k * main) / br.spans, [px, pz] = at(t), bed = this._gy(px, pz) - 3, hgt = prof(t) - 1.8 - bed;
      for (const s of [-1, 1]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, hgt, 14), pm); col.position.set(t, bed + hgt / 2, s * br.width * 0.28); local.add(col); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, br.width + 2), pm); cap.position.set(t, prof(t) - 2.9, 0); local.add(cap);
    }
    for (const s of [-1, 1]) { const t = s * (main / 2), ab = new THREE.Mesh(new THREE.BoxGeometry(6, Math.max(2, deckY - this._gy(...at(t))), br.width + 3), new THREE.MeshLambertMaterial({ color: '#a3a3a3' })); ab.position.set(t, (deckY + this._gy(...at(t))) / 2 - 1, 0); local.add(ab); }
    local.rotation.y = -a; local.position.set(br.x, 0, br.z);
    grp.add(local);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(L + 20, 60, Math.max(60, br.width * 3)), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, deckY, 0); local.add(hit);
    grp.traverse((m) => { if (m.isMesh) { m.userData = { type: 'bridge', id: 'BR-01' }; this.pickables.push(m); } });
    g.add(grp);
    this.cars = [];
    const lanes = Math.max(1, br.lanes || 2);
    for (let i = 0; i < 14; i++) { const cmesh = new THREE.Mesh(new THREE.BoxGeometry(i % 4 ? 4.6 : 11, 2.4, 2.2), new THREE.MeshLambertMaterial({ color: i % 4 ? '#ef4444' : '#334155' })); cmesh.userData = { type: 'bridge', id: 'BR-01', off: i / 14, lane: i % lanes }; local.add(cmesh); this.cars.push(cmesh); }
    this._prof = prof; this._brL = L; this._brW = br.width; this._lanes = lanes;
    this._brLabel = this._label(`🌉 Cầu BR-01 · ${Math.round(L)} m · ${br.spans} nhịp (mô hình kiểm thử)`, new THREE.Vector3(br.x, deckY + 60, br.z), 'pin hot');
  }
  _moveCars(t) {
    if (!this._prof) return;
    const L = this._brL, lw = this._brW / this._lanes;
    this.cars.forEach((c) => { const f = (c.userData.off + t / 26000) % 1, dir = c.userData.lane < this._lanes / 2 ? 1 : -1, k = dir > 0 ? f : 1 - f, x = -L / 2 + k * L; c.position.set(x, this._prof(x) + 1.3, -this._brW / 2 + lw * (c.userData.lane + 0.5)); });
  }
  // -------------------- khu đất DA-2026-017 theo tham số --------------------
  _site(city) {
    const st = city.site, g = this.groups.site || this._group('site');
    this.pickables = this.pickables.filter((o) => o.userData.type !== 'site');
    g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    g.clear();
    if (this._siteLabel) { this._siteLabel.el.remove(); this.labels = this.labels.filter((l) => l !== this._siteLabel); }
    const m = siteModel(city, st), pad = m.pad * this.vex;
    const pts = rectPts(st.x, st.z, st.w, st.d).map(([x, z]) => new THREE.Vector3(x, Math.max(pad, this._gy(x, z)) + 1.5, z));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f97316' })));
    // mặt san nền hiển thị không thấp hơn địa hình cao nhất trong khu (khối lượng đào/đắp vẫn tính theo cao độ san nền)
    let gmax = -Infinity; for (let u = -st.w / 2; u <= st.w / 2; u += 20) for (let v = -st.d / 2; v <= st.d / 2; v += 20) gmax = Math.max(gmax, this._gy(st.x + u, st.z + v));
    const top = Math.max(pad, gmax + 0.3), slabH = Math.max(0.6, top - (m.groundMean * this.vex - 1));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(st.w, slabH, st.d), new THREE.MeshLambertMaterial({ color: '#e7c9a0', transparent: true, opacity: 0.85 }));
    slab.position.set(st.x, top - slabH / 2, st.z);
    slab.userData = { type: 'site', id: 'DA-2026-017' };
    g.add(slab); this.pickables.push(slab);
    const cols = Math.max(1, Math.round(Math.sqrt((st.blocks * st.w) / st.d))), rows = Math.ceil(st.blocks / cols);
    const col = m.fail ? '#f87171' : '#fdba74', H = st.floors * 3.3;
    // sa bàn: thay khối hộp bằng mô hình thiết kế CAD (cùng vị trí, tỉ lệ thật)
    const sb = this.sanban ? designGroup(this.sanban.st, this.sanban.b, { progress: this.sanban.progress }) : null;
    for (let i = 0; i < st.blocks; i++) {
      const cx = st.x - st.w / 2 + ((i % cols) + 0.5) * (st.w / cols), cz = st.z - st.d / 2 + (Math.floor(i / cols) + 0.5) * (st.d / rows);
      if (sb) { const m = i ? sb.clone() : sb; m.position.set(cx, top, cz); m.rotation.y = ((this.sanban.rot || 0) * Math.PI) / 180; m.traverse((o) => { if (o.isMesh) { o.userData = { type: 'site', id: 'DA-2026-017' }; this.pickables.push(o); } }); g.add(m); continue; }
      const b = new THREE.Mesh(new THREE.BoxGeometry(st.bw, H, st.bd).translate(0, H / 2, 0), new THREE.MeshLambertMaterial({ color: col }));
      b.position.set(cx, top, cz);
      b.userData = { type: 'site', id: 'DA-2026-017' };
      g.add(b); this.pickables.push(b);
    }
    this._siteLabel = this._label(sb ? `🏗 Sa bàn DA-2026-017 · ${st.blocks} khối × ${this.sanban.b.storeys} tầng${sb.userData.built < sb.userData.N ? ` · đang thi công ${sb.userData.built}/${sb.userData.N} tầng` : ''}${m.fail ? ' · ⚠ vượt chỉ tiêu' : ''}` : `📍 DA-2026-017 · ${st.blocks} khối × ${st.floors} tầng${m.fail ? ' · ⚠ vượt chỉ tiêu' : ''}`, new THREE.Vector3(st.x, top + (sb ? sb.userData.H : H) + 50, st.z), 'pin hot');
  }

  setSanban(spec) { this.sanban = spec; if (this.city?.site && this.groups.site) this._site(this.city); }
  // -------------------- Màu, lớp, chế độ --------------------
  _colorOf(b) {
    if (this.overlay && this.overlay.has(b.i)) return this.overlay.get(b.i);
    if (this.overlay && this.overlayDim) return '#d6dbe0';
    if (this.colorMode === 'edit') return b.added ? '#16a34a' : b.edited ? '#e11d48' : '#d4d4d4';
    if (this.colorMode === 'heightSource') return HEIGHT_SOURCES[b.src].color;
    if (this.colorMode === 'ward') return WARD_PALETTE[b.ward % 16];
    if (this.colorMode === 'zone') return ZONE_CLASSES[this.city.zones[b.zone].cls].color;
    if (this.colorMode === 'gray') return '#b8bec4';
    if (b.src === 'PLAN') return '#fb7185';
    return this.layers.materialDetail ? MAT_COLORS[b.mat] : '#d9d6cf';
  }
  recolor() {
    if (!this.bmesh) return;
    const c = new THREE.Color(), night = this.mode === 'night';
    for (const mesh of [this.bmesh, this.amesh].filter(Boolean)) {
      const C = mesh.geometry.attributes.color.array;
      for (const [i, [s, n]] of mesh.userData.ranges) {
        const b = this.city.buildings[i];
        c.set(this._colorOf(b));
        const roofC = !this.overlay && this.colorMode === 'material' && b.h < 16 && b.src !== 'PLAN' ? ROOFS[(b.i * 7919) % ROOFS.length] : null;
        if (night && !(this.overlay && this.overlay.has(i))) c.multiplyScalar(0.55);
        const nr = b._tri ? b._tri.length * 3 : 0, rc = roofC ? new THREE.Color(roofC).multiplyScalar(night ? 0.5 : 1) : null;
        for (let k = 0; k < n; k++) { const o = (s + k) * 3; if (k < nr && rc) { C[o] = rc.r; C[o + 1] = rc.g; C[o + 2] = rc.b; continue; } const f = k < nr ? 1.06 : 0.97; C[o] = Math.min(1, c.r * f); C[o + 1] = Math.min(1, c.g * f); C[o + 2] = Math.min(1, c.b * f); }
      }
      mesh.geometry.attributes.color.needsUpdate = true;
    }
  }
  setColorMode(m) { this.colorMode = m; this.recolor(); }
  setOverlay(map, dim = true) { this.overlay = map && map.size ? map : null; this.overlayDim = dim; this.recolor(); }
  setLayer(name, on) {
    this.layers[name] = on;
    if (name === 'planning' || name === 'zoning') this.layers.zoning = this.layers.planning = on;
    if (this.level !== 'city') return;
    if (name === 'imagery') { if (on) this.setBasemap(this.basemap); else { this._removeDetail(); this._applyGroundTex(null); this._attr(); } }
    else if (name === 'trueScale') { const c = this.controls.target.clone(), p = this.camera.position.clone(); this.showCity(this.city); this.controls.target.copy(c); this.camera.position.copy(p); this.recolor(); }
    else if (name === 'materialDetail') this.recolor();
    else if (['wardfill', 'zoning', 'planning', 'jrc'].includes(name)) this._drawOverlay();
    else if (this.groups[name]) this.groups[name].visible = on;
  }
  setMode(mode) {
    this.mode = mode;
    const M = MODES[mode];
    this.scene.background = new THREE.Color(M.bg);
    this.scene.fog = new THREE.Fog(M.bg, 9000, 26000);
    this.sun.color.set(M.sun); this.sun.intensity = M.sunI; this.hemi.intensity = M.hemi;
    this._sunDir = new THREE.Vector3(...M.pos).normalize();
    this._sunFollow();
    if (this.bMat) { this.bMat.emissive = new THREE.Color(mode === 'night' ? '#ffd27a' : '#000000'); this.bMat.emissiveIntensity = M.emissive; }
    if (this.ground) this.ground.material.color.set(this.ground.material.map ? M.img : M.ground);
    if (this.detail) this.detail.material.color.set(M.img);
    this.recolor();
  }
  setFlood(level) {
    const g = this.groups.flood;
    if (!g) return;
    g.clear();
    if (level == null) { g.visible = false; return; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2563eb', transparent: true, opacity: 0.42, depthWrite: false }));
    m.position.y = level * this.vex;
    g.add(m);
    g.visible = true;
  }
  _line(pts, color, closed = true) {
    const v = pts.map(([x, z]) => new THREE.Vector3(x, this._gy(x, z) + 4, z));
    return new (closed ? THREE.LineLoop : THREE.Line)(new THREE.BufferGeometry().setFromPoints(v), new THREE.LineBasicMaterial({ color, depthTest: false }));
  }
  setShape(shape) {
    const g = this.groups.shape;
    if (!g) return;
    g.clear();
    if (!shape) return;
    const pts = shape.type === 'circle' ? Array.from({ length: 96 }, (_, i) => [shape.cx + shape.r * Math.cos((i / 96) * Math.PI * 2), shape.cz + shape.r * Math.sin((i / 96) * Math.PI * 2)]) : shape.pts;
    const ln = this._line(pts, shape.color || '#f97316'); ln.renderOrder = 5; g.add(ln);
    const c = shape.type === 'circle' ? [shape.cx, shape.cz] : [shape.pts.reduce((s, p) => s + p[0], 0) / shape.pts.length, shape.pts.reduce((s, p) => s + p[1], 0) / shape.pts.length];
    const dot = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), new THREE.MeshBasicMaterial({ color: shape.color || '#f97316' }));
    dot.position.set(c[0], this._gy(c[0], c[1]) + 6, c[1]);
    g.add(dot);
  }
  drawPreview(pts) {
    const g = this.groups.draw;
    if (!g) return;
    g.clear();
    if (!pts.length) return;
    if (pts.length > 1) { const ln = this._line(pts, '#dc2626', pts.length > 2); ln.renderOrder = 5; g.add(ln); }
    pts.forEach(([x, z]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshBasicMaterial({ color: '#dc2626', depthTest: false })); s.renderOrder = 6; s.position.set(x, this._gy(x, z) + 4, z); g.add(s); });
  }
  setDrawing(on) { this._draw = on; this.renderer.domElement.style.cursor = on ? 'crosshair' : ''; }

  // -------------------- Camera --------------------
  flyTo(x, z, dist = 1200, dur = 1100, { tilt = 0.9, keepAzimuth = true } = {}) {
    const az = keepAzimuth ? this.controls.getAzimuthalAngle() : 0;
    const polar = Math.PI / 2 - tilt;
    const y0 = this.level === 'city' ? this._gy(x, z) : 0;
    const target = new THREE.Vector3(x, y0, z);
    const pos = new THREE.Vector3(x + dist * Math.sin(polar) * Math.sin(az), y0 + dist * Math.cos(polar), z + dist * Math.sin(polar) * Math.cos(az));
    this._anim = { t0: performance.now(), dur, p0: this.camera.position.clone(), q0: this.controls.target.clone(), p1: pos, q1: target, done: null };
    return new Promise((r) => (this._anim.done = r));
  }
  _stepAnim(t) {
    const a = this._anim;
    const k = Math.min(1, (t - a.t0) / a.dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    this.camera.position.lerpVectors(a.p0, a.p1, e);
    this.controls.target.lerpVectors(a.q0, a.q1, e);
    if (k >= 1) { const d = a.done; this._anim = null; d?.(); this._detailSoon(); }
  }
  north() {
    const t = this.controls.target, d = this.camera.position.distanceTo(t), polar = this.controls.getPolarAngle();
    this._anim = { t0: performance.now(), dur: 700, p0: this.camera.position.clone(), q0: t.clone(), p1: new THREE.Vector3(t.x, t.y + d * Math.cos(polar), t.z + d * Math.sin(polar)), q1: t.clone() };
  }
  zoom(f) {
    const t = this.controls.target, v = this.camera.position.clone().sub(t).multiplyScalar(f);
    this._anim = { t0: performance.now(), dur: 400, p0: this.camera.position.clone(), q0: t.clone(), p1: t.clone().add(v), q1: t.clone() };
  }
  metersPer100px() {
    const d = this.camera.position.distanceTo(this.controls.target);
    const m = (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / this.el.clientHeight * 100;
    return this.level === 'national' ? m * 1000 : m;
  }
  async tour(pois, onStep) {
    const id = Symbol('tour');
    this._tour = id;
    for (let i = 0; i < pois.length && this._tour === id; i++) {
      onStep?.(pois[i], i);
      await this.flyTo(pois[i].x, pois[i].z, pois[i].dist || 1200, 2200, { tilt: 0.7 });
      const t0 = performance.now();
      this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.8;
      while (this._tour === id && performance.now() - t0 < 2200) await new Promise((r) => setTimeout(r, 50));
      this.controls.autoRotate = false;
    }
    const done = this._tour === id;
    this._tour = null;
    return done;
  }
  stopTour() { this._tour = null; this._anim = null; this.controls.autoRotate = false; }

  // -------------------- Chọn đối tượng --------------------
  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const groundHit = () => this.ground && ray.intersectObjects([this.ground, this.detail].filter(Boolean), false)[0];
      if (this._draw && this.ground) { const g = groundHit(); if (g) this.cb.onDrawPoint?.(g.point.x, g.point.z); return; }
      const hits = ray.intersectObjects(this.pickables.filter((o) => { let v = true; o.traverseAncestors((a) => { if (!a.visible) v = false; }); return v && o.visible !== false; }), false);
      const h = hits[0];
      if (h) {
        const u = h.object.userData;
        const at = { x: h.point.x, z: h.point.z };
        if (u.type === 'building') { const i = u.owner[h.faceIndex]; if (!this.city.buildings[i]?.deleted) return this.cb.onPick?.({ type: 'building', i, at }); }
        else return this.cb.onPick?.({ ...u, at });
      }
      const g = groundHit();
      if (g) {
        if ((this.layers.zoning || this.layers.planning) && this.city) return this.cb.onPick?.({ type: 'zone', idx: zoneAt(this.city, g.point.x, g.point.z), x: g.point.x, z: g.point.z });
        this.cb.onPick?.({ type: 'ground', x: g.point.x, z: g.point.z });
      }
    });
  }
  focusBuilding(i, dist = 420) {
    const b = this.city.buildings[i];
    this.setOverlay(new Map([[i, '#f97316']]), false);
    return this.flyTo(b.x, b.z, Math.max(dist, b.h * 4), 900, { tilt: 0.6 });
  }
  screenshot() { return this.renderer.domElement.toDataURL('image/png'); }
}
export { inWater, landuseAt, distWater };
