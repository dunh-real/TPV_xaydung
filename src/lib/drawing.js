// =====================================================================
// XUẤT BẢN VẼ 2D: Mặt bằng quy hoạch (SVG), Mặt cắt địa hình (SVG), DXF R12
// DXF dùng tọa độ VN-2000 giả định (gốc SITE.origin) — mở được bằng
// AutoCAD / DXF Toolkit / QGIS.
// =====================================================================
import { SITE, contours, planMetrics, section, demGrid } from './engine.js';
import { fmt, esc } from './util.js';

const USE_COLORS = { res: '#f6c66b', public: '#e57373', green: '#81c784', road: '#d7dbe0' };
const USE_NAMES = { res: 'Đất ở', public: 'Đất công trình công cộng', green: 'Đất cây xanh – TDTT', road: 'Đất giao thông' };

// ---------- DXF ----------
class DXF {
  constructor() { this.ents = []; this.layers = new Map(); }
  layer(name, color) { this.layers.set(name, color); return this; }
  line(l, x1, y1, x2, y2) { this.ents.push(['LINE', l, `10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0`]); }
  poly(l, pts, closed = true) {
    let s = `66\n1\n70\n${closed ? 1 : 0}\n10\n0\n20\n0\n30\n0`;
    let v = '';
    for (const [x, y] of pts) v += `0\nVERTEX\n8\n${l}\n10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n30\n0\n`;
    this.ents.push(['POLYLINE', l, s, v + '0\nSEQEND\n8\n' + l]);
  }
  text(l, x, y, h, t, rot = 0) { this.ents.push(['TEXT', l, `10\n${x}\n20\n${y}\n30\n0\n40\n${h}\n1\n${t}\n50\n${rot}`]); }
  toString() {
    let o = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';
    o += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + this.layers.size + '\n';
    for (const [n, c] of this.layers) o += `0\nLAYER\n2\n${n}\n70\n0\n62\n${c}\n6\nCONTINUOUS\n`;
    o += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    for (const e of this.ents) {
      o += `0\n${e[0]}\n8\n${e[1]}\n${e[2]}\n`;
      if (e[3]) o += e[3] + '\n';
    }
    return o + '0\nENDSEC\n0\nEOF\n';
  }
}
const E = (x) => +(SITE.origin.E + x).toFixed(3);
const N = (y) => +(SITE.origin.N + y).toFixed(3);
// Chuyển chữ tiếng Việt sang không dấu cho DXF R12 (tương thích font SHX)
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

