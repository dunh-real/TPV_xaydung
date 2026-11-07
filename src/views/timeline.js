// Phân hệ 4: Timeline tự động theo Stage-Gate, đường găng, cảnh báo, tiến độ 4D
import { getState, setState, DATA, gateStatus, gateChecklist } from '../store.js';
import { generatePlan, progress4D } from '../lib/engine.js';
import { esc, fmt, addDays, diffDays, todayISO, viDate, pct, toast } from '../lib/util.js';
import { openCopilot } from '../copilot.js';
import { QTO_ROWS, MATERIAL_VARIANTS } from '../data/digital-twin.js';

// Thời lượng tham khảo (ngày) & phụ thuộc — thời hạn pháp định cần xác minh theo quy định hiện hành
const PLAN = {
  G0: { d: 30, dep: [], note: 'Thông tin quy hoạch, ranh giới' },
  G1: { d: 45, dep: ['G0'], note: 'Thẩm định chủ trương đầu tư' },
  G2: { d: 20, dep: ['G1'], note: 'Sơ bộ TMĐT, nguồn vốn' },
  G3: { d: 25, dep: ['G1'], note: 'Dự toán chuẩn bị đầu tư, ĐTM' },
  G4: { d: 30, dep: ['G1'], note: 'Dữ liệu khảo sát phục vụ TKCS' },
  G5: { d: 60, dep: ['G2', 'G3', 'G4'], note: 'BCNCKT, thẩm định, QĐ đầu tư' },
  G6: { d: 15, dep: ['G5'], note: 'Kế hoạch BIM/CDE' },
  G7: { d: 30, dep: ['G5'], note: 'Bố trí vốn' },
  G8: { d: 120, dep: ['G5'], note: 'GPMB, đất đai' },
  G9: { d: 60, dep: ['G6'], note: 'TKKT/TKBVTC, dự toán' },
  G10: { d: 60, dep: ['G7', 'G9'], note: 'Lựa chọn nhà thầu' },
  G11: { d: 15, dep: ['G10'], note: 'Ký hợp đồng' },
  G12: { d: 360, dep: ['G8', 'G11'], note: 'Thi công' },
  G13: { d: 340, dep: ['G11'], note: 'Giám sát, thí nghiệm (song song)' },
  G14: { d: 45, dep: ['G12'], note: 'Nghiệm thu, thanh toán' },
  G15: { d: 180, dep: ['G14'], note: 'Quyết toán, kiểm toán' },
  G16: { d: 30, dep: ['G14'], note: 'Bàn giao, vận hành' },
};

export function schedule(start, extra = {}) {
  const ids = DATA.gates.map((g) => g.id);
  const es = {}, ef = {}, dur = (id) => PLAN[id].d + (extra[id] || 0);
  for (const id of ids) { es[id] = Math.max(0, ...PLAN[id].dep.map((d) => ef[d])); ef[id] = es[id] + dur(id); }
  const end = Math.max(...ids.map((i) => ef[i]));
  const lf = {}, ls = {};
  for (const id of [...ids].reverse()) {
    const succ = ids.filter((x) => PLAN[x].dep.includes(id));
    lf[id] = succ.length ? Math.min(...succ.map((s) => ls[s])) : end;
    ls[id] = lf[id] - dur(id);
  }
  return ids.map((id) => ({ id, name: DATA.gates.find((g) => g.id === id).name, es: es[id], ef: ef[id], slack: ls[id] - es[id], crit: ls[id] - es[id] === 0, start: addDays(start, es[id]), finish: addDays(start, ef[id]), ...PLAN[id], d: dur(id) }));
}

let root, shift = 0;
const sup = { variant: 'C', delay: 21, productivity: 10, design: false, budget: 0 };
export function render(el) { root = el; draw(); }
export function update() { if (root?.isConnected) draw(); }

