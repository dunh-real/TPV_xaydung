// =====================================================================
// Tải & đóng gói dữ liệu GIS thật cho 02 cảnh mẫu MOD-00 (chạy 1 lần khi build dữ liệu)
//   node tools/fetch_gis.cjs            → ghi src/data/osm/<tenant>.json
// Nguồn: OpenStreetMap (Overpass API, ODbL) · AWS Terrain Tiles (Terrarium, SRTM/…)
// Ảnh vệ tinh KHÔNG đóng gói (tải trực tiếp từ Esri khi chạy, theo điều khoản dịch vụ).
// =====================================================================
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/osm');
const CACHE = path.join(__dirname, '.cache');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

const EXTENT = 3000; // nửa cạnh cảnh (m) — khớp src/lib/citygen.js
const SCENES = {
  hcm: { lon: 106.705, lat: 10.776, name: 'TP.HCM — khu trung tâm & Thủ Thiêm' },
  'dong-nai': { lon: 106.825, lat: 10.95, name: 'Đồng Nai — khu trung tâm Biên Hòa' },
};
const UA = 'aipm-digital-twin-demo/1.0 (one-off demo data build)';

// ------------------------------------------------------------- tiện ích
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(key, q) {
  const f = path.join(CACHE, key + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
    if (r.ok) { const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); return j; }
    console.log('  overpass', r.status, '— thử lại'); await sleep(15000 * (a + 1));
  }
  throw new Error('Overpass thất bại: ' + key);
}
async function getBin(key, url) {
  const f = path.join(CACHE, key);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(f, b);
  return b;
}
// PNG 8-bit RGB/RGBA không interlace (đủ cho Terrarium)
function decodePNG(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12]) throw new Error('PNG không hỗ trợ'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG color type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
// ghép các way thành vòng kín (multipolygon)
function stitch(ways) {
  const segs = ways.filter((g) => g && g.length > 1).map((g) => g.map((p) => [p.lon, p.lat]));
  const rings = [], k = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (k(ring[0]) !== k(ring[ring.length - 1]) && guard++ < 5000) {
      const end = k(ring[ring.length - 1]);
      const i = segs.findIndex((s) => k(s[0]) === end || k(s[s.length - 1]) === end);
      if (i < 0) break;
      let s = segs.splice(i, 1)[0];
      if (k(s[0]) !== end) s = s.slice().reverse();
      ring = ring.concat(s.slice(1));
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}
function elementRings(el) {
  if (el.type === 'way') return el.geometry ? { outer: [el.geometry.map((p) => [p.lon, p.lat])], inner: [] } : { outer: [], inner: [] };
  const m = el.members || [];
  return { outer: stitch(m.filter((x) => x.type === 'way' && x.role !== 'inner').map((x) => x.geometry)), inner: stitch(m.filter((x) => x.type === 'way' && x.role === 'inner').map((x) => x.geometry)) };
}
function dp(pts, eps) { // Douglas–Peucker (vòng khép kín: bỏ điểm lặp cuối trước)
  if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, az] = pts[a], [bx, bz] = pts[b], L = Math.hypot(bx - ax, bz - az) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (az - pts[i][1]) - (ax - pts[i][0]) * (bz - az)) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return s / 2; };
// mã hóa vòng: dm, delta
const enc = (r) => { const o = []; let px = 0, pz = 0; for (const [x, z] of r) { const X = Math.round(x * 10), Z = Math.round(z * 10); o.push(X - px, Z - pz); px = X; pz = Z; } return o; };
// raster theo hàng (even-odd trong 1 phần tử), OR vào lưới
function rasterize(grid, N, cell, rings, val) {
  const edges = [];
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) edges.push([r[j][0], r[j][1], r[i][0], r[i][1]]);
  for (let row = 0; row < N; row++) {
    const z = -EXTENT + (row + 0.5) * cell, xs = [];
    for (const [x1, z1, x2, z2] of edges) if ((z1 > z) !== (z2 > z)) xs.push(x1 + ((z - z1) * (x2 - x1)) / (z2 - z1));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] + EXTENT) / cell - 0.5)), c1 = Math.min(N - 1, Math.floor((xs[k + 1] + EXTENT) / cell - 0.5));
      for (let c = c0; c <= c1; c++) grid[row * N + c] = val;
    }
  }
}
const rle = (arr) => { const o = []; let v = arr[0], n = 0; for (const a of arr) { if (a === v) n++; else { o.push(v, n); v = a; n = 1; } } o.push(v, n); return o; };
const num = (s) => { if (s == null) return null; const m = String(s).replace(',', '.').match(/[\d.]+/); return m ? +m[0] : null; };

