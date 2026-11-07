// =====================================================================
// Thiết kế kết cấu nhà khung BTCT từ bản vẽ CAD:
//   bản vẽ (mm) → mô hình phần tử hữu hạn (m) → tải trọng → tổ hợp → kiểm tra → khối lượng → cung ứng → kịch bản
// Căn cứ (đơn giản hóa cho demo, CHƯA thẩm tra): TCVN 5574:2018 (BTCT), TCVN 2737 / QCVN 02:2022/BXD (tải gió),
// TCVN 9386:2012 (động đất). Mọi tham số vùng (W0, agR, sức chịu tải đất) là THAM SỐ DEMO — cần tra số liệu chính thức.
// =====================================================================
import { solveCases } from './fem.js';

export const CONCRETE = { B20: { Rb: 11.5, Rbt: 0.9, Eb: 27500 }, B25: { Rb: 14.5, Rbt: 1.05, Eb: 30000 }, B30: { Rb: 17.0, Rbt: 1.15, Eb: 32500 }, B35: { Rb: 19.5, Rbt: 1.3, Eb: 34500 } };
export const STEEL = { CB300: { Rs: 260 }, CB400: { Rs: 350 }, CB500: { Rs: 435 } };
export const LIVE = { residential: ['Nhà ở (căn hộ)', 1.5], office: ['Văn phòng', 2.0], commercial: ['Thương mại', 4.0], school: ['Trường học', 2.0], parking: ['Gara ô tô', 2.5] };
// tham số vùng theo tenant (DEMO — cần tra QCVN 02:2022/BXD, TCVN 9386:2012 Phụ lục H)
export const REGION = {
  hcm: { name: 'TP. Hồ Chí Minh', w0: 0.83, windZone: 'II-A', agR: 0.06, soil: 'D (đất yếu ven sông)', soilR: 120 },
  'dong-nai': { name: 'Đồng Nai (Biên Hòa)', w0: 0.55, windZone: 'I-A', agR: 0.06, soil: 'C', soilR: 200 },
};
// cấp gió bão (Beaufort) → vận tốc gió giật 3 s tham khảo (m/s)
export const STORM = { 10: 28.4, 11: 32.6, 12: 36.9, 13: 41.4, 14: 46.1, 15: 50.9, 16: 56.0, 17: 61.2 };

export const defaultBuilding = (tenant = 'dong-nai') => ({
  tenant, storeys: 12, h1: 4.2, h: 3.3, use: 'residential', grade: 'B25', steel: 'CB400', finish: 1.5, roofLive: 0.75,
  muCol: 0.02, muBeam: 0.01, muSlab: 0.004, cover: 40, extWall: true,
  w0: REGION[tenant].w0, agR: REGION[tenant].agR, soilR: REGION[tenant].soilR, gammaI: 1.0, q: 3.9, terrain: 'B',
  dT: 0, waterLevel: null, roofPond: 0, strengthFactor: 1,
});

const key = (x, y, z) => `${Math.round(x)}|${Math.round(y)}|${Math.round(z * 1000)}`;
const len = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const onSeg = (px, py, x1, y1, x2, y2, tol = 5) => { const L = len(x1, y1, x2, y2); if (L < 1) return false; const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L ** 2; if (t < -0.001 || t > 1.001) return false; return Math.abs((px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)) / L < tol; };
export const levels = (b) => Array.from({ length: b.storeys + 1 }, (_, k) => (k === 0 ? 0 : b.h1 + (k - 1) * b.h));

