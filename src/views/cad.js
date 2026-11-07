// =====================================================================
// Màn hình THIẾT KẾ CAD 2D → DỰNG 3D → PHÂN TÍCH KẾT CẤU → KỊCH BẢN (nhà khung BTCT)
// Dòng lệnh kiểu AutoCAD (L, PL, REC, C, A, M, CO, RO, MI, SC, O, TR, EX, F, E, AR, DLI, T, H, DI, AA, ID, LI, LA, U, Z…)
// + lệnh kết cấu: TRUC, COT, DAM, SAN, VACH, TUONG, MONG, KHUNG, TANG, PT
// Bản vẽ đơn vị mm. Kết quả tính: bộ giải demo chưa kiểm định (V&V) — kỹ sư có thẩm quyền quyết định.
// =====================================================================
import { getState, setState } from '../store.js';
import { esc, fmt, fmtInt, toast, modal, download, todayISO } from '../lib/util.js';
import { toDXF, fromDXF } from '../lib/cad/dxf.js';
import { Building3D, uColor } from '../lib/cad/view3d.js';
import * as D from '../lib/struct/design.js';
import { askClaude, aiOnline } from '../lib/ai.js';

// ----------------------------------------------------------------- trạng thái
const LAYERS0 = [['0', '#ffffff'], ['A-WALL', '#c0c0c0'], ['DIM', '#00ffff'], ['TEXT', '#ffff00'], ['HATCH', '#808080'], ['S-GRID', '#ff5555'], ['S-COL', '#ffffff'], ['S-BEAM', '#ffd54a'], ['S-SLAB', '#55dd88'], ['S-WALL', '#ff66ff'], ['S-FOOT', '#66aaff']].map(([name, color]) => ({ name, color, visible: true, locked: false }));
const newDoc = (tenant) => ({ layers: LAYERS0.map((l) => ({ ...l })), cur: '0', ents: [], struct: D.frameTemplate(), seq: 1000 });
function S() {
  const s = getState();
  if (!s.cad || !s.cad.doc) {
    const site = s.map?.model?.['dong-nai']?.site;
    const b = D.defaultBuilding('dong-nai');
    if (site?.floors) b.storeys = site.floors;
    const doc = newDoc('dong-nai'), A = D.analyze(doc.struct, b);
    if (A.ok) D.sizeFootings(doc.struct, D.check(A));
    const Q = D.qto(doc.struct, b);
    const supply = Object.fromEntries(Object.entries(Q.gross).map(([k, v]) => [k, { qty: Math.ceil(v * 1.02), perMonth: Math.ceil((v * 1.15) / ((b.storeys * 10) / 30)) }]));
    setState((x) => (x.cad = { doc, b, supply, cycle: 10, scen: D.offlineScenarios('dong-nai'), scenSrc: 'offline' }), true);
  }
  return getState().cad;
}
const save = () => setState(() => {}, true);
let root, cv, ctx, v3, ui = { view: '2d', panel: 'props', sel: new Set(), osnap: true, ortho: false, grid: true, gsnap: false, res: null, A: null, combo: 'ULS2', colorU: true, deform: false, scen: null, scenRes: {}, mc: null };
const view = { x: -6000, y: -6000, s: 0.02 }; // gốc trái-dưới (mm) và tỉ lệ px/mm
let undoStack = [], redoStack = [], hover = null, snapPt = null, cmd = null, lastCmd = null, rubber = null, dragBox = null;

// ----------------------------------------------------------------- hình học
const W2S = (x, y) => [(x - view.x) * view.s, cv.height / devicePixelRatio - (y - view.y) * view.s];
const S2W = (px, py) => [px / view.s + view.x, (cv.height / devicePixelRatio - py) / view.s + view.y];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function segInt(a, b, c, d, infinite = false) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (!infinite && (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9)) return null;
  return { p: [a[0] + t * r[0], a[1] + t * r[1]], t, u };
}
const segDist = (p, a, b) => { const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2; let t = L2 ? ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2 : 0; t = Math.max(0, Math.min(1, t)); return dist(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); };
const circle3 = (a, b, c) => { const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-9) return null; const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d, uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d; return [ux, uy]; };
const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
const nid = (p) => { const d = S().doc; return `${p}${++d.seq}`; };
// đoạn thẳng của mọi đối tượng (cho bắt điểm, cắt, giao)
function segments() {
  const d = S().doc, out = [], st = d.struct, vis = new Set(d.layers.filter((l) => l.visible).map((l) => l.name));
  for (const e of d.ents) {
    if (!vis.has(e.layer)) continue;
    if (e.type === 'line') out.push({ a: e.pts[0], b: e.pts[1], ref: e });
    else if (e.type === 'pline' || e.type === 'hatch') e.pts.forEach((p, i) => { if (i < e.pts.length - 1 || e.closed || e.type === 'hatch') out.push({ a: p, b: e.pts[(i + 1) % e.pts.length], ref: e, i }); });
  }
  if (vis.has('S-GRID')) { const g = st.grid, y0 = g.ys[0] - 2000, y1 = g.ys.at(-1) + 2000, x0 = g.xs[0] - 2000, x1 = g.xs.at(-1) + 2000; g.xs.forEach((x) => out.push({ a: [x, y0], b: [x, y1], ref: { type: 'grid' } })); g.ys.forEach((y) => out.push({ a: [x0, y], b: [x1, y], ref: { type: 'grid' } })); }
  if (vis.has('S-BEAM')) st.beams.forEach((b) => out.push({ a: [b.x1, b.y1], b: [b.x2, b.y2], ref: b }));
  if (vis.has('S-WALL')) st.walls.forEach((w) => out.push({ a: [w.x1, w.y1], b: [w.x2, w.y2], ref: w }));
  return out;
}
function findSnap(p, from) {
  const tol = 12 / view.s, d = S().doc, st = d.struct;
  let best = null;
  const cand = (q, kind) => { const dd = dist(p, q); if (dd < tol && (!best || dd < best.d - 1e-6 || (Math.abs(dd - best.d) < 1e-6 && kind === 'end'))) best = { p: q, kind, d: dd }; };
  if (ui.osnap) {
    const segs = segments();
    for (const s of segs) { if (s.ref.type !== 'grid') { cand(s.a, 'end'); cand(s.b, 'end'); } cand([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2], 'mid'); }
    for (const e of d.ents) if (e.type === 'circle' || e.type === 'arc') cand(e.c, 'cen');
    for (const c of st.cols) cand([c.x, c.y], 'cen');
    const near = segs.filter((s) => segDist(p, s.a, s.b) < tol * 3);
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const r = segInt(near[i].a, near[i].b, near[j].a, near[j].b); if (r) cand(r.p, 'int'); }
    if (from) for (const s of near) { const r = [s.b[0] - s.a[0], s.b[1] - s.a[1]], L2 = r[0] ** 2 + r[1] ** 2, t = ((from[0] - s.a[0]) * r[0] + (from[1] - s.a[1]) * r[1]) / L2; if (t > 0 && t < 1) cand([s.a[0] + t * r[0], s.a[1] + t * r[1]], 'per'); }
  }
  if (best) return best;
  if (ui.gsnap) return { p: [Math.round(p[0] / 50) * 50, Math.round(p[1] / 50) * 50], kind: 'grid' };
  return null;
}
const applyOrtho = (p, base) => (ui.ortho && base ? (Math.abs(p[0] - base[0]) > Math.abs(p[1] - base[1]) ? [p[0], base[1]] : [base[0], p[1]]) : p);

// ----------------------------------------------------------------- hoàn tác
function snapshot() { undoStack.push(JSON.stringify(S().doc)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; }
function undo() { const s = undoStack.pop(); if (!s) return log('Không còn thao tác để hoàn tác'); redoStack.push(JSON.stringify(S().doc)); S().doc = JSON.parse(s); changed('Hoàn tác'); }
function redo() { const s = redoStack.pop(); if (!s) return log('Không có thao tác để làm lại'); undoStack.push(JSON.stringify(S().doc)); S().doc = JSON.parse(s); changed('Làm lại'); }
function changed(msg) { ui.res = null; ui.A = null; ui.mc = null; ui.scenRes = {}; save(); draw(); panel(); if (ui.view === '3d') build3d(); if (msg) log(msg); }

// ----------------------------------------------------------------- dòng lệnh & nhập liệu
let pending = null; // { kind:'point'|'number'|'text'|'select'|'choice', resolve, reject, opts }
function log(t, cls = '') { const h = root?.querySelector('#cadHist'); if (!h) return; const d = document.createElement('div'); d.className = cls; d.textContent = t; h.appendChild(d); while (h.children.length > 60) h.firstChild.remove(); h.scrollTop = 1e9; }
function prompt(t) { root.querySelector('#cadPrompt').textContent = t; }
const ask = (kind, text, opts = {}) => new Promise((resolve, reject) => { pending = { kind, resolve, reject, opts }; prompt(text); if (kind === 'select') ui.selecting = true; });
const getPoint = (t, base = null, o = {}) => ask('point', t, { base, ...o });
const getNum = (t, def) => ask('number', `${t}${def != null ? ` <${def}>` : ''}:`, { def });
const getText = (t, def = '') => ask('text', `${t}${def ? ` <${def}>` : ''}:`, { def });
async function getSel(t = 'Chọn đối tượng (Enter để xong):') { if (ui.sel.size) { const s = [...ui.sel]; return s; } await ask('select', t); const s = [...ui.sel]; return s; }
class Cancel extends Error {}
function cancel() { if (pending) { const p = pending; pending = null; p.reject(new Cancel()); } rubber = null; ui.selecting = false; prompt('Lệnh:'); draw(); }
function parseCoord(s, base) {
  s = s.trim();
  let m;
  if ((m = s.match(/^@\s*(-?[\d.]+)\s*<\s*(-?[\d.]+)$/)) && base) { const L = +m[1], a = (+m[2] * Math.PI) / 180; return [base[0] + L * Math.cos(a), base[1] + L * Math.sin(a)]; }
  if ((m = s.match(/^@\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)$/)) && base) return [base[0] + +m[1], base[1] + +m[2]];
  if ((m = s.match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)$/))) return [+m[1], +m[2]];
  if ((m = s.match(/^(-?[\d.]+)$/)) && base && hover) { const dx = hover[0] - base[0], dy = hover[1] - base[1], L = Math.hypot(dx, dy) || 1; let [ux, uy] = [dx / L, dy / L]; if (ui.ortho) [ux, uy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; return [base[0] + ux * +m[1], base[1] + uy * +m[1]]; }
  return null;
}
function submit(raw) {
  const s = raw.trim();
  if (pending) {
    const p = pending;
    if (p.kind === 'point') {
      if (!s) { pending = null; return p.resolve(null); }
      if (p.opts.keys && p.opts.keys.includes(s.toUpperCase())) { pending = null; return p.resolve(s.toUpperCase()); }
      if (p.opts.num && /^-?[\d.]+$/.test(s)) { pending = null; log(s); return p.resolve(+s); }
      const c = parseCoord(s, p.opts.base);
      if (!c) return log(`Không hiểu "${s}" — nhập x,y · @dx,dy · @L<góc · hoặc khoảng cách`, 'err');
      pending = null; log(`${s}`); return p.resolve(c);
    }
    if (p.kind === 'number') { const v = s === '' ? p.opts.def : +s.replace(',', '.'); if (v == null || !Number.isFinite(v)) return log('Cần nhập số', 'err'); pending = null; log(String(v)); return p.resolve(v); }
    if (p.kind === 'text') { pending = null; log(s || p.opts.def); return p.resolve(s || p.opts.def); }
    if (p.kind === 'select') { pending = null; ui.selecting = false; return p.resolve(true); }
    return;
  }
  run(s || lastCmd);
}

