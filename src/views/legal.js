import { getState, setState, DATA } from '../store.js';
import { esc, toast, sleep, todayISO } from '../lib/util.js';
import { legalScan, legalFix, LEGAL_RULES, askClaude, ruleStatus, isIssue, STATUS_LABEL, STATUS_TONE, DENSITY_LIMITS } from '../lib/ai.js';
import { openCopilot, md } from '../copilot.js';
import { contextText, generateDoc } from '../lib/docgen.js';

const DOMAINS = [
  ['Quy hoạch', ['Quy hoạch'], '🗺️'],
  ['Đấu thầu', ['Đấu thầu'], '🤝'],
  ['Hợp đồng', ['Hợp đồng xây dựng'], '📑'],
  ['Chi phí / Dự toán', ['Chi phí, định mức, dự toán', 'Đầu tư công'], '💰'],
  ['Quản lý chất lượng', ['Quản lý chất lượng', 'Xây dựng'], '🏗️'],
  ['PCCC', ['PCCC'], '🚒'],
  ['Môi trường', ['Môi trường'], '🌿'],
  ['Đất đai / GPMB', ['Đất đai, GPMB'], '🏞️'],
  ['Thanh quyết toán', ['Thanh toán, quyết toán'], '📊'],
  ['Lưu trữ / BIM', ['Lưu trữ, dữ liệu số, BIM/CDE'], '💾'],
];
// Văn bản 2026 theo SRS v2.0 mục 7.9 — gắn vào 10 lĩnh vực (MOD-05 kiểm tra lại tại thời điểm dùng)
const LAW_2026 = {
  'Quy hoạch': ['QCVN 01:2021/BXD (đến 31/12/2026)', 'QCVN 01:2026/BXD — TT 46/2026/TT-BXD, hiệu lực 01/01/2027', 'Luật Quy hoạch đô thị và nông thôn 2024'],
  'Hợp đồng': ['Nghị định 210/2026/NĐ-CP (hợp đồng xây dựng)'],
  'Chi phí / Dự toán': ['Nghị định 206/2026/NĐ-CP (thay NĐ 10/2021)', 'TT 36/2026/TT-BXD (thay TT 11/2021)', 'TT 37/2026/TT-BXD (thay TT 13/2021)', 'TT 38/2026/TT-BXD (thay TT 12/2021, hiệu lực 01/7/2026)'],
  'Quản lý chất lượng': ['Luật Xây dựng số 135/2025/QH15', 'Nghị định 217/2026/NĐ-CP', 'Nghị định 207/2026/NĐ-CP', 'TT 34/2026/TT-BXD (phân cấp công trình)'],
  'Lưu trữ / BIM': ['Nghị định 212/2026/NĐ-CP (thông tin, CSDL)', 'Luật Dữ liệu 2024', 'Luật Đo đạc và bản đồ 2018 · NĐ 27/2019/NĐ-CP'],
};
let root, demo3Html = null, audited = false;
const badge = (s) => `<span class="badge ${STATUS_TONE[s.status]}">${STATUS_LABEL[s.status]}</span>`;

