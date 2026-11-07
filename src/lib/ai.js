// =====================================================================
// AI COPILOT — Qwen qua server cùng origin + bộ máy mô phỏng offline
// Nguyên tắc (theo Sổ tay "Claude cho Kỹ sư"): AI đề xuất – Kỹ sư quyết định.
// =====================================================================
const CFG_KEY = 'aipm-dt-ai-cfg';
export const MODELS = [{ id: 'Qwen/Qwen3.6-35B-A3B-FP8', name: 'Qwen (cấu hình trên server)' }];
export function aiCfg() {
  try {
    return { mode: 'qwen', ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}'), model: MODELS[0].id };
  } catch {
    return { mode: 'qwen', model: MODELS[0].id };
  }
}
export function saveAiCfg(c) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ mode: c.mode }));
}
export const aiOnline = () => aiCfg().mode !== 'offline';

export const SYSTEM_PROMPT = `Bạn là AI Copilot chuyên ngành đầu tư xây dựng công tại Việt Nam, tích hợp trong nền tảng AIPM OS. Cấu hình demo có Stage-Gate G0–G16, trình tự, checklist và BPMN; số lượng mục áp dụng phải lấy từ phiên bản cấu hình thực tế, không coi các con số thống kê trong tài liệu nguồn là baseline mặc định.
Nguyên tắc bắt buộc:
- Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc (bảng/gạch đầu dòng khi phù hợp).
- KHÔNG bịa số hiệu văn bản pháp luật. Văn bản nào không chắc còn hiệu lực năm 2026 phải ghi rõ "[Cần xác minh]".
- Mọi con số kỹ thuật, khối lượng, chi phí là đề xuất; luôn kết thúc bằng mục "TỰ KIỂM" nêu (1) giả thiết đã đặt, (2) điểm chưa chắc chắn cần kỹ sư tra lại, (3) trường hợp không áp dụng.
- Phân biệt L0 minh họa, L1 sơ bộ, L2 có solver và L3 được kỹ sư xác nhận. Không suy ra ứng suất, chuyển vị hoặc khả năng chịu lực từ animation, QTO hay màu 3D.
- AI đề xuất — Kỹ sư quyết định và chịu trách nhiệm.`;

