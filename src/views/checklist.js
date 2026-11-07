import { getState, setState, DATA, overallChecklist } from '../store.js';
import { esc, pct, toast, modal, sleep } from '../lib/util.js';
import { docForGate } from './lookup.js';

let root, gate = '', hideDone = false, critOnly = false, q = '';
const open = new Set();

export function render(el) {
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  if (qs.get('gate')) { gate = qs.get('gate'); open.add(gate); }
  if (!open.size) open.add('G0');
  draw();
}
export function update() { if (root?.isConnected) list(); }

function draw() {
  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">Checklist hồ sơ tương tác + AI Trợ lý Hồ sơ</div><h2>${DATA.checklists.length} mục trong cấu hình hiện tại · ${DATA.gates.length} cổng</h2><a class="loc-chip" href="#map?focus=${getState().project.tenant}&view=province&sel=${getState().project.code}">📍 ${esc(getState().project.ward)} · ${esc(getState().project.location.split(',').pop().trim())} — xem trên Bản đồ 3D</a>
      <p>Mẫu số được tính theo các mục áp dụng của phiên bản cấu hình; cần đối soát trước baseline. Mỗi mục phải có minh chứng hoặc dự thảo được kiểm tra và xác nhận.</p></div>
      <div class="col" style="min-width:240px"><b id="tot"></b><div class="bar g"><i id="totbar"></i></div></div></div>
    <div class="filters">
      <input type="text" id="q" placeholder="Tìm hồ sơ…" style="width:240px" value="${esc(q)}">
      <select id="gate"><option value="">Tất cả Gate</option>${DATA.gates.map((g) => `<option value="${g.id}" ${gate === g.id ? 'selected' : ''}>${g.id} – ${esc(g.name)}</option>`).join('')}</select>
      <label class="row small"><input type="checkbox" id="hd" ${hideDone ? 'checked' : ''}> Ẩn hồ sơ đã hoàn thành</label>
      <label class="row small"><input type="checkbox" id="co" ${critOnly ? 'checked' : ''}> Chỉ hồ sơ trọng yếu</label>
      <span class="spacer"></span>
      <button class="btn danger sm" id="clr">Xóa tích chọn</button>
    </div>
    <div id="list"></div>
  </section>`;
  root.querySelector('#q').oninput = (e) => { q = e.target.value.toLowerCase(); list(); };
  root.querySelector('#gate').onchange = (e) => { gate = e.target.value; if (gate) open.add(gate); list(); };
  root.querySelector('#hd').onchange = (e) => { hideDone = e.target.checked; list(); };
  root.querySelector('#co').onchange = (e) => { critOnly = e.target.checked; list(); };
  root.querySelector('#clr').onclick = () => { if (confirm('Xóa toàn bộ tích chọn checklist?')) setState((s) => (s.checklist = {})); };
  list();
}

function list() {
  const S = getState();
  const o = overallChecklist();
  root.querySelector('#tot').textContent = `Hoàn thành ${o.done}/${o.total} (${pct(o.done, o.total)}%)`;
  root.querySelector('#totbar').style.width = pct(o.done, o.total) + '%';
  const gates = DATA.gates.filter((g) => !gate || g.id === gate);
  root.querySelector('#list').innerHTML = gates.map((g) => {
    const items = DATA.checklists.filter((c) => c.gate === g.id && (!hideDone || !S.checklist[c.id]?.done) && (!critOnly || c.critical) && (!q || (c.item + c.group).toLowerCase().includes(q)));
    const all = DATA.checklists.filter((c) => c.gate === g.id);
    const done = all.filter((c) => S.checklist[c.id]?.done).length;
    if (!items.length && (q || hideDone || critOnly)) return '';
    const isOpen = open.has(g.id);
    return `<div class="cl-group"><div class="cl-gh" data-t="${g.id}"><span>${isOpen ? '▾' : '▸'}</span><span>${g.icon} ${g.id} – ${esc(g.name)}</span><span class="spacer"></span>
      <span class="badge ${done === all.length ? 'green' : 'gray'}">${done}/${all.length}</span><div class="bar g" style="width:120px"><i style="width:${pct(done, all.length)}%"></i></div></div>
      ${isOpen ? items.map((c) => row(c, S.checklist[c.id] || {})).join('') : ''}</div>`;
  }).join('');
  root.querySelectorAll('[data-t]').forEach((h) => (h.onclick = () => { const id = h.dataset.t; open.has(id) ? open.delete(id) : open.add(id); list(); }));
  root.querySelectorAll('[data-done]').forEach((b) => (b.onclick = () => toggle(b.dataset.done)));
  root.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => upload(b.dataset.up)));
  root.querySelectorAll('[data-draft]').forEach((b) => (b.onclick = () => draft(b.dataset.draft)));
  root.querySelectorAll('[data-chk]').forEach((b) => (b.onclick = () => aiCheck(b.dataset.chk, b)));
}

function row(c, s) {
  return `<div class="cl-item ${s.done ? 'done' : ''}">
    <div class="cbx ${s.done ? 'on' : ''}" data-done="${c.id}" title="Xác nhận hoàn thành">${s.done ? '✓' : ''}</div>
    <div><div class="cl-t">${esc(c.item)}</div>
      <div class="cl-meta"><span class="badge gray">${c.id}</span>${c.critical ? '<span class="badge red">Trọng yếu</span>' : ''}<span class="badge">Lập: ${esc(c.preparedBy)}</span><span class="badge">Kiểm: ${esc(c.checkedBy)}</span>
      ${s.file ? `<span class="badge blue">📎 ${esc(s.file)}</span>` : ''}${s.draft ? '<span class="badge violet">✨ Dự thảo AI</span>' : ''}${s.ai === 'pass' ? '<span class="badge green">🤖 Đạt quy cách & pháp lý</span>' : s.ai === 'warn' ? '<span class="badge orange">🤖 Cần bổ sung</span>' : ''}${s.by ? `<span class="badge gray">Xác nhận: ${esc(s.by)}</span>` : ''}</div></div>
    <div class="lk-actions"><button class="btn sm" data-up="${c.id}">📎 Tải lên</button><button class="btn sm ai" data-draft="${c.id}">✨ Tạo dự thảo AI</button><button class="btn sm" data-chk="${c.id}">🤖 AI kiểm tra</button></div>
  </div>`;
}

function upload(id) {
  const i = document.createElement('input');
  i.type = 'file';
  i.onchange = () => { const f = i.files[0]; if (f) { setState((s) => (s.checklist[id] = { ...(s.checklist[id] || {}), file: f.name, ai: undefined })); toast(`Đã đính kèm "${esc(f.name)}" — hãy chạy AI kiểm tra`, 'ok'); } };
  i.click();
}
function draft(id) {
  const c = DATA.checklists.find((x) => x.id === id);
  const t = docForGate(c.gate);
  setState((s) => (s.checklist[id] = { ...(s.checklist[id] || {}), draft: true, ai: undefined }), true);
  location.hash = `docs?type=${t}&item=${encodeURIComponent(c.item)}&gate=${c.gate}&to=${encodeURIComponent(c.checkedBy)}&cl=${id}`;
}
async function aiCheck(id, btn) {
  const s = getState().checklist[id] || {};
  btn.innerHTML = '<span class="spin"></span> Đang kiểm tra';
  await sleep(700);
  const ok = s.file || s.draft;
  setState((st) => (st.checklist[id] = { ...s, ai: ok ? 'pass' : 'warn' }));
  toast(ok ? '🤖 Đạt: đúng biểu mẫu, đủ trường bắt buộc, căn cứ pháp lý còn hiệu lực' : '🤖 Chưa có minh chứng (tải lên hoặc tạo dự thảo AI)', ok ? 'ok' : 'warn');
}
function toggle(id) {
  const s = getState().checklist[id] || {};
  if (s.done) return setState((st) => (st.checklist[id] = { ...s, done: false }));
  if (s.ai === 'pass') return setState((st) => (st.checklist[id] = { ...s, done: true, by: 'Chuyên viên Ban QLDA' }));
  modal({
    title: 'Chưa qua bước AI kiểm tra',
    body: `<p>Mục <b>${id}</b> chưa có kết quả <b>AI kiểm tra quy cách & pháp lý</b>. Theo quy trình đề xuất, hồ sơ cần minh chứng và được AI rà soát trước khi xác nhận hoàn thành.</p>`,
    actions: [
      { label: 'Vẫn xác nhận (ghi nhận người chịu trách nhiệm)', cls: 'btn danger', onClick: () => setState((st) => (st.checklist[id] = { ...s, done: true, by: 'Xác nhận thủ công' })) },
      { label: 'Đóng', cls: 'btn pri' },
    ],
  });
}
