import { getState, setState, DOC_TYPES, LANES, DATA, gateStatus } from '../store.js';
import { estimateWorkbook } from '../lib/xlsx.js';
import { esc, toast, download, sleep, todayISO, viDate, modal } from '../lib/util.js';
import { generateDoc, contextText } from '../lib/docgen.js';
import { legalScan, LEGAL_RULES, formatCheck, askClaude, aiOnline, ruleStatus, isIssue, STATUS_LABEL, STATUS_TONE, legalFix } from '../lib/ai.js';
import { md } from '../copilot.js';

let root, curId = null, src = 'new';

export function render(el) {
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  if (qs.get('type')) {
    const type = qs.get('type');
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
  root.innerHTML = `
  <div class="docs">
    <div class="col no-print">
      <section class="panel">
        <div class="ph"><div><div class="kicker">Phân hệ 3</div><h3>AI Khởi tạo Hồ sơ</h3><p>Số liệu tự trích xuất từ mô hình 3D/Quy hoạch → điền vào Form mẫu chuẩn.</p></div></div>
        <label class="f">Biểu mẫu nguồn<select id="src"><option value="new" ${src === 'new' ? 'selected' : ''}>Mẫu cập nhật 2026</option><option value="old" ${src === 'old' ? 'selected' : ''}>Mẫu lưu trữ 2021 (căn cứ cũ — để thử AI Pháp lý)</option></select></label>
        <div class="col" style="margin-top:10px">
          <button class="btn ai" id="bundle" style="white-space:normal;text-align:left">⚡ AI Khởi tạo bộ hồ sơ từ Digital Twin (Chủ trương + Dự toán + ĐTM + Excel)</button>
          <button class="btn" id="xlsAll" style="justify-content:flex-start">📊 Xuất Excel Dự toán (6 sheet, công thức sống)</button>
          ${Object.entries(DOC_TYPES).map(([k, t]) => `<button class="btn" data-new="${k}" style="justify-content:flex-start;white-space:normal;text-align:left">${t.icon} ${esc(t.name)} ${t.gate !== '*' ? `<span class="badge blue">${t.gate}</span>` : ''}</button>`).join('')}
        </div>
      </section>
      <section class="panel doc-list">
        <h4 style="margin-bottom:8px">Hồ sơ đã khởi tạo (${S.docs.length})</h4>
        <div class="col">${S.docs.slice().reverse().map((d) => `<div class="it ${d.id === curId ? 'on' : ''}" data-id="${d.id}"><b class="small">${esc(d.title)}</b><span class="small muted">${d.id} · ${viDate(d.createdAt)} ${d.legalIssues ? `<span class="badge red">⚖ ${d.legalIssues}</span>` : '<span class="badge green">⚖ OK</span>'}${d.routed ? ' <span class="badge blue">đã luân chuyển</span>' : ''}</span></div>`).join('') || '<p class="small muted">Chưa có hồ sơ.</p>'}</div>
      </section>
    </div>
    <div class="paper-col">
      ${doc ? `<div class="row no-print" style="margin-bottom:10px"><b class="grow">${esc(doc.title)}</b>
        <button class="btn sm" id="save">💾 Lưu chỉnh sửa</button><button class="btn sm" id="word">⬇ Word (.doc)</button><button class="btn sm" id="print">🖨 In / PDF</button><button class="btn sm" id="xls">📊 Excel dự toán</button><button class="btn sm pri" id="route">🔀 Gửi luân chuyển (BPMN)</button><button class="btn sm ok" id="valid" title="Demo 4: tích checklist, mở cổng, chuyển làn BPMN">✅ Xác nhận hợp lệ & liên thông</button><button class="btn sm danger" id="del">🗑</button></div>
      <div class="paper-wrap"><div id="paper">${doc.html}</div></div>
      <p class="small muted no-print">✎ Văn bản có thể chỉnh sửa trực tiếp. Sau khi sửa, bấm "Kiểm tra lại" ở cột phải.</p>`
      : `<section class="panel"><h3>Chọn một biểu mẫu bên trái để AI khởi tạo hồ sơ</h3><p class="muted">Gợi ý: phát hành dataset, chọn phương án và ghi nhận phép tính có nguồn trên <a href="#twin">Digital Twin</a> trước. Trường thiếu dữ liệu sẽ được đánh dấu, không tự điền số giả.</p><div class="disclaimer">${esc(contextText(S)).replace(/\n/g, '<br>')}</div></section>`}
    </div>
    <div class="col no-print">
      ${doc ? `<section class="panel"><div class="ph"><div><div class="kicker">Kiểm tra trước khi xác nhận</div><h3>AI kiểm tra thể thức & pháp lý</h3></div><button class="btn sm" id="recheck">↻ Kiểm tra lại</button></div><div id="checks"></div></section>
      <section class="panel"><div class="ph"><div><div class="kicker">AI soạn thảo</div><h3>Viết thêm / chỉnh đoạn văn</h3></div></div>
        <textarea id="aiq" rows="3">Viết đoạn thuyết minh "Sự cần thiết đầu tư" (khoảng 150 chữ) dựa trên số liệu dự án.</textarea>
        <div class="row" style="margin-top:6px"><button class="btn ai sm" id="aigo">✨ AI viết & chèn vào cuối văn bản</button><span class="small muted">${aiOnline() ? 'Claude API' : 'offline'}</span></div><div id="aiout" class="small"></div></section>` : ''}
    </div>
  </div>`;
  root.querySelector('#src').onchange = (e) => (src = e.target.value);
  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => { create(b.dataset.new); setState(() => {}); draw(); }));
  root.querySelector('#bundle').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    for (const [t, l] of [['totrinh', 'Hồ sơ đề xuất chủ trương đầu tư'], ['tmdt', 'Dự toán / Sơ bộ TMĐT'], ['dtm', 'Báo cáo ĐTM']]) { b.innerHTML = `<span class="spin"></span> AI trích xuất diện tích, đào đắp, sàn xây dựng → ${l}…`; await sleep(380); create(t); }
    downloadXls();
    setState(() => {}); draw();
    toast('⚡ Đã khởi tạo 3 hồ sơ + Excel dự toán từ Digital Twin; đang chạy kiểm tra thể thức NĐ 30/2020', 'ok', 4500);
  };
  root.querySelector('#xlsAll').onclick = downloadXls;
  root.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { curId = b.dataset.id; draw(); }));
  if (!doc) return;
  const paper = root.querySelector('#paper');
  const vb = paper.querySelector('.vb');
  vb.contentEditable = 'true';
  const persist = () => {
    clearMarks(vb);
    setState((s) => { const d = s.docs.find((x) => x.id === curId); d.html = paper.innerHTML.replace(/ contenteditable="true"/, ''); d.text = vb.innerText; d.legalIssues = legalScan(d.text).filter(isIssue).length; }, true);
  };
  root.querySelector('#save').onclick = () => { persist(); toast('Đã lưu', 'ok'); checks(); };
  root.querySelector('#xls').onclick = downloadXls;
  root.querySelector('#valid').onclick = () => { persist(); validateAndLink(doc.id); };
  root.querySelector('#recheck').onclick = () => { persist(); checks(); };
  root.querySelector('#print').onclick = () => { clearMarks(vb); window.print(); };
  root.querySelector('#word').onclick = () => {
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
      const r = await askClaude(root.querySelector('#aiq').value + '\nChỉ trả về đoạn văn bản hành chính (không markdown, không mục TỰ KIỂM trong đoạn chèn; đặt TỰ KIỂM sau dòng "---").', contextText(getState()), { maxTokens: 900 });
      const [body, self] = r.text.split(/\n-{3,}\n/);
      const clean = r.offline ? 'Dự án được đánh giá sơ bộ trên cơ sở dữ liệu thiết kế và hiện trạng đa nguồn đã khai báo provenance. Các phép tính san nền và nước mặt trong demo ở mức L1, dùng để sàng lọc phương án và phải được kiểm tra bằng dữ liệu, phương pháp chuyên ngành trước khi phát hành.' : body.replace(/\*\*/g, '');
      vb.insertAdjacentHTML('beforeend', `<p>${esc(clean.trim())}</p>`);
      out.innerHTML = `<div class="msg a" style="max-width:100%">✓ Đã chèn vào cuối văn bản.${self ? '<br>' + md(self) : r.offline ? '<br><i>(offline — nhập API key để AI viết thật)</i>' : ''}</div>`;
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
  el.innerHTML = '<span class="spin"></span> AI đang kiểm tra…';
  await sleep(450);
  clearMarks(vb);
  const fc = formatCheck(vb);
  const lg = legalScan(vb.innerText);
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
    <div class="row"><span class="badge ${okF === fc.length ? 'green' : 'orange'}">Thể thức NĐ 30/2020: ${okF}/${fc.length}</span><span class="badge ${bad.length ? 'red' : 'green'}">Pháp lý: ${bad.length ? bad.length + ' cảnh báo' : 'đạt'}</span></div>
    <h4 style="margin:10px 0 4px">Thể thức văn bản</h4>${fc.map((c) => `<div class="chk"><span class="i">${c.ok ? '✅' : '❌'}</span><span>${esc(c.rule)}</span></div>`).join('')}
    <h4 style="margin:10px 0 4px">Căn cứ pháp lý</h4>${lg.map((s) => `<div class="chk"><span class="i">${s.status === 'expired' || s.status === 'violation' ? '❌' : s.status === 'verify' ? '⚠️' : s.status === 'upcoming' ? '🕒' : '✅'}</span><span><span class="badge ${STATUS_TONE[s.status]}">${STATUS_LABEL[s.status]}</span> <b>${esc(s.match)}</b> — ${esc(s.msg)}${s.replace ? ` → <b>${esc(s.replace)}</b>` : ''}${s.fix ? ` → đề xuất: <b>${esc(s.fix)}</b>` : ''}</span></div>`).join('') || '<p class="small muted">Không có trích dẫn trong CSDL demo.</p>'}
    ${lg.some((s) => (s.replace && s.status !== 'ok') || s.fix) ? '<button class="btn ai sm" id="lfix" style="margin-top:8px">✨ Cập nhật căn cứ pháp lý chuẩn & chỉnh chỉ tiêu (1 nút)</button>' : ''}
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

function downloadXls() {
  download(`DuToan_${getState().project.code}_${todayISO()}.xls`, estimateWorkbook(getState()), 'application/vnd.ms-excel');
  toast('📊 Đã xuất Excel: Tổng hợp · Tiên lượng 3D · BOM/QTO · So sánh A-B-C · Nhu cầu theo tiến độ · Giả định & cảnh báo', 'ok', 4500);
}

// Demo 4 — hồ sơ hợp lệ → tích checklist, mở cổng, chuyển làn BPMN, cập nhật dashboard bản đồ
function validateAndLink(id) {
  const S = getState(), d = S.docs.find((x) => x.id === id);
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
