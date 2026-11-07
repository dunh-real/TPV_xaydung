import './style.css';
import './map.css';
import { getState, setState, subscribe, resetState, DATA } from './store.js';
import { initCopilot, openAiSettings, refreshMode } from './copilot.js';
import { modal, toast, esc } from './lib/util.js';
import * as overview from './views/overview.js';
import * as stagegate from './views/stagegate.js';
import * as lookup from './views/lookup.js';
import * as bpmn from './views/bpmn.js';
import * as checklist from './views/checklist.js';
import * as legal from './views/legal.js';
import * as twin from './views/twin-v2.js';
import * as docs from './views/docs.js';
import * as timeline from './views/timeline.js';
import * as mapView from './views/map.js';
import * as cadView from './views/cad.js';
import './cad.css';

const ROUTES = [
  { id: 'hero', label: 'Tổng quan', icon: '🏠', mod: overview },
  { id: 'map', label: 'Bản đồ 3D', icon: '🗺️', mod: mapView, isNew: true },
  { id: 'stage-gate', label: 'Stage-Gate', icon: '🚦', mod: stagegate },
  { id: 'lookup', label: 'Tra cứu', icon: '🔎', mod: lookup },
  { id: 'bpmn', label: 'Phối hợp', icon: '🔀', mod: bpmn },
  { id: 'checklist', label: 'Checklist', icon: '☑️', mod: checklist },
  { id: 'legal', label: 'Pháp lý', icon: '⚖️', mod: legal },
  { sep: true },
  { id: 'twin', label: 'Digital Twin', icon: '🧊', mod: twin, isNew: true },
  { id: 'cad', label: 'CAD & Kết cấu', icon: '📐', mod: cadView, isNew: true },
  { id: 'docs', label: 'Hồ sơ AI', icon: '📝', mod: docs, isNew: true },
  { id: 'timeline', label: 'Timeline 4D', icon: '📅', mod: timeline, isNew: true },
];

const app = document.getElementById('app');
app.innerHTML = `
<header class="topbar"><div class="topbar-in">
  <a class="brand" href="#hero"><div class="brand-mark">AI</div><div><b>AIPM OS × AI Digital Twin</b><span>Hệ điều hành số Quản trị dự án – 2026</span></div></a>
  <nav class="nav" id="nav">${ROUTES.map((r) => (r.sep ? '<span class="sep"></span>' : `<a href="#${r.id}" data-r="${r.id}" class="${r.isNew ? 'new' : ''}">${r.icon} ${r.label}</a>`)).join('')}</nav>
  <div class="spacer"></div>
  <button class="tb-btn" id="aiStatus" title="Cài đặt AI"></button>
  <button class="tb-btn" id="projBtn" title="Thông tin dự án">📁 Dự án</button>
</div></header>
<div class="legalbar"><div>
  <span>⚖ <b>Mốc pháp lý áp dụng:</b> ${esc(DATA.metadata.legalBaseline)} · <i>Áp dụng không hồi tố</i></span>
  <span class="spacer"></span>
  <span id="projName" class="muted"></span>
</div></div>
<main class="wrap" id="view"></main>
<div class="foot">AIPM OS × AI Digital Twin (v2.0 toàn quốc) — Bản demo đề xuất hợp tác · Công ty TNHH Khoa học Công nghệ Bình Phúc · Dữ liệu khung AIPM OS cần đối soát trước khi chốt baseline; kết quả kỹ thuật luôn hiển thị mức L0–L3 — <b>AI đề xuất, Kỹ sư quyết định</b>.</div>`;

initCopilot();
document.getElementById('aiStatus').onclick = openAiSettings;
document.getElementById('projBtn').onclick = projectDialog;
refreshMode();

let current = null, cleanup = null;
function route() {
  const id = (location.hash || '#hero').slice(1).split('?')[0];
  const r = ROUTES.find((x) => x.id === id) || ROUTES[0];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === r.id));
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
  current = r;
  const v = document.getElementById('view');
  v.innerHTML = '';
  cleanup = r.mod.render(v) || null;
  window.scrollTo(0, 0);
  header();
}
function header() {
  document.getElementById('projName').textContent = `📁 ${getState().project.name} · ${getState().project.code}`;
}
subscribe(() => {
  header();
  if (current?.mod.update) current.mod.update();
});
window.addEventListener('hashchange', route);
route();

function projectDialog() {
  const p = getState().project;
  const f = (k, l) => `<label class="f">${l}<input type="text" data-k="${k}" value="${esc(p[k])}"></label>`;
  modal({
    title: '📁 Thông tin dự án áp dụng thí điểm',
    body: `<div class="grid g2">${f('name', 'Tên dự án')}${f('code', 'Mã dự án')}${f('owner', 'Chủ đầu tư / Ban QLDA')}${f('decider', 'Người quyết định đầu tư')}${f('location', 'Địa điểm')}${f('ward', 'Xã/phường (MOD-00)')}${f('maDvhc', 'Mã ĐVHC')}${f('appraisalDate', 'Ngày thẩm định dự kiến (YYYY-MM-DD)')}${f('group', 'Nhóm dự án')}${f('category', 'Loại công trình')}${f('capital', 'Nguồn vốn')}</div>
    <p class="small muted" style="margin-top:12px">Thông tin này được AI tự điền vào mọi hồ sơ, tờ trình, biên bản. Nút "Khôi phục dữ liệu demo" xóa toàn bộ tiến trình đã thao tác.</p>`,
    actions: [
      { label: '↺ Khôi phục dữ liệu demo', cls: 'btn danger', onClick: () => { if (confirm('Xóa toàn bộ trạng thái demo?')) { resetState(); route(); toast('Đã khôi phục dữ liệu demo'); } } },
      { label: 'Lưu', cls: 'btn pri', onClick: (w) => { setState((s) => w.querySelectorAll('[data-k]').forEach((i) => (s.project[i.dataset.k] = i.value))); toast('Đã cập nhật thông tin dự án', 'ok'); } },
    ],
  });
}
