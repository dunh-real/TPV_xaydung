/* Legacy snapshot retained by the shared-drive filesystem. The active implementation is twin-v2.js.
import { getState, setState } from '../store.js';
import { TwinScene } from '../lib/scene3d.js';
import { SITE, demGrid, polyArea, polyPerimeter, obstacles, generatePlan, planMetrics, scorePlans, earthwork, balancedPad, gradedSurface, floodSim, sunPos, constructionSim, progress4D } from '../lib/engine.js';
import { planSVG, sectionSVG, planDXF, sectionDXF, svgToPng } from '../lib/drawing.js';
import { esc, fmt, fmtInt, toast, sleep, download, todayISO } from '../lib/util.js';
import { openCopilot } from '../copilot.js';

let root, scene, step = 1, view = '3d';
const L = { style: 'height', cloud: true, trees: true, contours: false, plan: true, water: true, cranes: true, graded: false, heat: false };
const sim = { tab: 'earth', rain: 90, dur: 2, drain: 60, hour: 9, month: 6, wind: 'SW', windOn: false, craneR: 55, fireDist: 10, secY: 150, preview: null };
let scores = null;

export function render(el) {
  root = el;
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const mode = qs.get('mode');
  if (mode) {
    step = { drone: 1, plan: 2, earth: 3, flood: 3, cons: 3, export: 4 }[mode] || 1;
    if (['earth', 'flood', 'cons'].includes(mode)) sim.tab = mode;
    if (mode === 'export') view = '2d';
  }
  root.innerHTML = `
  <div class="twin">
    <div class="left">
      <section class="panel" style="padding:12px">
        <div class="kicker">Phân hệ 1 + 2</div><h3 style="color:var(--primary2);margin-bottom:10px">Drone Surveying & AI Digital Twin</h3>
        <div class="steps" id="steps">${['1 Drone', '2 Quy hoạch', '3 Mô phỏng', '4 Xuất bản vẽ'].map((s, i) => `<button data-s="${i + 1}">${s}</button>`).join('')}</div>
      </section>
      <div id="stepbox" class="stepbox"></div>
    </div>
    <div class="col" style="gap:10px">
      <div class="row"><div class="steps" style="width:260px"><button data-v="3d">🧊 Mô hình 3D</button><button data-v="2d">📐 Bản vẽ 2D</button></div>
        <span class="spacer"></span><span class="small muted" id="crumb"></span></div>
      <div class="viewer" id="viewer">
        <div class="vw-tools" id="vwtools">
          <button class="btn sm" data-cam="iso">🧭 Phối cảnh</button><button class="btn sm" data-cam="top">⬇ Từ trên</button><button class="btn sm" data-cam="south">Mặt Nam</button><button class="btn sm" data-cam="east">Mặt Đông</button>
          <button class="btn sm" id="shot">📷 Ảnh</button>
        </div>
        <div class="vw-hud" id="hud"></div>
        <div class="vw-layers" id="layers"></div>
      </div>
      <div id="view2d" style="display:none" class="col"></div>
    </div>
    <div class="right" id="right"></div>
  </div>`;
  scene = new TwinScene(root.querySelector('#viewer'));
  root.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { step = +b.dataset.s; if (step === 4) view = '2d'; drawAll(); }));
  root.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { view = b.dataset.v; drawAll(); }));
  root.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => scene.view(b.dataset.cam)));
  root.querySelector('#shot').onclick = () => { const a = document.createElement('a'); a.href = scene.screenshot(); a.download = `DigitalTwin_${todayISO()}.png`; a.click(); };
  drawAll();
  return () => { scene.dispose(); scene = null; };
}

const T = () => getState().twin;
const plan = () => (T().scenario ? generatePlan(T().scenario, getState().params) : null);
const curPad = () => T().pad ?? balancedPad(1.0, plan()?.lakes || []);

function drawAll() {
  root.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === step));
  root.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  root.querySelector('#viewer').style.display = view === '3d' ? '' : 'none';
  root.querySelector('#view2d').style.display = view === '2d' ? '' : 'none';
  if (view === '3d') setTimeout(() => scene?.resize(), 0);
  stepBox();
  refreshScene();
  right();
  if (view === '2d') draw2d();
}

// ------------------------------------------------------------------ cảnh 3D
function refreshScene() {
  if (!scene) return;
  const t = T();
  const p = sim.preview ? generatePlan(sim.preview, getState().params) : plan();
  const pad = p ? curPad() : null;
  scene.layer('terrain', t.reconstructed);
  scene.layer('cloud', t.scanned && (!t.reconstructed || L.cloud));
  if (t.scanned) scene.showFullCloud();
  scene.layer('trees', t.reconstructed && !t.filtered ? true : t.reconstructed && L.trees && !p);
  scene.layer('contours', t.reconstructed && L.contours);
  scene.layer('boundary', true);
  // bề mặt: hiện trạng hay sau san nền
  const g = demGrid();
  if (t.reconstructed) {
    scene.setSurface(L.graded && p ? gradedSurface(pad, p.lakes) : g.h);
    if (L.heat && p) scene.setTerrainStyle('heat', { pad });
    else scene.setTerrainStyle(L.style === 'ortho' ? 'ortho' : 'height');
  }
  const showProg = step === 3 && sim.tab === '4d' && t.flight > 0 && p;
  scene.buildPlan(L.plan ? p : null, pad, showProg ? progress4D(p, t.flight) : null);
  scene.layer('plan', !!p && L.plan);
  // nước
  if (step === 3 && sim.tab === 'flood' && t.reconstructed) {
    const surf = L.graded && p ? gradedSurface(pad, p.lakes) : null;
    const fr = floodSim({ rain: sim.rain, dur: sim.dur, C: surf ? 0.75 : 0.45, drain: surf ? sim.drain : 30, surface: surf });
    scene.setWater(L.water ? fr.level : null);
  } else scene.setWater(null);
  // cẩu tháp
  if (step === 3 && sim.tab === 'cons' && p) scene.setCranes(L.cranes ? constructionSim(p, sim).cranes : null, pad);
  else scene.setCranes(null);
  if (step === 3 && sim.tab === 'sun') { scene.setSun(sim.hour, sim.month); scene.setWind(sim.wind === 'SW' ? 225 : 45, sim.windOn); }
  else { scene.setSun(9, 6); scene.setWind(0, false); }
  layersBar(p);
  hud(p, pad);
}

function layersBar(p) {
  const t = T();
  const items = [];
  if (t.reconstructed) {
    items.push(['style', 'Ortho', L.style === 'ortho'], ['contours', 'Đồng mức', L.contours], ['cloud', 'Point cloud', L.cloud]);
    if (p) items.push(['plan', 'Quy hoạch', L.plan], ['graded', 'Mặt bằng sau san nền', L.graded], ['heat', 'Bản đồ đào/đắp', L.heat]);
    if (step === 3 && sim.tab === 'flood') items.push(['water', 'Mặt nước ngập', L.water]);
    if (step === 3 && sim.tab === 'cons') items.push(['cranes', 'Cẩu tháp', L.cranes]);
  }
  const box = root.querySelector('#layers');
  box.innerHTML = items.map(([k, l, on]) => `<label><input type="checkbox" data-l="${k}" ${on ? 'checked' : ''}> ${l}</label>`).join('');
  box.querySelectorAll('[data-l]').forEach((c) => (c.onchange = () => {
    const k = c.dataset.l;
    if (k === 'style') L.style = c.checked ? 'ortho' : 'height';
    else L[k] = c.checked;
    if (k === 'heat' && c.checked) L.style = 'height';
    refreshScene();
  }));
}

function hud(p, pad) {
  const t = T(), g = demGrid();
  let h = `<b>${esc(getState().project.code)}</b> · Digital Twin<br>`;
  if (!t.scanned) h += '⚪ Chưa có dữ liệu hiện trạng<br><span class="small">Bước 1: bay quét Drone</span>';
  else {
    h += `Diện tích: <b>${fmt(polyArea() / 10000, 2)} ha</b><br>Cao độ: ${fmt(g.min, 1)} – ${fmt(g.max, 1)} m<br>`;
    if (p) h += `PA: <b>${esc(p.name.split('–')[0])}</b> · ${p.buildings.length} CT<br>San nền: +${pad.toFixed(2)} m<br>`;
    if (step === 3 && sim.tab === 'sun') { const s = sunPos(sim.hour, sim.month); h += `☀ Cao độ MT ${fmt(s.alt, 0)}°, phương vị ${fmt((s.az + 360) % 360, 0)}°<br>`; }
    h += `<span class="small">Phóng đại đứng ×1,6</span>`;
  }
  root.querySelector('#hud').innerHTML = h;
  root.querySelector('#crumb').textContent = ['', 'Bước 1 · Khảo sát hiện trạng bằng Drone', 'Bước 2 · AI sinh kịch bản quy hoạch', 'Bước 3 · Mô phỏng kiểm thử phương án', 'Bước 4 · Xuất bản vẽ 3D/2D chuẩn kỹ thuật'][step];
}

// ------------------------------------------------------------------ cột trái
function stepBox() {
  const box = root.querySelector('#stepbox');
  const t = T();
  const S = getState();
  if (step === 1) {
    box.innerHTML = `
    <div class="task ${t.scanned ? 'done' : ''}"><h5>${t.scanned ? '✅' : '①'} Bay rà quét tự động (Photogrammetry + LiDAR)</h5>
      <p>Tuyến bay zig-zag tự sinh theo ranh giới; độ cao 75 m, chồng phủ dọc 80% / ngang 70%, GSD ≈ 2 cm/px.</p>
      <button class="btn ${t.scanned ? '' : 'pri'}" id="fly">${t.scanned ? '↻ Bay lại' : '🛰 Bắt đầu bay quét'}</button></div>
    <div class="task ${t.reconstructed ? 'done' : ''}"><h5>${t.reconstructed ? '✅' : '②'} AI xử lý & tái tạo địa hình</h5>
      <p>Lọc nhiễu (cây cối, vật cản tạm thời), phân loại lớp đất/công trình, dựng DEM/DSM, đám mây điểm 3D và bình đồ ảnh trực giao (Orthomosaic).</p>
      <button class="btn ${t.reconstructed ? '' : 'pri'}" id="recon" ${t.scanned ? '' : 'disabled'}>🤖 Chạy AI tái tạo</button><div id="reconLog" class="small"></div></div>
    <div class="task ${t.gis ? 'done' : ''}"><h5>${t.gis ? '✅' : '③'} Đồng bộ lớp GIS / Quy hoạch (Cổng G0)</h5>
      <p>Đẩy ranh giới khu đất, mốc giới (VN-2000) và hiện trạng vào lớp GIS của AIPM OS.</p>
      <button class="btn ${t.gis ? '' : 'pri'}" id="gis" ${t.reconstructed ? '' : 'disabled'}>🗺 Đồng bộ GIS</button>
      ${t.gis ? `<table class="tb small"><tr><th>Mốc</th><th>X (N)</th><th>Y (E)</th></tr>${SITE.boundary.map(([x, y], i) => `<tr><td>M${i + 1}</td><td>${fmt(SITE.origin.N + y, 2)}</td><td>${fmt(SITE.origin.E + x, 2)}</td></tr>`).join('')}</table><p class="small">Diện tích ${fmt(polyArea(), 1)} m² · chu vi ${fmt(polyPerimeter(), 1)} m</p>` : ''}</div>`;
    box.querySelector('#fly').onclick = fly;
    box.querySelector('#recon').onclick = recon;
    box.querySelector('#gis').onclick = () => { setState((s) => (s.twin.gis = true)); toast('🗺 Đã đồng bộ ranh giới & mốc giới vào lớp GIS — điều kiện cổng G0 đạt', 'ok'); drawAll(); };
  } else if (step === 2) {
    const P = S.params;
    if (!t.reconstructed) { box.innerHTML = need('Cần hoàn thành Bước 1 (dữ liệu địa hình) trước khi AI sinh phương án quy hoạch.'); return; }
    box.innerHTML = `
    <div class="task"><h5>Chỉ tiêu quy hoạch khống chế</h5>
      <div class="grid g2" style="gap:8px">
        <label class="f">MĐXD tối đa (%)<input type="number" data-p="mdxd" value="${P.mdxd}" min="10" max="80"></label>
        <label class="f">HSSDĐ tối đa (lần)<input type="number" step="0.1" data-p="far" value="${P.far}"></label>
        <label class="f">Tầng cao tối thiểu<input type="number" data-p="floorsMin" value="${P.floorsMin}" min="1" max="40"></label>
        <label class="f">Tầng cao tối đa<input type="number" data-p="floorsMax" value="${P.floorsMax}" min="1" max="40"></label>
        <label class="f">Khoảng lùi (m)<input type="number" data-p="setback" value="${P.setback}" min="0" max="20"></label>
      </div>
      <button class="btn pri" id="gen">🤖 AI sinh & chấm điểm phương án</button></div>
    <div id="sclist" class="col"></div>`;
    box.querySelectorAll('[data-p]').forEach((i) => (i.onchange = () => { setState((s) => (s.params[i.dataset.p] = +i.value), true); scores = null; }));
    box.querySelector('#gen').onclick = async (e) => {
      e.target.innerHTML = '<span class="spin"></span> AI đang tối ưu bố trí tổng mặt bằng…';
      await sleep(900);
      scores = scorePlans(getState().params);
      e.target.innerHTML = '🤖 AI sinh & chấm điểm phương án';
      scList();
    };
    if (!scores) scores = t.scenario ? scorePlans(P) : null;
    scList();
  } else if (step === 3) {
    if (!t.reconstructed) { box.innerHTML = need('Cần dữ liệu địa hình (Bước 1).'); return; }
    const tabs = [['earth', '⛏ San nền'], ['flood', '🌧 Ngập úng'], ['sun', '☀ Nắng–gió'], ['cons', '🏗 Thi công & PCCC'], ['4d', '📈 Tiến độ 4D']];
    box.innerHTML = `<div class="row" style="gap:5px">${tabs.map(([k, l]) => `<button class="btn sm ${sim.tab === k ? 'pri' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="simbox" class="col"></div>`;
    box.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { sim.tab = b.dataset.tab; L.heat = sim.tab === 'earth'; drawAll(); }));
    simBox();
  } else {
    box.innerHTML = `
    <div class="task ${t.export2d ? 'done' : ''}"><h5>📐 Bản vẽ kỹ thuật 2D (CAD/PDF)</h5><p>Mặt bằng quy hoạch tổng thể, đường đồng mức, bảng cân bằng đất đai, khung tên; mặt cắt địa hình tự nhiên/thiết kế. Hệ tọa độ VN-2000 giả định.</p>
      <div class="row"><button class="btn sm pri" id="dxfP">⬇ DXF mặt bằng</button><button class="btn sm" id="dxfS">⬇ DXF mặt cắt</button><button class="btn sm" id="svg">⬇ SVG</button><button class="btn sm" id="png">⬇ PNG</button><button class="btn sm" id="pdf">🖨 PDF</button></div>
      <p class="small muted">File DXF mở được bằng AutoCAD, QGIS hoặc <b>DXF Toolkit</b> để đo đạc, chia lô, căn chỉnh bản đồ nền.</p></div>
    <div class="task ${t.export3d ? 'done' : ''}"><h5>🧊 Mô hình 3D Digital Twin (WebGL/glTF → BIM/CDE)</h5><p>Mô hình tương tác trên trình duyệt, bật/tắt lớp kịch bản; xuất .glb để đưa vào môi trường dữ liệu chung (CDE).</p>
      <div class="row"><button class="btn sm pri" id="glb">⬇ Xuất .GLB</button><button class="btn sm" id="cde">☁ Đẩy bộ bản vẽ lên CDE</button></div></div>
    <div class="task"><h5>✂ Mặt cắt địa hình</h5><div class="slider"><input type="range" id="secY" min="10" max="290" step="10" value="${sim.secY}"><span>Y = ${sim.secY} m</span></div></div>`;
    const pp = plan(), pad = pp ? curPad() : null;
    const mark2d = (n) => { setState((s) => { s.twin.export2d = true; s.twin.cde.push({ name: n, at: todayISO(), kind: '2D' }); }, true); right(); };
    box.querySelector('#dxfP').onclick = () => { const n = `QH_TongMatBang_${pp ? pp.key : 'HT'}.dxf`; download(n, planDXF(pp, pad, getState().project), 'application/dxf'); mark2d(n); toast('Đã xuất DXF mặt bằng (layer QH_*, CT_*, DH_*)', 'ok'); };
    box.querySelector('#dxfS').onclick = () => { const n = `MatCat_Y${sim.secY}.dxf`; download(n, sectionDXF(sim.secY, pad), 'application/dxf'); mark2d(n); };
    box.querySelector('#svg').onclick = () => { const n = 'QH_TongMatBang.svg'; download(n, planSVG(pp, { pad }), 'image/svg+xml'); mark2d(n); };
    box.querySelector('#png').onclick = async () => { const n = 'QH_TongMatBang.png'; download(n, await svgToPng(planSVG(pp, { pad }))); mark2d(n); };
    box.querySelector('#pdf').onclick = () => {
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>Ban ve</title><style>@page{size:A3 landscape;margin:10mm}body{margin:0}svg{width:100%;height:auto;page-break-after:always}</style></head><body>${planSVG(pp, { pad })}${sectionSVG(sim.secY, pad)}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
      w.document.close();
      mark2d('BoBanVe_A3.pdf');
    };
    box.querySelector('#glb').onclick = async () => { view = '3d'; drawAll(); await sleep(100); const b = await scene.exportGLB(); download('DigitalTwin.glb', b); setState((s) => { s.twin.export3d = true; s.twin.cde.push({ name: 'DigitalTwin.glb', at: todayISO(), kind: '3D' }); }, true); toast('Đã xuất mô hình 3D (.glb)', 'ok'); right(); };
    box.querySelector('#cde').onclick = () => { setState((s) => { s.twin.export2d = true; s.twin.export3d = true; s.twin.cde.push({ name: 'Bộ hồ sơ Digital Twin (3D + 2D) v' + (s.twin.cde.length + 1), at: todayISO(), kind: 'CDE' }); }, true); toast('☁ Đã đẩy mô hình 3D + bản vẽ 2D vào CDE — đầu ra cổng G5/G6 đạt', 'ok'); right(); };
    box.querySelector('#secY').oninput = (e) => { sim.secY = +e.target.value; e.target.nextElementSibling.textContent = `Y = ${sim.secY} m`; if (view === '2d') draw2d(); };
  }
}
const need = (m) => `<div class="task"><h5>🔒 Chưa đủ dữ liệu</h5><p>${m}</p><button class="btn sm pri" onclick="location.hash='twin?mode=drone'">← Về Bước 1</button></div>`;

function scList() {
  const el = root.querySelector('#sclist');
  if (!el || !scores) return;
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const cur = T().scenario;
  el.innerHTML = scores.map((s) => `<div class="sc-card ${(sim.preview || cur) === s.key ? 'on' : ''}" data-k="${s.key}">
    <div class="row" style="justify-content:space-between"><b>${esc(s.plan.name)}</b><span class="score">${s.score}</span></div>
    ${s.key === best.key ? '<span class="badge violet">⭐ AI đề xuất</span> ' : ''}${cur === s.key ? '<span class="badge green">Đã chọn</span>' : ''}
    <div class="mt" style="margin-top:6px"><span>Số công trình</span><span>${s.m.nBuild}</span><span>Tổng sàn</span><span>${fmtInt(s.m.gfa)} m²</span>
      <span>MĐXD</span><span style="color:${s.okMd ? 'inherit' : 'var(--red)'}">${fmt(s.m.mdxd, 1)}% ${s.okMd ? '✓' : '✗'}</span><span>HSSDĐ</span><span style="color:${s.okFar ? 'inherit' : 'var(--red)'}">${fmt(s.m.far, 2)} ${s.okFar ? '✓' : '✗'}</span>
      <span>Cây xanh</span><span>${fmt((s.m.green / s.m.site) * 100, 1)}%</span><span>Dân số</span><span>~${fmtInt(s.m.pop)}</span></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-prev="${s.key}">👁 Xem 3D</button><button class="btn sm pri" data-pick="${s.key}">Chọn phương án</button></div></div>`).join('') +
    `<p class="small muted">Điểm = 40% khai thác HSSDĐ + 30% tỷ lệ cây xanh + 20% giao thông + 10% tuân thủ chỉ tiêu. AI đề xuất — kỹ sư quyết định.</p>`;
  el.querySelectorAll('[data-prev]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); sim.preview = b.dataset.prev; view = '3d'; drawAll(); }));
  el.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const k = b.dataset.pick;
    sim.preview = null;
    setState((s) => { s.twin.scenario = k; s.twin.pad = balancedPad(1.0, generatePlan(k, s.params).lakes); });
    toast(`Đã chọn ${generatePlan(k, getState().params).name} — số liệu tự cập nhật sang Hồ sơ AI & Timeline`, 'ok');
    drawAll();
  }));
}

function simBox() {
  const el = root.querySelector('#simbox');
  const p = plan();
  const S = getState();
  const slider = (id, label, min, max, stepv, val, unit) => `<label class="f">${label}<div class="slider"><input type="range" id="${id}" min="${min}" max="${max}" step="${stepv}" value="${val}"><span>${val} ${unit}</span></div></label>`;
  if (sim.tab === 'earth') {
    if (!p) { el.innerHTML = need('Chọn phương án quy hoạch ở Bước 2 trước.'); return; }
    const pad = curPad();
    const ew = earthwork(pad, p.lakes);
    const g = demGrid();
    el.innerHTML = `<div class="task"><h5>⛏ Mô phỏng khối lượng san nền (tối ưu cân bằng đào – đắp tại chỗ)</h5>
      ${slider('pad', 'Cao độ san nền thiết kế (m)', g.min.toFixed(1), g.max.toFixed(1), 0.05, pad.toFixed(2), 'm')}
      <div class="mt"><span>Khối lượng đào</span><span style="color:#dc2626">${fmtInt(ew.cut)} m³</span><span>Khối lượng đắp</span><span style="color:#2563eb">${fmtInt(ew.fill)} m³</span><span>Chênh lệch (đổ đi/mua thêm)</span><span>${ew.net >= 0 ? '+' : ''}${fmtInt(ew.net)} m³</span></div>
      <div class="row"><button class="btn sm ai" id="opt">🤖 AI tối ưu cân bằng</button><button class="btn sm pri" id="run">✔ Ghi nhận kết quả</button></div>
      <p class="small muted">Tính theo lưới ô vuông ${SITE.cell}×${SITE.cell} m trên DEM. Hệ số tơi xốp/đầm nén cần lấy theo thí nghiệm đất.</p></div>`;
    L.heat = L.heat || !S.twin.earthwork;
    el.querySelector('#pad').oninput = (e) => { setState((s) => (s.twin.pad = +e.target.value), true); simBox(); refreshScene(); right(); };
    el.querySelector('#opt').onclick = () => { setState((s) => (s.twin.pad = balancedPad(1.0, p.lakes)), true); toast('AI đã tìm cao độ cân bằng đào – đắp', 'ok'); simBox(); refreshScene(); right(); };
    el.querySelector('#run').onclick = () => { setState((s) => (s.twin.earthwork = true)); toast('Đã ghi nhận kết quả san nền — điều kiện cổng G2 đạt (một phần)', 'ok'); drawAll(); };
  } else if (sim.tab === 'flood') {
    const pad = p ? curPad() : null;
    const f0 = floodSim({ rain: sim.rain, dur: sim.dur, C: 0.45, drain: 30 });
    const f1 = p ? floodSim({ rain: sim.rain, dur: sim.dur, C: 0.75, drain: sim.drain, surface: gradedSurface(pad, p.lakes) }) : null;
    el.innerHTML = `<div class="task"><h5>🌧 Mô phỏng thoát nước mưa & nguy cơ ngập úng</h5>
      ${slider('rain', 'Cường độ mưa', 20, 200, 5, sim.rain, 'mm/h')}${slider('dur', 'Thời gian mưa', 0.5, 6, 0.5, sim.dur, 'h')}${slider('drain', 'Năng lực tiêu thoát (sau XD)', 10, 150, 5, sim.drain, 'mm/h')}
      <table class="tb small"><tr><th></th><th>Hiện trạng</th><th>Sau san nền</th></tr>
        <tr><td>Mực nước</td><td>+${fmt(f0.level, 2)}</td><td>${f1 ? '+' + fmt(f1.level, 2) : '—'}</td></tr>
        <tr><td>Diện tích ngập &gt;10cm</td><td>${fmtInt(f0.wetArea)} m²</td><td>${f1 ? fmtInt(f1.wetArea) + ' m²' : '—'}</td></tr>
        <tr><td>Sâu tối đa</td><td>${fmt(f0.maxDepth, 2)} m</td><td>${f1 ? fmt(f1.maxDepth, 2) + ' m' : '—'}</td></tr>
        <tr><td>Mức rủi ro</td><td><span class="badge ${f0.risk === 'Cao' ? 'red' : f0.risk === 'Trung bình' ? 'orange' : 'green'}">${f0.risk}</span></td><td>${f1 ? `<span class="badge ${f1.risk === 'Cao' ? 'red' : f1.risk === 'Trung bình' ? 'orange' : 'green'}">${f1.risk}</span>` : '—'}</td></tr></table>
      ${p && pad < f0.level + 0.3 ? `<p class="small" style="color:var(--red)">⚠ Cao độ san nền (+${pad.toFixed(2)}) thấp hơn mực ngập hiện trạng + 0,3 m (+${(f0.level + 0.3).toFixed(2)}). AI khuyến nghị nâng cốt nền hoặc bổ sung hồ điều hòa.</p>` : ''}
      <div class="row"><button class="btn sm" id="anim">▶ Diễn hoạt nước dâng</button><button class="btn sm pri" id="run">✔ Ghi nhận kết quả</button></div></div>`;
    ['rain', 'dur', 'drain'].forEach((k) => (el.querySelector('#' + k).oninput = (e) => { sim[k] = +e.target.value; simBox(); refreshScene(); }));
    el.querySelector('#anim').onclick = () => { const fr = L.graded && p ? f1 : f0; scene.animateWater(fr.level); };
    el.querySelector('#run').onclick = () => { setState((s) => (s.twin.flood = true)); toast('Đã ghi nhận mô phỏng ngập úng — dữ liệu chuyển sang hồ sơ ĐTM (G3)', 'ok'); drawAll(); };
  } else if (sim.tab === 'sun') {
    const s = sunPos(sim.hour, sim.month);
    el.innerHTML = `<div class="task"><h5>☀ Hướng nắng – gió & tác động vi khí hậu</h5>
      ${slider('hour', 'Giờ trong ngày', 6, 18, 0.5, sim.hour, 'h')}${slider('month', 'Tháng', 1, 12, 1, sim.month, '')}
      <div class="mt"><span>Độ cao mặt trời</span><span>${fmt(s.alt, 1)}°</span><span>Phương vị</span><span>${fmt((s.az + 360) % 360, 0)}°</span></div>
      <label class="f">Gió chủ đạo<select id="wind"><option value="SW" ${sim.wind === 'SW' ? 'selected' : ''}>Tây Nam (mùa mưa, tháng 5–10)</option><option value="NE" ${sim.wind === 'NE' ? 'selected' : ''}>Đông Bắc (mùa khô, tháng 11–4)</option></select></label>
      <label class="row small"><input type="checkbox" id="won" ${sim.windOn ? 'checked' : ''}> Hiển thị dòng gió</label>
      <button class="btn sm" id="playSun">▶ Diễn hoạt bóng đổ 6h → 18h</button>
      <p class="small muted">Bóng đổ tính theo vĩ độ ~11,5°B. Dùng để bố trí hướng nhà, khoảng cách giữa các khối nhà.</p></div>`;
    ['hour', 'month'].forEach((k) => (el.querySelector('#' + k).oninput = (e) => { sim[k] = +e.target.value; simBox(); refreshScene(); }));
    el.querySelector('#wind').onchange = (e) => { sim.wind = e.target.value; refreshScene(); };
    el.querySelector('#won').onchange = (e) => { sim.windOn = e.target.checked; refreshScene(); };
    el.querySelector('#playSun').onclick = async () => { for (let h = 6; h <= 18; h += 0.25) { if (!scene) return; sim.hour = h; scene.setSun(h, sim.month); await sleep(60); } simBox(); hud(plan(), plan() ? curPad() : null); };
  } else if (sim.tab === 'cons') {
    if (!p) { el.innerHTML = need('Chọn phương án quy hoạch ở Bước 2 trước.'); return; }
    const c = constructionSim(p, sim);
    el.innerHTML = `<div class="task"><h5>🏗 Biện pháp tổ chức thi công & an toàn PCCC</h5>
      ${slider('craneR', 'Tầm với cẩu tháp', 30, 80, 5, sim.craneR, 'm')}${slider('fireDist', 'Khoảng cách tiếp cận xe chữa cháy tối đa (tham số)', 5, 30, 1, sim.fireDist, 'm')}
      <div class="mt"><span>Số cẩu tháp cần bố trí</span><span>${c.cranes.length}</span><span>Công trình đạt tiếp cận PCCC</span><span style="color:${c.fireOk === c.fire.length ? 'var(--green)' : 'var(--red)'}">${c.fireOk}/${c.fire.length}</span></div>
      ${c.fire.filter((f) => !f.ok).length ? `<p class="small" style="color:var(--red)">Không đạt: ${c.fire.filter((f) => !f.ok).map((f) => `${f.id} (${fmt(f.dist, 1)} m)`).join(', ')}</p>` : '<p class="small" style="color:var(--green)">✓ Tất cả công trình trong phạm vi tiếp cận</p>'}
      <p class="small muted">Tham số khoảng cách phải đối chiếu QCVN về an toàn cháy hiện hành [Cần xác minh phiên bản].</p>
      <button class="btn sm pri" id="run">✔ Ghi nhận kết quả</button></div>`;
    ['craneR', 'fireDist'].forEach((k) => (el.querySelector('#' + k).oninput = (e) => { sim[k] = +e.target.value; simBox(); refreshScene(); if (view === '2d') draw2d(); }));
    el.querySelector('#run').onclick = () => { setState((s) => (s.twin.construction = true)); toast('Đã ghi nhận mô phỏng thi công & PCCC (G9)', 'ok'); drawAll(); };
  } else {
    if (!p) { el.innerHTML = need('Chọn phương án quy hoạch ở Bước 2 trước.'); return; }
    const fl = T().flight;
    const prog = fl ? progress4D(p, fl) : [];
    const cnt = (st) => prog.filter((x) => x.status === st).length;
    const avgP = prog.length ? prog.reduce((a, x) => a + x.planned, 0) / prog.length : 0;
    const avgA = prog.length ? prog.reduce((a, x) => a + x.actual, 0) / prog.length : 0;
    el.innerHTML = `<div class="task"><h5>📈 Đối chiếu tiến độ thực tế bằng Drone (4D BIM)</h5>
      <p>Định kỳ bay quét hiện trường → AI so sánh mô hình 3D thực tế với mô hình thiết kế & kế hoạch → % khối lượng hoàn thành.</p>
      <div class="mt"><span>Đợt bay đã thực hiện</span><span>${fl}/8</span><span>Kế hoạch lũy kế</span><span>${fmt(avgP * 100, 1)}%</span><span>Thực tế (Drone)</span><span>${fmt(avgA * 100, 1)}%</span>
      <span>🟢 Đúng tiến độ</span><span>${cnt('đúng')}</span><span>🟡 Chậm</span><span>${cnt('chậm')}</span><span>🔴 Chậm nghiêm trọng</span><span>${cnt('chậm nghiêm trọng')}</span></div>
      <div class="row"><button class="btn sm pri" id="flyN" ${fl >= 8 ? 'disabled' : ''}>🛰 Bay Drone đợt ${fl + 1}</button><button class="btn sm" id="rst">↺</button><a class="btn sm" href="#timeline">📅 Xem S-curve</a></div></div>`;
    el.querySelector('#flyN').onclick = async (e) => {
      e.target.innerHTML = '<span class="spin"></span> Đang bay quét & so sánh mô hình…';
      await sleep(1100);
      setState((s) => (s.twin.flight = Math.min(8, s.twin.flight + 1)));
      toast('AI đã cập nhật % hoàn thành từng công trình từ dữ liệu bay quét', 'ok');
      drawAll();
    };
    el.querySelector('#rst').onclick = () => { setState((s) => (s.twin.flight = 0)); drawAll(); };
  }
}

// ------------------------------------------------------------------ cột phải
function right() {
  const el = root.querySelector('#right');
  const t = T(), S = getState();
  const p = plan();
  const g = demGrid();
  const m = p ? planMetrics(p) : null;
  const pad = p ? curPad() : null;
  const ew = p ? earthwork(pad, p.lakes) : null;
  const obsN = obstacles().length;
  el.innerHTML = `
  <section class="panel" style="padding:14px">
    <div class="ph" style="margin-bottom:8px"><div><div class="kicker">Thông số Digital Twin</div><h3>Kết quả & đầu ra</h3></div><button class="btn sm ai" id="explain">🤖 AI giải thích</button></div>
    <div class="mt">
      <span>Dữ liệu Drone</span><span>${t.scanned ? '✅ 412 ảnh · 60k điểm*' : '—'}</span>
      <span>Vật cản/cây lọc bỏ</span><span>${t.filtered ? obsN : '—'}</span>
      <span>Diện tích khu đất</span><span>${t.scanned ? fmt(polyArea() / 10000, 2) + ' ha' : '—'}</span>
      <span>Cao độ TN min–max</span><span>${t.reconstructed ? `${fmt(g.min, 2)} – ${fmt(g.max, 2)}` : '—'}</span>
      <span>Cao độ TN trung bình</span><span>${t.reconstructed ? fmt(g.mean, 2) + ' m' : '—'}</span>
    </div>
    ${m ? `<hr style="border:0;border-top:1px solid var(--line2)"><div class="mt">
      <span>Phương án</span><span>${esc(p.name.split('–')[0])}</span><span>Số công trình</span><span>${m.nBuild}</span><span>Tổng diện tích sàn</span><span>${fmtInt(m.gfa)} m²</span>
      <span>MĐXD / HSSDĐ</span><span>${fmt(m.mdxd, 1)}% / ${fmt(m.far, 2)}</span><span>Đất cây xanh</span><span>${fmt(m.green / 10000, 2)} ha</span><span>Đất giao thông</span><span>${fmt(m.road / 10000, 2)} ha</span>
      <span>Số căn / dân số</span><span>${fmtInt(m.units)} / ~${fmtInt(m.pop)}</span>
      <span>Cao độ san nền</span><span>+${pad.toFixed(2)} m</span><span>Đào / đắp</span><span>${fmtInt(ew.cut)} / ${fmtInt(ew.fill)} m³</span></div>` : ''}
    <p class="small muted" style="margin-top:8px">* Bản demo dùng 60.000 điểm để chạy mượt trên trình duyệt; dữ liệu thực tế có thể hàng trăm triệu điểm được xử lý phía máy chủ.</p>
  </section>
  <section class="panel" style="padding:14px">
    <div class="kicker">Điều kiện Stage-Gate do Digital Twin cung cấp</div>
    ${[['scanned', 'G0', 'Dữ liệu Drone'], ['gis', 'G0', 'Ranh giới GIS'], ['scenario', 'G1', 'Phương án quy hoạch'], ['earthwork', 'G2', 'Khối lượng san nền'], ['flood', 'G3', 'Mô phỏng ngập úng'], ['reconstructed', 'G4', 'DEM/DSM + Ortho'], ['export2d', 'G5', 'Bản vẽ 2D'], ['export3d', 'G5/G6', 'Mô hình 3D lên CDE'], ['construction', 'G9', 'Mô phỏng thi công/PCCC'], ['flight', 'G12', 'Tiến độ 4D (Drone)']].map(([k, gt, l]) => `<div class="chk"><span class="i">${t[k] ? '✅' : '⬜'}</span><span class="grow">${l}</span><span class="badge blue">${gt}</span></div>`).join('')}
    <a class="btn sm" href="#stage-gate" style="margin-top:8px">🚦 Xem Stage-Gate →</a>
  </section>
  <section class="panel" style="padding:14px">
    <div class="kicker">CDE – Môi trường dữ liệu chung</div>
    ${t.cde.length ? t.cde.slice(-8).reverse().map((c) => `<div class="chk"><span class="i">${c.kind === '3D' ? '🧊' : c.kind === 'CDE' ? '☁' : '📐'}</span><span class="grow small">${esc(c.name)}</span><span class="small muted">${c.at.slice(5)}</span></div>`).join('') : '<p class="small muted">Chưa có tệp. Xuất bản vẽ ở Bước 4.</p>'}
  </section>`;
  el.querySelector('#explain').onclick = () => {
    const q = { 1: 'Giải thích kết quả khảo sát hiện trạng bằng Drone và chất lượng mô hình địa hình', 2: 'So sánh 3 phương án quy hoạch AI đề xuất và khuyến nghị phương án nên chọn', 3: { earth: 'Phân tích kết quả mô phỏng san nền đào đắp và đề xuất tối ưu', flood: 'Phân tích nguy cơ ngập úng và đề xuất cao độ san nền tối thiểu', sun: 'Phân tích hướng nắng gió cho bố trí công trình', cons: 'Kiểm tra sơ bộ khả năng tiếp cận xe chữa cháy và bố trí cẩu tháp', '4d': 'Đánh giá tiến độ thi công từ dữ liệu bay Drone, công trình nào chậm và đề xuất' }[sim.tab], 4: 'Liệt kê bộ bản vẽ 2D/3D cần nộp cho cổng G5 và kiểm tra còn thiếu gì' }[step];
    openCopilot(q);
  };
}

// ------------------------------------------------------------------ 2D
function draw2d() {
  const el = root.querySelector('#view2d');
  const p = plan();
  const pad = p ? curPad() : null;
  const t = T();
  if (!t.reconstructed) { el.innerHTML = '<section class="panel"><p class="muted">Chưa có dữ liệu địa hình — hoàn thành Bước 1 để trích xuất bản vẽ 2D.</p></section>'; return; }
  const opts = { pad };
  if (step === 3 && sim.tab === 'cons' && p) { const c = constructionSim(p, sim); opts.cranes = c.cranes; opts.fire = c.fire; }
  if (step === 3 && sim.tab === '4d' && p && t.flight) opts.progress = progress4D(p, t.flight);
  if (step === 3 && sim.tab === 'flood') { const surf = L.graded && p ? gradedSurface(pad, p.lakes) : null; const fr = floodSim({ rain: sim.rain, dur: sim.dur, C: surf ? 0.75 : 0.45, drain: surf ? sim.drain : 30, surface: surf }); opts.flood = { level: fr.level, surface: surf }; }
  el.innerHTML = `<section class="panel" style="padding:10px">${planSVG(p, opts)}</section><section class="panel" style="padding:10px">${sectionSVG(sim.secY, pad)}</section>`;
}

// ------------------------------------------------------------------ hành động bước 1
async function fly() {
  const box = root.querySelector('#viewer');
  view = '3d';
  drawAll();
  const pr = document.createElement('div');
  pr.className = 'vw-prog';
  box.appendChild(pr);
  scene.layer('terrain', false);
  scene.layer('trees', false);
  scene.view('iso');
  await scene.flyDrone((u) => (pr.innerHTML = `🛰 Drone đang bay quét… ${Math.round(u * 100)}%<div class="bar" style="margin-top:8px"><i style="width:${u * 100}%"></i></div><div class="small" style="font-weight:400;margin-top:6px">Ảnh chụp: ${Math.round(u * 412)}/412 · Điểm LiDAR thu thập: ${fmtInt(u * 60000)}</div>`));
  pr.remove();
  setState((s) => (s.twin.scanned = true));
  toast('🛰 Hoàn thành bay quét — đã thu đám mây điểm thô (còn nhiễu cây cối, vật cản)', 'ok');
  drawAll();
}
async function recon() {
  const log = root.querySelector('#reconLog');
  const steps = [
    `Lọc nhiễu: loại ${obstacles().length} cụm điểm cây cối/vật cản tạm thời`,
    'Phân loại lớp: mặt đất · thực vật · công trình hiện hữu',
    `Dựng mô hình số độ cao DEM/DSM (lưới ${SITE.cell} m)`,
    'Ghép bình đồ ảnh trực giao (Orthomosaic), sai số mặt bằng ±3 cm',
    'Sinh đường đồng mức 1 m',
  ];
  for (const s of steps) { log.insertAdjacentHTML('beforeend', `<div>⏳ ${s}</div>`); await sleep(520); log.lastElementChild.textContent = '✅ ' + s; }
  setState((s) => { s.twin.reconstructed = true; s.twin.filtered = true; });
  L.cloud = false;
  L.style = 'ortho';
  toast('🤖 AI đã tái tạo địa hình 3D độ chính xác cấp centimet', 'ok');
  drawAll();
}
*/
export { render } from './twin-v2.js';
