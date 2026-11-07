// =====================================================================
// DXF R12 (ASCII) — xuất/nhập bản vẽ CAD, đơn vị mm
// Xuất: LINE, POLYLINE/VERTEX, CIRCLE, ARC, TEXT (+ cấu kiện kết cấu theo lớp S-*)
// Nhập: LINE, LWPOLYLINE, POLYLINE/VERTEX, CIRCLE, ARC, TEXT, MTEXT
// =====================================================================
const ACI = { '#ffffff': 7, '#ff0000': 1, '#ffff00': 2, '#00ff00': 3, '#00ffff': 4, '#0000ff': 5, '#ff00ff': 6, '#808080': 8, '#c0c0c0': 9 };
const aci = (hex) => ACI[hex?.toLowerCase()] || 7;

export function toDXF(doc) {
  const o = [];
  const p = (c, v) => o.push(String(c), String(v));
  p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'TABLES'); p(0, 'TABLE'); p(2, 'LAYER'); p(70, doc.layers.length);
  for (const l of doc.layers) { p(0, 'LAYER'); p(2, l.name); p(70, l.locked ? 4 : 0); p(62, (l.visible === false ? -1 : 1) * aci(l.color)); p(6, 'CONTINUOUS'); }
  p(0, 'ENDTAB'); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'ENTITIES');
  const line = (L, x1, y1, x2, y2) => { p(0, 'LINE'); p(8, L); p(10, x1); p(20, y1); p(30, 0); p(11, x2); p(21, y2); p(31, 0); };
  const pline = (L, pts, closed) => { p(0, 'POLYLINE'); p(8, L); p(66, 1); p(70, closed ? 1 : 0); for (const [x, y] of pts) { p(0, 'VERTEX'); p(8, L); p(10, x); p(20, y); p(30, 0); } p(0, 'SEQEND'); p(8, L); };
  const text = (L, x, y, h, s, rot = 0) => { p(0, 'TEXT'); p(8, L); p(10, x); p(20, y); p(30, 0); p(40, h); p(1, s); if (rot) p(50, rot); };
  for (const e of doc.ents) {
    if (e.type === 'line') line(e.layer, ...e.pts[0], ...e.pts[1]);
    else if (e.type === 'pline') pline(e.layer, e.pts, e.closed);
    else if (e.type === 'circle') { p(0, 'CIRCLE'); p(8, e.layer); p(10, e.c[0]); p(20, e.c[1]); p(30, 0); p(40, e.r); }
    else if (e.type === 'arc') { p(0, 'ARC'); p(8, e.layer); p(10, e.c[0]); p(20, e.c[1]); p(30, 0); p(40, e.r); p(50, (e.a0 * 180) / Math.PI); p(51, (e.a1 * 180) / Math.PI); }
    else if (e.type === 'text') text(e.layer, e.p[0], e.p[1], e.h, e.text);
    else if (e.type === 'dim') { line(e.layer, ...e.d1, ...e.d2); text(e.layer, (e.d1[0] + e.d2[0]) / 2, (e.d1[1] + e.d2[1]) / 2 + 80, 250, String(Math.round(Math.hypot(e.pts[1][0] - e.pts[0][0], e.pts[1][1] - e.pts[0][1])))); }
    else if (e.type === 'hatch') pline(e.layer, e.pts, true);
  }
  // cấu kiện kết cấu
  const st = doc.struct;
  st.grid.xs.forEach((x, i) => { line('S-GRID', x, st.grid.ys[0] - 2000, x, st.grid.ys.at(-1) + 2000); text('S-GRID', x - 150, st.grid.ys.at(-1) + 2600, 400, st.grid.xNames[i]); });
  st.grid.ys.forEach((y, i) => { line('S-GRID', st.grid.xs[0] - 2000, y, st.grid.xs.at(-1) + 2000, y); text('S-GRID', st.grid.xs[0] - 2800, y - 200, 400, st.grid.yNames[i]); });
  const rect = (x, y, b, h) => [[x - b / 2, y - h / 2], [x + b / 2, y - h / 2], [x + b / 2, y + h / 2], [x - b / 2, y + h / 2]];
  st.cols.forEach((c) => pline('S-COL', rect(c.x, c.y, c.b, c.h), true));
  st.beams.forEach((b) => { const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), nx = (-(b.y2 - b.y1) / L) * b.b / 2, ny = ((b.x2 - b.x1) / L) * b.b / 2; line('S-BEAM', b.x1 + nx, b.y1 + ny, b.x2 + nx, b.y2 + ny); line('S-BEAM', b.x1 - nx, b.y1 - ny, b.x2 - nx, b.y2 - ny); });
  st.slabs.forEach((s) => pline('S-SLAB', s.pts, true));
  st.walls.forEach((w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), nx = (-(w.y2 - w.y1) / L) * w.t / 2, ny = ((w.x2 - w.x1) / L) * w.t / 2; pline(w.kind === 'rc' ? 'S-WALL' : 'A-WALL', [[w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], [w.x2 - nx, w.y2 - ny], [w.x1 - nx, w.y1 - ny]], true); });
  st.foots.forEach((f) => pline('S-FOOT', rect(f.x, f.y, f.B, f.L), true));
  p(0, 'ENDSEC'); p(0, 'EOF');
  return o.join('\r\n');
}

