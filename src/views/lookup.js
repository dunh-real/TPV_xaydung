import { DATA, DOC_TYPES, getState } from '../store.js';
import { esc } from '../lib/util.js';

let root, f = { q: '', stage: '', gate: '', risk: false }, page = 0;
const PER = 40;

// Bước nào gắn với chế độ mô phỏng 3D nào
export function twinModeForGate(g) {
  return { G0: 'data', G1: 'plan', G2: 'qto', G3: 'results', G4: 'data', G5: 'export', G6: 'export', G8: 'plan', G9: 'scenarios', G12: 'progress', G13: 'scenarios', G14: 'progress', G16: 'export' }[g] || 'plan';
}
export function docForGate(g) {
  return Object.entries(DOC_TYPES).find(([, d]) => d.gate === g)?.[0] || 'congvan';
}

export function render(el) {
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  if (qs.get('gate')) { f.gate = qs.get('gate'); page = 0; }
  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">Bảng tra cứu trình tự theo cấu hình</div><h2>${DATA.steps.length} bước hiện có — từ tra cứu sang thực thi</h2><a class="loc-chip" href="#map?focus=${getState().project.tenant}&view=province&sel=${getState().project.code}">📍 ${esc(getState().project.ward)} · ${esc(getState().project.location.split(',').pop().trim())} — xem trên Bản đồ 3D</a>
      <p>Mỗi dòng có thêm nút <b>⚡ Khởi tạo nhanh bằng AI</b> (sinh dự thảo hồ sơ) và <b>🧊 Xem mô phỏng 3D</b> (mở đúng chế độ Digital Twin cho bước đó).</p></div></div>
    <div class="filters">
      <input type="text" id="q" placeholder="Tìm bước, hồ sơ, cơ quan…" style="width:280px" value="${esc(f.q)}">
      <select id="stage"><option value="">Tất cả giai đoạn</option>${DATA.stages.map((s) => `<option value="${s.id}" ${f.stage === s.id ? 'selected' : ''}>${s.id}. ${esc(s.name)}</option>`).join('')}</select>
      <select id="gate"><option value="">Tất cả Gate</option>${DATA.gates.map((g) => `<option value="${g.id}" ${f.gate === g.id ? 'selected' : ''}>${g.id} – ${esc(g.name)}</option>`).join('')}</select>
      <label class="row small"><input type="checkbox" id="risk" ${f.risk ? 'checked' : ''}> Chỉ bước có cảnh báo rủi ro</label>
      <span class="spacer"></span><span class="badge blue" id="cnt"></span>
    </div>
    <div class="scroll" style="max-height:calc(100vh - 300px)"><table class="tb" id="tbl"></table></div>
    <div class="row" style="margin-top:10px" id="pager"></div>
  </section>`;
  const bind = (id, k, ev = 'input') => root.querySelector('#' + id).addEventListener(ev, (e) => { f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; page = 0; table(); });
  bind('q', 'q'); bind('stage', 'stage', 'change'); bind('gate', 'gate', 'change'); bind('risk', 'risk', 'change');
  table();
}

function table() {
  const q = f.q.toLowerCase();
  const rows = DATA.steps.filter((s) =>
    (!f.stage || s.stage === f.stage) && (!f.gate || s.gate === f.gate) && (!f.risk || s.riskFlags?.length) &&
    (!q || [s.id, s.stepName, s.group, ...(s.responsible || []), ...(s.appraisal || []), ...(s.approval || [])].join(' ').toLowerCase().includes(q)));
  root.querySelector('#cnt').textContent = `${rows.length} bước`;
  const view = rows.slice(page * PER, page * PER + PER);
  root.querySelector('#tbl').innerHTML = `<tr><th>Mã</th><th>Bước / hồ sơ</th><th>Gate</th><th>Chủ trì</th><th>Thẩm định / Phê duyệt</th><th>Căn cứ pháp lý</th><th>Cảnh báo</th><th style="min-width:210px">Thực thi</th></tr>` +
    view.map((s) => `<tr>
      <td class="nowrap"><b>${s.id}</b></td>
      <td><div class="lk-name">${s.icon || ''} ${esc(s.stepName)}</div><div class="small muted">${esc(s.group)}${s.conditional ? ' · <span class="badge orange">có điều kiện</span>' : ''}</div></td>
      <td><span class="badge blue">${s.gate}</span></td>
      <td class="small">${(s.responsible || []).map(esc).join('<br>')}</td>
      <td class="small">${(s.appraisal || []).map(esc).join('<br>')}${s.approval?.length ? '<br><b>PD:</b> ' + s.approval.map(esc).join(', ') : ''}</td>
      <td class="small">${(s.legalBasis || []).map((l) => `<div>${esc(l)}</div>`).join('')}</td>
      <td>${(s.riskFlags || []).map((r) => `<span class="badge red" style="margin:1px">${esc(r)}</span>`).join('')}</td>
      <td><div class="lk-actions"><button class="btn sm ai" data-ai="${s.id}">⚡ Khởi tạo nhanh bằng AI</button><button class="btn sm" data-3d="${s.gate}">🧊 Xem mô phỏng 3D</button></div></td></tr>`).join('');
  const pages = Math.ceil(rows.length / PER);
  root.querySelector('#pager').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="btn sm ${i === page ? 'pri' : ''}" data-p="${i}">${i + 1}</button>`).join('') : '';
  root.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { page = +b.dataset.p; table(); }));
  root.querySelectorAll('[data-ai]').forEach((b) => (b.onclick = () => {
    const s = DATA.steps.find((x) => x.id === b.dataset.ai);
    const t = docForGate(s.gate);
    location.hash = `docs?type=${t}&item=${encodeURIComponent(s.id + ' - ' + s.stepName)}&gate=${s.gate}&to=${encodeURIComponent((s.appraisal || [])[0] || '')}`;
  }));
  root.querySelectorAll('[data-3d]').forEach((b) => (b.onclick = () => (location.hash = `twin?mode=${twinModeForGate(b.dataset['3d'])}`)));
}
