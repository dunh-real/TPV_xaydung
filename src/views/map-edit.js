// =====================================================================
// MOD-00 · Ô quy hoạch (mô phỏng) + Biên tập mô hình + Phương án (UC-00.16 … UC-00.19)
// Phương án = lớp chỉnh sửa chồng lên dữ liệu nền OSM; dữ liệu gốc không bị sửa.
// =====================================================================
import { getState, setState } from '../store.js';
import { esc, fmt, fmtInt, toast, download, todayISO, modal } from '../lib/util.js';
import { ZONE_CLASSES, zoneStats, zoneSummary, applyVariant, applyEdit, syncAdded, emptyVariant, bridgeModel, siteModel, rectPts, polygonArea } from '../lib/citygen.js';
import { DATASET_VERSION, HEIGHT_SOURCES, NA } from '../data/nationwide.js';
import { levels } from '../lib/struct/design.js';

let X; // ngữ cảnh từ map.js: { map, ui, city, drawPanel, drawInfo, topState, startDraw, runAnalysis }
export const initEdit = (ctx) => (X = ctx);
const M = () => getState().map;
const T = () => X.ui.tenant;
const clone = (o) => JSON.parse(JSON.stringify(o));
const BADGE = { ok: ['green', 'Đạt'], warn: ['orange', 'Sát ngưỡng'], fail: ['red', 'Vượt'], na: ['gray', 'Không xét'] };
const badge = (k) => `<span class="badge ${BADGE[k][0]}">${BADGE[k][1]}</span>`;
const USES = [['residential', 'Nhà ở'], ['apartments', 'Chung cư'], ['commercial', 'Thương mại – dịch vụ'], ['office', 'Văn phòng'], ['public', 'Công cộng'], ['industrial', 'Công nghiệp – kho']];
// tham số kiểm tra mô hình dự án (THAM SỐ DEMO)
const BR_REQ = { clearance: 12, maxSpan: 150 };

// ----------------------------------------------------------------- phương án làm việc
export function work() {
  const w = M().work?.[T()];
  return w && w.data ? w : { name: 'Phương án làm việc', data: emptyVariant(), from: null };
}
function persist(w) {
  const c = X.city();
  setState((s) => {
    s.map.work = s.map.work || {};
    s.map.work[T()] = w;
    s.map.model = s.map.model || {};
    if (c?.bridge) s.map.model[T()] = { bridge: { length: Math.round(c.bridge.length), spans: c.bridge.spans, width: c.bridge.width, clearance: c.bridge.clearance, lanes: c.bridge.lanes }, variantName: w.name };
    if (c?.site) { const m = siteModel(c, c.site); s.map.model[T()] = { site: { blocks: c.site.blocks, floors: c.site.floors, bw: c.site.bw, bd: c.site.bd, pad: +m.pad.toFixed(2), gfa: Math.round(m.gfa), md: +m.md.toFixed(1), far: +m.far.toFixed(2), zone: m.zone.id, fail: m.fail }, variantName: w.name }; }
  }, true);
}
// áp phương án làm việc lên cảnh (khi vào tenant)
export function applyWork() {
  const c = X.city();
  if (!c) return;
  applyVariant(c, clone(work().data));
  X.map.sanban = sanbanSpec();
  X.map.refreshAll();
  X.ui.undo = []; X.ui.redo = [];
  persist(work());
}
// mọi thao tác biên tập đi qua đây: lưu hoàn tác → sửa → áp → kiểm tra
function op(label, fn, { building = null } = {}) {
  const w = work();
  X.ui.undo = X.ui.undo || []; X.ui.redo = [];
  X.ui.undo.push({ label, data: clone(w.data) });
  if (X.ui.undo.length > 60) X.ui.undo.shift();
  fn(w.data);
  w.dirty = true;
  const c = X.city();
  c.variant = clone(w.data);
  if (building != null && building < c.baseCount) { applyEdit(c, building); X.map.updateBuilding(building); }
  else if (building != null) { syncAdded(c); X.map.updateBuilding(building); }
  else { applyVariant(c, c.variant); X.map.refreshAll(); }
  persist(w); // sau khi cảnh đã cập nhật → map.model (Digital Twin) nhận đúng thông số mới
  if (building != null) zoneWarn(c.buildings[building]);
  X.drawPanel(); X.drawInfo(); X.topState();
}
function zoneWarn(b) {
  if (!b || b.deleted) return;
  const s = zoneStats(X.city(), b.zone);
  if (s.fail) toast(`⚠ ${s.zone.id} (${ZONE_CLASSES[s.zone.cls].name}) vượt chỉ tiêu: ${[s.checks.md === 'fail' && `MĐXD ${fmt(s.md, 1)}% > ${s.zone.limits.md}%`, s.checks.floors === 'fail' && `tầng ${s.floors} > ${s.zone.limits.floors}`, s.checks.far === 'fail' && `HSSDĐ ${fmt(s.far, 2)} > ${s.zone.limits.far}`].filter(Boolean).join(' · ')}`, 'warn', 5200);
  else toast(`✓ ${s.zone.id}: đạt chỉ tiêu ô quy hoạch (mô phỏng)`, 'ok', 2200);
}
export function undo() { const u = X.ui.undo?.pop(); if (!u) return toast('Không còn thao tác để hoàn tác'); const w = work(); X.ui.redo.push({ label: u.label, data: clone(w.data) }); w.data = u.data; applyVariant(X.city(), clone(w.data)); X.map.refreshAll(); persist(w); toast(`↶ Hoàn tác: ${u.label}`); X.drawPanel(); X.drawInfo(); }
export function redo() { const r = X.ui.redo?.pop(); if (!r) return toast('Không có thao tác để làm lại'); const w = work(); X.ui.undo.push({ label: r.label, data: clone(w.data) }); w.data = r.data; applyVariant(X.city(), clone(w.data)); X.map.refreshAll(); persist(w); toast(`↷ Làm lại: ${r.label}`); X.drawPanel(); X.drawInfo(); }

