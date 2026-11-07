// =====================================================================
// LÕI TÍNH TOÁN DIGITAL TWIN (thuần JS – dùng chung cho 3D, 2D, hồ sơ)
//  - Địa hình số (DEM) tham chiếu từ dataset đã chuẩn hóa
//  - AI sinh kịch bản quy hoạch (Generative Site Planning)
//  - Mô phỏng san nền đào/đắp, ngập úng, thi công, PCCC, tiến độ 4D
// Lưu ý: số liệu là MÔ PHỎNG phục vụ trình diễn; kỹ sư phải kiểm chứng.
// =====================================================================
import { rng } from './util.js';

export const SITE = {
  W: 400, // m theo trục X (Đông)
  H: 300, // m theo trục Y (Bắc)
  // Ranh giới khu đất (hệ tọa độ cục bộ, m)
  boundary: [
    [12, 18], [205, 8], [388, 14], [394, 128], [382, 286], [230, 293], [96, 289], [6, 262], [16, 140],
  ],
  // Gốc tọa độ VN-2000 giả định (múi 3°) để xuất DXF
  origin: { E: 574250.0, N: 1269480.0 },
  cell: 4, // m — độ phân giải lưới DEM
};

// ---------- Địa hình ----------
function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  const u = s(fx), v = s(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Cao độ tự nhiên tại (x,y) — m
export function heightAt(x, y) {
  let n = 0, amp = 1, f = 1 / 120, sum = 0;
  for (let o = 0; o < 4; o++) {
    n += vnoise(x * f, y * f, 7 + o) * amp;
    sum += amp;
    amp *= 0.5;
    f *= 2;
  }
  n /= sum;
  // Đồi phía Đông Bắc + thung lũng suối chạy chéo
  const hill = 6.5 * Math.exp(-(((x - 330) ** 2) / 9000 + ((y - 230) ** 2) / 7000));
  const sx = 60 + y * 0.55; // tim suối
  const valley = -4.2 * Math.exp(-((x - sx) ** 2) / 900) * (0.6 + 0.4 * (y / 300));
  const tilt = (x / 400) * 3.2 + (y / 300) * 1.4;
  return 14 + n * 6 + hill + valley + tilt;
}

export function pointInPoly(x, y, poly = SITE.boundary) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function polyArea(poly = SITE.boundary) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}
export function polyPerimeter(poly = SITE.boundary) {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    p += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return p;
}

let _grid = null;
export function demGrid() {
  if (_grid) return _grid;
  const c = SITE.cell;
  const nx = Math.round(SITE.W / c) + 1, ny = Math.round(SITE.H / c) + 1;
  const h = new Float32Array(nx * ny);
  const inside = new Uint8Array(nx * ny);
  let min = 1e9, max = -1e9, sum = 0, cnt = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = i * c, y = j * c, k = j * nx + i;
      h[k] = heightAt(x, y);
      inside[k] = pointInPoly(x, y) ? 1 : 0;
      if (inside[k]) {
        min = Math.min(min, h[k]);
        max = Math.max(max, h[k]);
        sum += h[k];
        cnt++;
      }
    }
  _grid = { nx, ny, c, h, inside, min, max, mean: sum / cnt, cnt };
  return _grid;
}

// Cây xanh / vật cản tạm thời phát hiện từ Point Cloud (sẽ được AI lọc bỏ)
export function obstacles() {
  const r = rng(42), out = [];
  for (let i = 0; i < 160; i++) {
    const x = r() * SITE.W, y = r() * SITE.H;
    if (!pointInPoly(x, y)) continue;
    out.push({ x, y, h: 4 + r() * 9, r: 1.5 + r() * 3, type: r() < 0.88 ? 'tree' : 'shed' });
  }
  return out;
}

