import { getState, setState, DATA, gateStatus, overallChecklist, currentGate } from '../store.js';
import { esc, pct } from '../lib/util.js';
import { openCopilot } from '../copilot.js';

let root;
export function render(el) {
  root = el;
  draw();
}
export function update() { if (root?.isConnected) draw(); }

function draw() {
  const st = getState();
  const passed = DATA.gates.filter((g) => gateStatus(g.id) === 'passed').length;
  const cl = overallChecklist();
  const cg = currentGate();
  const late = st.workflow.filter((w) => w.days > w.sla).length;
  const twinSteps = ['dataReady', 'reconstructed', 'qtoReady', 'scenario', 'earthwork', 'flood', 'export2d', 'export3d'].filter((k) => !!st.twin[k]).length;
  const filters = [['all', '🌐 Tất cả dự án'], ['ht', '🏗 Hạ tầng kỹ thuật'], ['dd', '🏢 Dân dụng'], ['ppp', '🤝 Đối tác công tư (PPP/BT)']];
  root.innerHTML = `
  <section class="hero">
    <div class="partner">🤝 Đề xuất hợp tác chiến lược · <b>AIPM OS</b> × <b>Công ty TNHH Khoa học Công nghệ Bình Phúc</b></div>
    <h1>AIPM OS – Từ hệ thống tra cứu/checklist thành <span style="color:var(--accent)">Hệ điều hành thực thi tự động</span> với AI Digital Twin & AI Copilot chuyên ngành Xây dựng</h1>
    <p>Bản đồ 3D toàn quốc 34 tỉnh/thành (MOD-00, tham chiếu e-City) → dữ liệu BIM/CAD, GIS, địa hình và hiện trạng đa nguồn → Digital Twin có phiên bản → QTO/BOM → kiểm thử 18 kịch bản → hồ sơ có truy vết → điều phối Stage-Gate/4D/5D. Thiết bị khảo sát là nguồn dữ liệu bên ngoài, không phải module hay điều kiện bắt buộc.</p>
    <div class="tags"><span>Nationwide 3D City Base</span><span>Multi-tenant 34 tỉnh/thành</span><span>Multi-source Ingestion</span><span>BIM / GIS / Point Cloud</span><span>Digital Twin 3D/2D</span><span>QTO / BOM A-B-C</span><span>18 Engineering Scenarios</span><span>L0–L3 Trust Levels</span><span>Stage-Gate G0–G16</span><span>4D/5D Workflow</span></div>
  </section>

  <div class="row">${filters.map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
    <span class="spacer"></span><span class="small muted">Dự án thí điểm: <b>${esc(st.project.name)}</b></span></div>

  <div class="grid g4">
    <div class="kpi"><span class="l">Cổng Stage-Gate đã qua</span><span class="v">${passed}/17</span><div class="bar g"><i style="width:${pct(passed, 17)}%"></i></div><span class="small muted">Cổng hiện tại: <b>${cg.id} – ${esc(cg.name)}</b></span></div>
    <div class="kpi"><span class="l">Checklist áp dụng hiện tại</span><span class="v">${cl.done}/${cl.total}</span><div class="bar"><i style="width:${pct(cl.done, cl.total)}%"></i></div><span class="small muted">Theo cấu hình demo · cần đối soát trước baseline</span></div>
    <div class="kpi"><span class="l">Hồ sơ do AI khởi tạo</span><span class="v">${st.docs.length}</span><div class="bar o"><i style="width:${Math.min(100, st.docs.length * 20)}%"></i></div><span class="small muted">Đã kiểm thể thức NĐ 30/2020 & pháp lý</span></div>
    <div class="kpi"><span class="l">Hồ sơ vượt SLA (BPMN)</span><span class="v" style="color:${late ? 'var(--red)' : 'var(--green)'}">${late}</span><div class="bar o"><i style="width:${pct(late, st.workflow.length)}%"></i></div><span class="small muted">Trên ${st.workflow.length} hồ sơ đang luân chuyển</span></div>
  </div>

  <section class="panel">
    <div class="ph"><div><div class="kicker">Giá trị cho 3 tệp người dùng trọng tâm</div><h2>Bắt đầu theo vai trò của bạn</h2></div></div>
    <div class="grid g3">
      <div class="card click" data-go="twin"><span class="ic">👷</span><h4>1. Đội Thi công & Kỹ thuật – Thiết kế</h4>
        <p class="small muted">Nhập BIM/IFC, DEM/GIS hoặc point cloud; kiểm tra CRS/chất lượng; lập phương án, QTO/BOM và chạy kịch bản với mức L0–L3 minh bạch.</p>
        <div class="bar g"><i style="width:${pct(twinSteps, 8)}%"></i></div><span class="small">Tiến trình Digital Twin: ${twinSteps}/8 bước</span>
        <button class="btn pri sm" style="align-self:flex-start">Mở Digital Twin →</button></div>
      <div class="card click" data-go="docs"><span class="ic">📑</span><h4>2. Đội Hồ sơ & Pháp lý</h4>
        <p class="small muted">AI trích xuất số liệu từ mô hình 3D để soạn Tờ trình chủ trương đầu tư, Sơ bộ TMĐT, ĐTM, biên bản nghiệm thu; kiểm thể thức NĐ 30/2020 và rà soát căn cứ pháp lý hết hiệu lực.</p>
        <div class="bar o"><i style="width:${Math.min(100, st.docs.length * 20)}%"></i></div><span class="small">${st.docs.length} hồ sơ đã khởi tạo</span>
        <button class="btn pri sm" style="align-self:flex-start">Mở Hồ sơ AI →</button></div>
      <div class="card click" data-go="timeline"><span class="ic">📊</span><h4>3. Đội Quản lý Dự án</h4>
        <p class="small muted">Timeline theo cổng và đường găng; đối chiếu tiến độ bằng dữ liệu hiện trạng đã xác minh từ nguồn phù hợp; baseline chỉ đổi sau phê duyệt.</p>
        <div class="bar"><i style="width:${pct(passed, 17)}%"></i></div><span class="small">${passed}/17 cổng · ${late} điểm nghẽn</span>
        <button class="btn pri sm" style="align-self:flex-start">Mở Timeline 4D →</button></div>
    </div>
  </section>

  <section class="panel">
    <div class="ph"><div><div class="kicker">Kiến trúc MOD-00 + 6 module chuyên môn</div><h2>Một nền bản đồ 3D toàn quốc — mọi dự án, hồ sơ, cổng đều có vị trí</h2><p>Các module dùng chung IAM/RBAC theo tenant, versioning, audit, checksum, registry nguồn và adapter dịch vụ ngoài.</p></div></div>
    <div class="grid g4">
      ${[
        ['⓪', 'MOD-00 · Bản đồ 3D toàn quốc', 'Nền 3D LOD0–LOD3 cho 34 tỉnh/thành, provenance, phân tích khu vực, điều hành, dashboard đa cấp.', 'map'],
        ['①', 'MOD-01 · Dữ liệu đa nguồn', 'Import, validation, CRS/đơn vị, provenance và version cho BIM/GIS/hiện trạng.', 'twin'],
        ['②', 'MOD-02 · Planning, QTO & Simulation', 'Phương án, QTO/BOM A-B-C, 18 kịch bản và adapter solver.', 'twin'],
        ['③', 'MOD-03 · Digital Twin Viewer', '3D/2D, timeline, lớp kết quả có legend, runId và mức L0–L3.', 'twin'],
        ['④', 'MOD-04 · Hồ sơ & Dự toán AI', 'Bản thảo có nguồn số liệu; không tự điền chỉ số kỹ thuật còn thiếu.', 'docs'],
        ['⑤', 'MOD-05 · Pháp lý & Tuân thủ', 'Căn cứ/rule có phiên bản; cảnh báo cần xác minh thay vì tự kết luận.', 'legal'],
        ['⑥', 'MOD-06 · Workflow, 4D/5D', 'Stage-Gate, BPMN, Gantt, vật tư, hiện trạng và baseline.', 'timeline'],
      ].map(([i, t, d, go]) => `<div class="card click" data-go="${go}"><span class="badge green corner">P0 DEMO</span><span class="ic">${i}</span><h4>${t}</h4><p class="small muted" style="margin:0">${d}</p></div>`).join('')}
    </div>
  </section>

  <div class="grid g2">
    <section class="panel">
      <div class="ph"><div><div class="kicker">Lộ trình đồng hành</div><h3>Kế hoạch phối hợp 3 giai đoạn & nghiệm thu</h3></div></div>
      <div class="col">
        ${[
          ['Giai đoạn 1', 'Nền tảng Demo/PoC', 'Nhập IFC/DEM/point cloud, viewer, QTO/BOM, 18 kịch bản và một ca L0 minh bạch.', !!st.twin.dataReady],
          ['Giai đoạn 2', 'Pilot theo dự án thật', 'Mapping BIM, solver đã V&V, rule/hồ sơ và 4D/5D trên WBS thật.', passed >= 3],
          ['Giai đoạn 3', 'Hoàn thành, đánh giá & nghiệm thu', 'Tập hợp bản vẽ 3D/2D, bộ hồ sơ, báo cáo tiến độ; đo hiệu quả; ký biên bản nghiệm thu.', passed >= 16],
        ].map(([a, b, c, ok]) => `<div class="task ${ok ? 'done' : ''}"><h5>${ok ? '✅' : '⏳'} ${a}: ${b}</h5><p>${c}</p></div>`).join('')}
        <div class="disclaimer"><b>Tiêu chí nghiệm thu đề xuất:</b> độ chính xác mô hình và hồ sơ · thời gian tiết kiệm · tính tuân thủ pháp lý · sự thuận tiện cho người dùng.</div>
      </div>
    </section>
    <section class="panel">
      <div class="ph"><div><div class="kicker">Risk Matrix</div><h3>Rủi ro trọng yếu theo cổng</h3></div><button class="btn ai sm" id="aiRisk">🤖 AI phân tích rủi ro</button></div>
      <div class="scroll" style="max-height:330px"><table class="tb"><tr><th>Mã</th><th>Gate</th><th>Rủi ro</th><th>Mức</th></tr>
      ${DATA.risks.map((r) => `<tr><td>${r.riskId}</td><td><span class="badge blue">${r.gate}</span></td><td>${esc(r.description)}<div class="small muted">↳ ${esc(r.mitigation)}</div></td><td><span class="badge ${r.level === 'Cao' || r.level === 'Rất cao' ? 'red' : 'orange'}">${r.level}</span></td></tr>`).join('')}
      </table></div>
    </section>
  </div>`;
  root.querySelectorAll('[data-go]').forEach((c) => (c.onclick = () => (location.hash = c.dataset.go)));
  root.querySelectorAll('[data-f]').forEach((c) => (c.onclick = () => setState((s) => (s.filter = c.dataset.f))));
  root.querySelector('#aiRisk').onclick = () => openCopilot('Phân tích 3 rủi ro lớn nhất của dự án ở cổng hiện tại, kèm biện pháp ứng phó và người chịu trách nhiệm');
}