function draw() {
  const S = getState();
  const start = S.project.start || todayISO();
  const today = addDays(todayISO(), shift);
  const approved = S.project.approvedSupply || null;
  const rows = schedule(start, approved ? { G12: approved.days } : {}).map((r) => {
    const st = gateStatus(r.id), cl = gateChecklist(r.id);
    const done = st === 'passed' ? 1 : cl.total ? cl.done / cl.total : 0;
    const elapsed = Math.max(0, Math.min(1, diffDays(r.start, today) / r.d));
    const late = st !== 'passed' && today > r.finish;
    const risk = st !== 'passed' && !late && elapsed - done > 0.35;
    return { ...r, st, done, elapsed, late, risk };
  });
  const total = rows[rows.length - 1] && Math.max(...rows.map((r) => r.ef));
  const end = addDays(start, total);
  const lateN = rows.filter((r) => r.late).length, riskN = rows.filter((r) => r.risk).length;
  const crit = rows.filter((r) => r.crit).map((r) => r.id);
  // Gantt SVG
  const W = 1100, LW = 250, RH = 26, H = rows.length * RH + 40;
  const x = (d) => LW + (d / total) * (W - LW - 10);
  const td = diffDays(start, today);
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans,Arial" font-size="11">`;
  const yrs = Math.ceil(total / 365);
  for (let m = 0; m <= total; m += 30) svg += `<line x1="${x(m)}" y1="22" x2="${x(m)}" y2="${H}" stroke="${m % 360 === 0 ? '#cbd5e1' : '#f1f5f9'}"/>${m % 90 === 0 ? `<text x="${x(m) + 2}" y="16" fill="#64748b" font-size="10">${viDate(addDays(start, m)).slice(3)}</text>` : ''}`;
  rows.forEach((r, i) => {
    const y = 28 + i * RH;
    const col = r.st === 'passed' ? '#22c55e' : r.late ? '#ef4444' : r.risk ? '#f59e0b' : r.crit ? '#003f7a' : '#38bdf8';
    svg += `<rect x="0" y="${y - 4}" width="${W}" height="${RH}" fill="${i % 2 ? '#fafcfe' : '#fff'}"/>`;
    svg += `<text x="6" y="${y + 12}" font-weight="700" fill="#076da5">${r.id}</text><text x="40" y="${y + 12}" fill="#0f172a">${esc(r.name.length > 34 ? r.name.slice(0, 33) + '…' : r.name)}</text>`;
    svg += `<rect x="${x(r.es)}" y="${y + 1}" width="${Math.max(3, x(r.ef) - x(r.es))}" height="14" rx="4" fill="${col}" opacity="0.25"/>`;
    svg += `<rect x="${x(r.es)}" y="${y + 1}" width="${Math.max(0, (x(r.ef) - x(r.es)) * r.done)}" height="14" rx="4" fill="${col}"/>`;
    if (r.crit) svg += `<rect x="${x(r.es)}" y="${y + 1}" width="${Math.max(3, x(r.ef) - x(r.es))}" height="14" rx="4" fill="none" stroke="#dc2626" stroke-width="1.4"/>`;
    svg += `<text x="${x(r.ef) + 4}" y="${y + 12}" fill="#64748b" font-size="10">${r.d}d ${r.slack ? `· dự trữ ${r.slack}d` : ''}${r.late ? ' 🚨' : r.risk ? ' ⚠' : ''}</text>`;
    r.dep.forEach((d) => { const di = rows.findIndex((q) => q.id === d); svg += `<path d="M${x(rows[di].ef)},${28 + di * RH + 8} C${x(rows[di].ef) + 8},${28 + di * RH + 8} ${x(r.es) - 8},${y + 8} ${x(r.es)},${y + 8}" fill="none" stroke="#94a3b8" stroke-width="0.8"/>`; });
  });
  if (td >= 0 && td <= total) svg += `<line x1="${x(td)}" y1="20" x2="${x(td)}" y2="${H}" stroke="#f89b1a" stroke-width="2" stroke-dasharray="4 3"/><text x="${x(td) + 3}" y="${H - 4}" fill="#b45309" font-weight="700">Hôm nay ${viDate(today)}</text>`;
  svg += '</svg>';

  // S-curve 4D
  const p = S.twin.scenario ? generatePlan(S.twin.scenario, S.params) : null;
  let scurve = '<p class="small muted">Chọn phương án và nhập bản cập nhật hiện trạng đã xác minh để đối chiếu tiến độ 4D.</p>';
  if (p) {
    const pts = [];
    for (let f = 0; f <= 8; f++) {
      const pr = progress4D(p, f);
      const w = p.buildings.map((b) => b.w * b.d * b.floors);
      const tw = w.reduce((a, b) => a + b, 0);
      pts.push({ f, plan: pr.reduce((a, q, i) => a + q.planned * w[i], 0) / tw, act: pr.reduce((a, q, i) => a + q.actual * w[i], 0) / tw });
    }
    const SW = 520, SH = 220, sx = (f) => 40 + (f / 8) * (SW - 60), sy = (v) => SH - 30 - v * (SH - 50);
    const fl = S.twin.surveyUpdates;
    scurve = `<svg viewBox="0 0 ${SW} ${SH}" width="100%" font-family="Arial" font-size="10">
      ${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="40" x2="${SW - 20}" y1="${sy(v)}" y2="${sy(v)}" stroke="#eef2f6"/><text x="34" y="${sy(v) + 3}" text-anchor="end" fill="#64748b">${v * 100}%</text>`).join('')}
      ${pts.map((q) => `<text x="${sx(q.f)}" y="${SH - 14}" text-anchor="middle" fill="#64748b">Đ${q.f}</text>`).join('')}
      <polyline points="${pts.map((q) => `${sx(q.f)},${sy(q.plan)}`).join(' ')}" fill="none" stroke="#076da5" stroke-width="2" stroke-dasharray="5 3"/>
      ${fl ? `<polyline points="${pts.slice(0, fl + 1).map((q) => `${sx(q.f)},${sy(q.act)}`).join(' ')}" fill="none" stroke="#f89b1a" stroke-width="2.5"/>${pts.slice(1, fl + 1).map((q) => `<circle cx="${sx(q.f)}" cy="${sy(q.act)}" r="3.5" fill="#f89b1a"/>`).join('')}` : ''}
      <text x="${SW / 2}" y="${SH - 2}" text-anchor="middle" fill="#334155">Bản cập nhật hiện trạng — nét đứt: kế hoạch · cam: dữ liệu đối chiếu</text></svg>
      ${fl ? `<div class="mt"><span>Kế hoạch lũy kế (đợt ${fl})</span><span>${fmt(pts[fl].plan * 100, 1)}%</span><span>Thực tế</span><span>${fmt(pts[fl].act * 100, 1)}%</span><span>Chênh lệch (SPI ≈)</span><span style="color:${pts[fl].act / pts[fl].plan < 0.9 ? 'var(--red)' : 'var(--green)'}">${fmt(pts[fl].act / (pts[fl].plan || 1), 2)}</span></div>` : ''}`;
  }

  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">Phân hệ 4 · AI Workflow & Project Control</div><h2>Master Schedule tự động theo 17 cổng Stage-Gate</h2>
      <p>Gantt + đường găng (CPM) sinh từ ${DATA.steps.length} bước và ${DATA.gates.length} cổng trong cấu hình hiện tại; baseline chỉ thay đổi sau phê duyệt.</p></div>
      <div class="row">
        <label class="f">Ngày khởi động<input type="date" id="start" value="${start}"></label>
        <label class="f">Giả lập "hôm nay"<div class="row"><button class="btn sm" data-sh="-30">−30d</button><button class="btn sm" data-sh="30">+30d</button><button class="btn sm" data-sh="180">+180d</button><button class="btn sm" data-sh="0">↺</button></div></label>
        <button class="btn ai" id="ai">🤖 AI đánh giá tiến độ</button>
      </div></div>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="kpi"><span class="l">Tổng thời gian dự kiến</span><span class="v">${fmt(total / 30, 1)} tháng</span><span class="small muted">${viDate(start)} → ${viDate(end)}</span></div>
      <div class="kpi"><span class="l">Cổng đã qua</span><span class="v">${rows.filter((r) => r.st === 'passed').length}/17</span><div class="bar g"><i style="width:${pct(rows.filter((r) => r.st === 'passed').length, 17)}%"></i></div></div>
      <div class="kpi"><span class="l">Trễ hạn</span><span class="v" style="color:var(--red)">${lateN}</span><span class="small muted">${rows.filter((r) => r.late).map((r) => r.id).join(', ') || 'Không có'}</span></div>
      <div class="kpi"><span class="l">Nguy cơ trễ (cảnh báo sớm)</span><span class="v" style="color:var(--orange)">${riskN}</span><span class="small muted">${rows.filter((r) => r.risk).map((r) => r.id).join(', ') || 'Không có'}</span></div>
    </div>
    <div class="legend" style="margin-bottom:6px"><span><i style="background:#003f7a"></i>Đường găng</span><span><i style="background:#38bdf8"></i>Có dự trữ</span><span><i style="background:#22c55e"></i>Đã qua cổng</span><span><i style="background:#f59e0b"></i>Nguy cơ trễ</span><span><i style="background:#ef4444"></i>Trễ hạn</span><span>Viền đỏ: công việc găng</span></div>
    <div class="gantt scroll">${svg}</div>
    <p class="small muted">Đường găng: ${crit.join(' → ')}. Thời lượng là giá trị tham khảo cho demo; thời hạn pháp định của từng thủ tục thẩm định cần xác minh theo quy định hiện hành.</p>
  </section>
  <div class="grid g2">
    <section class="panel"><div class="ph"><div><div class="kicker">4D BIM Progress Tracking</div><h3>S-curve: kế hoạch vs dữ liệu hiện trạng</h3></div><a class="btn sm" href="#twin?mode=progress">＋ Nhập cập nhật hiện trạng</a></div>${scurve}<div class="disclaimer">Dữ liệu đối chiếu hỗ trợ dự báo; khối lượng nghiệm thu vẫn cần xác nhận theo quy trình.</div></section>
    <section class="panel" id="supply" style="grid-column:1/-1"></section>
    <section class="panel"><div class="ph"><div><div class="kicker">Cảnh báo & giao việc tự động</div><h3>Việc cần xử lý</h3></div></div>
      ${rows.filter((r) => r.late || r.risk || r.st === 'ready').map((r) => `<div class="chk"><span class="i">${r.late ? '🚨' : r.st === 'ready' ? '🔓' : '⚠️'}</span><div class="grow"><b>${r.id} – ${esc(r.name)}</b><div class="small muted">${r.late ? `Quá hạn ${diffDays(r.finish, today)} ngày (KH xong ${viDate(r.finish)})` : r.st === 'ready' ? 'Đủ điều kiện — chờ người có thẩm quyền xác nhận qua cổng' : `Đã dùng ${Math.round(r.elapsed * 100)}% thời gian, hồ sơ mới đạt ${Math.round(r.done * 100)}%`} · Giao: ${esc((DATA.raci.find((x) => x.gate === r.id) || {})['Chủ đầu tư'] === 'R' ? 'Chủ đầu tư / Ban QLDA' : 'Đơn vị tư vấn')}</div></div><a class="btn sm" href="#stage-gate">Xử lý</a></div>`).join('') || '<p class="small muted">Không có cảnh báo. Thử giả lập "hôm nay" +180 ngày để thấy cảnh báo trễ hạn.</p>'}
    </section>
  </div>`;
  supplyPanel(S, start, approved);
  root.querySelector('#start').onchange = (e) => setState((s) => (s.project.start = e.target.value));
  root.querySelectorAll('[data-sh]').forEach((b) => (b.onclick = () => { shift = +b.dataset.sh === 0 ? 0 : shift + +b.dataset.sh; draw(); if (shift) toast(`Giả lập ngày hiện tại: ${viDate(addDays(todayISO(), shift))}`); }));
  root.querySelector('#ai').onclick = () => openCopilot('Đánh giá tiến độ dự án theo timeline Stage-Gate, chỉ ra đường găng, cổng có nguy cơ trễ và đề xuất biện pháp rút ngắn');
}

