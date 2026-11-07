import { getState, setState, DATA, gateStatus, gateChecklist, GATE_REQ, reqMet, DOC_TYPES } from '../store.js';
import { esc, pct, toast, sleep, todayISO, viDate } from '../lib/util.js';

let root, sel = null;
const ICON = { passed: '✅', ready: '🔓', active: '🔒', locked: '⛔' };
const LABEL = { passed: 'Đã qua cổng', ready: 'Đủ điều kiện mở', active: 'Đang thực hiện', locked: 'Khóa – chờ cổng trước' };

export function render(el) {
  root = el;
  if (!sel) sel = DATA.gates.find((g) => gateStatus(g.id) !== 'passed')?.id || 'G0';
  draw();
}
export function update() { if (root?.isConnected) draw(); }

function draw() {
  const stages = DATA.stages.slice(0, 3);
  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">Bản đồ Stage-Gate G0–G16</div><h2>17 cổng kiểm soát + AI Gatekeeper</h2>
      <p>AI tự động khóa/mở cổng dựa trên: đủ hồ sơ trọng yếu (checklist critical) + đầu ra mô hình 3D/2D và hồ sơ AI đạt chuẩn tại cổng trước.</p></div>
      <div class="row small"><span>✅ Đã qua</span><span>🔓 Đủ điều kiện</span><span>🔒 Đang thực hiện</span><span>⛔ Khóa</span></div></div>
    ${stages.map((s) => `<div style="margin-bottom:12px"><div class="stage-tag" style="margin-bottom:6px">GIAI ĐOẠN ${s.id} — ${esc(s.name.toUpperCase())}</div>
      <div class="gates">${DATA.gates.filter((g) => g.stage === s.id).map((g) => {
        const st = gateStatus(g.id), cl = gateChecklist(g.id);
        return `<div class="gate ${st} ${sel === g.id ? 'sel' : ''}" data-g="${g.id}"><span class="st">${ICON[st]}</span><span class="gid">${g.icon} ${g.id}</span><span class="gn">${esc(g.name)}</span>
          <div class="bar ${st === 'passed' ? 'g' : ''}"><i style="width:${st === 'passed' ? 100 : pct(cl.done, cl.total)}%"></i></div><span class="small muted">${cl.done}/${cl.total} hồ sơ${(GATE_REQ[g.id] || []).length ? ' · 🧊 cần đầu ra 3D/AI' : ''}</span></div>`;
      }).join('')}</div></div>`).join('')}
  </section>
  <section class="panel" id="detail"></section>`;
  root.querySelectorAll('[data-g]').forEach((c) => (c.onclick = () => { sel = c.dataset.g; draw(); root.querySelector('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  detail();
}

function detail() {
  const el = root.querySelector('#detail');
  const g = DATA.gates.find((x) => x.id === sel);
  const st = gateStatus(g.id);
  const cl = gateChecklist(g.id);
  const reqs = GATE_REQ[g.id] || [];
  const steps = DATA.steps.filter((s) => s.gate === g.id);
  const risks = DATA.risks.filter((r) => r.gate === g.id);
  const dm = DATA.digitalMatrix.filter((d) => d.gate === g.id);
  const raci = DATA.raci.find((r) => r.gate === g.id);
  const S = getState();
  el.innerHTML = `
  <div class="ph"><div><div class="kicker">${g.icon} Cổng ${g.id} · Giai đoạn ${g.stage}</div><h2>${esc(g.name)}</h2>
    <p>Trạng thái: <b>${ICON[st]} ${LABEL[st]}</b>${S.gates[g.id]?.at ? ` · qua cổng ngày ${viDate(S.gates[g.id].at)}` : ''}</p></div>
    <div class="row">
      <button class="btn" data-go="map?focus=${S.project.tenant}&view=province&sel=${S.project.code}">📍 Vị trí dự án</button>
      <button class="btn" data-go="lookup?gate=${g.id}">🔎 ${steps.length} bước trình tự</button>
      <button class="btn" data-go="checklist?gate=${g.id}">☑️ Checklist cổng</button>
      ${st === 'passed' ? `<button class="btn danger" id="reopen">↩ Mở lại cổng</button>` : `<button class="btn ai" id="aiCheck" ${st === 'locked' ? 'disabled' : ''}>🤖 AI Gatekeeper kiểm tra</button><button class="btn ok" id="pass" ${st !== 'ready' ? 'disabled' : ''}>🔓 Xác nhận qua cổng</button>`}
    </div></div>
  <div class="grid g3">
    <div class="col">
      <h4>Điều kiện của AI Gatekeeper</h4>
      <div class="task ${cl.critDone === cl.crit ? 'done' : ''}"><h5>${cl.critDone === cl.crit ? '✅' : '⬜'} Hồ sơ trọng yếu (critical): ${cl.critDone}/${cl.crit}</h5>
        <div class="bar g"><i style="width:${pct(cl.critDone, cl.crit || 1)}%"></i></div><p>Toàn bộ checklist cổng: ${cl.done}/${cl.total}</p>
        ${cl.critDone < cl.crit && st !== 'locked' ? `<button class="btn sm ai" id="autoCl">⚡ AI soạn dự thảo & kiểm tra nhanh các hồ sơ trọng yếu</button>` : ''}</div>
      ${reqs.map((r) => { const ok = reqMet(r); return `<div class="task ${ok ? 'done' : ''}"><h5>${ok ? '✅' : '⬜'} ${esc(r.label)}${r.doc ? ' <span class="small muted">(đạt kiểm tra pháp lý MOD-05)</span>' : ''}</h5>${ok ? '' : `<button class="btn sm" data-go="${r.doc ? 'docs?type=' + r.doc : 'twin'}">${r.doc ? '📝 Tạo bằng AI' : '🧊 Thực hiện trên Digital Twin'} →</button>`}</div>`; }).join('') || '<p class="small muted">Cổng này không yêu cầu đầu ra 3D/2D riêng.</p>'}
      <div id="aiOut"></div>
    </div>
    <div class="col">
      <h4>Rủi ro & điểm kiểm soát</h4>
      ${risks.map((r) => `<div class="task"><h5><span class="badge ${r.level === 'Cao' ? 'red' : 'orange'}">${r.level}</span> ${esc(r.description)}</h5><p>↳ ${esc(r.mitigation)}</p><p class="small">Chủ trì: ${esc(r.owner)}</p></div>`).join('') || '<p class="small muted">Không có cờ rủi ro trọng yếu.</p>'}
      ${dm.map((d) => `<div class="task"><h5>💻 Chuyển đổi số: ${esc(d.content)}</h5><p>Công cụ: ${d.tools.map(esc).join(', ')} · Đầu ra: ${d.outputs.map(esc).join(', ')}</p></div>`).join('')}
    </div>
    <div class="col">
      <h4>Ma trận RACI</h4>
      ${raci ? `<table class="tb raci">${DATA.raciRoles.map((r) => `<tr><td>${esc(r)}</td><td><span class="rc ${raci[r]}">${raci[r]}</span></td></tr>`).join('')}</table><p class="small muted">R = thực hiện · A = chịu trách nhiệm cuối cùng · C = phối hợp · I = thông tin</p>` : ''}
    </div>
  </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));
  const pass = el.querySelector('#pass');
  if (pass) pass.onclick = () => { setState((s) => (s.gates[g.id] = { passed: true, at: todayISO() })); toast(`Đã qua cổng ${g.id}. Cổng tiếp theo được AI mở khóa.`, 'ok'); const n = DATA.gates[DATA.gates.findIndex((x) => x.id === g.id) + 1]; if (n) sel = n.id; };
  const re = el.querySelector('#reopen');
  if (re) re.onclick = () => setState((s) => { const i = DATA.gates.findIndex((x) => x.id === g.id); DATA.gates.slice(i).forEach((x) => delete s.gates[x.id]); });
  const ac = el.querySelector('#autoCl');
  if (ac) ac.onclick = async () => {
    ac.disabled = true;
    const crit = cl.items.filter((c) => c.critical && !S.checklist[c.id]?.done);
    for (let i = 0; i < crit.length; i++) { ac.innerHTML = `<span class="spin"></span> AI xử lý ${i + 1}/${crit.length}: ${esc(crit[i].item.slice(0, 40))}…`; await sleep(220); }
    setState((s) => crit.forEach((c) => (s.checklist[c.id] = { done: true, draft: true, ai: 'pass', by: 'AI Copilot (kỹ sư xác nhận)' })));
    toast(`AI đã tạo dự thảo & kiểm tra ${crit.length} hồ sơ trọng yếu của ${g.id}`, 'ok');
  };
  const aic = el.querySelector('#aiCheck');
  if (aic) aic.onclick = async () => {
    const out = el.querySelector('#aiOut');
    out.innerHTML = '<div class="task"><span class="spin"></span> AI Gatekeeper đang đối chiếu hồ sơ, mô hình 3D/2D và căn cứ pháp lý…</div>';
    await sleep(900);
    const miss = [];
    if (cl.critDone < cl.crit) miss.push(`${cl.crit - cl.critDone} hồ sơ trọng yếu chưa hoàn thành`);
    reqs.filter((r) => !reqMet(r)).forEach((r) => miss.push(r.label));
    const docs = S.docs.filter((d) => DOC_TYPES[d.type]?.gate === g.id);
    const legalIssues = docs.reduce((a, d) => a + (d.legalIssues || 0), 0);
    if (legalIssues) miss.push(`${legalIssues} căn cứ pháp lý hết hiệu lực/cần xác minh trong hồ sơ AI`);
    out.innerHTML = `<div class="task ${miss.length ? '' : 'done'}"><h5>${miss.length ? '🔒 Chưa đủ điều kiện mở cổng' : '🔓 Đủ điều kiện – đề xuất mở cổng'}</h5>${miss.length ? '<ul style="margin:0;padding-left:18px;font-size:12.5px">' + miss.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>' : '<p>Tất cả điều kiện đã đạt. Người có thẩm quyền xác nhận để chuyển cổng.</p>'}</div>`;
  };
}