// ---------- Đường đồng mức (marching squares, trả về các đoạn) ----------
export function contours(step = 1, src = null) {
  const g = demGrid();
  const H = src || g.h;
  const segs = [];
  const lo = Math.ceil(g.min), hi = Math.floor(g.max);
  for (let lv = lo; lv <= hi; lv += step) {
    for (let j = 0; j < g.ny - 1; j++)
      for (let i = 0; i < g.nx - 1; i++) {
        const k = j * g.nx + i;
        if (!g.inside[k] && !g.inside[k + 1] && !g.inside[k + g.nx]) continue;
        const v = [H[k], H[k + 1], H[k + g.nx + 1], H[k + g.nx]];
        const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e], b = v[(e + 1) % 4];
          if ((a < lv && b >= lv) || (a >= lv && b < lv)) {
            const t = (lv - a) / (b - a);
            const pa = p[e], pb = p[(e + 1) % 4];
            pts.push([(pa[0] + (pb[0] - pa[0]) * t) * g.c, (pa[1] + (pb[1] - pa[1]) * t) * g.c]);
          }
        }
        if (pts.length >= 2) segs.push({ lv, a: pts[0], b: pts[1] });
        if (pts.length === 4) segs.push({ lv, a: pts[2], b: pts[3] });
      }
  }
  return segs;
}

// ---------- AI sinh kịch bản quy hoạch ----------
export const SCENARIOS = {
  A: { name: 'PA1 – Lưới ô cờ tối ưu giao thông', vx: [140, 270], hy: [150], road: 13.5, green: ['1-0'], pub: ['0-1'], style: 'mixed' },
  B: { name: 'PA2 – Trục cảnh quan trung tâm', vx: [175, 225], hy: [100, 205], road: 15.5, green: ['1-0', '1-1', '1-2'], pub: ['2-1'], style: 'tower' },
  C: { name: 'PA3 – Cụm ở sinh thái quanh hồ điều hòa', vx: [125, 285], hy: [105, 200], road: 11.5, green: ['0-0', '1-1'], pub: ['2-2'], style: 'low' },
};

export function generatePlan(key, params) {
  const sc = SCENARIOS[key];
  const r = rng(key.charCodeAt(0) * 97);
  const minX = 24, maxX = 378, minY = 26, maxY = 278;
  const xs = [minX, ...sc.vx, maxX], ys = [minY, ...sc.hy, maxY];
  const rw = sc.road;
  const roads = [];
  sc.vx.forEach((x) => roads.push({ x1: x - rw / 2, y1: minY - 10, x2: x + rw / 2, y2: maxY + 10, w: rw, dir: 'v', cx: x }));
  sc.hy.forEach((y) => roads.push({ x1: minX - 10, y1: y - rw / 2, x2: maxX + 10, y2: y + rw / 2, w: rw, dir: 'h', cy: y }));
  // đường vành đai nội bộ
  const ring = 9;
  roads.push({ x1: minX - 4, y1: minY - 4, x2: maxX + 4, y2: minY - 4 + ring, w: ring, dir: 'h', cy: minY - 4 + ring / 2, ring: true });
  roads.push({ x1: minX - 4, y1: maxY + 4 - ring, x2: maxX + 4, y2: maxY + 4, w: ring, dir: 'h', cy: maxY + 4 - ring / 2, ring: true });

  const blocks = [], buildings = [];
  const sb = params.setback;
  for (let bi = 0; bi < xs.length - 1; bi++)
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x1 = xs[bi] + (bi > 0 ? rw / 2 : 0), x2 = xs[bi + 1] - (bi < xs.length - 2 ? rw / 2 : 0);
      const y1 = ys[bj] + (bj > 0 ? rw / 2 : ring - 4), y2 = ys[bj + 1] - (bj < ys.length - 2 ? rw / 2 : ring - 4);
      const id = `${bi}-${bj}`;
      const use = sc.green.includes(id) ? 'green' : sc.pub.includes(id) ? 'public' : 'res';
      const b = { id, x1, y1, x2, y2, use, area: (x2 - x1) * (y2 - y1), name: '' };
      blocks.push(b);
      if (use === 'green') continue;
      // bố trí công trình trong lô
      const ix1 = x1 + sb, ix2 = x2 - sb, iy1 = y1 + sb, iy2 = y2 - sb;
      let bw, bd, gap, floors;
      const fmin = params.floorsMin, fmax = params.floorsMax;
      if (use === 'public') {
        bw = 42; bd = 26; gap = 18; floors = Math.max(fmin, 4);
      } else if (sc.style === 'tower') {
        bw = 34; bd = 20; gap = 13; floors = fmax;
      } else if (sc.style === 'low') {
        bw = 22; bd = 15; gap = 6; floors = Math.min(fmax, Math.max(fmin, 5));
      } else {
        bw = 28; bd = 18; gap = 9;
        floors = Math.round(fmin + (fmax - fmin) * (0.35 + 0.5 * r()));
      }
      const target = (params.mdxd / 100) * b.area;
      let used = 0;
      for (let y = iy1; y + bd <= iy2 + 0.01; y += bd + gap)
        for (let x = ix1; x + bw <= ix2 + 0.01; x += bw + gap) {
          const cx = x + bw / 2, cy = y + bd / 2;
          if (!pointInPoly(x, y) || !pointInPoly(x + bw, y + bd) || !pointInPoly(x + bw, y) || !pointInPoly(x, y + bd)) continue;
          if (used + bw * bd > target) continue;
          used += bw * bd;
          let fl = floors;
          if (sc.style === 'mixed' && use === 'res') fl = Math.max(fmin, Math.min(fmax, floors + Math.round((r() - 0.5) * 4)));
          buildings.push({ id: 'CT' + String(buildings.length + 1).padStart(2, '0'), x, y, w: bw, d: bd, cx, cy, floors: fl, use, block: id, fh: use === 'public' ? 4.2 : 3.3 });
        }
    }
  // Hồ điều hòa cho PA3
  const lakes = key === 'C' ? [{ cx: 205, cy: 152, rx: 46, ry: 30 }] : [];
  return { key, name: sc.name, roads, blocks, buildings, lakes, params: { ...params } };
}

