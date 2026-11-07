// =====================================================================
// MOD-00 · Dashboard toàn màn hình đa cấp (Quốc gia → Tỉnh/Thành)
// KPI luôn kèm nguồn & năm; thiếu nguồn → "Chưa có" (nguyên tắc e-City)
// =====================================================================
import { getState, DATA, currentGate } from '../store.js';
import { esc, fmt, fmtInt, download, modal } from '../lib/util.js';
import { generateCity, areaStats, toCSV } from '../lib/citygen.js';
import { TENANTS, TENANT_DETAIL, SOURCES, PLAN_DOCS, PROJECTS, NA, DATASET_VERSION } from '../data/nationwide.js';

const PAGES = [['overview', 'Tổng quan'], ['pop', 'Dân cư'], ['econ', 'Kinh tế địa bàn'], ['budget', 'Ngân sách'], ['plan', 'Quy hoạch & hồ sơ'], ['healthedu', 'Y tế & giáo dục'], ['projects', 'Dự án & Stage-Gate']];
const MODES = [['analysis', 'Phân tích'], ['ops', 'Điều hành'], ['new', 'Nguồn mới'], ['reconcile', 'Đối chiếu']];
const tname = (id) => TENANTS.find((t) => t.id === id)?.name || id;

export function renderDashboard(el, ui, cb) {
  const d = ui.dash, tenant = d.level === 'tenant' ? ui.tenant : null;
  const used = []; // chứng cứ nguồn cho trang
  const k = (label, value, src, year = '') => { used.push([label, value == null ? NA : value, src || '—', year]); return `<div class="mkpi big ${value == null ? 'na' : ''}"><span class="l">${esc(label)}</span><b>${value == null ? NA : value}</b><span class="s">${value == null ? `⚪ chưa nối nguồn${src ? ' · ' + esc(src) : ''}` : `📎 ${esc(src)}${year ? ' · ' + esc(year) : ''}`}</span></div>`; };
  const rows = []; // dữ liệu xuất
  let body = '';
  const projects = PROJECTS.filter((p) => !tenant || p.tenant === tenant).map((p) => (p.live ? { ...p, gate: currentGate().id } : p));
  const S = getState();

  if (!tenant) {
    // ---------------- cấp Quốc gia ----------------
    const byT = TENANTS.map((t) => ({ t, n: PROJECTS.filter((p) => p.tenant === t.id).length }));
    if (d.page === 'projects' || d.page === 'overview') {
      body += `<div class="mgrid g6">${k('Tỉnh/thành (tenant)', '34', 'Danh mục ĐVHC sau sắp xếp 2025 (S-ADM-01)', '2025')}${k('ĐVHC cấp xã', '≈ 3.300', 'S-ADM-01 · cần đối chiếu', '2025')}${k('Tenant có nền 3D LOD1', '2', 'MOD-00 ' + DATASET_VERSION)}${k('Dự án AIPM OS trên bản đồ', String(PROJECTS.length), 'Danh mục dự án (mô phỏng)')}${k('Mảnh công trình 3D toàn quốc', null, 'Mục tiêu ≥ 30 triệu (SRS)')}${k('Người dùng đồng thời', null, 'Chưa vận hành')}</div>`;
      body += `<h4>Drill-down theo tỉnh/thành (nhấp để vào cấp tỉnh)</h4><div class="scroll" style="max-height:420px"><table class="tb"><tr><th>Tỉnh/thành</th><th>Nền 3D</th><th>ĐVHC cấp xã</th><th>Dự án</th><th>Cổng (dự án)</th><th>Rủi ro tiến độ/ngập/vật liệu</th></tr>${byT.sort((a, b) => b.n - a.n).map(({ t, n }) => { const ps = projects.filter((p) => p.tenant === t.id); rows.push({ tinh: t.name, nen3d: t.has3d ? 'có' : 'chưa', dvhc_xa: TENANT_DETAIL[t.id]?.communes ?? '', du_an: n }); return `<tr class="click" data-drill="${t.id}"><td><b>${esc(t.name)}</b></td><td>${t.has3d ? '<span class="badge green">LOD1</span>' : '<span class="badge gray">Chưa có</span>'}</td><td>${TENANT_DETAIL[t.id]?.communes ?? NA}</td><td>${n}</td><td>${ps.map((p) => `<span class="badge blue">${p.gate}</span>`).join(' ')}</td><td>${ps.map((p) => heat(p.risk)).join(' ')}</td></tr>`; }).join('')}</table></div>`;
    } else {
      body += `<div class="disclaimer">Cấp Quốc gia chỉ tổng hợp khi các tenant đã nạp chuyên đề "${esc(PAGES.find((p) => p[0] === d.page)[1])}". Hiện chưa tenant nào nối nguồn thống kê (S-STAT-01) → hiển thị "${NA}". Chọn TP.HCM hoặc Đồng Nai để xem cấp tỉnh.</div><div class="mgrid g6">${k(PAGES.find((p) => p[0] === d.page)[1] + ' – toàn quốc', null, 'S-STAT-01')}</div>`;
    }
  } else {
    // ---------------- cấp Tỉnh/Thành ----------------
    const c = generateCity(tenant), det = TENANT_DETAIL[tenant];
    const wstats = c.wards.map((w) => { const st = areaStats(c, { type: 'poly', pts: w.poly }); return { w, st, fac: c.facilities.filter((f) => f.ward === w.idx), gap: st.count ? (st.methods.PRIOR + st.methods.NONE) / st.count : 0 }; });
    if (d.page === 'overview') {
      body += `<div class="mgrid g6">${k('ĐVHC cấp xã', String(det.communes), 'Danh mục ĐVHC (e-City/S-ADM-01) · cần đối chiếu', '2025')}${k('Mảnh công trình 3D', det.buildingsTotal === NA ? null : det.buildingsTotal, 'e-City citywide-31', '2026')}${k('Mảnh trong cảnh mẫu', fmtInt(c.buildings.length), 'Cảnh mẫu MOD-00 (mô phỏng)', DATASET_VERSION)}${k('Dân số', null, 'Niên giám thống kê (S-STAT-01)')}${k('Luồng sự cố chính thức', null, 'Trung tâm điều hành')}${k('SLA cơ quan', null, 'Hệ thống một cửa')}</div>`;
      body += `<div class="grid g2"><div><h4>Biểu đồ bong bóng toàn bộ địa bàn cấp xã (cảnh mẫu)</h4>${bubble(wstats)}<p class="small muted">Trục X: mật độ ID/km² · Trục Y: trung vị chiều cao · kích thước: số cơ sở dịch vụ. Nguồn: cảnh mẫu MOD-00 + S-FAC-01.</p></div>
        <div><h4>Ma trận địa bàn</h4><div class="scroll" style="max-height:330px">${matrix(wstats)}</div></div></div>
        <h4>Ưu tiên hoàn thiện vị trí</h4><table class="tb small"><tr><th>Xã/phường</th><th>% mảnh chiều cao ước lượng vùng/thiếu</th><th>Cơ sở chưa có tọa độ</th><th>Lý do</th></tr>${wstats.slice().sort((a, b) => b.gap - a.gap).slice(0, 6).map((x) => `<tr><td>${esc(x.w.name)}</td><td>${fmt(x.gap * 100, 1)}%</td><td>${x.fac.filter((f) => !f.hasCoord).length}</td><td class="small">Thiếu nguồn chiều cao chính thức</td></tr>`).join('')}</table>`;
      wstats.forEach((x) => rows.push({ xa_phuong: x.w.name, ma: x.w.id, so_id: x.st.count, trung_vi_h: x.st.median ?? '', mat_do: Math.round(x.st.density), co_so: x.fac.length, nguon: 'Cảnh mẫu MOD-00 + S-FAC-01', phien: DATASET_VERSION }));
    } else if (d.page === 'pop' || d.page === 'econ' || d.page === 'budget') {
      const lbl = { pop: ['Dân số', 'Mật độ dân số', 'Số hộ', 'Tăng dân số cơ học'], econ: ['Doanh nghiệp đang hoạt động', 'Thu nhập bình quân', 'Lao động', 'Cơ sở kinh tế'], budget: ['Thu ngân sách', 'Chi đầu tư phát triển', 'Giải ngân đầu tư công', 'Nợ đọng XDCB'] }[d.page];
      body += `<div class="mgrid g6">${lbl.map((l) => k(l, null, 'Niên giám thống kê (S-STAT-01)')).join('')}</div><div class="disclaimer">Chưa nối nguồn thống kê chính thức của ${esc(tname(tenant))} → hiển thị "${NA}". Hệ thống <b>không nội suy</b> số liệu quản lý từ mô hình 3D.</div>`;
      if (d.page === 'pop') body += `<h4>Chỉ báo không gian thay thế (không phải dân số)</h4><table class="tb small"><tr><th>Xã/phường</th><th>Diện tích sàn ước tính (m²)</th><th>Nguồn</th></tr>${wstats.map((x) => `<tr><td>${esc(x.w.name)}</td><td class="r">${fmtInt(x.st.gfa)}</td><td>Cảnh mẫu · ước tính</td></tr>`).join('')}</table>`;
    } else if (d.page === 'plan') {
      const docs = PLAN_DOCS.filter((x) => x.tenant === tenant);
      const gis = SOURCES.filter((s) => s.theme === 'Quy hoạch');
      body += `<div class="mgrid g6">${k('Hồ sơ trong danh mục', String(docs.length), 'Registry tài liệu (TL-xx)')}${k('Liên kết bản vẽ', String(docs.filter((x) => x.geometry !== 'Không có hình học').length), 'Registry tài liệu')}${k('Ranh đồ án đủ điều kiện', String(docs.filter((x) => x.overlay).length), 'Georeference + kiểm định')}${k('Dịch vụ GIS xác thực', String(gis.filter((s) => s.status === 'xác thực').length), 'S-PLN-01/02')}${k('HEAD 200', String(docs.filter((x) => x.head === 'HEAD 200').length), 'Kiểm tra liên kết')}${k('Sai cấu trúc / chưa đọc được', String(docs.filter((x) => x.head !== 'HEAD 200').length), 'Kiểm tra liên kết')}</div>
        <div class="row"><input id="pq" placeholder="Tìm hồ sơ – bản vẽ theo tên/số quyết định…" style="flex:1"></div><div id="pres"></div>
        <h4>Gợi ý hồ sơ theo địa bàn</h4>${docs.map((x) => `<div class="chk"><span class="i">${x.overlay ? '🟣' : '📄'}</span><div><b>${esc(x.title)}</b> · ${esc(x.no)} · <span class="badge ${x.head === 'HEAD 200' ? 'green' : 'orange'}">${esc(x.head)}</span> <span class="small muted">${esc(x.validity)}</span></div></div>`).join('')}`;
      docs.forEach((x) => rows.push({ ma: x.id, ten: x.title, so: x.no, hinh_hoc: x.geometry, kha_dung: x.head, hieu_luc: x.validity }));
    } else if (d.page === 'healthedu') {
      const f = c.facilities;
      const by = (t) => f.filter((x) => x.type === t);
      body += `<div class="mgrid g6">${k('Trường học (vị trí công bố)', String(by('school').filter((x) => x.hasCoord).length), 'S-FAC-01', '2026')}${k('Trạm y tế (vị trí công bố)', String(by('health').filter((x) => x.hasCoord).length), 'S-FAC-01', '2026')}${k('Điểm phục vụ HCC', String(by('service').filter((x) => x.hasCoord).length), 'S-FAC-01', '2026')}${k('Quy mô có kỳ', String(f.filter((x) => x.capacity).length), 'S-FAC-01')}${k('Năng lực hiện thời', null, 'Sở Y tế / Sở GD&ĐT')}${k('Hàng đợi xác minh', String(f.filter((x) => x.issue).length), 'S-FAC-01')}</div>
        <table class="tb small"><tr><th>Xã/phường</th><th>Trường</th><th>Trạm y tế</th><th>Điểm HCC</th><th>Lỗi xác minh</th></tr>${c.wards.map((w) => { const fw = f.filter((x) => x.ward === w.idx); rows.push({ xa_phuong: w.name, truong: fw.filter((x) => x.type === 'school').length, tram_y_te: fw.filter((x) => x.type === 'health').length, diem_hcc: fw.filter((x) => x.type === 'service').length, loi: fw.filter((x) => x.issue).length }); return `<tr><td>${esc(w.name)}</td><td>${fw.filter((x) => x.type === 'school').length}</td><td>${fw.filter((x) => x.type === 'health').length}</td><td>${fw.filter((x) => x.type === 'service').length}</td><td>${fw.filter((x) => x.issue).length}</td></tr>`; }).join('')}</table>`;
    }
  }
  if (d.page === 'projects') {
    const late = S.workflow.filter((w) => (!tenant || w.tenant === tenant) && w.at < w.route.length && w.days > w.sla);
    const byGate = DATA.gates.map((g) => ({ g, n: projects.filter((p) => p.gate === g.id).length }));
    const mx = Math.max(1, ...byGate.map((x) => x.n));
    if (tenant) body += `<div class="mgrid g6">${k('Dự án trên địa bàn', String(projects.length), 'Danh mục AIPM OS (mô phỏng)')}${k('Hồ sơ trễ hạn (BPMN)', String(late.length), 'MOD-06 · thời gian thực')}${k('Gói nguy cơ trễ', String(projects.filter((p) => p.risk.schedule >= 2).length), 'MOD-06 (mô phỏng)')}${k('Tỷ lệ thực hiện/hợp đồng', null, 'Hệ thống quản lý hợp đồng')}${k('Hồ sơ AI đã tạo', String(S.docs.length), 'MOD-04')}${k('Cổng dự án thí điểm', currentGate().id, 'MOD-06 · thời gian thực')}</div>`;
    body += `<div class="grid g2"><div><h4>Số dự án theo cổng G0–G16</h4><div class="gbar">${byGate.map((x) => `<div title="${esc(x.g.name)}"><i style="height:${(x.n / mx) * 100}%"></i><b>${x.n || ''}</b><span>${x.g.id}</span></div>`).join('')}</div></div>
      <div><h4>Bản đồ nhiệt rủi ro tiến độ – ngập – vật liệu</h4><table class="tb small"><tr><th>Dự án</th><th>Tỉnh</th><th>Cổng</th><th>Tiến độ</th><th>Ngập</th><th>Vật liệu</th></tr>${projects.map((p) => { rows.push({ du_an: p.id, ten: p.name, tinh: tname(p.tenant), cong: p.gate, rui_ro_tien_do: p.risk.schedule, rui_ro_ngap: p.risk.flood, rui_ro_vat_lieu: p.risk.material, nguon: p.live ? 'MOD-06 thời gian thực' : 'mô phỏng' }); return `<tr class="click" data-proj="${p.id}"><td><b>${p.id}</b><div class="small muted">${esc(p.name)}</div></td><td>${esc(tname(p.tenant))}</td><td><span class="badge blue">${p.gate}</span></td>${['schedule', 'flood', 'material'].map((r) => `<td class="hm h${p.risk[r]}">${['Thấp', 'TB', 'Cao'][p.risk[r]]}</td>`).join('')}</tr>`; }).join('')}</table></div></div>
      <h4>Hồ sơ trễ hạn</h4>${late.map((w) => `<div class="small">🚨 <b>${w.id}</b> ${esc(w.title)} — ${w.days}/${w.sla} ngày · ${esc(w.ward || '')}</div>`).join('') || '<div class="small muted">Không có</div>'}`;
  }
  // khối theo chế độ
  const modeBlock = {
    analysis: '',
    ops: `<div class="dash-mode"><b>Chế độ Điều hành</b> · Hàng đợi: ${S.workflow.filter((w) => w.at < w.route.length && w.days > w.sla).length} hồ sơ quá SLA · ${getState().map.tasks.length} công việc đô thị · Sự kiện chính thức: ${NA}</div>`,
    new: `<div class="dash-mode"><b>Chế độ Nguồn mới</b> · ${SOURCES.filter((s) => /2026/.test(s.observed)).map((s) => `<span class="badge blue">${s.id} · ${esc(s.observed)}</span>`).join(' ')}</div>`,
    reconcile: `<div class="dash-mode"><b>Chế độ Đối chiếu</b> · ${SOURCES.filter((s) => s.status !== 'xác thực').map((s) => `<span class="badge orange">${s.id}: ${esc(s.status)}</span>`).join(' ')}</div>`,
  }[d.mode];
  el.innerHTML = `<div class="dash-in">
    <div class="dash-h"><div><div class="kicker">Dashboard toàn màn hình · MOD-00</div><h2>Bức tranh ${tenant ? esc(tname(tenant)) : 'toàn quốc'}</h2><div class="small muted">Cấp: <a data-drill="">Quốc gia</a>${tenant ? ` › <b>${esc(tname(tenant))}</b>` : ''} · phiên dữ liệu ${DATASET_VERSION} · số liệu mô phỏng ghi rõ nguồn</div></div>
      <div class="row"><select id="dl"><option value="">Quốc gia</option>${TENANTS.map((t) => `<option value="${t.id}" ${t.id === tenant ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select><button class="btn sm" id="ev">📎 Chứng cứ nguồn</button><button class="btn sm" id="ex">⬇ Xuất dữ liệu</button><button class="btn sm pri" id="cl">✕ Đóng</button></div></div>
    <div class="row"><div class="steps">${PAGES.map(([id, l]) => `<button data-p="${id}" class="${d.page === id ? 'on' : ''}">${l}</button>`).join('')}</div><span class="spacer"></span><div class="steps">${MODES.map(([id, l]) => `<button data-m="${id}" class="${d.mode === id ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${modeBlock}<div class="dash-b">${body}</div></div>`;
  el.querySelector('#cl').onclick = cb.close;
  el.querySelector('#dl').onchange = (e) => cb.drill(e.target.value || null);
  el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { d.page = b.dataset.p; cb.rerender(); }));
  el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { d.mode = b.dataset.m; cb.rerender(); }));
  el.querySelectorAll('[data-drill]').forEach((b) => (b.onclick = () => cb.drill(b.dataset.drill || null)));
  el.querySelectorAll('[data-proj]').forEach((b) => (b.onclick = () => cb.flyProject(b.dataset.proj)));
  el.querySelector('#ev').onclick = () => modal({ wide: true, title: '📎 Chứng cứ nguồn của trang', body: `<table class="tb"><tr><th>Chỉ số</th><th>Giá trị</th><th>Nguồn</th><th>Năm/phiên</th></tr>${used.map((u) => `<tr><td>${esc(u[0])}</td><td>${esc(u[1])}</td><td>${esc(u[2])}</td><td>${esc(u[3])}</td></tr>`).join('')}</table><p class="small muted">Chi tiết giấy phép/độ phủ: tab Nguồn của bảng thông tin.</p>`, actions: [{ label: 'Đóng', cls: 'btn' }] });
  el.querySelector('#ex').onclick = () => { const r = rows.length ? rows : used.map((u) => ({ chi_so: u[0], gia_tri: u[1], nguon: u[2], nam: u[3] })); download(`Dashboard_${tenant || 'quocgia'}_${d.page}.csv`, toCSV(r), 'text/csv;charset=utf-8'); };
  const pq = el.querySelector('#pq');
  if (pq) pq.oninput = () => { const q = pq.value.toLowerCase(); el.querySelector('#pres').innerHTML = q.length < 2 ? '' : PLAN_DOCS.filter((x) => `${x.title} ${x.no}`.toLowerCase().includes(q)).map((x) => `<div class="small">🔎 <b>${esc(x.title)}</b> · ${esc(x.no)} · ${esc(tname(x.tenant))}</div>`).join('') || '<div class="small muted">Không tìm thấy</div>'; };
}

