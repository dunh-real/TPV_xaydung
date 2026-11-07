// =====================================================================
// MOD-00 · Bản đồ 3D toàn quốc (tham chiếu e-City) — Màn hình Demo 0
// Toàn quốc → Tỉnh/Thành → Xã/Phường → Khu vực → Dự án/Công trình
// =====================================================================
import { getState, setState, DATA, currentGate, gateStatus, LANES } from '../store.js';
import { esc, fmt, fmtInt, toast, modal, download, todayISO, viDate, sleep } from '../lib/util.js';
import { CityMap3D, BASEMAPS } from '../lib/citymap3d.js';
import { initEdit, applyWork, editPanel, bindEdit, editPick, zoningPanel, zoneDetail, addBlockPoly, sanbanOn } from './map-edit.js';
import { generateCity, areaStats, ur01, toCSV, shapeArea, inShape, polygonArea, groundAt, HEIGHT_BINS, ZONE_CLASSES, zoneStats, zoneAt } from '../lib/citygen.js';
import { TENANTS, TENANT_DETAIL, SOURCES, PLAN_DOCS, PROJECTS, FUTURE, GROUPS, HEIGHT_SOURCES, LOD_LEVELS, DATASET_VERSION, NA, agencyMap, localToLonLat, lonLatToLocal } from '../data/nationwide.js';
import { buildingReportSource } from '../lib/report-input.js';
import { renderDashboard } from './map-dashboard.js';

let root, map, S;
const ui = {
  level: 'national', tenant: null, group: 'data', info: 'detail', sel: null, shape: null, analysis: null, prevAnalysis: null, aTab: 'overview',
  draw: null, drawPts: [], ur: null, floodOn: false, opsTab: 'region', mode: 'day', colorMode: 'material', hidden: false, futureSel: null, futureTab: 'map',
  elev: false, regionTheme: 'admin', regionColor: 'ward', srcScope: 'all', srcTheme: 'all', radius: 1, touring: false, binSel: null, dash: null,
  editTab: 'bld', editMode: null, newBlock: null, undo: [], redo: [], img: null,
};
const M = () => getState().map;
const city = () => (ui.tenant && TENANT_DETAIL[ui.tenant] ? generateCity(ui.tenant) : null);
const tname = (id) => TENANTS.find((t) => t.id === id)?.name || id;
const kpi = (label, value, source, note = '') => `<div class="mkpi ${value == null ? 'na' : ''}"><span class="l">${esc(label)}</span><b>${value == null ? NA : value}</b><span class="s">${value == null ? '⚪ chưa nối nguồn' : '📎 ' + esc(source)}${note ? ' · ' + esc(note) : ''}</span></div>`;
const hasElevRole = () => ['tinh', 'quocgia'].includes(M().role);
const canSeeElevation = () => hasElevRole() && ui.elev;
const loggedFor = (t) => M().user && (M().user.tenant === t || M().role === 'quocgia');

export function render(el) {
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  root.innerHTML = `
  <div class="mapx ${ui.hidden ? 'hide-ui' : ''}" id="mapx">
    <div class="mx-top">
      <div class="mx-brand"><b>e-City · Bản đồ 3D toàn quốc</b><span>MOD-00 · v=${DATASET_VERSION}</span></div>
      <select id="tenantSel" title="Chọn khu vực"><option value="">🇻🇳 Toàn quốc (34 tỉnh/thành)</option>${TENANTS.map((t) => `<option value="${t.id}">${t.has3d ? '● ' : '○ '}${esc(t.name)}</option>`).join('')}</select>
      <div class="mx-search"><input id="q" placeholder="Tìm khu vực hoặc công trình…" autocomplete="off"><div id="qres" class="qres"></div></div>
      <span id="crumb" class="mx-crumb"></span>
      <span class="spacer"></span>
      <button class="btn sm" id="login"></button>
      <button class="btn sm" id="link" title="Sao chép deep-link có phiên bản">🔗 Deep-link</button>
      <button class="btn sm pri" id="dashBtn">📊 Dashboard</button>
      <div class="mx-menu"><button class="btn sm" id="toolBtn">☰ Công cụ</button><div class="mx-dd" id="toolDD"></div></div>
      <button class="btn sm" id="hideBtn" title="Ẩn giao diện">👁</button>
      <button class="btn sm" id="fsBtn" title="Toàn màn hình">⛶</button>
    </div>
    <div class="mx-body">
      <nav class="mx-side">${GROUPS.map(([id, ic, n]) => `<button data-g="${id}"><span>${ic}</span>${n}</button>`).join('')}<button data-g="all"><span>▦</span>Tất cả chức năng</button></nav>
      <section class="mx-panel" id="gp"></section>
      <div class="mx-view" id="mv">
        <div class="mx-ctl"><button id="cNorth" title="Đặt hướng Bắc"><i id="compass">⬆</i>B</button><button id="cIn" title="Phóng to">＋</button><button id="cOut" title="Thu nhỏ">－</button><button id="cHome" title="Về toàn cảnh">⌂</button></div>
        <div class="mx-status" id="status">LOD1 · sẵn sàng</div>
        <div class="mx-scale"><i id="scaleBar"></i><span id="scaleTxt"></span></div>
        <div class="mx-legend" id="legend"></div>
        <div class="mx-flood" id="floodTag" hidden></div>
        <div class="mx-draw" id="drawBar" hidden></div>
      </div>
      <aside class="mx-info"><div class="mx-tabs">${[['detail', 'Chi tiết'], ['analysis', 'Phân tích'], ['layers', 'Lớp'], ['sources', 'Nguồn'], ['docs', 'Tài liệu']].map(([k, l]) => `<button data-i="${k}">${l}</button>`).join('')}</div><div id="ip" class="mx-ip"></div></aside>
    </div>
    <div class="mx-dash" id="dash" hidden></div>
  </div>`;
  map = new CityMap3D(root.querySelector('#mv'), {
    onPick, onDrawPoint, onMove: (m) => status(m), onImagery: (s) => imgStatus(s),
    onCamera: ({ azimuth }) => { root.querySelector('#compass').style.transform = `rotate(${(-azimuth * 180) / Math.PI}deg)`; scale(); },
  });
  initEdit({ get map() { return map; }, ui, city, drawPanel, drawInfo, topState, startDraw, legend });
  const bmq = qs.get('bm');
  map.basemap = BASEMAPS[bmq] ? bmq : M().basemap || 'sat';
  bindTop();
  // deep-link
  const v = qs.get('v'), focus = qs.get('focus'), mode = qs.get('mode'), sel = qs.get('sel'), dash = qs.get('dashboard');
  if (v && v !== DATASET_VERSION) toast(`Link dùng bộ dữ liệu v=${esc(v)}; hiện tại v=${DATASET_VERSION} — cảnh có thể khác`, 'warn', 5000);
  if (mode && ['day', 'golden', 'night'].includes(mode)) ui.mode = mode;
  map.setMode(ui.mode);
  const startTenant = focus ? focus.split(':')[0] : qs.get('view') === 'national' ? null : ui.tenant;
  goTenant(TENANTS.some((t) => t.id === startTenant) ? startTenant : null, { fly: false });
  if (focus && focus.includes(':') && city()) { const poi = city().pois.find((p) => p.name === decodeURIComponent(focus.split(':')[1])); if (poi) map.flyTo(poi.x, poi.z, poi.dist); }
  if (sel) setTimeout(() => selectById(sel), 300);
  const loc = qs.get('loc');
  if (loc && city()) { const [lx, lz] = loc.split(',').map(Number); setTimeout(() => { map.flyTo(lx, lz, 700); onPick({ type: 'ground', x: lx, z: lz }); }, 300); }
  if (qs.get('sanban') && city()?.site) { ui.group = 'edit'; ui.editTab = 'proj'; sanbanOn(true); drawPanel(); const s = city().site; setTimeout(() => map.flyTo(s.x, s.z, 650, 1200, { tilt: 0.55 }), 400); }
  if (dash) openDash(['overview', 'pop', 'econ', 'budget', 'plan', 'healthedu', 'projects'].includes(dash) ? dash : 'overview');
  return () => { map.stopTour(); map.dispose(); map = null; };
}
export function update() { if (root?.isConnected) { drawInfo(); drawPanel(); topState(); } }

// ------------------------------------------------------------------ khung
function bindTop() {
  const $ = (s) => root.querySelector(s);
  $('#tenantSel').onchange = (e) => goTenant(e.target.value || null);
  root.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { if (b.dataset.g === 'all') return allFunctions(); ui.group = ui.group === b.dataset.g ? null : b.dataset.g; drawPanel(); }));
  root.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { ui.info = b.dataset.i; drawInfo(); }));
  $('#cNorth').onclick = () => map.north();
  $('#cIn').onclick = () => map.zoom(0.6);
  $('#cOut').onclick = () => map.zoom(1.6);
  $('#cHome').onclick = () => map.home();
  $('#link').onclick = copyLink;
  $('#dashBtn').onclick = () => openDash('overview');
  $('#login').onclick = loginDialog;
  $('#hideBtn').onclick = () => { ui.hidden = !ui.hidden; $('#mapx').classList.toggle('hide-ui', ui.hidden); setTimeout(() => map.resize(), 50); };
  $('#fsBtn').onclick = () => { const e = $('#mapx'); document.fullscreenElement ? document.exitFullscreen() : e.requestFullscreen?.(); setTimeout(() => map?.resize(), 300); };
  const dd = $('#toolDD');
  dd.innerHTML = [['explore', '🧭 Khám phá bản đồ'], ['sources', '📚 Nguồn và độ phủ'], ['docs', '📄 Tài liệu quy hoạch'], ['tasks', '🗂 Công việc đô thị'], ['shared', '🤝 Hồ sơ dùng chung'], ['work', '📋 Hồ sơ và công việc']].map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('');
  $('#toolBtn').onclick = () => dd.classList.toggle('open');
  dd.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { dd.classList.remove('open'); tool(b.dataset.t); }));
  const q = $('#q'), qr = $('#qres');
  q.oninput = () => search(q.value, qr);
  q.onblur = () => setTimeout(() => (qr.innerHTML = ''), 200);
  topState();
}
function topState() {
  const m = M();
  const roles = { guest: '👤 Khách · Đăng nhập theo địa bàn', xa: `👮 Cán bộ ${m.user?.ward || ''}`, tinh: `🏛 Quản trị ${tname(m.user?.tenant)}`, quocgia: '🇻🇳 Quản trị toàn quốc' };
  root.querySelector('#login').textContent = roles[m.role] || roles.guest;
  root.querySelectorAll('[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === ui.group));
  root.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('on', b.dataset.i === ui.info));
  root.querySelector('#tenantSel').value = ui.tenant || '';
  const c = city();
  const w = ui.sel?.type === 'building' && c ? c.wards[c.buildings[ui.sel.i].ward].name : (ui.sel?.type === 'ground' || ui.sel?.type === 'zone') && c ? c.wards[wardAt(ui.sel.x, ui.sel.z)].name : null;
  const leaf = ui.sel?.type === 'building' ? c.buildings[ui.sel.i].id : ui.sel?.type === 'zone' ? c.zones[ui.sel.idx].id : ui.sel?.type === 'bridge' ? 'Cầu BR-01' : ui.sel?.type === 'site' || ui.sel?.type === 'project' ? ui.sel.id : null;
  root.querySelector('#crumb').innerHTML = ['<a data-cr="">Toàn quốc</a>', ui.tenant ? `<a data-cr="${ui.tenant}">${esc(tname(ui.tenant))}</a>` : '', ui.tenant && TENANT_DETAIL[ui.tenant] ? 'Toàn địa giới · đất liền' : '', w ? esc(w) : '', leaf ? `<b>${esc(leaf)}</b>` : ''].filter(Boolean).join(' › ');
  root.querySelectorAll('[data-cr]').forEach((a) => (a.onclick = () => goTenant(a.dataset.cr || null)));
  legend();
}
function status(moving) {
  const el = root?.querySelector('#status');
  if (!el) return;
  if (moving) { el.textContent = 'Đang nạp tile · chi tiết thích nghi · Khối nhà gần đúng'; el.classList.add('busy'); }
  else { el.textContent = 'Đang nạp cận cảnh…'; setTimeout(() => { if (el.isConnected) { el.textContent = ui.level === 'city' ? 'LOD1 · đã nạp cận cảnh' : 'Toàn quốc · LOD0'; el.classList.remove('busy'); } }, 450); }
}
function imgStatus(s) {
  ui.img = s;
  const el = root?.querySelector('#status');
  if (!el) return;
  if (s.state === 'loading') { el.textContent = `🛰 Đang tải ${BASEMAPS[s.basemap || map.basemap]?.label || 'ảnh nền'} ${s.total ? s.loaded + '/' + s.total + ' tile' : ''}`; el.classList.add('busy'); }
  else if (s.state === 'offline') { el.textContent = '⚠ Nền ngoại tuyến (vẽ từ OSM)' + (s.reason ? ' — ' + s.reason : ''); el.classList.add('busy'); if (s.reason && !s._toasted) { s._toasted = 1; toast(esc(s.reason), 'warn', 5000); } }
  else { el.textContent = ui.level === 'city' ? `LOD1 · ${BASEMAPS[map.basemap].label} z16${s.detail === 'ready' ? ' + chi tiết z18' : s.detail === 'loading' ? ' · đang nạp cận cảnh z18…' : ''}` : `Toàn quốc · ${BASEMAPS[map.basemap].label}`; el.classList.remove('busy'); }
  const st = root.querySelector('#imgSt');
  if (st) st.innerHTML = imgLine();
}
function imgLine() {
  const s = ui.img || {};
  return s.state === 'ready' ? `<span class="badge green">đã tải ${s.loaded || ''} tile${s.mpp ? ' · ' + fmt(s.mpp, 1) + ' m/pixel' : ''}</span>${s.detail === 'ready' ? ' <span class="badge blue">cận cảnh z18 ≈ 0,6 m/pixel</span>' : ''}` : s.state === 'loading' ? `<span class="badge orange">đang tải ${s.loaded || 0}/${s.total || '…'}</span>` : s.state === 'offline' ? '<span class="badge gray">ngoại tuyến — vẽ từ OSM</span>' : '';
}
function scale() {
  if (!map || !root) return;
  let m = map.metersPer100px();
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const n = nice.find((x) => x >= m * 0.6) || m;
  root.querySelector('#scaleBar').style.width = `${(n / m) * 100}px`;
  root.querySelector('#scaleTxt').textContent = n >= 1000 ? `${n / 1000} km` : `${n} m`;
}
function legend() {
  const el = root.querySelector('#legend');
  if (ui.level !== 'city') { el.innerHTML = '<b>Toàn quốc</b><span><i style="background:#076da5"></i>Có nền 3D LOD1</span><span><i style="background:#94a3b8"></i>Chưa nạp tenant</span><span class="muted">Cột = số dự án AIPM OS · ranh minh họa, không phải ranh pháp lý</span>'; return; }
  if (ui.colorMode === 'heightSource') el.innerHTML = '<b>Nguồn chiều cao</b>' + Object.values(HEIGHT_SOURCES).map((h) => `<span><i style="background:${h.color}"></i>${esc(h.label)}</span>`).join('');
  else if (ui.colorMode === 'ward') el.innerHTML = '<b>Tô theo xã/phường</b><span class="muted">Màu chỉ để phân biệt, không biểu thị rủi ro</span>';
  else if (ui.colorMode === 'gray') el.innerHTML = '<b>Tô bản đồ điều hành</b><span><i style="background:#b8bec4"></i>Xám = chưa nối nguồn (không tự tạo mức rủi ro)</span>';
  else if (ui.colorMode === 'zone') el.innerHTML = '<b>Chức năng ô quy hoạch (mô phỏng)</b>' + Object.values(ZONE_CLASSES).map((z) => `<span><i style="background:${z.color}"></i>${esc(z.name)}</span>`).join('');
  else if (ui.colorMode === 'edit') el.innerHTML = '<b>Biên tập mô hình</b><span><i style="background:#e11d48"></i>Công trình đã sửa</span><span><i style="background:#16a34a"></i>Khối mới trong phương án</span><span><i style="background:#d4d4d4"></i>Hiện trạng OSM</span>';
  else el.innerHTML = '<b>Diện mạo & vật liệu</b><span class="muted">Vật liệu suy từ loại công trình OSM + chiều cao</span>';
  if (map?.layers.zoning && ui.level === 'city' && ui.colorMode !== 'zone') el.innerHTML += '<b style="margin-top:4px">Ô quy hoạch (mô phỏng)</b>' + Object.values(ZONE_CLASSES).slice(0, 7).map((z) => `<span><i style="background:${z.color}"></i>${esc(z.name)}</span>`).join('') + '<span><i style="background:repeating-linear-gradient(45deg,#dc2626 0 2px,transparent 2px 5px)"></i>Vượt chỉ tiêu</span>';
}