// ----------------------------------------------------------------- tạo đối tượng
function addEnt(e) { const d = S().doc; e.id = nid('E'); e.layer = e.layer || d.cur; d.ents.push(e); return e; }
const curLayer = () => S().doc.layers.find((l) => l.name === S().doc.cur);
function refs(ids) { const d = S().doc, st = d.struct, out = []; for (const id of ids) { const e = d.ents.find((q) => q.id === id) || st.cols.find((q) => q.id === id) || st.beams.find((q) => q.id === id) || st.slabs.find((q) => q.id === id) || st.walls.find((q) => q.id === id) || st.foots.find((q) => q.id === id); if (e) out.push(e); } return out; }
function kindOf(o) { const st = S().doc.struct; return st.cols.includes(o) ? 'col' : st.beams.includes(o) ? 'beam' : st.slabs.includes(o) ? 'slab' : st.walls.includes(o) ? 'wall' : st.foots.includes(o) ? 'foot' : 'ent'; }
// biến đổi hình học tại chỗ
function xform(o, f) {
  const k = kindOf(o);
  if (k === 'col' || k === 'foot') [o.x, o.y] = f([o.x, o.y]);
  else if (k === 'beam' || k === 'wall') { [o.x1, o.y1] = f([o.x1, o.y1]); [o.x2, o.y2] = f([o.x2, o.y2]); }
  else if (k === 'slab') o.pts = o.pts.map(f);
  else if (o.type === 'circle' || o.type === 'arc') { const c = f(o.c), q = f([o.c[0] + o.r, o.c[1]]); const a0p = f([o.c[0] + o.r * Math.cos(o.a0 || 0), o.c[1] + o.r * Math.sin(o.a0 || 0)]), a1p = f([o.c[0] + o.r * Math.cos(o.a1 || 0), o.c[1] + o.r * Math.sin(o.a1 || 0)]); o.r = dist(c, q); if (o.type === 'arc') { o.a0 = Math.atan2(a0p[1] - c[1], a0p[0] - c[0]); o.a1 = Math.atan2(a1p[1] - c[1], a1p[0] - c[0]); if (o._mir) [o.a0, o.a1] = [o.a1, o.a0]; } o.c = c; }
  else if (o.type === 'text') o.p = f(o.p);
  else if (o.type === 'dim') { o.pts = o.pts.map(f); o.d1 = f(o.d1); o.d2 = f(o.d2); }
  else o.pts = o.pts.map(f);
}
function cloneInto(o) { const k = kindOf(o), c = JSON.parse(JSON.stringify(o)), st = S().doc.struct; c.id = nid(k === 'ent' ? 'E' : { col: 'C', beam: 'B', slab: 'S', wall: 'V', foot: 'M' }[k]); (k === 'ent' ? S().doc.ents : st[{ col: 'cols', beam: 'beams', slab: 'slabs', wall: 'walls', foot: 'foots' }[k]]).push(c); return c; }
function erase(ids) { const d = S().doc, st = d.struct, set = new Set(ids); d.ents = d.ents.filter((e) => !set.has(e.id)); for (const k of ['cols', 'beams', 'slabs', 'walls', 'foots']) st[k] = st[k].filter((e) => !set.has(e.id)); }

