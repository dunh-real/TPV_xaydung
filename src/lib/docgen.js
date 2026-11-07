// =====================================================================
// AI KHỞI TẠO HỒ SƠ TỪ DỮ LIỆU DIGITAL TWIN (Form-based Copilot)
// Sinh văn bản theo thể thức NĐ 30/2020/NĐ-CP; số liệu lấy trực tiếp
// từ mô hình 3D/2D (diện tích, quy mô, khối lượng, chi phí...).
// =====================================================================
import { planMetrics, earthwork, costEstimate, floodSim, gradedSurface, polyArea, progress4D, demGrid } from './engine.js';
import { fmt, fmtInt, esc, viLongDate, todayISO } from './util.js';
import { currentPlan } from './plan.js';

export function twinFacts(st) {
  const p = currentPlan(st);
  const m = p ? planMetrics(p) : null;
  const pad = st.twin.pad ?? (p ? demGrid().mean : null);
  const ew = pad != null ? earthwork(pad, p?.lakes || []) : null;
  const cost = p && ew ? costEstimate(p, ew) : null;
  const flood0 = floodSim({ rain: 90, dur: 2, C: 0.45, drain: 30 });
  const flood1 = pad != null ? floodSim({ rain: 90, dur: 2, C: 0.75, drain: 60, surface: gradedSurface(pad, p?.lakes || []) }) : null;
  return { plan: p, m, pad, ew, cost, flood0, flood1, site: polyArea(), dem: demGrid() };
}

export function contextText(st) {
  const f = twinFacts(st);
  const pr = st.project;
  const L = [
    `Dự án: ${pr.name} (${pr.code}), ${pr.group}, ${pr.category}, địa điểm ${pr.location}, nguồn vốn ${pr.capital}.`,
    `Diện tích khu đất (ranh giới GIS đã xác minh): ${fmt(f.site / 10000, 2)} ha; cao độ tự nhiên ${fmt(f.dem.min, 2)}–${fmt(f.dem.max, 2)} m.`,
  ];
  if (f.plan) L.push(`Phương án quy hoạch chọn: ${f.plan.name}; ${f.m.nBuild} công trình, tổng sàn ${fmtInt(f.m.gfa)} m², MĐXD ${fmt(f.m.mdxd, 1)}%, HSSDĐ ${fmt(f.m.far, 2)}, tầng cao tối đa ${f.m.floorsMax}, khoảng ${fmtInt(f.m.units)} căn hộ, ~${fmtInt(f.m.pop)} người.`);
  if (f.ew) L.push(`San nền: cao độ thiết kế +${f.pad.toFixed(2)} m; đào ${fmtInt(f.ew.cut)} m³, đắp ${fmtInt(f.ew.fill)} m³.`);
  if (f.cost) L.push(`Sơ bộ tổng mức đầu tư: ${fmt(f.cost.total / 1e9, 2)} tỷ đồng (đơn giá minh họa).`);
  L.push(`Ngập úng hiện trạng (mưa 90 mm/h, 2h): diện tích ngập ${fmtInt(f.flood0.wetArea)} m², sâu tối đa ${fmt(f.flood0.maxDepth, 2)} m.`);
  L.push(`Tiến độ: đã qua ${Object.values(st.gates).filter((g) => g.passed).length} cổng; checklist hoàn thành ${Object.values(st.checklist).filter((c) => c.done).length} mục theo phiên bản cấu hình hiện tại.`);
  return L.join('\n');
}

const header = (st, kyHieu, loai, trichYeu) => `
<table class="vb-head"><tr>
  <td><div class="cq-cap">${esc(st.project.decider.toUpperCase())}</div><div class="cq"><b>${esc(st.project.owner.toUpperCase())}</b></div><div class="line-s"></div><div class="so">Số: ${kyHieu}</div></td>
  <td><div class="qh"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b></div><div class="tn"><b>Độc lập - Tự do - Hạnh phúc</b></div><div class="line-l"></div><div class="dd"><i>${esc(st.project.location.split(',').pop().trim().replace(/^tỉnh /i, ''))}, ${viLongDate(todayISO())}</i></div></td>
</tr></table>
<div class="ten-loai"><b>${loai}</b></div><div class="trich-yeu"><b>${trichYeu}</b></div><div class="line-c"></div>`;