function heat(r) { return `<span class="hm h${Math.max(r.schedule, r.flood, r.material)}" style="padding:1px 6px;border-radius:5px">${r.schedule}/${r.flood}/${r.material}</span>`; }
function bubble(ws) {
  const W = 520, H = 280, xs = ws.map((x) => x.st.density), ys = ws.map((x) => x.st.median || 0);
  const mx = Math.max(1, ...xs), my = Math.max(1, ...ys);
  const top = new Set(ws.slice().sort((a, b) => b.st.density - a.st.density).slice(0, 6).map((x) => x.w.idx));
  return `<svg viewBox="0 0 ${W} ${H}" class="timeseries"><line x1="40" y1="${H - 30}" x2="${W - 10}" y2="${H - 30}" stroke="#94a3b8"/><line x1="40" y1="10" x2="40" y2="${H - 30}" stroke="#94a3b8"/>
    ${ws.map((x) => { const cx = 40 + (x.st.density / mx) * (W - 60), cy = H - 30 - ((x.st.median || 0) / my) * (H - 50); return `<circle cx="${cx}" cy="${cy}" r="${5 + x.fac.length * 2}" fill="#076da5" fill-opacity=".35" stroke="#076da5"><title>${esc(x.w.name)}: ${fmtInt(x.st.density)} ID/km², h=${fmt(x.st.median || 0, 1)} m, ${x.fac.length} cơ sở</title></circle>${top.has(x.w.idx) ? `<text x="${cx}" y="${cy - 8 - x.fac.length * 2}" text-anchor="middle">${esc(x.w.name.replace(/^(Phường|Xã) /, ''))}</text>` : ''}`; }).join('')}
    <text x="${W / 2}" y="${H - 8}" text-anchor="middle">Mật độ ID/km²</text><text x="12" y="20">h</text></svg>`;
}
function matrix(ws) {
  const cols = [['Số ID', (x) => x.st.count], ['h trung vị', (x) => x.st.median || 0], ['ID/km²', (x) => x.st.density], ['Cơ sở', (x) => x.fac.length], ['% ước lượng', (x) => x.gap * 100]];
  const max = cols.map(([, f]) => Math.max(1, ...ws.map(f)));
  return `<table class="tb small mtx"><tr><th>Xã/phường</th>${cols.map(([l]) => `<th>${l}</th>`).join('')}</tr>${ws.map((x) => `<tr><td>${esc(x.w.name)}</td>${cols.map(([, f], i) => `<td style="background:rgba(7,109,165,${(f(x) / max[i]) * 0.55})">${fmt(f(x), i === 1 || i === 4 ? 1 : 0)}</td>`).join('')}</tr>`).join('')}</table>`;
}