export function planMetrics(plan) {
  const site = polyArea();
  const bfoot = plan.buildings.reduce((a, b) => a + b.w * b.d, 0);
  const gfa = plan.buildings.reduce((a, b) => a + b.w * b.d * b.floors, 0);
  const green = plan.blocks.filter((b) => b.use === 'green').reduce((a, b) => a + b.area, 0);
  const pub = plan.blocks.filter((b) => b.use === 'public').reduce((a, b) => a + b.area, 0);
  const res = plan.blocks.filter((b) => b.use === 'res').reduce((a, b) => a + b.area, 0);
  const road = Math.max(0, site - green - pub - res);
  const units = Math.round(plan.buildings.filter((b) => b.use === 'res').reduce((a, b) => a + (b.w * b.d * b.floors * 0.78) / 70, 0));
  const pop = Math.round(units * 3.2);
  const floorsMax = Math.max(...plan.buildings.map((b) => b.floors), 0);
  return {
    site, bfoot, gfa, green, pub, res, road, units, pop, floorsMax,
    mdxd: (bfoot / site) * 100,
    far: gfa / site,
    nBuild: plan.buildings.length,
    roadLen: plan.roads.reduce((a, r) => a + (r.dir === 'v' ? r.y2 - r.y1 : r.x2 - r.x1), 0),
  };
}

// So sánh 3 phương án & chấm điểm (AI đề xuất – kỹ sư quyết định)
export function scorePlans(params, earth) {
  return Object.keys(SCENARIOS).map((k) => {
    const p = generatePlan(k, params);
    const m = planMetrics(p);
    const okMd = m.mdxd <= params.mdxd + 0.01;
    const okFar = m.far <= params.far + 0.001;
    const sGreen = Math.min(1, m.green / m.site / 0.15);
    const sFar = Math.min(1, m.far / params.far);
    const sRoad = Math.min(1, (m.road / m.site) / 0.2);
    const score = Math.round((sGreen * 0.3 + sFar * 0.4 + sRoad * 0.2 + (okMd && okFar ? 0.1 : 0)) * 100);
    return { key: k, plan: p, m, okMd, okFar, score };
  });
}