export function planDXF(plan, pad, project) {
  const d = new DXF()
    .layer('QH_RANH_GIOI', 1).layer('QH_GIAO_THONG', 8).layer('QH_DAT_O', 2).layer('QH_CONG_CONG', 6)
    .layer('QH_CAY_XANH', 3).layer('CT_CONG_TRINH', 7).layer('DH_DONG_MUC', 33).layer('DH_DONG_MUC_CAI', 30)
    .layer('MAT_NUOC', 5).layer('TEXT', 7).layer('KHUNG_TEN', 7);
  d.poly('QH_RANH_GIOI', SITE.boundary.map(([x, y]) => [E(x), N(y)]));
  for (const s of contours(1)) d.line(s.lv % 5 === 0 ? 'DH_DONG_MUC_CAI' : 'DH_DONG_MUC', E(s.a[0]), N(s.a[1]), E(s.b[0]), N(s.b[1]));
  if (plan) {
    for (const r of plan.roads) d.poly('QH_GIAO_THONG', [[E(r.x1), N(r.y1)], [E(r.x2), N(r.y1)], [E(r.x2), N(r.y2)], [E(r.x1), N(r.y2)]]);
    for (const b of plan.blocks) {
      const l = b.use === 'green' ? 'QH_CAY_XANH' : b.use === 'public' ? 'QH_CONG_CONG' : 'QH_DAT_O';
      d.poly(l, [[E(b.x1), N(b.y1)], [E(b.x2), N(b.y1)], [E(b.x2), N(b.y2)], [E(b.x1), N(b.y2)]]);
      d.text('TEXT', E(b.x1 + 3), N(b.y2 - 7), 3, ascii(`O ${b.id} - ${USE_NAMES[b.use]} - ${fmt(b.area)} m2`));
    }
    for (const b of plan.buildings) {
      d.poly('CT_CONG_TRINH', [[E(b.x), N(b.y)], [E(b.x + b.w), N(b.y)], [E(b.x + b.w), N(b.y + b.d)], [E(b.x), N(b.y + b.d)]]);
      d.text('TEXT', E(b.cx - 5), N(b.cy - 1.2), 2.4, `${b.id}-${b.floors}T`);
    }
    for (const l of plan.lakes) {
      const pts = [];
      for (let a = 0; a < 48; a++) pts.push([E(l.cx + l.rx * Math.cos((a / 48) * 2 * Math.PI)), N(l.cy + l.ry * Math.sin((a / 48) * 2 * Math.PI))]);
      d.poly('MAT_NUOC', pts);
    }
  }
  // khung tên
  const kx = E(SITE.W + 20), ky = N(0);
  d.poly('KHUNG_TEN', [[kx, ky], [kx + 120, ky], [kx + 120, ky + 60], [kx, ky + 60]]);
  d.text('KHUNG_TEN', kx + 4, ky + 50, 4, ascii(project.name).slice(0, 48));
  d.text('KHUNG_TEN', kx + 4, ky + 40, 3.5, ascii('BAN VE QUY HOACH TONG MAT BANG'));
  d.text('KHUNG_TEN', kx + 4, ky + 30, 3, ascii(plan ? plan.name : 'Hien trang dia hinh'));
  d.text('KHUNG_TEN', kx + 4, ky + 20, 3, ascii(`He toa do VN-2000 (gia dinh) - Cao do san nen: ${pad ? pad.toFixed(2) : '-'} m`));
  d.text('KHUNG_TEN', kx + 4, ky + 10, 3, ascii('AIPM OS x AI Digital Twin - ban demo'));
  return d.toString();
}

export function sectionDXF(y, pad) {
  const pts = section(y, pad, 2);
  const d = new DXF().layer('MC_TU_NHIEN', 3).layer('MC_THIET_KE', 1).layer('TEXT', 7).layer('LUOI', 8);
  const V = 5; // phóng đứng 5 lần
  const base = Math.floor(Math.min(...pts.map((p) => p.h)) - 2);
  const yy = (h) => (h - base) * V;
  d.poly('MC_TU_NHIEN', pts.map((p) => [p.x, yy(p.h)]), false);
  const des = pts.filter((p) => p.d != null);
  if (des.length) d.poly('MC_THIET_KE', des.map((p) => [p.x, yy(p.d)]), false);
  for (let x = 0; x <= SITE.W; x += 20) {
    d.line('LUOI', x, -12, x, -2);
    d.text('TEXT', x - 3, -18, 2.5, x + 'm');
    const p = pts.find((q) => q.x === x);
    if (p) d.text('TEXT', x - 3, -26, 2.5, p.h.toFixed(2));
  }
  d.text('TEXT', 0, -36, 3.5, ascii(`MAT CAT DIA HINH Y = ${y}m - TY LE DUNG 1/${V} NGANG`));
  return d.toString();
}

