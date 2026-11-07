import { getState, setState, DOC_TYPES, LANES, DATA, gateStatus } from '../store.js';
import { esc, toast, download, sleep, todayISO, viDate, modal } from '../lib/util.js';
import { generateDoc, contextText } from '../lib/docgen.js';
import { legalScan, LEGAL_RULES, formatCheck, askClaude, aiOnline, ruleStatus, isIssue, STATUS_LABEL, STATUS_TONE, legalFix } from '../lib/ai.js';
import { md } from '../copilot.js';
import { REPORT_TYPES, REPORT_FIELDS, REPORT_NUMBERS, buildReportInput, emptyReportInputs, validateReportInputs } from '../lib/report-input.js';
import { reportRequest, exportReport } from '../lib/report.js';
import defaultBuilding from '../data/report-building.json';

let root, curId = null, src = 'new';
let generating = false;

async function createTemplate(type, input = buildReportInput(getState())) {
  if (type === 'estimate') return exportReport(type, input);
  const result = await reportRequest('generate', { type, input, useAI: aiOnline() });
  const d = { id: 'VB-' + Date.now().toString(36).toUpperCase(), type, title: REPORT_TYPES[type].name,
    html: result.html, text: '', createdAt: todayISO(), gate: REPORT_TYPES[type].gate,
    template: { input, sections: result.sections, model: result.model, edits: {}, extra: [], formatVersion: 2 } };
  const tmp = document.createElement('div'); tmp.innerHTML = d.html; d.text = tmp.textContent;
  d.legalIssues = legalScan(d.text).filter(isIssue).length;
  setState((s) => s.docs.push(d), true);
  curId = d.id;
  return d;
}

async function generateTemplates(types, button) {
  if (generating) return;
  generating = true;
  const label = button.textContent;
  button.disabled = true; button.textContent = 'Đang tạo hồ sơ…';
  try {
    const input = buildReportInput(getState());
    for (const type of types) await createTemplate(type, input);
    if (location.hash.startsWith('#docs')) draw();
    toast('Đã tạo theo template. Các trường thiếu được đánh dấu để bổ sung.', 'ok');
  } catch (e) { toast(esc(e.message), 'warn', 7000); if (location.hash.startsWith('#docs')) draw(); }
  finally { generating = false; button.disabled = false; button.textContent = label; }
}

function editInputs() {
  const input = buildReportInput(getState());
  modal({
    title: 'Input hồ sơ — bổ sung dữ liệu ngoài module',
    body: `<p>Số liệu từ module được gom tự động. JSON dưới đây chỉ chứa giá trị bổ sung/ghi đè; null là chưa nhập. Tỷ lệ chi phí dùng 0..1 (0.02 = 2%).</p>
      <details><summary>Danh mục trường và đơn vị</summary><p class="small">${Object.entries({ ...REPORT_FIELDS, ...REPORT_NUMBERS }).map(([k, label]) => `${esc(k)}: ${esc(label)}`).join('<br>')}<br>unit_prices: {"SN_DAO": {"value": 0, "source": "Tên công bố/nguồn và ngày"}}; các mã: SN_DAO, SN_DAP, SN_CAPDAT, GT_DUONG, TN_CONG, CN_ONG, XD_XUONG, CX_CANHQUAN.</p></details>
      <textarea id="reportInput" rows="18" style="width:100%;font-family:monospace">${esc(JSON.stringify(emptyReportInputs(getState()), null, 2))}</textarea><p id="inputError" class="small" style="color:#b91c1c"></p>
      <p class="small muted">Input tự động có ${Object.values(input.sources).filter((s) => s.status !== 'missing').length} trường có nguồn. Lưu input rồi tạo lại hồ sơ để cập nhật; bản cũ giữ snapshot.</p>`,
    actions: [{ label: 'Lưu input', cls: 'btn pri', onClick: (w) => {
      try { const inputs = validateReportInputs(JSON.parse(w.querySelector('#reportInput').value)); setState((s) => (s.report = { ...s.report, inputs }), true); draw(); toast('Đã lưu input hồ sơ', 'ok'); }
      catch (e) { w.querySelector('#inputError').textContent = e.message; return false; }
    } }],
  });
}

