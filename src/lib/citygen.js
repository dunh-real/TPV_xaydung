// =====================================================================
// MOD-00 · Cảnh đô thị từ dữ liệu GIS thật (OpenStreetMap + DEM Terrarium)
// Dữ liệu đóng gói bởi tools/fetch_gis.cjs → src/data/osm/<tenant>.json
// Chiều cao theo provenance: height → nguồn · building:levels → số tầng · thiếu → ước lượng (ghi nhãn)
// Ô quy hoạch và chỉ tiêu: MÔ PHỎNG (tham số demo, không phải đồ án được duyệt)
// Phương án biên tập: lớp chỉnh sửa chồng lên dữ liệu nền, không sửa dữ liệu gốc
// =====================================================================
import { TENANT_DETAIL, HEIGHT_SOURCES, PROJECTS } from '../data/nationwide.js';
import hcmData from '../data/osm/hcm.json';
import dnData from '../data/osm/dong-nai.json';

const RAW = { hcm: hcmData, 'dong-nai': dnData };
export const EXTENT = 3000; // nửa cạnh cảnh (m)
const cache = {};
const FLOOR_H = 3.3;

// ----------------------------------------------------------------- giải mã
const dec = (a) => { const o = []; let x = 0, z = 0; for (let i = 0; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; o.push([x / 10, z / 10]); } return o; };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };
function decodeGis(raw) {
  const wn = raw.water.n, bin = atob(raw.water.bits), water = new Uint8Array(wn * wn);
  for (let i = 0; i < water.length; i++) water[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  const ln = raw.landuse.n, land = new Uint8Array(ln * ln);
  for (let i = 0, p = 0; i < raw.landuse.rle.length; i += 2) { land.fill(raw.landuse.rle[i], p, p + raw.landuse.rle[i + 1]); p += raw.landuse.rle[i + 1]; }
  const dn = raw.dem.n, dem = Float32Array.from(raw.dem.dm, (v) => v / 10);
  // khoảng cách tới mặt nước (m) — chamfer 2 lượt trên lưới nước
  const dist = new Float32Array(wn * wn), cw = raw.water.cell, INF = 1e9, d2 = cw * Math.SQRT2;
  for (let i = 0; i < dist.length; i++) dist[i] = water[i] ? 0 : INF;
  for (let r = 0; r < wn; r++) for (let c = 0; c < wn; c++) { const i = r * wn + c; let v = dist[i]; if (c) v = Math.min(v, dist[i - 1] + cw); if (r) { v = Math.min(v, dist[i - wn] + cw); if (c) v = Math.min(v, dist[i - wn - 1] + d2); if (c < wn - 1) v = Math.min(v, dist[i - wn + 1] + d2); } dist[i] = v; }
  for (let r = wn - 1; r >= 0; r--) for (let c = wn - 1; c >= 0; c--) { const i = r * wn + c; let v = dist[i]; if (c < wn - 1) v = Math.min(v, dist[i + 1] + cw); if (r < wn - 1) { v = Math.min(v, dist[i + wn] + cw); if (c < wn - 1) v = Math.min(v, dist[i + wn + 1] + d2); if (c) v = Math.min(v, dist[i + wn - 1] + d2); } dist[i] = v; }
  return { origin: raw.origin, fetched: raw.fetched, sources: raw.sources, name: raw.name, water, wn, wcell: cw, land, ln, lcell: raw.landuse.cell, classes: raw.landuse.classes, dem, dn, dcell: raw.dem.cell, dist, roads: raw.roads.map(([cls, name, enc, lanes, bridge]) => ({ cls, name, pts: dec(enc), lanes, bridge })) };
}
const gridIdx = (n, cell, x, z) => { const c = Math.floor((x + EXTENT) / cell), r = Math.floor((z + EXTENT) / cell); return c < 0 || r < 0 || c >= n || r >= n ? -1 : r * n + c; };
export function inWater(det, x, z) { const g = det.gis; if (!g) return false; const i = gridIdx(g.wn, g.wcell, x, z); return i >= 0 && g.water[i] === 1; }
export function landuseAt(det, x, z) { const g = det.gis; const i = gridIdx(g.ln, g.lcell, x, z); return i < 0 ? 0 : g.land[i]; }
export function distWater(det, x, z) { const g = det.gis; const i = gridIdx(g.wn, g.wcell, x, z); return i < 0 ? null : g.dist[i]; }
function demAt(g, x, z) {
  const fx = Math.min(g.dn - 1.001, Math.max(0, (x + EXTENT) / g.dcell)), fz = Math.min(g.dn - 1.001, Math.max(0, (z + EXTENT) / g.dcell));
  const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r, D = g.dem, n = g.dn;
  return (D[r * n + c] * (1 - u) + D[r * n + c + 1] * u) * (1 - v) + (D[(r + 1) * n + c] * (1 - u) + D[(r + 1) * n + c + 1] * u) * v;
}
// mặt đất: DEM (đã lọc trung vị) · trong ô nước hạ xuống lòng sông · trên bờ luôn cao hơn mặt nước
export function groundAt(det, x, z) {
  const g = det.gis;
  if (!g) return 0;
  const h = demAt(g, x, z), wl = det.waterLevel;
  return inWater(det, x, z) ? Math.min(h, wl - 2.5) : Math.max(h, wl + 0.4);
}
export const waterLevel = (det) => det.waterLevel;

// ----------------------------------------------------------------- hình học
export function pointInPolygon(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
export function polygonArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}
function centroid(p) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; a += f; cx += (p[j][0] + p[i][0]) * f; cz += (p[j][1] + p[i][1]) * f; }
  if (Math.abs(a) < 1e-6) return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  return [cx / (3 * a), cz / (3 * a)];
}
function obb(p) { // hướng theo cạnh dài nhất → w (dọc), d (ngang), rot (rad)
  let best = 0, rot = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], L = Math.hypot(q[0] - p[i][0], q[1] - p[i][1]); if (L > best) { best = L; rot = Math.atan2(q[1] - p[i][1], q[0] - p[i][0]); } }
  const c = Math.cos(-rot), s = Math.sin(-rot);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of p) { const u = x * c - z * s, v = x * s + z * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); z0 = Math.min(z0, v); z1 = Math.max(z1, v); }
  return { w: x1 - x0, d: z1 - z0, rot };
}
export const shapeArea = (s) => (s.type === 'circle' ? Math.PI * s.r * s.r : polygonArea(s.pts));
export const inShape = (s, x, z) => (s.type === 'circle' ? Math.hypot(x - s.cx, z - s.cz) <= s.r : pointInPolygon(x, z, s.pts));
export const rectPts = (cx, cz, w, d, rot = 0) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [cx + u * Math.cos(rot) - v * Math.sin(rot), cz + u * Math.sin(rot) + v * Math.cos(rot)]);