// ------------------------------------------------------------- dựng 1 cảnh
async function build(id) {
  const S = SCENES[id];
  const kx = 111320 * Math.cos((S.lat * Math.PI) / 180), ky = 110540;
  const L = ([lon, lat]) => [(lon - S.lon) * kx, -(lat - S.lat) * ky];
  const dLat = EXTENT / ky, dLon = EXTENT / kx;
  const bb = `${(S.lat - dLat).toFixed(5)},${(S.lon - dLon).toFixed(5)},${(S.lat + dLat).toFixed(5)},${(S.lon + dLon).toFixed(5)}`;
  const inScene = (x, z, m = 0) => Math.abs(x) <= EXTENT + m && Math.abs(z) <= EXTENT + m;
  console.log('==', id, bb);

  // 1) công trình
  const qb = await overpass(id + '-bld', `[out:json][timeout:180];(way["building"](${bb});relation["building"]["type"="multipolygon"](${bb}););out geom;`);
  const B = [];
  for (const el of qb.elements) {
    const t = el.tags || {};
    if (['no', 'roof', 'carport', 'shed_no'].includes(t.building)) continue;
    const { outer } = elementRings(el);
    for (const o of outer.slice(0, 1)) {
      let r = o.map(L);
      if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
      r = dp(r, 0.4);
      if (r.length < 3) continue;
      if (area(r) < 0) r.reverse();
      const a = Math.abs(area(r));
      if (a < 12) continue;
      const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
      if (!inScene(cx, cz)) continue;
      const year = num((t.start_date || '').slice(0, 4));
      B.push([`${el.type[0]}${el.id}`, t.building || 'yes', num(t['building:levels']), num(t.height), t.name || null, year && year > 1800 ? year : null, enc(r)]);
    }
  }
  console.log('  công trình', B.length);

  // 2) mặt nước → lưới 10 m
  const NW = 600, CW = (EXTENT * 2) / NW, water = new Uint8Array(NW * NW);
  const qw = await overpass(id + '-water', `[out:json][timeout:180];(way["natural"="water"](${bb});relation["natural"="water"](${bb});way["waterway"="riverbank"](${bb});relation["waterway"="riverbank"](${bb});way["water"](${bb}););out geom;`);
  for (const el of qw.elements) { const { outer, inner } = elementRings(el); if (outer.length) { const tmp = new Uint8Array(NW * NW); rasterize(tmp, NW, CW, [...outer, ...inner].map((r) => r.map(L)), 1); for (let i = 0; i < tmp.length; i++) if (tmp[i]) water[i] = 1; } }
  console.log('  ô nước', water.reduce((s, v) => s + v, 0));

  // 3) sử dụng đất hiện trạng → lưới 20 m
  const NL = 300, CL = (EXTENT * 2) / NL, land = new Uint8Array(NL * NL);
  const qlu = await overpass(id + '-landuse', `[out:json][timeout:180];(way["landuse"](${bb});relation["landuse"](${bb});way["leisure"~"park|garden|pitch|golf_course|playground|nature_reserve"](${bb});relation["leisure"~"park|garden"](${bb});way["natural"~"wood|scrub|grassland|wetland|heath"](${bb});way["amenity"~"school|university|college|kindergarten|hospital|clinic|townhall|place_of_worship"](${bb});relation["amenity"~"school|university|college|hospital"](${bb}););out geom;`);
  const cls = (t) => {
    if (t.amenity) return t.amenity === 'place_of_worship' ? 5 : 5;
    if (['scrub', 'grassland', 'heath'].includes(t.natural)) return 7; // đất trống có cỏ/cây bụi (thường là đất chờ phát triển)
    if (t.leisure || ['wood', 'wetland'].includes(t.natural) || ['grass', 'recreation_ground', 'village_green', 'forest', 'meadow'].includes(t.landuse)) return 4;
    const u = t.landuse;
    if (['residential'].includes(u)) return 1;
    if (['commercial', 'retail'].includes(u)) return 2;
    if (['industrial', 'port', 'railway', 'depot', 'garages', 'warehouse'].includes(u)) return 3;
    if (['education', 'institutional', 'religious', 'civic_admin', 'government'].includes(u)) return 5;
    if (['construction', 'brownfield', 'greenfield', 'landfill'].includes(u)) return 7;
    if (['farmland', 'orchard', 'paddy', 'aquaculture', 'farmyard', 'plant_nursery', 'vineyard', 'animal_keeping'].includes(u)) return 8;
    if (u === 'cemetery') return 9;
    if (u === 'military') return 10;
    return 0;
  };
  const order = (c) => ({ 1: 1, 8: 1, 3: 2, 2: 3, 7: 3, 9: 4, 10: 4, 4: 5, 5: 6 }[c] || 0);
  const lus = qlu.elements.map((el) => ({ el, c: cls(el.tags || {}) })).filter((x) => x.c).sort((a, b) => order(a.c) - order(b.c));
  for (const { el, c } of lus) { const { outer, inner } = elementRings(el); if (outer.length) { const tmp = new Uint8Array(NL * NL); rasterize(tmp, NL, CL, [...outer, ...inner].map((r) => r.map(L)), 1); for (let i = 0; i < tmp.length; i++) if (tmp[i]) land[i] = c; } }
  console.log('  ô sử dụng đất có nhãn', land.reduce((s, v) => s + (v ? 1 : 0), 0));

  // 4) ranh phường/xã (admin_level 6 — sau sắp xếp 2025)
  const qa = await overpass(id + '-admin', `[out:json][timeout:180];relation["boundary"="administrative"]["admin_level"="6"](${bb});out geom;`);
  const wards = [];
  for (const el of qa.elements) {
    const t = el.tags || {}, { outer } = elementRings(el);
    const rings = outer.map((r) => dp(r.map(L), 6)).filter((r) => r.length >= 3);
    if (!rings.length || !t.name) continue;
    wards.push({ osm: el.id, name: t.name, ref: t.ref || t['ref:gso'] || null, pop: num(t.population), rings: rings.map(enc) });
  }
  console.log('  phường/xã', wards.length, wards.map((w) => w.name).join(' · '));

  // 5) cơ sở dịch vụ (trường, y tế, hành chính) — điểm
  const qp = await overpass(id + '-poi', `[out:json][timeout:180];(nwr["amenity"~"^(school|kindergarten|college|university|hospital|clinic|doctors|townhall|police|fire_station|community_centre)$"](${bb}););out center tags;`);
  const tmap = { school: 'school', kindergarten: 'school', college: 'school', university: 'school', hospital: 'health', clinic: 'health', doctors: 'health', townhall: 'service', police: 'service', fire_station: 'service', community_centre: 'service' };
  const P = [];
  for (const el of qp.elements) {
    const t = el.tags || {}, c = el.type === 'node' ? [el.lon, el.lat] : el.center ? [el.center.lon, el.center.lat] : null;
    if (!c) continue;
    const [x, z] = L(c);
    if (!inScene(x, z)) continue;
    P.push([`${el.type[0]}${el.id}`, tmap[t.amenity], t.amenity, t.name || null, Math.round(x), Math.round(z), num(t.beds || t.capacity), t['addr:street'] || null]);
  }
  console.log('  cơ sở dịch vụ', P.length);

  // 6) đường chính (vẽ nền ngoại tuyến + nhãn)
  const qr = await overpass(id + '-roads', `[out:json][timeout:180];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link)$"](${bb});out geom tags;`);
  const R = [];
  for (const el of qr.elements) {
    const pts = dp(el.geometry.map((p) => [p.lon, p.lat]).map(L), 2);
    if (pts.length < 2 || !pts.some(([x, z]) => inScene(x, z, 200))) continue;
    R.push([el.tags.highway, el.tags.name || null, enc(pts), num(el.tags.lanes), el.tags.bridge === 'yes' ? 1 : 0]);
  }
  // đường nhỏ (chỉ cho nền ngoại tuyến)
  const qr2 = await overpass(id + '-roads2', `[out:json][timeout:180];way["highway"~"^(residential|unclassified|living_street)$"](${bb});out geom;`);
  for (const el of qr2.elements) {
    const pts = dp(el.geometry.map((p) => [p.lon, p.lat]).map(L), 2);
    if (pts.length < 2 || !pts.some(([x, z]) => inScene(x, z))) continue;
    R.push([el.tags.highway, null, enc(pts), null, 0]);
  }
  console.log('  đường', R.length);

  // 7) DEM Terrarium z13 → lưới 121×121 (50 m)
  const Z = 13, n = 2 ** Z;
  const tx = (lon) => ((lon + 180) / 360) * n, ty = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
  const tiles = {};
  const tile = async (x, y) => (tiles[x + '/' + y] ||= decodePNG(await getBin(`${id}-t${Z}-${x}-${y}.png`, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)));
  const elevAt = async (lon, lat) => {
    const fx = tx(lon), fy = ty(lat), X = Math.floor(fx), Y = Math.floor(fy), T = await tile(X, Y);
    const px = Math.min(255, Math.floor((fx - X) * 256)), py = Math.min(255, Math.floor((fy - Y) * 256)), o = (py * 256 + px) * T.bpp;
    return T.data[o] * 256 + T.data[o + 1] + T.data[o + 2] / 256 - 32768;
  };
  const ND = 121, CD = (EXTENT * 2) / (ND - 1), dem = new Float32Array(ND * ND);
  for (let r = 0; r < ND; r++) for (let c = 0; c < ND; c++) {
    const x = -EXTENT + c * CD, z = -EXTENT + r * CD;
    dem[r * ND + c] = await elevAt(S.lon + x / kx, S.lat - z / ky);
  }
  // DSM → gần DTM: trung vị 5×5 (bỏ đỉnh mái nhà cao tầng), chặn trên ở phân vị 97, rồi làm trơn 3×3
  const med = new Float32Array(ND * ND);
  for (let r = 0; r < ND; r++) for (let c = 0; c < ND; c++) { const v = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const rr = r + i, cc = c + j; if (rr >= 0 && cc >= 0 && rr < ND && cc < ND) v.push(dem[rr * ND + cc]); } v.sort((a, b) => a - b); med[r * ND + c] = v[v.length >> 1]; }
  const p97 = Array.from(med).sort((a, b) => a - b)[Math.floor(ND * ND * 0.97)];
  const sm = new Float32Array(ND * ND);
  for (let r = 0; r < ND; r++) for (let c = 0; c < ND; c++) { let s = 0, k = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const rr = r + i, cc = c + j; if (rr >= 0 && cc >= 0 && rr < ND && cc < ND) { s += Math.min(p97, med[rr * ND + cc]); k++; } } sm[r * ND + c] = s / k; }
  const demDm = Array.from(sm, (v) => Math.round(v * 10));
  console.log('  DEM min/max', Math.min(...demDm) / 10, Math.max(...demDm) / 10);

  // đóng gói
  const bits = Buffer.alloc(Math.ceil((NW * NW) / 8));
  for (let i = 0; i < water.length; i++) if (water[i]) bits[i >> 3] |= 1 << (i & 7);
  const out = {
    tenant: id, name: S.name, origin: [S.lon, S.lat], extent: EXTENT, bbox: bb, fetched: new Date().toISOString().slice(0, 10),
    sources: {
      osm: '© OpenStreetMap contributors · ODbL 1.0 · Overpass API',
      dem: 'AWS Terrain Tiles (Terrarium) · SRTM/NASADEM ~30 m (DSM, gồm mái/cây — không phải DTM)',
      imagery: 'Esri World Imagery (Esri, Maxar, Earthstar Geographics, GIS User Community) — tải khi chạy, không đóng gói',
    },
    buildings: B, wards, pois: P, roads: R,
    water: { n: NW, cell: CW, bits: bits.toString('base64') },
    landuse: { n: NL, cell: CL, rle: rle(Array.from(land)), classes: { 1: 'Dân cư', 2: 'Thương mại – dịch vụ', 3: 'Công nghiệp – kho bãi', 4: 'Cây xanh – mặt thoáng', 5: 'Công cộng – giáo dục – y tế – tôn giáo', 7: 'Đang xây dựng / đất trống', 8: 'Nông nghiệp', 9: 'Nghĩa trang', 10: 'Quốc phòng' } },
    dem: { n: ND, cell: CD, dm: demDm },
  };
  const file = path.join(OUT, id + '.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log('  →', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0), 'KB');
}

(async () => { for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)) await build(id); })().catch((e) => { console.error(e); process.exit(1); });