export function render(el) {
  // Bỏ chú thích cũ trong input và các hồ sơ đã lưu, giữ nguyên giá trị.
  const clean = (value) => JSON.stringify(value).replace(/\s*\(giả định demo(?:,[^)]*)?\)/gi, '');
  const docs = getState().docs, report = getState().report;
  if (clean(docs) !== JSON.stringify(docs) || (report && clean(report) !== JSON.stringify(report))) {
    setState((s) => { s.docs = JSON.parse(clean(s.docs)); if (s.report) s.report = JSON.parse(clean(s.report)); }, true);
  }
  // Nạp sẵn Times Square một lần; giữ input cũ để quay về dự án/Twin.
  if (!getState().report?.defaultBuildingLoaded) setState((s) => {
    const r = s.report || { inputs: {} };
    s.report = r.building ? { ...r, defaultBuildingLoaded: true } : {
      ...r, defaultBuildingLoaded: true, building: structuredClone(defaultBuilding),
      inputsBySource: { ...r.inputsBySource, project: r.inputs }, inputs: { model_scope: 'map' } };
  }, true);
  if (getState().report?.building?.building.id === defaultBuilding.building.id && getState().report.building.demoInputsVersion !== 2) {
    setState((s) => { s.report.building.demoInputs = structuredClone(defaultBuilding.demoInputs); s.report.building.demoNote = defaultBuilding.demoNote; s.report.building.demoInputsVersion = 2; }, true);
  }
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  if (qs.get('type')) {
    const type = qs.get('type');
    if (REPORT_TYPES[type]) {
      history.replaceState(null, '', '#docs'); draw();
      generateTemplates([type], root.querySelector(`[data-template="${type}"]`));
      return;
    }
    const d = create(type, { item: qs.get('item') || undefined, gate: qs.get('gate') || '', to: qs.get('to') || undefined });
    if (qs.get('cl')) setState((s) => (s.checklist[qs.get('cl')] = { ...(s.checklist[qs.get('cl')] || {}), draft: true, docId: d.id }), true);
    history.replaceState(null, '', '#docs');
  }
  if (!curId && getState().docs.length) curId = getState().docs[getState().docs.length - 1].id;
  draw();
}

function create(type, opts = {}) {
  const g = generateDoc(type, getState(), { ...opts, legacyCitations: src === 'old' });
  const d = { id: 'VB-' + Date.now().toString(36).toUpperCase(), type, title: g.title, html: g.html, createdAt: todayISO(), text: '' };
  const tmp = document.createElement('div');
  tmp.innerHTML = g.html;
  d.text = tmp.innerText || tmp.textContent;
  d.legalIssues = legalScan(d.text).filter(isIssue).length;
  d.gate = DOC_TYPES[type]?.gate;
  setState((s) => s.docs.push(d), true);
  curId = d.id;
  toast(`✨ AI đã khởi tạo "${esc(g.title)}" từ dữ liệu Digital Twin`, 'ok');
  return d;
}