// ----------------------------------------------------------------- mô hình tính
export function buildModel(st, b) {
  const C = CONCRETE[b.grade], E = C.Eb * 1e6 * b.strengthFactor ** 0.5, G = E / 2.4;
  const Z = levels(b), nodes = [], idx = new Map(), elems = [], meta = [];
  const node = (x, y, z) => { const k = key(x, y, z); if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ x: x / 1000, y: y / 1000, z, fixed: z === 0, mx: x, my: y }); } return idx.get(k); };
  const rect = (bx, by) => { const A = bx * by, J = Math.min(bx, by) ** 3 * Math.max(bx, by) * (1 / 3 - 0.21 * (Math.min(bx, by) / Math.max(bx, by)) * (1 - Math.min(bx, by) ** 4 / (12 * Math.max(bx, by) ** 4))); return { A, J }; };
  // cột & vách (vách = thanh tương đương tiết diện L × t), độ cứng nứt 0,7EI (cột) theo khuyến nghị thực hành
  const verticals = [...st.cols.map((c) => ({ ...c, kind: 'col', dx: c.b / 1000, dy: c.h / 1000 })),
    ...st.walls.filter((w) => w.kind === 'rc').map((w) => { const L = len(w.x1, w.y1, w.x2, w.y2) / 1000, ax = Math.abs(w.x2 - w.x1) >= Math.abs(w.y2 - w.y1); return { id: w.id, x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2, kind: 'wall', dx: ax ? L : w.t / 1000, dy: ax ? w.t / 1000 : L }; })];
  for (const v of verticals) for (let k = 0; k < b.storeys; k++) {
    const { A, J } = rect(v.dx, v.dy);
    elems.push({ n1: node(v.x, v.y, Z[k]), n2: node(v.x, v.y, Z[k + 1]), E, G, A, Iy: (0.7 * v.dy * v.dx ** 3) / 12, Iz: (0.7 * v.dx * v.dy ** 3) / 12, J });
    meta.push({ type: v.kind, id: v.id, storey: k + 1, dx: v.dx, dy: v.dy, A });
  }
  // dầm: 1 phần tử/nhịp (mô-men, độ võng giữa nhịp tính giải tích từ nội lực đầu), độ cứng nứt 0,35EI
  for (let k = 1; k <= b.storeys; k++) for (const bm of st.beams) {
    const bb = bm.b / 1000, hh = bm.h / 1000, { A, J } = rect(bb, hh);
    elems.push({ n1: node(bm.x1, bm.y1, Z[k]), n2: node(bm.x2, bm.y2, Z[k]), E, G, A, Iy: (0.35 * bb * hh ** 3) / 12, Iz: (0.35 * hh * bb ** 3) / 12, J });
    meta.push({ type: 'beam', id: bm.id, storey: k, b: bb, h: hh, L: len(bm.x1, bm.y1, bm.x2, bm.y2) / 1000, A });
  }
  // sàn cứng trong mặt phẳng: nối vách với 2 cột gần nhất bằng thanh liên kết (chỉ truyền lực ngang)
  for (const w of verticals.filter((v) => v.kind === 'wall')) {
    const near = st.cols.map((c) => [c, Math.hypot(c.x - w.x, c.y - w.y)]).sort((a, c) => a[1] - c[1]).slice(0, 2);
    for (let k = 1; k <= b.storeys; k++) for (const [c] of near) { elems.push({ n1: node(w.x, w.y, Z[k]), n2: node(c.x, c.y, Z[k]), E, G, A: 1, Iy: 1e-7, Iz: 1e-7, J: 1e-7 }); meta.push({ type: 'link', id: 'DIA', storey: k }); }
  }
  // đánh số lại nút theo (cao độ, x, y) → ma trận băng hẹp
  const order = nodes.map((n, i) => i).sort((a, c) => nodes[a].z - nodes[c].z || nodes[a].mx - nodes[c].mx || nodes[a].my - nodes[c].my), inv = new Int32Array(nodes.length);
  order.forEach((o, i) => (inv[o] = i));
  const sorted = order.map((o) => nodes[o]);
  elems.forEach((e) => { e.n1 = inv[e.n1]; e.n2 = inv[e.n2]; });
  nodes.length = 0; nodes.push(...sorted);
  // nút đầu dầm không trùng cột → treo (không đỡ) sẽ suy biến: báo lỗi rõ ràng
  return { nodes, elems, meta, Z, E };
}

// tải sàn → dầm theo diện truyền tải (hình thang/tam giác quy đổi diện tích)
function slabToBeams(st, qArea) { // qArea (kN/m²) theo sàn → Map(beamId → kN/m), point: [{x,y,kN}]
  const line = new Map(), points = [];
  for (const s of st.slabs) {
    const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
    const lx = (Math.max(...xs) - Math.min(...xs)) / 1000, ly = (Math.max(...ys) - Math.min(...ys)) / 1000, q = qArea(s);
    const sh = Math.min(lx, ly);
    for (let i = 0; i < s.pts.length; i++) {
      const [x1, y1] = s.pts[i], [x2, y2] = s.pts[(i + 1) % s.pts.length], Le = len(x1, y1, x2, y2) / 1000;
      const shortEdge = Math.abs(Le - sh) < 1e-6 && Math.abs(lx - ly) > 1e-6 ? true : Le <= sh + 1e-6;
      const area = shortEdge ? (sh * sh) / 4 : (lx * ly) / 2 - (sh * sh) / 4;
      const beams = st.beams.filter((bm) => onSeg(bm.x1, bm.y1, x1, y1, x2, y2) && onSeg(bm.x2, bm.y2, x1, y1, x2, y2));
      const bl = beams.reduce((t, bm) => t + len(bm.x1, bm.y1, bm.x2, bm.y2) / 1000, 0);
      if (bl > 0.5) beams.forEach((bm) => line.set(bm.id, (line.get(bm.id) || 0) + (q * area) / bl));
      else points.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, kN: q * area });
    }
  }
  return { line, points };
}