// ----------------------------------------------------------------- chiều cao
const TYPE_VI = { house: 'Nhà ở riêng lẻ', detached: 'Nhà ở riêng lẻ', terrace: 'Nhà liên kế', semidetached_house: 'Nhà liên kế', residential: 'Nhà ở', apartments: 'Chung cư', dormitory: 'Ký túc xá', hotel: 'Khách sạn', commercial: 'Thương mại', retail: 'Thương mại – bán lẻ', office: 'Văn phòng', industrial: 'Công nghiệp', warehouse: 'Kho', school: 'Trường học', kindergarten: 'Trường mầm non', university: 'Đại học', college: 'Cao đẳng', hospital: 'Bệnh viện', church: 'Nhà thờ', temple: 'Đền/chùa', pagoda: 'Chùa', religious: 'Tôn giáo', public: 'Công trình công cộng', government: 'Cơ quan nhà nước', civic: 'Công trình công cộng', train_station: 'Nhà ga', construction: 'Đang xây dựng', yes: 'Chưa phân loại', kiosk: 'Ki-ốt', garage: 'Nhà xe', stadium: 'Sân vận động', market: 'Chợ' };
function priorHeight(type, area, tenant, u) {
  const hcm = tenant === 'hcm';
  const R = (a, b) => Math.round(a + (b - a) * u);
  if (['apartments', 'dormitory'].includes(type)) return { floors: R(hcm ? 10 : 6, hcm ? 25 : 15), note: 'Chung cư: 10–25 tầng (prior đô thị)' };
  if (['hotel', 'office', 'commercial', 'retail'].includes(type)) return area > 1500 ? { floors: R(6, hcm ? 18 : 10), note: 'Thương mại/văn phòng > 1.500 m²: 6–18 tầng' } : { floors: R(3, 6), note: 'Thương mại/văn phòng nhỏ: 3–6 tầng' };
  if (['industrial', 'warehouse', 'garage', 'kiosk'].includes(type)) return { floors: 1, h: 7 + 5 * u, note: 'Công nghiệp/kho: 1 tầng cao 7–12 m' };
  if (['school', 'kindergarten', 'university', 'college'].includes(type)) return { floors: R(2, 5), note: 'Trường học: 2–5 tầng' };
  if (['hospital'].includes(type)) return { floors: R(4, 9), note: 'Bệnh viện: 4–9 tầng' };
  if (['church', 'temple', 'pagoda', 'religious'].includes(type)) return { floors: null, h: 9 + 10 * u, note: 'Công trình tôn giáo: 9–19 m' };
  if (area < 120) return { floors: R(hcm ? 3 : 1, hcm ? 5 : 3), note: hcm ? 'Nhà phố < 120 m²: 3–5 tầng' : 'Nhà < 120 m²: 1–3 tầng' };
  if (area < 400) return { floors: R(hcm ? 3 : 1, hcm ? 6 : 3), note: hcm ? 'Nhà 120–400 m²: 3–6 tầng' : 'Nhà 120–400 m²: 1–3 tầng' };
  if (area < 2000) return { floors: R(hcm ? 4 : 2, hcm ? 8 : 4), note: 'Công trình 400–2.000 m²: ' + (hcm ? '4–8' : '2–4') + ' tầng' };
  return { floors: R(2, 4), note: 'Công trình > 2.000 m² (chợ/xưởng): 2–4 tầng' };
}
function materialOf(type, h, u) {
  if (h >= 45) return u < 0.6 ? 'glass' : 'concrete';
  if (h >= 18) return u < 0.3 ? 'glass' : 'concrete';
  if (['industrial', 'warehouse', 'garage'].includes(type)) return 'metal';
  if (['church', 'temple', 'pagoda', 'religious'].includes(type)) return 'brick';
  return u < 0.55 ? 'plaster' : u < 0.8 ? 'brick' : 'metal';
}
// gán chiều cao/provenance cho công trình nền (đọc từ trường _base)
function setHeight(b, tenant) {
  const B = b._base, u = hash(B.osm);
  if (B.type === 'construction') { Object.assign(b, { h: 6, floors: null, src: 'NONE', conf: 0.1, prior: 'Đang xây dựng — chưa có chiều cao, hiển thị khối mặc định 6 m' }); return; }
  if (B.height) { Object.assign(b, { h: B.height, floors: B.levels || Math.max(1, Math.round(B.height / FLOOR_H)), src: 'SRC', conf: 0.95, prior: 'Thẻ height trong OSM' }); return; }
  if (B.levels) { Object.assign(b, { h: +(B.levels * FLOOR_H).toFixed(1), floors: B.levels, src: 'FLOORS', conf: 0.85, prior: `${B.levels} tầng × ${FLOOR_H} m (thẻ building:levels)` }); return; }
  const p = priorHeight(B.type, b.area, tenant, u);
  Object.assign(b, { h: +(p.h ?? p.floors * FLOOR_H).toFixed(1), floors: null, estFloors: p.floors, src: 'PRIOR', conf: 0.35, prior: p.note + ' — ước lượng theo loại + diện tích mảnh' });
}