function draw() {
  const S = getState();
  const doc = S.docs.find((d) => d.id === curId);
  if (doc?.template && doc.template.formatVersion !== 2) {
    root.innerHTML = '<section class="panel">Đang cập nhật định dạng hồ sơ…</section>';
    const id = doc.id;
    reportRequest('preview', { type: doc.type, ...doc.template }).then(({ html }) => {
      setState((s) => { const d = s.docs.find((x) => x.id === id); if (d) { d.html = html; d.template.formatVersion = 2; } }, true);
      if (curId === id && location.hash.startsWith('#docs')) draw();
    }).catch((e) => { root.textContent = e.message; });
    return;
  }
  root.innerHTML = `
  <div class="docs">
    <div class="col no-print">
      <section class="panel">
        <div class="ph"><div><div class="kicker">Phân hệ 3</div><h3>AI Khởi tạo Hồ sơ</h3><p>Số liệu tự trích xuất từ mô hình 3D/Quy hoạch → điền vào Form mẫu chuẩn.</p></div></div>
        <p class="small muted">Template 01 A.I.4 · 02 TT-1 · 03 ĐTM · 04 Dự toán. Dữ liệu lấy từ Dự án, Digital Twin, CAD và input bổ sung.</p>
        ${S.report?.building && S.report.inputs?.model_scope === 'map' ? `<div class="disclaimer"><b>Công trình: ${esc(S.report.building.building.name || S.report.building.building.id)}</b><br>${esc(S.report.building.location)}<br>${S.report.building.demoInputs ? 'Dữ liệu pháp lý minh họa; tên đơn vị, người ký và văn bản là hư cấu.' : 'Input của riêng công trình; bổ sung trường thiếu trước khi phát hành.'}<button class="btn sm" id="reportProject">Dùng dữ liệu dự án / Twin</button></div>` : ''}
        <div class="col" style="margin-top:10px">
          <button class="btn" id="reportInputEdit">✎ Bổ sung input hồ sơ</button><button class="btn" id="reportInputExport">⬇ Đóng gói input JSON</button>
          <button class="btn ai" id="bundle" style="white-space:normal;text-align:left">⚡ Tạo bộ hồ sơ 01–03 & Excel 04</button>
          <button class="btn" id="xlsAll" style="justify-content:flex-start">📊 Xuất Excel mẫu 04 (6 sheet)</button>
          ${Object.entries(REPORT_TYPES).map(([k, t]) => `<button class="btn" data-template="${k}" style="justify-content:flex-start;white-space:normal;text-align:left">${esc(t.name)} <span class="badge blue">${t.gate}</span></button>`).join('')}
          <details><summary>Mẫu demo cũ</summary><label class="f">Biểu mẫu nguồn<select id="src"><option value="new" ${src === 'new' ? 'selected' : ''}>Mẫu cập nhật 2026</option><option value="old" ${src === 'old' ? 'selected' : ''}>Mẫu lưu trữ 2021</option></select></label>
          ${Object.entries(DOC_TYPES).filter(([k]) => !REPORT_TYPES[k]).map(([k, t]) => `<button class="btn" data-new="${k}" style="white-space:normal;text-align:left">${t.icon} ${esc(t.name)}</button>`).join('')}</details>
        </div>
      </section>
      <section class="panel doc-list">
        <h4 style="margin-bottom:8px">Hồ sơ đã khởi tạo (${S.docs.length})</h4>
        <div class="col">${S.docs.slice().reverse().map((d) => `<div class="it ${d.id === curId ? 'on' : ''}" data-id="${d.id}"><b class="small">${esc(d.title)}</b><span class="small muted">${d.id} · ${viDate(d.createdAt)} ${d.legalIssues ? `<span class="badge red">⚖ ${d.legalIssues}</span>` : '<span class="badge green">⚖ OK</span>'}${d.routed ? ' <span class="badge blue">đã luân chuyển</span>' : ''}</span></div>`).join('') || '<p class="small muted">Chưa có hồ sơ.</p>'}</div>
      </section>
    </div>
    <div class="paper-col">
      ${doc ? `<div class="row no-print" style="margin-bottom:10px"><b class="grow" style="flex-basis:100%">${esc(doc.title)}</b>
        <button class="btn sm" id="save">💾 Lưu chỉnh sửa</button><button class="btn sm" id="word">⬇ Word (${doc.template ? '.docx' : '.doc'})</button><button class="btn sm" id="print">🖨 In / PDF</button><button class="btn sm" id="xls">📊 Excel dự toán</button><button class="btn sm pri" id="route">🔀 Gửi luân chuyển (BPMN)</button><button class="btn sm ok" id="valid" title="Demo 4: tích checklist, mở cổng, chuyển làn BPMN">✅ Xác nhận hợp lệ & liên thông</button><button class="btn sm danger" id="del">🗑</button></div>
      <div class="paper-wrap"><div id="paper">${doc.html}</div></div>
      <p class="small muted no-print">✎ Văn bản có thể chỉnh sửa trực tiếp. Sau khi sửa, bấm "Kiểm tra lại" ở cột phải.</p>`
      : `<section class="panel"><h3>Chọn một biểu mẫu bên trái để AI khởi tạo hồ sơ</h3><p class="muted">Gợi ý: phát hành dataset, chọn phương án và ghi nhận phép tính có nguồn trên <a href="#twin">Digital Twin</a> trước. Trường thiếu dữ liệu sẽ được đánh dấu, không tự điền số giả.</p><div class="disclaimer">${esc(contextText(S)).replace(/\n/g, '<br>')}</div></section>`}
    </div>
    <div class="col no-print">
      ${doc ? `<section class="panel"><div class="ph"><div><div class="kicker">Kiểm tra trước khi xác nhận</div><h3>${doc.template ? 'Dữ liệu & căn cứ hồ sơ' : 'AI kiểm tra thể thức & pháp lý'}</h3></div><button class="btn sm" id="recheck">↻ Kiểm tra lại</button></div><div id="checks"></div></section>
      <section class="panel"><div class="ph"><div><div class="kicker">AI soạn thảo</div><h3>Viết thêm / chỉnh đoạn văn</h3></div></div>
        <textarea id="aiq" rows="3">Viết đoạn thuyết minh "Sự cần thiết đầu tư" (khoảng 150 chữ) dựa trên số liệu dự án.</textarea>
        <div class="row" style="margin-top:6px"><button class="btn ai sm" id="aigo">✨ AI viết & chèn vào cuối văn bản</button><span class="small muted">${aiOnline() ? 'Qwen' : 'offline'}</span></div><div id="aiout" class="small"></div></section>` : ''}
    </div>
  </div>`;
  root.querySelector('#src').onchange = (e) => (src = e.target.value);
  root.querySelector('#reportProject')?.addEventListener('click', () => {
    setState((s) => { const r = s.report; r.inputsBySource = { ...r.inputsBySource, [r.building.building.id]: r.inputs }; r.inputs = r.inputsBySource.project || {}; r.building = null; }, true); draw();
  });
  root.querySelector('#reportInputEdit').onclick = editInputs;
  root.querySelector('#reportInputExport').onclick = () => download(`input_ho_so_${getState().project.code}.json`, JSON.stringify(buildReportInput(getState()), null, 2), 'application/json');
  root.querySelectorAll('[data-template]').forEach((b) => (b.onclick = () => generateTemplates([b.dataset.template], b)));
  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => { create(b.dataset.new); setState(() => {}); draw(); }));
  root.querySelector('#bundle').onclick = (e) => generateTemplates(['proposal', 'feasibility', 'eia', 'estimate'], e.currentTarget);
  root.querySelector('#xlsAll').onclick = downloadXls;
  root.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { curId = b.dataset.id; draw(); }));
  if (!doc) return;
  const paper = root.querySelector('#paper');
  const vb = paper.querySelector('.vb');
  vb.contentEditable = 'true';
  const persist = () => {
    clearMarks(vb);
    setState((s) => { const d = s.docs.find((x) => x.id === curId); d.html = paper.innerHTML.replace(/ contenteditable="true"/, ''); d.text = vb.innerText; d.legalIssues = legalScan(d.text).filter(isIssue).length;
      if (d.template) { d.template.edits = Object.fromEntries([...vb.querySelectorAll('[data-tp]')].map((p) => [p.dataset.tp, p.innerText])); d.template.extra = [...vb.querySelectorAll('[data-extra]')].map((p) => p.innerText); }
    }, true);
  };
  root.querySelector('#save').onclick = () => { persist(); toast('Đã lưu', 'ok'); checks(); };
  root.querySelector('#xls').onclick = () => downloadXls(doc.template?.input);
  root.querySelector('#valid').onclick = () => { persist(); validateAndLink(doc.id); };
  root.querySelector('#recheck').onclick = () => { persist(); checks(); };
  root.querySelector('#print').onclick = () => { clearMarks(vb); window.print(); };
  root.querySelector('#word').onclick = async () => {
    if (doc.template) {
      persist();
      try { await exportReport(doc.type, doc.template.input, doc.template.sections, doc.template.edits, doc.template.extra); }
      catch (e) { toast(esc(e.message), 'warn', 6000); }
      return;
    }
    clearMarks(vb);
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 3cm}body{font-family:'Times New Roman';font-size:14pt}table{border-collapse:collapse}.vb-tb td,.vb-tb th{border:1px solid #000;padding:2px 5px}.vb-head td{text-align:center;vertical-align:top}.ten-loai,.trich-yeu,.kg{text-align:center}.ky{text-align:center}</style></head><body>${vb.innerHTML}</body></html>`;
    download(`${doc.id}_${doc.type}.doc`, '﻿' + html, 'application/msword');
  };
  root.querySelector('#del').onclick = () => { if (confirm('Xóa hồ sơ này?')) { setState((s) => (s.docs = s.docs.filter((x) => x.id !== curId))); curId = null; draw(); } };
  root.querySelector('#route').onclick = () => {
    const t = DOC_TYPES[doc.type] || DOC_TYPES.congvan;
    const route = doc.type === 'dtm' ? ['TV', 'CDT', 'MT', 'UB'] : doc.type === 'nghiemthu' ? ['NT', 'TV', 'CDT'] : ['CDT', 'TV', 'SXD', 'UB'];
    setState((s) => { s.workflow.push({ id: 'HS-' + (200 + s.workflow.length), title: doc.title, gate: t.gate === '*' ? 'G1' : t.gate, route, at: 0, days: 0, sla: 7, created: todayISO(), log: ['AI tự định tuyến từ Hồ sơ AI'] }); s.docs.find((x) => x.id === curId).routed = true; });
    toast(`🔀 Đã đưa vào luồng BPMN: ${route.map((r) => LANES.find((l) => l.id === r).short).join(' → ')}`, 'ok');
    draw();
  };
  root.querySelector('#aigo').onclick = async () => {
    const out = root.querySelector('#aiout');
    out.innerHTML = '<span class="spin"></span> AI đang viết…';
    try {
      const r = await askClaude(root.querySelector('#aiq').value + '\nChỉ trả về đoạn văn bản hành chính (không markdown, không mục TỰ KIỂM trong đoạn chèn; đặt TỰ KIỂM sau dòng "---").', doc.template ? JSON.stringify({ values: doc.template.input.values, sources: doc.template.input.sources }) : contextText(getState()), { maxTokens: 900 });
      const [body, self] = r.text.split(/\n-{3,}\n/);
      const clean = r.offline ? 'Dự án được đánh giá sơ bộ trên cơ sở dữ liệu thiết kế và hiện trạng đa nguồn đã khai báo provenance. Các phép tính san nền và nước mặt trong demo ở mức L1, dùng để sàng lọc phương án và phải được kiểm tra bằng dữ liệu, phương pháp chuyên ngành trước khi phát hành.' : body.replace(/\*\*/g, '');
      vb.insertAdjacentHTML('beforeend', `<p data-extra="true">${esc(clean.trim())}</p>`);
      out.innerHTML = `<div class="msg a" style="max-width:100%">✓ Đã chèn vào cuối văn bản.${self ? '<br>' + md(self) : r.offline ? '<br><i>(mô phỏng offline)</i>' : ''}</div>`;
      persist();
    } catch (e) { out.textContent = e.message; }
  };
  checks();
}