export function fromDXF(text) {
  const t = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < t.length; i += 2) pairs.push([+t[i].trim(), t[i + 1].trim()]);
  let i = pairs.findIndex(([c, v]) => c === 2 && v === 'ENTITIES');
  const ents = [], layers = new Set();
  if (i < 0) return { ents, layers: [] };
  const rd = () => { const o = {}; i++; while (i < pairs.length && pairs[i][0] !== 0) { const [c, v] = pairs[i]; (o[c] ||= []).push(v); i++; } return o; };
  const n = (o, c, k = 0) => +(o[c]?.[k] ?? 0);
  while (i < pairs.length) {
    const [c, v] = pairs[i];
    if (c !== 0) { i++; continue; }
    if (v === 'ENDSEC') break;
    if (v === 'POLYLINE') {
      const h = rd(), pts = [];
      while (i < pairs.length && pairs[i][1] === 'VERTEX') { const vx = rd(); pts.push([n(vx, 10), n(vx, 20)]); }
      if (pairs[i]?.[1] === 'SEQEND') rd();
      const L = h[8]?.[0] || '0'; layers.add(L);
      if (pts.length > 1) ents.push({ type: 'pline', layer: L, pts, closed: (n(h, 70) & 1) === 1 });
      continue;
    }
    const o = rd(), L = o[8]?.[0] || '0';
    if (v === 'LINE') ents.push({ type: 'line', layer: L, pts: [[n(o, 10), n(o, 20)], [n(o, 11), n(o, 21)]] });
    else if (v === 'LWPOLYLINE') ents.push({ type: 'pline', layer: L, pts: (o[10] || []).map((x, k) => [+x, +o[20][k]]), closed: (n(o, 70) & 1) === 1 });
    else if (v === 'CIRCLE') ents.push({ type: 'circle', layer: L, c: [n(o, 10), n(o, 20)], r: n(o, 40) });
    else if (v === 'ARC') ents.push({ type: 'arc', layer: L, c: [n(o, 10), n(o, 20)], r: n(o, 40), a0: (n(o, 50) * Math.PI) / 180, a1: (n(o, 51) * Math.PI) / 180 });
    else if (v === 'TEXT' || v === 'MTEXT') ents.push({ type: 'text', layer: L, p: [n(o, 10), n(o, 20)], h: n(o, 40) || 250, text: (o[1]?.[0] || '').replace(/\\P/g, ' ') });
    else continue;
    layers.add(L);
  }
  return { ents, layers: [...layers] };
}