// ----------------------------------------------------------------- LỆNH
const ALIAS = { L: 'LINE', PL: 'PLINE', REC: 'RECTANG', C: 'CIRCLE', A: 'ARC', T: 'TEXT', DT: 'TEXT', DLI: 'DIMLINEAR', DIM: 'DIMLINEAR', DAL: 'DIMLINEAR', H: 'HATCH', M: 'MOVE', CO: 'COPY', CP: 'COPY', RO: 'ROTATE', MI: 'MIRROR', SC: 'SCALE', O: 'OFFSET', TR: 'TRIM', EX: 'EXTEND', F: 'FILLET', E: 'ERASE', AR: 'ARRAY', DI: 'DIST', AA: 'AREA', LI: 'LIST', LA: 'LAYER', U: 'UNDO', Z: 'ZOOM', ZE: 'ZOOM', DXFOUT: 'DXFOUT', DXFIN: 'DXFIN', PT: 'PHANTICH' };
const NAMES = { LINE: 'Đoạn thẳng', PLINE: 'Đa tuyến', RECTANG: 'Chữ nhật', CIRCLE: 'Đường tròn', ARC: 'Cung tròn (3 điểm)', TEXT: 'Chữ', DIMLINEAR: 'Ghi kích thước', HATCH: 'Mặt cắt (hatch)', MOVE: 'Di chuyển', COPY: 'Sao chép', ROTATE: 'Xoay', MIRROR: 'Đối xứng', SCALE: 'Tỉ lệ', OFFSET: 'Offset', TRIM: 'Cắt (trim)', EXTEND: 'Kéo dài (extend)', FILLET: 'Bo góc R=0', ERASE: 'Xóa', ARRAY: 'Mảng chữ nhật', DIST: 'Đo khoảng cách', AREA: 'Đo diện tích', ID: 'Tọa độ điểm', LIST: 'Thông tin đối tượng', LAYER: 'Quản lý lớp', UNDO: 'Hoàn tác', REDO: 'Làm lại', ZOOM: 'Zoom toàn bộ', TRUC: 'Lưới trục', COT: 'Cột', DAM: 'Dầm', SAN: 'Sàn', VACH: 'Vách BTCT', TUONG: 'Tường xây', MONG: 'Móng', KHUNG: 'Khung mẫu', TANG: 'Thông số công trình', PHANTICH: 'Phân tích kết cấu', DXFOUT: 'Xuất DXF', DXFIN: 'Nhập DXF' };
async function run(raw) {
  if (!raw) return;
  const name = ALIAS[raw.toUpperCase()] || raw.toUpperCase();
  const fn = CMDS[name];
  if (!fn) return log(`Lệnh không xác định: "${raw}". Gõ ? để xem danh sách lệnh.`, 'err');
  if (cmd) cancel();
  lastCmd = name; cmd = name;
  log(`Lệnh: ${name} — ${NAMES[name] || ''}`, 'cmd');
  try { await fn(); } catch (e) { if (!(e instanceof Cancel)) { console.error(e); log('Lỗi: ' + e.message, 'err'); } else log('*Hủy*'); }
  cmd = null; rubber = null; pending = null; ui.selecting = false; prompt('Lệnh:'); draw(); panel();
}
const CMDS = {
  async LINE() { let a = await getPoint('Điểm đầu:'); if (!a) return; for (;;) { rubber = { type: 'line', a }; const b = await getPoint('Điểm tiếp theo [Enter: kết thúc]:', a); if (!b) return; snapshot(); addEnt({ type: 'line', pts: [a, b] }); a = b; changed(); } },
  async PLINE() {
    const pts = [await getPoint('Điểm đầu:')]; if (!pts[0]) return;
    for (;;) { rubber = { type: 'pline', pts }; const b = await getPoint('Điểm tiếp theo [C: đóng · Enter: xong]:', pts.at(-1), { keys: ['C'] }); if (b === 'C' || !b) { if (pts.length > 1) { snapshot(); addEnt({ type: 'pline', pts, closed: b === 'C' }); changed(); } return; } pts.push(b); draw(); }
  },
  async RECTANG() { const a = await getPoint('Góc thứ nhất:'); if (!a) return; rubber = { type: 'rect', a }; const b = await getPoint('Góc đối diện (hoặc @dài,rộng):', a); if (!b) return; snapshot(); addEnt({ type: 'pline', pts: [a, [b[0], a[1]], b, [a[0], b[1]]], closed: true }); changed(); },
  async CIRCLE() { const c = await getPoint('Tâm:'); if (!c) return; rubber = { type: 'circle', c }; const r = await ask('point', 'Bán kính (số hoặc điểm):', { base: c, num: true }); if (!r) return; snapshot(); addEnt({ type: 'circle', c, r: Array.isArray(r) ? dist(c, r) : r }); changed(); },
  async ARC() { const a = await getPoint('Điểm đầu cung:'); if (!a) return; const m = await getPoint('Điểm thứ hai:', a); if (!m) return; rubber = { type: 'arc3', a, m }; const b = await getPoint('Điểm cuối:', m); if (!b) return; const c = circle3(a, m, b); if (!c) return log('3 điểm thẳng hàng', 'err'); const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]); let a0 = ang(a), a1 = ang(b); const am = ang(m), ccw = (x, y, z) => ((y - x + 4 * Math.PI) % (2 * Math.PI)) < ((z - x + 4 * Math.PI) % (2 * Math.PI)); if (!ccw(a0, am, a1)) [a0, a1] = [a1, a0]; snapshot(); addEnt({ type: 'arc', c, r: dist(c, a), a0, a1 }); changed(); },
  async TEXT() { const p = await getPoint('Điểm chèn chữ:'); if (!p) return; const h = await getNum('Chiều cao chữ (mm)', 250); const t = await getText('Nội dung'); if (!t) return; snapshot(); addEnt({ type: 'text', p, h, text: t, layer: 'TEXT' }); changed(); },
  async DIMLINEAR() { const a = await getPoint('Điểm gốc thứ nhất:'); if (!a) return; const b = await getPoint('Điểm gốc thứ hai:', a); if (!b) return; rubber = { type: 'dim', a, b }; const o = await getPoint('Vị trí đường kích thước:', b); if (!o) return; const L = dist(a, b), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, off = (o[0] - a[0]) * nx + (o[1] - a[1]) * ny; snapshot(); addEnt({ type: 'dim', pts: [a, b], d1: [a[0] + nx * off, a[1] + ny * off], d2: [b[0] + nx * off, b[1] + ny * off], layer: 'DIM' }); changed(); log(`Kích thước = ${fmt(L, 0)} mm`); },
  async HATCH() { const sel = refs(await getSel('Chọn đa tuyến kín để tô mặt cắt:')).filter((o) => o.type === 'pline' && o.closed); if (!sel.length) return log('Cần đa tuyến kín', 'err'); snapshot(); sel.forEach((o) => addEnt({ type: 'hatch', pts: o.pts.map((p) => [...p]), layer: 'HATCH' })); ui.sel.clear(); changed(`Đã tô ${sel.length} vùng`); },
  async MOVE() { const sel = refs(await getSel()); if (!sel.length) return; const a = await getPoint('Điểm gốc:'); if (!a) return; rubber = { type: 'move', a, sel }; const b = await getPoint('Điểm đến:', a); if (!b) return; snapshot(); sel.forEach((o) => xform(o, ([x, y]) => [x + b[0] - a[0], y + b[1] - a[1]])); changed(`Đã di chuyển ${sel.length} đối tượng`); },
  async COPY() { const sel = refs(await getSel()); if (!sel.length) return; const a = await getPoint('Điểm gốc:'); if (!a) return; for (;;) { rubber = { type: 'move', a, sel }; const b = await getPoint('Điểm đến [Enter: xong]:', a); if (!b) return; snapshot(); sel.forEach((o) => xform(cloneInto(o), ([x, y]) => [x + b[0] - a[0], y + b[1] - a[1]])); changed(); } },
  async ROTATE() { const sel = refs(await getSel()); if (!sel.length) return; const c = await getPoint('Điểm gốc xoay:'); if (!c) return; const r = await ask('point', 'Góc xoay (độ, ngược chiều kim đồng hồ) hoặc điểm:', { base: c, num: true }); if (r == null) return; const ang = Array.isArray(r) ? Math.atan2(r[1] - c[1], r[0] - c[0]) : (r * Math.PI) / 180; snapshot(); sel.forEach((o) => xform(o, ([x, y]) => [c[0] + (x - c[0]) * Math.cos(ang) - (y - c[1]) * Math.sin(ang), c[1] + (x - c[0]) * Math.sin(ang) + (y - c[1]) * Math.cos(ang)])); changed(); },
  async MIRROR() { const sel = refs(await getSel()); if (!sel.length) return; const a = await getPoint('Điểm thứ nhất của trục đối xứng:'); if (!a) return; const b = await getPoint('Điểm thứ hai:', a); if (!b) return; const del = (await getText('Xóa đối tượng gốc? [C/K]', 'K')).toUpperCase() === 'C'; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const f = ([x, y]) => { const t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2, px = a[0] + t * dx, py = a[1] + t * dy; return [2 * px - x, 2 * py - y]; }; snapshot(); sel.forEach((o) => { const c = del ? o : cloneInto(o); c._mir = true; xform(c, f); delete c._mir; }); changed(); },
  async SCALE() { const sel = refs(await getSel()); if (!sel.length) return; const c = await getPoint('Điểm gốc:'); if (!c) return; const k = await getNum('Hệ số tỉ lệ', 2); snapshot(); sel.forEach((o) => { xform(o, ([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]); if (o.h && o.type === 'text') o.h *= k; }); changed(); },
  async OFFSET() {
    const dd = await getNum('Khoảng cách offset (mm)', ui.lastOffset || 1000); ui.lastOffset = dd;
    for (;;) {
      ui.sel.clear(); const pick = await getPoint('Chọn đối tượng cần offset [Enter: xong]:'); if (!pick) return; const o = pickAt(pick); if (!o || !['line', 'pline', 'circle'].includes(o.type)) { log('Chỉ offset được đoạn thẳng, đa tuyến, đường tròn', 'err'); continue; }
      const side = await getPoint('Chọn phía offset:'); if (!side) return; snapshot();
      if (o.type === 'circle') addEnt({ type: 'circle', c: [...o.c], r: Math.max(1, o.r + (dist(o.c, side) > o.r ? dd : -dd)), layer: o.layer });
      else { const pts = o.pts, segs = pts.slice(0, o.closed ? pts.length : pts.length - 1).map((p, i) => [p, pts[(i + 1) % pts.length]]); const s0 = segs.reduce((b, s) => (segDist(side, s[0], s[1]) < segDist(side, b[0], b[1]) ? s : b)); const sgn = Math.sign((s0[1][0] - s0[0][0]) * (side[1] - s0[0][1]) - (s0[1][1] - s0[0][1]) * (side[0] - s0[0][0])) || 1; const lines = segs.map(([a, b]) => { const L = dist(a, b), nx = (-(b[1] - a[1]) / L) * dd * sgn, ny = ((b[0] - a[0]) / L) * dd * sgn; return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]]; }); const np = []; lines.forEach((l, i) => { if (i === 0 && !o.closed) np.push(l[0]); const nx = lines[(i + 1) % lines.length]; if (i < lines.length - 1 || o.closed) { const r = segInt(l[0], l[1], nx[0], nx[1], true); np.push(r ? r.p : l[1]); } else np.push(l[1]); }); if (o.closed) np.unshift(np.pop()); addEnt({ type: o.type, pts: np, closed: o.closed, layer: o.layer }); }
      changed();
    }
  },
  async TRIM() {
    for (;;) {
      const p = await getPoint('Chọn phần đoạn thẳng cần cắt bỏ [Enter: xong]:'); if (!p) return; const o = pickAt(p); if (!o || o.type !== 'line') { log('Chỉ cắt được đoạn thẳng (LINE)', 'err'); continue; }
      const [a, b] = o.pts, L = dist(a, b), tp = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L ** 2;
      const ts = segments().filter((s) => s.ref !== o).map((s) => segInt(a, b, s.a, s.b)).filter(Boolean).map((r) => r.t).filter((t) => t > 1e-6 && t < 1 - 1e-6).sort((x, y) => x - y);
      if (!ts.length) { log('Không có cạnh cắt nào giao đoạn này', 'err'); continue; }
      const lo = Math.max(0, ...ts.filter((t) => t < tp)), hi = Math.min(1, ...ts.filter((t) => t > tp)), P = (t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      snapshot(); erase([o.id]);
      if (lo > 0) addEnt({ type: 'line', pts: [a, P(lo)], layer: o.layer });
      if (hi < 1) addEnt({ type: 'line', pts: [P(hi), b], layer: o.layer });
      changed();
    }
  },
  async EXTEND() {
    for (;;) {
      const p = await getPoint('Chọn đầu đoạn thẳng cần kéo dài [Enter: xong]:'); if (!p) return; const o = pickAt(p); if (!o || o.type !== 'line') { log('Chỉ kéo dài được đoạn thẳng', 'err'); continue; }
      let [a, b] = o.pts; const endB = dist(p, b) < dist(p, a); if (!endB) [a, b] = [b, a];
      const hits = segments().filter((s) => s.ref !== o).map((s) => segInt(a, b, s.a, s.b, true)).filter((r) => r && r.t > 1 + 1e-6 && r.u >= -1e-6 && r.u <= 1 + 1e-6).sort((x, y) => x.t - y.t);
      if (!hits.length) { log('Không có biên để kéo tới', 'err'); continue; }
      snapshot(); o.pts = endB ? [a, hits[0].p] : [hits[0].p, a]; changed();
    }
  },
  async FILLET() { const p1 = await getPoint('Chọn đoạn thẳng thứ nhất:'); if (!p1) return; const o1 = pickAt(p1); const p2 = await getPoint('Chọn đoạn thẳng thứ hai:'); if (!p2) return; const o2 = pickAt(p2); if (o1?.type !== 'line' || o2?.type !== 'line') return log('Cần 2 đoạn thẳng', 'err'); const r = segInt(o1.pts[0], o1.pts[1], o2.pts[0], o2.pts[1], true); if (!r) return log('Hai đoạn song song', 'err'); snapshot(); for (const [o, pk] of [[o1, p1], [o2, p2]]) { const [a, b] = o.pts; o.pts = dist(pk, a) > dist(pk, b) ? [a, r.p] : [r.p, b]; } changed('Bo góc R = 0'); },
  async ERASE() { const sel = await getSel(); if (!sel.length) return; snapshot(); erase(sel); ui.sel.clear(); changed(`Đã xóa ${sel.length} đối tượng`); },
  async ARRAY() { const sel = refs(await getSel()); if (!sel.length) return; const r = await getNum('Số hàng', 1), c = await getNum('Số cột', 4), dy = r > 1 ? await getNum('Khoảng cách hàng (mm)', 6000) : 0, dx = c > 1 ? await getNum('Khoảng cách cột (mm)', 6000) : 0; snapshot(); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) if (i || j) sel.forEach((o) => xform(cloneInto(o), ([x, y]) => [x + j * dx, y + i * dy])); changed(`Mảng ${r} × ${c}`); },
  async DIST() { const a = await getPoint('Điểm thứ nhất:'); if (!a) return; rubber = { type: 'line', a }; const b = await getPoint('Điểm thứ hai:', a); if (!b) return; log(`Khoảng cách = ${fmt(dist(a, b), 1)} mm · ΔX = ${fmt(b[0] - a[0], 1)} · ΔY = ${fmt(b[1] - a[1], 1)} · góc = ${fmt((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, 2)}°`, 'res'); },
  async AREA() { const pts = []; for (;;) { rubber = { type: 'pline', pts, closed: true }; const p = await getPoint(pts.length ? 'Điểm tiếp [Enter: tính]:' : 'Điểm đầu (hoặc Enter rồi chọn đa tuyến kín):', pts.at(-1)); if (!p) break; pts.push(p); draw(); } if (pts.length < 3) { const o = refs(await getSel('Chọn đa tuyến kín / sàn:'))[0]; if (!o?.pts) return; pts.push(...o.pts); } const per = pts.reduce((t, p, i) => t + dist(p, pts[(i + 1) % pts.length]), 0); log(`Diện tích = ${fmt(polyArea(pts) / 1e6, 3)} m² · Chu vi = ${fmt(per / 1000, 3)} m`, 'res'); },
  async ID() { const p = await getPoint('Chọn điểm:'); if (p) log(`X = ${fmt(p[0], 1)} · Y = ${fmt(p[1], 1)}`, 'res'); },
  async LIST() { const sel = refs(await getSel()); sel.forEach((o) => log(`${kindOf(o) === 'ent' ? o.type.toUpperCase() : { col: 'CỘT', beam: 'DẦM', slab: 'SÀN', wall: 'VÁCH/TƯỜNG', foot: 'MÓNG' }[kindOf(o)]} ${o.id} · ${JSON.stringify(o, (k, v) => (k === 'id' ? undefined : typeof v === 'number' ? Math.round(v * 10) / 10 : v)).slice(0, 160)}`, 'res')); },
  async LAYER() { ui.panel = 'layers'; panel(); },
  async UNDO() { undo(); }, async REDO() { redo(); },
  async ZOOM() { zoomExtents(); },
  async DXFOUT() { download(`BanVe_${todayISO()}.dxf`, toDXF(S().doc), 'application/dxf'); log('Đã xuất DXF (R12, mm) — mở được bằng AutoCAD / LibreCAD', 'res'); },
  async DXFIN() { root.querySelector('#dxfIn').click(); },
  // ---- kết cấu
  async TRUC() {
    const g = S().doc.struct.grid, sp = (a) => a.slice(1).map((v, i) => v - a[i]).join(',');
    const xs = await getText('Khoảng cách trục X (mm, vd 7200,7200 hoặc 7200*6)', sp(g.xs)), ys = await getText('Khoảng cách trục Y (mm)', sp(g.ys));
    const parse = (s) => { const out = [0]; for (const t of s.split(/[,;\s]+/).filter(Boolean)) { const m = t.match(/^([\d.]+)(?:\*(\d+))?$/); if (!m) throw new Error('Sai định dạng: ' + t); for (let k = 0; k < (+m[2] || 1); k++) out.push(out.at(-1) + +m[1]); } return out; };
    const X = parse(xs), Y = parse(ys); snapshot(); Object.assign(g, { xs: X, ys: Y, xNames: X.map((_, i) => String(i + 1)), yNames: Y.map((_, i) => String.fromCharCode(65 + i)) }); changed(`Lưới trục ${X.length} × ${Y.length}`); zoomExtents();
  },
  async COT() {
    const [b, h] = (await getText('Tiết diện cột b×h (mm)', ui.colSize || '650x650')).split(/[x×*]/i).map(Number); ui.colSize = `${b}x${h}`;
    for (;;) { const p = await getPoint('Vị trí cột [A: tất cả giao điểm trục · Enter: xong]:', null, { keys: ['A'] }); if (!p) return; const st = S().doc.struct; snapshot();
      const put = (x, y) => { if (!st.cols.some((c) => dist([c.x, c.y], [x, y]) < 1)) st.cols.push({ id: nid('C'), x, y, b, h }); };
      if (p === 'A') { st.grid.xs.forEach((x) => st.grid.ys.forEach((y) => put(x, y))); changed('Đặt cột tại mọi giao điểm trục'); return; } put(...p); changed(); }
  },
  async DAM() {
    const [b, h] = (await getText('Tiết diện dầm b×h (mm)', ui.beamSize || '300x650')).split(/[x×*]/i).map(Number); ui.beamSize = `${b}x${h}`;
    let a = await getPoint('Điểm đầu dầm [A: tự động theo lưới trục giữa các cột]:', null, { keys: ['A'] }); if (!a) return; const st = S().doc.struct;
    if (a === 'A') { snapshot(); const has = (x1, y1, x2, y2) => st.beams.some((q) => (dist([q.x1, q.y1], [x1, y1]) < 1 && dist([q.x2, q.y2], [x2, y2]) < 1) || (dist([q.x1, q.y1], [x2, y2]) < 1 && dist([q.x2, q.y2], [x1, y1]) < 1)); const col = (x, y) => st.cols.some((c) => dist([c.x, c.y], [x, y]) < 1); let n = 0; for (const y of st.grid.ys) for (let i = 1; i < st.grid.xs.length; i++) { const x1 = st.grid.xs[i - 1], x2 = st.grid.xs[i]; if (col(x1, y) && col(x2, y) && !has(x1, y, x2, y)) { st.beams.push({ id: nid('B'), x1, y1: y, x2, y2: y, b, h }); n++; } } for (const x of st.grid.xs) for (let j = 1; j < st.grid.ys.length; j++) { const y1 = st.grid.ys[j - 1], y2 = st.grid.ys[j]; if (col(x, y1) && col(x, y2) && !has(x, y1, x, y2)) { st.beams.push({ id: nid('B'), x1: x, y1, x2: x, y2, b, h }); n++; } } changed(`Đã tạo ${n} dầm`); return; }
    for (;;) { rubber = { type: 'line', a }; const c = await getPoint('Điểm cuối dầm [Enter: xong]:', a); if (!c) return; snapshot(); st.beams.push({ id: nid('B'), x1: a[0], y1: a[1], x2: c[0], y2: c[1], b, h }); changed(); a = c; }
  },
  async SAN() {
    const t = await getNum('Chiều dày sàn (mm)', ui.slabT || 150); ui.slabT = t; const st = S().doc.struct, g = st.grid;
    const cell = (x, y) => { const i = g.xs.findIndex((v, k) => k < g.xs.length - 1 && x >= v && x <= g.xs[k + 1]), j = g.ys.findIndex((v, k) => k < g.ys.length - 1 && y >= v && y <= g.ys[k + 1]); return i < 0 || j < 0 ? null : [[g.xs[i], g.ys[j]], [g.xs[i + 1], g.ys[j]], [g.xs[i + 1], g.ys[j + 1]], [g.xs[i], g.ys[j + 1]]]; };
    const put = (pts) => { if (!st.slabs.some((s) => dist(s.pts[0], pts[0]) < 1 && dist(s.pts[2], pts[2]) < 1)) st.slabs.push({ id: nid('S'), pts, t }); };
    for (;;) { const p = await getPoint('Nhấp trong ô lưới trục [A: tất cả ô · Enter: xong]:', null, { keys: ['A'] }); if (!p) return; snapshot(); if (p === 'A') { for (let i = 0; i < g.xs.length - 1; i++) for (let j = 0; j < g.ys.length - 1; j++) put(cell(g.xs[i] + 1, g.ys[j] + 1)); changed('Đã tạo sàn mọi ô'); return; } const c = cell(...p); if (!c) { log('Điểm nằm ngoài lưới trục', 'err'); continue; } put(c); changed(); }
  },
  async VACH() { await wallCmd('rc', 300); }, async TUONG() { await wallCmd('brick', 200); },
  async MONG() {
    const st = S().doc.struct; const p = await getPoint('Nhấp tâm móng [A: dưới mọi cột (kích thước tự chọn theo phân tích) · Enter: xong]:', null, { keys: ['A'] }); if (!p) return;
    if (p === 'A') { const A = D.analyze(st, S().b); if (!A.ok) return log(A.error, 'err'); snapshot(); const n = D.sizeFootings(st, D.check(A)); changed(`Đã tạo/chọn lại ${n} móng theo phản lực G+Q và R đất = ${S().b.soilR} kPa`); return; }
    const B = await getNum('Kích thước móng B = L (mm)', 3000); snapshot(); st.foots.push({ id: nid('M'), x: p[0], y: p[1], B, L: B, H: 1000 }); changed();
  },
  async KHUNG() { if ((await getText('Thay toàn bộ kết cấu bằng khung mẫu 7×5 trục (khối nhà DA-2026-017)? [C/K]', 'C')).toUpperCase() !== 'C') return; snapshot(); S().doc.struct = D.frameTemplate(); const A = D.analyze(S().doc.struct, S().b); if (A.ok) D.sizeFootings(S().doc.struct, D.check(A)); changed('Đã tạo khung mẫu'); zoomExtents(); },
  async TANG() { buildingDialog(); },
  async PHANTICH() { analyzeNow(); },
};
async function wallCmd(kind, t0) { const t = await getNum(`Chiều dày ${kind === 'rc' ? 'vách BTCT' : 'tường xây'} (mm)`, t0); let a = await getPoint('Điểm đầu:'); if (!a) return; for (;;) { rubber = { type: 'line', a }; const b = await getPoint('Điểm cuối [Enter: xong]:', a); if (!b) return; snapshot(); S().doc.struct.walls.push({ id: nid(kind === 'rc' ? 'V' : 'W'), x1: a[0], y1: a[1], x2: b[0], y2: b[1], t, kind }); changed(); a = b; } }