// ---------- MOD-06 · Cung ứng vật liệu gắn tiến độ 4D/5D ----------
function supplyPanel(S, start, approved) {
  const el = root.querySelector('#supply');
  if (!el) return;
  const V = MATERIAL_VARIANTS[sup.variant];
  const base = schedule(start);
  const g12 = base.find((r) => r.id === 'G12');
  const extraDays = Math.max(0, Math.round(sup.delay * (sup.variant === 'B' ? 0.4 : 1) + g12.d * sup.productivity / 100 * 0.35 + (sup.design ? 20 : 0) + (V.delay || 0) * 0.3));
  const sim = schedule(start, { G12: extraDays });
  const endBase = Math.max(...base.map((r) => r.ef)), endSim = Math.max(...sim.map((r) => r.ef));
  const bom = QTO_ROWS.map((q) => ({ ...q, order: q.qty * (1 + q.waste) * V.qty, cost: q.qty * (1 + q.waste) * V.qty * q.price * V.price * (1 + sup.budget / 100) }));
  const baseCost = QTO_ROWS.reduce((a, q) => a + q.qty * (1 + q.waste) * q.price, 0), simCost = bom.reduce((a, q) => a + q.cost, 0);
  const W = [0.05, 0.15, 0.25, 0.25, 0.2, 0.1];
  const lateMat = sup.delay > 0 ? ['THEP-CB400'] : [];
  if (sup.design) lateMat.push('KINH-ELOW');
  el.innerHTML = `<div class="ph"><div><div class="kicker">MOD-06 · 4D/5D Material Supply & Schedule Impact</div><h3>Cung ứng vật liệu gắn tiến độ — kịch bản ảnh hưởng đường găng</h3><p>Nhu cầu vật liệu từ MOD-02 (QTO/BOM) + chi phí MOD-04 gắn vào cổng G12 (thi công). Chỉ cập nhật lịch kế hoạch sau khi người quản lý duyệt.</p></div>
    <div class="row"><button class="btn ai sm" id="supAi">🤖 Đề xuất điều chỉnh</button>${approved ? `<span class="badge green">Đã duyệt +${approved.days} ngày G12 (${esc(approved.label)})</span><button class="btn sm" id="supUndo">↺ Hủy duyệt</button>` : ''}</div></div>
    <div class="grid g3">
      <div class="col"><label class="f">Kịch bản vật liệu<select id="supV">${Object.entries(MATERIAL_VARIANTS).map(([k, v]) => `<option value="${k}" ${sup.variant === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
        <label class="f">Giao thép chậm (ngày)<input type="number" id="supD" value="${sup.delay}" min="0" max="180"></label>
        <label class="f">Năng suất thi công giảm (%)<input type="number" id="supP" value="${sup.productivity}" min="0" max="60"></label>
        <label class="f">Vượt giá/ngân sách vật liệu (%)<input type="number" id="supB" value="${sup.budget}" min="0" max="50"></label>
        <label class="lyr"><input type="checkbox" id="supX" ${sup.design ? 'checked' : ''}> Thay đổi thiết kế mặt dựng (kính)</label>
        <p class="small muted">${esc(V.note)}</p></div>
      <div class="col"><div class="mt"><span>G12 kế hoạch</span><span>${g12.d} ngày</span><span>Tác động G12</span><span style="color:${extraDays ? 'var(--red)' : 'var(--green)'}">+${extraDays} ngày</span><span>G12 trên đường găng</span><span>${g12.crit ? 'Có' : 'Không (dự trữ ' + g12.slack + ' ngày)'}</span><span>Hoàn thành dự án</span><span>${viDate(addDays(start, endBase))} → <b>${viDate(addDays(start, endSim))}</b></span><span>Chênh lệch tổng tiến độ</span><span style="color:${endSim > endBase ? 'var(--red)' : 'var(--green)'}">+${endSim - endBase} ngày</span><span>Chi phí vật liệu</span><span>${fmt(baseCost / 1e9, 2)} → <b>${fmt(simCost / 1e9, 2)}</b> tỷ đ</span><span>Chênh lệch chi phí</span><span style="color:${simCost > baseCost ? 'var(--red)' : 'var(--green)'}">${simCost >= baseCost ? '+' : ''}${fmt((simCost - baseCost) / 1e9, 2)} tỷ đ</span></div>
        <h5 style="margin-top:6px">Hạng mục chịu tác động</h5>${lateMat.length ? lateMat.map((c) => { const q = QTO_ROWS.find((x) => x.code === c); return `<div class="chk"><span class="i">⚠️</span><div><b>${esc(q.material)}</b> — ${esc(q.source)} · G12 (kết cấu/hoàn thiện)</div></div>`; }).join('') : '<p class="small muted">Không có</p>'}
        <button class="btn ok sm" id="supOk" ${extraDays ? '' : 'disabled'}>✔ Người quản lý duyệt cập nhật lịch kế hoạch</button></div>
      <div class="col"><h5>Nhu cầu vật liệu theo quý (đặt mua, ${esc(V.label.split(' ·')[0])})</h5><table class="tb small"><tr><th>Vật liệu</th>${W.map((_, i) => `<th>Q${i + 1}</th>`).join('')}</tr>${bom.map((q) => `<tr><td>${esc(q.material)} <span class="muted">(${q.unit})</span></td>${W.map((w, i) => `<td class="r" style="${lateMat.includes(q.code) && i >= 1 && i <= 3 ? 'background:#fee2e2' : ''}">${fmt(q.order * w, 0)}</td>`).join('')}</tr>`).join('')}</table><p class="small muted">Ô đỏ: quý bị ảnh hưởng giao hàng. Liên kết ngược kết quả kiểm thử MOD-02 (So sánh A/B/C). Dữ liệu mô phỏng.</p></div>
    </div>`;
  const upd = () => { sup.variant = el.querySelector('#supV').value; sup.delay = +el.querySelector('#supD').value; sup.productivity = +el.querySelector('#supP').value; sup.budget = +el.querySelector('#supB').value; sup.design = el.querySelector('#supX').checked; supplyPanel(getState(), start, approved); };
  el.querySelectorAll('#supV,#supD,#supP,#supB,#supX').forEach((i) => (i.onchange = upd));
  el.querySelector('#supOk').onclick = () => { setState((s) => (s.project.approvedSupply = { days: extraDays, label: `${sup.variant}, chậm ${sup.delay} ngày`, at: todayISO() })); toast(`Đã duyệt: G12 +${extraDays} ngày — Gantt và đường găng cập nhật`, 'ok'); };
  el.querySelector('#supUndo')?.addEventListener('click', () => setState((s) => delete s.project.approvedSupply));
  el.querySelector('#supAi').onclick = () => openCopilot(`Kịch bản cung ứng: ${V.label}, thép giao chậm ${sup.delay} ngày, năng suất giảm ${sup.productivity}%, vượt giá ${sup.budget}%. Tác động G12 +${extraDays} ngày. Đề xuất phương án điều chỉnh (đặt hàng sớm, nguồn thay thế, đổi trình tự thi công) để người quản lý xem xét.`);
}