// ----------------------------------------------------------------- dựng cảnh
export function generateCity(tenantId) {
  if (cache[tenantId]) return cache[tenantId];
  const det = TENANT_DETAIL[tenantId], raw = RAW[tenantId];
  det.gis = decodeGis(raw);
  const code = tenantId === 'hcm' ? 'HCM' : 'DNA';
  const LL = ([lon, lat]) => { const [o0, o1] = det.gis.origin, kx = 111320 * Math.cos((o1 * Math.PI) / 180); return [(lon - o0) * kx, -(lat - o1) * 110540]; };

  // xã/phường thật (OSM admin_level 6)
  const wards = [];
  for (const w of raw.wards) {
    const rings = w.rings.map(dec);
    const poly = rings.reduce((a, r) => (polygonArea(r) > polygonArea(a) ? r : a), rings[0]);
    let sx = 0, sz = 0, n = 0;
    for (let x = -EXTENT + 50; x < EXTENT; x += 100) for (let z = -EXTENT + 50; z < EXTENT; z += 100) if (rings.some((r) => pointInPolygon(x, z, r))) { sx += x; sz += z; n++; }
    if (n < 3) continue;
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    wards.push({ idx: wards.length, id: w.ref || `OSM-r${w.osm}`, osm: w.osm, name: w.name, type: w.name.startsWith('Xã') ? 'xã' : 'phường', rings, poly, cx: sx / n, cz: sz / n, area: rings.reduce((s, r) => s + polygonArea(r), 0), inScene: n * 1e4, pop: w.pop, bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] });
  }
  wards.sort((a, b) => a.name.localeCompare(b.name, 'vi')).forEach((w, i) => (w.idx = i));
  const wardOf = (x, z) => {
    for (const w of wards) if (x >= w.bb[0] && x <= w.bb[2] && z >= w.bb[1] && z <= w.bb[3] && w.rings.some((r) => pointInPolygon(x, z, r))) return w.idx;
    let best = 0, bd = Infinity; for (const w of wards) { const d = Math.hypot(w.cx - x, w.cz - z); if (d < bd) { bd = d; best = w.idx; } } return best;
  };

  // công trình
  const buildings = [];
  for (const [osm, type, levels, height, name, year, enc] of raw.buildings) {
    const pts = dec(enc), area = polygonArea(pts), [x, z] = centroid(pts), o = obb(pts);
    const i = buildings.length;
    const b = { i, id: `${code}-B-${String(i + 1).padStart(6, '0')}`, x, z, w: +o.w.toFixed(1), d: +o.d.toFixed(1), rot: o.rot, area, pts, fp: 'osm', osm, type, typeName: TYPE_VI[type] || type, name, year };
    b._base = { pts, x, z, area, osm, type, levels, height };
    setHeight(b, tenantId);
    b.ground = +groundAt(det, x, z).toFixed(2);
    b.ward = wardOf(x, z);
    b.mat = materialOf(type, b.h, hash(osm + 'm'));
    b._base.snap = { h: b.h, floors: b.floors, estFloors: b.estFloors, src: b.src, conf: b.conf, prior: b.prior, mat: b.mat, ward: b.ward, ground: b.ground, w: b.w, d: b.d, rot: b.rot };
    buildings.push(b);
  }
  const baseCount = buildings.length;

  // cơ sở dịch vụ thật (OSM amenity) + hàng đợi xác minh
  const TN = { school: 'Trường học', health: 'Y tế', service: 'Hành chính – công cộng' };
  const facilities = raw.pois.map(([osm, type, amenity, name, x, z, cap, street], i) => ({
    id: `${code}-F-${String(i + 1).padStart(3, '0')}`, osm, type, typeName: TN[type], amenity, name: name || `(chưa có tên) ${TN[type].toLowerCase()}`, x, z, ward: wardOf(x, z),
    issue: !name ? 'Định danh và địa bàn' : osm[0] === 'n' && !street ? 'Vị trí chưa đủ chứng cứ' : type === 'health' && amenity === 'hospital' && !cap ? 'Thiếu quy mô có kỳ' : null,
    hasCoord: true, capacity: cap,
  }));

  // vị trí cầu BR-01 (vượt sông, minh họa) · khu đất DA-2026-017 (đất trống thật)
  let bridge = null, site = null;
  if (tenantId === 'hcm') bridge = findCrossing(det, LL([106.7096, 10.767]));
  if (tenantId === 'dong-nai') site = findSite(det, buildings, LL([106.838, 10.958]), 420, 320);

  const POIS = tenantId === 'hcm'
    ? [['Khu trung tâm – Chợ Bến Thành', 106.6981, 10.7725, 1500], ['Bán đảo Thủ Thiêm', 106.7225, 10.7765, 1700], ['Ven sông Sài Gòn – Bạch Đằng', 106.7068, 10.7748, 1100], ['Khu Phú Nhuận – Gia Định', 106.682, 10.7985, 1600], ['Khánh Hội – Tân Thuận', 106.705, 10.758, 1500]]
    : [['Trung tâm Biên Hòa', 106.8243, 10.9469, 1500], ['Sông Đồng Nai – Cù lao Phố', 106.8355, 10.9535, 1500], ['Tam Hiệp – Tân Triều', 106.858, 10.945, 1700]];
  const pois = POIS.map(([name, lon, lat, dist]) => { const [x, z] = LL([lon, lat]); return { name, x, z, dist }; });
  if (bridge) pois.splice(1, 0, { name: 'Cầu BR-01 (mô hình kiểm thử, vị trí minh họa)', x: bridge.x, z: bridge.z, dist: 750 });
  if (site) pois.unshift({ name: 'Khu đất DA-2026-017', x: site.x, z: site.z, dist: 900 });

  const projects = PROJECTS.filter((p) => p.tenant === tenantId).map((p) => {
    if (p.bridge && bridge) return { ...p, x: bridge.x, z: bridge.z, ward: wards[wardOf(bridge.x, bridge.z)]?.name || p.ward };
    if (p.live && site) return { ...p, x: site.x, z: site.z, ward: wards[wardOf(site.x, site.z)]?.name || p.ward };
    const wd = wards.find((w) => w.name === p.ward);
    if (wd) { const s = freeSpot(det, buildings, wd.cx, wd.cz); return { ...p, x: s[0], z: s[1] }; }
    return { ...p, x: Math.max(-EXTENT + 200, Math.min(EXTENT - 200, p.x)), z: Math.max(-EXTENT + 200, Math.min(EXTENT - 200, p.z)) };
  });

  const city = { tenantId, det, wards, buildings, baseCount, facilities, site, bridge, pois, projects, wardOf, code, gis: det.gis, variant: null };
  city.zones = buildZones(city);
  buildings.forEach((b) => (b.zone = zoneAt(city, b.x, b.z)));
  buildings.forEach((b) => (b._base.snap.zone = b.zone));
  city.baseBridge = bridge ? { ...bridge } : null;
  city.baseSite = site ? { ...site } : null;
  cache[tenantId] = city;
  return city;
}