// ----------------------------------------------------------------- tải trọng & trường hợp tải
export function loadCases(st, b, M) {
  const Z = M.Z, H = Z[Z.length - 1];
  const slabT = (s) => (s.t || 120) / 1000;
  const live = LIVE[b.use][1];
  const dead = slabToBeams(st, (s) => 25 * slabT(s) + b.finish);
  const liv = slabToBeams(st, () => live);
  const perim = perimeterBeams(st);
  const G = { name: 'G', q: new Map(), loads: [] }, Q = { name: 'Q', q: new Map(), loads: [] };
  const roofQ = { name: 'Qroof', q: new Map(), loads: [] };
  M.elems.forEach((e, k) => {
    const m = M.meta[k];
    if (m.type === 'beam') {
      const top = m.storey === b.storeys;
      let gd = 25 * m.b * m.h + (dead.line.get(m.id) || 0);
      if (b.extWall && perim.has(m.id) && !top) gd += 0.2 * Math.max(0, b.h - m.h) * 18; // tường bao 200 gạch
      const wl = st.walls.filter((w) => w.kind === 'brick' && onSeg((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, ...beamXY(st, m.id))).reduce((t, w) => t + (w.t / 1000) * Math.max(0, b.h - m.h) * 18, 0);
      if (!top) gd += wl;
      if (top && b.roofPond) gd += (dead.line.get(m.id) || 0) / (25 * 0.12 + b.finish) * b.roofPond * 9.81; // nước đọng mái (m) → kN/m²
      G.q.set(k, [0, 0, -gd * 1000]);
      const ql = (liv.line.get(m.id) || 0) * (top ? b.roofLive / live : 1);
      if (ql) (top ? roofQ : Q).q.set(k, [0, 0, -ql * 1000]);
    } else if (m.type !== 'link') G.q.set(k, [0, 0, -25 * m.A * 1000]);
  });
  // tải tập trung ở mép sàn không có dầm → nút gần nhất mỗi tầng
  const nearest = (x, y, z) => { let bi = -1, bd = Infinity; M.nodes.forEach((n, i) => { if (Math.abs(n.z - z) < 1e-6) { const d = Math.hypot(n.mx - x, n.my - y); if (d < bd) { bd = d; bi = i; } } }); return bi; };
  for (let k = 1; k < Z.length; k++) {
    dead.points.forEach((p) => G.loads.push({ node: nearest(p.x, p.y, Z[k]), f: [0, 0, -p.kN * 1000] }));
    liv.points.forEach((p) => (k === Z.length - 1 ? roofQ : Q).loads.push({ node: nearest(p.x, p.y, Z[k]), f: [0, 0, -p.kN * 1000 * (k === Z.length - 1 ? b.roofLive / live : 1)] }));
  }
  // khối lượng tầng cho động đất (G + 0,3Q) và kích thước mặt bằng
  const xs = M.nodes.map((n) => n.x), ys = M.nodes.map((n) => n.y), Bx = Math.max(...xs) - Math.min(...xs), By = Math.max(...ys) - Math.min(...ys);
  const floorNodes = Z.map((z) => M.nodes.map((n, i) => (Math.abs(n.z - z) < 1e-6 && st.cols.concat([]).length ? i : -1)).filter((i) => i >= 0 && isColumnNode(st, M.nodes[i])));
  const slabArea = st.slabs.reduce((t, s) => t + polyArea(s.pts) / 1e6, 0);
  const wFloor = slabArea * (25 * 0.13 + b.finish + 0.3 * live) + 0.35 * slabArea * 3; // + kết cấu dầm/cột/tường quy đổi ≈ 3 kN/m² × 35%
  // gió tĩnh: W = W0·k(z)·c (c = 0,8 + 0,6) — chưa xét thành phần động (H ≤ 40 m)
  const kz = (z) => 1.844 * (Math.max(z, 3) / 300) ** 0.18;
  const wind = (dir) => {
    const cs = { name: 'W' + dir, loads: [] };
    for (let k = 1; k < Z.length; k++) {
      const trib = ((Z[k] - Z[k - 1]) + (k < Z.length - 1 ? Z[k + 1] - Z[k] : 0)) / 2, width = dir === 'X' ? By : Bx;
      const F = b.w0 * 1000 * kz(Z[k]) * 1.4 * trib * width, ns = floorNodes[k];
      ns.forEach((i) => cs.loads.push({ node: i, f: dir === 'X' ? [F / ns.length, 0, 0, 0, 0, 0] : [0, F / ns.length, 0, 0, 0, 0] }));
    }
    return cs;
  };
  // động đất: phương pháp lực ngang tương đương (TCVN 9386:2012, đất loại C/D, phổ thiết kế)
  const soil = b.tenant === 'hcm' ? { S: 1.35, TB: 0.2, TC: 0.8, TD: 2 } : { S: 1.15, TB: 0.2, TC: 0.6, TD: 2 };
  const T1 = 0.075 * H ** 0.75, ag = b.agR * b.gammaI * 9.81;
  const Sd = T1 <= soil.TC ? (ag * soil.S * 2.5) / b.q : Math.max(0.2 * ag, ((ag * soil.S * 2.5) / b.q) * (soil.TC / T1));
  const m = wFloor * 1000 / 9.81, mTot = m * (Z.length - 1), lam = T1 <= 2 * soil.TC && b.storeys > 2 ? 0.85 : 1;
  const Fb = Sd * mTot * lam, sumZ = Z.slice(1).reduce((t, z) => t + z * m, 0);
  const quake = (dir) => {
    const cs = { name: 'E' + dir, loads: [] };
    for (let k = 1; k < Z.length; k++) { const F = (Fb * Z[k] * m) / sumZ, ns = floorNodes[k]; ns.forEach((i) => cs.loads.push({ node: i, f: dir === 'X' ? [F / ns.length, 0, 0, 0, 0, 0] : [0, F / ns.length, 0, 0, 0, 0] })); }
    return cs;
  };
  // nhiệt độ: dầm bị cản giãn nở → lực dọc cưỡng bức N0 = E·A·α·ΔT (giả định cản 30 % do cột mềm)
  const T = { name: 'T', dT: new Map() };
  if (b.dT) M.elems.forEach((e, k) => { if (M.meta[k].type === 'beam') T.dT.set(k, 0.3 * e.E * e.A * 1e-5 * b.dT); });
  const cases = [G, Q, roofQ, wind('X'), wind('Y'), quake('X'), quake('Y'), T];
  return { cases, info: { T1, Sd, Fb: Fb / 1000, wFloor, slabArea, Bx, By, H, mTot: mTot / 1000, kzTop: kz(H), soil } };
}
const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
const isColumnNode = (st, n) => st.cols.some((c) => Math.abs(c.x - n.mx) < 1 && Math.abs(c.y - n.my) < 1) || st.walls.some((w) => w.kind === 'rc' && Math.abs((w.x1 + w.x2) / 2 - n.mx) < 1 && Math.abs((w.y1 + w.y2) / 2 - n.my) < 1);
const beamXY = (st, id) => { const b = st.beams.find((q) => q.id === id); return [b.x1, b.y1, b.x2, b.y2]; };
function perimeterBeams(st) {
  const xs = st.cols.map((c) => c.x), ys = st.cols.map((c) => c.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return new Set(st.beams.filter((b) => (Math.abs(b.x1 - b.x2) < 1 && (Math.abs(b.x1 - x0) < 1 || Math.abs(b.x1 - x1) < 1)) || (Math.abs(b.y1 - b.y2) < 1 && (Math.abs(b.y1 - y0) < 1 || Math.abs(b.y1 - y1) < 1))).map((b) => b.id));
}

// ----------------------------------------------------------------- tổ hợp tải (TCVN 2737 — đơn giản hóa)
// hệ số theo thứ tự trường hợp: G, Q, Qroof, WX, WY, EX, EY, T
export const COMBOS = [
  { id: 'ULS1', name: '1,1G + 1,3Q', k: [1.1, 1.3, 1.3, 0, 0, 0, 0, 0], uls: true },
  { id: 'ULS2', name: '1,1G + 0,9(1,3Q + 1,2WX)', k: [1.1, 1.17, 1.17, 1.08, 0, 0, 0, 0], uls: true },
  { id: 'ULS3', name: '1,1G + 0,9(1,3Q − 1,2WX)', k: [1.1, 1.17, 1.17, -1.08, 0, 0, 0, 0], uls: true },
  { id: 'ULS4', name: '1,1G + 0,9(1,3Q + 1,2WY)', k: [1.1, 1.17, 1.17, 0, 1.08, 0, 0, 0], uls: true },
  { id: 'ULS5', name: '1,1G + 0,9(1,3Q − 1,2WY)', k: [1.1, 1.17, 1.17, 0, -1.08, 0, 0, 0], uls: true },
  { id: 'SEI1', name: 'G + 0,3Q ± EX + 0,3EY', k: [1, 0.3, 0.3, 0, 0, 1, 0.3, 0], uls: true, seismic: true },
  { id: 'SEI2', name: 'G + 0,3Q ± 0,3EX + EY', k: [1, 0.3, 0.3, 0, 0, 0.3, 1, 0], uls: true, seismic: true },
  { id: 'TMP', name: '1,1G + 0,9(1,3Q + 1,1T)', k: [1.1, 1.17, 1.17, 0, 0, 0, 0, 0.99], uls: true },
  { id: 'SLS', name: 'G + Q (độ võng)', k: [1, 1, 1, 0, 0, 0, 0, 0], sls: true },
];

// ----------------------------------------------------------------- phân tích + kiểm tra
export function analyze(st, b) {
  if (!st.cols.length || !st.beams.length) return { ok: false, error: 'Chưa có cột/dầm — vẽ trục, cột, dầm (hoặc dùng "Khung mẫu") trước khi phân tích' };
  const M = buildModel(st, b);
  const dangling = M.nodes.findIndex((n, i) => !n.fixed && !M.elems.some((e, k) => (e.n1 === i || e.n2 === i) && M.meta[k].type !== 'beam' && M.meta[k].type !== 'link') && M.elems.filter((e) => e.n1 === i || e.n2 === i).length < 2);
  if (dangling >= 0) { const n = M.nodes[dangling]; return { ok: false, error: `Đầu dầm tại (${Math.round(n.mx)}, ${Math.round(n.my)}) mm không gối lên cột/vách hay dầm khác` }; }
  const L = loadCases(st, b, M);
  const t0 = performance.now();
  const R = solveCases(M, L.cases);
  if (!R.ok) return { ok: false, error: R.error };
  return { ok: true, M, L, R, b, st, ms: performance.now() - t0 };
}
// kết quả theo tổ hợp; f = hệ số ngẫu nhiên (Monte Carlo) { loadG, loadQ, wind, quake, strength }
export function check(A, f = {}) {
  const { M, L, R, b } = A, nC = L.cases.length;
  const fac = (k) => k.map((v, i) => v * [f.loadG ?? 1, f.loadQ ?? 1, f.loadQ ?? 1, f.wind ?? 1, f.wind ?? 1, f.quake ?? 1, f.quake ?? 1, 1][i]);
  const C = CONCRETE[b.grade], S = STEEL[b.steel], sf = (f.strength ?? 1) * b.strengthFactor;
  const Rb = C.Rb * 1e6 * sf, Rbt = C.Rbt * 1e6 * sf, Rs = S.Rs * 1e6, a = b.cover / 1000 + 0.01;
  const comb = (k, e, j) => { let v = 0; for (let c = 0; c < nC; c++) if (k[c]) v += k[c] * R.cases[c].forces[e][j]; return v; };
  const disp = (k, n, d) => { let v = 0; for (let c = 0; c < nC; c++) if (k[c]) v += k[c] * R.cases[c].disp[n * 6 + d]; return v; };
  const uls = COMBOS.filter((c) => c.uls), sls = COMBOS.find((c) => c.sls);
  const items = new Map(); // id|storey → kết quả
  M.elems.forEach((e, k) => {
    const m = M.meta[k], id = `${m.id}@T${m.storey}`;
    let it = items.get(id);
    if (!it) { it = { id: m.id, storey: m.storey, type: m.type, u: 0, checks: {} }; items.set(id, it); }
    if (m.type === 'link') return;
    if (m.type === 'beam') {
      const h0 = m.h - a - 0.01, As = b.muBeam * m.b * h0, x = Math.min((Rs * As) / (Rb * m.b), 0.53 * h0), Mu = Rb * m.b * x * (h0 - x / 2);
      const Asw = 2 * 50.3e-6, s = 0.15, Qu = 0.75 * Rbt * m.b * h0 + 1.5 * 0.8 * Rs * (Asw / s) * h0; // Qb (c = 2h0) + Qsw đai φ8a150 2 nhánh
      const qd = (kk) => { let v = 0; for (let c = 0; c < nC; c++) if (kk[c]) { const q = L.cases[c].q?.get(k); if (q) v += -kk[c] * q[2]; } return v; }; // N/m hướng xuống
      // mô-men trong (dương = căng thớ dưới): Ma = f4, Mb = −f10, Mgiữa = Ma + Va·L/2 − qL²/8
      for (const cb of uls) {
        const kk = fac(cb.k), Ma = comb(kk, k, 4), Mb = -comb(kk, k, 10), Va = comb(kk, k, 2), q = qd(kk), Mm = Ma + Va * m.L / 2 - (q * m.L ** 2) / 8;
        const Mmax = Math.max(Math.abs(Ma), Math.abs(Mb), Math.abs(Mm)), V = Math.max(Math.abs(Va), Math.abs(comb(kk, k, 8)));
        upd(it, 'M', Mmax / Mu, cb.id, `M = ${(Mmax / 1e3).toFixed(1)} kN·m / Mu = ${(Mu / 1e3).toFixed(1)}`);
        upd(it, 'V', V / Qu, cb.id, `Q = ${(V / 1e3).toFixed(1)} kN / Qu = ${(Qu / 1e3).toFixed(1)}`);
      }
      // độ võng giữa nhịp (SLS): 5qL⁴/384EI + (Ma+Mb)L²/16EI so với dây cung; ×2,0 xét nứt + từ biến dài hạn (giả định)
      const kk = fac(sls.k), EI = e.E * e.Iy, Ma = comb(kk, k, 4), Mb = -comb(kk, k, 10), q = qd(kk);
      const d = Math.max(0, (5 * q * m.L ** 4) / (384 * EI) + ((Ma + Mb) * m.L ** 2) / (16 * EI)) * 2.0, lim = m.L / 250;
      upd(it, 'f', d / lim, 'SLS', `f = ${(d * 1000).toFixed(1)} mm / [L/250] = ${(lim * 1000).toFixed(1)} mm`);
    } else {
      const Ac = m.A, As = b.muCol * Ac, Nu = 0.9 * (Rb * Ac + Rs * As);
      const Muy = Rs * (As / 2) * (m.dx - 2 * a), Muz = Rs * (As / 2) * (m.dy - 2 * a);
      for (const cb of uls) {
        const kk = fac(cb.k);
        for (const [ni, mi, mj] of [[0, 4, 5], [6, 10, 11]]) {
          const N = ni === 0 ? comb(kk, k, 0) : -comb(kk, k, 6), My = Math.abs(comb(kk, k, mi)), Mz = Math.abs(comb(kk, k, mj));
          const u = Math.max(0, N) / Nu + My / Muy + Mz / Muz; // tương tác tuyến tính — bảo thủ, đơn giản hóa
          upd(it, 'NM', u, cb.id, `N = ${(N / 1e3).toFixed(0)} kN · My = ${(My / 1e3).toFixed(0)} · Mz = ${(Mz / 1e3).toFixed(0)} kN·m`);
        }
      }
    }
  });
  // chuyển vị ngang: gió tiêu chuẩn (h/500), động đất (dr·ν ≤ 0,005h; dr = q·de, ν = 0,5)
  const Z = M.Z, H = Z[Z.length - 1];
  const levelDisp = (caseIdx, dir) => Z.map((z) => { const ns = M.nodes.map((n, i) => [n, i]).filter(([n]) => Math.abs(n.z - z) < 1e-6); return ns.length ? Math.max(...ns.map(([, i]) => Math.abs(R.cases[caseIdx].disp[i * 6 + dir]))) : 0; });
  const drift = (ci, dir, scale) => { const d = levelDisp(ci, dir).map((v) => v * scale); let mx = 0, at = 1; for (let k = 1; k < d.length; k++) { const r = Math.abs(d[k] - d[k - 1]) / (Z[k] - Z[k - 1]); if (r > mx) { mx = r; at = k; } } return { top: d[d.length - 1], ratio: mx, at }; };
  const wX = drift(3, 0, f.wind ?? 1), wY = drift(4, 1, f.wind ?? 1), eX = drift(5, 0, b.q * 0.5 * (f.quake ?? 1)), eY = drift(6, 1, b.q * 0.5 * (f.quake ?? 1));
  // móng: phản lực chân cột (G + Q tiêu chuẩn) / diện tích móng
  const foots = A.st.foots;
  const base = [];
  M.elems.forEach((e, k) => { const m = M.meta[k]; if ((m.type === 'col' || m.type === 'wall') && m.storey === 1) { const kk = fac(sls.k), N = comb(kk, k, 0); const n = M.nodes[e.n1]; const ft = foots.find((q) => Math.abs(q.x - n.mx) < 1 && Math.abs(q.y - n.my) < 1); base.push({ id: m.id, N: N / 1e3, foot: ft, x: n.mx, y: n.my }); } });
  const soilR = b.soilR * (b.waterLevel != null && b.waterLevel > -2 ? 0.6 : 1); // ngập/mực nước ngầm dâng → giảm sức chịu tải ≈ 40 % (giả định)
  base.forEach((p) => { const B = p.foot ? p.foot.B / 1000 : null, Lf = p.foot ? p.foot.L / 1000 : null; p.req = (p.N * 1.1) / soilR; p.area = B ? B * Lf : null; p.u = p.area ? (p.N * 1.1 + (p.area * 20 * 1.5)) / p.area / soilR : 9; });
  const list = [...items.values()];
  const by = (t) => list.filter((q) => q.type === t);
  const crit = [
    { k: 'Cột: N–M (TCVN 5574, tương tác tuyến tính)', u: Math.max(0, ...by('col').map((q) => q.u)) },
    { k: 'Vách: N–M', u: Math.max(0, ...by('wall').map((q) => q.u)), na: !by('wall').length },
    { k: 'Dầm: uốn / cắt', u: Math.max(0, ...by('beam').map((q) => Math.max(q.checks.M?.u || 0, q.checks.V?.u || 0))) },
    { k: 'Dầm: độ võng ≤ L/250', u: Math.max(0, ...by('beam').map((q) => q.checks.f?.u || 0)) },
    { k: 'Chuyển vị lệch tầng do gió ≤ h/500', u: Math.max(wX.ratio, wY.ratio) * 500, v: `${(Math.max(wX.ratio, wY.ratio) * 1e3).toFixed(2)}‰ · đỉnh ${(Math.max(wX.top, wY.top) * 1000).toFixed(1)} mm` },
    { k: 'Chuyển vị đỉnh do gió ≤ H/500', u: (Math.max(wX.top, wY.top) / H) * 500 },
    { k: 'Lệch tầng động đất dr·ν ≤ 0,005h', u: Math.max(eX.ratio, eY.ratio) / 0.005 },
    { k: `Móng: áp lực đáy ≤ R đất (${soilR.toFixed(0)} kPa)`, u: Math.max(0, ...base.map((p) => p.u)), v: base.some((p) => !p.area) ? 'có cột chưa có móng' : '' },
  ].map((c) => ({ ...c, ok: c.na || c.u <= 1 }));
  return { items: list, crit, base, drift: { wX, wY, eX, eY }, info: L.info, soilR, maxU: Math.max(...crit.filter((c) => !c.na).map((c) => c.u)) };
}
function upd(it, k, u, combo, txt) { if (!it.checks[k] || u > it.checks[k].u) it.checks[k] = { u, combo, txt }; if (u > it.u) { it.u = u; it.gov = k; it.combo = combo; } }

// ----------------------------------------------------------------- khối lượng vật liệu
export const MIX = { B20: [320, 0.47, 0.87], B25: [350, 0.455, 0.86], B30: [390, 0.44, 0.85], B35: [430, 0.43, 0.84] }; // xi măng kg · cát m³ · đá m³ / 1 m³ (cấp phối tham khảo)
export const WASTE = { concrete: 0.015, steel: 0.02, cement: 0.01, sand: 0.02, stone: 0.015, formwork: 0 };
export function qto(st, b) {
  const Z = levels(b), Hs = Z.slice(1).map((z, k) => z - Z[k]), N = b.storeys, tS = (s) => (s.t || 120) / 1000;
  const r = { col: { v: 0, f: 0 }, wall: { v: 0, f: 0 }, beam: { v: 0, f: 0 }, slab: { v: 0, f: 0 }, foot: { v: 0, f: 0 } };
  const tAvg = st.slabs.length ? st.slabs.reduce((t, s) => t + tS(s), 0) / st.slabs.length : 0.12;
  for (const c of st.cols) for (const h of Hs) { r.col.v += (c.b / 1000) * (c.h / 1000) * h; r.col.f += 2 * (c.b + c.h) / 1000 * h; }
  for (const w of st.walls.filter((q) => q.kind === 'rc')) for (const h of Hs) { const L = len(w.x1, w.y1, w.x2, w.y2) / 1000; r.wall.v += L * (w.t / 1000) * h; r.wall.f += 2 * L * h; }
  for (const bm of st.beams) { const L = len(bm.x1, bm.y1, bm.x2, bm.y2) / 1000, d = Math.max(0, bm.h / 1000 - tAvg); r.beam.v += N * L * (bm.b / 1000) * d; r.beam.f += N * L * (2 * d + bm.b / 1000); }
  for (const s of st.slabs) { const A = polyArea(s.pts) / 1e6; r.slab.v += N * A * tS(s); r.slab.f += N * A; }
  for (const f of st.foots) { r.foot.v += (f.B / 1000) * (f.L / 1000) * (f.H / 1000); r.foot.f += 2 * ((f.B + f.L) / 1000) * (f.H / 1000); }
  const steelRate = { col: b.muCol * 7850 * 1.3, wall: 0.006 * 7850 * 2 * 1.2, beam: 2 * b.muBeam * 7850 * 1.25, slab: 2 * b.muSlab * 7850, foot: 0.003 * 2 * 7850 * 1.2 };
  const conc = Object.values(r).reduce((t, x) => t + x.v, 0), steel = Object.entries(r).reduce((t, [k, x]) => t + (x.v * steelRate[k]) / 1000, 0);
  const mx = MIX[b.grade];
  const net = { concrete: conc, steel, cement: (conc * mx[0]) / 1000, sand: conc * mx[1], stone: conc * mx[2], formwork: Object.values(r).reduce((t, x) => t + x.f, 0) };
  const gross = Object.fromEntries(Object.entries(net).map(([k, v]) => [k, v * (1 + WASTE[k])]));
  const perStorey = { concrete: (conc - r.foot.v) / N, steel: (steel - (r.foot.v * steelRate.foot) / 1000) / N };
  return { parts: r, steelRate, net, gross, perStorey };
}
export const MAT_LABEL = { concrete: ['Bê tông thương phẩm', 'm³'], steel: ['Cốt thép', 't'], cement: ['Xi măng', 't'], sand: ['Cát vàng', 'm³'], stone: ['Đá 1×2', 'm³'], formwork: ['Ván khuôn', 'm²'] };

// cung ứng: tổng hợp đồng + năng lực giao/tháng → đủ khối lượng? kịp tiến độ (chu kỳ tầng)?
export function supplyCheck(Q, supply, { storeys, cycle = 10, delayDays = 0, cut = 0 } = {}) {
  const rows = Object.keys(MAT_LABEL).map((k) => {
    const s = supply[k] || { qty: 0, perMonth: 0 }, have = s.qty * (1 - cut), need = Q.gross[k];
    return { k, label: MAT_LABEL[k][0], unit: MAT_LABEL[k][1], need, have, gap: have - need, ok: have >= need, perMonth: s.perMonth * (1 - cut) };
  });
  // tiến độ phần thân: mỗi tầng 1 chu kỳ; thép & bê tông giao theo tháng (bắt đầu sau delayDays)
  const N = storeys;
  let lag = 0;
  for (const k of ['steel', 'concrete']) {
    const s = rows.find((r) => r.k === k), per = Q.perStorey[k] * (1 + WASTE[k]);
    if (!s.perMonth) { lag = Infinity; break; }
    for (let i = 1; i <= N; i++) { const due = i * cycle, avail = delayDays + ((i * per) / s.perMonth) * 30; lag = Math.max(lag, avail - due); }
  }
  return { rows, allOk: rows.every((r) => r.ok), delay: Math.max(0, Math.ceil(lag)), storeys: N, cycle };
}

// ----------------------------------------------------------------- Monte Carlo (bất định tải & vật liệu)
export function monteCarlo(A, n = 300, seed = 7, cov = { G: 0.08, Q: 0.25, W: 0.2, E: 0.35, R: 0.12 }) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.SQRT1_2; }; // xấp xỉ chuẩn tắc N(0,1)
  let fail = 0; const us = [];
  for (let i = 0; i < n; i++) {
    const f = { loadG: 1 + cov.G * gauss(), loadQ: Math.max(0, 1 + cov.Q * gauss()), wind: Math.max(0, 1 + cov.W * gauss()), quake: Math.max(0, 1 + cov.E * gauss()), strength: Math.max(0.5, 1 + cov.R * gauss()) };
    const r = check(A, f), u = Math.max(...r.crit.filter((c) => !c.na && !/Móng/.test(c.k)).map((c) => c.u));
    us.push(u); if (u > 1) fail++;
  }
  us.sort((a, b) => a - b);
  return { n, pf: fail / n, p50: us[Math.floor(n / 2)], p95: us[Math.floor(n * 0.95)], us };
}