// ----------------------------------------------------------------- thao tác công trình
const isAdded = (i) => i >= X.city().baseCount;
function editB(i, label, f) {
  const c = X.city();
  op(label, (d) => {
    if (isAdded(i)) { const a = d.added[i - c.baseCount]; f(null, a); }
    else { d.edits[i] = d.edits[i] || {}; f(d.edits[i], null); }
  }, { building: i });
}
const xform = (pts, { dx = 0, dz = 0, rot = 0, s = 1 }) => {
  const cx = pts.reduce((q, p) => q + p[0], 0) / pts.length, cz = pts.reduce((q, p) => q + p[1], 0) / pts.length, r = (rot * Math.PI) / 180;
  return pts.map(([x, z]) => { const u = (x - cx) * s, v = (z - cz) * s; return [cx + dx + u * Math.cos(r) - v * Math.sin(r), cz + dz + u * Math.sin(r) + v * Math.cos(r)]; });
};
export function moveBy(i, dx, dz) { editB(i, `Di chuyển ${X.city().buildings[i].id}`, (e, a) => { if (a) a.pts = xform(a.pts, { dx, dz }); else { e.dx = (e.dx || 0) + dx; e.dz = (e.dz || 0) + dz; } }); }
export function moveTo(i, x, z) { const b = X.city().buildings[i]; moveBy(i, x - b.x, z - b.z); }
function rotateBy(i, deg) { editB(i, `Xoay ${X.city().buildings[i].id}`, (e, a) => { if (a) a.pts = xform(a.pts, { rot: deg }); else e.rot = (e.rot || 0) + deg; }); }
function scaleBy(i, f) { editB(i, `Co giãn ${X.city().buildings[i].id}`, (e, a) => { if (a) a.pts = xform(a.pts, { s: f }); else e.scale = Math.max(0.3, Math.min(3, (e.scale || 1) * f)); }); }
function setFloors(i, floors, h) { editB(i, `Đổi tầng cao ${X.city().buildings[i].id}`, (e, a) => { const o = a || e; o.floors = floors; o.h = h || null; }); }
function del(i) {
  const c = X.city(), id = c.buildings[i].id;
  if (isAdded(i)) { op(`Xóa ${id}`, (d) => d.added.splice(i - c.baseCount, 1)); X.ui.sel = null; X.map.setOverlay(null); return; }
  editB(i, `Xóa ${id}`, (e) => (e.deleted = true));
  X.ui.sel = null; X.map.setOverlay(null);
}
function resetB(i) { const id = X.city().buildings[i].id; op(`Khôi phục ${id}`, (d) => delete d.edits[i], { building: i }); }
export function addBlockAt(x, z, inp) {
  const c = X.city(), n = (work().data.added || []).length + 1, id = `${c.code}-PA-${String(n).padStart(3, '0')}`;
  op(`Thêm khối ${id}`, (d) => { d.added = d.added || []; d.added.push({ id, pts: rectPts(x, z, inp.w, inp.d, (inp.rot || 0) * Math.PI / 180), floors: inp.floors, h: null, use: inp.use, useName: USES.find((u) => u[0] === inp.use)?.[1] }); }, { building: c.baseCount + n - 1 });
  X.ui.sel = { type: 'building', i: c.baseCount + n - 1 };
  X.map.setOverlay(new Map([[X.ui.sel.i, '#f97316']]), false);
  X.drawPanel(); X.drawInfo();
}
export function addBlockPoly(pts, inp) {
  const c = X.city(), n = (work().data.added || []).length + 1, id = `${c.code}-PA-${String(n).padStart(3, '0')}`;
  if (polygonArea(pts) < 20) return toast('Mặt bằng quá nhỏ (< 20 m²)', 'warn');
  op(`Thêm khối ${id} (vẽ)`, (d) => { d.added = d.added || []; d.added.push({ id, pts, floors: inp.floors, h: null, use: inp.use, useName: USES.find((u) => u[0] === inp.use)?.[1] }); }, { building: c.baseCount + n - 1 });
  X.ui.sel = { type: 'building', i: c.baseCount + n - 1 };
}
// nhấp bản đồ khi đang ở chế độ biên tập → true nếu đã xử lý
export function editPick(o) {
  const ui = X.ui;
  if (ui.group !== 'edit' || !X.city()) return false;
  const gx = o.type === 'ground' || o.type === 'zone' ? [o.x, o.z] : o.at ? [o.at.x, o.at.z] : null;
  if (ui.editMode === 'move' && gx && ui.sel?.type === 'building') { moveTo(ui.sel.i, gx[0], gx[1]); ui.editMode = null; X.drawPanel(); return true; }
  if (ui.editMode === 'add' && gx) { addBlockAt(gx[0], gx[1], ui.newBlock); return true; }
  if (ui.editMode === 'site' && gx) { ui.editMode = null; setSite({ x: Math.round(gx[0]), z: Math.round(gx[1]) }); toast('Đã dời khu đất tới điểm nhấp (trong phương án)', 'ok'); return true; }
  return false;
}

// ----------------------------------------------------------------- mô hình dự án
function setBridge(p) { op('Sửa mô hình cầu BR-01', (d) => (d.bridge = { ...(d.bridge || {}), ...p })); }
// ----------------------------------------------------------------- SA BÀN: mô hình thiết kế CAD đặt vào khu đất thực
const place = () => ({ on: false, rot: 0, progress: 1, ...(getState().cad?.place || {}) });
const design = () => (getState().cad?.doc ? { st: getState().cad.doc.struct, b: getState().cad.b } : null);
const footprint = (st) => { const xs = st.cols.map((c) => c.x), ys = st.cols.map((c) => c.y); return [Math.max(...xs) - Math.min(...xs) + 800, Math.max(...ys) - Math.min(...ys) + 800].map((v) => v / 1000); };
function sanbanSpec() { const p = place(), d = design(); return p.on && d && d.st.cols.length && X.city()?.site ? { ...d, rot: p.rot, progress: p.progress } : null; }
function setPlace(o) { setState((s) => { s.cad = s.cad || {}; s.cad.place = { ...place(), ...o }; }, true); }
export function sanbanOn(on) {
  const d = design();
  if (on && (!d || !d.st.cols.length)) return toast('Chưa có thiết kế kết cấu — vẽ ở tab 📐 CAD & Kết cấu trước', 'warn');
  setPlace({ on });
  X.map.sanban = sanbanSpec();
  if (on) { const [W, D] = footprint(d.st); setSite({ bw: Math.round(W), bd: Math.round(D), floors: d.b.storeys }); toast(`🏗 Đã đặt thiết kế CAD (${d.b.storeys} tầng, ${fmt(W, 1)} × ${fmt(D, 1)} m) vào khu đất DA-2026-017`, 'ok'); }
  else { X.map.setSanban(null); X.drawPanel(); }
}
function setSite(p) { op('Sửa mô hình khu DA-2026-017', (d) => (d.site = { ...(d.site || {}), ...p })); }