// tuyến vượt sông ngắn nhất qua điểm gần mục tiêu
function findCrossing(det, [tx, tz]) {
  let p = null, bd = Infinity;
  const wide = (x, z) => inWater(det, x, z) && inWater(det, x + 60, z) && inWater(det, x - 60, z) && inWater(det, x, z + 60) && inWater(det, x, z - 60);
  for (let x = tx - 800; x <= tx + 800; x += 10) for (let z = tz - 800; z <= tz + 800; z += 10) if (wide(x, z)) { const d = Math.hypot(x - tx, z - tz); if (d < bd) { bd = d; p = [x, z]; } }
  if (!p) return { x: tx, z: tz, length: 300, width: 18, angle: 0, span: 220 };
  let best = null;
  for (let a = 0; a < 180; a += 3) {
    const r = (a * Math.PI) / 180, dx = Math.cos(r), dz = Math.sin(r);
    // đi tới khi gặp dải đất liên tục ≥ 30 m (bỏ qua lỗ nhỏ của lưới nước)
    const walk = (sx) => { let l = 0, land = 0, last = 0; while (l < 1500) { if (inWater(det, p[0] + sx * dx * l, p[1] + sx * dz * l)) { land = 0; last = l; } else if ((land += 5) >= 30) break; l += 5; } return l >= 1500 ? 1500 : last + 5; };
    const l1 = walk(1), l2 = walk(-1);
    if (l1 >= 1500 || l2 >= 1500) continue;
    const L = l1 + l2;
    if (!best || L < best.L) best = { L, r, cx: p[0] + (dx * (l1 - l2)) / 2, cz: p[1] + (dz * (l1 - l2)) / 2 };
  }
  const span = Math.round(best.L / 10) * 10;
  return { x: best.cx, z: best.cz, angle: best.r, span, length: span + 120, width: 18, spans: 3, clearance: 12, lanes: 4 };
}
// khu đất trống thật: không có công trình, không có nước, gần mục tiêu
function findSite(det, buildings, [tx, tz], w, d) {
  const C = 20, N = (EXTENT * 2) / C, occ = new Uint8Array(N * N);
  const mark = (x0, z0, x1, z1) => { for (let r = Math.max(0, Math.floor((z0 + EXTENT) / C)); r <= Math.min(N - 1, Math.floor((z1 + EXTENT) / C)); r++) for (let c = Math.max(0, Math.floor((x0 + EXTENT) / C)); c <= Math.min(N - 1, Math.floor((x1 + EXTENT) / C)); c++) occ[r * N + c] = 1; };
  for (const b of buildings) { const xs = b.pts.map((p) => p[0]), zs = b.pts.map((p) => p[1]); mark(Math.min(...xs) - 8, Math.min(...zs) - 8, Math.max(...xs) + 8, Math.max(...zs) + 8); }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const x = -EXTENT + (c + 0.5) * C, z = -EXTENT + (r + 0.5) * C; if (inWater(det, x, z) || distWater(det, x, z) < 40 || [4, 9, 10].includes(landuseAt(det, x, z))) occ[r * N + c] = 1; }
  const I = new Uint32Array((N + 1) * (N + 1));
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) I[(r + 1) * (N + 1) + c + 1] = occ[r * N + c] + I[r * (N + 1) + c + 1] + I[(r + 1) * (N + 1) + c] - I[r * (N + 1) + c];
  const sum = (r0, c0, r1, c1) => I[r1 * (N + 1) + c1] - I[r0 * (N + 1) + c1] - I[r1 * (N + 1) + c0] + I[r0 * (N + 1) + c0];
  const cw = Math.ceil(w / C), cd = Math.ceil(d / C);
  let best = null;
  for (let r = 10; r + cd < N - 10; r++) for (let c = 10; c + cw < N - 10; c++) {
    if (sum(r, c, r + cd, c + cw)) continue;
    const x = -EXTENT + (c + cw / 2) * C, z = -EXTENT + (r + cd / 2) * C, dd = Math.hypot(x - tx, z - tz);
    if (!best || dd < best.dd) best = { dd, x, z };
  }
  if (!best) best = { x: tx, z: tz };
  return { x: best.x, z: best.z, w, d, blocks: 6, floors: 12, pad: null, bw: 46, bd: 30 };
}
function freeSpot(det, buildings, x0, z0) {
  for (let r = 0; r < 900; r += 30) for (let a = 0; a < 360; a += 30) {
    const x = x0 + r * Math.cos((a * Math.PI) / 180), z = z0 + r * Math.sin((a * Math.PI) / 180);
    if (Math.abs(x) > EXTENT - 150 || Math.abs(z) > EXTENT - 150 || inWater(det, x, z)) continue;
    if (!buildings.some((b) => Math.abs(b.x - x) < 40 && Math.abs(b.z - z) < 40)) return [x, z];
  }
  return [x0, z0];
}