// ----------------------------------------------------------------- chọn đối tượng
function pickAt(p) {
  const tol = 6 / view.s, d = S().doc, st = d.struct, vis = new Set(d.layers.filter((l) => l.visible && !l.locked).map((l) => l.name));
  let best = null, bd = tol;
  const test = (o, dd) => { if (dd < bd) { bd = dd; best = o; } };
  for (const e of d.ents) { if (!vis.has(e.layer)) continue; if (e.type === 'circle') test(e, Math.abs(dist(p, e.c) - e.r)); else if (e.type === 'arc') test(e, Math.abs(dist(p, e.c) - e.r)); else if (e.type === 'text') test(e, dist(p, e.p) < e.h * 2 ? 0 : 1e9); else if (e.pts) { const pts = e.type === 'dim' ? [e.d1, e.d2] : e.pts; for (let i = 0; i < pts.length - (e.closed || e.type === 'hatch' ? 0 : 1); i++) test(e, segDist(p, pts[i], pts[(i + 1) % pts.length])); } }
  if (vis.has('S-COL')) st.cols.forEach((c) => test(c, Math.abs(p[0] - c.x) <= c.b / 2 && Math.abs(p[1] - c.y) <= c.h / 2 ? 0 : 1e9));
  if (vis.has('S-WALL')) st.walls.forEach((w) => test(w, segDist(p, [w.x1, w.y1], [w.x2, w.y2]) - w.t / 2));
  if (vis.has('S-BEAM')) st.beams.forEach((b) => test(b, segDist(p, [b.x1, b.y1], [b.x2, b.y2]) - b.b / 2));
  if (best) return best;
  if (vis.has('S-FOOT')) st.foots.forEach((f) => test(f, Math.abs(p[0] - f.x) <= f.B / 2 && Math.abs(p[1] - f.y) <= f.L / 2 ? 0 : 1e9));
  if (vis.has('S-SLAB') && !best) st.slabs.forEach((s) => test(s, inPoly(p, s.pts) ? tol * 0.9 : 1e9));
  return best;
}
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
function boxSelect(a, b, crossing) {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]), inside = (p) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const d = S().doc, st = d.struct, vis = new Set(d.layers.filter((l) => l.visible && !l.locked).map((l) => l.name));
  const ptsOf = (o) => { const k = kindOf(o); if (k === 'col') return [[o.x - o.b / 2, o.y - o.h / 2], [o.x + o.b / 2, o.y + o.h / 2]]; if (k === 'foot') return [[o.x - o.B / 2, o.y - o.L / 2], [o.x + o.B / 2, o.y + o.L / 2]]; if (k === 'beam' || k === 'wall') return [[o.x1, o.y1], [o.x2, o.y2]]; if (o.type === 'circle' || o.type === 'arc') return [[o.c[0] - o.r, o.c[1] - o.r], [o.c[0] + o.r, o.c[1] + o.r]]; if (o.type === 'text') return [o.p]; return o.pts; };
  const layerOf = (o) => ({ col: 'S-COL', beam: 'S-BEAM', slab: 'S-SLAB', wall: 'S-WALL', foot: 'S-FOOT' }[kindOf(o)] || o.layer);
  for (const o of [...d.ents, ...st.cols, ...st.beams, ...st.slabs, ...st.walls, ...st.foots]) { if (!vis.has(layerOf(o))) continue; const ps = ptsOf(o); if (crossing ? ps.some(inside) || (ps.length === 2 && segBox(ps[0], ps[1], x0, y0, x1, y1)) : ps.every(inside)) ui.sel.add(o.id); }
}
const segBox = (a, b, x0, y0, x1, y1) => [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]].some(([c, d]) => segInt(a, b, c, d));

// ----------------------------------------------------------------- VẼ 2D
function draw() {
  if (!ctx || ui.view !== '2d') return;
  const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio, d = S().doc, st = d.struct;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#212830'; ctx.fillRect(0, 0, w, h);
  // lưới nền
  if (ui.grid) { let step = 1000; while (step * view.s < 14) step *= 5; ctx.strokeStyle = '#2c3540'; ctx.lineWidth = 1; ctx.beginPath(); const [ax, ay] = S2W(0, h), [bx, by] = S2W(w, 0); for (let x = Math.floor(ax / step) * step; x < bx; x += step) { const [px] = W2S(x, 0); ctx.moveTo(px, 0); ctx.lineTo(px, h); } for (let y = Math.floor(ay / step) * step; y < by; y += step) { const [, py] = W2S(0, y); ctx.moveTo(0, py); ctx.lineTo(w, py); } ctx.stroke(); }
  // gốc tọa độ (UCS)
  { const [ox, oy] = W2S(0, 0); ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 40, oy); ctx.stroke(); ctx.strokeStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 40); ctx.stroke(); ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.fillText('X', ox + 42, oy + 4); ctx.fillText('Y', ox - 3, oy - 44); }
  const L = Object.fromEntries(d.layers.map((l) => [l.name, l])), vis = (n) => L[n]?.visible !== false, col = (n) => L[n]?.color || '#fff';
  const sel = (id) => ui.sel.has(id);
  const P = (p) => W2S(p[0], p[1]);
  const path = (pts, close) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
  const U = ui.colorU && ui.res ? new Map(ui.res.items.filter((q) => q.storey === 1 || q.type === 'beam').map((q) => [q.id, Math.max(q.u, (ui.res.items.filter((r) => r.id === q.id).reduce((m, r) => Math.max(m, r.u), 0)))])) : null;
  const FU = ui.colorU && ui.res ? new Map(ui.res.base.filter((p) => p.foot).map((p) => [p.foot.id, p.u])) : null;
  // sàn
  if (vis('S-SLAB')) for (const s of st.slabs) { path(s.pts, true); ctx.fillStyle = sel(s.id) ? 'rgba(249,115,22,.35)' : 'rgba(85,221,136,.08)'; ctx.fill(); ctx.strokeStyle = sel(s.id) ? '#f97316' : 'rgba(85,221,136,.35)'; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); if (view.s > 0.03) { const c = s.pts.reduce((a, p) => [a[0] + p[0] / s.pts.length, a[1] + p[1] / s.pts.length], [0, 0]), [x, y] = P(c); ctx.fillStyle = '#55dd88'; ctx.font = '10px sans-serif'; ctx.fillText(`${s.id} h=${s.t}`, x - 22, y); } }
  if (vis('S-FOOT')) for (const f of st.foots) { const [x0, y0] = W2S(f.x - f.B / 2, f.y + f.L / 2); ctx.strokeStyle = sel(f.id) ? '#f97316' : FU?.get(f.id) != null ? uColor(FU.get(f.id)) : col('S-FOOT'); ctx.setLineDash([8, 5]); ctx.strokeRect(x0, y0, f.B * view.s, f.L * view.s); ctx.setLineDash([]); }
  // lưới trục
  if (vis('S-GRID')) { const g = st.grid, y0 = g.ys[0] - 2000, y1 = g.ys.at(-1) + 2000, x0 = g.xs[0] - 2000, x1 = g.xs.at(-1) + 2000; ctx.strokeStyle = col('S-GRID'); ctx.lineWidth = 1; ctx.setLineDash([18, 5, 3, 5]); ctx.beginPath(); g.xs.forEach((x) => { const [a, b] = [P([x, y0]), P([x, y1])]; ctx.moveTo(...a); ctx.lineTo(...b); }); g.ys.forEach((y) => { const [a, b] = [P([x0, y]), P([x1, y])]; ctx.moveTo(...a); ctx.lineTo(...b); }); ctx.stroke(); ctx.setLineDash([]); const r = Math.max(8, 400 * view.s); ctx.font = `${Math.max(9, r)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const bub = (p, t) => { const [x, y] = P(p); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = col('S-GRID'); ctx.stroke(); ctx.fillStyle = '#fca5a5'; ctx.fillText(t, x, y + 1); }; g.xs.forEach((x, i) => { bub([x, y1 + 400 / 1], g.xNames[i]); bub([x, y0 - 400], g.xNames[i]); }); g.ys.forEach((y, i) => { bub([x0 - 400, y], g.yNames[i]); bub([x1 + 400, y], g.yNames[i]); }); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
  // dầm (2 nét song song, nét đứt)
  if (vis('S-BEAM')) for (const b of st.beams) { const Lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), nx = (-(b.y2 - b.y1) / Lb) * b.b / 2, ny = ((b.x2 - b.x1) / Lb) * b.b / 2; ctx.strokeStyle = sel(b.id) ? '#f97316' : U?.get(b.id) != null ? uColor(U.get(b.id)) : col('S-BEAM'); ctx.lineWidth = U ? 2 : 1; ctx.setLineDash([7, 4]); ctx.beginPath(); for (const s of [1, -1]) { ctx.moveTo(...P([b.x1 + s * nx, b.y1 + s * ny])); ctx.lineTo(...P([b.x2 + s * nx, b.y2 + s * ny])); } ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; if (view.s > 0.035) { const [x, y] = P([(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2]); ctx.fillStyle = '#fde68a'; ctx.font = '10px sans-serif'; ctx.fillText(`${b.id} ${b.b}×${b.h}`, x + 3, y - 4); } }
  if (vis('S-WALL')) for (const wl of st.walls) { const Lw = Math.hypot(wl.x2 - wl.x1, wl.y2 - wl.y1), nx = (-(wl.y2 - wl.y1) / Lw) * wl.t / 2, ny = ((wl.x2 - wl.x1) / Lw) * wl.t / 2; path([[wl.x1 + nx, wl.y1 + ny], [wl.x2 + nx, wl.y2 + ny], [wl.x2 - nx, wl.y2 - ny], [wl.x1 - nx, wl.y1 - ny]], true); ctx.fillStyle = sel(wl.id) ? '#f97316' : wl.kind === 'rc' ? (U?.get(wl.id) != null ? uColor(U.get(wl.id)) : col('S-WALL')) : 'rgba(192,192,192,.5)'; ctx.globalAlpha = wl.kind === 'rc' ? 0.75 : 1; ctx.fill(); ctx.globalAlpha = 1; }
  if (vis('S-COL')) for (const c of st.cols) { const [x0, y0] = W2S(c.x - c.b / 2, c.y + c.h / 2), ww = c.b * view.s, hh = c.h * view.s; ctx.fillStyle = sel(c.id) ? '#f97316' : U?.get(c.id) != null ? uColor(U.get(c.id)) : '#e5e7eb'; ctx.fillRect(x0, y0, Math.max(2, ww), Math.max(2, hh)); ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + ww, y0 + hh); ctx.moveTo(x0 + ww, y0); ctx.lineTo(x0, y0 + hh); ctx.stroke(); if (view.s > 0.035) { ctx.fillStyle = '#e2e8f0'; ctx.font = '10px sans-serif'; ctx.fillText(`${c.id} ${c.b}×${c.h}`, x0 + ww + 2, y0 - 2); } }
  // đối tượng vẽ
  for (const e of d.ents) {
    if (!vis(e.layer)) continue;
    ctx.strokeStyle = ctx.fillStyle = sel(e.id) ? '#f97316' : col(e.layer); ctx.lineWidth = sel(e.id) ? 2 : 1;
    if (sel(e.id)) ctx.setLineDash([5, 3]);
    if (e.type === 'line' || e.type === 'pline') { path(e.pts, e.closed); ctx.stroke(); }
    else if (e.type === 'circle') { const [x, y] = P(e.c); ctx.beginPath(); ctx.arc(x, y, e.r * view.s, 0, Math.PI * 2); ctx.stroke(); }
    else if (e.type === 'arc') { const [x, y] = P(e.c); ctx.beginPath(); ctx.arc(x, y, e.r * view.s, -e.a0, -e.a1, true); ctx.stroke(); }
    else if (e.type === 'text') { const [x, y] = P(e.p); ctx.font = `${Math.max(6, e.h * view.s)}px sans-serif`; ctx.fillText(e.text, x, y); }
    else if (e.type === 'hatch') { ctx.save(); path(e.pts, true); ctx.stroke(); ctx.clip(); ctx.beginPath(); const xs = e.pts.map((p) => P(p)[0]), ys = e.pts.map((p) => P(p)[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); for (let k = x0 - (y1 - y0); k < x1; k += 8) { ctx.moveTo(k, y1); ctx.lineTo(k + (y1 - y0), y0); } ctx.stroke(); ctx.restore(); }
    else if (e.type === 'dim') { const [a, b] = e.pts; ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(e.d1)); ctx.moveTo(...P(b)); ctx.lineTo(...P(e.d2)); ctx.moveTo(...P(e.d1)); ctx.lineTo(...P(e.d2)); ctx.stroke(); for (const q of [e.d1, e.d2]) { const [x, y] = P(q); ctx.fillRect(x - 2, y - 2, 4, 4); } const [mx, my] = P([(e.d1[0] + e.d2[0]) / 2, (e.d1[1] + e.d2[1]) / 2]); ctx.save(); ctx.translate(mx, my); ctx.rotate(-Math.atan2(e.d2[1] - e.d1[1], e.d2[0] - e.d1[0])); ctx.font = `${Math.max(9, 250 * view.s)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(fmt(dist(a, b), 0), 0, -4); ctx.restore(); }
    ctx.setLineDash([]);
  }
  // xem trước (rubber band)
  if (rubber && hover) {
    const hp = applyOrtho(snapPt?.p || hover, rubber.a || (rubber.pts && rubber.pts.at(-1)));
    ctx.strokeStyle = '#f8fafc'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    if (rubber.type === 'line' || rubber.type === 'dim') { ctx.beginPath(); ctx.moveTo(...P(rubber.a)); ctx.lineTo(...P(hp)); ctx.stroke(); }
    else if (rubber.type === 'pline') { path([...rubber.pts, hp], rubber.closed); ctx.stroke(); }
    else if (rubber.type === 'rect') { path([rubber.a, [hp[0], rubber.a[1]], hp, [rubber.a[0], hp[1]]], true); ctx.stroke(); }
    else if (rubber.type === 'circle') { const [x, y] = P(rubber.c); ctx.beginPath(); ctx.arc(x, y, dist(rubber.c, hp) * view.s, 0, 7); ctx.stroke(); }
    else if (rubber.type === 'arc3') { path([rubber.a, rubber.m, hp]); ctx.stroke(); }
    else if (rubber.type === 'move') { ctx.beginPath(); ctx.moveTo(...P(rubber.a)); ctx.lineTo(...P(hp)); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  if (dragBox) { const [a, b] = [W2S(...dragBox.a), W2S(...dragBox.b)], cr = dragBox.b[0] < dragBox.a[0]; ctx.fillStyle = cr ? 'rgba(34,197,94,.12)' : 'rgba(59,130,246,.12)'; ctx.strokeStyle = cr ? '#22c55e' : '#3b82f6'; if (cr) ctx.setLineDash([5, 3]); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.setLineDash([]); }
  // dấu bắt điểm + con trỏ chữ thập
  if (snapPt) { const [x, y] = P(snapPt.p); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.beginPath(); if (snapPt.kind === 'end') ctx.rect(x - 6, y - 6, 12, 12); else if (snapPt.kind === 'mid') { ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x - 7, y + 5); ctx.closePath(); } else if (snapPt.kind === 'cen') ctx.arc(x, y, 7, 0, 7); else if (snapPt.kind === 'int') { ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); } else if (snapPt.kind === 'per') { ctx.moveTo(x - 6, y + 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x - 6, y + 6); ctx.lineTo(x - 6, y - 6); } else ctx.rect(x - 3, y - 3, 6, 6); ctx.stroke(); ctx.lineWidth = 1; ctx.fillStyle = '#facc15'; ctx.font = '10px sans-serif'; ctx.fillText({ end: 'Điểm cuối', mid: 'Trung điểm', cen: 'Tâm', int: 'Giao điểm', per: 'Vuông góc', grid: 'Lưới' }[snapPt.kind], x + 10, y - 10); }
  if (hover) { const [x, y] = P(hover); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke(); if (!pending || pending.kind === 'select' || !cmd) ctx.strokeRect(x - 4, y - 4, 8, 8); }
}
function zoomExtents() {
  const d = S().doc, st = d.struct, ps = [];
  d.ents.forEach((e) => (e.pts ? ps.push(...e.pts) : e.c ? ps.push([e.c[0] - e.r, e.c[1] - e.r], [e.c[0] + e.r, e.c[1] + e.r]) : e.p && ps.push(e.p)));
  st.grid.xs.forEach((x) => st.grid.ys.forEach((y) => ps.push([x, y])));
  st.foots.forEach((f) => ps.push([f.x - f.B / 2, f.y - f.L / 2], [f.x + f.B / 2, f.y + f.L / 2]));
  if (!ps.length || !cv) return;
  const x0 = Math.min(...ps.map((p) => p[0])) - 3500, x1 = Math.max(...ps.map((p) => p[0])) + 3500, y0 = Math.min(...ps.map((p) => p[1])) - 3500, y1 = Math.max(...ps.map((p) => p[1])) + 3500;
  const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
  view.s = Math.min(w / (x1 - x0), h / (y1 - y0)); view.x = (x0 + x1) / 2 - w / 2 / view.s; view.y = (y0 + y1) / 2 - h / 2 / view.s;
  draw();
}