// ---------- SVG mặt bằng ----------
export function planSVG(plan, { pad = null, showContours = true, showBuildings = true, progress = null, cranes = null, fire = null, flood = null } = {}) {
  const m = 14, W = SITE.W, H = SITE.H;
  const Y = (y) => H - y; // trục Bắc lên trên
  let s = `<svg class="plan-svg" viewBox="${-m - 22} ${-m} ${W + 2 * m + 172} ${H + 2 * m}" xmlns="http://www.w3.org/2000/svg" font-family="Arial">`;
  s += `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#444" stroke-width="0.8"/></pattern></defs>`;
  s += `<rect x="${-m - 22}" y="${-m}" width="${W + 2 * m + 172}" height="${H + 2 * m}" fill="#fff"/>`;
  // lưới VN-2000
  for (let x = 0; x <= W; x += 50) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#eef2f6" stroke-width="0.5"/><text x="${x}" y="${H + 9}" font-size="4.5" fill="#94a3b8" text-anchor="middle">${fmt(SITE.origin.E + x)}</text>`;
  for (let y = 0; y <= H; y += 50) s += `<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}" stroke="#eef2f6" stroke-width="0.5"/><text x="-2" y="${Y(y) + 1.5}" font-size="4.5" fill="#94a3b8" text-anchor="end">${fmt(SITE.origin.N + y)}</text>`;
  if (plan) {
    s += `<polygon points="${SITE.boundary.map(([x, y]) => `${x},${Y(y)}`).join(' ')}" fill="${USE_COLORS.road}"/>`;
    for (const b of plan.blocks) s += `<rect x="${b.x1}" y="${Y(b.y2)}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}" fill="${USE_COLORS[b.use]}" stroke="#fff" stroke-width="0.6"/><text x="${b.x1 + 3}" y="${Y(b.y2) + 7}" font-size="5" fill="#334155" font-weight="bold">${b.id}</text>`;
    for (const l of plan.lakes) s += `<ellipse cx="${l.cx}" cy="${Y(l.cy)}" rx="${l.rx}" ry="${l.ry}" fill="#7dd3fc" stroke="#0284c7" stroke-width="0.6"/>`;
    for (const r of plan.roads) {
      if (r.dir === 'v') s += `<line x1="${r.cx}" y1="${Y(r.y1)}" x2="${r.cx}" y2="${Y(r.y2)}" stroke="#94a3b8" stroke-width="0.4" stroke-dasharray="6 2 1 2"/>`;
      else s += `<line x1="${r.x1}" y1="${Y(r.cy)}" x2="${r.x2}" y2="${Y(r.cy)}" stroke="#94a3b8" stroke-width="0.4" stroke-dasharray="6 2 1 2"/>`;
    }
  }
  if (flood) {
    const g = demGrid();
    for (let k = 0; k < g.h.length; k++) if (g.inside[k] && flood.level - (flood.surface ? flood.surface[k] : g.h[k]) > 0.1) {
      const i = k % g.nx, j = Math.floor(k / g.nx);
      s += `<rect x="${i * g.c - 2}" y="${Y(j * g.c) - 2}" width="4" height="4" fill="#2563eb" opacity="0.45"/>`;
    }
  }
  if (showContours) for (const c of contours(1)) s += `<line x1="${c.a[0].toFixed(1)}" y1="${Y(c.a[1]).toFixed(1)}" x2="${c.b[0].toFixed(1)}" y2="${Y(c.b[1]).toFixed(1)}" stroke="${c.lv % 5 === 0 ? '#a16207' : '#d6b37a'}" stroke-width="${c.lv % 5 === 0 ? 0.7 : 0.35}"/>`;
  s += `<polygon points="${SITE.boundary.map(([x, y]) => `${x},${Y(y)}`).join(' ')}" fill="none" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="8 3 2 3"/>`;
  if (plan && showBuildings) {
    const pmap = progress ? Object.fromEntries(progress.map((p) => [p.id, p])) : null;
    for (const b of plan.buildings) {
      let fill = 'url(#hatch)';
      if (pmap) { const st = pmap[b.id].status; fill = st === 'đúng' ? '#22c55e' : st === 'chậm' ? '#f59e0b' : st === 'chưa' ? '#e2e8f0' : '#ef4444'; }
      if (fire) { const f = fire.find((q) => q.id === b.id); fill = f.ok ? '#bbf7d0' : '#fecaca'; }
      s += `<rect x="${b.x}" y="${Y(b.y + b.d)}" width="${b.w}" height="${b.d}" fill="${fill}" stroke="#1f2937" stroke-width="0.6"/>`;
      s += `<text x="${b.cx}" y="${Y(b.cy) + 1.6}" font-size="4.2" text-anchor="middle" fill="#0f172a" font-weight="bold" paint-order="stroke" stroke="#fff" stroke-width="1.2">${b.id}·${b.floors}T</text>`;
    }
  }
  if (cranes) for (const c of cranes) s += `<circle cx="${c.x}" cy="${Y(c.y)}" r="${c.r}" fill="#f59e0b" fill-opacity="0.08" stroke="#d97706" stroke-dasharray="3 2" stroke-width="0.6"/><circle cx="${c.x}" cy="${Y(c.y)}" r="2" fill="#d97706"/>`;
  // mũi tên Bắc + thước tỷ lệ
  s += `<g transform="translate(${W - 18},20)"><polygon points="0,-12 5,4 0,0 -5,4" fill="#0f172a"/><text y="-15" font-size="7" text-anchor="middle" font-weight="bold">B</text></g>`;
  s += `<g transform="translate(6,${H - 8})"><rect width="25" height="3" fill="#0f172a"/><rect x="25" width="25" height="3" fill="#fff" stroke="#0f172a" stroke-width="0.5"/><text y="-2" font-size="4.5">0</text><text x="50" y="-2" font-size="4.5" text-anchor="middle">50m</text></g>`;
  // chú giải + bảng cân bằng đất
  const lx = W + 12;
  s += `<g font-size="5.5" fill="#0f172a"><text x="${lx}" y="6" font-weight="bold" font-size="6.5">CHÚ GIẢI</text>`;
  let ly = 16;
  for (const k of ['res', 'public', 'green', 'road']) {
    s += `<rect x="${lx}" y="${ly - 5}" width="9" height="6" fill="${USE_COLORS[k]}" stroke="#64748b" stroke-width="0.3"/><text x="${lx + 12}" y="${ly}">${USE_NAMES[k]}</text>`;
    ly += 9;
  }
  s += `<line x1="${lx}" y1="${ly - 2}" x2="${lx + 9}" y2="${ly - 2}" stroke="#dc2626" stroke-dasharray="4 1.5"/><text x="${lx + 12}" y="${ly}">Ranh giới khu đất</text>`;
  ly += 9;
  s += `<line x1="${lx}" y1="${ly - 2}" x2="${lx + 9}" y2="${ly - 2}" stroke="#a16207"/><text x="${lx + 12}" y="${ly}">Đường đồng mức (1 m)</text>`;
  ly += 9;
  s += `<rect x="${lx}" y="${ly - 5}" width="9" height="6" fill="url(#hatch)" stroke="#1f2937" stroke-width="0.4"/><text x="${lx + 12}" y="${ly}">Công trình (mã·số tầng)</text>`;
  ly += 14;
  if (plan) {
    const mt = planMetrics(plan);
    s += `<text x="${lx}" y="${ly}" font-weight="bold" font-size="6.5">CÂN BẰNG ĐẤT ĐAI</text>`;
    ly += 9;
    const rows = [['Đất ở', mt.res], ['Công cộng', mt.pub], ['Cây xanh', mt.green], ['Giao thông', mt.road]];
    for (const [n, a] of rows) {
      s += `<text x="${lx}" y="${ly}">${n}</text><text x="${lx + 70}" y="${ly}" text-anchor="end">${fmt(a / 10000, 2)} ha</text><text x="${lx + 100}" y="${ly}" text-anchor="end">${fmt((a / mt.site) * 100, 1)}%</text>`;
      ly += 8;
    }
    s += `<line x1="${lx}" y1="${ly - 5}" x2="${lx + 100}" y2="${ly - 5}" stroke="#0f172a" stroke-width="0.4"/><text x="${lx}" y="${ly + 1}" font-weight="bold">Tổng</text><text x="${lx + 70}" y="${ly + 1}" text-anchor="end" font-weight="bold">${fmt(mt.site / 10000, 2)} ha</text><text x="${lx + 100}" y="${ly + 1}" text-anchor="end">100%</text>`;
    ly += 13;
    s += `<text x="${lx}" y="${ly}">MĐXD: ${fmt(mt.mdxd, 1)}% · HSSDĐ: ${fmt(mt.far, 2)}</text>`;
    ly += 8;
    s += `<text x="${lx}" y="${ly}">Tầng cao tối đa: ${mt.floorsMax} · Số căn: ${fmt(mt.units)}</text>`;
    ly += 8;
    if (pad) s += `<text x="${lx}" y="${ly}">Cao độ san nền TK: +${pad.toFixed(2)} m</text>`;
  }
  s += `</g>`;
  // khung tên
  s += `<g transform="translate(${W + 12},${H - 44})" font-size="5"><rect width="128" height="48" fill="#fff" stroke="#0f172a" stroke-width="0.8"/><line x1="0" y1="14" x2="128" y2="14" stroke="#0f172a" stroke-width="0.5"/><text x="4" y="9" font-weight="bold" font-size="6">BẢN VẼ QUY HOẠCH TỔNG MẶT BẰNG</text><text x="4" y="22">${esc(plan ? plan.name : 'Hiện trạng địa hình')}</text><text x="4" y="31">Hệ tọa độ VN-2000 (giả định) · Tỷ lệ 1/1000</text><text x="4" y="40">AIPM OS × AI Digital Twin · Bản demo</text></g>`;
  return s + '</svg>';
}