// ---------- San nền: khối lượng đào / đắp ----------
export function earthwork(pad, lakes = []) {
  const g = demGrid();
  const A = g.c * g.c;
  let cut = 0, fill = 0;
  for (let k = 0; k < g.h.length; k++) {
    if (!g.inside[k]) continue;
    const i = k % g.nx, j = Math.floor(k / g.nx);
    let target = pad;
    for (const l of lakes) if (((i * g.c - l.cx) / l.rx) ** 2 + ((j * g.c - l.cy) / l.ry) ** 2 < 1) target = pad - 3;
    const d = g.h[k] - target;
    if (d > 0) cut += d * A;
    else fill += -d * A;
  }
  return { cut, fill, net: cut - fill };
}
// Tìm cao độ san nền cân bằng đào–đắp (có hệ số tơi xốp/đầm nén k)
export function balancedPad(k = 1.0, lakes = []) {
  const g = demGrid();
  let lo = g.min, hi = g.max;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    const e = earthwork(mid, lakes);
    if (e.cut > e.fill * k) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function gradedSurface(pad, lakes = []) {
  const g = demGrid();
  const out = new Float32Array(g.h.length);
  for (let k = 0; k < g.h.length; k++) {
    if (!g.inside[k]) { out[k] = g.h[k]; continue; }
    const i = k % g.nx, j = Math.floor(k / g.nx);
    let t = pad;
    for (const l of lakes) if (((i * g.c - l.cx) / l.rx) ** 2 + ((j * g.c - l.cy) / l.ry) ** 2 < 1) t = pad - 3;
    out[k] = t;
  }
  return out;
}

// ---------- Ngập úng ----------
// rain: mm/h, dur: h, C: hệ số dòng chảy, drain: khả năng tiêu thoát mm/h
export function floodSim({ rain = 90, dur = 2, C = 0.45, drain = 30, surface = null }) {
  const g = demGrid();
  const H = surface || g.h;
  const A = g.c * g.c;
  const area = g.cnt * A;
  const excess = Math.max(0, rain - drain) / 1000; // m/h
  const vol = excess * dur * C * area; // m3 nước đọng
  // mực nước L sao cho thể tích chứa ở các ô trũng = vol
  const hs = [];
  for (let k = 0; k < H.length; k++) if (g.inside[k]) hs.push(H[k]);
  hs.sort((a, b) => a - b);
  let L = hs[0];
  if (vol > 0) {
    let lo = hs[0], hi = hs[0] + 6;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      let v = 0;
      for (const h of hs) { if (h >= mid) break; v += (mid - h) * A; }
      if (v > vol) hi = mid; else lo = mid;
    }
    L = (lo + hi) / 2;
  }
  let wet = 0, maxD = 0;
  for (const h of hs) { if (h >= L) break; const d = L - h; if (d > 0.1) { wet += A; maxD = Math.max(maxD, d); } }
  return { level: L, vol, wetArea: wet, maxDepth: maxD, risk: wet > 6000 ? 'Cao' : wet > 1500 ? 'Trung bình' : 'Thấp' };
}

// ---------- Nắng: vị trí mặt trời (vĩ độ ~11,5°B) ----------
export function sunPos(hour, month = 6, lat = 11.5) {
  const doy = (month - 1) * 30.4 + 15;
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81));
  const ha = (hour - 12) * 15;
  const r = Math.PI / 180;
  const alt = Math.asin(Math.sin(lat * r) * Math.sin(decl * r) + Math.cos(lat * r) * Math.cos(decl * r) * Math.cos(ha * r));
  let az = Math.atan2(-Math.sin(ha * r), Math.tan(decl * r) * Math.cos(lat * r) - Math.sin(lat * r) * Math.cos(ha * r));
  return { alt: alt / r, az: az / r }; // az: 0 = Bắc, dương về phía Đông
}