export function render(el) {
  root = el;
  const S = getState();
  const at = S.project.appraisalDate || todayISO();
  const pending = DATA.legalDocuments.filter((d) => /Cần/.test(d.status));
  const allDocsText = S.docs.map((d) => d.text || '').join('\n');
  const scan = legalScan(allDocsText, at);
  if (!demo3Html) demo3Html = generateDoc('demo3', S).html;
  root.innerHTML = `
  <section class="panel">
    <div class="ph"><div><div class="kicker">MOD-05 · Thư viện Pháp lý 2026 → AI Legal Copilot</div><h2>10 lĩnh vực pháp lý cốt lõi</h2>
      <p>Cảnh báo hiệu lực theo thời điểm thẩm định dự kiến; đồ thị quan hệ THAY_THE_CHO / SUA_DOI; kiểm tra chéo hồ sơ đang soạn. <i>Không bịa số hiệu — văn bản chưa xác minh luôn được đánh dấu.</i></p></div>
      <div class="row"><label class="f">Thời điểm thẩm định dự kiến<input type="date" id="at" value="${at}"></label><button class="btn ai" id="ask">🤖 Hỏi AI pháp lý</button></div></div>
    <div class="grid g4" style="grid-template-columns:repeat(5,minmax(0,1fr))">
      ${DOMAINS.map(([n, groups, ic]) => {
        const docs = DATA.legalDocuments.filter((d) => groups.includes(d.group));
        const need = docs.filter((d) => /Cần/.test(d.status)).length;
        return `<div class="card"><span class="ic">${ic}</span><h4>${n}</h4>${(LAW_2026[n] || []).map((l) => `<div class="small"><b>${esc(l)}</b></div><span class="badge ${/đến 31\/12|hiệu lực 01\/01\/2027/.test(l) ? (/2027/.test(l) ? (at >= '2027-01-01' ? 'green' : 'blue') : (at >= '2027-01-01' ? 'orange' : 'green')) : 'green'}">${/hiệu lực 01\/01\/2027/.test(l) ? (at >= '2027-01-01' ? 'Còn hiệu lực' : 'Sắp có hiệu lực') : /đến 31\/12/.test(l) ? (at >= '2027-01-01' ? 'Hết hiệu lực tại thời điểm thẩm định' : 'Còn hiệu lực') : 'Còn hiệu lực (2026)'}</span>`).join('')}
          ${docs.map((d) => `<div class="small">${esc(d.document)}</div><span class="badge ${/Cần/.test(d.status) ? 'orange' : 'green'}">${esc(d.status)}</span><div class="small muted">Gate: ${d.gates.join(', ')}</div>`).join('')}
          <div class="row">${need ? `<span class="badge red">⚠ ${need} mục cần cập nhật</span>` : '<span class="badge green">✓ Đã rà soát</span>'}${docs[0]?.tvplLink ? `<a class="small" href="${docs[0].tvplLink}" target="_blank" rel="noopener">Tra TVPL ↗</a>` : ''}</div></div>`;
      }).join('')}
    </div>
  </section>

  <section class="panel">
    <div class="ph"><div><div class="kicker">Màn hình Demo 3 · Đội Pháp lý</div><h2>AI Kiểm toán Pháp lý 2026 — tờ trình mẫu cài sẵn 2 lỗi</h2>
      <p>Lỗi 1: trích dẫn Nghị định 10/2021/NĐ-CP (đã thay bằng NĐ 206/2026/NĐ-CP). Lỗi 2: mật độ xây dựng vượt ngưỡng quy chuẩn. Đồng thời cảnh báo QCVN 01:2026/BXD có hiệu lực 01/01/2027 và tự kiểm tra lại chỉ tiêu theo thời điểm thẩm định dự kiến.</p></div>
      <div class="row"><button class="btn pri" id="audit">⚖ AI Kiểm toán Pháp lý 2026</button><button class="btn ai" id="fix3" ${audited ? '' : 'disabled'}>✨ Cập nhật căn cứ pháp lý chuẩn (1 nút)</button><button class="btn" id="reset3">↺ Nạp lại bản lỗi</button><button class="btn" id="save3">💾 Lưu vào Hồ sơ AI</button></div></div>
    <div class="grid g2"><div class="paper-wrap" style="max-height:620px"><div id="paper3">${demo3Html}</div></div><div id="res3" class="col"><p class="small muted">Bấm "AI Kiểm toán Pháp lý 2026" để quét căn cứ và chỉ tiêu.</p></div></div>
  </section>

  <div class="grid g2">
    <section class="panel">
      <div class="ph"><div><div class="kicker">Cảnh báo thời gian thực</div><h3>Rà soát hồ sơ đang soạn thảo (${S.docs.length} hồ sơ AI)</h3></div><button class="btn sm" id="rescan">↻ Quét lại</button></div>
      ${S.docs.length ? '' : '<p class="small muted">Chưa có hồ sơ nào được khởi tạo. Hãy tạo hồ sơ ở tab <a href="#docs">Hồ sơ AI</a> (chọn "Mẫu lưu trữ 2021" để thấy AI phát hiện căn cứ hết hiệu lực).</p>'}
      ${scan.length ? `<table class="tb"><tr><th>Căn cứ / chỉ tiêu</th><th>Trạng thái</th><th>Khuyến nghị</th></tr>${scan.map((s) => `<tr><td>${esc(s.match)}</td><td>${badge(s)}</td><td class="small">${esc(s.msg)}${s.replace ? `<br>→ Thay bằng: <b>${esc(s.replace)}</b>` : ''}${s.fix ? `<br>→ Đề xuất: <b>${esc(s.fix)}</b>` : ''}</td></tr>`).join('')}</table>` : S.docs.length ? '<p class="badge green">✓ Không phát hiện căn cứ hết hiệu lực</p>' : ''}
      <h4 style="margin-top:14px">Mục chờ cập nhật trong thư viện (${pending.length})</h4>
      ${pending.map((d) => `<div class="chk"><span class="i">⚠️</span><div><b>${esc(d.group)}</b>: ${esc(d.document)} <span class="badge orange">${esc(d.status)}</span></div></div>`).join('')}
    </section>
    <section class="panel">
      <div class="ph"><div><div class="kicker">Kiểm tra chéo</div><h3>Dán đoạn văn bản để AI rà soát căn cứ pháp lý & chỉ tiêu</h3></div></div>
      <textarea id="txt" rows="8">Căn cứ Luật Đầu tư công 2019;
Căn cứ Luật Xây dựng 2014 (sửa đổi 2020);
Căn cứ Nghị định 10/2021/NĐ-CP;
Căn cứ Thông tư 12/2021/TT-BXD;
Căn cứ QCVN 01:2021/BXD;
Căn cứ Luật Đất đai số 31/2024/QH15;
Công trình cao 15 tầng, mật độ xây dựng 55%.</textarea>
      <div class="row" style="margin:8px 0"><button class="btn pri" id="scan">🔍 Rà soát</button><button class="btn ai" id="fix">✨ AI đề xuất bản sửa</button><button class="btn ai" id="deep">🤖 Phân tích sâu (Claude)</button></div>
      <div id="res"></div>
      <h4 style="margin-top:12px">Đồ thị tri thức pháp lý theo thời gian (rút gọn)</h4>
      <div class="scroll" style="max-height:300px"><table class="tb small"><tr><th>Mẫu trích dẫn</th><th>Trạng thái tại ${at.split('-').reverse().join('/')}</th><th>Quan hệ</th></tr>${LEGAL_RULES.map((r) => { const st = ruleStatus(r, at); return `<tr><td><code>${esc(r.re.source.replace(/\\/g, '').replace(/\( số\)\? \?|\(số \)\?/g, '').slice(0, 54))}</code></td><td>${badge(st)}</td><td>${st.replace ? `THAY_THE_CHO → <b>${esc(st.replace)}</b>` : esc(st.msg)}</td></tr>`; }).join('')}</table></div>
      <p class="small muted">Ngưỡng MĐXD theo tầng cao (tham số cấu hình demo, cần xác minh bảng QCVN): ${DENSITY_LIMITS.map(([f, l]) => `≤${f === Infinity ? '∞' : f} tầng: ${l}%`).join(' · ')}</p>
    </section>
  </div>`;
  root.querySelector('#at').onchange = (e) => { setState((s) => (s.project.appraisalDate = e.target.value), true); audited = false; render(root); toast(`Đã đặt thời điểm thẩm định dự kiến ${e.target.value.split('-').reverse().join('/')} — MOD-05 tính lại hiệu lực`, 'ok'); };
  root.querySelector('#ask').onclick = () => openCopilot('Rà soát căn cứ pháp lý của hồ sơ chủ trương đầu tư theo bộ văn bản 2026, chỉ ra văn bản hết hiệu lực và văn bản thay thế');
  root.querySelector('#rescan').onclick = () => { render(root); toast('Đã quét lại toàn bộ hồ sơ', 'ok'); };
  root.querySelector('#audit').onclick = audit3;
  root.querySelector('#fix3').onclick = () => {
    const vb = root.querySelector('#paper3 .vb');
    unmark(vb);
    const w = document.createTreeWalker(vb, NodeFilter.SHOW_TEXT), ns = [];
    while (w.nextNode()) ns.push(w.currentNode);
    ns.forEach((n) => { const f = legalFix(n.textContent, at); if (f !== n.textContent) n.textContent = f; });
    demo3Html = root.querySelector('#paper3').innerHTML;
    audit3(true);
    toast('AI đã cập nhật căn cứ pháp lý chuẩn & chỉ tiêu — chuyên viên pháp chế xác nhận', 'ok');
  };
  root.querySelector('#reset3').onclick = () => { demo3Html = generateDoc('demo3', getState()).html; audited = false; render(root); };
  root.querySelector('#save3').onclick = () => {
    const vb = root.querySelector('#paper3 .vb');
    unmark(vb);
    const text = vb.innerText;
    setState((s) => s.docs.push({ id: 'VB-' + Date.now().toString(36).toUpperCase(), type: 'demo3', gate: 'G5', title: 'Tờ trình thẩm định BCNCKT (Demo 3)', html: root.querySelector('#paper3').innerHTML, createdAt: todayISO(), text, legalIssues: legalScan(text, at).filter(isIssue).length }));
    toast('Đã lưu vào Hồ sơ AI', 'ok');
  };
  const res = root.querySelector('#res'), txt = root.querySelector('#txt');
  root.querySelector('#scan').onclick = () => {
    const r = legalScan(txt.value, at);
    res.innerHTML = r.length ? r.map((s) => `<div class="chk"><span class="i">${isIssue(s) ? (s.status === 'verify' ? '⚠️' : '❌') : s.status === 'upcoming' ? '🕒' : '✅'}</span><div>${badge(s)} <b>${esc(s.match)}</b> — ${esc(s.msg)}${s.replace ? ` → <b>${esc(s.replace)}</b>` : ''}${s.fix ? ` → <b>${esc(s.fix)}</b>` : ''}</div></div>`).join('') : '<p class="small muted">Không nhận diện được căn cứ nào trong CSDL demo.</p>';
  };
  root.querySelector('#fix').onclick = () => { txt.value = legalFix(txt.value, at); root.querySelector('#scan').click(); toast('AI đã thay thế các căn cứ hết hiệu lực — kỹ sư cần xác nhận', 'ok'); };
  root.querySelector('#deep').onclick = async () => {
    res.innerHTML = '<span class="spin"></span> Đang phân tích…';
    try { const r = await askClaude(`Rà soát hiệu lực các căn cứ pháp lý và chỉ tiêu sau tại thời điểm thẩm định ${at}, chỉ ra văn bản thay thế (không bịa số hiệu, ghi [Cần xác minh] khi không chắc):\n${txt.value}`, contextText(getState())); res.innerHTML = `<div class="msg a" style="max-width:100%">${md(r.text)}</div>`; }
    catch (e) { res.innerHTML = esc(e.message); }
  };
  root.querySelector('#scan').click();
  if (audited) audit3(true);
}