// ----------------------------------------------------------------- kịch bản cực đoan
export const SCENARIO_TYPES = {
  storm: { label: '🌀 Bão mạnh', params: [['level', 'Cấp bão (Beaufort)', 12, 10, 17, 1]] },
  quake: { label: '🌋 Động đất', params: [['agR', 'Gia tốc nền agR (g)', 0.1, 0.02, 0.4, 0.01]] },
  flood: { label: '🌊 Mưa lũ – ngập móng', params: [['water', 'Mực nước so với mặt đất (m)', 0.5, -3, 3, 0.1], ['pond', 'Nước đọng trên mái (m)', 0.05, 0, 0.3, 0.01]] },
  heat: { label: '🔥 Nắng nóng cực đoan', params: [['dT', 'Chênh nhiệt độ kết cấu ΔT (°C)', 35, 10, 60, 1]] },
  material: { label: '🧱 Vật liệu kém chất lượng', params: [['strength', 'Cường độ đạt được (% thiết kế)', 80, 50, 100, 1]] },
  supply: { label: '🚚 Thiếu / trễ cung ứng', params: [['delay', 'Trễ giao hàng (ngày)', 21, 0, 120, 1], ['cut', 'Thiếu hụt khối lượng (%)', 10, 0, 60, 1]] },
};
export function scenarioBuilding(b, sc) {
  const x = { ...b };
  if (sc.type === 'storm') x.w0 = (0.613 * STORM[sc.level] ** 2) / 1000 / 1.2; // áp lực đỉnh gió giật → W0 tương đương
  if (sc.type === 'quake') x.agR = sc.agR;
  if (sc.type === 'flood') { x.waterLevel = sc.water; x.roofPond = sc.pond; }
  if (sc.type === 'heat') x.dT = sc.dT;
  if (sc.type === 'material') x.strengthFactor = sc.strength / 100;
  return x;
}
// bộ kịch bản offline theo vùng (khi không có Claude API)
export function offlineScenarios(tenant) {
  const hcm = tenant === 'hcm';
  return [
    { type: 'storm', level: hcm ? 12 : 11, title: `Bão cấp ${hcm ? 12 : 11} đổ bộ (tương tự bão Linda 1997 / Durian 2006)`, why: 'Nam Bộ ít bão nhưng đã có bão mạnh đi qua; kiểm tra chuyển vị đỉnh và cột biên.' },
    { type: 'storm', level: 14, title: 'Bão cấp 14 (cực đoan, chu kỳ lặp dài)', why: 'Kiểm tra dự trữ khi khí hậu cực đoan hơn.' },
    { type: 'flood', water: hcm ? 0.8 : 0.4, pond: 0.08, title: hcm ? 'Triều cường + mưa lớn ngập 0,8 m' : 'Mưa lớn, lũ sông Đồng Nai ngập 0,4 m', why: 'Nước ngập làm giảm sức chịu tải nền; nước đọng trên mái tăng tải.' },
    { type: 'quake', agR: 0.1, title: 'Động đất agR = 0,10g (vượt giá trị vùng)', why: 'Kiểm tra lệch tầng và cột tầng 1.' },
    { type: 'heat', dT: 40, title: 'Nắng nóng ΔT = 40 °C', why: 'Dầm dài bị cản giãn nở sinh lực dọc.' },
    { type: 'material', strength: 80, title: 'Bê tông chỉ đạt 80 % cường độ', why: 'Rủi ro chất lượng thi công / cung ứng.' },
    { type: 'supply', delay: 30, cut: 10, title: 'Thép trễ 30 ngày, thiếu 10 %', why: 'Biến động giá thép, nhà cung cấp chậm.' },
  ];
}