// ------------------------------------------------------------------ điều hướng
function goTenant(id, { fly = true } = {}) {
  map.stopTour(); ui.touring = false;
  ui.tenant = id; ui.sel = null; ui.shape = null; ui.analysis = null; ui.ur = null; ui.floodOn = false; ui.binSel = null;
  setState((s) => (s.map.tenant = id), true);
  if (id && TENANT_DETAIL[id]) {
    ui.level = 'city';
    map.showCity(generateCity(id));
    ui.editMode = null;
    applyWork();
    map.setColorMode(ui.colorMode);
    if (fly) map.home();
  } else {
    ui.level = 'national';
    const counts = {};
    PROJECTS.forEach((p) => (counts[p.tenant] = (counts[p.tenant] || 0) + 1));
    map.showNational(counts, id);
    if (id) { const t = TENANTS.find((x) => x.id === id); ui.sel = { type: 'province', id }; const [x, z] = [(t.lon - 106) * 108, -(t.lat - 16) * 111]; if (fly) map.flyTo(x, z, 700); }
  }
  root.querySelector('#floodTag').hidden = true;
  drawPanel(); drawInfo(); topState(); status(false); scale();
}
function selectById(id) {
  const c = city();
  if (id === 'BR-01' && !c?.bridge) goTenant('hcm', { fly: false });
  const cc = city();
  if (!cc) return;
  if (id === 'BR-01') { onPick({ type: 'bridge', id }); map.flyTo(cc.bridge.x, cc.bridge.z, 650, 1000, { tilt: 0.55 }); return; }
  const b = cc.buildings.find((q) => q.id === id);
  if (b) { onPick({ type: 'building', i: b.i }); map.focusBuilding(b.i); return; }
  const p = cc.projects.find((q) => q.id === id);
  if (p) { onPick(p.live ? { type: 'site', id } : { type: 'project', id }); map.flyTo(p.x, p.z, 900); }
}
function onPick(o) {
  if (o.type === 'province') {
    ui.sel = o; map.selectProvince(o.id);
    const t = TENANTS.find((x) => x.id === o.id);
    if (t.has3d) toast(`${esc(t.name)}: có nền 3D LOD1 — bấm "Mở bản đồ 3D tỉnh" ở bảng Chi tiết`, 'info');
  } else {
    if (editPick(o)) return;
    ui.sel = o;
    if (o.type !== 'zone' && map.selZone != null) map.setZoneSel(null);
    if (o.type === 'zone') map.setZoneSel(o.idx);
    if (o.type === 'building') { map.setOverlay(new Map([[o.i, '#f97316']]), false); logElevationAccess(city().buildings[o.i].id); }
    else if (o.type === 'ground') { if (canSeeElevation()) logElevationAccess(`(${o.x.toFixed(0)}, ${o.z.toFixed(0)})`); }
    else map.setOverlay(ui.binSel ? map.overlay : null);
  }
  ui.info = 'detail';
  drawInfo(); topState();
  if (ui.group === 'edit') drawPanel();
}
function logElevationAccess(target) {
  setState((s) => { s.map.accessLog.unshift({ at: new Date().toISOString(), user: s.map.user ? `${s.map.role}@${s.map.user.ward || s.map.user.tenant}` : 'khách', target, detail: canSeeElevation() ? 'cao độ chi tiết' : 'cao độ làm tròn' }); s.map.accessLog = s.map.accessLog.slice(0, 50); }, true);
}
const wardAt = (x, z) => city().wardOf(x, z);
const landAt = (x, z) => { const g = city().gis, i = Math.floor((z + 3000) / g.lcell) * g.ln + Math.floor((x + 3000) / g.lcell); return g.land[i] || 0; };
const zoneIdx = (x, z) => zoneAt(city(), x, z);

function search(q, box) {
  q = q.trim().toLowerCase();
  if (q.length < 2) { box.innerHTML = ''; return; }
  const res = [];
  TENANTS.filter((t) => t.name.toLowerCase().includes(q)).forEach((t) => res.push({ l: `🏙 ${t.name}`, s: t.has3d ? 'Tỉnh/thành · có nền 3D' : 'Tỉnh/thành · chưa nạp 3D', go: () => goTenant(t.id) }));
  Object.entries(TENANT_DETAIL).forEach(([tid, d]) => {
    generateCity(tid).wards.forEach((w, i) => { if (w.name.toLowerCase().includes(q)) res.push({ l: `🏘 ${w.name}`, s: `${tname(tid)} · ranh OSM`, go: () => { if (ui.tenant !== tid) goTenant(tid, { fly: false }); const wd = city().wards[i]; map.flyTo(wd.cx, wd.cz, 2200); map.setShape({ type: 'poly', pts: wd.poly, color: '#c026d3' }); ui.sel = { type: 'ground', x: wd.cx, z: wd.cz }; drawInfo(); topState(); } }); });
    generateCity(tid).pois.forEach((p) => { if (p.name.toLowerCase().includes(q)) res.push({ l: `📍 ${p.name}`, s: tname(tid), go: () => { if (ui.tenant !== tid) goTenant(tid, { fly: false }); map.flyTo(p.x, p.z, p.dist); } }); });
  });
  PROJECTS.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(q)).forEach((p) => res.push({ l: `📌 ${p.id} · ${p.name}`, s: tname(p.tenant), go: () => { if (TENANT_DETAIL[p.tenant]) { if (ui.tenant !== p.tenant) goTenant(p.tenant, { fly: false }); selectById(p.bridge ? 'BR-01' : p.id); } else { goTenant(p.tenant); } } }));
  if (/^(hcm|dna)-b-/i.test(q)) { const tid = q.startsWith('hcm') ? 'hcm' : 'dong-nai'; const b = generateCity(tid).buildings.find((x) => x.id.toLowerCase() === q); if (b) res.push({ l: `🏢 ${b.id}`, s: 'Mảnh công trình', go: () => { if (ui.tenant !== tid) goTenant(tid, { fly: false }); selectById(b.id); } }); }
  box.innerHTML = res.slice(0, 12).map((r, i) => `<button data-r="${i}"><b>${esc(r.l)}</b><span>${esc(r.s)}</span></button>`).join('') || '<div class="muted small" style="padding:8px">Không có kết quả trong danh mục nguồn</div>';
  box.querySelectorAll('[data-r]').forEach((b) => (b.onmousedown = () => { res[+b.dataset.r].go(); box.innerHTML = ''; root.querySelector('#q').value = ''; }));
}

function copyLink() {
  const c = city();
  const t = map.controls.target;
  const near = c ? c.pois.reduce((a, p) => (Math.hypot(p.x - t.x, p.z - t.z) < Math.hypot(a.x - t.x, a.z - t.z) ? p : a), c.pois[0]) : null;
  const sel = ui.sel?.type === 'building' ? c.buildings[ui.sel.i].id : ui.sel?.type === 'bridge' ? 'BR-01' : ui.sel?.id && ui.sel.type !== 'province' ? ui.sel.id : '';
  const p = new URLSearchParams({ v: DATASET_VERSION, focus: ui.tenant ? `${ui.tenant}${near ? ':' + near.name : ''}` : 'vn', view: ui.level === 'city' ? 'province' : 'national', mode: ui.mode });
  if (sel) p.set('sel', sel);
  if (map.basemap !== 'sat') p.set('bm', map.basemap);
  if (ui.dash) p.set('dashboard', ui.dash.page);
  const url = `${location.origin}${location.pathname}#map?${p.toString()}`;
  navigator.clipboard?.writeText(url).then(() => toast('🔗 Đã sao chép deep-link có phiên bản', 'ok'), () => {});
  modal({ title: '🔗 Deep-link tái lập cảnh', body: `<p class="small">Gửi link này cho lãnh đạo — mở lại đúng tỉnh/khu vực, đối tượng chọn, chế độ cảnh và phiên bản dữ liệu.</p><textarea rows="3" readonly>${esc(url)}</textarea><div class="mt" style="margin-top:8px"><span>v (phiên bản dữ liệu)</span><span>${DATASET_VERSION}</span><span>focus</span><span>${esc(p.get('focus'))}</span><span>view</span><span>${p.get('view')}</span><span>mode</span><span>${ui.mode}</span>${sel ? `<span>sel</span><span>${esc(sel)}</span>` : ''}</div>`, actions: [{ label: 'Đóng', cls: 'btn' }] });
}

function loginDialog() {
  const m = M();
  modal({
    title: '🔐 Đăng nhập theo địa bàn (mô phỏng Keycloak OIDC · RBAC theo tenant)',
    body: `<p class="small muted">"Công việc đô thị", "Hồ sơ dùng chung", "Hồ sơ và công việc" yêu cầu đăng nhập theo địa bàn được cấp. Lớp độ cao chi tiết chỉ hiển thị cho quản trị tỉnh/toàn quốc và được ghi nhật ký truy cập.</p>
    <div class="grid g2"><label class="f">Vai trò<select id="lr"><option value="guest">Khách (sổ công việc cục bộ trên thiết bị)</option><option value="xa">Cán bộ địa bàn cấp xã</option><option value="tinh">Quản trị tenant tỉnh/thành</option><option value="quocgia">Quản trị toàn quốc</option></select></label>
    <label class="f">Tỉnh/thành (tenant)<select id="lt">${TENANTS.filter((t) => t.has3d).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    <label class="f">Địa bàn cấp xã được cấp<select id="lw"></select></label></div>
    <h4 style="margin-top:12px">Nhật ký truy cập dữ liệu độ cao (${m.accessLog.length})</h4><div class="scroll" style="max-height:160px"><table class="tb small">${m.accessLog.slice(0, 15).map((a) => `<tr><td>${esc(a.at.slice(0, 19).replace('T', ' '))}</td><td>${esc(a.user)}</td><td>${esc(a.target)}</td><td>${esc(a.detail)}</td></tr>`).join('') || '<tr><td class="muted">Chưa có</td></tr>'}</table></div>`,
    actions: [{ label: 'Đăng xuất', cls: 'btn', onClick: () => { ui.elev = false; setState((s) => { s.map.role = 'guest'; s.map.user = null; }); toast('Đã đăng xuất'); } },
      { label: 'Đăng nhập', cls: 'btn pri', onClick: (w) => { const role = w.querySelector('#lr').value, tenant = w.querySelector('#lt').value, ward = w.querySelector('#lw').value; setState((s) => { s.map.role = role; s.map.user = role === 'guest' ? null : { tenant, ward }; }); toast(`Đã đăng nhập: ${role} · ${esc(tname(tenant))}`, 'ok'); } }],
  });
  const w = document.querySelector('.modal-wrap:last-child');
  const fillW = () => (w.querySelector('#lw').innerHTML = TENANT_DETAIL[w.querySelector('#lt').value].wards.map((x) => `<option>${esc(x)}</option>`).join(''));
  w.querySelector('#lr').value = m.role;
  if (m.user?.tenant) w.querySelector('#lt').value = m.user.tenant;
  w.querySelector('#lt').onchange = fillW; fillW();
  if (m.user?.ward) w.querySelector('#lw').value = m.user.ward;
}