export async function askLLM(userPrompt, context = '', { maxTokens = 1800 } = {}) {
  if (!aiOnline()) return { offline: true, text: offlineAnswer(userPrompt, context) };
  const res = await fetch('/api/llm/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(125000),
    body: JSON.stringify({ prompt: userPrompt, context, system: SYSTEM_PROMPT, maxTokens }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Không kết nối được LLM. Kiểm tra server và file .env.');
  return { offline: false, text: result.text };
}
// Giữ tên hàm cũ cho các màn đang dùng chung AI.
export const askClaude = askLLM;

// --------- Trả lời offline (mô phỏng) theo từ khóa ---------
function offlineAnswer(q, ctx) {
  const s = q.toLowerCase();
  const tail = `\n\n**TỰ KIỂM**\n1. Giả thiết: số liệu lấy từ mô hình Digital Twin mô phỏng của dự án demo.\n2. Cần kỹ sư tra lại: căn cứ pháp lý, đơn giá, định mức địa phương tại thời điểm lập hồ sơ.\n3. Không áp dụng khi dự án thuộc trường hợp đặc thù (quốc phòng, an ninh, khẩn cấp...).\n\n_(Chế độ mô phỏng offline — bật Qwen trong ⚙ Cài đặt AI để gọi LLM.)_`;
  if (/ngập|thoát nước|mưa/.test(s))
    return `**Phân tích thoát nước mưa / nguy cơ ngập úng**\n- Khu vực trũng nằm dọc tuyến suối cắt chéo phía Tây khu đất.\n- Đề xuất: cao độ san nền tối thiểu = mực nước ngập mô phỏng + 0,3 m; bố trí hồ điều hòa hoặc mương thu dọc tim suối cũ.\n- Ưu tiên kiểm tra lại cường độ mưa thiết kế theo số liệu trạm khí tượng gần nhất.${tail}`;
  if (/san nền|đào|đắp|khối lượng/.test(s))
    return `**Tối ưu san nền đào – đắp**\n- Cao độ cân bằng được tính bằng phương pháp lưới ô vuông 4×4 m trên DEM đã khai báo nguồn và CRS.\n- Nên chia 2–3 cấp nền theo địa hình thay vì 1 mặt bằng phẳng để giảm khối lượng vận chuyển.\n- Hệ số đầm nén/tơi xốp cần lấy theo kết quả thí nghiệm đất thực tế.${tail}`;
  if (/pháp lý|luật|nghị định|hiệu lực|thông tư/.test(s))
    return `**Rà soát căn cứ pháp lý**\n| Nhóm | Ghi nhận |\n|---|---|\n| Đầu tư công | Luật Đầu tư công số 58/2024/QH15 thay thế Luật 2019 — nghị định hướng dẫn: [Cần xác minh] |\n| Đấu thầu | Luật Đấu thầu số 22/2023/QH15 thay thế Luật 2013 |\n| Văn thư | Thể thức theo Nghị định 30/2020/NĐ-CP — [Cần xác minh hiệu lực định kỳ] |\n| Xây dựng | Luật Xây dựng số 135/2025/QH15; NĐ 217/2026/NĐ-CP (quản lý hoạt động xây dựng) |\n| Chi phí | NĐ 206/2026/NĐ-CP thay NĐ 10/2021/NĐ-CP; TT 36/2026, 37/2026, 38/2026/TT-BXD thay TT 11, 13, 12/2021 |\n| Quy chuẩn | QCVN 01:2021/BXD đến 31/12/2026 → QCVN 01:2026/BXD từ 01/01/2027 (TT 46/2026/TT-BXD): kiểm tra theo ngày thẩm định dự kiến |${tail}`;
  if (/tiến độ|chậm|timeline|gantt/.test(s))
    return `**Cảnh báo tiến độ**\n- Đường găng đi qua: G0 → G1 → G4 → G5 → G9 → G10 → G11 → G12 → G14 → G15.\n- Điểm nghẽn: hồ sơ ĐTM và GPMB đang vượt SLA tại cơ quan Môi trường/Đất đai.\n- Đề xuất: chạy song song khảo sát (G4) với lập dự toán chuẩn bị (G3); họp liên ngành để rút ngắn thời gian GPMB.${tail}`;
  if (/pccc|cháy/.test(s))
    return `**Kiểm tra PCCC sơ bộ trên mô hình**\n- Kiểm tra khoảng cách tiếp cận của xe chữa cháy từ mép đường tới từng công trình (tham số cấu hình được).\n- Công trình không đạt cần bổ sung bãi đỗ/đường nội bộ cho xe chữa cháy.\n- Tham số phải đối chiếu QCVN 06 hiện hành về an toàn cháy — [Cần xác minh phiên bản].${tail}`;
  return `**Gợi ý của AI Copilot**\nDựa trên trạng thái dự án:\n${ctx ? ctx.split('\n').slice(0, 6).map((l) => '- ' + l).join('\n') : '- Chưa có dữ liệu'}\n\nBạn có thể hỏi về: san nền, ngập úng, PCCC, tiến độ, căn cứ pháp lý, hoặc yêu cầu soạn hồ sơ.${tail}`;
}

// =====================================================================
// AI PHÁP LÝ — CSDL căn cứ & quy tắc thay thế (minh họa, theo nguyên tắc
// "không bịa số hiệu": chỉ ghi văn bản đã chắc chắn, còn lại gắn [Cần xác minh])
// =====================================================================
// Đồ thị tri thức pháp lý theo thời gian (rút gọn): mỗi quy tắc có trạng thái,
// văn bản thay thế (THAY_THE_CHO) và — nếu phụ thuộc thời điểm — hàm dyn(at).
// Căn cứ theo SRS v2.0 mục 7.9 (rà soát 04/11/2026); chủ đầu tư xác nhận trước khi dùng chính thức.
const QCVN01_2026_FROM = '2027-01-01';
export const LEGAL_RULES = [
  { re: /Luật Đầu tư công( số)? ?(39\/2019\/QH14|2019)/gi, status: 'expired', msg: 'Luật Đầu tư công 2019 đã được thay thế', replace: 'Luật Đầu tư công số 58/2024/QH15' },
  { re: /Luật Đấu thầu( số)? ?(43\/2013\/QH13|2013)/gi, status: 'expired', msg: 'Luật Đấu thầu 2013 đã được thay thế', replace: 'Luật Đấu thầu số 22/2023/QH15' },
  { re: /Nghị định (số )?40\/2020\/NĐ-CP/gi, status: 'verify', msg: 'Nghị định hướng dẫn Luật Đầu tư công 2019 — cần xác minh văn bản thay thế theo Luật 58/2024/QH15', replace: null },
  { re: /Luật Xây dựng 2014( \(sửa đổi 2020\))?/gi, status: 'expired', msg: 'Đã được thay thế bởi Luật Xây dựng số 135/2025/QH15', replace: 'Luật Xây dựng số 135/2025/QH15' },
  { re: /Nghị định (số )?10\/2021\/NĐ-CP/gi, status: 'expired', msg: 'Hết hiệu lực — thay thế bởi Nghị định 206/2026/NĐ-CP ngày 15/6/2026 về quản lý chi phí đầu tư xây dựng', replace: 'Nghị định 206/2026/NĐ-CP' },
  { re: /Thông tư (số )?12\/2021\/TT-BXD/gi, status: 'expired', msg: 'Hết hiệu lực — thay thế bởi Thông tư 38/2026/TT-BXD (định mức xây dựng, hiệu lực 01/7/2026; lưu ý CV 9947/BXD-VPB đính chính phụ lục)', replace: 'Thông tư 38/2026/TT-BXD' },
  { re: /Thông tư (số )?11\/2021\/TT-BXD/gi, status: 'expired', msg: 'Hết hiệu lực — thay thế bởi Thông tư 36/2026/TT-BXD (xác định và quản lý chi phí)', replace: 'Thông tư 36/2026/TT-BXD' },
  { re: /Thông tư (số )?13\/2021\/TT-BXD/gi, status: 'expired', msg: 'Hết hiệu lực — thay thế bởi Thông tư 37/2026/TT-BXD (phương pháp định mức, đo bóc khối lượng)', replace: 'Thông tư 37/2026/TT-BXD' },
  { re: /Nghị định (số )?15\/2021\/NĐ-CP/gi, status: 'verify', msg: 'Đối chiếu Nghị định 217/2026/NĐ-CP về quản lý hoạt động xây dựng [Cần xác minh quan hệ thay thế]', replace: null },
  { re: /Nghị định (số )?06\/2021\/NĐ-CP/gi, status: 'verify', msg: 'Đối chiếu Nghị định 207/2026/NĐ-CP về quản lý chất lượng [Cần xác minh quan hệ thay thế]', replace: null },
  { re: /Nghị định (số )?37\/2015\/NĐ-CP/gi, status: 'verify', msg: 'Đối chiếu Nghị định 210/2026/NĐ-CP về hợp đồng xây dựng [Cần xác minh quan hệ thay thế]', replace: null },
  { re: /QCVN 01:2021\/BXD/gi, dyn: (at) => (at >= QCVN01_2026_FROM
    ? { status: 'verify', msg: `Thời điểm thẩm định dự kiến ${at.split('-').reverse().join('/')} ≥ 01/01/2027: áp dụng QCVN 01:2026/BXD (Thông tư 46/2026/TT-BXD) — kiểm tra lại chỉ tiêu`, replace: 'QCVN 01:2026/BXD' }
    : { status: 'ok', msg: 'Còn hiệu lực đến 31/12/2026; QCVN 01:2026/BXD có hiệu lực từ 01/01/2027', replace: null }) },
  { re: /QCVN 01:2026\/BXD/gi, dyn: (at) => (at >= QCVN01_2026_FROM ? { status: 'ok', msg: 'Có hiệu lực từ 01/01/2027 (Thông tư 46/2026/TT-BXD)', replace: null } : { status: 'upcoming', msg: 'Sắp có hiệu lực 01/01/2027 — chưa áp dụng tại thời điểm thẩm định dự kiến', replace: null }) },
  { re: /Nghị định (số )?30\/2020\/NĐ-CP/gi, status: 'ok', msg: 'Thể thức văn bản hành chính — còn hiệu lực (rà soát định kỳ)', replace: null },
  { re: /Luật Đầu tư công số 58\/2024\/QH15/gi, status: 'ok', msg: 'Còn hiệu lực', replace: null },
  { re: /Luật Đấu thầu số 22\/2023\/QH15/gi, status: 'ok', msg: 'Còn hiệu lực', replace: null },
  { re: /Luật Xây dựng số 135\/2025\/QH15/gi, status: 'ok', msg: 'Còn hiệu lực', replace: null },
  { re: /Nghị định (số )?(206|207|210|212|217)\/2026\/NĐ-CP/gi, status: 'ok', msg: 'Văn bản 2026 — còn hiệu lực (MOD-05 kiểm tra lại tại thời điểm sử dụng)', replace: null },
  { re: /Thông tư (số )?(34|36|37|38)\/2026\/TT-BXD/gi, status: 'ok', msg: 'Văn bản 2026 — còn hiệu lực (MOD-05 kiểm tra lại tại thời điểm sử dụng)', replace: null },
  { re: /Luật Bảo vệ môi trường (số 72\/2020\/QH14|2020)/gi, status: 'ok', msg: 'Còn hiệu lực (kiểm tra các nghị định hướng dẫn sửa đổi)', replace: null },
  { re: /Luật Đất đai (số 31\/2024\/QH15|2024)/gi, status: 'ok', msg: 'Còn hiệu lực', replace: null },
  { re: /Luật Đất đai 2013/gi, status: 'expired', msg: 'Luật Đất đai 2013 đã được thay thế', replace: 'Luật Đất đai số 31/2024/QH15' },
  { re: /Luật Quy hoạch đô thị 2009/gi, status: 'expired', msg: 'Đã được thay thế bởi Luật Quy hoạch đô thị và nông thôn năm 2024', replace: 'Luật Quy hoạch đô thị và nông thôn năm 2024' },
  { re: /Luật Đo đạc và bản đồ( năm)? 2018/gi, status: 'ok', msg: 'Còn hiệu lực (dữ liệu không gian, VN-2000)', replace: null },
];

const defaultAt = () => { try { return JSON.parse(localStorage.getItem('aipm-dt-demo-v3'))?.project?.appraisalDate || new Date().toISOString().slice(0, 10); } catch { return new Date().toISOString().slice(0, 10); } };
export function ruleStatus(r, at = defaultAt()) { return r.dyn ? r.dyn(at) : { status: r.status, msg: r.msg, replace: r.replace }; }
export const STATUS_LABEL = { expired: 'Hết hiệu lực', verify: 'Cần xác minh', ok: 'Còn hiệu lực', upcoming: 'Sắp có hiệu lực', violation: 'Vi phạm chỉ tiêu' };
export const STATUS_TONE = { expired: 'red', verify: 'orange', ok: 'green', upcoming: 'blue', violation: 'red' };
export const isIssue = (s) => s.status === 'expired' || s.status === 'verify' || s.status === 'violation';

// Ngưỡng MĐXD tối đa theo tầng cao — THAM SỐ CẤU HÌNH DEMO, không phải bảng QCVN.
// [Cần xác minh bảng QCVN 01:2021/BXD và QCVN 01:2026/BXD theo diện tích lô, chiều cao, loại công trình]
export const DENSITY_LIMITS = [[3, 80], [6, 70], [10, 55], [15, 40], [25, 35], [Infinity, 30]];
export function densityLimit(floors) { return DENSITY_LIMITS.find(([f]) => floors <= f)[1]; }
export function indicatorScan(text, at = defaultAt()) {
  const out = [];
  const dm = /mật độ xây dựng[^0-9%]{0,40}(\d+(?:[.,]\d+)?)\s*%/i.exec(text);
  const fm = /(\d{1,3})\s*tầng/i.exec(text);
  if (dm && fm) {
    const d = parseFloat(dm[1].replace(',', '.')), floors = +fm[1], lim = densityLimit(floors);
    const std = at >= QCVN01_2026_FROM ? 'QCVN 01:2026/BXD' : 'QCVN 01:2021/BXD';
    if (d > lim) out.push({ match: dm[0], index: dm.index, status: 'violation', msg: `Mật độ ${d}% vượt ngưỡng ${lim}% cho công trình ${floors} tầng theo ${std} (ngưỡng là tham số cấu hình demo — cần xác minh bảng quy chuẩn)`, replace: null, fix: dm[0].replace(dm[1], String(lim)) });
    else out.push({ match: dm[0], index: dm.index, status: 'ok', msg: `Mật độ ${d}% ≤ ${lim}% (${floors} tầng, ${std}; tham số demo)`, replace: null });
  }
  return out;
}

export function legalScan(text, at = defaultAt()) {
  const found = [];
  for (const r of LEGAL_RULES) {
    r.re.lastIndex = 0;
    const st = ruleStatus(r, at);
    let m;
    while ((m = r.re.exec(text))) found.push({ match: m[0], index: m.index, ...st });
  }
  found.push(...indicatorScan(text, at));
  return found.sort((a, b) => a.index - b.index);
}
export function legalFix(text, at = defaultAt()) {
  let out = text;
  for (const r of LEGAL_RULES) { const st = ruleStatus(r, at); if (st.replace && st.status !== 'ok') { r.re.lastIndex = 0; out = out.replace(r.re, st.replace); } }
  for (const f of indicatorScan(out, at)) if (f.fix) out = out.replace(f.match, f.fix);
  return out;
}

// =====================================================================
// KIỂM TRA THỂ THỨC (NĐ 30/2020/NĐ-CP — Phụ lục I, rút gọn cho demo)
// =====================================================================
export function formatCheck(root) {
  const text = root.innerText || '';
  const style = getComputedStyle(root);
  const qh = root.querySelector('.qh');
  const tn = root.querySelector('.tn');
  const checks = [
    { rule: 'Phông chữ Times New Roman (bộ mã Unicode TCVN 6909:2001)', ok: /Times New Roman/i.test(style.fontFamily) },
    { rule: 'Khổ giấy A4, lề trái 30–35 mm, lề trên/dưới 20–25 mm, lề phải 15–20 mm', ok: root.dataset.page === 'A4' },
    { rule: 'Quốc hiệu: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" – in hoa, đứng, đậm', ok: !!qh && /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/.test(qh.innerText) },
    { rule: 'Tiêu ngữ: "Độc lập - Tự do - Hạnh phúc" – chữ thường, đứng, đậm', ok: !!tn && /Độc lập - Tự do - Hạnh phúc/.test(tn.innerText) },
    { rule: 'Có số, ký hiệu văn bản (Số: …/…)', ok: /Số:\s*[\w.…]+\/[\w\-Đ]+/u.test(text) },
    { rule: 'Địa danh và thời gian ban hành (…, ngày … tháng … năm …)', ok: /ngày\s+\S+\s+tháng\s+\S+\s+năm\s+\d{4}/.test(text) },
    { rule: 'Tên loại và trích yếu nội dung văn bản', ok: ((root.querySelector('.ten-loai')?.innerText || '') + (root.querySelector('.trich-yeu')?.innerText || '')).trim().length > 3 },
    { rule: 'Có "Kính gửi" / căn cứ (đối với tờ trình, công văn)', ok: /Kính gửi|Căn cứ/.test(text) },
    { rule: 'Nơi nhận', ok: /Nơi nhận/.test(text) },
    { rule: 'Quyền hạn, chức vụ, họ tên người ký', ok: !!root.querySelector('.ky') && root.querySelector('.ky').innerText.trim().length > 5 },
    { rule: 'Không còn trường trống chưa điền ([...], ___)', ok: !/\[\.\.\.\]|___/.test(text) },
  ];
  return checks;
}