// ----------------------------------------------------------------- khung mẫu (từ khối nhà DA-2026-017)
export function frameTemplate({ xs = [0, 7200, 14400, 21600, 28800, 36000, 43200], ys = [0, 7500, 15000, 22500, 30000], col = 650, beam = [300, 650], slab = 150, foot = 3200 } = {}) {
  const st = { grid: { xs, ys, xNames: xs.map((_, i) => String(i + 1)), yNames: ys.map((_, i) => String.fromCharCode(65 + i)) }, cols: [], beams: [], slabs: [], walls: [], foots: [] };
  let n = 0; const id = (p) => `${p}${++n}`;
  const inner = (i, n) => i > 0 && i < n - 1;
  xs.forEach((x, i) => ys.forEach((y, j) => { const c = inner(i, xs.length) && inner(j, ys.length) ? col + 200 : col; st.cols.push({ id: id('C'), x, y, b: c, h: c }); const edge = (i === 0 || i === xs.length - 1) + (j === 0 || j === ys.length - 1), F = edge === 2 ? foot : edge === 1 ? foot + 1000 : foot + 2000; st.foots.push({ id: id('M'), x, y, B: F, L: F, H: 1100 }); }));
  ys.forEach((y) => xs.slice(1).forEach((x, i) => st.beams.push({ id: id('B'), x1: xs[i], y1: y, x2: x, y2: y, b: beam[0], h: beam[1] })));
  xs.forEach((x) => ys.slice(1).forEach((y, j) => st.beams.push({ id: id('B'), x1: x, y1: ys[j], x2: x, y2: y, b: beam[0], h: beam[1] })));
  xs.slice(1).forEach((x, i) => ys.slice(1).forEach((y, j) => st.slabs.push({ id: id('S'), pts: [[xs[i], ys[j]], [x, ys[j]], [x, y], [xs[i], y]], t: slab })));
  // lõi thang: 2 vách BTCT
  const cx = xs[Math.floor(xs.length / 2)], cy = ys[Math.floor(ys.length / 2)];
  st.walls.push({ id: id('V'), x1: cx - 2500, y1: cy - 1500, x2: cx + 2500, y2: cy - 1500, t: 300, kind: 'rc' }, { id: id('V'), x1: cx - 2500, y1: cy + 1500, x2: cx + 2500, y2: cy + 1500, t: 300, kind: 'rc' });
  st.foots.push({ id: id('M'), x: cx, y: cy - 1500, B: 6500, L: 3500, H: 1200 }, { id: id('M'), x: cx, y: cy + 1500, B: 6500, L: 3500, H: 1200 });
  return st;
}

// tự chọn kích thước móng đơn (vuông) theo phản lực G + Q và sức chịu tải đất (bước 100 mm)
export function sizeFootings(st, res) {
  let n = 0;
  for (const p of res.base) {
    const req = Math.sqrt((p.N * 1.1) / (res.soilR - 1.5 * 20)) * 1000, B = Math.max(1500, Math.ceil(req / 100) * 100);
    let f = p.foot || st.foots.find((q) => Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1);
    if (!f) { f = { id: 'M' + (st.foots.length + 1), x: p.x, y: p.y, B, L: B, H: 1000 }; st.foots.push(f); n++; }
    else if (Math.abs(f.B * f.L - B * B) > 1e4) { const r = f.L / f.B; f.B = Math.ceil(B / Math.sqrt(r) / 100) * 100; f.L = Math.ceil((B * Math.sqrt(r)) / 100) * 100; n++; }
    f.H = Math.max(f.H, Math.ceil((0.25 * Math.max(f.B, f.L)) / 100) * 100);
  }
  return n;
}