function tool(k) {
  if (k === 'explore') { ui.group = null; drawPanel(); map.home(); }
  else if (k === 'sources') { ui.info = 'sources'; drawInfo(); }
  else if (k === 'docs') { ui.info = 'docs'; drawInfo(); }
  else if (k === 'tasks') { ui.group = 'ops'; ui.opsTab = 'report'; drawPanel(); }
  else if (k === 'shared' || k === 'work') {
    const S0 = getState(), t = ui.tenant || S0.project.tenant;
    if (!loggedFor(t)) { toast('Cần đăng nhập theo địa bàn được cấp để mở không gian này', 'warn'); return loginDialog(); }
    const wf = S0.workflow.filter((w) => !w.tenant || w.tenant === t);
    modal({ wide: true, title: k === 'shared' ? `🤝 Hồ sơ dùng chung · ${esc(tname(t))}` : `📋 Hồ sơ và công việc · ${esc(tname(t))}`,
      body: k === 'shared'
        ? `<table class="tb"><tr><th>Mã</th><th>Hồ sơ</th><th>Cổng</th><th>Địa bàn</th><th>Pháp lý</th></tr>${S0.docs.map((d) => `<tr><td>${d.id}</td><td>${esc(d.title)}</td><td>${esc(d.gate || '')}</td><td>${esc(S0.project.ward)}</td><td>${d.legalIssues ? `<span class="badge red">${d.legalIssues}</span>` : '<span class="badge green">OK</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Chưa có hồ sơ AI — tạo ở tab Hồ sơ AI</td></tr>'}</table>`
        : `<h4>Công việc BPMN gắn vị trí (${wf.length})</h4><table class="tb"><tr><th>Mã</th><th>Việc</th><th>Cổng</th><th>Đang ở làn</th><th>Địa bàn</th><th>SLA</th><th></th></tr>${wf.map((w) => `<tr><td>${w.id}</td><td>${esc(w.title)}</td><td>${w.gate}</td><td>${w.at < w.route.length ? esc(LANES.find((l) => l.id === w.route[w.at]).short) + (w.route[w.at] === 'UB' ? ` (${w.ubLevel || 'tỉnh'})` : '') : '✓ Hoàn tất'}</td><td>${esc(w.ward || '—')}</td><td>${w.days}/${w.sla}</td><td>${w.loc ? `<button class="btn sm" data-fly="${w.loc}">📍</button>` : ''}</td></tr>`).join('')}</table>
          <h4 style="margin-top:10px">Công việc đô thị tạo từ bản đồ (${M().tasks.length})</h4>${taskTable()}`,
      actions: [{ label: 'Đóng', cls: 'btn' }] });
    document.querySelectorAll('.modal-wrap [data-fly]').forEach((b) => (b.onclick = () => { const [x, z] = b.dataset.fly.split(',').map(Number); if (ui.tenant !== t) goTenant(t, { fly: false }); map.flyTo(x, z, 700); document.querySelector('.modal-wrap')?.remove(); }));
  }
}
function taskTable() {
  const tasks = M().tasks;
  return `<table class="tb small"><tr><th>Mã</th><th>Tên việc</th><th>Phụ trách</th><th>Hạn</th><th>Nguồn ngữ cảnh</th><th>Lưu</th><th>BPMN</th></tr>${tasks.map((t) => `<tr><td>${t.id}</td><td>${esc(t.name)}</td><td>${esc(t.owner)}</td><td>${viDate(t.due)}</td><td>${esc(t.context)}</td><td>${t.local ? '<span class="badge orange">cục bộ thiết bị</span>' : '<span class="badge green">máy chủ (tenant)</span>'}</td><td>${t.wf ? `<span class="badge blue">${t.wf}</span>` : '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có</td></tr>'}</table>`;
}

function allFunctions() {
  const F = [
    ['Nền tảng', [['Bản đồ 3D toàn địa giới', () => goTenant(null)], ['Tìm kiếm & chọn khu vực', () => root.querySelector('#q').focus()], ['Deep-link có phiên bản', copyLink], ['Ẩn giao diện / Toàn màn hình', () => root.querySelector('#hideBtn').click()]]],
    ['Dữ liệu tại vị trí', [['Dữ liệu trong khu vực', () => grp('data')], ['Thông tin công trình (provenance)', () => { ui.info = 'detail'; drawInfo(); }], ['Lớp & độ phủ', () => { ui.info = 'layers'; drawInfo(); }], ['Registry nguồn', () => { ui.info = 'sources'; drawInfo(); }], ['Tài liệu quy hoạch', () => { ui.info = 'docs'; drawInfo(); }]]],
    ['Phân tích & vùng', [['Phân tích khu vực', () => grp('analysis')], ['Vùng quản lý · nhập/xuất', () => grp('region')], ['Khu vực trọng điểm', () => grp('area')], ['Tham quan tự động', () => grp('tour')]]],
    ['Điều hành', [['Vùng', () => ops('region')], ['Dịch vụ & hàng đợi xác minh', () => ops('svc')], ['Kịch bản khoanh vùng · UR-01', () => ops('scenario')], ['Ảnh cập nhật có kiểm soát', () => ops('img')], ['Báo cáo & công việc gắn vị trí', () => ops('report')]]],
    ['Tương lai & Dashboard', [['Dự án hạ tầng liên vùng', () => grp('future')], ['Dashboard đa cấp', () => openDash('overview')], ['Dự án & Stage-Gate', () => openDash('projects')]]],
  ];
  const fns = [];
  modal({ wide: true, title: '▦ Tất cả chức năng MOD-00', body: `<div class="grid g3">${F.map(([g, items]) => `<div class="card"><h4>${g}</h4>${items.map(([l, f]) => { fns.push(f); return `<button class="btn sm" data-fn="${fns.length - 1}" style="justify-content:flex-start">${esc(l)}</button>`; }).join('')}</div>`).join('')}</div>`, actions: [{ label: 'Đóng', cls: 'btn' }] });
  document.querySelectorAll('.modal-wrap [data-fn]').forEach((b) => (b.onclick = () => { document.querySelector('.modal-wrap')?.remove(); fns[+b.dataset.fn](); }));
}
const grp = (g) => { ui.group = g; drawPanel(); topState(); };
const ops = (t) => { ui.group = 'ops'; ui.opsTab = t; drawPanel(); topState(); };

// ------------------------------------------------------------------ vẽ vùng
function startDraw(kind) {
  if (!city()) return toast('Chọn TP.HCM hoặc Đồng Nai để vẽ trên nền 3D', 'warn');
  map.stopTour();
  ui.draw = kind; ui.drawPts = [];
  map.setDrawing(true); map.drawPreview([]);
  const bar = root.querySelector('#drawBar');
  bar.hidden = false;
  const lim = kind === 'sketch' ? ' · giới hạn 10 ha, 256 đỉnh' : '';
  bar.innerHTML = `✏️ Nhấp lên bản đồ để thêm đỉnh${lim} <b id="dpN">0 đỉnh</b> <button class="btn sm ok" id="dpOk">Hoàn tất</button><button class="btn sm" id="dpUndo">↶</button><button class="btn sm danger" id="dpX">Hủy</button>`;
  bar.querySelector('#dpOk').onclick = finishDraw;
  bar.querySelector('#dpUndo').onclick = () => { ui.drawPts.pop(); map.drawPreview(ui.drawPts); drawCount(); };
  bar.querySelector('#dpX').onclick = endDraw;
}
function drawCount() {
  const el = root.querySelector('#dpN');
  if (!el) return;
  const a = ui.drawPts.length > 2 ? polygonArea(ui.drawPts) : 0;
  el.textContent = `${ui.drawPts.length} đỉnh · ${fmt(a / 10000, 2)} ha`;
  el.style.color = ui.draw === 'sketch' && a > 100000 ? 'var(--red)' : '';
}
function onDrawPoint(x, z) {
  if (!ui.draw) return;
  if (ui.draw === 'sketch' && ui.drawPts.length >= 256) return toast('Đã đạt giới hạn 256 đỉnh', 'warn');
  ui.drawPts.push([x, z]);
  map.drawPreview(ui.drawPts);
  drawCount();
}
function endDraw() { ui.draw = null; ui.drawPts = []; map.setDrawing(false); map.drawPreview([]); root.querySelector('#drawBar').hidden = true; }
function finishDraw() {
  const pts = ui.drawPts.slice(), kind = ui.draw;
  if (pts.length < 3) return toast('Cần tối thiểu 3 đỉnh', 'warn');
  const area = polygonArea(pts);
  if (kind === 'sketch' && area > 100000) return toast(`Vùng ${fmt(area / 10000, 2)} ha vượt giới hạn 10 ha của phương án khoanh vùng`, 'warn');
  endDraw();
  if (kind === 'analysis') { runAnalysis({ type: 'poly', pts }); }
  else if (kind === 'addBlock') { addBlockPoly(pts, ui.newBlock); }
  else if (kind === 'sketch') {
    const id = `PA-${String(M().sketches.length + 1).padStart(3, '0')}`;
    setState((s) => s.map.sketches.push({ id, tenant: ui.tenant, pts, area, createdAt: todayISO(), base: DATASET_VERSION, ward: city().wards[wardAt(pts[0][0], pts[0][1])].name }));
    map.setShape({ type: 'poly', pts, color: '#16a34a' });
    toast(`Đã lưu phương án ${id} (${fmt(area / 10000, 2)} ha) — tách riêng khỏi nền hiện trạng`, 'ok');
    drawPanel();
  } else if (kind === 'region') {
    const name = prompt('Tên vùng quản lý:', `Vùng quản lý ${M().regions.length + 1}`);
    if (!name) return;
    const id = `VQL-${String(M().regions.length + 1).padStart(3, '0')}`;
    setState((s) => s.map.regions.push({ id, name, tenant: ui.tenant, pts, area, source: 'Tạo trên bản đồ', createdAt: todayISO() }));
    map.setShape({ type: 'poly', pts, color: '#7c3aed' });
    toast(`Đã tạo ${id}`, 'ok');
    drawPanel();
  }
}

// ------------------------------------------------------------------ phân tích khu vực
function runAnalysis(shape) {
  const c = city();
  if (!c) return toast('Chọn tỉnh/thành có nền 3D trước', 'warn');
  ui.prevAnalysis = ui.analysis;
  ui.shape = shape;
  ui.analysis = { ...areaStats(c, shape), shape, tenant: ui.tenant, at: new Date().toISOString(), dataVersion: DATASET_VERSION };
  ui.binSel = null;
  map.setShape(shape);
  map.setOverlay(new Map(ui.analysis.list.map((b) => [b.i, '#0ea5e9'])), true);
  ui.group = 'analysis'; ui.aTab = 'overview';
  drawPanel(); ui.info = 'analysis'; drawInfo();
}
function exportAnalysis() {
  const a = ui.analysis;
  if (!a) return;
  const rows = a.list.map((b) => ({ id: b.id, xa_phuong: city().wards[b.ward].name, chieu_cao_m: b.h, nguon_chieu_cao: HEIGHT_SOURCES[b.src].label, so_tang: b.floors ?? '', dien_tich_manh_m2: Math.round(b.area), osm_id: b.osm || '', loai: b.typeName, cao_do_nen_m: canSeeElevation() ? b.ground : Math.round(b.ground), do_tin_cay: b.conf, nam_mau_anh: b.year ?? '' }));
  download(`PhanTichKhuVuc_${ui.tenant}_${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
  download(`PhanTichKhuVuc_${ui.tenant}_${todayISO()}_phuong-phap.json`, JSON.stringify({ api: 'POST /api/v1/map/area-stats', tenant: a.tenant, shape: a.shape.type === 'circle' ? { type: 'circle', center: localToLonLat(a.tenant, a.shape.cx, a.shape.cz), radius_m: a.shape.r } : { type: 'Polygon', coordinates: [a.shape.pts.map(([x, z]) => localToLonLat(a.tenant, x, z))] }, dataVersion: a.dataVersion, computedAt: a.at, method: a.method, metrics: { area_m2: a.area, count: a.count, withHeight: a.withHeight, median_h: a.median, density_per_km2: a.density, methods: a.methods }, sources: ['S-BLD-04', 'S-DEM-03', 'S-ADM-02'], attribution: '© OpenStreetMap contributors (ODbL 1.0)', disclaimer: 'Dữ liệu OSM (lớp tạm, chưa xác minh với CSDL địa phương); chiều cao một phần là ước lượng — không dùng thay hồ sơ pháp lý.' }, null, 2), 'application/json');
  toast('Đã xuất CSV + phương pháp (JSON)', 'ok');
}

// ------------------------------------------------------------------ UR-01
function runUR01(inp) {
  const c = city();
  const r = ur01(c, ui.shape, inp);
  ui.ur = { ...r, inp, scope: ui.shape ? 'Vùng đang chọn' : 'Toàn cảnh mẫu' };
  ui.floodOn = true;
  map.setFlood(r.level);
  const mx = Math.max(0.01, ...r.affected.map((a) => a.depth));
  map.setOverlay(new Map(r.affected.map((a) => [a.i, a.depth > mx * 0.6 ? '#b91c1c' : a.depth > mx * 0.3 ? '#ef4444' : '#fca5a5'])), true);
  const runId = `RUN-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)}`;
  setState((s) => { s.twin.runs.unshift({ runId, scenarioId: 'UR-01', scenarioVersion: 'S1.0', level: 'L1', status: 'COMPLETED', createdAt: new Date().toISOString(), modelVersionId: `MOD-00/${DATASET_VERSION}`, dataVersionId: DATASET_VERSION, input: inp, solverVersion: 'ur01-screening/1.0', inputHash: 'sha256:' + btoa(JSON.stringify(inp)).slice(0, 10) + '…', message: r.note, result: { status: 'WARNING', method: 'L1_SCREENING_MODEL/1.0', summary: r.note, metrics: [{ label: 'Mực nước proxy', value: r.level, unit: 'm', status: 'WARNING' }, { label: 'Công trình bị ảnh hưởng', value: r.affected.length, unit: 'mảnh', status: 'WARNING' }], series: r.series } }); s.twin.activeRunId = runId; });
  floodTag();
  toast(`UR-01 (L1): ${r.affected.length} mảnh công trình trong vùng ngập proxy — đã ghi ${runId}`, 'ok');
  drawPanel();
}
function floodTag() {
  const el = root.querySelector('#floodTag');
  el.hidden = !ui.floodOn;
  if (ui.floodOn) el.innerHTML = `🌧 <b>Mưa · triều · ngập</b> — ${ui.ur ? `mực nước proxy ${fmt(ui.ur.level, 2)} m · nguồn: kết quả MOD-02 UR-01 (L1) trên DEM cảnh mẫu` : 'chưa có kết quả mô phỏng'} · <i>chưa nối dữ liệu quan trắc (S-HYD-01); DEM nền không dùng suy độ sâu ngập thực</i>`;
}

// ------------------------------------------------------------------ bảng thông tin (5 tab)
function drawInfo() {
  const el = root.querySelector('#ip');
  if (!el) return;
  root.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('on', b.dataset.i === ui.info));
  if (ui.info === 'detail') el.innerHTML = detailHtml();
  else if (ui.info === 'analysis') el.innerHTML = ui.analysis ? analysisSummary() : '<p class="small muted">Chưa có phân tích. Mở nhóm <b>Phân tích</b> → "Phân tích tại tâm" hoặc "Vẽ vùng".</p><button class="btn sm pri" data-act="goAnalysis">📊 Mở Phân tích</button>';
  else if (ui.info === 'layers') el.innerHTML = layersHtml();
  else if (ui.info === 'sources') el.innerHTML = sourcesHtml();
  else el.innerHTML = docsHtml();
  bindInfo(el);
}
function detailHtml() {
  const c = city(), s = ui.sel, P = getState().project;
  if (!s) {
    if (!c) return `<h4>🇻🇳 Toàn quốc</h4><div class="mt"><span>Tỉnh/thành (tenant)</span><span>34</span><span>ĐVHC cấp xã</span><span>≈ 3.300 (cần đối chiếu danh mục)</span><span>Tenant có nền 3D LOD1</span><span>2 (TP.HCM, Đồng Nai)</span><span>Dự án AIPM OS trên bản đồ</span><span>${PROJECTS.length}</span><span>Phiên bản dữ liệu</span><span>${DATASET_VERSION}</span></div><p class="small muted">Nhấp một tỉnh/thành trên bản đồ hoặc dùng ô "Chọn khu vực". Nơi thiếu dữ liệu hiển thị "${NA}" thay vì suy diễn.</p>`;
    return regionDataHtml(c);
  }
  if (s.type === 'province') {
    const t = TENANTS.find((x) => x.id === s.id), d = TENANT_DETAIL[s.id], prj = PROJECTS.filter((p) => p.tenant === s.id);
    return `<h4>${esc(t.name)} <span class="badge ${t.has3d ? 'green' : 'gray'}">${t.has3d ? 'Nền 3D LOD1' : 'Chưa nạp tenant'}</span></h4>
      <div class="mt"><span>Loại</span><span>${t.kind === 'TP' ? 'Thành phố trực thuộc TW' : 'Tỉnh'}</span><span>ĐVHC cấp xã</span><span>${d ? d.communes : NA}</span><span>Mảnh công trình 3D</span><span>${d ? esc(d.buildingsTotal) : NA}</span><span>Hệ quy chiếu</span><span class="small">${d ? esc(d.crs) : NA}</span><span>Dự án AIPM OS</span><span>${prj.length}</span></div>
      ${d ? `<p class="small muted">${esc(d.communeNote)}</p><button class="btn pri" data-act="enter" data-id="${t.id}">🏙 Mở bản đồ 3D tỉnh</button>` : `<div class="disclaimer">Tenant chưa nạp ranh giới, mặt bằng công trình và registry nguồn. Hiển thị "${NA}" — không tự sinh số liệu.</div>`}
      ${prj.map((p) => `<div class="chk"><span class="i">📌</span><div><b>${p.id}</b> ${esc(p.name)} <span class="badge blue">${p.live ? currentGate().id : p.gate}</span></div></div>`).join('')}`;
  }
  if (s.type === 'building') {
    const b = c.buildings[s.i], hs = HEIGHT_SOURCES[b.src], wd = c.wards[b.ward], zn = c.zones[b.zone];
    const osmUrl = b.osm ? `https://www.openstreetmap.org/${b.osm[0] === 'w' ? 'way' : 'relation'}/${b.osm.slice(1)}` : null;
    const spread = b.src === 'PRIOR' ? '± 1–2 tầng (≈ ± ' + fmt(Math.max(3.3, b.h * 0.25), 1) + ' m) — chưa có mẫu đo' : '—';
    return `<h4>🏢 Thông tin công trình</h4><div class="small muted">${b.id} · ${esc(wd.name)} · ${b.fp === 'osm' ? 'Dữ liệu OSM thật' : 'Khối trong phương án'}${b.edited && !b.added ? ' · <b style="color:#e11d48">đã chỉnh trong phương án</b>' : ''}</div>
      <div class="mt prov">
        <span>Tên / loại công trình</span><span>${b.name ? esc(b.name) + ' · ' : ''}${esc(b.typeName)}</span>
        <span>Chiều cao hiển thị</span><span>${fmt(b.h, 1)} m${b.floors ? ` · ${b.floors} tầng` : b.estFloors ? ` · ≈ ${b.estFloors} tầng (ước lượng)` : ''}</span>
        <span>Phương pháp xác định chiều cao</span><span style="color:${hs.color}">${esc(hs.label)}</span>
        <span>Dải prior / chuyển đổi</span><span class="small">${esc(b.prior)}</span>
        <span>Diện tích mặt bằng</span><span>${fmtInt(b.area)} m² · ${b.pts.length} đỉnh</span>
        <span>Nền hiển thị 3D</span><span>LOD1 ép khối theo mặt bằng thật</span>
        <span>Cao độ nền</span><span>${canSeeElevation() ? fmt(b.ground, 2) + ' m' : '≈ ' + Math.round(b.ground) + ' m (làm tròn – độ cao chi tiết theo phân quyền)'}</span>
        <span>Ghi chú cao độ</span><span class="small">DEM SRTM/Terrarium 30 m đã lọc trung vị — vẫn là DSM, không phải DTM</span>
        <span>Nguồn mặt bằng</span><span class="small">${b.fp === 'osm' ? 'OpenStreetMap buildings (S-BLD-04, lớp tạm)' : 'Phương án biên tập của người dùng'}</span>
        <span>Bản ghi gốc</span><span>${osmUrl ? `<a href="${osmUrl}" target="_blank" rel="noopener">osm:${b.osm}</a>` : '—'}</span>
        <span>Năm xây dựng (start_date)</span><span>${b.year || NA}</span>
        <span>Ngày tải dữ liệu</span><span>${c.gis.fetched}</span>
        <span>Giấy phép nguồn / mô hình</span><span class="small">${b.osm ? 'ODbL 1.0 · © OpenStreetMap contributors' : 'Nội bộ dự án'} / Nội bộ nền tảng</span>
        <span>Thời điểm mô hình</span><span>${DATASET_VERSION}</span>
        <span>Phần mẫu đủ điều kiện</span><span>— (chỉ áp dụng chiều cao suy luận ảnh)</span>
        <span>Độ phân tán mẫu</span><span class="small">${spread}</span>
        <span>Độ tin cậy (confidence)</span><span>${b.conf}</span>
        <span>Ô quy hoạch (mô phỏng)</span><span>${zn.id} · ${esc(ZONE_CLASSES[zn.cls].name)}</span>
        <span>Diện mạo & vật liệu</span><span>${{ glass: 'Kính', concrete: 'Bê tông', plaster: 'Tường sơn', brick: 'Gạch', metal: 'Mái tôn/kim loại' }[b.mat]}</span>
        <span>Mức chi tiết theo vị trí</span><span>LOD1 (LOD2 khi có ảnh nghiêng; LOD3 khi có BIM/drone)</span>
      </div>
      <button class="btn pri" style="margin-top:8px" data-act="reportBuilding">📄 Dùng cho Hồ sơ AI</button><p class="small muted">Nạp thông tin công trình và nguồn dữ liệu; bổ sung thông tin còn thiếu tại Hồ sơ AI.</p>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="anaHere" data-x="${b.x}" data-z="${b.z}">📊 Phân tích tại đây</button><button class="btn sm" data-act="task">🗂 Tạo công việc</button><button class="btn sm pri" data-act="editB">🛠 Biên tập công trình</button></div>`;
  }
  if (s.type === 'zone') return zoneDetail(s.idx);
  if (s.type === 'bridge') {
    const runs = getState().twin.runs.filter((r) => r.scenarioId === 'BR-01');
    return `<h4>🌉 Cầu BR-01 — mô hình kiểm thử Digital Twin</h4><div class="small muted">DA-2026-031 · ${esc(c.wards[wardAt(c.bridge.x, c.bridge.z)].name)} · TP.HCM</div>
      <div class="mt prov"><span>Chiều dài</span><span>${Math.round(c.bridge.length)} m · ${c.bridge.spans} nhịp</span><span>Bề rộng mặt cầu</span><span>${c.bridge.width} m · ${c.bridge.lanes} làn</span><span>Tĩnh không</span><span>${c.bridge.clearance} m</span><span>Vị trí</span><span class="small">Vượt sông Sài Gòn (khổ sông đo trên OSM ≈ ${c.bridge.span} m) — <b>vị trí minh họa</b>, không phải dự án thật</span><span>Mức chi tiết</span><span>LOD3 (BIM/IFC từ MOD-03)</span><span>Hệ tọa độ</span><span class="small">VN-2000 ↔ WGS84 (${localToLonLat('hcm', c.bridge.x, c.bridge.z).map((v) => v.toFixed(5)).join(', ')})</span><span>Nguồn mô hình</span><span>Hồ sơ thiết kế mẫu (DS-IFC-001)</span><span>Giấy phép</span><span>Nội bộ dự án</span><span>Kịch bản liên quan</span><span>BR-01…BR-05</span><span>Run đã có</span><span>${runs.length}</span></div>
      <div class="disclaimer">Hoạt họa xe là L0 minh họa. Kết luận chịu tải cần solver L2 + V&V và kỹ sư có thẩm quyền (L3).</div>
      <button class="btn pri" data-act="openBR">▶ Mở dự án/kịch bản BR-01</button> <button class="btn sm" data-act="editProj">🛠 Biên tập mô hình cầu</button>
      <div class="row"><a class="btn sm" href="#stage-gate">🚦 Stage-Gate</a><button class="btn sm" data-act="dashProj">📊 Dashboard dự án</button></div>`;
  }
  if (s.type === 'site' || (s.type === 'project' && s.id === 'DA-2026-017')) {
    const T = getState().twin, cg = currentGate();
    return `<h4>📍 ${esc(P.name)}</h4><div class="small muted">${esc(P.code)} · ${esc(P.ward)} · ${esc(tname(P.tenant))}</div>
      <div class="mt prov"><span>Mã ĐVHC</span><span class="small">${esc(P.maDvhc)}</span><span>Cổng hiện tại</span><span>${cg.id} – ${esc(cg.name)}</span><span>dataVersion</span><span>${esc(T.dataVersionId || NA)}</span><span>modelVersion</span><span>${esc(T.modelVersionId || NA)}</span><span>Ảnh/orthomosaic</span><span>${T.dataReady ? 'MOD-01 · nhãn nguồn + ngày bay' : NA}</span><span>Mức chi tiết</span><span>LOD3 (drone/BIM)</span></div>
      <div class="row"><button class="btn sm" data-act="editProj">🛠 Biên tập mô hình khu đất</button><a class="btn pri sm" href="#twin?mode=plan">🧊 Mở Digital Twin (MOD-01/02)</a><a class="btn sm" href="#stage-gate">🚦 Stage-Gate</a><a class="btn sm" href="#docs">📝 Hồ sơ AI</a></div>`;
  }
  if (s.type === 'project') {
    const p = c.projects.find((q) => q.id === s.id);
    return `<h4>📌 ${esc(p.id)}</h4><p>${esc(p.name)}</p><div class="mt"><span>Địa bàn</span><span>${esc(p.ward)}</span><span>Cổng</span><span>${p.gate}</span><span>Nhóm</span><span>${p.group}</span><span>Rủi ro tiến độ/ngập/vật liệu</span><span>${p.risk.schedule}/${p.risk.flood}/${p.risk.material}</span><span>Nguồn</span><span>Danh mục dự án AIPM OS (mô phỏng)</span></div><a class="btn sm" href="#stage-gate">🚦 Mở Stage-Gate</a>`;
  }
  if (s.type === 'facility') {
    const f = c.facilities.find((q) => q.id === s.id);
    return `<h4>🏥 ${esc(f.name)}</h4><div class="mt"><span>Loại</span><span>${esc(f.typeName)}</span><span>Địa bàn</span><span>${esc(c.wards[f.ward].name)}</span><span>Quy mô có kỳ</span><span>${f.capacity ? fmtInt(f.capacity) + ' (2026)' : NA}</span><span>Năng lực hiện thời</span><span>${NA}</span><span>Lỗi xác minh</span><span>${esc(f.issue || 'Không')}</span><span>Nguồn</span><span>S-FAC-01</span></div>`;
  }
  if (s.type === 'ground') {
    const wd = c.wards[wardAt(s.x, s.z)], g = groundAt(c.det, s.x, s.z), ll = localToLonLat(ui.tenant, s.x, s.z);
    const near = c.buildings.filter((b) => Math.hypot(b.x - s.x, b.z - s.z) < 250);
    return `<h4>📍 Dữ liệu tại vị trí</h4><div class="mt"><span>Xã/phường</span><span>${esc(wd.name)}</span><span>Mã ĐVHC / ranh</span><span class="small">${esc(wd.id)} · ranh OSM (lớp tạm)</span><span>WGS84</span><span>${ll.map((v) => v.toFixed(5)).join(', ')}</span><span>Cao độ nền</span><span>${canSeeElevation() ? fmt(g, 2) + ' m (DEM tạm, DSM)' : '≈ ' + Math.round(g) + ' m · chi tiết theo phân quyền'}</span><span>Mảnh trong bán kính 250 m</span><span>${near.length}</span><span>Ảnh nền</span><span class="small">${esc(BASEMAPS[map.basemap].label)} ${imgLine()}</span><span>Sử dụng đất (OSM)</span><span>${esc(c.gis.classes[landAt(s.x, s.z)] || 'Chưa gắn nhãn')}</span><span>Ô quy hoạch (mô phỏng)</span><span>${c.zones[zoneIdx(s.x, s.z)].id}</span><span>Mức chi tiết</span><span>LOD1</span></div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="anaHere" data-x="${s.x}" data-z="${s.z}">📊 Phân tích tại đây</button></div>`;
  }
  return '';
}
function regionDataHtml(c) {
  const by = Object.fromEntries(Object.keys(HEIGHT_SOURCES).map((k) => [k, c.buildings.filter((b) => b.src === k).length]));
  return `<h4>Dữ liệu trong khu vực · ${esc(tname(ui.tenant))}</h4><p class="small muted">${esc(c.det.focusName)} · ${esc(c.det.communeNote)}</p>
    <div class="mt"><span>Công trình OSM trong cảnh</span><span>${fmtInt(c.baseCount)}${c.buildings.length > c.baseCount ? ` + ${c.buildings.length - c.baseCount} khối phương án` : ''}</span><span>Ngày tải dữ liệu</span><span>${c.gis.fetched}</span><span>Toàn tenant</span><span class="small">${esc(c.det.buildingsTotal)}</span>${Object.entries(by).map(([k, v]) => `<span><i class="dot" style="background:${HEIGHT_SOURCES[k].color}"></i>${esc(HEIGHT_SOURCES[k].label)}</span><span>${fmtInt(v)}</span>`).join('')}</div>
    <h5 style="margin:10px 0 4px">Xã/phường trong cảnh (${c.wards.length}/${c.det.communes})</h5>
    <div class="scroll" style="max-height:220px"><table class="tb small">${c.wards.map((w) => `<tr data-ward="${w.idx}" class="click"><td>${esc(w.name)}</td><td class="muted">${w.id}</td><td class="r">${fmtInt(c.buildings.filter((b) => b.ward === w.idx).length)}</td></tr>`).join('')}</table></div>
    <p class="small muted">Ranh hiển thị: OpenStreetMap admin_level 6 (sau sắp xếp 2025, lớp tạm S-ADM-02, © OpenStreetMap contributors). Polygon pháp lý: <b>Chưa lấy được polygon pháp lý</b> (S-ADM-01 chỉ metadata).</p>
    <div class="disclaimer">Độ phủ mặt bằng công trình OSM <b>chưa đầy đủ</b>: khu có nhà trên ảnh vệ tinh nhưng không có khối 3D là nhà chưa được số hóa — không phải đất trống. Thống kê theo mảnh chỉ phản ánh phần đã số hóa.</div>`;
}
function analysisSummary() {
  const a = ui.analysis;
  return `<h4>Kết quả phân tích khu vực</h4><div class="mt"><span>Hình</span><span>${a.shape.type === 'circle' ? `Tròn r=${fmtInt(a.shape.r)} m` : `Đa giác ${a.shape.pts.length} đỉnh`}</span><span>Diện tích vùng</span><span>${fmt(a.area / 1e6, 3)} km²</span><span>Số ID công trình</span><span>${fmtInt(a.count)}</span><span>ID có chiều cao nguồn</span><span>${fmtInt(a.fromSource)}</span><span>ID chiều cao ước tính</span><span>${fmtInt(a.estimated)}</span><span>Trung vị chiều cao</span><span>${a.median == null ? NA : fmt(a.median, 1) + ' m'}</span><span>Mật độ</span><span>${fmtInt(a.density)} ID/km²</span><span>Phiên dữ liệu</span><span>${a.dataVersion}</span></div><button class="btn sm" data-act="goAnalysis">Mở chi tiết</button> <button class="btn sm" data-act="exportA">⬇ Xuất CSV</button>`;
}
function layersHtml() {
  const L = map.layers, c = city();
  const t = (k, l, extra = '') => `<label class="lyr"><input type="checkbox" data-l="${k}" ${L[k] ? 'checked' : ''}> ${l}${extra}</label>`;
  const recent = c ? Math.round(68 + (c.det.seed % 9)) : null;
  return `<h4>Chế độ cảnh</h4><div class="steps">${[['day', '☀ Ngày'], ['golden', '🌅 Giờ vàng'], ['night', '🌙 Đêm']].map(([k, l]) => `<button data-mode="${k}" class="${ui.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <h4 style="margin-top:10px">Nền bản đồ GIS</h4>
    <div class="bm-grid">${Object.entries(BASEMAPS).map(([k, b]) => `<button data-bm="${k}" class="${map.basemap === k ? 'on' : ''}">${{ sat: '🛰', hybrid: '🗺', street: '🛣', topo: '⛰', offline: '📴' }[k]} ${esc(b.label)}</button>`).join('')}</div>
    <div class="small" id="imgSt">${imgLine()}</div><div class="small muted">${esc(BASEMAPS[map.basemap].attr)}${map.basemap !== 'offline' ? ' · tile Web Mercator z16 + cận cảnh z18 khi phóng gần (cần Internet)' : ''}</div>
    <h4 style="margin-top:10px">Lớp bản đồ</h4>
    ${t('imagery', 'Hiện ảnh nền')}${t('buildings', 'Công trình 3D (OSM)')}${t('materialDetail', 'Vật liệu chi tiết tự động')}${t('water', 'Thủy hệ OSM (mặt nước)')}${t('jrc', 'Vùng đệm ven sông ≤ 80 m', ' <span class="badge orange">suy từ thủy hệ OSM · không phải ngập</span>')}${t('zoning', 'Ô quy hoạch & chỉ tiêu', ' <span class="badge orange">mô phỏng</span>')}${t('wardfill', 'Tô ranh xã/phường')}
    <label class="lyr"><input type="checkbox" id="hsrc" ${ui.colorMode === 'heightSource' ? 'checked' : ''}> Tô theo nguồn chiều cao</label>
    ${t('trueScale', 'Địa hình đúng tỷ lệ', ' <span class="small muted">(bỏ chọn = phóng đại ×3)</span>')}${t('wards', 'Ranh xã/phường (OSM, lớp tạm)')}${t('facilities', 'Cơ sở dịch vụ')}${t('projects', 'Dự án AIPM OS')}
    <label class="lyr"><input type="checkbox" id="flood" ${ui.floodOn ? 'checked' : ''}> Mưa · triều · ngập <span class="badge blue">MOD-02 UR-01 · L1</span></label>
    <label class="lyr ${hasElevRole() ? '' : 'locked'}"><input type="checkbox" id="elev" ${hasElevRole() ? '' : 'disabled'} ${canSeeElevation() ? 'checked' : ''}> Độ cao chi tiết (dữ liệu hạn chế) ${hasElevRole() ? '<span class="badge green">được cấp quyền · có nhật ký</span>' : '<span class="badge gray">🔒 cần quyền quản trị tỉnh</span>'}</label>
    ${c ? `<h4 style="margin-top:10px">Độ phủ và chất lượng tại vị trí</h4><div class="mt"><span>Ngày pixel cập nhật</span><span>05–28/10/2026</span><span>% ô có pixel mới</span><span>${recent}%</span>${Object.entries(HEIGHT_SOURCES).map(([k, h]) => `<span>Mảnh · ${esc(h.label)}</span><span>${fmtInt(c.buildings.filter((b) => b.src === k).length)}</span>`).join('')}<span>Registry màu tường/mái</span><span>5 lớp vật liệu</span></div>
    <h4 style="margin-top:10px">Nguồn ảnh và chất lượng đô thị</h4><div class="mt"><span>Ảnh nền hiển thị</span><span>${esc(BASEMAPS[map.basemap].label)}</span><span>Ảnh phân tích</span><span>Sentinel-2 L2A (lọc mây SCL + đệm 60 m)</span><span>Công trình</span><span>OSM · tải ${c.gis.fetched}</span><span>Ảnh nghiêng (LOD2)</span><span>${NA}</span><span>UAV</span><span>Chỉ phủ cục bộ (khu dự án)</span></div>` : '<p class="small muted">Chọn tỉnh/thành có nền 3D để xem độ phủ tại vị trí.</p>'}
    <h4 style="margin-top:10px">Mức chi tiết lũy tiến</h4>${LOD_LEVELS.map(([k, l]) => `<div class="small"><b>${k}</b> · ${esc(l)}</div>`).join('')}`;
}
function sourcesHtml() {
  const list = SOURCES.filter((s) => (ui.srcScope === 'all' || s.scope === ui.srcScope) && (ui.srcTheme === 'all' || s.theme === ui.srcTheme));
  const themes = [...new Set(SOURCES.map((s) => s.theme))];
  const tone = { 'xác thực': 'green', 'chỉ metadata': 'blue', rỗng: 'gray', 'sai cấu trúc': 'red', 'chưa đọc được': 'orange' };
  return `<h4>Danh mục nguồn · độ phủ · giới hạn</h4><p class="small muted">Tenant: ${esc(ui.tenant ? tname(ui.tenant) : 'Toàn quốc')} · Nguồn chính thức của địa phương luôn được ưu tiên; nguồn mở chỉ là lớp tạm.</p>
    <div class="row"><select id="srcScope"><option value="all">Phạm vi: tất cả</option><option ${ui.srcScope === 'Nguồn nền' ? 'selected' : ''}>Nguồn nền</option><option ${ui.srcScope === 'Chiến dịch' ? 'selected' : ''}>Chiến dịch</option></select><select id="srcTheme"><option value="all">Chủ đề: tất cả</option>${themes.map((t) => `<option ${ui.srcTheme === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><button class="btn sm" data-act="srcCsv">⬇ CSV</button></div>
    <div class="col" style="margin-top:8px">${list.map((s) => `<details class="src"><summary><b>${s.id}</b> ${esc(s.name)} <span class="badge ${tone[s.status] || 'gray'}">${esc(s.status)}</span></summary><div class="mt">
      <span>Nhà cung cấp</span><span>${esc(s.provider)}</span><span>Độ phủ</span><span>${esc(s.coverage)}</span><span>Lấy mẫu nguồn</span><span>${esc(s.srcSampling)}</span><span>Lấy mẫu hiển thị</span><span>${esc(s.dispSampling)}</span><span>Ngày quan sát</span><span>${esc(s.observed)}</span><span>Phiên/tải</span><span>${esc(s.session)}</span><span>Giấy phép</span><span>${esc(s.licence)}</span><span>Tái phân phối</span><span>${esc(s.redistribution)}</span><span>Ghi công</span><span class="small">${esc(s.attribution)}</span><span>Điều kiện xác minh</span><span class="small">${esc(s.verify)}</span></div></details>`).join('')}</div>`;
}
function docsHtml() {
  const list = PLAN_DOCS.filter((d) => !ui.tenant || d.tenant === ui.tenant);
  return `<h4>Tài liệu quy hoạch có nguồn</h4><p class="small muted">Chỉ phủ lên 3D khi có lớp hình học quy hoạch đã georeference và kiểm định; không tự tạo "thành phố tương lai" từ tài liệu tham khảo.</p>
    ${list.map((d) => `<div class="task"><h5>${esc(d.title)}</h5><div class="mt"><span>Số / ngày</span><span>${esc(d.no)} · ${esc(d.date)}</span><span>Hình học</span><span>${esc(d.geometry)}</span><span>Chữ ký</span><span>${esc(d.signature)}</span><span>Quyền sử dụng</span><span>${esc(d.rights)}</span><span>Kỳ hiệu lực</span><span>${esc(d.validity)}</span><span>Khả năng sử dụng nguồn</span><span>${esc(d.head)}</span></div>
      <div class="row">${d.overlay ? `<label class="lyr"><input type="checkbox" data-l="planning" ${map.layers.planning ? 'checked' : ''}> Phủ ranh đồ án lên 3D</label>` : '<span class="badge gray">Không đủ điều kiện phủ 3D</span>'}<a class="btn sm" href="#legal">⚖ Kiểm tra hiệu lực (MOD-05)</a></div></div>`).join('') || '<p class="small muted">Chọn tỉnh/thành để xem tài liệu.</p>'}`;
}
function bindInfo(el) {
  el.querySelectorAll('[data-l]').forEach((c) => (c.onchange = () => { map.setLayer(c.dataset.l, c.checked); legend(); if (ui.group === 'plan') drawPanel(); if (c.dataset.l === 'trueScale') { if (ui.shape) map.setShape(ui.shape); if (ui.floodOn && ui.ur) map.setFlood(ui.ur.level); } drawInfo(); }));
  el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { ui.mode = b.dataset.mode; map.setMode(ui.mode); drawInfo(); }));
  el.querySelectorAll('[data-bm]').forEach((b) => (b.onclick = () => { const k = b.dataset.bm; setState((s) => (s.map.basemap = k), true); ui.img = null; if (ui.level === 'city') map.setBasemap(k); else { map.basemap = k; goTenant(ui.tenant, { fly: false }); } drawInfo(); toast(`Nền bản đồ: ${esc(BASEMAPS[k].label)}`); }));
  const hs = el.querySelector('#hsrc');
  if (hs) hs.onchange = () => { ui.colorMode = hs.checked ? 'heightSource' : 'material'; map.setColorMode(ui.colorMode); legend(); };
  const fl = el.querySelector('#flood');
  if (fl) fl.onchange = () => {
    if (!city()) { fl.checked = false; return toast('Chọn tỉnh/thành có nền 3D', 'warn'); }
    ui.floodOn = fl.checked;
    if (ui.floodOn && !ui.ur) runUR01({ rain: 120, tide: 1.6, hours: 3, drain: 40 });
    else { map.setFlood(ui.floodOn ? ui.ur.level : null); if (!ui.floodOn) map.setOverlay(null); floodTag(); }
  };
  const ev = el.querySelector('#elev');
  if (ev) ev.onchange = () => { ui.elev = ev.checked; if (ev.checked) logElevationAccess('Bật lớp độ cao chi tiết'); toast(ev.checked ? 'Đã bật độ cao chi tiết (2 chữ số thập phân trong Thông tin công trình) — đã ghi nhật ký truy cập' : 'Đã tắt — cao độ hiển thị làm tròn'); drawInfo(); };
  el.querySelector('#srcScope')?.addEventListener('change', (e) => { ui.srcScope = e.target.value; drawInfo(); });
  el.querySelector('#srcTheme')?.addEventListener('change', (e) => { ui.srcTheme = e.target.value; drawInfo(); });
  el.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act, b.dataset)));
  el.querySelectorAll('[data-ward]').forEach((r) => (r.onclick = () => { const w = city().wards[+r.dataset.ward]; map.flyTo(w.cx, w.cz, 2300); ui.sel = { type: 'ground', x: w.cx, z: w.cz }; drawInfo(); topState(); }));
}
function act(a, d) {
  if (a === 'reportBuilding') {
    const c = city(), b = c?.buildings[ui.sel?.i];
    if (ui.sel?.type !== 'building' || !b || b.deleted) return;
    const snapshot = buildingReportSource({ ...b, ground: canSeeElevation() ? b.ground : Math.round(b.ground) }, {
      tenant: ui.tenant, province: tname(ui.tenant), location: `${c.wards[b.ward].name}, ${tname(ui.tenant)}`,
      boundary: b.pts.map(([x, z]) => localToLonLat(ui.tenant, x, z)),
      heightSource: HEIGHT_SOURCES[b.src], zone: c.zones[b.zone], fetched: c.gis.fetched,
      datasetVersion: DATASET_VERSION, preciseElevation: canSeeElevation(), groundNote: 'DEM SRTM/Terrarium 30 m, DSM; không phải DTM' });
    setState((s) => {
      const report = s.report || { inputs: {} }, old = report.inputs?.model_scope === 'map' ? report.building?.building.id : 'project';
      const inputsBySource = { ...report.inputsBySource, [old]: report.inputs };
      s.report = { ...report, building: snapshot, inputsBySource,
        inputs: { ...inputsBySource[b.id], model_scope: 'map' } };
    }, true);
    location.hash = 'docs';
    toast('Đã nạp công trình. Chọn mẫu để tạo hồ sơ.', 'ok');
  }
  else if (a === 'enter') goTenant(d.id);
  else if (a === 'goAnalysis') { ui.group = 'analysis'; drawPanel(); topState(); }
  else if (a === 'anaHere') runAnalysis({ type: 'circle', cx: +d.x, cz: +d.z, r: Math.sqrt((ui.radius * 1e6) / Math.PI) });
  else if (a === 'exportA') exportAnalysis();
  else if (a === 'task') { ui.group = 'ops'; ui.opsTab = 'report'; drawPanel(); }
  else if (a === 'openBR') { setState((s) => { s.twin.selectedScenario = 'BR-01'; s.twin.runConfig.level = 'L1'; }); location.hash = 'twin?mode=simulation&scenario=BR-01&from=map'; }
  else if (a === 'dashProj') openDash('projects');
  else if (a === 'editB' || a === 'editProj') { ui.group = 'edit'; ui.editTab = a === 'editB' ? 'bld' : 'proj'; drawPanel(); topState(); }
  else if (a === 'zoneHi') { const zi = +d.z; map.setOverlay(new Map(city().buildings.filter((b) => !b.deleted && b.zone === zi).map((b) => [b.i, '#2563eb'])), true); }
  else if (a === 'zoneAna') runAnalysis({ type: 'poly', pts: city().zones[+d.z].poly });
  else if (a === 'zoneEdit') { const z = city().zones[+d.z]; ui.group = 'edit'; ui.editTab = 'bld'; map.flyTo(z.cx, z.cz, 650, 900, { tilt: 0.6 }); drawPanel(); topState(); }
  else if (a === 'srcCsv') download(`Registry_nguon_${ui.tenant || 'toanquoc'}.csv`, toCSV(SOURCES), 'text/csv;charset=utf-8');
}

