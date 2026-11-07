// =====================================================================
// MOD-04 · Xuất bảng tính Tổng mức đầu tư & Dự toán (.xls SpreadsheetML 2003)
// Nhiều sheet, công thức sống (R1C1). Không cần thư viện ngoài.
// =====================================================================
import { twinFacts } from './docgen.js';
import { QTO_ROWS, MATERIAL_VARIANTS } from '../data/digital-twin.js';
import { TENANTS } from '../data/nationwide.js';

const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cell = (v, o = {}) => {
  const style = o.s ? ` ss:StyleID="${o.s}"` : '';
  if (o.f) return `<Cell${style} ss:Formula="${x(o.f)}"><Data ss:Type="Number">0</Data></Cell>`;
  if (typeof v === 'number') return `<Cell${style}><Data ss:Type="Number">${v}</Data></Cell>`;
  return `<Cell${style}><Data ss:Type="String">${x(v)}</Data></Cell>`;
};
const row = (cells) => `<Row>${cells.join('')}</Row>`;
const sheet = (name, rows, widths = []) => `<Worksheet ss:Name="${x(name)}"><Table>${widths.map((w) => `<Column ss:Width="${w}"/>`).join('')}${rows.join('')}</Table></Worksheet>`;

export function estimateWorkbook(st) {
  const f = twinFacts(st), pr = st.project;
  const tenant = TENANTS.find((t) => t.id === pr.tenant)?.name || pr.location;
  const H = (arr) => row(arr.map((h) => cell(h, { s: 'h' })));
  // --- Sheet 2: Tiên lượng bóc tách từ 3D
  const tl = [row([cell(`BẢNG TIÊN LƯỢNG BÓC TÁCH KHỐI LƯỢNG TỪ MÔ HÌNH 3D — ${pr.name}`, { s: 't' })]), row([cell(`modelVersion: ${st.twin.modelVersionId || 'chưa phát hành'} · dataVersion: ${st.twin.dataVersionId || 'chưa phát hành'}`)]), H(['TT', 'Hạng mục', 'Khối lượng', 'ĐV', 'Đơn giá (đ)', 'Thành tiền (đ)', 'Nguồn số liệu'])];
  const rows = f.cost ? f.cost.rows : [];
  rows.forEach((r, i) => tl.push(row([cell(i + 1), cell(r.item), cell(Math.round(r.qty)), cell(r.unit), cell(r.price, { s: 'n' }), cell(null, { f: '=RC[-3]*RC[-1]', s: 'n' }), cell('Mô hình Digital Twin (MOD-02/03) · đơn giá minh họa')])));
  if (!rows.length) tl.push(row([cell(''), cell('Chưa có phương án quy hoạch/mô phỏng san nền — không tự điền số liệu', { s: 'w' })]));
  const tlTotalRow = tl.length + 1;
  tl.push(row([cell(''), cell('Cộng chi phí xây dựng', { s: 'b' }), cell(''), cell(''), cell(''), cell(null, { f: rows.length ? `=SUM(R4C:R[-1]C)` : '=0', s: 'nb' })]));
  // --- Sheet 1: Tổng hợp dự toán
  const th = [row([cell(`TỔNG HỢP SƠ BỘ TỔNG MỨC ĐẦU TƯ — ${pr.name}`, { s: 't' })]), row([cell(`Địa điểm: ${pr.location} · ${pr.maDvhc || ''} · Nguồn vốn: ${pr.capital}`)]), H(['TT', 'Khoản mục chi phí', 'Cách tính', 'Giá trị (đ)', 'Căn cứ'])];
  th.push(row([cell('1'), cell('Chi phí xây dựng'), cell('Từ sheet Tiên lượng 3D'), cell(null, { f: `='Tien luong 3D'!R${tlTotalRow}C6`, s: 'n' }), cell('TT 37/2026/TT-BXD (đo bóc), TT 38/2026/TT-BXD (định mức)')]));
  const other = f.cost ? f.cost.other : [];
  other.forEach((o, i) => th.push(row([cell(String(i + 2)), cell(o.item), cell('Tỷ lệ/ước tính minh họa'), cell(Math.round(o.total), { s: 'n' }), cell('NĐ 206/2026/NĐ-CP; TT 36/2026/TT-BXD')])));
  const n0 = 4, n1 = th.length;
  th.push(row([cell(String(other.length + 2)), cell('Dự phòng phí'), cell('10% × (cộng các khoản trên)'), cell(null, { f: `=0.1*SUM(R${n0}C:R${n1}C)`, s: 'n' }), cell('Tạm tính — xác định theo NĐ 206/2026/NĐ-CP')]));
  th.push(row([cell(''), cell('TỔNG CỘNG', { s: 'b' }), cell(''), cell(null, { f: `=SUM(R${n0}C:R${n1 + 1}C)`, s: 'nb' }), cell('Làm tròn khi trình')]));
  // --- Sheet 3: BOM/QTO theo cấu kiện
  const bom = [row([cell('BOM/QTO THEO CẤU KIỆN (IFC GlobalId) — Phương án đang chọn', { s: 't' })]), row([cell('')]), H(['Mã', 'Vật liệu', 'ĐV', 'KL thiết kế (net)', 'Hao hụt', 'KL đặt mua', 'Đơn giá (đ)', 'Thành tiền (đ)', 'Nguồn cấu kiện'])];
  QTO_ROWS.forEach((q) => bom.push(row([cell(q.code), cell(q.material), cell(q.unit), cell(q.qty), cell(q.waste, { s: 'p' }), cell(null, { f: '=RC[-2]*(1+RC[-1])', s: 'n' }), cell(q.price, { s: 'n' }), cell(null, { f: '=RC[-2]*RC[-1]', s: 'n' }), cell(q.source)])));
  const bomTotal = bom.length + 1;
  bom.push(row([cell(''), cell('Cộng', { s: 'b' }), cell(''), cell(''), cell(''), cell(''), cell(''), cell(null, { f: `=SUM(R4C:R[-1]C)`, s: 'nb' })]));
  // --- Sheet 4: So sánh A-B-C
  const abc = [row([cell('SO SÁNH PHƯƠNG ÁN A – B – C (vật liệu, chi phí, thời gian)', { s: 't' })]), row([cell('')]), H(['Phương án', 'Hệ số khối lượng', 'Hệ số giá', 'Chi phí vật liệu (đ)', 'Chênh lệch so với A (đ)', 'Ảnh hưởng tiến độ (ngày)', 'Ghi chú'])];
  Object.entries(MATERIAL_VARIANTS).forEach(([k, v], i) => abc.push(row([cell(v.label), cell(v.qty), cell(v.price), cell(null, { f: `='BOM-QTO cau kien'!R${bomTotal}C8*RC[-2]*RC[-1]`, s: 'n' }), cell(null, { f: i === 0 ? '=0' : `=RC[-1]-R4C4`, s: 'n' }), cell(v.delay), cell(v.note)])));
  // --- Sheet 5: Nhu cầu vật liệu theo tiến độ
  const W = [0.05, 0.15, 0.25, 0.25, 0.2, 0.1];
  const sch = [row([cell('NHU CẦU VẬT LIỆU THEO TIẾN ĐỘ (4D/5D) — phân bổ theo quý thi công G12', { s: 't' })]), row([cell('Trọng số phân bổ (giả định, cấu hình được)'), ...W.map((w) => cell(w, { s: 'p' }))]), H(['Vật liệu', 'Quý 1', 'Quý 2', 'Quý 3', 'Quý 4', 'Quý 5', 'Quý 6', 'Tổng'])];
  QTO_ROWS.forEach((q, i) => sch.push(row([cell(`${q.material} (${q.unit})`), ...W.map((_, j) => cell(null, { f: `='BOM-QTO cau kien'!R${4 + i}C6*R2C${j + 2}`, s: 'n' })), cell(null, { f: '=SUM(RC[-6]:RC[-1])', s: 'nb' })])));
  // --- Sheet 6: Giả định & cảnh báo
  const gd = [row([cell('GIẢ ĐỊNH & CẢNH BÁO', { s: 't' })]), H(['#', 'Nội dung', 'Trạng thái'])];
  [
    ['Căn cứ chi phí: Nghị định 206/2026/NĐ-CP (thay NĐ 10/2021/NĐ-CP); TT 36/2026/TT-BXD; TT 37/2026/TT-BXD; TT 38/2026/TT-BXD (hiệu lực 01/7/2026, lưu ý CV 9947/BXD-VPB)', 'MOD-05 kiểm tra lại tại thời điểm sử dụng'],
    [`Đơn giá & giá vật liệu: áp theo công bố của ${tenant} (tenant MOD-00) — bản demo dùng ĐƠN GIÁ MINH HỌA`, 'Cần thay bằng công bố hiện hành'],
    ['Khối lượng bóc tách từ mô hình phiên bản ghi tại sheet Tiên lượng; không tự suy đoán giá trị thiếu', 'Kỹ sư xác nhận'],
    ['Hao hụt, trọng số phân bổ theo quý là tham số cấu hình', 'Cần nguồn + ngày hiệu lực'],
    ['Phương án B chỉ hợp lệ trong miền thông số chuyên gia cho phép; chưa xác nhận kết cấu', 'Cảnh báo'],
    ['Phương án C: giao thép trễ — chỉ là dự báo, không sửa baseline', 'Cảnh báo'],
    ['Bảng tính phục vụ thẩm tra phương án; không thay hồ sơ dự toán được thẩm định', 'Giới hạn'],
  ].forEach(([a, b], i) => gd.push(row([cell(i + 1), cell(a), cell(b)])));
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles><Style ss:ID="Default"><Font ss:FontName="Times New Roman" ss:Size="12"/></Style>
<Style ss:ID="t"><Font ss:FontName="Times New Roman" ss:Size="13" ss:Bold="1"/></Style>
<Style ss:ID="h"><Font ss:FontName="Times New Roman" ss:Bold="1"/><Interior ss:Color="#DCE6F1" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
<Style ss:ID="b"><Font ss:FontName="Times New Roman" ss:Bold="1"/></Style>
<Style ss:ID="w"><Font ss:FontName="Times New Roman" ss:Color="#C00000" ss:Italic="1"/></Style>
<Style ss:ID="n"><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="nb"><Font ss:FontName="Times New Roman" ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>
<Style ss:ID="p"><NumberFormat ss:Format="0.0%"/></Style></Styles>
${sheet('Tong hop du toan', th, [40, 260, 170, 120, 300])}
${sheet('Tien luong 3D', tl, [40, 240, 90, 50, 100, 120, 280])}
${sheet('BOM-QTO cau kien', bom, [90, 190, 45, 100, 60, 100, 100, 120, 220])}
${sheet('So sanh A-B-C', abc, [180, 90, 80, 130, 140, 110, 320])}
${sheet('Nhu cau theo tien do', sch, [210, 90, 90, 90, 90, 90, 90, 100])}
${sheet('Gia dinh & canh bao', gd, [30, 620, 220])}
</Workbook>`;
}
