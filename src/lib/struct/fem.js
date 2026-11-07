// =====================================================================
// Bộ giải khung 3D tuyến tính (phần tử dầm Euler–Bernoulli 12 bậc tự do)
// Đơn vị SI: N, m, Pa. Trục toàn cục: X, Y nằm ngang, Z hướng lên.
// Ma trận độ cứng lưu dạng băng (đối xứng) → phân tích Cholesky LDLᵀ.
// Đây là bộ giải demo CHƯA kiểm định (V&V) — không thay phần mềm kết cấu thương mại.
// =====================================================================

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

// ma trận quay 3×3 (hàng = trục cục bộ x, y, z trong hệ toàn cục)
export function rotation(p1, p2) {
  const x = norm(sub(p2, p1));
  const ref = Math.abs(x[2]) > 0.99 ? [1, 0, 0] : [0, 0, 1];
  const y = norm(cross(ref, x));
  const z = cross(x, y);
  return [x, y, z];
}
// độ cứng cục bộ 12×12
export function localK(E, G, A, Iy, Iz, J, L) {
  const k = Array.from({ length: 12 }, () => new Float64Array(12));
  const s = (i, j, v) => { k[i][j] = v; k[j][i] = v; };
  const EA = (E * A) / L, GJ = (G * J) / L;
  const z12 = (12 * E * Iz) / L ** 3, z6 = (6 * E * Iz) / L ** 2, z4 = (4 * E * Iz) / L, z2 = (2 * E * Iz) / L;
  const y12 = (12 * E * Iy) / L ** 3, y6 = (6 * E * Iy) / L ** 2, y4 = (4 * E * Iy) / L, y2 = (2 * E * Iy) / L;
  s(0, 0, EA); s(0, 6, -EA); s(6, 6, EA);
  s(3, 3, GJ); s(3, 9, -GJ); s(9, 9, GJ);
  s(1, 1, z12); s(1, 5, z6); s(1, 7, -z12); s(1, 11, z6); s(5, 5, z4); s(5, 7, -z6); s(5, 11, z2); s(7, 7, z12); s(7, 11, -z6); s(11, 11, z4);
  s(2, 2, y12); s(2, 4, -y6); s(2, 8, -y12); s(2, 10, -y6); s(4, 4, y4); s(4, 8, y6); s(4, 10, y2); s(8, 8, y12); s(8, 10, y6); s(10, 10, y4);
  return k;
}
// v_global = Rᵀ v_local ; v_local = R v_global (theo từng khối 3)
const toLocal = (R, v) => { const o = new Float64Array(12); for (let b = 0; b < 4; b++) for (let i = 0; i < 3; i++) o[b * 3 + i] = R[i][0] * v[b * 3] + R[i][1] * v[b * 3 + 1] + R[i][2] * v[b * 3 + 2]; return o; };
const toGlobal = (R, v) => { const o = new Float64Array(12); for (let b = 0; b < 4; b++) for (let i = 0; i < 3; i++) o[b * 3 + i] = R[0][i] * v[b * 3] + R[1][i] * v[b * 3 + 1] + R[2][i] * v[b * 3 + 2]; return o; };
function globalK(kl, R) { // Tᵀ k T
  const kg = Array.from({ length: 12 }, () => new Float64Array(12)), tmp = Array.from({ length: 12 }, () => new Float64Array(12));
  for (let i = 0; i < 12; i++) for (let jb = 0; jb < 4; jb++) for (let j = 0; j < 3; j++) { let v = 0; for (let m = 0; m < 3; m++) v += kl[i][jb * 3 + m] * R[m][j]; tmp[i][jb * 3 + j] = v; }
  for (let ib = 0; ib < 4; ib++) for (let i = 0; i < 3; i++) for (let j = 0; j < 12; j++) { let v = 0; for (let m = 0; m < 3; m++) v += R[m][i] * tmp[ib * 3 + m][j]; kg[ib * 3 + i][j] = v; }
  return kg;
}
// lực nút tương đương của tải phân bố đều q (N/m, hướng toàn cục) — cục bộ
function fixedEnd(R, q, L) {
  const ql = [R[0][0] * q[0] + R[0][1] * q[1] + R[0][2] * q[2], R[1][0] * q[0] + R[1][1] * q[1] + R[1][2] * q[2], R[2][0] * q[0] + R[2][1] * q[1] + R[2][2] * q[2]];
  const f = new Float64Array(12);
  f[0] = f[6] = (ql[0] * L) / 2;
  f[1] = f[7] = (ql[1] * L) / 2; f[5] = (ql[1] * L * L) / 12; f[11] = -(ql[1] * L * L) / 12;
  f[2] = f[8] = (ql[2] * L) / 2; f[4] = -(ql[2] * L * L) / 12; f[10] = (ql[2] * L * L) / 12;
  return f;
}

/**
 * model = { nodes: [{x,y,z, fixed}], elems: [{n1,n2,E,G,A,Iy,Iz,J}] }
 * cases = [{ name, q: Map(elemIdx → [qx,qy,qz] N/m), dT: Map(elemIdx → lực dọc cưỡng bức N0), loads: [{node, f:[6]}] }]
 * Phân tích ma trận 1 lần, giải nhiều trường hợp tải. Trả về { ok, cases:[{disp, forces:[Float64Array(12) cục bộ]}] }
 */