// ------------------------------------------------------------------ nhóm chức năng (thanh bên)
function drawPanel() {
  const el = root.querySelector('#gp');
  if (!el) return;
  root.querySelectorAll('[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === ui.group));
  el.hidden = !ui.group;
  setTimeout(() => map?.resize(), 0);
  if (!ui.group) return;
  const c = city();
  const needCity = `<div class="disclaimer">Chọn <b>TP. Hồ Chí Minh</b> hoặc <b>Đồng Nai</b> (tenant có nền 3D) để dùng chức năng này. Tenant khác hiển thị "${NA}".</div><div class="row"><button class="btn sm pri" data-ten="hcm">TP.HCM</button><button class="btn sm pri" data-ten="dong-nai">Đồng Nai</button></div>`;
  const title = GROUPS.find((g) => g[0] === ui.group);
  let h = `<div class="ph" style="margin-bottom:8px"><h3>${title ? title[1] + ' ' + title[2] : ''}</h3><button class="btn sm" data-close>✕</button></div>`;
  const G = ui.group;
  if (G !== 'future' && !c) h += needCity;
  else if (G === 'data') h += regionDataHtml(c) + `<button class="btn sm" data-goinfo="sources">📚 Mở registry nguồn</button>`;
  else if (G === 'analysis') h += analysisPanel(c);
  else if (G === 'region') h += regionPanel(c);
  else if (G === 'area') h += `<p class="small muted">Khu vực trọng điểm của ${esc(tname(ui.tenant))}</p>${c.pois.map((p, i) => `<button class="btn" data-poi="${i}" style="justify-content:flex-start">📍 ${esc(p.name)}</button>`).join('')}<div class="row" style="margin-top:8px"><button class="btn pri" data-tour="area">▶ Bay tự động qua các khu vực</button>${ui.touring ? '<button class="btn danger" data-stop>■ Dừng</button>' : ''}</div>`;
  else if (G === 'tour') h += `<p class="small muted">Tham quan: camera bay tự động qua các điểm, có thuyết minh. Bấm Dừng bất cứ lúc nào.</p><ol class="small">${c.pois.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ol><div class="row"><button class="btn pri" data-tour="tour">🎥 Bắt đầu tham quan</button>${ui.touring ? '<button class="btn danger" data-stop>■ Dừng</button>' : ''}</div><div id="tourNow" class="small"></div>`;
  else if (G === 'plan') h += zoningPanel() + docsHtml() + `<div class="disclaimer">Liên kết MOD-05: mọi tài liệu phải được kiểm tra hiệu lực tại thời điểm sử dụng.</div>`;
  else if (G === 'edit') h += editPanel();
  else if (G === 'svc') h += svcPanel(c);
  else if (G === 'future') h += futurePanel();
  else if (G === 'ops') h += opsPanel(c);
  el.innerHTML = h;
  bindPanel(el);
}
function analysisPanel(c) {
  const a = ui.analysis;
  let h = `<div class="row"><label class="f">Bán kính theo diện tích<select id="rad">${[0.25, 0.5, 1, 2].map((v) => `<option value="${v}" ${ui.radius === v ? 'selected' : ''}>${v} km²</option>`).join('')}</select></label></div>
    <div class="row" style="margin:6px 0"><button class="btn pri sm" data-a="center">🎯 Phân tích tại tâm</button><button class="btn sm" data-a="draw">✏️ Vẽ vùng</button>${a ? '<button class="btn sm" data-a="clear">✕ Xóa</button>' : ''}</div>`;
  if (!a) return h + '<p class="small muted">Tâm = điểm giữa màn hình bản đồ. Kết quả gắn nguồn, phiên dữ liệu và phương pháp.</p>';
  const tabs = [['overview', 'Tổng quan'], ['morph', 'Hình thái'], ['list', 'Công trình'], ['compare', 'So sánh']];
  h += `<div class="steps">${tabs.map(([k, l]) => `<button data-at="${k}" class="${ui.aTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const maxBin = Math.max(1, ...a.bins.map((b) => b.ids.length));
  const hist = `<div class="hist">${a.bins.map((b, i) => `<button data-bin="${i}" class="${ui.binSel === i ? 'on' : ''}"><span>${esc(b.label)}</span><i style="width:${(b.ids.length / maxBin) * 100}%"></i><b>${fmtInt(b.ids.length)}</b></button>`).join('')}</div><p class="small muted">Nhấp một cột để tô các công trình tương ứng trên bản đồ và lọc danh sách.</p>`;
  if (ui.aTab === 'overview') h += `<div class="mgrid">${kpi('Diện tích vùng', fmt(a.area / 1e6, 3) + ' km²', 'hình học vùng')}${kpi('Số ID công trình', fmtInt(a.count), 'S-BLD-01/02/03')}${kpi('ID có chiều cao nguồn', fmtInt(a.fromSource), 'nguồn + số tầng')}${kpi('ID chiều cao ước tính', fmtInt(a.estimated), 'ảnh + prior')}${kpi('Trung vị chiều cao', a.median == null ? null : fmt(a.median, 1) + ' m', 'provenance')}${kpi('Mật độ ID/km²', fmtInt(a.density), 'tính toán')}${kpi('Diện tích sàn ước tính', fmtInt(a.gfa) + ' m²', 'mảnh × số tầng', 'ước tính')}${kpi('Khoảng cách tới sông', fmtInt(a.distRiver) + ' m', 'S-WAT-01')}</div>
    <h5>Cơ cấu phương pháp chiều cao</h5>${Object.entries(a.methods).map(([k, v]) => `<div class="small"><i class="dot" style="background:${HEIGHT_SOURCES[k].color}"></i>${esc(HEIGHT_SOURCES[k].label)}: <b>${fmtInt(v)}</b> (${a.count ? fmt((v / a.count) * 100, 1) : 0}%)</div>`).join('')}
    <h5 style="margin-top:6px">Dự án AIPM OS trong vùng</h5>${a.projects.map((p) => `<div class="small">📌 <b>${p.id}</b> ${esc(p.name)}</div>`).join('') || '<div class="small muted">Không có</div>'}<div class="small muted">Xã/phường giao cắt: ${a.wardsHit.map(esc).join(', ')}</div>`;
  else if (ui.aTab === 'morph') h += `<h5>Biểu đồ hình thái chiều cao</h5>${hist}`;
  else if (ui.aTab === 'list') {
    const ids = ui.binSel != null ? new Set(a.bins[ui.binSel].ids) : null;
    const rows = a.list.filter((b) => !ids || ids.has(b.i)).sort((x, y) => y.h - x.h).slice(0, 60);
    h += `${ids ? `<div class="small">Lọc theo: <b>${esc(a.bins[ui.binSel].label)}</b> <button class="btn sm" data-bin="-1">bỏ lọc</button></div>` : ''}<div class="scroll" style="max-height:330px"><table class="tb small"><tr><th>ID</th><th>h (m)</th><th>Nguồn</th></tr>${rows.map((b) => `<tr class="click" data-bld="${b.i}"><td>${b.id}</td><td class="r">${fmt(b.h, 1)}</td><td><i class="dot" style="background:${HEIGHT_SOURCES[b.src].color}"></i>${b.src}</td></tr>`).join('')}</table></div><p class="small muted">Hiển thị ${rows.length}/${ids ? ids.size : a.count} (cao nhất trước). Nhấp dòng để bay tới công trình.</p>`;
  } else {
    const p = ui.prevAnalysis;
    const wd = c.wards[wardAt(a.shape.type === 'circle' ? a.shape.cx : a.shape.pts[0][0], a.shape.type === 'circle' ? a.shape.cz : a.shape.pts[0][1])];
    const ws = areaStats(c, { type: 'poly', pts: wd.poly });
    const col = (x) => `<td class="r">${fmt(x.area / 1e6, 2)}</td><td class="r">${fmtInt(x.count)}</td><td class="r">${x.median == null ? NA : fmt(x.median, 1)}</td><td class="r">${fmtInt(x.density)}</td>`;
    h += `<table class="tb small"><tr><th></th><th>km²</th><th>ID</th><th>h trung vị</th><th>ID/km²</th></tr><tr><td>Vùng hiện tại</td>${col(a)}</tr>${p ? `<tr><td>Vùng trước</td>${col(p)}</tr>` : ''}<tr><td>${esc(wd.name)} (toàn xã)</td>${col(ws)}</tr></table>`;
  }
  h += `<div class="row" style="margin-top:8px"><button class="btn sm" data-a="export">⬇ Xuất và tùy chọn (CSV + phương pháp)</button><button class="btn sm" data-a="save">💾 Lưu</button><button class="btn sm" data-a="toTask">🗂 Tạo công việc</button></div><p class="small muted">${esc(a.method)}</p>`;
  return h;
}
function regionPanel(c) {
  const themes = [['admin', 'Địa giới'], ['cover', 'Lớp phủ vật lý'], ['mgmt', 'Vùng quản lý'], ['import', 'Lớp nhập']];
  const regs = M().regions.filter((r) => r.tenant === ui.tenant);
  let h = `<div class="steps">${themes.map(([k, l]) => `<button data-rt="${k}" class="${ui.regionTheme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="f" style="margin-top:6px">Tô màu<select id="rcol"><option value="ward" ${ui.regionColor === 'ward' ? 'selected' : ''}>Phân biệt từng vùng</option><option value="type" ${ui.regionColor === 'type' ? 'selected' : ''}>Theo loại vùng</option><option value="area" ${ui.regionColor === 'area' ? 'selected' : ''}>Theo diện tích hình học</option><option value="none" ${ui.regionColor === 'none' ? 'selected' : ''}>Không tô</option></select></label><p class="small muted">Màu chỉ để phân biệt, không biểu thị rủi ro.</p>`;
  if (ui.regionTheme === 'admin') h += `<table class="tb small"><tr><th>Vùng</th><th>Mã</th><th>Loại</th><th>Diện tích</th></tr>${c.wards.map((w) => `<tr class="click" data-ward="${w.idx}"><td>${esc(w.name)}</td><td>${w.id}</td><td>${w.type}</td><td class="r">${fmt(w.area / 1e6, 2)} km²</td></tr>`).join('')}</table><p class="small muted">Ranh OSM (lớp tạm) · diện tích toàn phường · Chưa lấy được polygon pháp lý.</p>`;
  else if (ui.regionTheme === 'cover') h += `<div class="mt"><span>Nguồn</span><span>ESA WorldCover 10 m (S-LC-01)</span><span>Xây dựng</span><span>${NA}</span><span>Cây xanh</span><span>${NA}</span><span>Mặt nước</span><span>${NA}</span></div><p class="small muted">Lớp tham khảo; chưa nạp thống kê theo xã — hiển thị "${NA}".</p>`;
  else {
    const list = regs.filter((r) => (ui.regionTheme === 'import' ? r.source === 'Lớp nhập' : r.source !== 'Lớp nhập'));
    h += `<div class="row"><button class="btn sm pri" data-a="newRegion">＋ Tạo vùng quản lý</button><label class="btn sm">⬆ Nhập GeoJSON<input type="file" id="gjIn" accept=".json,.geojson" hidden></label><button class="btn sm" data-a="exportRegions">⬇ Xuất GeoJSON</button></div>
      <table class="tb small" style="margin-top:6px"><tr><th>Mã</th><th>Tên</th><th>Diện tích</th><th></th></tr>${list.map((r) => `<tr><td>${r.id}</td><td>${esc(r.name)}</td><td class="r">${fmt(r.area / 10000, 2)} ha</td><td><button class="btn sm" data-reg="${r.id}">📍</button><button class="btn sm" data-regana="${r.id}">📊</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Chưa có</td></tr>'}</table>`;
  }
  return h;
}
function svcPanel(c) {
  const f = c.facilities, q = f.filter((x) => x.issue);
  const groups = ['Định danh và địa bàn', 'Vị trí chưa đủ chứng cứ', 'Thiếu quy mô có kỳ', 'Nguồn mâu thuẫn'];
  return `<div class="mgrid">${kpi('Vị trí công bố', fmtInt(f.filter((x) => x.hasCoord).length), 'S-FAC-01 · 2026')}${kpi('Quy mô có kỳ', fmtInt(f.filter((x) => x.capacity).length), 'S-FAC-01')}${kpi('Chưa có tọa độ', fmtInt(f.filter((x) => !x.hasCoord).length), 'S-FAC-01')}${kpi('Năng lực hiện thời', null)}</div>
    <h5>Hàng đợi xác minh theo lỗi (${q.length})</h5>${groups.map((g) => `<details><summary>${esc(g)} <span class="badge orange">${q.filter((x) => x.issue === g).length}</span></summary>${q.filter((x) => x.issue === g).map((x) => `<div class="small">• ${esc(x.name)} — ${esc(c.wards[x.ward].name)} ${x.hasCoord ? `<button class="btn sm" data-fac="${x.id}">📍</button>` : '<span class="badge gray">không tọa độ</span>'}</div>`).join('')}</details>`).join('')}
    <h5 style="margin-top:8px">Mô phỏng phương án A/B bố trí cơ sở</h5><p class="small muted">So sánh số công trình trong bán kính phục vụ 800 m của một trạm y tế mới đặt tại A (tâm màn hình) hoặc B (tâm xã ít cơ sở nhất).</p><button class="btn sm" data-a="ab">▶ Chạy A/B</button><div id="abOut"></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-a="facCsv">⬇ Xuất dữ liệu và phương pháp</button><label class="lyr"><input type="checkbox" data-l2="facilities" ${map.layers.facilities ? 'checked' : ''}> Hiện cơ sở trên bản đồ</label></div>`;
}
function futurePanel() {
  const cats = ['Toàn mạng', 'Hàng không', 'Đường bộ', 'Đường sắt', 'Cảng – logistics'];
  const sel = FUTURE.find((x) => x.id === ui.futureSel);
  let h = `<p class="small muted">Danh mục dự án hạ tầng liên vùng và đô thị (tên mẫu, số liệu mô phỏng). Viền cam "đã qua mốc · đang đối chiếu" <b>không</b> đồng nghĩa hoàn thành.</p>`;
  h += cats.map((c) => `<h5 style="margin:6px 0 2px">${c}</h5>${FUTURE.filter((x) => x.cat === c).map((x) => `<button class="fut ${x.passedMilestone ? 'passed' : ''} ${ui.futureSel === x.id ? 'on' : ''}" data-fut="${x.id}"><b>${esc(x.name)}</b><span>Mốc ${x.milestone} · ${x.progress}% · ${x.parent ? 'hồ sơ con của ' + x.parent : 'hồ sơ mẹ'}</span><div class="bar ${x.lateRisk > 1 ? 'o' : 'g'}"><i style="width:${x.progress}%"></i></div></button>`).join('')}`).join('');
  if (sel) {
    const tabs = [['map', 'Bản đồ'], ['prog', 'Tiến độ'], ['conn', 'Kết nối'], ['src', 'Nguồn'], ['rec', 'Ghi nhận'], ['goal', 'Mục tiêu'], ['assume', 'Giả định']];
    const body = {
      map: `<p class="small">Tenant: ${esc(tname(sel.tenant))}. ${TENANT_DETAIL[sel.tenant] ? `<button class="btn sm" data-ten="${sel.tenant}">📍 Mở trên bản đồ</button>` : NA}</p>`,
      prog: `<div class="mt"><span>Tiến độ % theo hạng mục</span><span>${sel.progress}%</span><span>Gói nguy cơ trễ</span><span>${sel.lateRisk}</span><span>Tỷ lệ thực hiện/hợp đồng</span><span>${fmt(sel.execRatio * 100, 0)}%</span><span>Mốc công bố</span><span>${sel.milestone}</span></div>${sel.passedMilestone ? '<div class="disclaimer">⚠ Đã qua mốc — đang đối chiếu; không đồng nghĩa hoàn thành.</div>' : ''}`,
      conn: `<p class="small">Liên kết 17 cổng Stage-Gate & 4D (MOD-06): <a href="#stage-gate">Stage-Gate</a> · <a href="#timeline">Timeline 4D</a></p><p class="small">Hồ sơ con: ${FUTURE.filter((x) => x.parent === sel.id).map((x) => esc(x.name)).join(', ') || '—'}</p>`,
      src: `<p class="small">Nguồn: công bố của chủ đầu tư/cơ quan quản lý — <b>${NA}</b> (chưa kết nối). Số liệu hiển thị là mô phỏng.</p>`,
      rec: `<p class="small">Ghi nhận hiện trường gần nhất: ${NA}</p>`,
      goal: '<p class="small">Mục tiêu: kết nối vùng, giảm thời gian di chuyển (chỉ tiêu cụ thể: Chưa có).</p>',
      assume: '<p class="small">Giả định: tiến độ % là tỷ lệ khối lượng có trọng số theo hạng mục; mốc theo công bố mới nhất (cần đối chiếu).</p>',
    };
    h += `<div class="task"><h5>${esc(sel.name)}</h5><div class="steps">${tabs.map(([k, l]) => `<button data-ft="${k}" class="${ui.futureTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body[ui.futureTab]}<button class="btn sm" data-a="futExport">⬇ Xuất hồ sơ + nguồn</button></div>`;
  }
  return h;
}
function opsPanel(c) {
  const tabs = [['region', 'Vùng'], ['svc', 'Dịch vụ'], ['scenario', 'Kịch bản'], ['img', 'Ảnh'], ['report', 'Báo cáo']];
  let h = `<div class="steps">${tabs.map(([k, l]) => `<button data-ot="${k}" class="${ui.opsTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const T = ui.opsTab, S0 = getState();
  if (T === 'region') {
    const themes = ['Dân cư', 'Y tế', 'Giáo dục', 'Đất đai', 'Doanh nghiệp', 'Kinh tế địa bàn', 'Ngân sách', 'Thủy lợi – quan trắc', 'Nguồn và cập nhật', 'Bàn điều hành theo địa bàn', 'Điều hành theo biến động', 'Cơ sở – năng lực – tiếp cận', 'Phương án A/B', 'Quy hoạch GIS – hồ sơ', 'Không gian quy hoạch', 'Thành phố tương lai'];
    const avail = { 'Y tế': 'S-FAC-01', 'Giáo dục': 'S-FAC-01', 'Nguồn và cập nhật': 'Registry', 'Cơ sở – năng lực – tiếp cận': 'S-FAC-01', 'Phương án A/B': 'MOD-00', 'Quy hoạch GIS – hồ sơ': 'TL-xx', 'Thành phố tương lai': 'FUTURE' };
    const late = S0.workflow.filter((w) => w.tenant === ui.tenant && w.at < w.route.length && w.days > w.sla);
    h += `<label class="f">Phạm vi thống kê<select id="opsScope"><option>Toàn ${esc(tname(ui.tenant))}</option>${c.wards.map((w) => `<option>${esc(w.name)}</option>`).join('')}</select></label>
      <div class="mgrid">${kpi('Luồng sự cố chính thức', null)}${kpi('Nguồn lực hiện thời', null)}${kpi('SLA cơ quan', null)}${kpi('Hồ sơ BPMN quá SLA', String(late.length), 'MOD-06 · thời gian thực')}</div>
      <h5>Bộ chuyên đề thống kê quản lý</h5><div class="themes">${themes.map((t) => `<span class="badge ${avail[t] ? 'green' : 'gray'}" title="${avail[t] ? 'Nguồn: ' + avail[t] : 'Chưa nối nguồn'}">${esc(t)}</span>`).join('')}</div>
      <h5 style="margin-top:8px">Hàng đợi điều phối · tiếp nhận sự kiện</h5>${late.map((w) => `<div class="small">🚨 ${w.id} ${esc(w.title)} — ${w.days}/${w.sla} ngày <button class="btn sm" data-fly="${w.loc}">📍</button></div>`).join('') || `<div class="small muted">Sự kiện chính thức: ${NA}</div>`}
      <h5 style="margin-top:8px">Mức sẵn sàng theo địa bàn</h5><table class="tb small">${c.wards.slice(0, 8).map((w) => { const n = c.facilities.filter((f) => f.ward === w.idx); const ok = n.filter((f) => !f.issue).length; return `<tr><td>${esc(w.name)}</td><td>Độ phủ vị trí cơ sở ${n.length ? fmt((ok / n.length) * 100, 0) + '%' : NA}</td><td>Đối soát nguồn mới: ${n.filter((f) => f.issue === 'Nguồn mâu thuẫn').length}</td></tr>`; }).join('')}</table>
      <button class="btn sm" data-a="paintOps">🎨 Tô bản đồ (xám = chưa nối nguồn)</button>`;
  } else if (T === 'svc') h += svcPanel(c);
  else if (T === 'scenario') {
    const sk = M().sketches.filter((x) => x.tenant === ui.tenant);
    const r = ui.ur;
    h += `<h5>Kịch bản khoanh vùng</h5><p class="small muted">Khoanh một hình (≤ 10 ha, ≤ 256 đỉnh), lưu thành phương án tách riêng khỏi nền hiện trạng — điểm nối sang AI sinh phương án quy hoạch (MOD-02).</p>
      <button class="btn sm pri" data-a="sketch">✏️ Khoanh phương án</button>
      ${sk.map((s) => `<div class="chk"><span class="i">🟩</span><div class="grow"><b>${s.id}</b> · ${fmt(s.area / 10000, 2)} ha · ${esc(s.ward)}<div class="small muted">nền ${s.base} · ${viDate(s.createdAt)}</div></div><button class="btn sm" data-sk="${s.id}">📍</button><a class="btn sm ai" href="#twin?mode=plan">🤖 MOD-02</a></div>`).join('')}
      <h5 style="margin-top:10px">UR-01 · Mưa lớn + triều cường (kịch bản khu vực)</h5><p class="small muted">Phạm vi: ${ui.shape ? 'vùng đang chọn trên bản đồ' : 'toàn cảnh'} · nền DEM SRTM/Terrarium · công trình OSM (vẽ vùng ở nhóm Phân tích để giới hạn).</p>
      <div class="grid g2" style="gap:6px">${[['rain', 'Lượng mưa', 120, 'mm/h'], ['tide', 'Mực triều/nước dâng', 1.6, 'm'], ['hours', 'Thời gian', 3, 'h'], ['drain', 'Năng lực tiêu thoát', 40, 'mm/h'], ['pump', 'Trạm bơm bổ sung', 0, 'mm/h'], ['slr', 'Nước biển dâng', 0, 'm'], ['imperv', 'Tỷ lệ bê tông hóa', 0.6, '0–1']].map(([k, l, v, u]) => `<label class="f">${l}<div class="input-unit"><input type="number" step="0.1" data-ur="${k}" value="${r?.inp?.[k] ?? v}"><span>${u}</span></div></label>`).join('')}</div>
      <button class="btn pri sm" data-a="ur01" style="margin-top:6px">▶ Chạy UR-01 (L1)</button>
      ${r ? `<div class="task"><div class="mt"><span>Mực nước proxy</span><span>${fmt(r.level, 2)} m</span><span>Công trình bị ảnh hưởng</span><span>${fmtInt(r.affected.length)}</span><span>Mức tin cậy</span><span>${r.trust} · sàng lọc</span></div>
        <div class="scroll" style="max-height:150px"><table class="tb small"><tr><th>ID</th><th>Xã/phường</th><th>Sâu proxy</th></tr>${r.affected.slice(0, 25).map((b) => `<tr class="click" data-bld="${b.i}"><td>${b.id}</td><td>${esc(c.wards[b.ward].name)}</td><td class="r">${fmt(b.depth, 2)} m</td></tr>`).join('')}</table></div>
        <div class="small">Liên kết từng công trình: ${r.links.map(([id, l]) => `<a href="#twin?mode=simulation&scenario=${id}">${id}</a> (${esc(l)})`).join(' · ')}</div><div class="disclaimer">${esc(r.note)}</div></div>` : ''}`;
  } else if (T === 'img') {
    const ds = S0.twin.datasets || [];
    h += `<div class="mgrid">${kpi('Địa bàn có pixel mới', `${Math.round(c.wards.length * 0.75)}/${c.wards.length}`, 'S-IMG-01')}${kpi('% phủ pixel hợp lệ (lưới 10 m)', `${68 + (c.det.seed % 9)}%`, 'S-IMG-01')}${kpi('Cửa sổ ngày chụp', '01/09–31/10/2026', 'S-IMG-01')}${kpi('Ảnh UAV', ds.length ? `${ds.length} bộ` : null, 'MOD-01')}</div>
      <div class="mt"><span>Phương pháp lọc mây</span><span>SCL (lớp 3, 8, 9, 10) + vùng đệm 60 m</span><span>Nguyên tắc cập nhật</span><span>Chỉ thay pixel đạt ngưỡng</span></div>
      <div class="disclaimer">UAV chỉ phủ cục bộ. Orthomosaic drone của từng dự án (MOD-01) được tiếp nhận tại đây với nhãn nguồn/ngày bay.</div>
      <h5>Orthomosaic dự án</h5>${ui.tenant === S0.project.tenant ? (S0.twin.dataReady ? `<div class="small">✅ ${esc(S0.project.code)} · ${esc(S0.twin.dataVersionId)} · nguồn: ${ds.map((d) => esc(d.source || d.name)).join(', ') || 'MOD-01'} · ngày bay: ${viDate(todayISO())}</div>` : `<div class="small muted">${esc(S0.project.code)}: ${NA} — <a href="#twin?mode=data">phát hành dataset ở MOD-01</a></div>`) : `<div class="small muted">${NA}</div>`}`;
  } else {
    const ctx = ui.analysis ? `Phân tích ${fmt(ui.analysis.area / 1e6, 2)} km² · ${ui.analysis.count} ID · ${DATASET_VERSION}` : ui.sel?.type === 'building' ? `Công trình ${c.buildings[ui.sel.i].id}` : ui.ur ? `UR-01 mực ${ui.ur.level} m` : `Khu vực ${tname(ui.tenant)}`;
    const logged = loggedFor(ui.tenant);
    h += `<p class="small muted">Tạo công việc/báo cáo từ vùng, chỉ số, phương án và ảnh đang chọn. Báo cáo giữ nguồn, phiên hình học, mức phủ, ngày ảnh.</p>
      ${logged ? `<span class="badge green">Đã đăng nhập địa bàn: ${esc(M().user?.ward || tname(ui.tenant))}</span>` : '<span class="badge orange">Chưa đăng nhập → lưu vào sổ công việc cục bộ trên thiết bị</span>'}
      <label class="f">Tên việc<input type="text" id="tkName" value="Rà soát ${esc(ctx)}"></label>
      <div class="grid g2" style="gap:6px"><label class="f">Người phụ trách<input type="text" id="tkOwner" value="${esc(M().user?.ward ? 'Cán bộ ' + M().user.ward : 'Chuyên viên Ban QLDA')}"></label><label class="f">Hạn xử lý<input type="date" id="tkDue" value="${new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)}"></label></div>
      <label class="f">Đẩy sang luồng BPMN (cổng)<select id="tkGate"><option value="">— Không —</option>${DATA.gates.map((g) => `<option value="${g.id}">${g.id} – ${esc(g.name)}</option>`).join('')}</select></label>
      <div class="small muted">Ngữ cảnh: ${esc(ctx)}</div>
      <div class="row"><button class="btn pri sm" data-a="mkTask">＋ Tạo công việc</button><button class="btn sm" data-a="repExport">⬇ Xuất báo cáo (JSON)</button></div>
      <h5 style="margin-top:8px">Công việc đô thị</h5>${taskTable()}
      <h5 style="margin-top:8px">Ánh xạ làn BPMN ↔ cơ quan (${esc(tname(ui.tenant))})</h5><table class="tb small"><tr><th>Làn</th><th>Cơ quan</th><th>SLA cấu hình</th></tr>${agencyMap(ui.tenant).map((a) => `<tr><td>${esc(LANES.find((l) => l.id === a.lane).short)}</td><td>${esc(a.agency)}<div class="muted">${esc(a.basis)}</div></td><td>${a.sla} ngày</td></tr>`).join('')}</table><p class="small muted">SLA là cấu hình demo — cần xác minh thời hạn pháp định.</p>`;
  }
  return h;
}
function bindPanel(el) {
  el.querySelector('[data-close]')?.addEventListener('click', () => { ui.group = null; drawPanel(); topState(); });
  el.querySelectorAll('[data-ten]').forEach((b) => (b.onclick = () => goTenant(b.dataset.ten)));
  el.querySelectorAll('[data-goinfo]').forEach((b) => (b.onclick = () => { ui.info = b.dataset.goinfo; drawInfo(); }));
  el.querySelectorAll('[data-ward]').forEach((r) => (r.onclick = () => { const w = city().wards[+r.dataset.ward]; map.flyTo(w.cx, w.cz, 2300); map.setShape({ type: 'poly', pts: w.poly, color: '#7c3aed' }); ui.sel = { type: 'ground', x: w.cx, z: w.cz }; drawInfo(); topState(); }));
  el.querySelectorAll('[data-poi]').forEach((b) => (b.onclick = () => { const p = city().pois[+b.dataset.poi]; map.flyTo(p.x, p.z, p.dist); }));
  el.querySelectorAll('[data-tour]').forEach((b) => (b.onclick = async () => {
    ui.touring = true; drawPanel();
    const done = await map.tour(city().pois, (p, i) => { const n = root.querySelector('#tourNow'); if (n) n.innerHTML = `🎥 ${i + 1}/${city().pois.length}: <b>${esc(p.name)}</b>`; toast(`🎥 ${esc(p.name)}`, 'info', 1800); });
    ui.touring = false; if (root?.isConnected) drawPanel();
    if (done) toast('Kết thúc tham quan', 'ok');
  }));
  el.querySelectorAll('[data-stop]').forEach((b) => (b.onclick = () => { map.stopTour(); ui.touring = false; drawPanel(); }));
  el.querySelectorAll('[data-at]').forEach((b) => (b.onclick = () => { ui.aTab = b.dataset.at; drawPanel(); }));
  el.querySelectorAll('[data-bin]').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.bin;
    ui.binSel = i < 0 || ui.binSel === i ? null : i;
    const a = ui.analysis;
    map.setOverlay(new Map((ui.binSel == null ? a.list.map((q) => q.i) : a.bins[ui.binSel].ids).map((id) => [id, ui.binSel == null ? '#0ea5e9' : '#f97316'])), true);
    if (ui.aTab === 'overview') ui.aTab = 'morph';
    drawPanel();
  }));
  el.querySelectorAll('[data-bld]').forEach((r) => (r.onclick = () => { const i = +r.dataset.bld; ui.sel = { type: 'building', i }; map.focusBuilding(i); ui.info = 'detail'; drawInfo(); topState(); }));
  el.querySelectorAll('[data-fac]').forEach((b) => (b.onclick = () => { const f = city().facilities.find((x) => x.id === b.dataset.fac); map.setLayer('facilities', true); map.flyTo(f.x, f.z, 700); ui.sel = { type: 'facility', id: f.id }; drawInfo(); }));
  el.querySelectorAll('[data-fly]').forEach((b) => (b.onclick = () => { const [x, z] = b.dataset.fly.split(',').map(Number); map.flyTo(x, z, 700); }));
  el.querySelectorAll('[data-sk]').forEach((b) => (b.onclick = () => { const s = M().sketches.find((x) => x.id === b.dataset.sk); map.setShape({ type: 'poly', pts: s.pts, color: '#16a34a' }); map.flyTo(s.pts[0][0], s.pts[0][1], 900); }));
  el.querySelectorAll('[data-reg]').forEach((b) => (b.onclick = () => { const r = M().regions.find((x) => x.id === b.dataset.reg); map.setShape({ type: 'poly', pts: r.pts, color: '#7c3aed' }); map.flyTo(r.pts[0][0], r.pts[0][1], 1400); }));
  el.querySelectorAll('[data-regana]').forEach((b) => (b.onclick = () => { const r = M().regions.find((x) => x.id === b.dataset.regana); runAnalysis({ type: 'poly', pts: r.pts }); }));
  el.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => { ui.regionTheme = b.dataset.rt; drawPanel(); }));
  el.querySelectorAll('[data-ot]').forEach((b) => (b.onclick = () => { ui.opsTab = b.dataset.ot; drawPanel(); }));
  el.querySelectorAll('[data-fut]').forEach((b) => (b.onclick = () => { ui.futureSel = b.dataset.fut; drawPanel(); }));
  el.querySelectorAll('[data-ft]').forEach((b) => (b.onclick = () => { ui.futureTab = b.dataset.ft; drawPanel(); }));
  el.querySelectorAll('[data-l2]').forEach((c) => (c.onchange = () => map.setLayer(c.dataset.l2, c.checked)));
  el.querySelectorAll('[data-l]').forEach((c) => (c.onchange = () => map.setLayer(c.dataset.l, c.checked)));
  el.querySelector('#rad')?.addEventListener('change', (e) => (ui.radius = +e.target.value));
  el.querySelector('#rcol')?.addEventListener('change', (e) => { ui.regionColor = e.target.value; applyRegionColor(); });
  el.querySelector('#gjIn')?.addEventListener('change', importGeoJSON);
  el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => panelAct(b.dataset.a, el)));
  el.querySelectorAll('[data-zone]').forEach((r) => (r.onclick = () => selectZone(+r.dataset.zone)));
  el.querySelector('#zColor')?.addEventListener('change', (e) => { ui.colorMode = e.target.checked ? 'zone' : 'material'; map.setColorMode(ui.colorMode); legend(); });
  el.querySelectorAll('[data-l]').forEach((c) => c.addEventListener('change', () => { legend(); if (ui.group === 'plan') drawPanel(); }));
  if (ui.group === 'edit' && city()) bindEdit(el);
}
function selectZone(idx) {
  const z = city().zones[idx];
  if (!map.layers.zoning) map.setLayer('zoning', true);
  ui.sel = { type: 'zone', idx, x: z.cx, z: z.cz };
  map.setZoneSel(idx);
  map.flyTo(z.cx, z.cz, 1100, 900, { tilt: 0.75 });
  ui.info = 'detail'; drawInfo(); topState(); legend();
}
function applyRegionColor() {
  if (!map.overlayMesh) return;
  const c = city(), maxA = Math.max(...c.wards.map((w) => w.area));
  map.wardColors = {};
  c.wards.forEach((w) => {
    const col = ui.regionColor === 'type' ? (w.type === 'xã' ? '#86efac' : w.type === 'đặc khu' ? '#fcd34d' : '#93c5fd') : ui.regionColor === 'area' ? `hsl(210,70%,${85 - (w.area / maxA) * 40}%)` : ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#818cf8', '#4ade80', '#e879f9', '#facc15', '#38bdf8', '#fca5a5', '#86efac', '#c4b5fd'][w.idx % 16];
    map.wardColors[w.idx] = col;
  });
  map.setLayer('wardfill', ui.regionColor !== 'none');
}
function importGeoJSON(e) {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      const j = JSON.parse(t);
      const feats = j.type === 'FeatureCollection' ? j.features : [j];
      let n = 0;
      setState((s) => feats.forEach((ft, k) => {
        const g = ft.geometry || ft;
        const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
        if (!ring) return;
        const pts = ring.map(([lon, lat]) => lonLatToLocal(ui.tenant, lon, lat));
        s.map.regions.push({ id: `NHAP-${String(s.map.regions.length + 1).padStart(3, '0')}`, name: ft.properties?.name || `${f.name} #${k + 1}`, tenant: ui.tenant, pts, area: polygonArea(pts), source: 'Lớp nhập', createdAt: todayISO() });
        n++;
      }));
      ui.regionTheme = 'import';
      toast(`Đã nhập ${n} vùng (CRS giả định WGS84 — cần khai báo CRS gốc)`, 'ok');
      drawPanel();
    } catch (err) { toast('Không đọc được GeoJSON: ' + esc(err.message), 'err'); }
  });
}
function panelAct(a, el) {
  const c = city();
  if (a === 'center') { const t = map.controls.target; runAnalysis({ type: 'circle', cx: t.x, cz: t.z, r: Math.sqrt((ui.radius * 1e6) / Math.PI) }); }
  else if (a === 'draw') startDraw('analysis');
  else if (a === 'clear') { ui.analysis = null; ui.shape = null; ui.binSel = null; map.setShape(null); map.setOverlay(null); drawPanel(); drawInfo(); }
  else if (a === 'export') exportAnalysis();
  else if (a === 'save') { setState((s) => s.map.analyses.unshift({ at: ui.analysis.at, tenant: ui.tenant, area: ui.analysis.area, count: ui.analysis.count, median: ui.analysis.median })); toast('Đã lưu kết quả phân tích', 'ok'); }
  else if (a === 'toTask') { ui.group = 'ops'; ui.opsTab = 'report'; drawPanel(); }
  else if (a === 'newRegion') startDraw('region');
  else if (a === 'exportRegions') {
    const regs = M().regions.filter((r) => r.tenant === ui.tenant);
    download(`VungQuanLy_${ui.tenant}.geojson`, JSON.stringify({ type: 'FeatureCollection', crs: 'EPSG:4326 (quy đổi từ hệ cục bộ cảnh mẫu)', features: regs.map((r) => ({ type: 'Feature', properties: { id: r.id, name: r.name, area_m2: Math.round(r.area), source: r.source }, geometry: { type: 'Polygon', coordinates: [[...r.pts, r.pts[0]].map(([x, z]) => localToLonLat(ui.tenant, x, z))] } })) }, null, 2), 'application/geo+json');
  } else if (a === 'sketch') startDraw('sketch');
  else if (a === 'ur01') { const inp = {}; el.querySelectorAll('[data-ur]').forEach((i) => (inp[i.dataset.ur] = +i.value)); runUR01(inp); }
  else if (a === 'paintOps') { ui.colorMode = ui.colorMode === 'gray' ? 'material' : 'gray'; map.setColorMode(ui.colorMode); legend(); toast(ui.colorMode === 'gray' ? 'Tô xám: chưa nối nguồn sự cố/nguồn lực — không tự tạo mức rủi ro' : 'Đã bỏ tô'); }
  else if (a === 'ab') {
    const t = map.controls.target;
    const low = c.wards.map((w) => ({ w, n: c.facilities.filter((f) => f.ward === w.idx && f.type === 'health').length })).sort((x, y) => x.n - y.n)[0].w;
    const cov = (x, z) => c.buildings.filter((b) => Math.hypot(b.x - x, b.z - z) <= 800).length;
    const A = cov(t.x, t.z), B = cov(low.cx, low.cz);
    map.setShape({ type: 'circle', cx: low.cx, cz: low.cz, r: 800, color: '#16a34a' });
    el.querySelector('#abOut').innerHTML = `<table class="tb small"><tr><th>PA</th><th>Vị trí</th><th>Công trình trong 800 m</th></tr><tr><td>A</td><td>Tâm màn hình</td><td class="r">${fmtInt(A)}</td></tr><tr><td>B</td><td>${esc(low.name)} (ít trạm y tế nhất)</td><td class="r">${fmtInt(B)}</td></tr></table><p class="small muted">Chỉ số tiếp cận proxy theo số mảnh công trình (không phải dân số — S-STAT-01 ${NA}).</p>`;
  } else if (a === 'facCsv') download(`CoSo_${ui.tenant}.csv`, toCSV(c.facilities.map((f) => ({ id: f.id, loai: f.typeName, ten: f.name, xa_phuong: c.wards[f.ward].name, co_toa_do: f.hasCoord ? 'có' : 'không', quy_mo: f.capacity ?? '', loi_xac_minh: f.issue || '', nguon: 'S-FAC-01', phuong_phap: 'Danh mục công bố, đối soát vị trí' }))), 'text/csv;charset=utf-8');
  else if (a === 'futExport') { const f = FUTURE.find((x) => x.id === ui.futureSel); download(`${f.id}_hoso_nguon.json`, JSON.stringify({ ...f, children: FUTURE.filter((x) => x.parent === f.id).map((x) => x.id), source: NA, note: 'Số liệu mô phỏng' }, null, 2), 'application/json'); }
  else if (a === 'mkTask') {
    const name = el.querySelector('#tkName').value, owner = el.querySelector('#tkOwner').value, due = el.querySelector('#tkDue').value, gate = el.querySelector('#tkGate').value;
    const t = map.controls.target, local = !loggedFor(ui.tenant);
    const id = `CV-${String(M().tasks.length + 1).padStart(3, '0')}`;
    const ctx = ui.analysis ? `Phân tích ${DATASET_VERSION}` : ui.ur ? 'UR-01' : ui.sel?.type || 'khu vực';
    setState((s) => {
      let wf = null;
      if (gate) { wf = 'HS-' + (300 + s.workflow.length); s.workflow.push({ id: wf, title: name, gate, route: ['CDT', 'TV', 'SXD', 'UB'], at: 0, days: 0, sla: 7, created: todayISO(), log: [`Tạo từ bản đồ MOD-00 (${id})`], tenant: ui.tenant, ward: c.wards[wardAt(t.x, t.z)].name, ubLevel: 'xã', loc: [t.x, t.z] }); }
      s.map.tasks.push({ id, name, owner, due, gate, wf, context: ctx, local, tenant: ui.tenant, loc: [t.x, t.z], dataVersion: DATASET_VERSION });
    });
    toast(`Đã tạo ${id}${gate ? ' và đẩy sang luồng BPMN' : ''}${local ? ' (lưu cục bộ trên thiết bị)' : ''}`, 'ok');
    drawPanel();
  } else if (a === 'repExport') download(`BaoCao_KhuVuc_${ui.tenant}_${todayISO()}.json`, JSON.stringify({ tenant: ui.tenant, dataVersion: DATASET_VERSION, geometrySession: ui.shape, coverage: BASEMAPS[map.basemap].label, imagery: BASEMAPS[map.basemap].attr, osmFetched: c?.gis?.fetched, analysis: ui.analysis && { area: ui.analysis.area, count: ui.analysis.count, median: ui.analysis.median, method: ui.analysis.method }, ur01: ui.ur && { level: ui.ur.level, affected: ui.ur.affected.length, note: ui.ur.note }, tasks: M().tasks.filter((x) => x.tenant === ui.tenant) }, null, 2), 'application/json');
}

// ------------------------------------------------------------------ Dashboard
function openDash(page) {
  ui.dash = { page, mode: ui.dash?.mode || 'analysis', level: ui.tenant && TENANT_DETAIL[ui.tenant] ? 'tenant' : 'national' };
  const el = root.querySelector('#dash');
  el.hidden = false;
  renderDashboard(el, ui, {
    close: () => { el.hidden = true; ui.dash = null; },
    drill: (tid) => { goTenant(tid); ui.dash.level = TENANT_DETAIL[tid] ? 'tenant' : 'national'; openDash(ui.dash.page); },
    flyProject: (id) => { el.hidden = true; ui.dash = null; const p = PROJECTS.find((x) => x.id === id); if (TENANT_DETAIL[p.tenant]) { if (ui.tenant !== p.tenant) goTenant(p.tenant, { fly: false }); selectById(p.bridge ? 'BR-01' : p.id); } else goTenant(p.tenant); },
    rerender: () => openDash(ui.dash.page),
  });
}