export function sectionSVG(y, pad) {
  const pts = section(y, pad, 4);
  const hs = pts.map((p) => p.h).concat(pad ? [pad] : []);
  const lo = Math.floor(Math.min(...hs) - 1), hi = Math.ceil(Math.max(...hs) + 1);
  const W = 400, Hh = 120, V = Hh / (hi - lo);
  const yy = (h) => Hh - (h - lo) * V;
  let s = `<svg class="section-svg" viewBox="-30 -10 ${W + 45} ${Hh + 40}" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-size="6">`;
  s += `<rect x="-30" y="-10" width="${W + 45}" height="${Hh + 40}" fill="#fff"/>`;
  for (let h = lo; h <= hi; h += 2) s += `<line x1="0" y1="${yy(h)}" x2="${W}" y2="${yy(h)}" stroke="#eef2f6"/><text x="-4" y="${yy(h) + 2}" text-anchor="end" fill="#64748b">${h}</text>`;
  if (pad) {
    // tô đào/đắp
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a.d == null || b.d == null) continue;
      const cut = (a.h + b.h) / 2 > pad;
      s += `<polygon points="${a.x},${yy(a.h)} ${b.x},${yy(b.h)} ${b.x},${yy(pad)} ${a.x},${yy(pad)}" fill="${cut ? '#fca5a5' : '#93c5fd'}" opacity="0.7"/>`;
    }
  }
  s += `<polyline points="${pts.map((p) => `${p.x},${yy(p.h)}`).join(' ')}" fill="none" stroke="#15803d" stroke-width="1.2"/>`;
  const d = pts.filter((p) => p.d != null);
  if (d.length) s += `<polyline points="${d.map((p) => `${p.x},${yy(p.d)}`).join(' ')}" fill="none" stroke="#dc2626" stroke-width="1.2"/>`;
  for (let x = 0; x <= W; x += 40) {
    const p = pts.find((q) => q.x === x);
    s += `<line x1="${x}" y1="${Hh}" x2="${x}" y2="${Hh + 4}" stroke="#334155"/><text x="${x}" y="${Hh + 11}" text-anchor="middle">${x}</text>`;
    if (p) s += `<text x="${x}" y="${Hh + 20}" text-anchor="middle" fill="#15803d">${p.h.toFixed(2)}</text>`;
  }
  s += `<text x="${W / 2}" y="${Hh + 29}" text-anchor="middle" font-weight="bold">Mặt cắt Y = ${y} m — xanh: tự nhiên, đỏ: san nền thiết kế${pad ? ' (+' + pad.toFixed(2) + ' m)' : ''}; vùng đỏ nhạt: đào, xanh nhạt: đắp</text>`;
  return s + '</svg>';
}

export async function svgToPng(svgStr, scale = 3) {
  const vb = svgStr.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const c = document.createElement('canvas');
  c.width = vb[2] * scale; c.height = vb[3] * scale;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