// ---------- Thi công & PCCC ----------
export function constructionSim(plan, { craneR = 55, fireDist = 10 } = {}) {
  const tall = plan.buildings.filter((b) => b.floors >= 6);
  const cranes = [];
  const left = [...tall];
  while (left.length) {
    const b = left.shift();
    const c = { x: b.cx + b.w / 2 + 4, y: b.cy, r: craneR };
    cranes.push(c);
    for (let i = left.length - 1; i >= 0; i--) {
      const o = left[i];
      const far = Math.max(...[[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.d], [o.x + o.w, o.y + o.d]].map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
      if (far <= craneR) left.splice(i, 1);
    }
  }
  // Khoảng cách từ công trình tới mép đường gần nhất (xe chữa cháy tiếp cận)
  const fire = plan.buildings.map((b) => {
    let best = 1e9;
    for (const r of plan.roads) {
      const dx = Math.max(r.x1 - (b.x + b.w), 0, b.x - r.x2);
      const dy = Math.max(r.y1 - (b.y + b.d), 0, b.y - r.y2);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return { id: b.id, dist: best, ok: best <= fireDist || b.floors <= 3 };
  });
  return { cranes, fire, fireOk: fire.filter((f) => f.ok).length };
}

// ---------- Tiến độ 4D theo các bản cập nhật hiện trạng ----------
export function progress4D(plan, updateIndex, totalUpdates = 8) {
  const r = rng(plan.key.charCodeAt(0) * 13 + 5);
  return plan.buildings.map((b, idx) => {
    const start = (idx / Math.max(1, plan.buildings.length)) * 0.45; // khởi công so le
    const planned = Math.max(0, Math.min(1, (updateIndex / totalUpdates - start) / 0.55));
    const f = 0.68 + r() * 0.42;
    const actual = Math.max(0, Math.min(1, planned * f));
    const lag = planned - actual;
    return { id: b.id, planned, actual, status: planned === 0 ? 'chưa' : lag > 0.15 ? 'chậm nghiêm trọng' : lag > 0.05 ? 'chậm' : 'đúng' };
  });
}

// ---------- Mặt cắt địa hình theo tuyến y = const ----------
export function section(y, pad = null, step = 4) {
  const pts = [];
  for (let x = 0; x <= SITE.W; x += step) {
    const ins = pointInPoly(x, y);
    pts.push({ x, h: heightAt(x, y), d: pad != null && ins ? pad : null, ins });
  }
  return pts;
}

// ---------- Ước tính chi phí sơ bộ (đơn giá MINH HỌA – phải thay bằng đơn giá địa phương) ----------
export const UNIT_PRICES = {
  dao: 85000, // đ/m3 đào
  dap: 120000, // đ/m3 đắp (gồm đầm chặt)
  duong: 1650000, // đ/m2 đường + vỉa hè
  thoatNuoc: 4200000, // đ/m dài cống
  cayXanh: 450000, // đ/m2
  nha: 7800000, // đ/m2 sàn (suất vốn minh họa)
  congCong: 9200000,
};
export function costEstimate(plan, ew) {
  const m = planMetrics(plan);
  const resGfa = plan.buildings.filter((b) => b.use === 'res').reduce((a, b) => a + b.w * b.d * b.floors, 0);
  const pubGfa = m.gfa - resGfa;
  const rows = [
    { item: 'San nền – đào đất', qty: ew.cut, unit: 'm³', price: UNIT_PRICES.dao },
    { item: 'San nền – đắp đất, đầm chặt', qty: ew.fill, unit: 'm³', price: UNIT_PRICES.dap },
    { item: 'Đường giao thông nội bộ + vỉa hè', qty: m.road, unit: 'm²', price: UNIT_PRICES.duong },
    { item: 'Hệ thống thoát nước mưa', qty: m.roadLen * 2, unit: 'm', price: UNIT_PRICES.thoatNuoc },
    { item: 'Cây xanh, công viên', qty: m.green, unit: 'm²', price: UNIT_PRICES.cayXanh },
    { item: 'Công trình nhà ở (sàn XD)', qty: resGfa, unit: 'm² sàn', price: UNIT_PRICES.nha },
    { item: 'Công trình công cộng (sàn XD)', qty: pubGfa, unit: 'm² sàn', price: UNIT_PRICES.congCong },
  ].map((r) => ({ ...r, total: r.qty * r.price }));
  const xd = rows.reduce((a, r) => a + r.total, 0);
  const other = [
    { item: 'Chi phí quản lý dự án (tạm tính 2,0%)', total: xd * 0.02 },
    { item: 'Chi phí tư vấn đầu tư xây dựng (tạm tính 4,5%)', total: xd * 0.045 },
    { item: 'Chi phí khác (tạm tính 1,5%)', total: xd * 0.015 },
  ];
  const sub = xd + other.reduce((a, r) => a + r.total, 0);
  const contingency = sub * 0.1;
  return { rows, xd, other, sub, contingency, total: sub + contingency };
}
