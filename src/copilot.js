// AI Copilot (ngăn kéo bên phải) + Cài đặt AI
import { askClaude, aiCfg, saveAiCfg, MODELS, aiOnline } from './lib/ai.js';
import { contextText } from './lib/docgen.js';
import { getState } from './store.js';
import { esc, modal, toast } from './lib/util.js';

export function md(t) {
  let h = esc(t);
  // bảng
  h = h.replace(/((?:^\|.*\|\s*$\n?)+)/gm, (blk) => {
    const rows = blk.trim().split('\n').filter((r) => !/^\|\s*-+/.test(r));
    return '<table>' + rows.map((r, i) => '<tr>' + r.split('|').slice(1, -1).map((c) => (i ? `<td>${c.trim()}</td>` : `<th>${c.trim()}</th>`)).join('') + '</tr>').join('') + '</table>';
  });
  h = h.replace(/^### (.*)$/gm, '<b>$1</b>').replace(/^## (.*)$/gm, '<b>$1</b>').replace(/^# (.*)$/gm, '<b>$1</b>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/_\((.+?)\)_/g, '<i>($1)</i>');
  return h;
}

let drawer;
export function initCopilot() {
  drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.innerHTML = `
  <div class="drawer-h"><span>🤖</span><b>AI Copilot chuyên ngành Xây dựng</b><button data-x>✕</button></div>
  <div class="chat" id="chat">
    <div class="msg a">Xin chào! Tôi là AI Copilot tích hợp trong AIPM OS. Tôi đọc được dữ liệu Digital Twin, Stage-Gate, checklist và hồ sơ của dự án hiện tại.
<b>Nguyên tắc:</b> AI đề xuất – Kỹ sư quyết định. Mọi con số/điều khoản tôi đưa ra đều kèm mục <b>TỰ KIỂM</b> để bạn đối chiếu.</div>
  </div>
  <div class="pb">
    <div class="q">
      <button class="btn sm" data-q="Phân tích nguy cơ ngập úng và đề xuất cao độ san nền tối thiểu">🌧 Ngập úng</button>
      <button class="btn sm" data-q="Tối ưu khối lượng san nền đào đắp cho dự án">⛏ San nền</button>
      <button class="btn sm" data-q="Rà soát căn cứ pháp lý của hồ sơ chủ trương đầu tư, chỉ ra văn bản hết hiệu lực">⚖ Pháp lý</button>
      <button class="btn sm" data-q="Đánh giá tiến độ, chỉ ra điểm nghẽn tại các cổng Stage-Gate và luồng BPMN">⏱ Tiến độ</button>
      <button class="btn sm" data-q="Kiểm tra sơ bộ khả năng tiếp cận xe chữa cháy trên phương án quy hoạch">🚒 PCCC</button>
    </div>
    <details><summary>✍ Soạn prompt theo 4 thành phần (Bối cảnh – Nhiệm vụ – Ràng buộc – Định dạng)</summary>
      <div class="four">
        <textarea id="p1" placeholder="Bối cảnh: tôi là ai, dự án gì">Tôi là chuyên viên Ban QLDA, đang chuẩn bị hồ sơ cổng hiện tại của dự án.</textarea>
        <textarea id="p2" placeholder="Nhiệm vụ: muốn AI làm gì"></textarea>
        <textarea id="p3" placeholder="Ràng buộc: tiêu chuẩn, quy định">Theo quy định hiện hành năm 2026; không bịa số hiệu văn bản.</textarea>
        <textarea id="p4" placeholder="Định dạng đầu ra">Trình bày dạng bảng, tối đa 300 chữ.</textarea>
      </div>
      <label class="row small" style="margin-top:6px"><input type="checkbox" id="p5" checked> Yêu cầu tự kiểm: nêu giả thiết, điểm chưa chắc và trường hợp không áp dụng</label>
      <button class="btn sm pri" id="pbuild" style="margin-top:6px">Ghép prompt ↓</button>
    </details>
    <div class="row"><textarea id="ask" rows="3" class="grow" placeholder="Hỏi AI về dự án… (Ctrl+Enter để gửi)"></textarea></div>
    <div class="row"><span class="small muted grow" id="aimode"></span><button class="btn pri" id="send">Gửi</button></div>
  </div>`;
  document.body.appendChild(drawer);
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '🤖 AI Copilot';
  fab.onclick = () => openCopilot();
  document.body.appendChild(fab);
  drawer.querySelector('[data-x]').onclick = () => drawer.classList.remove('open');
  drawer.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => send(b.dataset.q)));
  const ask = drawer.querySelector('#ask');
  drawer.querySelector('#send').onclick = () => send(ask.value);
  ask.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) send(ask.value); });
  drawer.querySelector('#pbuild').onclick = () => {
    const v = (id) => drawer.querySelector(id).value.trim();
    let p = `BỐI CẢNH: ${v('#p1')}\nNHIỆM VỤ: ${v('#p2')}\nRÀNG BUỘC: ${v('#p3')}\nĐỊNH DẠNG: ${v('#p4')}`;
    if (drawer.querySelector('#p5').checked) p += '\nSau khi trả lời, liệt kê riêng: (1) giả thiết đã đặt, (2) con số/điều khoản chưa chắc chắn cần tôi tự tra lại, (3) trường hợp không áp dụng.';
    ask.value = p;
  };
  refreshMode();
}
export function refreshMode() {
  const el = drawer?.querySelector('#aimode');
  if (el) el.innerHTML = aiOnline() ? `<span class="ai-dot on"></span>Claude API · ${aiCfg().model}` : `<span class="ai-dot"></span>Chế độ mô phỏng offline`;
  const tb = document.getElementById('aiStatus');
  if (tb) tb.innerHTML = `<span class="ai-dot ${aiOnline() ? 'on' : ''}"></span>${aiOnline() ? 'Claude: Online' : 'AI: Offline'}`;
}
export function openCopilot(prefill) {
  drawer.classList.add('open');
  if (prefill) send(prefill);
}
async function send(q) {
  q = (q || '').trim();
  if (!q) return;
  const chat = drawer.querySelector('#chat');
  drawer.querySelector('#ask').value = '';
  chat.insertAdjacentHTML('beforeend', `<div class="msg u">${esc(q)}</div>`);
  const pend = document.createElement('div');
  pend.className = 'msg a';
  pend.innerHTML = '<span class="spin"></span> AI đang phân tích dữ liệu dự án…';
  chat.appendChild(pend);
  chat.scrollTop = chat.scrollHeight;
  try {
    const r = await askClaude(q, contextText(getState()));
    if (r.offline) await new Promise((x) => setTimeout(x, 700));
    pend.innerHTML = md(r.text);
  } catch (e) {
    pend.innerHTML = `<b>Lỗi:</b> ${esc(e.message)}`;
  }
  chat.scrollTop = chat.scrollHeight;
}