function unmark(vb) { vb.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent))); vb.normalize(); }

async function audit3(silent) {
  const at = getState().project.appraisalDate || todayISO();
  const vb = root.querySelector('#paper3 .vb'), out = root.querySelector('#res3');
  unmark(vb);
  if (!silent) { out.innerHTML = '<div class="task"><span class="spin"></span> MOD-05 trích xuất trích dẫn (Regex + NER) → truy vấn đồ thị hiệu lực + đối chiếu chỉ tiêu QCVN…</div>'; await sleep(700); }
  const found = legalScan(vb.innerText, at);
  const w = document.createTreeWalker(vb, NodeFilter.SHOW_TEXT), ns = [];
  while (w.nextNode()) ns.push(w.currentNode);
  for (const f of found) for (const n of ns) {
    if (!n.parentNode || n.parentNode.tagName === 'MARK') continue;
    const i = n.textContent.indexOf(f.match);
    if (i < 0) continue;
    const a = n.splitText(i); a.splitText(f.match.length);
    const mk = document.createElement('mark');
    mk.className = f.status === 'expired' || f.status === 'violation' ? 'lg-exp' : f.status === 'verify' ? 'lg-ver' : 'lg-ok';
    mk.title = f.msg; a.replaceWith(mk); mk.appendChild(a);
    break;
  }
  const errs = found.filter((f) => f.status === 'expired' || f.status === 'violation'), warns = found.filter((f) => f.status === 'verify' || f.status === 'upcoming');
  out.innerHTML = `<div class="row"><span class="badge ${errs.length ? 'red' : 'green'}">${errs.length} lỗi</span><span class="badge ${warns.length ? 'orange' : 'green'}">${warns.length} cảnh báo</span><span class="badge blue">Thời điểm thẩm định: ${at.split('-').reverse().join('/')}</span></div>
    ${found.map((f) => `<div class="task ${isIssue(f) ? '' : 'done'}"><h5>${badge(f)} ${esc(f.match)}</h5><p>${esc(f.msg)}</p>${f.replace && f.status !== 'ok' ? `<p>Văn bản đang có hiệu lực: <b>${esc(f.replace)}</b></p>` : ''}${f.fix ? `<p>Đề xuất sửa: <b>${esc(f.fix)}</b></p>` : ''}</div>`).join('')}
    <p class="small muted">Báo cáo kiểm toán pháp lý (JSON/PDF) chỉ rõ vị trí trong hồ sơ. AI đề xuất — chuyên viên pháp chế xác nhận.</p>`;
  audited = true;
  const fx = root.querySelector('#fix3');
  if (fx) fx.disabled = !found.some((f) => (f.replace && f.status !== 'ok') || f.fix);
}
