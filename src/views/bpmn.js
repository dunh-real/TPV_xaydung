import { getState, setState, DATA, LANES } from '../store.js';
import { esc, toast, todayISO } from '../lib/util.js';
import { agencyMap, TENANTS } from '../data/nationwide.js';
import { openCopilot } from '../copilot.js';

let root, mapTenant = null;
const laneOf = (id) => LANES.find((l) => l.id === id);

export function render(el) { root = el; draw(); }
export function update() { if (root?.isConnected) draw(); }

function draw() {
  const S = getState();
  const late = S.workflow.filter((w) => w.at < w.route.length && w.days > w.sla);
  const warn = S.workflow.filter((w) => w.at < w.route.length && w.days <= w.sla && w.days >= w.sla * 0.75);
  const doneW = S.workflow.filter((w) => w.at >= w.route.length);
  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">BPMN Swimlane → Live Workflow Engine</div><h2>Luồng phối hợp sống giữa 7 chủ thể</h2>
      <p>Hồ sơ được AI tự định tuyến theo trình tự, theo dõi SLA xử lý tại từng cơ quan và cảnh báo điểm nghẽn theo thời gian thực. Làn được ánh xạ theo chính quyền địa phương 2 cấp (UBND cấp tỉnh/cấp xã) và thẩm quyền theo NĐ 217/2026/NĐ-CP; mỗi công việc gắn vị trí trên Bản đồ 3D (MOD-00).</p></div>
      <div class="row"><button class="btn" id="tick">⏩ Giả lập +1 ngày</button><button class="btn ai" id="aiB">🤖 AI phân tích điểm nghẽn</button><button class="btn pri" id="add">＋ Hồ sơ mới</button></div></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="kpi"><span class="l">Đang luân chuyển</span><span class="v">${S.workflow.length - doneW.length}</span></div>
      <div class="kpi"><span class="l">Quá hạn SLA</span><span class="v" style="color:var(--red)">${late.length}</span></div>
      <div class="kpi"><span class="l">Sắp đến hạn (≥75% SLA)</span><span class="v" style="color:var(--orange)">${warn.length}</span></div>
      <div class="kpi"><span class="l">Đã hoàn tất</span><span class="v" style="color:var(--green)">${doneW.length}</span></div>
    </div>
    ${late.length ? `<div class="task" style="border-color:#f19b7b;background:#fff6f2;margin-bottom:12px"><h5>🚨 Cảnh báo điểm nghẽn</h5>${late.map((w) => `<p>• <b>${w.id}</b> ${esc(w.title)} — tồn tại <b>${esc(laneOf(w.route[w.at]).name)}</b> ${w.days}/${w.sla} ngày (vượt ${w.days - w.sla} ngày). Đã tự động gửi nhắc việc.</p>`).join('')}</div>` : ''}
    <div class="lanes">
      ${LANES.map((l) => `<div class="lane"><div class="lane-h" style="background:${l.color}">${esc(l.name)}</div><div class="lane-b">
        ${S.workflow.filter((w) => w.at < w.route.length && w.route[w.at] === l.id).map(token).join('') || '<span class="small muted" style="padding:6px">— Không có hồ sơ chờ xử lý —</span>'}
      </div></div>`).join('')}
    </div>
    ${doneW.length ? `<p class="small muted" style="margin-top:8px">✅ Đã hoàn tất: ${doneW.map((w) => `${w.id} (${esc(w.title)})`).join(' · ')}</p>` : ''}
  </section>
  <section class="panel"><div class="ph"><div><div class="kicker">Cấu hình theo tenant (tỉnh/thành)</div><h3>Ánh xạ 7 làn BPMN ↔ cơ quan & SLA</h3><p>Mỗi tỉnh/thành là một tenant có bảng cơ quan – SLA riêng. SLA là cấu hình demo, cần xác minh thời hạn pháp định.</p></div>
      <select id="agTen">${TENANTS.map((t) => `<option value="${t.id}" ${t.id === (mapTenant || S.project.tenant) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <table class="tb"><tr><th>Làn</th><th>Cơ quan (chính quyền 2 cấp)</th><th>Căn cứ thẩm quyền</th><th>SLA</th></tr>${agencyMap(mapTenant || S.project.tenant).map((a) => `<tr><td><b style="color:${laneOf(a.lane).color}">${esc(laneOf(a.lane).short)}</b></td><td>${esc(a.agency)}</td><td class="small">${esc(a.basis)}</td><td>${a.sla} ngày</td></tr>`).join('')}</table></section>
  <div class="grid g2">
    <section class="panel"><div class="ph"><div><div class="kicker">Luồng chuẩn AIPM OS</div><h3>Các bước BPMN tham chiếu</h3></div></div>
      <table class="tb"><tr><th>#</th><th>Làn</th><th>Hoạt động</th><th>Quyết định</th></tr>${DATA.bpmn.map((b) => `<tr><td>${b.order}</td><td class="small"><b>${esc(b.lane)}</b></td><td class="small">${esc(b.action)}<div class="muted">Vào: ${b.input.map(esc).join(', ')} → Ra: ${b.output.map(esc).join(', ')}</div></td><td class="small">◇ ${esc(b.decision)}</td></tr>`).join('')}</table></section>
    <section class="panel"><div class="ph"><div><div class="kicker">RACI Matrix</div><h3>Trách nhiệm theo cổng</h3></div></div>
      <div class="scroll" style="max-height:520px"><table class="tb raci"><tr><th>Gate</th>${DATA.raciRoles.map((r) => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:110px">${esc(r)}</th>`).join('')}</tr>
      ${DATA.raci.map((r) => `<tr><td><b>${r.gate}</b> <span class="small muted">${esc(r.name)}</span></td>${DATA.raciRoles.map((k) => `<td><span class="rc ${r[k]}">${r[k] || ''}</span></td>`).join('')}</tr>`).join('')}</table></div>
      <p class="small muted">R = thực hiện · A = chịu trách nhiệm cuối cùng · C = phối hợp/lấy ý kiến · I = thông tin/báo cáo.</p></section>
  </div>`;
  root.querySelector('#agTen').onchange = (e) => { mapTenant = e.target.value; draw(); };
  root.querySelector('#tick').onclick = () => setState((s) => s.workflow.forEach((w) => { if (w.at < w.route.length) w.days++; }));
  root.querySelector('#aiB').onclick = () => openCopilot('Phân tích các điểm nghẽn hiện tại trong luồng BPMN, nguyên nhân và đề xuất cách tháo gỡ cho từng hồ sơ quá hạn SLA');
  root.querySelector('#add').onclick = () => setState((s) => s.workflow.push({ id: 'HS-' + (110 + s.workflow.length), title: 'Hồ sơ đề nghị thẩm định thiết kế cơ sở', gate: 'G5', route: ['TV', 'CDT', 'SXD', 'PCCC', 'UB'], at: 0, days: 0, sla: 10, created: todayISO(), log: [], tenant: s.project.tenant, ward: s.project.ward, ubLevel: 'tỉnh', loc: [900, -540] }));
  root.querySelectorAll('[data-next]').forEach((b) => (b.onclick = () => move(b.dataset.next, +1)));
  root.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => move(b.dataset.back, -1)));
}

function token(w) {
  const late = w.days > w.sla, warn = !late && w.days >= w.sla * 0.75;
  const pctv = Math.min(100, Math.round((w.days / w.sla) * 100));
  return `<div class="token ${late ? 'late' : warn ? 'warn' : ''}">
    <div class="row" style="justify-content:space-between"><b>${w.id}</b><span class="badge blue">${w.gate}</span></div>
    <div>${esc(w.title)}</div>
    ${w.ward ? `<a class="loc-chip" href="#map?focus=${w.tenant}&view=province${w.loc ? `&loc=${w.loc.map(Math.round).join(',')}` : ''}">📍 ${esc(w.ward)}</a>` : ''}
    <div class="route">${w.route.map((r, i) => `<i class="${i < w.at ? 'past' : i === w.at ? 'cur' : ''}">${esc(laneOf(r).short)}${r === 'UB' ? ` ${w.ubLevel === 'xã' ? 'xã' : 'tỉnh'}` : ''}</i>`).join('<span class="small">›</span>')}</div>
    <div class="bar ${late ? 'o' : 'g'}"><i style="width:${pctv}%;${late ? 'background:#ef4444' : ''}"></i></div>
    <div class="row small" style="justify-content:space-between"><span>SLA: ${w.days}/${w.sla} ngày ${late ? '🚨' : warn ? '⚠️' : ''}</span>
      <span class="row" style="gap:4px"><button class="btn sm" data-back="${w.id}" title="Yêu cầu bổ sung">↩</button><button class="btn sm pri" data-next="${w.id}">${w.at === w.route.length - 1 ? 'Hoàn tất ✓' : 'Chuyển →'}</button></span></div>
    ${w.log.length ? `<div class="small muted">${esc(w.log[w.log.length - 1])}</div>` : ''}
  </div>`;
}

function move(id, d) {
  setState((s) => {
    const w = s.workflow.find((x) => x.id === id);
    const from = laneOf(w.route[w.at]).short;
    if (d < 0) { w.log.push(`↩ ${from} yêu cầu bổ sung → trả về ${laneOf(w.route[0]).short}`); w.at = 0; }
    else { w.at++; w.log.push(w.at >= w.route.length ? `✓ Hoàn tất tại ${from}` : `→ ${from} chuyển ${laneOf(w.route[w.at]).short}`); }
    w.days = 0;
  });
  toast(d < 0 ? 'Đã trả hồ sơ yêu cầu bổ sung (AI ghi nhật ký & nhắc việc)' : 'AI đã định tuyến hồ sơ sang chủ thể tiếp theo', 'ok');
}