export function solveCases(model, cases) {
  const nn = model.nodes.length;
  const map = new Int32Array(nn * 6).fill(-1);
  let nf = 0;
  for (let i = 0; i < nn; i++) if (!model.nodes[i].fixed) for (let d = 0; d < 6; d++) map[i * 6 + d] = nf++;
  let bw = 0;
  const dofsOf = (e) => { const o = []; for (const n of [e.n1, e.n2]) for (let d = 0; d < 6; d++) o.push(map[n * 6 + d]); return o; };
  for (const e of model.elems) { const ids = dofsOf(e).filter((v) => v >= 0); if (ids.length) bw = Math.max(bw, Math.max(...ids) - Math.min(...ids)); }
  const W = bw + 1, K = new Float64Array(nf * W);
  const cache = model.elems.map((e) => {
    const p1 = [model.nodes[e.n1].x, model.nodes[e.n1].y, model.nodes[e.n1].z], p2 = [model.nodes[e.n2].x, model.nodes[e.n2].y, model.nodes[e.n2].z];
    const L = Math.hypot(...sub(p2, p1)), R = rotation(p1, p2), kl = localK(e.E, e.G, e.A, e.Iy, e.Iz, e.J, L), kg = globalK(kl, R), dofs = dofsOf(e);
    for (let a = 0; a < 12; a++) { if (dofs[a] < 0) continue; for (let b = a; b < 12; b++) if (dofs[b] >= 0) { let i = dofs[a], j = dofs[b]; if (j < i) [i, j] = [j, i]; K[i * W + (j - i)] += kg[a][b]; } }
    return { L, R, kl, dofs };
  });
  for (let i = 0; i < nf; i++) {
    const di = K[i * W];
    if (!(Math.abs(di) > 1e-9)) return { ok: false, error: `Ma trận suy biến tại bậc tự do ${i} — kết cấu thiếu liên kết (cơ cấu)` };
    for (let k = 1; k < W && i + k < nf; k++) {
      const lik = K[i * W + k] / di;
      if (lik === 0) continue;
      for (let m = k; m < W && i + m < nf; m++) K[(i + k) * W + (m - k)] -= lik * K[i * W + m];
      K[i * W + k] = lik;
    }
  }
  const out = cases.map((cs) => {
    const F = new Float64Array(nf), fes = new Array(model.elems.length);
    model.elems.forEach((e, k) => {
      const c = cache[k], q = cs.q?.get(k), n0 = cs.dT?.get(k);
      if (!q && !n0) return;
      const fe = q ? fixedEnd(c.R, q, c.L) : new Float64Array(12);
      if (n0) { fe[0] -= n0; fe[6] += n0; }
      fes[k] = fe;
      const fg = toGlobal(c.R, fe);
      for (let a = 0; a < 12; a++) if (c.dofs[a] >= 0) F[c.dofs[a]] += fg[a];
    });
    for (const l of cs.loads || []) for (let d = 0; d < 6; d++) { const g = map[l.node * 6 + d]; if (g >= 0) F[g] += l.f[d] || 0; }
    const u = F;
    for (let i = 0; i < nf; i++) for (let k = 1; k < W && i + k < nf; k++) u[i + k] -= K[i * W + k] * u[i];
    for (let i = 0; i < nf; i++) u[i] /= K[i * W];
    for (let i = nf - 1; i >= 0; i--) for (let k = 1; k < W && i + k < nf; k++) u[i] -= K[i * W + k] * u[i + k];
    const disp = new Float64Array(nn * 6);
    for (let i = 0; i < nn * 6; i++) if (map[i] >= 0) disp[i] = u[map[i]];
    const forces = model.elems.map((e, k) => {
      const c = cache[k], ug = new Float64Array(12);
      for (let d = 0; d < 6; d++) { ug[d] = disp[e.n1 * 6 + d]; ug[6 + d] = disp[e.n2 * 6 + d]; }
      const ul = toLocal(c.R, ug), f = new Float64Array(12);
      for (let a = 0; a < 12; a++) { let v = 0; for (let b = 0; b < 12; b++) v += c.kl[a][b] * ul[b]; f[a] = v - (fes[k] ? fes[k][a] : 0); }
      return f;
    });
    return { name: cs.name, disp, forces };
  });
  return { ok: true, cases: out, nf, bw, lengths: cache.map((c) => c.L) };
}
// tương thích: 1 trường hợp tải
export function solve(model) {
  const q = new Map(); model.elems.forEach((e, k) => e.q && q.set(k, e.q));
  const r = solveCases(model, [{ name: 'LC', q, loads: model.loads }]);
  if (!r.ok) return r;
  return { ok: true, disp: r.cases[0].disp, forces: r.cases[0].forces.map((f, k) => ({ local: f, L: r.lengths[k] })), nf: r.nf, bw: r.bw };
}