const footer = (st, chucVu, nhan) => `
<table class="vb-foot"><tr>
<td class="noi-nhan"><b><i>Nơi nhận:</i></b><br>${nhan.map((n) => '- ' + n + ';').join('<br>')}<br>- Lưu: VT, KH.</td>
<td class="ky"><b>${chucVu}</b><br><br><br><i>(Ký, ghi rõ họ tên, đóng dấu)</i><br><br><b>Nguyễn Văn A</b></td>
</tr></table>`;

export function generateDoc(type, st, opts = {}) {
  const f = twinFacts(st);
  const pr = st.project;
  const year = new Date().getFullYear();
  const cite = opts.legacyCitations
    ? ['Luật Đầu tư công 2019', 'Luật Xây dựng 2014 (sửa đổi 2020)', 'Nghị định 40/2020/NĐ-CP', 'Nghị định 10/2021/NĐ-CP về quản lý chi phí đầu tư xây dựng', 'Luật Đấu thầu 2013']
    : ['Luật Đầu tư công số 58/2024/QH15', 'Luật Xây dựng số 135/2025/QH15', 'Nghị định 217/2026/NĐ-CP về quản lý hoạt động xây dựng', 'Nghị định 206/2026/NĐ-CP về quản lý chi phí đầu tư xây dựng'];
  const costCite = opts.legacyCitations
    ? ['Nghị định 10/2021/NĐ-CP', 'Thông tư 11/2021/TT-BXD', 'Thông tư 12/2021/TT-BXD', 'Thông tư 13/2021/TT-BXD']
    : ['Nghị định 206/2026/NĐ-CP', 'Thông tư 36/2026/TT-BXD', 'Thông tư 37/2026/TT-BXD', 'Thông tư 38/2026/TT-BXD'];
  const need = (x, msg) => (x ? '' : `<p class="warn-box">⚠ ${msg}</p>`);
  let title, body;
  if (type === 'totrinh') {
    title = 'Tờ trình đề nghị thẩm định chủ trương đầu tư';
    body = header(st, `…/TTr-BQLDA`, 'TỜ TRÌNH', `Đề nghị thẩm định chủ trương đầu tư dự án ${esc(pr.name)}`) + `
<p class="kg">Kính gửi: Hội đồng thẩm định chủ trương đầu tư ${esc(pr.decider.replace('Ủy ban nhân dân ', ''))}.</p>
${cite.map((c) => `<p><i>Căn cứ ${esc(c)};</i></p>`).join('')}
<p><i>Căn cứ thông tin quy hoạch và dataset hiện trạng phiên bản ${esc(st.twin.dataVersionId || '[chưa phát hành]')} ngày ${viLongDate(todayISO()).replace('ngày ', '')};</i></p>
<p>${esc(pr.owner)} kính trình thẩm định chủ trương đầu tư dự án với các nội dung chính sau:</p>
<p><b>1. Tên dự án:</b> ${esc(pr.name)}.</p>
<p><b>2. Nhóm dự án:</b> ${esc(pr.group)}; loại: ${esc(pr.category)}.</p>
<p><b>3. Địa điểm, diện tích:</b> ${esc(pr.location)}${pr.maDvhc ? ` (${esc(pr.maDvhc)}; vị trí trên Bản đồ 3D MOD-00)` : ''}; tổng diện tích khu đất <b>${fmt(f.site / 10000, 2)} ha</b> (đo đạc từ mô hình Digital Twin, hệ tọa độ VN-2000).</p>
${need(f.plan, 'Chưa chọn phương án quy hoạch trên Digital Twin — AI không thể điền quy mô.')}
${f.plan ? `<p><b>4. Quy mô đầu tư (phương án chọn: ${esc(f.plan.name)}):</b></p>
<table class="vb-tb"><tr><th>Chỉ tiêu</th><th>Giá trị</th><th>Khống chế</th></tr>
<tr><td>Số công trình</td><td>${f.m.nBuild}</td><td>—</td></tr>
<tr><td>Tổng diện tích sàn xây dựng</td><td>${fmtInt(f.m.gfa)} m²</td><td>—</td></tr>
<tr><td>Mật độ xây dựng</td><td>${fmt(f.m.mdxd, 1)}%</td><td>≤ ${st.params.mdxd}%</td></tr>
<tr><td>Hệ số sử dụng đất</td><td>${fmt(f.m.far, 2)} lần</td><td>≤ ${st.params.far}</td></tr>
<tr><td>Tầng cao tối đa</td><td>${f.m.floorsMax} tầng</td><td>${st.params.floorsMin}–${st.params.floorsMax} tầng</td></tr>
<tr><td>Quy mô dân số dự kiến</td><td>~${fmtInt(f.m.pop)} người (${fmtInt(f.m.units)} căn)</td><td>—</td></tr></table>` : ''}
<p><b>5. Sơ bộ tổng mức đầu tư:</b> ${f.cost ? `khoảng <b>${fmt(f.cost.total / 1e9, 2)} tỷ đồng</b> (chi tiết tại hồ sơ Sơ bộ tổng mức đầu tư kèm theo)` : 'đang lập'}.</p>
<p><b>6. Nguồn vốn:</b> ${esc(pr.capital)}.</p>
<p><b>7. Thời gian thực hiện:</b> ${year}–${year + 4}.</p>
<p><b>8. Hiện trạng và giải pháp kỹ thuật chính:</b> cao độ tự nhiên ${fmt(f.dem.min, 2)}–${fmt(f.dem.max, 2)} m; ${f.ew ? `san nền đến cao độ +${f.pad.toFixed(2)} m với khối lượng đào ${fmtInt(f.ew.cut)} m³, đắp ${fmtInt(f.ew.fill)} m³;` : ''} khu vực trũng dọc tuyến suối có nguy cơ ngập ${fmtInt(f.flood0.wetArea)} m² khi mưa lớn, được xử lý bằng giải pháp san nền và thoát nước mưa.</p>
<p>${esc(pr.owner)} kính trình Hội đồng thẩm định xem xét, thẩm định./.</p>
` + footer(st, 'GIÁM ĐỐC', ['Như trên', `${esc(pr.decider)} (để b/c)`, 'Sở Tài chính', 'Sở Xây dựng']);
  } else if (type === 'tmdt') {
    title = 'Sơ bộ tổng mức đầu tư';
    body = header(st, `…/BC-BQLDA`, 'BÁO CÁO', `Sơ bộ tổng mức đầu tư dự án ${esc(pr.name)}`) + `
<p><i>Căn cứ ${esc(cite[0])};</i></p>${costCite.map((c) => `<p><i>Căn cứ ${esc(c)};</i></p>`).join('')}<p><i>Căn cứ công bố đơn giá xây dựng, giá vật liệu của địa phương nơi có dự án (${esc(pr.location.split(',').pop().trim())} — tenant MOD-00);</i></p><p><i>Căn cứ khối lượng bóc tách tự động từ mô hình Digital Twin 3D/2D của dự án;</i></p>
${need(f.cost, 'Cần chọn phương án quy hoạch và chạy mô phỏng san nền để AI bóc tách khối lượng.')}
${f.cost ? `<table class="vb-tb"><tr><th>TT</th><th>Hạng mục</th><th>Khối lượng</th><th>ĐV</th><th>Đơn giá (đ)</th><th>Thành tiền (triệu đ)</th></tr>
${f.cost.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.item}</td><td class="r">${fmtInt(r.qty)}</td><td>${r.unit}</td><td class="r">${fmtInt(r.price)}</td><td class="r">${fmt(r.total / 1e6, 0)}</td></tr>`).join('')}
<tr><td></td><td><b>A. Chi phí xây dựng</b></td><td></td><td></td><td></td><td class="r"><b>${fmt(f.cost.xd / 1e6, 0)}</b></td></tr>
${f.cost.other.map((r) => `<tr><td></td><td>${r.item}</td><td></td><td></td><td></td><td class="r">${fmt(r.total / 1e6, 0)}</td></tr>`).join('')}
<tr><td></td><td>Dự phòng phí (tạm tính 10%)</td><td></td><td></td><td></td><td class="r">${fmt(f.cost.contingency / 1e6, 0)}</td></tr>
<tr><td></td><td><b>TỔNG CỘNG (làm tròn)</b></td><td></td><td></td><td></td><td class="r"><b>${fmt(f.cost.total / 1e6, 0)}</b></td></tr></table>
<p class="note">Ghi chú: đơn giá trong bảng là <b>đơn giá minh họa của bản demo</b>; khi lập hồ sơ thật phải áp định mức, đơn giá xây dựng địa phương và suất vốn đầu tư được công bố tại thời điểm lập.</p>` : ''}
` + footer(st, 'GIÁM ĐỐC', ['Sở Tài chính', 'Sở Xây dựng']);
  } else if (type === 'dtm') {
    title = 'Báo cáo ĐTM (dự thảo)';
    const fl = f.flood1;
    body = header(st, `…/BC-BQLDA`, 'BÁO CÁO', `Đánh giá tác động môi trường (dự thảo) dự án ${esc(pr.name)}`) + `
<p><i>Căn cứ Luật Bảo vệ môi trường số 72/2020/QH14 và các văn bản hướng dẫn [Cần xác minh văn bản sửa đổi 2026];</i></p>
<p><b>1. Hiện trạng môi trường nền (dataset đa nguồn):</b> khu đất ${fmt(f.site / 10000, 2)} ha. Mô tả lớp phủ, vật cản và công trình hiện hữu cần được kiểm tra với hồ sơ khảo sát có nguồn trước khi phát hành.</p>
<p><b>2. Tác động trong giai đoạn thi công:</b></p>
<table class="vb-tb"><tr><th>Nguồn tác động</th><th>Kết quả mô phỏng</th><th>Biện pháp giảm thiểu</th></tr>
<tr><td>Bụi do san nền, vận chuyển đất</td><td>${f.ew ? `Khối lượng đất di chuyển ${fmtInt(f.ew.cut + f.ew.fill)} m³` : 'Chưa mô phỏng'}</td><td>Tưới ẩm 2–4 lần/ngày, che phủ thùng xe, rào tôn quanh công trường</td></tr>
<tr><td>Nước mưa chảy tràn</td><td>Hiện trạng: ngập ${fmtInt(f.flood0.wetArea)} m², sâu tối đa ${fmt(f.flood0.maxDepth, 2)} m${fl ? `; sau san nền: ${fmtInt(fl.wetArea)} m²` : ''}</td><td>Mương thu tạm, hố lắng trước khi xả ra suối</td></tr>
<tr><td>Tiếng ồn máy thi công</td><td>Mô phỏng theo bố trí cẩu tháp và tuyến xe</td><td>Không thi công gây ồn 22h–6h, bố trí máy xa khu dân cư</td></tr></table>
<p><b>3. Tác động giai đoạn vận hành:</b> dân số dự kiến ${f.m ? '~' + fmtInt(f.m.pop) + ' người' : '[...]'}; nước thải sinh hoạt ước tính ${f.m ? fmtInt(f.m.pop * 0.15) + ' m³/ngày.đêm' : '[...]'} (định mức minh họa 150 l/người/ngày) — cần trạm xử lý nước thải tập trung.</p>
<p><b>4. Kết luận:</b> Dự thảo do AI tổng hợp từ mô hình Digital Twin, cần đơn vị tư vấn môi trường có đủ điều kiện năng lực hoàn thiện, khảo sát quan trắc thực tế và tham vấn cộng đồng theo quy định./.</p>
` + footer(st, 'GIÁM ĐỐC', ['Cơ quan Môi trường', 'Đơn vị tư vấn ĐTM']);
  } else if (type === 'nghiemthu') {
    title = 'Biên bản nghiệm thu khối lượng';
    const prog = f.plan && st.twin.surveyUpdates ? progress4D(f.plan, st.twin.surveyUpdates) : null;
    const byId = f.plan ? Object.fromEntries(f.plan.buildings.map((b) => [b.id, b])) : {};
    body = header(st, `…/BB-NT`, 'BIÊN BẢN', `Nghiệm thu khối lượng hoàn thành (bản cập nhật hiện trạng số ${st.twin.surveyUpdates || '[...]'})`) + `
<p><i>Căn cứ hợp đồng thi công xây dựng số …/${year}/HĐXD;</i></p>
<p><i>Căn cứ dataset hiện trạng đã khai báo nguồn và kết quả đối chiếu mô hình 4D BIM của hệ thống AIPM OS;</i></p>
<p>Hôm nay, ${viLongDate(todayISO())}, tại công trường dự án, chúng tôi gồm: Đại diện Chủ đầu tư; Đại diện Tư vấn giám sát; Đại diện Nhà thầu thi công, đã tiến hành nghiệm thu khối lượng như sau:</p>
${need(prog, 'Chưa có bản cập nhật hiện trạng được xác minh để đối chiếu tiến độ 4D.')}
${prog ? `<table class="vb-tb"><tr><th>Công trình</th><th>Số tầng</th><th>KH (%)</th><th>Hiện trạng đối chiếu (%)</th><th>Sàn hoàn thành (m²)</th><th>Đánh giá</th></tr>
${prog.filter((p) => p.planned > 0).map((p) => { const b = byId[p.id]; return `<tr><td>${p.id}</td><td>${b.floors}</td><td class="r">${fmt(p.planned * 100, 0)}</td><td class="r">${fmt(p.actual * 100, 0)}</td><td class="r">${fmtInt(b.w * b.d * b.floors * p.actual)}</td><td>${p.status === 'đúng' ? 'Đạt' : 'Chậm – yêu cầu bù tiến độ'}</td></tr>`; }).join('')}</table>
<p><b>Kết luận:</b> Kết quả so sánh mô hình chỉ là dữ liệu hỗ trợ. Khối lượng nghiệm thu/thanh toán phải được tư vấn giám sát và người có thẩm quyền xác nhận cùng hồ sơ đo, chất lượng và phạm vi chính xác kèm theo.</p>` : ''}
` + footer(st, 'ĐẠI DIỆN CHỦ ĐẦU TƯ', ['Tư vấn giám sát', 'Nhà thầu thi công', 'Kho bạc Nhà nước']);
  } else if (type === 'demo3') {
    title = 'Tờ trình mẫu Demo 3 (cài sẵn 2 lỗi pháp lý)';
    body = header(st, `…/TTr-BQLDA`, 'TỜ TRÌNH', `Đề nghị thẩm định báo cáo nghiên cứu khả thi dự án ${esc(pr.name)}`) + `
<p class="kg">Kính gửi: Sở Xây dựng.</p>
<p><i>Căn cứ Luật Xây dựng số 135/2025/QH15;</i></p>
<p><i>Căn cứ Nghị định 10/2021/NĐ-CP về quản lý chi phí đầu tư xây dựng;</i></p>
<p><i>Căn cứ QCVN 01:2021/BXD Quy chuẩn kỹ thuật quốc gia về quy hoạch xây dựng;</i></p>
<p><i>Căn cứ Nghị định 30/2020/NĐ-CP về công tác văn thư;</i></p>
<p>${esc(pr.owner)} kính trình Sở Xây dựng thẩm định báo cáo nghiên cứu khả thi dự án với các nội dung chính:</p>
<p><b>1. Địa điểm:</b> ${esc(pr.location)}; thời điểm thẩm định dự kiến: ${esc((pr.appraisalDate || '').split('-').reverse().join('/'))}.</p>
<p><b>2. Quy mô:</b> khối nhà ở cao tối đa 15 tầng; mật độ xây dựng đề xuất 55% trên lô đất ở.</p>
<p><b>3. Tổng mức đầu tư:</b> xác định theo phương pháp và định mức hiện hành.</p>
<p>Kính trình Sở Xây dựng xem xét, thẩm định./.</p>
` + footer(st, 'GIÁM ĐỐC', ['Như trên', 'Lưu hồ sơ dự án']);
  } else {
    // công văn chung cho một mục checklist / bước tra cứu
    const item = opts.item || 'hồ sơ';
    title = 'Dự thảo: ' + item;
    body = header(st, `…/BQLDA-KH`, '', `V/v ${esc(item)}`) + `
<p class="kg">Kính gửi: ${esc(opts.to || 'Sở Xây dựng')}.</p>
<p><i>Căn cứ ${esc(cite[0])};</i></p>
<p>${esc(pr.owner)} đang triển khai dự án ${esc(pr.name)} tại ${esc(pr.location)} (diện tích ${fmt(f.site / 10000, 2)} ha${f.m ? `, quy mô ${f.m.nBuild} công trình, tổng sàn ${fmtInt(f.m.gfa)} m²` : ''}).</p>
<p>Thực hiện bước <b>${esc(item)}</b> theo trình tự tại cổng ${esc(opts.gate || '')} của hệ thống AIPM OS, ${esc(pr.owner)} kính đề nghị Quý cơ quan xem xét, ${esc(opts.action || 'cho ý kiến')} đối với hồ sơ kèm theo.</p>
<p>Hồ sơ gửi kèm: (1) Thuyết minh tóm tắt; (2) Bản vẽ mặt bằng, mặt cắt trích xuất từ mô hình Digital Twin; (3) Các tài liệu pháp lý liên quan.</p>
<p>Rất mong nhận được sự quan tâm của Quý cơ quan./.</p>
` + footer(st, 'GIÁM ĐỐC', ['Như trên', 'Lưu hồ sơ dự án']);
  }
  return { type, title, html: `<div class="vb" data-page="A4">${body}</div>` };
}