function clearMarks(vb) { vb.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent))); vb.normalize(); }

async function checks() {
  const el = root.querySelector('#checks');
  if (!el) return;
  const vb = root.querySelector('#paper .vb');
  const id = curId;
  el.innerHTML = '<span class="spin"></span> AI đang kiểm tra…';
  await sleep(450);
  if (curId !== id || !vb.isConnected) return;
  clearMarks(vb);
  const fc = formatCheck(vb);
  const lg = legalScan(vb.innerText);
  const doc = getState().docs.find((d) => d.id === curId);
  const missing = doc?.template?.input.missing[doc.type] || [];
  // tô màu căn cứ trong văn bản
  const walker = document.createTreeWalker(vb, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const markers = LEGAL_RULES.map((r) => ({ re: r.re, ...ruleStatus(r) })).concat(lg.filter((x) => x.status === 'violation').map((x) => ({ re: new RegExp(x.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ...x })));
  for (const r of markers) for (const n of nodes) {
    r.re.lastIndex = 0;
    const m = r.re.exec(n.textContent);
    if (m && n.parentNode && n.parentNode.tagName !== 'MARK') {
      const after = n.splitText(m.index);
      after.splitText(m[0].length);
      const mk = document.createElement('mark');
      mk.className = r.status === 'expired' || r.status === 'violation' ? 'lg-exp' : r.status === 'verify' ? 'lg-ver' : 'lg-ok';
      mk.title = r.msg;
      after.replaceWith(mk);
      mk.appendChild(after);
    }
  }
  const bad = lg.filter(isIssue);
  const okF = fc.filter((c) => c.ok).length;
  el.innerHTML = `
    ${doc?.template ? `<p class="small">Template ${esc(doc.title)} · ${doc.template.model ? 'Diễn giải dự thảo bởi ' + esc(doc.template.model) : 'Điền dữ liệu, không gọi LLM'}.</p><p class="small">Bản xem trước dùng HTML; file Word giữ bố cục từ template gốc.</p><p class="small">Input thiếu (${missing.length}): ${missing.map(esc).join(', ') || 'không'}. Các mục [Cần bổ sung] trong văn bản vẫn cần rà soát.</p><p class="small muted">${doc.template.input.warnings.map(esc).join('<br>')}</p>` : ''}
    <div class="row">${doc?.template ? '<span class="badge blue">Bố cục: từ template Word</span>' : `<span class="badge ${okF === fc.length ? 'green' : 'orange'}">Kiểm tra HTML sơ bộ: ${okF}/${fc.length}</span>`}<span class="badge ${bad.length ? 'red' : 'green'}">Quy tắc pháp lý demo: ${bad.length} cảnh báo</span></div>
    ${doc?.template ? '' : `<h4 style="margin:10px 0 4px">Thể thức văn bản</h4>${fc.map((c) => `<div class="chk"><span class="i">${c.ok ? '✅' : '❌'}</span><span>${esc(c.rule)}</span></div>`).join('')}`}
    <h4 style="margin:10px 0 4px">Căn cứ pháp lý</h4>${lg.map((s) => `<div class="chk"><span class="i">${s.status === 'expired' || s.status === 'violation' ? '❌' : s.status === 'verify' ? '⚠️' : s.status === 'upcoming' ? '🕒' : '✅'}</span><span><span class="badge ${STATUS_TONE[s.status]}">${STATUS_LABEL[s.status]}</span> <b>${esc(s.match)}</b> — ${esc(s.msg)}${s.replace ? ` → <b>${esc(s.replace)}</b>` : ''}${s.fix ? ` → đề xuất: <b>${esc(s.fix)}</b>` : ''}</span></div>`).join('') || '<p class="small muted">Không có trích dẫn trong CSDL demo.</p>'}
    ${!doc?.template && lg.some((s) => (s.replace && s.status !== 'ok') || s.fix) ? '<button class="btn ai sm" id="lfix" style="margin-top:8px">✨ Cập nhật căn cứ pháp lý chuẩn & chỉnh chỉ tiêu (1 nút)</button>' : ''}
    <p class="small muted" style="margin-top:8px">Đỏ: hết hiệu lực · Vàng: cần xác minh · Xanh: còn hiệu lực. AI đề xuất — chuyên viên pháp chế xác nhận.</p>`;
  setState((s) => { const d = s.docs.find((x) => x.id === curId); if (d) d.legalIssues = bad.length; }, true);
  const lf = el.querySelector('#lfix');
  if (lf) lf.onclick = () => {
    clearMarks(vb);
    const walker2 = document.createTreeWalker(vb, NodeFilter.SHOW_TEXT);
    const tn = [];
    while (walker2.nextNode()) tn.push(walker2.currentNode);
    tn.forEach((n) => { const fixed = legalFix(n.textContent); if (fixed !== n.textContent) n.textContent = fixed; });
    setState((s) => { const d = s.docs.find((x) => x.id === curId); d.html = root.querySelector('#paper').innerHTML.replace(/ contenteditable="true"/, ''); d.text = vb.innerText; }, true);
    toast('AI đã cập nhật căn cứ pháp lý 2026 và chỉ tiêu — chuyên viên pháp chế xác nhận', 'ok');
    checks();
  };
}

async function downloadXls(input) {
  try { await exportReport('estimate', input?.schemaVersion ? input : buildReportInput(getState())); toast('Đã xuất mẫu 04 XLSX, giữ công thức. Ô thiếu được ghi chú trong file.', 'ok'); }
  catch (e) { toast(esc(e.message), 'warn', 6000); }
}

// Demo 4 — hồ sơ hợp lệ → tích checklist, mở cổng, chuyển làn BPMN, cập nhật dashboard bản đồ
function validateAndLink(id) {
  const S = getState(), d = S.docs.find((x) => x.id === id);
  if (d.template && ((d.template.input.missing[d.type] || []).length || /\[Cần bổ sung:|\[Cần đối chiếu/.test(d.text))) return toast('Hồ sơ template còn thiếu dữ liệu/xác minh. Bổ sung input và tạo lại hồ sơ trước khi xác nhận.', 'warn', 5000);
  const issues = legalScan(d.text).filter(isIssue);
  if (issues.length) return toast(`Chưa thể xác nhận: còn ${issues.length} cảnh báo pháp lý/chỉ tiêu. Dùng nút "Cập nhật căn cứ pháp lý chuẩn" trước.`, 'warn', 4500);
  const gates = [...new Set(S.docs.filter((x) => !legalScan(x.text).some(isIssue)).map((x) => x.gate || DOC_TYPES[x.type]?.gate).filter((g) => /^G[0-3]$/.test(g)))];
  if (S.twin.dataReady && S.twin.gis) gates.push('G0');
  const moved = [];
  setState((s) => {
    s.docs.forEach((x) => { if (!legalScan(x.text).some(isIssue)) x.validated = true; });
    DATA.checklists.filter((c) => gates.includes(c.gate) && c.critical).forEach((c) => (s.checklist[c.id] = { ...(s.checklist[c.id] || {}), done: true, ai: 'pass', by: 'AI Copilot (hồ sơ hợp lệ) · kỹ sư xác nhận' }));
    s.workflow.forEach((w) => {
      if (!gates.includes(w.gate) || w.at >= w.route.length) return;
      const next = w.route.findIndex((r, i) => i > w.at && ['SXD', 'MT'].includes(r));
      if (['CDT', 'TV'].includes(w.route[w.at]) && next > 0) { const from = LANES.find((l) => l.id === w.route[w.at]).short; w.at = next; w.days = 0; w.log.push(`→ AI chuyển ${from} → ${LANES.find((l) => l.id === w.route[next]).short} (hồ sơ hợp lệ)`); moved.push(`${w.id} → ${LANES.find((l) => l.id === w.route[next]).short}`); }
    });
  });
  const order = ['G0', 'G1', 'G2', 'G3'];
  const ready = order.filter((g) => gateStatus(g) === 'ready');
  modal({
    title: '✅ Liên thông sau khi hồ sơ hợp lệ',
    body: `<div class="chk"><span class="i">☑️</span><div>Checklist: đã tích các mục trọng yếu của <b>${gates.sort().join(', ') || '—'}</b></div></div>
      <div class="chk"><span class="i">🔀</span><div>BPMN: ${moved.length ? moved.map(esc).join(' · ') : 'không có hồ sơ chờ ở làn Chủ đầu tư/Tư vấn'}</div></div>
      <div class="chk"><span class="i">🗺️</span><div>Dashboard bản đồ (MOD-00): trạng thái dự án theo tỉnh/khu vực được cập nhật</div></div>
      <div class="chk"><span class="i">🚦</span><div>Cổng đủ điều kiện mở: <b>${ready.join(', ') || 'chưa có (kiểm tra cổng trước/đầu ra Digital Twin)'}</b></div></div>
      <p class="small muted">AI Gatekeeper chỉ đề xuất. Qua cổng do người có thẩm quyền xác nhận.</p>`,
    actions: [{ label: 'Để sau', cls: 'btn' }, { label: '🔓 Người có thẩm quyền xác nhận qua cổng đủ điều kiện', cls: 'btn ok', onClick: () => {
      let n = 0;
      for (const g of order) { if (gateStatus(g) === 'ready') { setState((s) => (s.gates[g] = { passed: true, at: todayISO(), by: 'Người có thẩm quyền (demo)' }), true); n++; } }
      setState(() => {});
      toast(n ? `Đã qua ${n} cổng; Gantt Timeline và Dashboard bản đồ cập nhật` : 'Chưa có cổng đủ điều kiện', n ? 'ok' : 'warn');
    } }],
  });
  draw();
}