// ----------------------------------------------------------------- phương án đã lưu
export function variantStats(data) {
  const c = X.city(), keep = clone(c.variant || emptyVariant());
  applyVariant(c, clone(data));
  const live = c.buildings.filter((b) => !b.deleted);
  const zs = zoneSummary(c);
  const st = {
    edited: Object.values(data.edits || {}).filter((e) => !e.deleted).length, deleted: Object.values(data.edits || {}).filter((e) => e.deleted).length, added: (data.added || []).length,
    gfa: live.reduce((s, b) => s + b.area * (b.floors || b.estFloors || Math.max(1, Math.round(b.h / 3.3))), 0), maxH: live.reduce((m, b) => Math.max(m, b.h), 0), zonesFail: zs.fail,
  };
  if (c.bridge) { const m = bridgeModel(c.bridge, c.det.waterLevel); st.bridge = { length: Math.round(c.bridge.length), spans: c.bridge.spans, clearance: c.bridge.clearance, width: c.bridge.width, concrete: m.concrete, steel: m.steel, cost: m.cost, ok: c.bridge.clearance >= BR_REQ.clearance && m.spanL <= BR_REQ.maxSpan * 1.6 }; }
  if (c.site) { const m = siteModel(c, c.site); st.site = { blocks: c.site.blocks, floors: c.site.floors, gfa: m.gfa, md: m.md, far: m.far, earth: m.earth, fail: m.fail }; }
  applyVariant(c, keep);
  return st;
}
function saveVariant() {
  const name = prompt('Tên phương án:', `Phương án ${String.fromCharCode(65 + M().variants.filter((v) => v.tenant === T()).length)}`);
  if (!name) return;
  const w = work(), id = `PAN-${T() === 'hcm' ? 'HCM' : 'DNA'}-${String(M().variants.length + 1).padStart(3, '0')}`;
  const stats = variantStats(w.data);
  setState((s) => { s.map.variants.push({ id, tenant: T(), name, createdAt: new Date().toISOString(), base: DATASET_VERSION, data: clone(w.data), stats }); s.map.work[T()] = { ...w, name, from: id, dirty: false }; }, true);
  persist(work());
  toast(`💾 Đã lưu ${id} · ${esc(name)}`, 'ok');
  X.drawPanel();
}
function loadVariant(id) {
  const v = M().variants.find((x) => x.id === id);
  const w = { name: v.name, data: clone(v.data), from: v.id, dirty: false };
  applyVariant(X.city(), clone(w.data)); X.map.refreshAll();
  persist(w);
  X.ui.undo = []; X.ui.redo = [];
  toast(`📂 Đã nạp ${v.id} · ${esc(v.name)}`, 'ok');
  X.drawPanel(); X.drawInfo();
}
function resetWork() { op('Về hiện trạng OSM', (d) => { d.edits = {}; d.added = []; d.bridge = null; d.site = null; }); const w = work(); w.name = 'Phương án làm việc'; w.from = null; persist(w); X.drawPanel(); }
function compareVariants() {
  const vs = M().variants.filter((v) => v.tenant === T());
  const cols = [{ name: 'Hiện trạng (OSM)', st: variantStats(emptyVariant()) }, ...vs.map((v) => ({ name: `${v.id} · ${v.name}`, st: variantStats(v.data) })), { name: `Đang làm: ${work().name}`, st: variantStats(work().data) }];
  const row = (l, f) => `<tr><td>${l}</td>${cols.map((c) => `<td class="r">${f(c.st)}</td>`).join('')}</tr>`;
  const base = cols[0].st;
  let body = `<table class="tb small" id="cmpTbl"><tr><th>Chỉ số</th>${cols.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr>
    ${row('Công trình sửa / thêm / xóa', (s) => `${s.edited} / ${s.added} / ${s.deleted}`)}
    ${row('Tổng diện tích sàn (m²)', (s) => fmtInt(s.gfa))}
    ${row('Chênh GFA so với hiện trạng', (s) => `${s.gfa - base.gfa >= 0 ? '+' : ''}${fmtInt(s.gfa - base.gfa)}`)}
    ${row('Chiều cao lớn nhất (m)', (s) => fmt(s.maxH, 1))}
    ${row('Ô quy hoạch vượt chỉ tiêu', (s) => `${s.zonesFail} ${s.zonesFail > base.zonesFail ? '<span class="badge red">tăng</span>' : s.zonesFail < base.zonesFail ? '<span class="badge green">giảm</span>' : ''}`)}`;
  if (base.bridge) body += row('Cầu: dài / nhịp / tĩnh không', (s) => `${s.bridge.length} m / ${s.bridge.spans} / ${s.bridge.clearance} m`) + row('Cầu: bê tông / thép', (s) => `${fmtInt(s.bridge.concrete)} m³ / ${fmtInt(s.bridge.steel)} t`) + row('Cầu: chi phí sơ bộ (tỷ đồng)', (s) => fmt(s.bridge.cost, 1));
  if (base.site) body += row('DA-2026-017: khối × tầng', (s) => `${s.site.blocks} × ${s.site.floors}`) + row('DA-2026-017: GFA / MĐXD / HSSDĐ', (s) => `${fmtInt(s.site.gfa)} m² / ${fmt(s.site.md, 1)}% / ${fmt(s.site.far, 2)}`) + row('DA-2026-017: đạt chỉ tiêu ô QH', (s) => (s.site.fail ? badge('fail') : badge('ok'))) + row('San nền đào(−)/đắp(+) m³', (s) => fmtInt(s.site.earth));
  body += '</table><p class="small muted">Chỉ số tính lại trên cùng dữ liệu nền OSM, phiên ' + DATASET_VERSION + '. Chỉ tiêu ô quy hoạch là tham số mô phỏng.</p>';
  modal({ wide: true, title: '⚖ So sánh phương án mô hình', body, actions: [{ label: '⬇ CSV', cls: 'btn', onClick: () => { const t = document.querySelector('#cmpTbl'); const csv = [...t.rows].map((r) => [...r.cells].map((c) => `"${c.innerText.replace(/"/g, '""')}"`).join(',')).join('\n'); download(`SoSanh_PhuongAn_${T()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8'); return false; } }, { label: 'Đóng', cls: 'btn' }] });
}
function exportJSON(data, name) {
  download(`PhuongAn_${T()}_${name.replace(/\s+/g, '_')}_${todayISO()}.json`, JSON.stringify({ schema: 'aipm.mod00.variant/1.0', tenant: T(), name, base: DATASET_VERSION, exportedAt: new Date().toISOString(), crs: 'Hệ cục bộ cảnh mẫu (m) — gốc ' + X.city().det.origin.join(', '), data }, null, 2), 'application/json');
}
function importJSON(e) {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      const j = JSON.parse(t);
      if (j.tenant !== T()) throw new Error(`file thuộc tenant ${j.tenant}, đang ở ${T()}`);
      const d = j.data;
      if (!d || typeof d.edits !== 'object' || !Array.isArray(d.added)) throw new Error('thiếu edits/added');
      setState((s) => s.map.variants.push({ id: `PAN-NHAP-${String(s.map.variants.length + 1).padStart(3, '0')}`, tenant: T(), name: (j.name || f.name) + ' (nhập)', createdAt: new Date().toISOString(), base: j.base || NA, data: d, stats: null }), true);
      toast(`Đã nhập phương án${j.base && j.base !== DATASET_VERSION ? ` (lập trên dữ liệu ${esc(j.base)} ≠ ${DATASET_VERSION})` : ''}`, 'ok');
      X.drawPanel();
    } catch (err) { toast('Không đọc được phương án: ' + esc(err.message), 'err'); }
  });
}

// ----------------------------------------------------------------- GIAO DIỆN: Quy hoạch
export function zoningPanel() {
  const c = X.city(), on = X.map.layers.zoning;
  const zs = zoneSummary(c);
  const fails = zs.all.filter((s) => s.fail).sort((a, b) => b.far / (b.zone.limits.far || 1) - a.far / (a.zone.limits.far || 1));
  return `<h4>Ô quy hoạch & chỉ tiêu</h4>
    <div class="disclaimer">Ô quy hoạch và chỉ tiêu là <b>mô phỏng</b> (chức năng suy từ hiện trạng sử dụng đất OSM; ngưỡng MĐXD/tầng/HSSDĐ là tham số demo) — không phải đồ án quy hoạch được duyệt.</div>
    <label class="lyr"><input type="checkbox" data-l="zoning" ${on ? 'checked' : ''}> Hiện ô quy hoạch trên bản đồ</label>
    <label class="lyr"><input type="checkbox" id="zColor" ${X.ui.colorMode === 'zone' ? 'checked' : ''}> Tô công trình theo chức năng ô</label>
    <div class="mgrid" style="margin:6px 0">${[['Số ô', c.zones.length], ['Vượt chỉ tiêu', zs.fail], ['Ranh lô', 'theo đường phố OSM'], ['Phương án', esc(work().name)]].map(([l, v]) => `<div class="mkpi"><span class="l">${l}</span><b>${v}</b></div>`).join('')}</div>
    <table class="tb small"><tr><th>Chức năng</th><th>Ô</th><th>Vượt</th><th>MĐXD · tầng · HSSDĐ tối đa</th></tr>${zs.byClass.map((x) => { const z = c.zones.find((q) => q.cls === x.k); return `<tr><td><i class="dot" style="background:${ZONE_CLASSES[x.k].color}"></i>${esc(ZONE_CLASSES[x.k].name)}</td><td class="r">${x.n}</td><td class="r">${x.fail ? `<span class="badge red">${x.fail}</span>` : '0'}</td><td class="small">${z.limits.md == null ? 'hạn chế hiển thị' : `${z.limits.md}% · ${z.limits.floors} · ${z.limits.far}`}</td></tr>`; }).join('')}</table>
    <h5 style="margin-top:8px">Ô vượt chỉ tiêu (${fails.length})</h5>
    <div class="scroll" style="max-height:200px"><table class="tb small"><tr><th>Ô</th><th>Chức năng</th><th>Vượt</th></tr>${fails.slice(0, 40).map((s) => `<tr class="click" data-zone="${s.zone.idx}"><td>${s.zone.id}</td><td>${s.zone.cls}</td><td class="small">${[s.checks.md === 'fail' && 'MĐXD', s.checks.floors === 'fail' && 'tầng', s.checks.far === 'fail' && 'HSSDĐ'].filter(Boolean).join(', ')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Không có</td></tr>'}</table></div>
    <p class="small muted">Bật lớp rồi nhấp lên mặt đất để xem chỉ tiêu của ô. Biên tập công trình (nhóm 🛠 Biên tập) được kiểm tra lại tức thì.</p><hr>`;
}
export function zoneDetail(idx) {
  const c = X.city(), s = zoneStats(c, idx), z = s.zone, L = z.limits;
  const wards = [...new Set(c.buildings.filter((b) => b.zone === idx).map((b) => c.wards[b.ward].name))];
  return `<h4>🗺 Ô quy hoạch ${z.id}</h4><div class="small muted">${esc(ZONE_CLASSES[z.cls].name)} · ${fmt(z.area / 1e4, 2)} ha · ${wards.map(esc).join(', ') || esc(c.wards[c.wardOf(z.cx, z.cz)].name)}</div>
    <div class="disclaimer">Chỉ tiêu mô phỏng (tham số demo) — không phải đồ án quy hoạch được duyệt.</div>
    <table class="tb small"><tr><th>Chỉ tiêu</th><th>Tối đa</th><th>Hiện tại${work().data && (Object.keys(work().data.edits).length || work().data.added.length) ? ' (theo phương án)' : ''}</th><th></th></tr>
      <tr><td>Mật độ xây dựng gộp</td><td class="r">${L.md ?? NA}${L.md != null ? '%' : ''}</td><td class="r">${fmt(s.md, 1)}%</td><td>${badge(s.checks.md)}</td></tr>
      <tr><td>Tầng cao tối đa</td><td class="r">${L.floors ?? NA}</td><td class="r">${s.floors}</td><td>${badge(s.checks.floors)}</td></tr>
      <tr><td>Hệ số sử dụng đất</td><td class="r">${L.far ?? NA}</td><td class="r">${fmt(s.far, 2)}</td><td>${badge(s.checks.far)}</td></tr></table>
    <div class="mt"><span>Số công trình</span><span>${fmtInt(s.count)}</span><span>Diện tích xây dựng</span><span>${fmtInt(s.fp)} m²</span><span>Tổng diện tích sàn</span><span>${fmtInt(s.gfa)} m²</span><span>Công trình theo phương án</span><span>${s.edited}</span><span>Nguồn chức năng</span><span class="small">Suy từ hiện trạng sử dụng đất OSM + mật độ công trình</span></div>
    <div class="row" style="margin-top:6px"><button class="btn sm" data-act="zoneHi" data-z="${idx}">🔦 Tô công trình trong ô</button><button class="btn sm" data-act="zoneAna" data-z="${idx}">📊 Phân tích ô</button><button class="btn sm pri" data-act="zoneEdit" data-z="${idx}">🛠 Biên tập trong ô</button></div>`;
}

// ----------------------------------------------------------------- GIAO DIỆN: Biên tập
export function editPanel() {
  const ui = X.ui, c = X.city(), w = work(), d = w.data;
  ui.editTab = ui.editTab || 'bld';
  ui.newBlock = ui.newBlock || { w: 30, d: 20, floors: 10, use: 'commercial', rot: 0 };
  const n = Object.keys(d.edits).length + d.added.length + (d.bridge ? 1 : 0) + (d.site ? 1 : 0);
  let h = `<div class="task" style="margin-bottom:6px"><div class="row"><b>📐 ${esc(w.name)}</b>${w.from ? `<span class="badge blue">${w.from}</span>` : ''}${w.dirty ? '<span class="badge orange">chưa lưu</span>' : ''}<span class="spacer"></span><button class="btn sm" id="eUndo" title="Hoàn tác" ${ui.undo?.length ? '' : 'disabled'}>↶</button><button class="btn sm" id="eRedo" title="Làm lại" ${ui.redo?.length ? '' : 'disabled'}>↷</button></div>
    <div class="small muted">${n} thay đổi · sửa ${Object.values(d.edits).filter((e) => !e.deleted).length} · thêm ${d.added.length} · xóa ${Object.values(d.edits).filter((e) => e.deleted).length} — dữ liệu gốc OSM không bị sửa</div>
    <label class="lyr"><input type="checkbox" id="eColor" ${ui.colorMode === 'edit' ? 'checked' : ''}> Tô theo trạng thái biên tập (đỏ = sửa · xanh = thêm)</label></div>
    <div class="steps">${[['bld', 'Công trình'], ['proj', 'Mô hình dự án'], ['var', 'Phương án']].map(([k, l]) => `<button data-et="${k}" class="${ui.editTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (ui.editTab === 'bld') {
    const b = ui.sel?.type === 'building' ? c.buildings[ui.sel.i] : null;
    if (b && !b.deleted) {
      const s = zoneStats(c, b.zone), e = isAdded(b.i) ? null : d.edits[b.i];
      h += `<div class="task"><h5>🏢 ${b.id} ${b.added ? '<span class="badge green">khối mới</span>' : b.edited ? '<span class="badge red">đã sửa</span>' : ''}</h5>
        <div class="small muted">${esc(b.typeName)}${b.name ? ' · ' + esc(b.name) : ''} · ${fmtInt(b.area)} m² · ${esc(HEIGHT_SOURCES[b.src].label)}</div>
        <div class="grid g2" style="gap:6px;margin-top:4px"><label class="f">Số tầng<input type="number" id="eFloors" min="1" max="120" value="${b.floors || b.estFloors || Math.max(1, Math.round(b.h / 3.3))}"></label><label class="f">Chiều cao (m, để trống = tầng × 3,3)<input type="number" id="eH" step="0.1" value="${e?.h ?? ''}"></label></div>
        <button class="btn sm pri" id="eApply">✔ Áp dụng tầng cao</button>
        <h5 style="margin-top:6px">Vị trí · hướng · kích thước</h5>
        <div class="row"><button class="btn sm" data-mv="-5,0">◀ 5 m</button><button class="btn sm" data-mv="5,0">5 m ▶</button><button class="btn sm" data-mv="0,-5">▲ 5 m</button><button class="btn sm" data-mv="0,5">▼ 5 m</button><button class="btn sm ${ui.editMode === 'move' ? 'pri' : ''}" id="eMoveTo">📍 Tới điểm nhấp</button></div>
        <div class="row"><button class="btn sm" data-rot="-15">⟲ 15°</button><button class="btn sm" data-rot="15">⟳ 15°</button><button class="btn sm" data-sc="0.9">− 10%</button><button class="btn sm" data-sc="1.1">＋ 10%</button></div>
        <div class="row"><button class="btn sm danger" id="eDel">🗑 Xóa khỏi phương án</button>${b.edited && !b.added ? '<button class="btn sm" id="eReset">↺ Khôi phục gốc OSM</button>' : ''}</div>
        <div class="small" style="margin-top:6px">Ô ${s.zone.id} (${esc(ZONE_CLASSES[s.zone.cls].name)}): MĐXD ${fmt(s.md, 1)}% ${badge(s.checks.md)} · tầng ${s.floors} ${badge(s.checks.floors)} · HSSDĐ ${fmt(s.far, 2)} ${badge(s.checks.far)}</div></div>`;
    } else h += '<p class="small muted">Nhấp một công trình trên bản đồ để chỉnh tầng cao, di chuyển, xoay, co giãn hoặc xóa.</p>';
    const nb = ui.newBlock;
    h += `<div class="task"><h5>＋ Thêm khối công trình mới</h5>
      <div class="grid g2" style="gap:6px"><label class="f">Dài (m)<input type="number" id="nW" value="${nb.w}"></label><label class="f">Rộng (m)<input type="number" id="nD" value="${nb.d}"></label><label class="f">Số tầng<input type="number" id="nF" value="${nb.floors}"></label><label class="f">Hướng (°)<input type="number" id="nR" value="${nb.rot}"></label></div>
      <label class="f">Chức năng<select id="nU">${USES.map(([k, l]) => `<option value="${k}" ${nb.use === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="row"><button class="btn sm ${ui.editMode === 'add' ? 'pri' : ''}" id="eAdd">${ui.editMode === 'add' ? '■ Dừng đặt khối' : '📍 Đặt khối: nhấp lên bản đồ'}</button><button class="btn sm" id="eDrawAdd">✏️ Vẽ mặt bằng</button></div></div>`;
    const list = [...Object.entries(d.edits).map(([i, e]) => ({ i: +i, id: c.buildings[+i]?.id, t: e.deleted ? 'xóa' : 'sửa' })), ...d.added.map((a, k) => ({ i: c.baseCount + k, id: a.id, t: 'thêm' }))];
    h += `<h5>Thay đổi trong phương án (${list.length})</h5><div class="scroll" style="max-height:150px"><table class="tb small">${list.slice(-40).reverse().map((x) => `<tr class="${x.t === 'xóa' ? '' : 'click'}" ${x.t === 'xóa' ? '' : `data-bld="${x.i}"`}><td>${x.id}</td><td><span class="badge ${x.t === 'thêm' ? 'green' : x.t === 'xóa' ? 'gray' : 'red'}">${x.t}</span></td></tr>`).join('') || '<tr><td class="muted">Chưa có</td></tr>'}</table></div>`;
  } else if (ui.editTab === 'proj') {
    if (c.bridge) {
      const br = c.bridge, m = bridgeModel(br, c.det.waterLevel), okC = br.clearance >= BR_REQ.clearance, okS = m.spanL <= BR_REQ.maxSpan;
      h += `<div class="task"><h5>🌉 Cầu BR-01 — tham số mô hình</h5>
        <div class="grid g2" style="gap:6px"><label class="f">Chiều dài toàn cầu (m)<input type="number" id="bL" value="${Math.round(br.length)}" min="${br.span + 40}" step="10"></label><label class="f">Số nhịp<input type="number" id="bS" value="${br.spans}" min="1" max="12"></label>
        <label class="f">Bề rộng mặt cầu (m)<input type="number" id="bW" value="${br.width}" min="8" max="45" step="0.5"></label><label class="f">Tĩnh không thông thuyền (m)<input type="number" id="bC" value="${br.clearance}" min="4" max="60" step="0.5"></label>
        <label class="f">Số làn xe<input type="number" id="bLn" value="${br.lanes}" min="1" max="8"></label><label class="f">Khổ sông đo trên OSM<input type="text" disabled value="${br.span} m"></label></div>
        <div class="row"><button class="btn sm pri" id="bApply">✔ Áp dụng</button><button class="btn sm" id="bReset">↺ Mặc định</button><button class="btn sm" id="bFly">🎯 Bay tới cầu</button></div>
        <div class="mt" style="margin-top:6px"><span>Chiều dài nhịp trung bình</span><span>${fmt(m.spanL, 1)} m ${okS ? badge('ok') : badge('fail')}</span><span>Tĩnh không (yêu cầu ≥ ${BR_REQ.clearance} m)</span><span>${br.clearance} m ${okC ? badge('ok') : badge('fail')}</span><span>Cao độ mặt cầu</span><span>+${fmt(m.deckY, 1)} m</span><span>Bê tông sơ bộ</span><span>${fmtInt(m.concrete)} m³</span><span>Thép sơ bộ</span><span>${fmtInt(m.steel)} t</span><span>Chi phí xây lắp sơ bộ</span><span>${fmt(m.cost, 1)} tỷ đồng</span></div>
        <p class="small muted">${esc(m.note)}. Ngưỡng tĩnh không/nhịp là tham số demo. Thông số được chuyển sang Digital Twin (BR-01/04/05).</p>
        <a class="btn sm ai" href="#twin?mode=simulation&scenario=BR-01&from=map" id="bTwin">🧊 Mô phỏng BR-01 với thông số này</a></div>`;
    }
    if (c.site) {
      const st = c.site, m = siteModel(c, st);
      h += `<div class="task"><h5>📍 DA-2026-017 — mô hình khu đất</h5><div class="small muted">Khu đất ${st.w} × ${st.d} m · ô ${m.zone.id} (${esc(ZONE_CLASSES[m.zone.cls].name)})</div>
        <div class="grid g2" style="gap:6px"><label class="f">Số khối nhà<input type="number" id="sB" value="${st.blocks}" min="1" max="20"></label><label class="f">Số tầng mỗi khối<input type="number" id="sF" value="${st.floors}" min="1" max="60"></label>
        <label class="f">Dài khối (m)<input type="number" id="sBW" value="${st.bw}" min="10" max="120"></label><label class="f">Rộng khối (m)<input type="number" id="sBD" value="${st.bd}" min="8" max="80"></label>
        <label class="f">Cao độ san nền (m)<input type="number" id="sPad" step="0.1" value="${st.pad ?? ''}" placeholder="tự động ${fmt(m.pad, 2)}"></label><label class="f">Cao độ TN trung bình<input type="text" disabled value="${fmt(m.groundMean, 2)} m"></label></div>
        <div class="row"><button class="btn sm pri" id="sApply">✔ Áp dụng</button><button class="btn sm" id="sReset">↺ Mặc định</button><button class="btn sm" id="sFly">🎯 Bay tới khu đất</button></div>
        <table class="tb small" style="margin-top:6px"><tr><th>Chỉ tiêu</th><th>Phương án</th><th>Tối đa (ô QH)</th><th></th></tr>
        <tr><td>MĐXD</td><td class="r">${fmt(m.md, 1)}%</td><td class="r">${m.zone.limits.md ?? NA}%</td><td>${badge(m.checks.md)}</td></tr><tr><td>Tầng cao</td><td class="r">${st.floors}</td><td class="r">${m.zone.limits.floors ?? NA}</td><td>${badge(m.checks.floors)}</td></tr><tr><td>HSSDĐ</td><td class="r">${fmt(m.far, 2)}</td><td class="r">${m.zone.limits.far ?? NA}</td><td>${badge(m.checks.far)}</td></tr></table>
        <div class="mt"><span>Tổng diện tích sàn</span><span>${fmtInt(m.gfa)} m²</span><span>Số căn hộ ước tính</span><span>${fmtInt(m.units)}</span><span>San nền ${m.earth >= 0 ? 'đắp' : 'đào'}</span><span>${fmtInt(Math.abs(m.earth))} m³</span></div>
        <a class="btn sm ai" href="#twin?mode=plan">🧊 Mở Digital Twin (MOD-01/02)</a></div>`;
      const p = place(), d = design(), H = d ? levels(d.b).at(-1) : 0, fp = d && d.st.cols.length ? footprint(d.st) : null;
      h += `<div class="task sanban"><h5>🏗 Sa bàn từ thiết kế CAD</h5>
        ${fp ? `<div class="small muted">Thiết kế: ${d.b.storeys} tầng · cao ${fmt(H, 1)} m · mặt bằng ${fmt(fp[0], 1)} × ${fmt(fp[1], 1)} m · ${d.st.cols.length} cột · ${d.b.grade}</div>` : '<div class="small muted">Chưa có thiết kế kết cấu.</div>'}
        <label class="lyr"><input type="checkbox" id="sbOn" ${p.on ? 'checked' : ''}> 🔮 Xem tương lai dự án (đặt mô hình thiết kế vào khu đất thực)</label>
        ${p.on && d ? `<div class="grid g2" style="gap:6px"><label class="f">Số khối nhà<input type="number" id="sbN" value="${st.blocks}" min="1" max="20"></label><label class="f">Hướng xoay (°)<input type="number" id="sbRot" value="${p.rot}" step="15"></label></div>
        <label class="f">Tiến độ thi công: <b id="sbPv">${Math.round(p.progress * 100)}%</b> (${Math.round(d.b.storeys * p.progress)}/${d.b.storeys} tầng)<input type="range" id="sbProg" min="0" max="100" step="5" value="${Math.round(p.progress * 100)}"></label>
        <div class="mt"><span>Tổng diện tích sàn (sa bàn)</span><span>${fmtInt(m.gfa)} m²</span><span>Chiều cao công trình</span><span>${fmt(H, 1)} m</span><span>Chỉ tiêu ô quy hoạch</span><span>${m.fail ? '<span class="badge red">Vượt</span>' : '<span class="badge green">Đạt</span>'}</span></div>
        <div class="row"><button class="btn sm pri" id="sbTour">🎥 Bay vòng tổng quan</button><button class="btn sm ${ui.editMode === 'site' ? 'pri' : ''}" id="sbMove">📍 Dời khu đất tới điểm nhấp</button><a class="btn sm" href="#cad">📐 Sửa thiết kế (CAD)</a></div>` : ''}
        <p class="small muted">Mô hình lấy trực tiếp từ bản vẽ CAD (lưới cột, số tầng, chiều cao tầng) — sửa thiết kế ở tab CAD thì sa bàn cập nhật. Tắt ô trên để xem hiện trạng.</p></div>`;
    }
    if (!c.bridge && !c.site) h += '<p class="small muted">Tenant này chưa có mô hình dự án.</p>';
    h += `<div class="row"><button class="btn sm" data-ten="${c.bridge ? 'dong-nai' : 'hcm'}">↔ Sang ${c.bridge ? 'Đồng Nai (DA-2026-017)' : 'TP.HCM (cầu BR-01)'}</button></div>`;
  } else {
    const vs = M().variants.filter((v) => v.tenant === T());
    h += `<div class="row"><button class="btn sm pri" id="vSave">💾 Lưu thành phương án</button><button class="btn sm" id="vCmp" ${vs.length ? '' : 'disabled'}>⚖ So sánh</button><button class="btn sm" id="vExpCur">⬇ Xuất JSON</button><label class="btn sm">⬆ Nhập JSON<input type="file" id="vImp" accept=".json" hidden></label><button class="btn sm danger" id="vReset">↺ Về hiện trạng</button></div>
      <table class="tb small" style="margin-top:6px"><tr><th>Phương án</th><th>Thay đổi</th><th>Ô vượt</th><th></th></tr>${vs.map((v) => { const s = v.stats; return `<tr><td><b>${v.id}</b><div>${esc(v.name)}</div><div class="muted">${v.createdAt.slice(0, 10)} · nền ${esc(v.base)}</div></td><td class="small">${s ? `sửa ${s.edited} · thêm ${s.added} · xóa ${s.deleted}` : '—'}</td><td class="r">${s ? s.zonesFail : '—'}</td><td><button class="btn sm" data-vload="${v.id}">📂 Nạp</button><button class="btn sm" data-vexp="${v.id}">⬇</button><button class="btn sm" data-vdel="${v.id}">🗑</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Chưa có phương án đã lưu</td></tr>'}</table>
      <p class="small muted">Mỗi phương án lưu: chỉnh sửa công trình, khối mới, tham số cầu/khu đất; gắn phiên dữ liệu nền để tái lập.</p>`;
  }
  return h;
}
export function bindEdit(el) {
  const ui = X.ui, c = X.city(), $ = (s) => el.querySelector(s), num = (s) => +$(s).value;
  el.querySelectorAll('[data-et]').forEach((b) => (b.onclick = () => { ui.editTab = b.dataset.et; X.drawPanel(); }));
  $('#eUndo') && ($('#eUndo').onclick = undo);
  $('#eRedo') && ($('#eRedo').onclick = redo);
  $('#eColor') && ($('#eColor').onchange = (e) => { ui.colorMode = e.target.checked ? 'edit' : 'material'; X.map.setColorMode(ui.colorMode); X.legend(); });
  const sel = ui.sel?.type === 'building' ? ui.sel.i : null;
  if (sel != null) {
    $('#eApply') && ($('#eApply').onclick = () => { const f = Math.max(1, Math.round(num('#eFloors'))), h = $('#eH').value ? +$('#eH').value : null; setFloors(sel, f, h); });
    el.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => { const [dx, dz] = b.dataset.mv.split(',').map(Number); moveBy(sel, dx, dz); }));
    el.querySelectorAll('[data-rot]').forEach((b) => (b.onclick = () => rotateBy(sel, +b.dataset.rot)));
    el.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => scaleBy(sel, +b.dataset.sc)));
    $('#eMoveTo') && ($('#eMoveTo').onclick = () => { ui.editMode = ui.editMode === 'move' ? null : 'move'; toast(ui.editMode ? 'Nhấp lên mặt đất để đặt công trình tới vị trí mới' : 'Đã hủy di chuyển'); X.drawPanel(); });
    $('#eDel') && ($('#eDel').onclick = () => del(sel));
    $('#eReset') && ($('#eReset').onclick = () => resetB(sel));
  }
  const readNew = () => { ui.newBlock = { w: num('#nW'), d: num('#nD'), floors: Math.max(1, Math.round(num('#nF'))), rot: num('#nR'), use: $('#nU').value }; };
  ['#nW', '#nD', '#nF', '#nR', '#nU'].forEach((s) => $(s)?.addEventListener('change', readNew));
  $('#eAdd') && ($('#eAdd').onclick = () => { readNew(); ui.editMode = ui.editMode === 'add' ? null : 'add'; if (ui.editMode) toast('Nhấp lên mặt đất để đặt khối mới (bấm lại để dừng)'); X.drawPanel(); });
  $('#eDrawAdd') && ($('#eDrawAdd').onclick = () => { readNew(); X.startDraw('addBlock'); });
  // mô hình dự án
  $('#bApply') && ($('#bApply').onclick = () => { const span = c.baseBridge.span; setBridge({ length: Math.max(span + 40, num('#bL')), spans: Math.max(1, Math.round(num('#bS'))), width: num('#bW'), clearance: num('#bC'), lanes: Math.max(1, Math.round(num('#bLn'))) }); });
  $('#bReset') && ($('#bReset').onclick = () => op('Cầu về mặc định', (d) => (d.bridge = null)));
  $('#bFly') && ($('#bFly').onclick = () => X.map.flyTo(c.bridge.x, c.bridge.z, 700, 900, { tilt: 0.5 }));
  $('#bTwin') && ($('#bTwin').onclick = () => setState((s) => { s.twin.selectedScenario = 'BR-01'; s.twin.runConfig.level = 'L1'; }, true));
  $('#sApply') && ($('#sApply').onclick = () => setSite({ blocks: Math.max(1, Math.round(num('#sB'))), floors: Math.max(1, Math.round(num('#sF'))), bw: num('#sBW'), bd: num('#sBD'), pad: $('#sPad').value === '' ? null : +$('#sPad').value }));
  $('#sReset') && ($('#sReset').onclick = () => op('Khu đất về mặc định', (d) => (d.site = null)));
  $('#sFly') && ($('#sFly').onclick = () => X.map.flyTo(c.site.x, c.site.z, 900, 900, { tilt: 0.6 }));
  $('#sbOn') && ($('#sbOn').onchange = (e) => sanbanOn(e.target.checked));
  $('#sbN') && ($('#sbN').onchange = (e) => setSite({ blocks: Math.max(1, Math.round(+e.target.value)) }));
  $('#sbRot') && ($('#sbRot').onchange = (e) => { setPlace({ rot: +e.target.value || 0 }); X.map.setSanban(sanbanSpec()); });
  $('#sbProg') && ($('#sbProg').oninput = (e) => { setPlace({ progress: +e.target.value / 100 }); $('#sbPv').textContent = e.target.value + '%'; X.map.setSanban(sanbanSpec()); });
  $('#sbProg') && ($('#sbProg').onchange = () => X.drawPanel());
  $('#sbMove') && ($('#sbMove').onclick = () => { ui.editMode = ui.editMode === 'site' ? null : 'site'; if (ui.editMode) toast('Nhấp lên bản đồ để dời khu đất (và sa bàn) tới vị trí mới'); X.drawPanel(); });
  $('#sbTour') && ($('#sbTour').onclick = () => X.map.tour([{ x: c.site.x, z: c.site.z, dist: 520, name: 'Sa bàn' }, { x: c.site.x, z: c.site.z, dist: 1400, name: 'Tổng quan' }]));
  // phương án
  $('#vSave') && ($('#vSave').onclick = saveVariant);
  $('#vCmp') && ($('#vCmp').onclick = compareVariants);
  $('#vExpCur') && ($('#vExpCur').onclick = () => exportJSON(work().data, work().name));
  $('#vImp') && $('#vImp').addEventListener('change', importJSON);
  $('#vReset') && ($('#vReset').onclick = resetWork);
  el.querySelectorAll('[data-vload]').forEach((b) => (b.onclick = () => loadVariant(b.dataset.vload)));
  el.querySelectorAll('[data-vexp]').forEach((b) => (b.onclick = () => { const v = M().variants.find((x) => x.id === b.dataset.vexp); exportJSON(v.data, v.name); }));
  el.querySelectorAll('[data-vdel]').forEach((b) => (b.onclick = () => { setState((s) => (s.map.variants = s.map.variants.filter((x) => x.id !== b.dataset.vdel)), true); X.drawPanel(); }));
}