// ----------------------------------------------------------------- Ô QUY HOẠCH (mô phỏng)
export const ZONE_CLASSES = {
  ODT: { name: 'Đất ở đô thị', color: '#f6c85f' },
  HH: { name: 'Đất hỗn hợp', color: '#e8955a' },
  TM: { name: 'Thương mại – dịch vụ', color: '#e05a4f' },
  CC: { name: 'Công trình công cộng (giáo dục, y tế, hành chính)', color: '#f08cb0' },
  CX: { name: 'Cây xanh – TDTT – mặt thoáng', color: '#5cb85c' },
  CN: { name: 'Công nghiệp – kho tàng', color: '#a98bd3' },
  DT: { name: 'Đất phát triển mới / dự án', color: '#f4a742' },
  NN: { name: 'Nông nghiệp – sinh thái', color: '#bfe08f' },
  MN: { name: 'Mặt nước', color: '#64aee6' },
  AN: { name: 'An ninh – quốc phòng', color: '#9aa5b1' },
};
// chỉ tiêu tối đa (THAM SỐ DEMO): MĐXD gộp % · tầng cao · hệ số SDĐ
const ZONE_LIMITS = {
  hcm: { ODT: [65, 25, 5], HH: [65, 45, 10], TM: [70, 40, 10], CC: [50, 12, 3.5], CX: [15, 5, 0.5], CN: [65, 6, 3], DT: [55, 30, 6], NN: [15, 4, 0.5], MN: [null, null, null], AN: [null, null, null] },
  'dong-nai': { ODT: [65, 9, 3.5], HH: [65, 25, 6], TM: [70, 15, 5], CC: [50, 8, 2.5], CX: [15, 5, 0.5], CN: [70, 5, 2.5], DT: [55, 20, 4], NN: [15, 4, 0.5], MN: [null, null, null], AN: [null, null, null] },
};
// Ô quy hoạch = LÔ PHỐ: mặt bằng cắt theo mạng đường OSM (lưới raster 20 m), lô quá lớn chia theo lưới 400 m, lô < 2 ha gộp vào lô kề
const ZN = 300, ZC = (EXTENT * 2) / ZN;
const ROAD_HW = { motorway: 16, trunk: 14, primary: 12, secondary: 9, tertiary: 7, motorway_link: 6, trunk_link: 6, primary_link: 6 };
function buildZones(city) {
  const { det, buildings, tenantId, code } = city, N = ZN, C = ZC;
  const lab = new Int32Array(N * N).fill(-3); // -1 đường, -3 chưa gán
  const cellXY = (i) => [-EXTENT + ((i % N) + 0.5) * C, -EXTENT + (Math.floor(i / N) + 0.5) * C];
  // đường chính → rào chắn
  for (const r of det.gis.roads) {
    const hw = ROAD_HW[r.cls]; if (!hw) continue;
    for (let k = 1; k < r.pts.length; k++) {
      const [x1, z1] = r.pts[k - 1], [x2, z2] = r.pts[k], L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 5));
      for (let t = 0; t <= n; t++) { const x = x1 + ((x2 - x1) * t) / n, z = z1 + ((z2 - z1) * t) / n, rr = Math.ceil(hw / C);
        const c0 = Math.floor((x + EXTENT) / C), r0 = Math.floor((z + EXTENT) / C);
        for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) { const R = r0 + dr, Cc = c0 + dc; if (R < 0 || Cc < 0 || R >= N || Cc >= N) continue; const [cx, cz] = cellXY(R * N + Cc); if (Math.hypot(cx - x, cz - z) <= hw) lab[R * N + Cc] = -1; } }
    }
  }
  const water = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { const [x, z] = cellXY(i); if (inWater(det, x, z)) { water[i] = 1; if (lab[i] === -1) lab[i] = -3; } }
  // gán nhãn thành phần liên thông (4 hướng), tách theo lưới 400 m (đất) / 800 m (nước)
  let nLab = 0; const q = new Int32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (lab[i] !== -3) continue;
    const w = water[i], g = w ? 40 : 20, key = (j) => Math.floor((j % N) / g) * 1000 + Math.floor(Math.floor(j / N) / g), k0 = key(i);
    let h = 0, t = 0; q[t++] = i; lab[i] = nLab;
    while (h < t) { const j = q[h++], r = Math.floor(j / N), c = j % N; for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) { if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue; const m = rr * N + cc; if (lab[m] === -3 && water[m] === w && key(m) === k0) { lab[m] = nLab; q[t++] = m; } } }
    nLab++;
  }
  // gộp lô nhỏ (< 2 ha = 50 ô) vào lô kề có biên chung dài nhất
  const size = new Int32Array(nLab); for (let i = 0; i < N * N; i++) if (lab[i] >= 0) size[lab[i]]++;
  const parent = Int32Array.from({ length: nLab }, (_, i) => i), find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  for (let pass = 0; pass < 2; pass++) {
    const border = new Map();
    for (let i = 0; i < N * N; i++) { const a = lab[i]; if (a < 0) continue; const ra = find(a); for (const j of [i + 1, i + N]) { if ((j === i + 1 && (i + 1) % N === 0) || j >= N * N) continue; const bb = lab[j]; if (bb < 0) continue; const rb = find(bb); if (ra === rb || water[i] !== water[j]) continue; const k1 = ra + ':' + rb, k2 = rb + ':' + ra; border.set(k1, (border.get(k1) || 0) + 1); border.set(k2, (border.get(k2) || 0) + 1); } }
    const best = new Map(); for (const [k, v] of border) { const [x, y] = k.split(':').map(Number); if (!best.has(x) || v > best.get(x)[1]) best.set(x, [y, v]); }
    const sz = new Map(); for (let l = 0; l < nLab; l++) { const r = find(l); sz.set(r, (sz.get(r) || 0) + size[l]); }
    for (const [r, n] of sz) if (n < 50 && best.has(r)) parent[r] = find(best.get(r)[0]);
  }
  const remap = new Map(); let nz = 0;
  for (let i = 0; i < N * N; i++) if (lab[i] >= 0) { const r = find(lab[i]); if (!remap.has(r)) remap.set(r, nz++); lab[i] = remap.get(r); }
  // ô đường → lô gần nhất (để mọi điểm đều tra được lô)
  const own = Int32Array.from(lab);
  for (let it = 0; it < 40; it++) { let any = false; for (let i = 0; i < N * N; i++) if (own[i] < 0) { const r = Math.floor(i / N), c = i % N; for (const m of [i - 1, i + 1, i - N, i + N]) { if (m < 0 || m >= N * N || (m === i - 1 && c === 0) || (m === i + 1 && c === N - 1)) continue; if (own[m] >= 0) { own[i] = own[m]; any = true; break; } } } if (!any) break; }
  city.zoneLab = lab; city.zoneOwn = own;
  // thống kê & phân loại từng lô
  const cells = Array.from({ length: nz }, () => []);
  for (let i = 0; i < N * N; i++) if (lab[i] >= 0) cells[lab[i]].push(i);
  const bz = Array.from({ length: nz }, () => []);
  for (const bd of buildings) { const i = gridIdx(N, C, bd.x, bd.z); if (i >= 0) bz[own[i]].push(bd); }
  const lim = ZONE_LIMITS[tenantId];
  return cells.map((cl, idx) => {
    const hist = {}; let wat = 0, sx = 0, sz2 = 0;
    for (const i of cl) { const [x, z] = cellXY(i); sx += x; sz2 += z; if (water[i]) wat++; else { const l = landuseAt(det, x, z); if (l) hist[l] = (hist[l] || 0) + 1; } }
    const n = cl.length, area = n * C * C, bs = bz[idx], cov = bs.reduce((t, b) => t + b.area, 0) / area, meanH = bs.length ? bs.reduce((t, b) => t + b.h, 0) / bs.length : 0;
    const top = Object.entries(hist).sort((a2, b2) => b2[1] - a2[1])[0], share = top ? top[1] / Math.max(1, n - wat) : 0;
    let k;
    if (wat / n > 0.55) k = 'MN';
    else if (top && share > 0.3 && !(['4', '9', '8'].includes(top[0]) && (share < 0.5 || cov > 0.15))) k = { 1: meanH > 22 ? 'HH' : 'ODT', 2: 'TM', 3: 'CN', 4: 'CX', 5: 'CC', 7: 'DT', 8: 'NN', 9: 'CX', 10: 'AN' }[top[0]] || 'ODT';
    else if (cov > 0.12) k = meanH > 22 ? 'HH' : 'ODT';
    else k = tenantId === 'hcm' || cov > 0.02 ? 'ODT' : 'NN';
    const L = lim[k], pts = cl.map(cellXY);
    return { idx, id: `${code}-QH-${String(idx + 1).padStart(3, '0')}`, cls: k, poly: hull(pts, C / 2), area, cells: n, cx: sx / n, cz: sz2 / n, limits: { md: L[0], floors: L[1], far: L[2] } };
  });
}
function hull(pts, pad) { // bao lồi (dùng cho phân tích/hiển thị gần đúng)
  const P = pts.flatMap(([x, z]) => [[x - pad, z - pad], [x + pad, z - pad], [x + pad, z + pad], [x - pad, z + pad]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function zoneAt(city, x, z) { const i = gridIdx(ZN, ZC, Math.max(-EXTENT, Math.min(EXTENT - 1, x)), Math.max(-EXTENT, Math.min(EXTENT - 1, z))); return city.zoneOwn[i]; }
export const ZONE_GRID = { n: ZN, cell: ZC };
const floorsOf = (b) => b.floors || b.estFloors || Math.max(1, Math.round(b.h / FLOOR_H));
// chỉ tiêu hiện trạng/phương án của 1 ô và kết quả kiểm tra
export function zoneStats(city, zi) {
  const zn = city.zones[zi], list = city.buildings.filter((b) => !b.deleted && b.zone === zi);
  const fp = list.reduce((s, b) => s + b.area, 0), gfa = list.reduce((s, b) => s + b.area * floorsOf(b), 0);
  const md = (fp / zn.area) * 100, far = gfa / zn.area, floors = list.reduce((m, b) => Math.max(m, floorsOf(b)), 0);
  const L = zn.limits, chk = (v, l) => (l == null ? 'na' : v > l + 1e-9 ? 'fail' : v > l * 0.9 ? 'warn' : 'ok');
  const checks = { md: chk(md, L.md), floors: chk(floors, L.floors), far: chk(far, L.far) };
  const fail = Object.values(checks).includes('fail');
  return { zone: zn, count: list.length, fp, gfa, md, far, floors, checks, fail, edited: list.filter((b) => b.src === 'PLAN').length };
}
export function zoneSummary(city) {
  const all = city.zones.map((z) => zoneStats(city, z.idx));
  return { all, fail: all.filter((s) => s.fail).length, byClass: Object.keys(ZONE_CLASSES).map((k) => ({ k, n: all.filter((s) => s.zone.cls === k).length, fail: all.filter((s) => s.zone.cls === k && s.fail).length })).filter((x) => x.n) };
}

// ----------------------------------------------------------------- PHƯƠNG ÁN BIÊN TẬP
// data = { edits: { [i]: { dx, dz, rot(°), scale, floors, h, deleted } }, added: [{ id, pts, floors, h, use }], bridge: {...}, site: {...} }
export const emptyVariant = () => ({ edits: {}, added: [], bridge: null, site: null });
export function applyEdit(city, i) {
  const b = city.buildings[i], B = b._base, e = city.variant?.edits?.[i];
  Object.assign(b, B.snap);
  b.deleted = false; b.edited = false;
  b.pts = B.pts; b.x = B.x; b.z = B.z; b.area = B.area;
  if (!e) return b;
  b.edited = true;
  if (e.deleted) { b.deleted = true; return b; }
  const r = ((e.rot || 0) * Math.PI) / 180, s = e.scale || 1, cr = Math.cos(r), sr = Math.sin(r);
  b.pts = B.pts.map(([x, z]) => { const u = (x - B.x) * s, v = (z - B.z) * s; return [B.x + (e.dx || 0) + u * cr - v * sr, B.z + (e.dz || 0) + u * sr + v * cr]; });
  b.x = B.x + (e.dx || 0); b.z = B.z + (e.dz || 0); b.area = B.area * s * s; b.rot = B.snap.rot + r; b.w = +(B.snap.w * s).toFixed(1); b.d = +(B.snap.d * s).toFixed(1);
  if (e.floors != null || e.h != null) {
    b.floors = e.floors ?? Math.max(1, Math.round(e.h / FLOOR_H));
    b.h = +(e.h ?? b.floors * FLOOR_H).toFixed(1);
    b.src = 'PLAN'; b.conf = 1; b.estFloors = undefined; b.prior = 'Giá trị phương án do người dùng nhập (biên tập mô hình)';
  }
  b.ground = +groundAt(city.det, b.x, b.z).toFixed(2);
  b.ward = city.wardOf(b.x, b.z);
  b.zone = zoneAt(city, b.x, b.z);
  return b;
}
function makeAdded(city, a, i) {
  const pts = a.pts, [x, z] = centroid(pts), o = obb(pts), floors = a.floors || 3;
  return { i, id: a.id, x, z, w: +o.w.toFixed(1), d: +o.d.toFixed(1), rot: o.rot, area: polygonArea(pts), pts, fp: 'plan', osm: null, type: a.use || 'residential', typeName: a.useName || 'Công trình phương án', name: a.name || null, year: null,
    h: +(a.h ?? floors * FLOOR_H).toFixed(1), floors, src: 'PLAN', conf: 1, prior: 'Khối mới trong phương án (biên tập mô hình)', mat: (a.h ?? floors * FLOOR_H) >= 30 ? 'glass' : 'concrete',
    ground: +groundAt(city.det, x, z).toFixed(2), ward: city.wardOf(x, z), zone: zoneAt(city, x, z), added: true, edited: true };
}
export function applyVariant(city, data) {
  city.variant = data || emptyVariant();
  city.buildings.length = city.baseCount;
  for (let i = 0; i < city.baseCount; i++) applyEdit(city, i);
  (city.variant.added || []).forEach((a) => city.buildings.push(makeAdded(city, a, city.buildings.length)));
  if (city.baseBridge) city.bridge = { ...city.baseBridge, ...(city.variant.bridge || {}) };
  if (city.baseSite) city.site = { ...city.baseSite, ...(city.variant.site || {}) };
}
export function syncAdded(city) { // dựng lại danh sách khối thêm mới
  city.buildings.length = city.baseCount;
  (city.variant.added || []).forEach((a) => city.buildings.push(makeAdded(city, a, city.buildings.length)));
}
// chỉ số mô hình dự án
export function bridgeModel(br, wl) {
  const deck = br.length * br.width * 0.28, piers = Math.max(0, br.spans - 1), pierH = br.clearance + 6;
  const pierVol = piers * 2 * Math.PI * 1.1 ** 2 * pierH + piers * 14 * 4 * 2.2; // 2 cột/trụ + xà mũ
  const conc = deck + pierVol + 2 * 180; // + 2 mố
  const steel = conc * 0.16 + br.length * br.width * 0.035;
  const spanL = br.length / br.spans;
  return { concrete: conc, steel, spanL, deckY: wl + br.clearance, piers, cost: (conc * 4.2 + steel * 32) / 1000, note: 'Khối lượng sơ bộ theo suất/quy tắc kinh nghiệm (L1) — không thay thiết kế kỹ thuật' };
}
export function siteModel(city, st) {
  const det = city.det, rect = rectPts(st.x, st.z, st.w, st.d);
  let sum = 0, n = 0;
  for (let u = -st.w / 2 + 10; u < st.w / 2; u += 20) for (let v = -st.d / 2 + 10; v < st.d / 2; v += 20) { sum += groundAt(det, st.x + u, st.z + v); n++; }
  const g0 = sum / n, pad = st.pad ?? +(g0 + 0.5).toFixed(2);
  const fp = st.blocks * st.bw * st.bd, gfa = fp * st.floors, area = st.w * st.d;
  const zi = zoneAt(city, st.x, st.z), zn = city.zones[zi], L = zn.limits;
  const md = (fp / area) * 100, far = gfa / area;
  const checks = { md: L.md == null ? 'na' : md > L.md ? 'fail' : 'ok', floors: L.floors == null ? 'na' : st.floors > L.floors ? 'fail' : 'ok', far: L.far == null ? 'na' : far > L.far ? 'fail' : 'ok' };
  return { rect, groundMean: g0, pad, earth: (pad - g0) * area, fp, gfa, md, far, zone: zn, checks, fail: Object.values(checks).includes('fail'), units: Math.round((gfa * 0.75) / 75) };
}

// ----------------------------------------------------------------- Phân tích không gian
export const HEIGHT_BINS = [['0–10 m', 0, 10], ['10–25 m', 10, 25], ['25–50 m', 25, 50], ['50–100 m', 50, 100], ['≥ 100 m', 100, Infinity]];
export function areaStats(city, shape) {
  const list = city.buildings.filter((b) => !b.deleted && inShape(shape, b.x, b.z));
  const area = shapeArea(shape);
  const withH = list.filter((b) => b.src !== 'NONE');
  const hs = withH.map((b) => b.h).sort((a, b) => a - b);
  const median = hs.length ? (hs.length % 2 ? hs[(hs.length - 1) / 2] : (hs[hs.length / 2 - 1] + hs[hs.length / 2]) / 2) : null;
  const methods = Object.fromEntries(Object.keys(HEIGHT_SOURCES).map((k) => [k, list.filter((b) => b.src === k).length]));
  const bins = HEIGHT_BINS.map(([label, a, b]) => ({ label, ids: withH.filter((q) => q.h >= a && q.h < b).map((q) => q.i) }));
  bins.push({ label: 'Thiếu/lỗi', ids: list.filter((b) => b.src === 'NONE').map((q) => q.i) });
  const gfa = withH.reduce((s, b) => s + b.area * floorsOf(b), 0);
  const projects = city.projects.filter((p) => inShape(shape, p.x, p.z));
  const cx = shape.type === 'circle' ? shape.cx : shape.pts.reduce((s, p) => s + p[0], 0) / shape.pts.length;
  const cz = shape.type === 'circle' ? shape.cz : shape.pts.reduce((s, p) => s + p[1], 0) / shape.pts.length;
  const wardsHit = [...new Set(list.map((b) => b.ward))].map((w) => city.wards[w].name);
  return {
    area, count: list.length, withHeight: withH.length, fromSource: list.filter((b) => b.src === 'SRC' || b.src === 'FLOORS').length, estimated: list.filter((b) => b.src === 'IMG' || b.src === 'PRIOR').length,
    median, density: list.length / (area / 1e6), methods, bins, gfa, projects, distRiver: distWater(city.det, cx, cz) ?? 0, wardsHit, list,
    method: 'Đếm ID mảnh OSM có tâm nằm trong vùng; chiều cao theo thứ tự ưu tiên provenance (height → building:levels × 3,3 m → ước lượng theo loại + diện tích); GFA = diện tích mảnh × số tầng. Nguồn: © OpenStreetMap contributors (ODbL).',
    dataVersion: null,
  };
}

// Kịch bản UR-01 (L1): mưa + triều trên DEM thật (SRTM/Terrarium đã lọc)
export function ur01(city, shape, { rain = 120, tide = 1.6, hours = 3, drain = 40, slr = 0, imperv = 0.6, pump = 0 }) {
  const list = (shape ? city.buildings.filter((b) => inShape(shape, b.x, b.z)) : city.buildings).filter((b) => !b.deleted);
  const net = Math.max(0, rain - drain - pump) / 1000 * hours * imperv; // m nước ròng (proxy)
  const level = city.det.waterLevel + tide + slr + net * 1.8 - 0.6;
  const affected = list.filter((b) => b.ground < level).map((b) => ({ ...b, depth: +(level - b.ground).toFixed(2) })).sort((a, b) => b.depth - a.depth);
  const series = Array.from({ length: 24 }, (_, i) => { const t = i / 23; return { t, value: +(level * Math.sin(Math.PI * Math.min(1, t * 1.3)) ** 1.4).toFixed(3) }; });
  return { level: +level.toFixed(2), affected, series, links: [['TU-01', 'Tầng hầm trong vùng ngập'], ['RD-02', 'Ta-luy/đường trong vùng'], ['BR-05', 'Trụ cầu qua sông']],
    trust: 'L1', note: 'Cân bằng thể tích proxy trên DEM SRTM/Terrarium 30 m (DSM đã lọc trung vị — vẫn có thể gồm mái/cây, không phải DTM). Không dùng suy độ sâu ngập thực; cần mô hình thủy lực 2D + số liệu quan trắc cho L2.' };
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const q = (v) => (v == null ? '' : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return '﻿' + [keys.join(','), ...rows.map((r) => keys.map((k) => q(r[k])).join(','))].join('\n');
}