export function openAiSettings() {
  const c = aiCfg();
  modal({
    title: '⚙ Cài đặt AI (Claude API)',
    body: `<div class="col">
      <div class="disclaimer">Bản demo chạy được hoàn toàn offline với bộ máy mô phỏng. Nhập Claude API key để AI Copilot, AI soạn hồ sơ và AI pháp lý dùng mô hình Claude thật. Key chỉ lưu trong trình duyệt của bạn (localStorage) và gửi trực tiếp tới api.anthropic.com.</div>
      <label class="f">Claude API key<input type="password" id="k" value="${esc(c.key)}" placeholder="sk-ant-..."></label>
      <label class="f">Mô hình<select id="m">${MODELS.map((m) => `<option value="${m.id}" ${m.id === c.model ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
      <p class="small muted">Gợi ý (theo Sổ tay "Claude cho Kỹ sư"): việc càng cần suy luận và độ chính xác (pháp lý, dự toán) thì càng nên chọn mô hình mạnh.</p></div>`,
    actions: [
      { label: 'Xóa key', cls: 'btn danger', onClick: () => { saveAiCfg({ ...c, key: '' }); refreshMode(); toast('Đã xóa API key — chuyển về chế độ offline'); } },
      { label: 'Lưu', cls: 'btn pri', onClick: (w) => { saveAiCfg({ key: w.querySelector('#k').value.trim(), model: w.querySelector('#m').value }); refreshMode(); toast('Đã lưu cài đặt AI', 'ok'); } },
    ],
  });
}