// ----------------------------------------------------------------- SỰ KIỆN CHUỘT / BÀN PHÍM
function bindCanvas() {
  const el = cv;
  let pan = null, down = null;
  const wp = (e) => { const r = el.getBoundingClientRect(); return S2W(e.clientX - r.left, e.clientY - r.top); };
  el.addEventListener('mousemove', (e) => {
    const p = wp(e);
    if (pan) { view.x -= (e.clientX - pan[0]) / view.s; view.y += (e.clientY - pan[1]) / view.s; pan = [e.clientX, e.clientY]; draw(); return; }
    hover = p;
    snapPt = pending && pending.kind === 'point' ? findSnap(p, pending.opts.base) : null;
    if (down && !pending && dist(W2S(...down), W2S(...p)) > 5) dragBox = { a: down, b: p };
    else if (down && pending?.kind === 'select' && dist(W2S(...down), W2S(...p)) > 5) dragBox = { a: down, b: p };
    root.querySelector('#cadXY').textContent = `${fmt((snapPt?.p || p)[0], 0)}, ${fmt((snapPt?.p || p)[1], 0)} mm`;
    draw();
  });
  el.addEventListener('mousedown', (e) => { if (e.button === 1) { pan = [e.clientX, e.clientY]; e.preventDefault(); return; } if (e.button === 0) down = wp(e); });
  el.addEventListener('mouseup', (e) => {
    if (e.button === 1) { pan = null; return; }
    if (e.button === 2) { submit(''); return; }
    const p = wp(e), wasBox = dragBox; down = null; dragBox = null;
    if (wasBox) { if (!e.shiftKey) ui.sel.clear(); boxSelect(wasBox.a, wasBox.b, wasBox.b[0] < wasBox.a[0]); draw(); panel(); return; }
    if (pending?.kind === 'point') { const q = applyOrtho(snapPt?.p || p, pending.opts.base); const pr = pending; pending = null; log(`${fmt(q[0], 0)}, ${fmt(q[1], 0)}`); pr.resolve(pr.opts.num && pr.opts.base ? q : q); return; }
    const o = pickAt(p);
    if (o) { if (e.shiftKey && ui.sel.has(o.id)) ui.sel.delete(o.id); else ui.sel.add(o.id); }
    else if (!e.shiftKey && !pending) ui.sel.clear();
    draw(); panel();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('wheel', (e) => { e.preventDefault(); const r = el.getBoundingClientRect(), [mx, my] = S2W(e.clientX - r.left, e.clientY - r.top), f = e.deltaY < 0 ? 1.2 : 1 / 1.2; view.s *= f; const [nx, ny] = S2W(e.clientX - r.left, e.clientY - r.top); view.x += mx - nx; view.y += my - ny; draw(); }, { passive: false });
  el.addEventListener('mouseleave', () => { hover = null; snapPt = null; draw(); });
}
function onKey(e) {
  if (!root?.isConnected || ui.view !== '2d' || document.querySelector('.modal-wrap')) return;
  const inp = root.querySelector('#cadCmd');
  if (document.activeElement && document.activeElement !== inp && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === 'F3') { e.preventDefault(); ui.osnap = !ui.osnap; status(); return log(`OSNAP ${ui.osnap ? 'BẬT' : 'TẮT'}`); }
  if (e.key === 'F8') { e.preventDefault(); ui.ortho = !ui.ortho; status(); return log(`ORTHO ${ui.ortho ? 'BẬT' : 'TẮT'}`); }
  if (e.key === 'F7') { e.preventDefault(); ui.grid = !ui.grid; status(); draw(); return; }
  if (e.key === 'F9') { e.preventDefault(); ui.gsnap = !ui.gsnap; status(); return log(`SNAP lưới 50 mm ${ui.gsnap ? 'BẬT' : 'TẮT'}`); }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); return redo(); }
  if (e.key === 'Escape') { if (cmd || pending) cancel(); else { ui.sel.clear(); draw(); panel(); } inp.value = ''; return; }
  if (e.key === 'Delete' && !inp.value && ui.sel.size && !cmd) { run('ERASE'); return; }
  if (document.activeElement !== inp && e.key.length === 1 && !e.ctrlKey && !e.altKey && e.key !== ' ') { inp.focus(); }
  if (document.activeElement !== inp && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); submit(''); }
}

// ----------------------------------------------------------------- PHÂN TÍCH & KẾT QUẢ
function analyzeNow(silent) {
  const c = S(), t0 = performance.now();
  const A = D.analyze(c.doc.struct, c.b);
  if (!A.ok) { ui.res = null; log('Phân tích lỗi: ' + A.error, 'err'); toast(esc(A.error), 'err', 5000); return null; }
  ui.A = A; ui.res = D.check(A);
  if (!silent) log(`Phân tích xong: ${A.M.nodes.length} nút · ${A.M.elems.length} phần tử · ${A.R.nf} bậc tự do · ${fmt(performance.now() - t0, 0)} ms · ${ui.res.crit.filter((q) => !q.ok && !q.na).length ? 'CÓ TIÊU CHÍ KHÔNG ĐẠT' : 'đạt mọi tiêu chí'}`, 'res');
  ui.panel = ui.panel === 'scen' ? 'scen' : 'analysis'; draw(); panel(); if (ui.view === '3d') build3d();
  return ui.res;
}
function saveRun(kind, res, extra = {}) {
  const runId = `RUN-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)}`, b = S().b;
  setState((s) => { s.twin.runs.unshift({ runId, scenarioId: kind, scenarioVersion: 'S2.0', level: 'L2*', status: 'COMPLETED', createdAt: new Date().toISOString(), modelVersionId: `CAD/${S().doc.seq}`, dataVersionId: 'CAD-FRAME3D', input: { storeys: b.storeys, grade: b.grade, w0: b.w0, agR: b.agR, soilR: b.soilR, ...extra }, solverVersion: 'frame3d-linear/1.0 (chưa V&V)', inputHash: 'sha256:' + btoa(unescape(encodeURIComponent(JSON.stringify(extra) + b.storeys))).slice(0, 10) + '…', message: 'Bộ giải khung 3D demo — chưa kiểm định; kỹ sư có thẩm quyền quyết định (L3).', result: { status: res.crit.every((q) => q.ok || q.na) ? 'PASS' : 'FAIL', method: 'FEM_FRAME3D/1.0 + TCVN 5574 (đơn giản hóa)', summary: res.crit.map((q) => `${q.k}: ${fmt(q.u * 100, 0)}%`).join('; '), metrics: res.crit.filter((q) => !q.na).map((q) => ({ label: q.k, value: +(q.u * 100).toFixed(1), unit: '% khả năng', status: q.ok ? 'PASS' : 'FAIL' })) } }); s.twin.activeRunId = runId; }, true);
  return runId;
}

// ----------------------------------------------------------------- 3D
function build3d() {
  if (!v3) return;
  let deform = null;
  if (ui.deform && ui.A) {
    const A = ui.A, cb = D.COMBOS.find((q) => q.id === ui.combo) || D.COMBOS[0], byXYZ = new Map(A.M.nodes.map((n, i) => [`${Math.round(n.mx)}|${Math.round(n.my)}|${n.z.toFixed(3)}`, i]));
    const nodeAt = (x, y, z) => { let i = byXYZ.get(`${Math.round(x)}|${Math.round(y)}|${z.toFixed(3)}`); if (i == null) { let bd = Infinity; A.M.nodes.forEach((n, k) => { if (Math.abs(n.z - z) < 1e-3) { const dd = Math.hypot(n.mx - x, n.my - y); if (dd < bd) { bd = dd; i = k; } } }); } return i; };
    const sc = 80;
    deform = { fn: (x, y, z) => { const i = nodeAt(x, y, z); if (i == null) return [0, 0, 0]; const v = [0, 0, 0]; cb.k.forEach((k, c) => { if (k) for (let d = 0; d < 3; d++) v[d] += k * A.R.cases[c].disp[i * 6 + d] * sc; }); return v; } };
  }
  v3.build(S().doc.struct, scenB(), { res: ui.colorU ? ui.res : null, deform, sel: ui.sel });
  v3.setScenario(ui.scen, S().doc.struct, S().b);
}
const scenB = () => (ui.scen ? D.scenarioBuilding(S().b, ui.scen) : S().b);

// ----------------------------------------------------------------- AI KỊCH BẢN
async function aiScenarios() {
  const c = S(), b = c.b, R = D.REGION[b.tenant], Q = D.qto(c.doc.struct, b);
  const ctx = `Công trình: nhà khung BTCT ${b.storeys} tầng, cao ${fmt(D.levels(b).at(-1), 1)} m, mặt bằng ${fmt((c.doc.struct.grid.xs.at(-1) - c.doc.struct.grid.xs[0]) / 1000, 1)} × ${fmt((c.doc.struct.grid.ys.at(-1) - c.doc.struct.grid.ys[0]) / 1000, 1)} m, bê tông ${b.grade}, thép ${b.steel}. Vị trí: ${R.name} (vùng gió ${R.windZone}, W0 = ${b.w0} kPa; agR = ${b.agR}g; nền ${R.soil}, R = ${b.soilR} kPa). Khối lượng: bê tông ${fmtInt(Q.gross.concrete)} m³, thép ${fmtInt(Q.gross.steel)} t.`;
  const prompt = `${ctx}\n\nĐề xuất 6–8 kịch bản cực đoan sát thực tế nhất cho vị trí và công trình này (bão, mưa lũ/triều cường ngập móng, động đất, nắng nóng, vật liệu kém chất lượng, thiếu/trễ cung ứng). Trả về DUY NHẤT một mảng JSON, mỗi phần tử có: type ∈ {storm, quake, flood, heat, material, supply}; tham số tương ứng (storm: level 10–17; quake: agR 0.02–0.4; flood: water −3…3 (m so với mặt đất), pond 0–0.3; heat: dT 10–60; material: strength 50–100; supply: delay 0–120, cut 0–60); title (tiếng Việt, ngắn); why (căn cứ lịch sử/khí hậu của vùng, 1 câu). Không bịa sự kiện lịch sử — nếu không chắc thì ghi "giả định".`;
  log(aiOnline() ? 'Đang hỏi Claude đề xuất kịch bản theo vị trí…' : 'Không có Claude API key — dùng bộ kịch bản quy tắc offline theo vùng');
  if (!aiOnline()) { setState((s) => { s.cad.scen = D.offlineScenarios(b.tenant); s.cad.scenSrc = 'offline'; }, true); panel(); return; }
  try {
    const r = await askClaude(prompt, '', { maxTokens: 1600 });
    const j = JSON.parse(r.text.slice(r.text.indexOf('['), r.text.lastIndexOf(']') + 1));
    const ok = j.filter((q) => D.SCENARIO_TYPES[q.type]).map((q) => { const o = { type: q.type, title: String(q.title || D.SCENARIO_TYPES[q.type].label).slice(0, 120), why: String(q.why || '').slice(0, 240) }; for (const [k, , def, mn, mx] of D.SCENARIO_TYPES[q.type].params) o[k] = Math.min(mx, Math.max(mn, Number.isFinite(+q[k]) ? +q[k] : def)); return o; });
    if (!ok.length) throw new Error('không có kịch bản hợp lệ');
    setState((s) => { s.cad.scen = ok; s.cad.scenSrc = 'claude'; }, true); ui.scenRes = {}; log(`Claude đề xuất ${ok.length} kịch bản (tham số đã kẹp trong miền hợp lệ)`, 'res');
  } catch (e) { log('AI lỗi, dùng bộ offline: ' + e.message, 'err'); setState((s) => { s.cad.scen = D.offlineScenarios(b.tenant); s.cad.scenSrc = 'offline'; }, true); }
  panel();
}
function runScenario(i) {
  const c = S(), sc = c.scen[i];
  if (sc.type === 'supply') { const Q = D.qto(c.doc.struct, c.b), sp = D.supplyCheck(Q, c.supply, { storeys: c.b.storeys, cycle: c.cycle, delayDays: sc.delay, cut: sc.cut / 100 }); ui.scenRes[i] = { supply: sp, ok: sp.allOk && sp.delay === 0, maxU: null }; return ui.scenRes[i]; }
  const b2 = D.scenarioBuilding(c.b, sc), A = D.analyze(c.doc.struct, b2);
  if (!A.ok) return (ui.scenRes[i] = { error: A.error, ok: false });
  const r = D.check(A);
  ui.scenRes[i] = { maxU: r.maxU, fails: r.crit.filter((q) => !q.ok && !q.na).map((q) => q.k), ok: r.crit.every((q) => q.ok || q.na), crit: r.crit, b2 };
  return ui.scenRes[i];
}
async function aiExplain() {
  const c = S(), rows = c.scen.map((sc, i) => { const r = ui.scenRes[i] || runScenario(i); return `- ${sc.title}: ${r.supply ? `cung ứng ${r.supply.allOk ? 'đủ' : 'THIẾU'}, trễ tiến độ ${r.supply.delay} ngày` : `mức sử dụng lớn nhất ${fmt((r.maxU || 0) * 100, 0)}%${r.fails?.length ? '; không đạt: ' + r.fails.join(', ') : '; đạt'}`}`; }).join('\n');
  const q = `Kết quả chạy kịch bản cực đoan cho nhà khung BTCT ${c.b.storeys} tầng (bộ giải khung 3D demo, chưa V&V):\n${rows}\n\nHãy: (1) đánh giá mức độ khả thi/an toàn tổng thể; (2) xếp hạng rủi ro; (3) đề xuất biện pháp kỹ thuật cụ thể cho từng kịch bản không đạt (tăng tiết diện, vách cứng, móng cọc, cao độ san nền, dự phòng vật liệu…); (4) điểm cần kỹ sư kiểm tra bằng phần mềm thẩm tra.`;
  const box = root.querySelector('#aiOut');
  box.innerHTML = '<div class="muted small">Đang phân tích…</div>';
  const r = aiOnline() ? await askClaude(q, '', { maxTokens: 1800 }).catch((e) => ({ text: 'Lỗi AI: ' + e.message })) : { offline: true, text: offlineExplain() };
  box.innerHTML = `<div class="ai-text">${esc(r.text).replace(/\n/g, '<br>')}</div>${r.offline ? '<div class="small muted">(Diễn giải theo quy tắc offline — nhập Claude API key để AI diễn giải chi tiết.)</div>' : ''}`;
}
function offlineExplain() {
  const c = S(), out = ['ĐÁNH GIÁ TỔNG THỂ (quy tắc offline):'];
  c.scen.forEach((sc, i) => { const r = ui.scenRes[i]; if (!r) return; if (r.supply) out.push(`• ${sc.title}: ${r.supply.allOk ? 'đủ khối lượng' : 'THIẾU ' + r.supply.rows.filter((q) => !q.ok).map((q) => q.label).join(', ')}; trễ ${r.supply.delay} ngày → ${r.supply.delay ? 'ký hợp đồng khung với ≥ 2 nhà cung cấp, dự trữ thép 1 chu kỳ tầng' : 'đáp ứng'}.`); else if (r.ok) out.push(`• ${sc.title}: đạt (sử dụng tối đa ${fmt(r.maxU * 100, 0)}%).`); else out.push(`• ${sc.title}: KHÔNG ĐẠT — ${r.fails.join('; ')}. Biện pháp: ${r.fails.map((f) => (/Móng/.test(f) ? 'tăng kích thước móng hoặc chuyển móng cọc, nâng cao độ san nền' : /lệch tầng|Chuyển vị/.test(f) ? 'bổ sung vách cứng/lõi, tăng tiết diện cột biên' : /Cột|Vách/.test(f) ? 'tăng tiết diện hoặc mác bê tông cột tầng dưới' : 'tăng chiều cao dầm')).filter((v, k, a) => a.indexOf(v) === k).join('; ')}.`); });
  out.push('Kỹ sư cần thẩm tra bằng phần mềm kết cấu thương mại (ETABS/SAP2000/Midas) trước khi dùng cho hồ sơ.');
  return out.join('\n');
}

// ----------------------------------------------------------------- GIAO DIỆN
export function render(el) {
  root = el; S();
  el.innerHTML = `<div class="cadx" id="cadx">
    <div class="cad-ribbon">
      ${grp('Vẽ', [['LINE', '╱', 'Đoạn thẳng (L)'], ['PLINE', '⌇', 'Đa tuyến (PL)'], ['RECTANG', '▭', 'Chữ nhật (REC)'], ['CIRCLE', '◯', 'Tròn (C)'], ['ARC', '◠', 'Cung (A)'], ['TEXT', 'A', 'Chữ (T)'], ['DIMLINEAR', '↔', 'Kích thước (DLI)'], ['HATCH', '▨', 'Hatch (H)']])}
      ${grp('Sửa', [['MOVE', '✥', 'Di chuyển (M)'], ['COPY', '⧉', 'Sao chép (CO)'], ['ROTATE', '⟳', 'Xoay (RO)'], ['MIRROR', '⇋', 'Đối xứng (MI)'], ['SCALE', '⤢', 'Tỉ lệ (SC)'], ['OFFSET', '⫽', 'Offset (O)'], ['TRIM', '✂', 'Cắt (TR)'], ['EXTEND', '⇥', 'Kéo dài (EX)'], ['FILLET', '⌐', 'Bo góc (F)'], ['ARRAY', '⣿', 'Mảng (AR)'], ['ERASE', '🗑', 'Xóa (E)']])}
      ${grp('Kết cấu', [['TRUC', '#', 'Lưới trục'], ['COT', '■', 'Cột'], ['DAM', '═', 'Dầm'], ['SAN', '▦', 'Sàn'], ['VACH', '▮', 'Vách BTCT'], ['TUONG', '▯', 'Tường xây'], ['MONG', '⊡', 'Móng'], ['KHUNG', '🏢', 'Khung mẫu'], ['TANG', '⚙', 'Thông số công trình']])}
      ${grp('Tiện ích', [['DIST', '📏', 'Đo (DI)'], ['AREA', '⬚', 'Diện tích (AA)'], ['LIST', 'ℹ', 'Thông tin (LI)'], ['UNDO', '↶', 'Hoàn tác (Ctrl+Z)'], ['REDO', '↷', 'Làm lại (Ctrl+Y)'], ['ZOOM', '⛶', 'Zoom toàn bộ (Z)'], ['DXFIN', '⬆', 'Nhập DXF'], ['DXFOUT', '⬇', 'Xuất DXF']])}
      <div class="cad-grp"><div class="cad-btns"><button class="cad-view ${ui.view === '2d' ? 'on' : ''}" data-v="2d">✏️ Bản vẽ 2D</button><button class="cad-view ${ui.view === '3d' ? 'on' : ''}" data-v="3d">🧊 Mô hình 3D</button><button class="btn sm pri" id="cadRun">▶ Phân tích</button><button class="btn sm ai" id="toMap" title="Đặt mô hình thiết kế vào khu đất DA-2026-017 trên bản đồ vệ tinh">🗺 Sa bàn trên bản đồ</button></div><span>Chế độ</span></div>
    </div>
    <div class="cad-body">
      <div class="cad-main"><canvas id="cadCv"></canvas><div id="cad3d" class="cad3d" hidden></div><div class="cad-legend" id="cadLeg"></div></div>
      <aside class="cad-side"><div class="mx-tabs">${[['props', 'Thuộc tính'], ['layers', 'Lớp'], ['analysis', 'Kết cấu'], ['qto', 'Vật liệu'], ['scen', 'Kịch bản']].map(([k, l]) => `<button data-p="${k}">${l}</button>`).join('')}</div><div class="cad-panel" id="cadPanel"></div></aside>
    </div>
    <div class="cad-cmd"><div id="cadHist" class="cad-hist"></div><div class="cad-line"><span id="cadPrompt">Lệnh:</span><input id="cadCmd" autocomplete="off" spellcheck="false" placeholder="gõ lệnh: L, PL, REC, C, M, CO, O, TR… · TRUC, COT, DAM, SAN, PT · ? = trợ giúp"></div>
      <div class="cad-status"><span id="cadXY">0, 0 mm</span><button data-t="gsnap">SNAP</button><button data-t="grid">GRID</button><button data-t="ortho">ORTHO</button><button data-t="osnap">OSNAP</button><span class="muted">Cuộn = zoom · giữ nút giữa = pan · chuột phải = Enter · kéo trái→phải: chọn trong khung · phải→trái: chọn cắt qua</span></div></div>
    <input type="file" id="dxfIn" accept=".dxf" hidden>
  </div>`;
  cv = el.querySelector('#cadCv'); ctx = cv.getContext('2d');
  const fit = () => { const r = cv.parentElement.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; draw(); };
  const ro = new ResizeObserver(fit); ro.observe(cv.parentElement); fit();
  bindCanvas();
  el.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => run(b.dataset.c)));
  el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { ui.panel = b.dataset.p; panel(); }));
  el.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => setView(b.dataset.v)));
  el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { ui[b.dataset.t] = !ui[b.dataset.t]; status(); draw(); }));
  el.querySelector('#cadRun').onclick = () => analyzeNow();
  el.querySelector('#toMap').onclick = () => { setState((s) => (s.cad.place = { rot: 0, progress: 1, ...(s.cad.place || {}), on: true }), true); location.hash = 'map?focus=dong-nai&view=province&sel=DA-2026-017&sanban=1'; };
  const inp = el.querySelector('#cadCmd');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || (e.key === ' ' && pending?.kind !== 'text')) { e.preventDefault(); const v = inp.value; inp.value = ''; if (v.trim() === '?') return help(); submit(v); } });
  el.querySelector('#dxfIn').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { const r = fromDXF(t); snapshot(); const d = S().doc; for (const L of r.layers) if (!d.layers.some((l) => l.name === L)) d.layers.push({ name: L, color: '#c0c0c0', visible: true, locked: false }); r.ents.forEach((x) => addEnt(x)); changed(`Đã nhập ${r.ents.length} đối tượng từ ${f.name}`); zoomExtents(); }); e.target.value = ''; });
  document.addEventListener('keydown', onKey);
  log('AIPM CAD — bản vẽ đơn vị mm. Gõ ? để xem danh sách lệnh. Bản vẽ mẫu: khung BTCT khối nhà DA-2026-017.', 'cmd');
  status(); panel(); setTimeout(zoomExtents, 30);
  if (ui.view === '3d') setView('3d');
  return () => { document.removeEventListener('keydown', onKey); ro.disconnect(); v3?.dispose(); v3 = null; if (cmd) cancel(); };
}
const grp = (name, items) => `<div class="cad-grp"><div class="cad-btns">${items.map(([c, ic, t]) => `<button data-c="${c}" title="${t}"><b>${ic}</b><span>${t.replace(/ \(.*\)/, '')}</span></button>`).join('')}</div><span>${name}</span></div>`;
function status() { root.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', !!ui[b.dataset.t])); }
function setView(v) {
  ui.view = v;
  root.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  root.querySelector('#cadCv').hidden = v !== '2d';
  const d3 = root.querySelector('#cad3d'); d3.hidden = v !== '3d';
  if (v === '3d') { if (!v3) v3 = new Building3D(d3); build3d(); } else draw();
  legend();
}
function legend() {
  const el = root.querySelector('#cadLeg');
  el.innerHTML = ui.res && ui.colorU ? `<b>Mức sử dụng khả năng chịu lực</b>${[['#3b82f6', '< 40 %'], ['#22c55e', '40–70 %'], ['#facc15', '70–90 %'], ['#f97316', '90–100 %'], ['#dc2626', '> 100 % (không đạt)']].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}` : ui.view === '3d' ? '<b>Mô hình 3D</b><span>Kéo chuột xoay · cuộn zoom · chuột phải pan</span>' : '';
  el.hidden = !el.innerHTML;
}
function help() {
  modal({ wide: true, title: '⌨ Danh sách lệnh AIPM CAD', body: `<table class="tb small"><tr><th>Lệnh</th><th>Tắt</th><th>Chức năng</th></tr>${Object.entries(NAMES).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${Object.entries(ALIAS).filter(([, x]) => x === k).map(([a]) => a).join(', ')}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p class="small">Nhập tọa độ: <code>x,y</code> tuyệt đối · <code>@dx,dy</code> tương đối · <code>@L&lt;góc</code> cực · gõ một số = khoảng cách theo hướng con trỏ. Enter/Space = kết thúc/lặp lệnh trước · Esc = hủy · F3 OSNAP · F7 GRID · F8 ORTHO · F9 SNAP · Ctrl+Z/Y.</p>`, actions: [{ label: 'Đóng', cls: 'btn' }] });
}
function buildingDialog() {
  const b = S().b;
  const sel = (id, o, v) => `<select id="${id}">${Object.entries(o).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(Array.isArray(l) ? l[0] : l)}</option>`).join('')}</select>`;
  modal({ title: '⚙ Thông số công trình & tải trọng', body: `<div class="grid g2">
    <label class="f">Số tầng<input type="number" id="bN" value="${b.storeys}" min="1" max="60"></label><label class="f">Cao tầng 1 (m)<input type="number" id="bH1" step="0.1" value="${b.h1}"></label>
    <label class="f">Cao tầng điển hình (m)<input type="number" id="bH" step="0.1" value="${b.h}"></label><label class="f">Công năng (hoạt tải)${sel('bU', Object.fromEntries(Object.entries(D.LIVE).map(([k, v]) => [k, `${v[0]} · ${v[1]} kPa`])), b.use)}</label>
    <label class="f">Bê tông${sel('bG', Object.fromEntries(Object.keys(D.CONCRETE).map((k) => [k, k])), b.grade)}</label><label class="f">Cốt thép${sel('bS', Object.fromEntries(Object.keys(D.STEEL).map((k) => [k, k])), b.steel)}</label>
    <label class="f">Vị trí (tham số vùng)${sel('bT', Object.fromEntries(Object.entries(D.REGION).map(([k, v]) => [k, v.name])), b.tenant)}</label><label class="f">Áp lực gió W0 (kPa)<input type="number" id="bW" step="0.01" value="${b.w0}"></label>
    <label class="f">Gia tốc nền agR (g)<input type="number" id="bA" step="0.01" value="${b.agR}"></label><label class="f">Sức chịu tải nền R (kPa)<input type="number" id="bR" value="${b.soilR}"></label>
    <label class="f">Hàm lượng thép cột μ<input type="number" id="bMc" step="0.001" value="${b.muCol}"></label><label class="f">Hàm lượng thép dầm μ (mỗi phía)<input type="number" id="bMb" step="0.001" value="${b.muBeam}"></label></div>
    <div class="disclaimer">W0, agR, R đất là THAM SỐ DEMO theo vùng — phải tra QCVN 02:2022/BXD, TCVN 9386:2012 và báo cáo khảo sát địa chất của dự án.</div>`,
  actions: [{ label: 'Hủy', cls: 'btn' }, { label: 'Áp dụng', cls: 'btn pri', onClick: (w) => { const g = (id) => w.querySelector(id).value; const t = g('#bT'); const tenantChanged = t !== b.tenant; Object.assign(b, { storeys: +g('#bN'), h1: +g('#bH1'), h: +g('#bH'), use: g('#bU'), grade: g('#bG'), steel: g('#bS'), tenant: t, w0: tenantChanged ? D.REGION[t].w0 : +g('#bW'), agR: tenantChanged ? D.REGION[t].agR : +g('#bA'), soilR: tenantChanged ? D.REGION[t].soilR : +g('#bR'), muCol: +g('#bMc'), muBeam: +g('#bMb') }); changed(`Cập nhật công trình: ${b.storeys} tầng, ${b.grade}/${b.steel}, ${D.REGION[t].name}`); } }] });
}

// ----------------------------------------------------------------- BẢNG BÊN PHẢI
function panel() {
  const el = root?.querySelector('#cadPanel'); if (!el) return;
  root.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === ui.panel));
  const c = S(), d = c.doc, b = c.b;
  let h = '';
  if (ui.panel === 'props') {
    const sel = refs([...ui.sel]);
    if (!sel.length) h = `<h4>Bản vẽ</h4><div class="mt"><span>Đối tượng vẽ</span><span>${d.ents.length}</span><span>Lưới trục</span><span>${d.struct.grid.xs.length} × ${d.struct.grid.ys.length}</span><span>Cột / dầm / sàn</span><span>${d.struct.cols.length} / ${d.struct.beams.length} / ${d.struct.slabs.length}</span><span>Vách · tường / móng</span><span>${d.struct.walls.length} / ${d.struct.foots.length}</span><span>Số tầng</span><span>${b.storeys} (cao ${fmt(D.levels(b).at(-1), 1)} m)</span><span>Vật liệu</span><span>${b.grade} · ${b.steel}</span><span>Vị trí</span><span>${esc(D.REGION[b.tenant].name)}</span></div><button class="btn sm" data-x="TANG">⚙ Thông số công trình</button><p class="small muted">Chọn đối tượng trên bản vẽ để sửa thuộc tính. Mặt bằng kết cấu áp dụng cho mọi tầng (tầng điển hình).</p>`;
    else if (sel.length > 1) h = `<h4>${sel.length} đối tượng</h4><p class="small">Dùng M, CO, RO, MI, SC, E… để sửa nhóm.</p><button class="btn sm danger" data-x="ERASE">🗑 Xóa</button>`;
    else {
      const o = sel[0], k = kindOf(o), f = (key, label, step = 10) => `<label class="f">${label}<input type="number" data-k="${key}" value="${o[key]}" step="${step}"></label>`;
      const it = ui.res?.items.filter((q) => q.id === o.id).sort((a, z) => z.u - a.u)[0];
      h = `<h4>${{ col: '■ Cột', beam: '═ Dầm', slab: '▦ Sàn', wall: o.kind === 'rc' ? '▮ Vách BTCT' : '▯ Tường xây', foot: '⊡ Móng', ent: o.type?.toUpperCase() }[k]} ${o.id}</h4><div class="grid g2" style="gap:6px">`;
      if (k === 'col') h += f('b', 'b (mm)') + f('h', 'h (mm)') + f('x', 'X') + f('y', 'Y');
      else if (k === 'beam') h += f('b', 'b (mm)') + f('h', 'h (mm)') + `<span class="small">L = ${fmt(dist([o.x1, o.y1], [o.x2, o.y2]), 0)} mm</span>`;
      else if (k === 'slab') h += f('t', 'Chiều dày (mm)') + `<span class="small">A = ${fmt(polyArea(o.pts) / 1e6, 2)} m²</span>`;
      else if (k === 'wall') h += f('t', 'Chiều dày (mm)') + `<span class="small">L = ${fmt(dist([o.x1, o.y1], [o.x2, o.y2]), 0)} mm</span>`;
      else if (k === 'foot') h += f('B', 'B (mm)', 100) + f('L', 'L (mm)', 100) + f('H', 'Cao (mm)', 100);
      else h += `<label class="f">Lớp<select data-k="layer">${d.layers.map((l) => `<option ${l.name === o.layer ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>${o.type === 'circle' ? f('r', 'Bán kính') : ''}${o.type === 'text' ? `<label class="f">Nội dung<input type="text" data-k="text" value="${esc(o.text)}"></label>` + f('h', 'Cao chữ') : ''}`;
      h += '</div>';
      if (it) h += `<h5 style="margin-top:8px">Kết quả (tầng bất lợi T${it.storey})</h5>${Object.entries(it.checks).map(([kk, v]) => `<div class="small">${{ M: 'Uốn', V: 'Cắt', f: 'Độ võng', NM: 'Nén – uốn' }[kk]}: <b style="color:${uColor(v.u)}">${fmt(v.u * 100, 0)}%</b> · ${esc(v.combo)} · ${esc(v.txt)}</div>`).join('')}`;
      const bp = ui.res?.base.find((p) => p.foot?.id === o.id); if (bp) h += `<div class="small" style="margin-top:6px">Phản lực G+Q: <b>${fmt(bp.N, 0)} kN</b> · áp lực/R: <b style="color:${uColor(bp.u)}">${fmt(bp.u * 100, 0)}%</b></div>`;
    }
  } else if (ui.panel === 'layers') {
    h = `<h4>Quản lý lớp (LAYER)</h4><table class="tb small"><tr><th></th><th>Tên</th><th>Màu</th><th>Hiện</th><th>Khóa</th></tr>${d.layers.map((l, i) => `<tr><td><input type="radio" name="curL" data-cur="${i}" ${l.name === d.cur ? 'checked' : ''}></td><td>${esc(l.name)}</td><td><input type="color" data-lc="${i}" value="${l.color}"></td><td><input type="checkbox" data-lv="${i}" ${l.visible ? 'checked' : ''}></td><td><input type="checkbox" data-ll="${i}" ${l.locked ? 'checked' : ''}></td></tr>`).join('')}</table>
      <div class="row"><input type="text" id="newL" placeholder="Tên lớp mới"><button class="btn sm" id="addL">＋ Thêm lớp</button></div><p class="small muted">Lớp S-* là cấu kiện kết cấu (dùng cho tính toán và xuất DXF). Lớp hiện hành dùng cho đối tượng vẽ mới.</p>`;
  } else if (ui.panel === 'analysis') {
    const r = ui.res;
    h = `<div class="row"><button class="btn sm pri" data-x="PHANTICH">▶ Phân tích kết cấu</button><button class="btn sm" data-x="TANG">⚙ Thông số</button></div>`;
    if (!r) h += `<p class="small muted">Bộ giải khung 3D (phần tử dầm 12 bậc tự do, ma trận băng). Tải: bản thân, hoàn thiện, tường bao, hoạt tải theo công năng, gió tĩnh (W0·k(z)·c), động đất lực ngang tương đương (TCVN 9386), nhiệt độ. Kiểm tra theo TCVN 5574 (đơn giản hóa).</p><div class="disclaimer">Kết quả là sàng lọc kỹ thuật bằng bộ giải demo <b>chưa kiểm định (V&V)</b>. Hồ sơ thiết kế phải thẩm tra bằng phần mềm chuyên ngành; kỹ sư có thẩm quyền quyết định.</div>`;
    else {
      const I = r.info;
      h += `<h5>Tiêu chí kỹ thuật</h5><table class="tb small" id="critTbl">${r.crit.map((q) => `<tr><td>${esc(q.k)}${q.v ? `<div class="muted">${esc(q.v)}</div>` : ''}</td><td class="r"><b style="color:${q.na ? '#94a3b8' : uColor(q.u)}">${q.na ? '—' : fmt(q.u * 100, 0) + '%'}</b></td><td>${q.na ? '' : q.ok ? '<span class="badge green">Đạt</span>' : '<span class="badge red">Không đạt</span>'}</td></tr>`).join('')}</table>
        <div class="mt" style="margin-top:6px"><span>Chu kỳ dao động T1 (ước tính)</span><span>${fmt(I.T1, 2)} s</span><span>Lực cắt đáy động đất Fb</span><span>${fmtInt(I.Fb)} kN</span><span>Khối lượng tham gia</span><span>${fmtInt(I.mTot)} t</span><span>Chuyển vị đỉnh do gió X / Y</span><span>${fmt(r.drift.wX.top * 1000, 1)} / ${fmt(r.drift.wY.top * 1000, 1)} mm</span><span>Hệ số k(z) đỉnh</span><span>${fmt(I.kzTop, 2)}</span><span>Bộ giải</span><span>${ui.A.R.nf} bậc tự do · băng ${ui.A.R.bw}</span></div>
        <label class="lyr"><input type="checkbox" id="colU" ${ui.colorU ? 'checked' : ''}> Tô màu mức sử dụng trên bản vẽ/3D</label>
        <label class="lyr"><input type="checkbox" id="defo" ${ui.deform ? 'checked' : ''}> Hình biến dạng 3D (×80) theo <select id="cmb">${D.COMBOS.map((q) => `<option value="${q.id}" ${q.id === ui.combo ? 'selected' : ''}>${q.id}: ${esc(q.name)}</option>`).join('')}</select></label>
        <h5>Cấu kiện bất lợi nhất</h5><table class="tb small">${r.items.slice().sort((a, z) => z.u - a.u).slice(0, 10).map((q) => `<tr class="click" data-sel="${q.id}"><td>${q.id}</td><td>T${q.storey}</td><td>${{ M: 'uốn', V: 'cắt', f: 'võng', NM: 'N–M' }[q.gov]}</td><td class="r" style="color:${uColor(q.u)}"><b>${fmt(q.u * 100, 0)}%</b></td><td>${q.combo}</td></tr>`).join('')}</table>
        <div class="row"><button class="btn sm" data-x="MONG">⊡ Tự chọn móng</button><button class="btn sm" id="mcRun">🎲 Monte Carlo</button><button class="btn sm ai" id="saveRun">💾 Lưu run sang Digital Twin</button></div>
        <div id="mcOut">${ui.mc ? mcHtml(ui.mc) : ''}</div>
        <div class="disclaimer">Bộ giải demo chưa V&V · tương tác N–M tuyến tính (bảo thủ) · độ võng ×2,0 xét nứt/từ biến · W0, agR, R đất là tham số demo.</div>`;
    }
  } else if (ui.panel === 'qto') {
    const Q = D.qto(d.struct, b), sp = D.supplyCheck(Q, c.supply, { storeys: b.storeys, cycle: c.cycle });
    h = `<h4>Khối lượng vật liệu từ mô hình</h4><table class="tb small"><tr><th>Cấu kiện</th><th>Bê tông m³</th><th>Thép t</th><th>Ván khuôn m²</th></tr>${Object.entries(Q.parts).map(([k, v]) => `<tr><td>${{ col: 'Cột', wall: 'Vách', beam: 'Dầm', slab: 'Sàn', foot: 'Móng' }[k]}</td><td class="r">${fmtInt(v.v)}</td><td class="r">${fmt((v.v * Q.steelRate[k]) / 1000, 1)}</td><td class="r">${fmtInt(v.f)}</td></tr>`).join('')}</table>
      <h5 style="margin-top:8px">Đủ vật liệu để xây dựng không?</h5>
      <table class="tb small" id="supTbl"><tr><th>Vật liệu</th><th>Cần (kể hao hụt)</th><th>Hợp đồng</th><th>Giao/tháng</th><th></th></tr>${sp.rows.map((r) => `<tr><td>${r.label}</td><td class="r">${fmtInt(r.need)} ${r.unit}</td><td><input type="number" data-sq="${r.k}" value="${c.supply[r.k]?.qty ?? 0}" style="width:80px"></td><td><input type="number" data-sm="${r.k}" value="${c.supply[r.k]?.perMonth ?? 0}" style="width:70px"></td><td>${r.ok ? '<span class="badge green">Đủ</span>' : `<span class="badge red">Thiếu ${fmtInt(-r.gap)}</span>`}</td></tr>`).join('')}</table>
      <div class="row"><label class="f">Chu kỳ thi công 1 tầng (ngày)<input type="number" id="cyc" value="${c.cycle}"></label></div>
      <div class="task ${sp.allOk && !sp.delay ? '' : 'warn'}"><b>${sp.allOk ? '✅ Đủ khối lượng theo hợp đồng' : '⚠ THIẾU vật liệu so với nhu cầu mô hình'}</b><div class="small">${sp.delay ? `Năng lực giao hàng không theo kịp chu kỳ ${c.cycle} ngày/tầng → trễ phần thân ≈ <b>${sp.delay} ngày</b>` : `Giao hàng theo kịp tiến độ ${b.storeys} tầng × ${c.cycle} ngày`}</div></div>
      <p class="small muted">Thép theo hàm lượng μ (cột ${b.muCol * 100}%, dầm ${b.muBeam * 100}%/phía, sàn ${b.muSlab * 100}%/lớp) + đai/nối. Cấp phối ${b.grade}: ${D.MIX[b.grade].join(' · ')} (xi măng kg · cát m³ · đá m³ / m³ — tham khảo, đối chiếu định mức hiện hành). Hao hụt: bê tông ${D.WASTE.concrete * 100}%, thép ${D.WASTE.steel * 100}%.</p>
      <button class="btn sm" id="qtoCsv">⬇ Xuất CSV khối lượng</button>`;
  } else if (ui.panel === 'scen') {
    h = `<h4>Kịch bản cực đoan & khả thi</h4><div class="row"><button class="btn sm ai" id="aiGen">🤖 ${aiOnline() ? 'Claude đề xuất kịch bản theo vị trí' : 'Sinh kịch bản theo vùng (offline)'}</button><button class="btn sm pri" id="runAll">▶ Chạy tất cả</button></div>
      <div class="small muted">Nguồn kịch bản: ${c.scenSrc === 'claude' ? '🤖 Claude (tham số đã kẹp miền hợp lệ)' : 'bộ quy tắc offline theo vùng'} · ${esc(D.REGION[b.tenant].name)}</div>
      ${c.scen.map((sc, i) => { const r = ui.scenRes[i]; const T = D.SCENARIO_TYPES[sc.type]; return `<div class="task scen ${ui.scen === sc ? 'on' : ''}"><div class="row"><b>${T.label}</b><span class="spacer"></span>${r ? (r.ok ? '<span class="badge green">Đạt</span>' : '<span class="badge red">Không đạt</span>') : ''}</div><div class="small">${esc(sc.title)}</div><div class="small muted">${esc(sc.why || '')}</div>
        <div class="grid g2" style="gap:4px">${T.params.map(([k, l, , mn, mx, stp]) => `<label class="f small">${l}<input type="number" data-sp="${i}:${k}" value="${sc[k]}" min="${mn}" max="${mx}" step="${stp}"></label>`).join('')}</div>
        ${r ? (r.supply ? `<div class="small">Cung ứng: ${r.supply.allOk ? 'đủ' : 'THIẾU ' + r.supply.rows.filter((q) => !q.ok).map((q) => q.label).join(', ')} · trễ ${r.supply.delay} ngày</div>` : r.error ? `<div class="small err">${esc(r.error)}</div>` : `<div class="small">Sử dụng tối đa <b style="color:${uColor(r.maxU)}">${fmt(r.maxU * 100, 0)}%</b>${r.fails.length ? ' · không đạt: ' + r.fails.map(esc).join('; ') : ''}</div>`) : ''}
        <div class="row"><button class="btn sm" data-sr="${i}">▶ Chạy</button><button class="btn sm" data-sv="${i}">🧊 Xem 3D</button></div></div>`; }).join('')}
      <button class="btn sm ai" id="aiExp">🤖 AI đánh giá & đề xuất biện pháp</button><div id="aiOut"></div>`;
  }
  el.innerHTML = h;
  bindPanel(el); legend();
}
const mcHtml = (m) => `<div class="task"><b>Monte Carlo ${m.n} lần</b> (tải G ±8 %, Q ±25 %, gió ±20 %, động đất ±35 %, cường độ ±12 %)<div class="small">Xác suất vượt khả năng (thân công trình): <b style="color:${m.pf > 0.05 ? '#dc2626' : '#16a34a'}">${fmt(m.pf * 100, 1)}%</b> · trung vị ${fmt(m.p50 * 100, 0)}% · P95 ${fmt(m.p95 * 100, 0)}%</div><div class="mc-hist">${hist(m.us)}</div></div>`;
const hist = (us) => { const bins = Array(14).fill(0); us.forEach((u) => bins[Math.min(13, Math.floor(u / 0.1))]++); const mx = Math.max(...bins); return bins.map((n, i) => `<i title="${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}: ${n}" style="height:${(n / mx) * 100}%;background:${i >= 10 ? '#dc2626' : '#3b82f6'}"></i>`).join(''); };
function bindPanel(el) {
  const c = S(), d = c.doc;
  el.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => run(b.dataset.x)));
  el.querySelectorAll('[data-k]').forEach((inp) => (inp.onchange = () => { const o = refs([...ui.sel])[0]; if (!o) return; snapshot(); o[inp.dataset.k] = inp.type === 'number' ? +inp.value : inp.value; changed(`Đã sửa ${o.id}.${inp.dataset.k}`); }));
  el.querySelectorAll('[data-cur]').forEach((r) => (r.onchange = () => { d.cur = d.layers[+r.dataset.cur].name; save(); }));
  el.querySelectorAll('[data-lc]').forEach((r) => (r.onchange = () => { d.layers[+r.dataset.lc].color = r.value; save(); draw(); }));
  el.querySelectorAll('[data-lv]').forEach((r) => (r.onchange = () => { d.layers[+r.dataset.lv].visible = r.checked; save(); draw(); }));
  el.querySelectorAll('[data-ll]').forEach((r) => (r.onchange = () => { d.layers[+r.dataset.ll].locked = r.checked; save(); }));
  el.querySelector('#addL')?.addEventListener('click', () => { const n = el.querySelector('#newL').value.trim(); if (!n || d.layers.some((l) => l.name === n)) return; d.layers.push({ name: n, color: '#ffffff', visible: true, locked: false }); d.cur = n; save(); panel(); });
  el.querySelector('#colU')?.addEventListener('change', (e) => { ui.colorU = e.target.checked; draw(); if (ui.view === '3d') build3d(); legend(); });
  el.querySelector('#defo')?.addEventListener('change', (e) => { ui.deform = e.target.checked; if (ui.deform && ui.view !== '3d') setView('3d'); else build3d(); });
  el.querySelector('#cmb')?.addEventListener('change', (e) => { ui.combo = e.target.value; build3d(); });
  el.querySelectorAll('[data-sel]').forEach((r) => (r.onclick = () => { ui.sel = new Set([r.dataset.sel]); ui.panel = 'props'; draw(); panel(); if (ui.view === '3d') build3d(); }));
  el.querySelector('#mcRun')?.addEventListener('click', () => { if (!ui.A) return; ui.mc = D.monteCarlo(ui.A, 300); el.querySelector('#mcOut').innerHTML = mcHtml(ui.mc); log(`Monte Carlo: P(vượt) = ${fmt(ui.mc.pf * 100, 1)}%`, 'res'); });
  el.querySelector('#saveRun')?.addEventListener('click', () => { const id = saveRun('STRUCT-FRAME', ui.res, { combo: 'ULS/SLS' }); toast(`Đã lưu ${id} vào lịch sử run Digital Twin (mức L2* — chưa V&V)`, 'ok'); });
  el.querySelectorAll('[data-sq],[data-sm]').forEach((inp) => (inp.onchange = () => { const k = inp.dataset.sq || inp.dataset.sm; c.supply[k] = c.supply[k] || { qty: 0, perMonth: 0 }; c.supply[k][inp.dataset.sq ? 'qty' : 'perMonth'] = +inp.value; save(); panel(); }));
  el.querySelector('#cyc')?.addEventListener('change', (e) => { c.cycle = Math.max(3, +e.target.value); save(); panel(); });
  el.querySelector('#qtoCsv')?.addEventListener('click', () => { const Q = D.qto(d.struct, c.b), sp = D.supplyCheck(Q, c.supply, { storeys: c.b.storeys, cycle: c.cycle }); download(`KhoiLuong_VatLieu_${todayISO()}.csv`, '﻿' + ['vat_lieu,don_vi,can_net,can_ke_hao_hut,hop_dong,giao_thang,ket_luan', ...sp.rows.map((r) => [r.label, r.unit, Math.round(Q.net[r.k]), Math.round(r.need), r.have, r.perMonth, r.ok ? 'Đủ' : 'Thiếu'].join(','))].join('\n'), 'text/csv;charset=utf-8'); });
  el.querySelector('#aiGen')?.addEventListener('click', aiScenarios);
  el.querySelector('#runAll')?.addEventListener('click', () => { c.scen.forEach((_, i) => runScenario(i)); log(`Đã chạy ${c.scen.length} kịch bản: ${Object.values(ui.scenRes).filter((r) => !r.ok).length} không đạt`, 'res'); panel(); });
  el.querySelectorAll('[data-sp]').forEach((inp) => (inp.onchange = () => { const [i, k] = inp.dataset.sp.split(':'); c.scen[+i][k] = +inp.value; delete ui.scenRes[i]; save(); }));
  el.querySelectorAll('[data-sr]').forEach((b) => (b.onclick = () => { const r = runScenario(+b.dataset.sr); log(`${c.scen[+b.dataset.sr].title}: ${r.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`, 'res'); panel(); }));
  el.querySelectorAll('[data-sv]').forEach((b) => (b.onclick = () => { const i = +b.dataset.sv, sc = c.scen[i]; ui.scen = ui.scen === sc ? null : sc; if (ui.scen && sc.type !== 'supply') { const A = D.analyze(d.struct, D.scenarioBuilding(c.b, sc)); if (A.ok) { ui.A = A; ui.res = D.check(A); } } setView('3d'); panel(); }));
  el.querySelector('#aiExp')?.addEventListener('click', aiExplain);
}
