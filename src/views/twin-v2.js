// MOD-01/02/03: dữ liệu đa nguồn, QTO, kịch bản và Digital Twin.
import { getState, setState } from '../store.js';
import { currentPlan as editedPlan } from '../lib/plan.js';
import { TwinScene } from '../lib/scene3d.js';
import {
  SITE, demGrid, polyArea, polyPerimeter, generatePlan, planMetrics, scorePlans,
  earthwork, balancedPad, floodSim, gradedSurface, progress4D,
} from '../lib/engine.js';
import { planSVG, sectionSVG, planDXF, sectionDXF, svgToPng } from '../lib/drawing.js';
import { esc, fmt, fmtInt, toast, sleep, download, todayISO } from '../lib/util.js';
import { openCopilot } from '../copilot.js';
import { TRUST_LEVELS, SAMPLE_DATASETS, SCENARIO_LIBRARY, QTO_ROWS, MATERIAL_VARIANTS } from '../data/digital-twin.js';
import { SCENARIO_INPUTS, scenarioDefaults, runScreeningModel, primaryMetric, metricLabels, sweep1, sweep2, tornado, monteCarlo, presetCases, runCases } from '../lib/simulation-lab.js';
import { loadTerrainFile, getActiveTerrain } from '../lib/terrain-loader.js';

let root, scene, step = 1, view = '3d', planTab = 'planning', resultTab = 'runs';
let scores = null, selectedBuildingId = null;
const layers = { ortho: true, cloud: false, contours: false, plan: true };
const STEP_NAMES = ['Dữ liệu', 'Phương án & QTO', '18 + UR-01', 'Kết quả & 4D', 'Báo cáo'];

export function render(el) {
  root = el;
  const mode = new URLSearchParams(location.hash.split('?')[1] || '').get('mode');
  step = { data: 1, plan: 2, qto: 2, scenarios: 3, simulation: 3, results: 4, progress: 4, export: 5 }[mode] || step;
  if (mode === 'qto') planTab = 'qto';
  if (mode === 'progress') resultTab = 'progress';
  const qsScenario = new URLSearchParams(location.hash.split('?')[1] || '').get('scenario');
  if (qsScenario && SCENARIO_LIBRARY.some((s) => s.id === qsScenario)) {
    setState((s) => { s.twin.selectedScenario = qsScenario; if (s.twin.runConfig.level === 'L2') s.twin.runConfig.level = 'L1'; if (!s.twin.dataReady) { if (!s.twin.datasets.length) s.twin.datasets = structuredClone(SAMPLE_DATASETS); publishData(s.twin); } }, true);
    step = 3;
    if (new URLSearchParams(location.hash.split('?')[1] || '').get('from') === 'map') setTimeout(() => toast(`Mở ${qsScenario} từ Bản đồ 3D (MOD-00) — cùng cảnh, cùng vị trí`, 'ok'), 300);
  }
  root.innerHTML = `
  <div class="twin">
    <div class="left">
      <section class="panel" style="padding:12px">
        <div class="kicker">MOD-01 · MOD-02 · MOD-03</div>
        <h3 style="color:var(--primary2);margin-bottom:10px">Digital Twin & Engineering Simulation</h3>
        <a class="btn sm ai" href="#cad" id="toCad" style="margin-bottom:8px;justify-content:flex-start">📐 Mô hình kết cấu thực: CAD 2D → 3D → phân tích khung (FEM) · khối lượng · kịch bản cực đoan</a>
        <div class="steps" id="steps">${STEP_NAMES.map((s, i) => `<button data-s="${i + 1}">${i + 1} ${s}</button>`).join('')}</div>
      </section>
      <div id="stepbox" class="stepbox"></div>
    </div>
    <div class="col" style="gap:10px">
      <div class="row"><div class="steps" style="width:260px"><button data-v="3d">🧊 Mô hình 3D</button><button data-v="2d">📐 Bản vẽ 2D</button></div><span class="spacer"></span><span class="small muted" id="crumb"></span></div>
      <div class="viewer" id="viewer">
        <div class="vw-tools"><button class="btn sm" data-cam="iso">🧭 Phối cảnh</button><button class="btn sm" data-cam="top">⬇ Từ trên</button><button class="btn sm" data-cam="south">Mặt Nam</button><button class="btn sm" data-cam="east">Mặt Đông</button><button class="btn sm" id="shot">📷 Ảnh</button></div>
        <div class="vw-hud" id="hud"></div><div class="vw-layers" id="layers"></div>
      </div>
      <div id="view2d" style="display:none" class="col"></div>
      <div id="lab" class="col"></div>
    </div>
    <div class="right" id="right"></div>
  </div>`;
  scene = new TwinScene(root.querySelector('#viewer'));
  const activeTerrain = getActiveTerrain();
  if (activeTerrain) scene.setMeasuredTerrain(activeTerrain);
  root.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { step = +b.dataset.s; if (step === 5) view = '2d'; drawAll(); }));
  root.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { view = b.dataset.v; drawAll(); }));
  root.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => scene.view(b.dataset.cam)));
  root.querySelector('#shot').onclick = () => { const a = document.createElement('a'); a.href = scene.screenshot(); a.download = `DigitalTwin_${todayISO()}.png`; a.click(); };
  drawAll();
  return () => { scene.dispose(); scene = null; };
}

const T = () => getState().twin;
const currentPlan = () => editedPlan(getState());
const currentPad = () => T().pad ?? balancedPad(1, currentPlan()?.lakes || []);
const activeRun = () => T().runs.find((r) => r.runId === T().activeRunId) || T().runs[0] || null;

function drawAll() {
  root.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === step));
  root.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  root.querySelector('#viewer').style.display = view === '3d' ? '' : 'none';
  root.querySelector('#view2d').style.display = view === '2d' ? '' : 'none';
  root.querySelector('#crumb').textContent = `Bước ${step} · ${STEP_NAMES[step - 1]}`;
  if (view === '3d') setTimeout(() => scene?.resize(), 0);
  if (step !== 3) { const lb = root.querySelector('#lab'); if (lb) lb.innerHTML = ''; }
  stepBox(); refreshScene(); right();
  if (view === '2d') draw2d();
}

function refreshScene() {
  if (!scene) return;
  const t = T(), run = activeRun();
  const scenarioMode = step === 4 && resultTab === 'runs' && run?.status === 'COMPLETED';
  scene.layer('terrain', t.reconstructed && !scenarioMode);
  scene.layer('boundary', !scenarioMode);
  scene.layer('trees', t.reconstructed && !scenarioMode);
  scene.layer('contours', t.reconstructed && layers.contours && !scenarioMode);
  scene.layer('cloud', t.reconstructed && layers.cloud && !scenarioMode);
  if (t.reconstructed && layers.cloud) scene.showFullCloud();
  scene.setTerrainStyle(layers.ortho ? 'ortho' : 'height');
  const plan = currentPlan();
  scene.buildPlan(!scenarioMode && layers.plan ? plan : null, plan ? currentPad() : null,
    resultTab === 'progress' && t.surveyUpdates && plan ? progress4D(plan, t.surveyUpdates) : null);
  scene.layer('plan', !scenarioMode && !!currentPlan() && layers.plan);
  scene.layer('scenario', scenarioMode);
  scene.setScenarioVisualization(scenarioMode ? run : null);
  if (scenarioMode) scene.view('bridge');
  layerBar(scenarioMode);
  const g = demGrid(), terrain = scene.terrainStats() || g;
  root.querySelector('#hud').innerHTML = scenarioMode
    ? `<b>${run.runId}</b><br>${run.scenarioId} · ${run.level}<br>modelVersion: ${esc(run.modelVersionId)}<br><span class="small">${esc(run.solverVersion)}<br>${run.level === 'L1' ? 'Screening model · không phải kết luận L2' : 'Minh họa trực quan'}</span>`
    : `<b>${esc(getState().project.code)}</b> · Digital Twin<br>${t.dataReady ? `dataVersion: ${esc(t.dataVersionId || '—')}<br>modelVersion: ${esc(t.modelVersionId || '—')}<br>Diện tích: ${fmt(polyArea() / 10000, 2)} ha<br>Cao độ: ${fmt(terrain.min, 1)}–${fmt(terrain.max, 1)} m${terrain.name ? `<br>DEM: ${esc(terrain.name)}` : ''}` : '⚪ Chưa có dataset được phát hành'}<br><span class="small">${t.dataReady ? 'Nguồn đa dữ liệu · có provenance' : 'Có thể bắt đầu chỉ với IFC'}</span>`;
}

function layerBar(bridge) {
  const box = root.querySelector('#layers');
  if (bridge) { box.innerHTML = `<label><b>${activeRun()?.level || 'L1'} · Scenario sandbox</b></label><label>Hình học và tham số đang chọn</label><label>Không phải kết quả solver L2</label>`; return; }
  if (!T().reconstructed) { box.innerHTML = ''; return; }
  const items = [['ortho', 'Bề mặt ảnh', layers.ortho], ['contours', 'Đồng mức', layers.contours], ['cloud', 'Point cloud', layers.cloud], ['plan', 'Phương án', layers.plan]];
  box.innerHTML = items.map(([k, l, on]) => `<label><input type="checkbox" data-l="${k}" ${on ? 'checked' : ''}> ${l}</label>`).join('');
  box.querySelectorAll('[data-l]').forEach((c) => (c.onchange = () => { layers[c.dataset.l] = c.checked; refreshScene(); }));
}

function stepBox() {
  if (step === 1) dataStep();
  else if (step === 2) designStep();
  else if (step === 3) scenarioStepV2();
  else if (step === 4) resultStep();
  else exportStep();
}

const need = (message, target = 1) => `<div class="task"><h5>🔒 Chưa đủ dữ liệu</h5><p>${message}</p><button class="btn sm pri" data-need="${target}">Đi tới bước ${target}</button></div>`;
const pseudoHash = (s) => [...s].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 2166136261).toString(16).padStart(8, '0');

function inferType(name) {
  const e = name.split('.').pop().toLowerCase();
  if (['asc', 'xyz'].includes(e)) return 'GIS/DEM đo thực';
  if (['ifc', 'rvt', 'dwg', 'dxf'].includes(e)) return 'BIM/CAD';
  if (['tif', 'tiff', 'geojson', 'shp'].includes(e)) return 'GIS/DEM';
  if (['las', 'laz', 'e57', 'ply', 'obj', 'glb'].includes(e)) return 'Hiện trạng 3D';
  if (['jpg', 'jpeg', 'png', 'mp4'].includes(e)) return 'Ảnh/video khảo sát';
  if (['csv', 'xlsx'].includes(e)) return 'QTO/quan trắc';
  return 'Tài liệu khác';
}

function dataStep() {
  const box = root.querySelector('#stepbox'), t = T();
  box.innerHTML = `
  <div class="task"><h5>① Nhập dữ liệu khảo sát/hiện trạng và thiết kế</h5>
    <p>BIM/CAD, GIS/DEM, point cloud/mesh, ảnh, QTO hoặc quan trắc. Nguồn thiết bị là metadata, không phải điều kiện vận hành.</p>
    <label class="f">Nguồn xuất xứ<input id="source" value="Đơn vị tư vấn / nguồn được cấp quyền"></label>
    <label class="f">CRS / hệ trục / đơn vị<input id="crs" placeholder="Bắt buộc với dữ liệu không gian"></label>
    <input id="files" type="file" multiple accept=".asc,.xyz,.ifc,.dwg,.dxf,.tif,.tiff,.geojson,.shp,.las,.laz,.e57,.ply,.obj,.glb,.jpg,.jpeg,.png,.csv,.xlsx" style="display:none">
    <div class="terrain-drop" id="terrainDrop"><b>Thả DEM đo thực vào đây</b><span>ESRI ASCII Grid (.asc) hoặc điểm x y z (.xyz)</span></div>
    <div class="row"><button class="btn pri" id="pick">＋ Chọn tệp</button><button class="btn" id="sample">Nạp bộ mẫu PoC đa nguồn</button></div>
  </div>
  <div class="task ${t.dataReady ? 'done' : ''}"><h5>② Kiểm tra chất lượng và phát hành phiên bản</h5>
    <p>Kiểm tra định dạng, checksum, CRS/đơn vị, GlobalId và provenance. Dữ liệu thiếu CRS giữ trạng thái UNVERIFIED.</p>
    <button class="btn ${t.dataReady ? '' : 'pri'}" id="release" ${t.datasets.length ? '' : 'disabled'}>Phát hành dataset cho phân tích</button>
  </div>
  <div class="dataset-list col">
    ${t.datasets.length ? t.datasets.map((d) => `<div class="task ${d.status === 'VALIDATED' ? 'done' : ''}"><div class="row"><b>${esc(d.id)} · ${esc(d.name)}</b><span class="spacer"></span><span class="badge ${d.status === 'VALIDATED' ? 'green' : 'orange'}">${d.status}</span></div><div class="mt"><span>Loại</span><span>${esc(d.type)}</span><span>Nguồn</span><span>${esc(d.source)}</span><span>CRS/đơn vị</span><span>${esc(d.crs || 'CHƯA XÁC ĐỊNH')}</span><span>Phiên bản</span><span>${esc(d.version)}</span><span>Checksum</span><span>${esc(d.hash)}</span></div><p>${esc(d.quality)}</p></div>`).join('') : '<p class="small muted">Chưa có dataset. Bộ mẫu gồm IFC, DEM đo mặt đất và point cloud TLS; không yêu cầu metadata thiết bị bay.</p>'}
  </div>`;
  box.querySelector('#pick').onclick = () => box.querySelector('#files').click();
  const receiveFiles = (files) => importFiles(files, box.querySelector('#source').value, box.querySelector('#crs').value);
  box.querySelector('#files').onchange = (e) => receiveFiles([...e.target.files]);
  const drop = box.querySelector('#terrainDrop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); receiveFiles([...e.dataTransfer.files]); };
  box.querySelector('#sample').onclick = () => {
    setState((s) => { s.twin.datasets = structuredClone(SAMPLE_DATASETS); publishData(s.twin); });
    toast('Đã nạp IFC + DEM đo mặt đất + point cloud TLS và lưu provenance', 'ok'); drawAll();
  };
  box.querySelector('#release').onclick = () => {
    const valid = t.datasets.filter((d) => d.status === 'VALIDATED');
    if (!valid.length) return toast('Không có dataset VALIDATED. Hãy khai báo CRS/đơn vị và nhập lại.', 'warn');
    setState((s) => publishData(s.twin)); toast('Đã đóng băng đầu vào và phát hành dataVersion mới', 'ok'); drawAll();
  };
}

async function importFiles(files, source, crs) {
  if (!files.length) return;
  let measured = null;
  for (const f of files) {
    if (!/\.(asc|xyz)$/i.test(f.name)) continue;
    try { measured = await loadTerrainFile(f); }
    catch (err) { toast(`Không đọc được ${f.name}: ${err.message}`, 'warn'); }
  }
  setState((s) => {
    for (const f of files) {
      const type = inferType(f.name), spatial = /GIS|DEM|3D|BIM/.test(type), ok = !spatial || !!crs.trim();
      s.twin.datasets.push({
        id: `DS-${String(s.twin.datasets.length + 1).padStart(3, '0')}`, name: f.name, type, source: source || 'Chưa khai báo',
        crs: crs.trim() || '', size: `${fmt(f.size / 1024 / 1024, 2)} MB`, status: ok ? 'VALIDATED' : 'UNVERIFIED',
        version: `D1.${s.twin.datasets.length + 1}`, hash: `sha256:${pseudoHash(`${f.name}:${f.size}:${f.lastModified}`)}…`,
        quality: ok ? 'Đã kiểm tra định dạng · cần review chuyên môn trước khi sử dụng' : 'Thiếu CRS/hệ trục/đơn vị — chặn ghép tự động', license: 'Theo khai báo người nạp',
      });
    }
  });
  if (measured) {
    scene.setMeasuredTerrain(measured);
    layers.ortho = false;
    toast(`Đã dựng DEM ${measured.name}: ${measured.nx}×${measured.ny}, cao độ ${fmt(measured.min, 2)}–${fmt(measured.max, 2)} m`, 'ok');
  } else toast('Đã tiếp nhận metadata tệp; tệp không đủ CRS được đánh dấu UNVERIFIED', 'ok');
  drawAll();
}

function publishData(t) {
  const valid = t.datasets.filter((d) => d.status === 'VALIDATED');
  if (!valid.length) return;
  t.dataReady = true; t.reconstructed = true; t.filtered = true;
  t.gis = valid.some((d) => /DEM|GIS|GeoTIFF|Point cloud|3D/.test(d.type) && d.crs);
  t.dataVersionId = `DV-${todayISO().replaceAll('-', '')}-${String(valid.length).padStart(2, '0')}`;
  t.modelVersionId = `MV-${todayISO().replaceAll('-', '')}-01`;
}

function designStep() {
  const box = root.querySelector('#stepbox'), t = T();
  if (!t.dataReady) { box.innerHTML = need('Cần ít nhất một IFC hoặc dataset nền đã VALIDATED. Hệ thống không yêu cầu dữ liệu từ một thiết bị cụ thể.'); bindNeed(box); return; }
  box.innerHTML = `<div class="row"><button class="btn sm ${planTab === 'planning' ? 'pri' : ''}" data-pt="planning">🏙 Phương án</button><button class="btn sm ${planTab === 'qto' ? 'pri' : ''}" data-pt="qto">📦 QTO / BOM A-B-C</button></div><div id="designbody" class="col"></div>`;
  box.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => { planTab = b.dataset.pt; designStep(); refreshScene(); }));
  if (planTab === 'qto') qtoPanel(box.querySelector('#designbody'));
  else planningPanel(box.querySelector('#designbody'));
}

function planningPanel(el) {
  const P = getState().params;
  el.innerHTML = `<div class="task"><h5>Ràng buộc phương án tổng mặt bằng</h5><div class="grid g2" style="gap:8px">
    <label class="f">MĐXD tối đa (%)<input type="number" data-p="mdxd" value="${P.mdxd}"></label><label class="f">HSSDĐ tối đa<input type="number" step="0.1" data-p="far" value="${P.far}"></label>
    <label class="f">Tầng tối thiểu<input type="number" data-p="floorsMin" value="${P.floorsMin}"></label><label class="f">Tầng tối đa<input type="number" data-p="floorsMax" value="${P.floorsMax}"></label>
    <label class="f">Khoảng lùi (m)<input type="number" data-p="setback" value="${P.setback}"></label></div>
    <button class="btn pri" id="gen">Sinh và chấm điểm 3 phương án</button><p>Mức L1 · tính hình học sơ bộ; không phải phê duyệt quy hoạch.</p></div><div id="plans" class="col"></div><div id="buildingEditor" class="col"></div>`;
  el.querySelectorAll('[data-p]').forEach((i) => (i.onchange = () => { setState((s) => (s.params[i.dataset.p] = +i.value), true); scores = null; }));
  el.querySelector('#gen').onclick = async (e) => { e.target.innerHTML = '<span class="spin"></span> Đang tạo phương án…'; await sleep(450); scores = scorePlans(getState().params); planningList(el.querySelector('#plans')); buildingEditor(el.querySelector('#buildingEditor')); e.target.textContent = 'Sinh và chấm điểm 3 phương án'; };
  if (!scores && T().scenario) scores = scorePlans(P);
  planningList(el.querySelector('#plans'));
  buildingEditor(el.querySelector('#buildingEditor'));
}

function planningList(el) {
  if (!scores) { el.innerHTML = '<p class="small muted">Chạy tạo phương án để so sánh A/B/C trên cùng baseline dữ liệu.</p>'; return; }
  const best = scores.reduce((a, b) => b.score > a.score ? b : a), cur = T().scenario;
  el.innerHTML = scores.map((s) => `<div class="sc-card ${cur === s.key ? 'on' : ''}"><div class="row"><b>${esc(s.plan.name)}</b><span class="spacer"></span><span class="score">${s.score}</span></div>${s.key === best.key ? '<span class="badge violet">AI đề xuất</span>' : ''} ${cur === s.key ? '<span class="badge green">Đã chọn</span>' : ''}<div class="mt"><span>Tổng sàn</span><span>${fmtInt(s.m.gfa)} m²</span><span>MĐXD / HSSDĐ</span><span>${fmt(s.m.mdxd, 1)}% / ${fmt(s.m.far, 2)}</span><span>Cây xanh</span><span>${fmt(s.m.green / s.m.site * 100, 1)}%</span></div><button class="btn sm pri" data-pick="${s.key}">Chọn phương án</button></div>`).join('');
  el.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
    setState((s) => { s.twin.scenario = b.dataset.pick; s.twin.pad = balancedPad(1, generatePlan(b.dataset.pick, s.params).lakes); s.twin.planEdits = {}; s.twin.customBuildings = []; s.twin.designRevision += 1; });
    toast('Đã khóa phương án trên modelVersion hiện tại', 'ok'); drawAll();
  }));
}

function buildingEditor(el) {
  if (!el) return;
  const p = currentPlan();
  if (!p) { el.innerHTML = ''; return; }
  if (!selectedBuildingId || !p.buildings.some((b) => b.id === selectedBuildingId)) selectedBuildingId = p.buildings[0]?.id;
  const b = p.buildings.find((x) => x.id === selectedBuildingId);
  if (!b) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="task editor-card"><div class="row"><h5>✥ Chỉnh mô hình quy hoạch</h5><span class="spacer"></span><span class="badge violet">Revision ${T().designRevision}</span></div>
    <label class="f">Khối công trình<select id="buildingSelect">${p.buildings.map((x) => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${x.id} · ${x.floors} tầng</option>`).join('')}</select></label>
    <div class="grid g2" style="gap:7px"><label class="f">X (m)<input type="number" data-be="x" value="${fmt(b.x, 1)}"></label><label class="f">Y (m)<input type="number" data-be="y" value="${fmt(b.y, 1)}"></label><label class="f">Rộng (m)<input type="number" data-be="w" value="${fmt(b.w, 1)}" min="6"></label><label class="f">Dài (m)<input type="number" data-be="d" value="${fmt(b.d, 1)}" min="6"></label><label class="f">Số tầng<input type="number" data-be="floors" value="${b.floors}" min="1" max="60"></label><label class="f">Cao tầng (m)<input type="number" data-be="fh" value="${b.fh}" min="2.5" max="6" step="0.1"></label></div>
    <label class="f">Vật liệu chính<select data-be="materialCode">${QTO_ROWS.map((m) => `<option value="${m.code}" ${b.materialCode === m.code ? 'selected' : ''}>${m.code} · ${m.material}</option>`).join('')}</select></label>
    <div class="row"><button class="btn sm pri" id="openDrag">↔ Kéo thả trên mặt bằng 2D</button><button class="btn sm" id="duplicateBuilding">Nhân bản</button><button class="btn sm danger" id="deleteBuilding">Xóa khối</button></div>
    <p>Kéo trực tiếp khối nhà trong Bản vẽ 2D hoặc sửa số. Mọi thay đổi tạo revision mới; chưa tự cập nhật baseline đã duyệt.</p></div>`;
  el.querySelector('#buildingSelect').onchange = (e) => { selectedBuildingId = e.target.value; buildingEditor(el); draw2d(); };
  el.querySelectorAll('[data-be]').forEach((i) => (i.onchange = () => { updateBuilding(b.id, { [i.dataset.be]: i.tagName === 'SELECT' ? i.value : +i.value }); drawAll(); }));
  el.querySelector('#openDrag').onclick = () => { view = '2d'; drawAll(); toast('Chọn và kéo khối công trình trên mặt bằng; tọa độ sẽ được lưu khi thả', 'ok'); };
  el.querySelector('#duplicateBuilding').onclick = () => {
    setState((s) => { const id = `USR-${s.twin.customBuildings.length + 1}`; s.twin.customBuildings.push({ ...b, id, x: Math.min(SITE.W - b.w, b.x + 12), y: Math.min(SITE.H - b.d, b.y + 12) }); touchDesign(s.twin); selectedBuildingId = id; }); drawAll();
  };
  el.querySelector('#deleteBuilding').onclick = () => {
    setState((s) => { const idx = s.twin.customBuildings.findIndex((x) => x.id === b.id); if (idx >= 0) s.twin.customBuildings.splice(idx, 1); else s.twin.planEdits[b.id] = { ...(s.twin.planEdits[b.id] || {}), deleted: true }; touchDesign(s.twin); }); selectedBuildingId = null; drawAll();
  };
}

function touchDesign(t) {
  t.designRevision += 1;
  const base = (t.modelVersionId || `MV-${todayISO().replaceAll('-', '')}-01`).replace(/-R\d+$/, '');
  t.modelVersionId = `${base}-R${t.designRevision}`;
}

function updateBuilding(id, patch) {
  setState((s) => {
    const custom = s.twin.customBuildings.find((x) => x.id === id);
    if (custom) Object.assign(custom, patch);
    else s.twin.planEdits[id] = { ...(s.twin.planEdits[id] || {}), ...patch };
    touchDesign(s.twin);
  }, true);
}

function qtoPanel(el) {
  const t = T(), variant = MATERIAL_VARIANTS[t.materialVariant], rows = QTO_ROWS.map((base) => {
    const r = { ...base, ...(t.materialEdits[base.code] || {}) };
    return { ...r, order: r.qty * variant.qty * (1 + r.waste), cost: r.qty * variant.qty * (1 + r.waste) * r.price * variant.price };
  });
  const total = rows.reduce((a, r) => a + r.cost, 0);
  el.innerHTML = `<div class="task ${t.qtoReady ? 'done' : ''}"><h5>QTO/BOM có truy vết GlobalId</h5><p>Khối lượng mẫu được bóc từ ${esc(t.modelVersionId)}. Hao hụt áp dụng theo từng vật liệu; netQty không bị thay đổi.</p>
    <div class="row">${Object.entries(MATERIAL_VARIANTS).map(([k, v]) => `<button class="btn sm ${t.materialVariant === k ? 'pri' : ''}" data-var="${k}">${v.label}</button>`).join('')}</div>
    <div class="scroll"><table class="tb small"><tr><th>Vật liệu / nguồn</th><th>Net qty</th><th>Hao hụt</th><th>Đơn giá</th><th>Đặt mua</th><th>Thành tiền</th></tr>${rows.map((r) => `<tr><td><b>${r.code}</b> · ${r.material}<div class="muted">${r.source}</div></td><td><input class="cell-input" type="number" data-mcode="${r.code}" data-mf="qty" value="${r.qty}"> ${r.unit}</td><td><input class="cell-input" type="number" data-mcode="${r.code}" data-mf="waste" value="${fmt(r.waste * 100, 2)}" step="0.5">%</td><td><input class="cell-input wide" type="number" data-mcode="${r.code}" data-mf="price" value="${r.price}" step="1000"></td><td>${fmtInt(r.order)} ${r.unit}</td><td>${fmt(r.cost / 1e9, 2)} tỷ</td></tr>`).join('')}</table></div>
    <div class="mt"><span>Tổng chi phí vật liệu mẫu</span><span>${fmt(total / 1e9, 2)} tỷ đồng</span><span>Tác động tiến độ dự báo</span><span>${variant.delay > 0 ? '+' : ''}${variant.delay} ngày</span><span>Trạng thái kết cấu</span><span>INSUFFICIENT_DATA</span></div>
    <div class="disclaimer"><b>${variant.label}:</b> ${variant.note}. Không suy ra khả năng chịu lực từ QTO.</div><button class="btn pri" id="saveQto">Ghi nhận QTO/BOM L1</button></div>`;
  el.querySelectorAll('[data-var]').forEach((b) => (b.onclick = () => { setState((s) => (s.twin.materialVariant = b.dataset.var)); qtoPanel(el); right(); }));
  el.querySelectorAll('[data-mcode]').forEach((input) => (input.onchange = () => {
    const code = input.dataset.mcode, field = input.dataset.mf, value = +input.value;
    setState((s) => {
      s.twin.materialEdits[code] = { ...(s.twin.materialEdits[code] || {}), [field]: field === 'waste' ? value / 100 : value };
      s.twin.qtoReady = false;
      s.twin.designRevision += 1;
    });
    qtoPanel(el); right();
  }));
  el.querySelector('#saveQto').onclick = () => { setState((s) => (s.twin.qtoReady = true)); toast('Đã lưu QTO/BOM cùng modelVersion, giả định và nguồn', 'ok'); drawAll(); };
}

function scenarioStep() {
  const box = root.querySelector('#stepbox'), t = T();
  if (!t.dataReady) { box.innerHTML = need('Cần phát hành dataVersion trước khi tạo scenarioVersion.'); bindNeed(box); return; }
  const selected = SCENARIO_LIBRARY.find((s) => s.id === t.selectedScenario) || SCENARIO_LIBRARY[0], c = t.runConfig;
  const capacity = Math.floor(c.bridgeLength / (c.vehicleLength + c.gap)) * c.lanes;
  box.innerHTML = `<div class="task"><div class="row"><h5>Thư viện 18 kịch bản</h5><span class="spacer"></span><span class="badge blue">18/18 định nghĩa</span></div><input id="scenarioSearch" placeholder="Lọc theo mã hoặc công trình…"><div id="scenarioList" class="scenario-list scroll" style="max-height:270px"></div></div>
  <div class="task"><div class="row"><h5>${selected.id} · ${esc(selected.title)}</h5><span class="spacer"></span><span class="badge ${selected.support === 'L0_REFERENCE' ? 'orange' : 'blue'}">${selected.support}</span></div>
    <div class="mt"><span>Loại công trình</span><span>${esc(selected.asset)}</span><span>Solver yêu cầu</span><span>${esc(selected.solver)}</span><span>scenarioVersion</span><span>${selected.version}</span></div>
    ${selected.id === 'BR-01' ? `<label class="f">Chế độ<select data-c="mode"><option value="FLOW" ${c.mode === 'FLOW' ? 'selected' : ''}>A · 500 lượt trong 60 phút</option><option value="SIMULTANEOUS" ${c.mode === 'SIMULTANEOUS' ? 'selected' : ''}>B · 500 xe cùng hiện diện</option></select></label>
      <div class="grid g2" style="gap:7px"><label class="f">Số xe<input value="500" disabled></label><label class="f">Số làn<input type="number" data-c="lanes" value="${c.lanes}" min="1" max="12"></label><label class="f">Chiều dài cầu (m)<input type="number" data-c="bridgeLength" value="${c.bridgeLength}"></label><label class="f">Xe + khoảng cách (m)<input value="${c.vehicleLength + c.gap}" disabled></label></div>
      <div class="disclaimer">Sức chứa hình học: <b>${capacity} xe</b>. ${c.mode === 'SIMULTANEOUS' && capacity < 500 ? '<b style="color:var(--red)">500 xe đồng thời không hợp lệ.</b>' : 'Chế độ dòng xe hợp lệ cho lớp minh họa.'}</div>` : '<div class="disclaimer">Kịch bản đã có schema đầu vào nhưng chưa tích hợp bộ giải chuyên ngành trong PoC.</div>'}
    <label class="f">Mức yêu cầu<select data-c="level"><option value="L0" ${c.level === 'L0' ? 'selected' : ''}>L0 · Minh họa</option><option value="L2" ${c.level === 'L2' ? 'selected' : ''}>L2 · Solver chuyên ngành</option></select></label>
    <button class="btn pri" id="runScenario">▶ Kiểm tra đầu vào & tạo run</button><p>Mọi run đóng băng inputHash, modelVersion, scenarioVersion và solverVersion.</p></div>`;
  drawScenarioList(box.querySelector('#scenarioList'), '');
  box.querySelector('#scenarioSearch').oninput = (e) => drawScenarioList(box.querySelector('#scenarioList'), e.target.value);
  box.querySelectorAll('[data-c]').forEach((i) => (i.onchange = () => { setState((s) => (s.twin.runConfig[i.dataset.c] = i.type === 'number' ? +i.value : i.value), true); scenarioStep(); }));
  box.querySelector('#runScenario').onclick = (e) => runScenario(e.currentTarget);
}

function drawScenarioList(el, query) {
  const q = query.toLowerCase(), cur = T().selectedScenario;
  el.innerHTML = SCENARIO_LIBRARY.filter((s) => `${s.id} ${s.asset} ${s.title}`.toLowerCase().includes(q)).map((s) => `<button class="scenario-row ${cur === s.id ? 'on' : ''}" data-scenario="${s.id}"><b>${s.id}</b><span>${esc(s.title)}</span><i>${s.support === 'L0_REFERENCE' ? 'L0' : 'Định nghĩa'}</i></button>`).join('');
  el.querySelectorAll('[data-scenario]').forEach((b) => (b.onclick = () => { setState((s) => { s.twin.selectedScenario = b.dataset.scenario; s.twin.scenarioVersion = 'S1.0'; }); scenarioStep(); refreshScene(); }));
}

async function runScenario(button) {
  const t = T(), cfg = { ...t.runConfig }, scenario = SCENARIO_LIBRARY.find((s) => s.id === t.selectedScenario);
  button.innerHTML = '<span class="spin"></span> Đang kiểm tra readiness…'; await sleep(500);
  const capacity = Math.floor(cfg.bridgeLength / (cfg.vehicleLength + cfg.gap)) * cfg.lanes;
  let status = 'COMPLETED', errorCode = null, message = 'Hoàn tất lớp minh họa L0; không có kết luận kỹ thuật.';
  if (cfg.level === 'L2') { status = 'BLOCKED'; errorCode = 'INSUFFICIENT_DATA'; message = 'Thiếu mô hình phần tử hữu hạn, điều kiện biên, ruleSet đã duyệt và solver đã V&V.'; }
  else if (scenario.id !== 'BR-01') { status = 'BLOCKED'; errorCode = 'SOLVER_UNAVAILABLE'; message = 'Chưa hỗ trợ tính toán chuyên ngành cho kịch bản này.'; }
  else if (cfg.mode === 'SIMULTANEOUS' && capacity < 500) { status = 'BLOCKED'; errorCode = 'INVALID_SCENARIO_GEOMETRY'; message = `Cầu chỉ xếp được khoảng ${capacity} xe theo dữ liệu hình học hiện tại.`; }
  const vehicleIds = status === 'COMPLETED' ? Array.from({ length: 500 }, (_, i) => `VEH-${String(i + 1).padStart(3, '0')}`) : [];
  const now = new Date(), runId = `RUN-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const run = {
    runId, scenarioId: scenario.id, scenarioVersion: scenario.version, modelVersionId: t.modelVersionId,
    dataVersionId: t.dataVersionId, level: cfg.level, status, errorCode, message, createdAt: now.toISOString(),
    solverVersion: cfg.level === 'L0' ? 'reference-player/1.0' : 'NOT_CONNECTED', inputHash: `sha256:${pseudoHash(JSON.stringify(cfg) + t.modelVersionId)}…`,
    result: status === 'COMPLETED' ? { vehicles: 500, uniqueVehicleIds: new Set(vehicleIds).size, vehicleIds, peakOnBridge: Math.min(capacity, 34), passedBridge: 500, durationMin: cfg.duration, source: 'PRECOMPUTED_REFERENCE / ILLUSTRATIVE' } : null,
  };
  setState((s) => { s.twin.runs.unshift(run); s.twin.activeRunId = runId; });
  if (status === 'COMPLETED') { toast('Run L0 hoàn tất: 500/500 vehicleId duy nhất, không sinh chỉ số kết cấu', 'ok'); step = 4; resultTab = 'runs'; view = '3d'; }
  else toast(`${errorCode}: ${message}`, 'warn');
  drawAll();
}

function resultStep() {
  const box = root.querySelector('#stepbox'), t = T();
  box.innerHTML = `<div class="row"><button class="btn sm ${resultTab === 'runs' ? 'pri' : ''}" data-rt="runs">Run & timeseries</button><button class="btn sm ${resultTab === 'site' ? 'pri' : ''}" data-rt="site">Tính toán khu đất</button><button class="btn sm ${resultTab === 'progress' ? 'pri' : ''}" data-rt="progress">Hiện trạng 4D</button></div><div id="resultbody" class="col"></div>`;
  box.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => { resultTab = b.dataset.rt; resultStep(); refreshScene(); }));
  const el = box.querySelector('#resultbody');
  if (resultTab === 'site') siteResults(el);
  else if (resultTab === 'progress') progressResults(el);
  else runResultsV2(el, t);
}

function runResults(el, t) {
  const run = activeRun();
  if (!t.runs.length) { el.innerHTML = need('Chưa có run. Chọn một trong 18 kịch bản và chạy kiểm tra readiness.', 3); bindNeed(el); return; }
  el.innerHTML = `<div class="task"><h5>Lịch sử run bất biến</h5>${t.runs.slice(0, 8).map((r) => `<button class="run-row ${r.runId === run?.runId ? 'on' : ''}" data-run="${r.runId}"><b>${r.runId}</b><span>${r.scenarioId} · ${r.level}</span><i class="badge ${r.status === 'COMPLETED' ? 'green' : 'orange'}">${r.status}</i></button>`).join('')}</div>
  ${run ? `<div class="task ${run.status === 'COMPLETED' ? 'done' : ''}"><div class="row"><h5>${run.runId}</h5><span class="spacer"></span><span class="badge ${TRUST_LEVELS[run.level]?.tone || 'orange'}">${TRUST_LEVELS[run.level]?.label || run.level}</span></div>
    <div class="mt"><span>Scenario</span><span>${run.scenarioId} / ${run.scenarioVersion}</span><span>Model</span><span>${esc(run.modelVersionId)}</span><span>Solver</span><span>${esc(run.solverVersion)}</span><span>inputHash</span><span>${esc(run.inputHash)}</span><span>Trạng thái</span><span>${run.errorCode || run.status}</span></div>
    ${run.result ? `<div class="metric-strip"><div><b>${run.result.vehicles}</b><span>vehicleId</span></div><div><b>${run.result.uniqueVehicleIds}</b><span>ID duy nhất</span></div><div><b>${run.result.peakOnBridge}</b><span>đồng thời cực đại</span></div><div><b>${run.result.passedBridge}</b><span>đã qua cầu</span></div></div>
      <svg class="timeseries" viewBox="0 0 520 120" role="img" aria-label="Dòng xe minh họa theo thời gian"><path d="M20 95 L70 62 L120 70 L170 42 L220 56 L270 28 L320 50 L370 34 L420 58 L500 38" fill="none" stroke="#0ea5e9" stroke-width="4"/><line x1="20" y1="100" x2="500" y2="100" stroke="#94a3b8"/><text x="20" y="116">0 phút</text><text x="455" y="116">60 phút</text></svg>
      <div class="disclaimer"><b>${run.result.source}</b> · animation dùng 500 ID nhưng chỉ hiển thị số xe đang có mặt trên cầu. Ứng suất, chuyển vị, nội lực và kết luận an toàn: <b>INSUFFICIENT_DATA</b>.</div>` : `<div class="disclaimer"><b>${run.errorCode}</b> · ${esc(run.message)} Không hiển thị màu xanh “đạt”.</div>`}
    <button class="btn ai" id="explainRun">🤖 Giải thích phạm vi kết quả</button></div>` : ''}`;
  el.querySelectorAll('[data-run]').forEach((b) => (b.onclick = () => { setState((s) => (s.twin.activeRunId = b.dataset.run)); runResults(el, T()); refreshScene(); right(); }));
  el.querySelector('#explainRun')?.addEventListener('click', () => openCopilot(`Giải thích run ${run.runId}, mức ${run.level}, các dữ liệu còn thiếu và vì sao chưa được kết luận an toàn`));
}

function siteResults(el) {
  const p = currentPlan();
  if (!p) { el.innerHTML = need('Chọn một phương án tổng mặt bằng để chạy tính toán hình học L1.', 2); bindNeed(el); return; }
  const pad = currentPad(), ew = earthwork(pad, p.lakes), f0 = floodSim({ rain: 90, dur: 2, C: 0.45, drain: 30 }), f1 = floodSim({ rain: 90, dur: 2, C: 0.75, drain: 60, surface: gradedSurface(pad, p.lakes) });
  el.innerHTML = `<div class="task ${T().earthwork ? 'done' : ''}"><div class="row"><h5>Đào đắp theo lưới ${SITE.cell}×${SITE.cell} m</h5><span class="spacer"></span><span class="badge blue">L1</span></div><div class="mt"><span>Cao độ thiết kế</span><span>+${fmt(pad, 2)} m</span><span>Đào</span><span>${fmtInt(ew.cut)} m³</span><span>Đắp</span><span>${fmtInt(ew.fill)} m³</span><span>Chênh lệch</span><span>${fmtInt(ew.net)} m³</span></div><button class="btn pri" id="earthSave">Ghi nhận kết quả L1</button><p>Hệ số đất và độ chính xác phụ thuộc dữ liệu khảo sát thực tế.</p></div>
  <div class="task ${T().flood ? 'done' : ''}"><div class="row"><h5>Nước mặt/ngập sơ bộ</h5><span class="spacer"></span><span class="badge blue">L1</span></div><table class="tb small"><tr><th></th><th>Hiện trạng</th><th>Sau san nền</th></tr><tr><td>Vùng ngập &gt;10 cm</td><td>${fmtInt(f0.wetArea)} m²</td><td>${fmtInt(f1.wetArea)} m²</td></tr><tr><td>Độ sâu lớn nhất</td><td>${fmt(f0.maxDepth, 2)} m</td><td>${fmt(f1.maxDepth, 2)} m</td></tr><tr><td>Trạng thái</td><td>${f0.risk}</td><td>${f1.risk}</td></tr></table><button class="btn pri" id="floodSave">Ghi nhận kết quả L1</button><p>Phương pháp đơn giản phục vụ sàng lọc; không thay thế mô hình thủy lực.</p></div>`;
  el.querySelector('#earthSave').onclick = () => { setState((s) => (s.twin.earthwork = true)); toast('Đã lưu nguồn, giả định và kết quả đào đắp L1', 'ok'); drawAll(); };
  el.querySelector('#floodSave').onclick = () => { setState((s) => (s.twin.flood = true)); toast('Đã lưu kết quả nước mặt L1; báo cáo sẽ ghi rõ phương pháp', 'ok'); drawAll(); };
}

function progressResults(el) {
  const t = T(), p = currentPlan(), prog = p && t.surveyUpdates ? progress4D(p, t.surveyUpdates) : [];
  const avg = prog.length ? prog.reduce((a, x) => a + x.actual, 0) / prog.length : 0;
  el.innerHTML = `<div class="task ${t.surveyUpdates ? 'done' : ''}"><div class="row"><h5>Cập nhật hiện trạng từ dữ liệu khảo sát</h5><span class="spacer"></span><span class="badge blue">PM-08</span></div><p>Nhập bản đo định kỳ từ bất kỳ nguồn khảo sát phù hợp; so sánh với modelVersion và WBS trong phạm vi độ chính xác đã khai báo.</p><div class="mt"><span>Số lần cập nhật</span><span>${t.surveyUpdates}/8</span><span>Tiến độ đối chiếu minh họa</span><span>${fmt(avg * 100, 1)}%</span><span>Nguồn hiện tại</span><span>Dataset đã xác minh</span></div><div class="row"><button class="btn pri" id="surveyUpdate" ${t.surveyUpdates >= 8 ? 'disabled' : ''}>＋ Nhập bản cập nhật hiện trạng</button><a class="btn" href="#timeline">Xem S-curve</a></div><div class="disclaimer">% hoàn thành là dữ liệu tham chiếu của demo; không tự động trở thành khối lượng nghiệm thu.</div></div>`;
  el.querySelector('#surveyUpdate').onclick = async (e) => { e.target.innerHTML = '<span class="spin"></span> Đang đối chiếu version…'; await sleep(400); setState((s) => (s.twin.surveyUpdates = Math.min(8, s.twin.surveyUpdates + 1))); toast('Đã tạo bản diff hiện trạng và nhiệm vụ rà soát; baseline chưa bị thay đổi', 'ok'); drawAll(); };
}

function exportStep() {
  const box = root.querySelector('#stepbox'), t = T(), p = currentPlan(), pad = p ? currentPad() : null, run = activeRun();
  box.innerHTML = `<div class="task ${t.export2d ? 'done' : ''}"><h5>Bản vẽ 2D có modelVersion</h5><p>Mặt bằng/mặt cắt được xuất từ phiên bản đang chọn; CRS giả định phải được kiểm tra trước phát hành.</p><div class="row"><button class="btn sm pri" id="dxf" ${p ? '' : 'disabled'}>DXF mặt bằng</button><button class="btn sm" id="svg" ${p ? '' : 'disabled'}>SVG</button><button class="btn sm" id="png" ${p ? '' : 'disabled'}>PNG</button></div></div>
  <div class="task ${t.export3d ? 'done' : ''}"><h5>Mô hình 3D / CDE</h5><p>Xuất glTF/GLB từ lớp mô hình hiện tại; kết quả run giữ liên kết riêng, không tự dán sang modelVersion mới.</p><div class="row"><button class="btn sm pri" id="glb">GLB</button><button class="btn sm" id="cde">Đẩy gói lên CDE</button></div></div>
  <div class="task"><h5>Báo cáo mô phỏng có truy vết</h5><p>Gồm runId, inputHash, model/scenario/solver version, L0–L3, giả định, lỗi và giới hạn sử dụng.</p><button class="btn pri" id="report" ${run ? '' : 'disabled'}>Tải báo cáo run (.json)</button></div>`;
  const mark = (name, kind) => setState((s) => { s.twin[kind === '3D' ? 'export3d' : 'export2d'] = true; s.twin.cde.push({ name, at: todayISO(), kind, modelVersionId: s.twin.modelVersionId }); }, true);
  box.querySelector('#dxf').onclick = () => { const name = `QH_${p.key}_${t.modelVersionId}.dxf`; download(name, planDXF(p, pad, getState().project), 'application/dxf'); mark(name, '2D'); right(); };
  box.querySelector('#svg').onclick = () => { const name = `QH_${t.modelVersionId}.svg`; download(name, planSVG(p, { pad }), 'image/svg+xml'); mark(name, '2D'); right(); };
  box.querySelector('#png').onclick = async () => { const name = `QH_${t.modelVersionId}.png`; download(name, await svgToPng(planSVG(p, { pad }))); mark(name, '2D'); right(); };
  box.querySelector('#glb').onclick = async () => { view = '3d'; drawAll(); await sleep(80); const name = `DigitalTwin_${t.modelVersionId}.glb`; download(name, await scene.exportGLB()); mark(name, '3D'); toast('Đã xuất GLB theo modelVersion hiện tại', 'ok'); right(); };
  box.querySelector('#cde').onclick = () => { const name = `CDE_${t.modelVersionId}_${todayISO()}`; mark(name, 'CDE'); setState((s) => { s.twin.export2d = true; s.twin.export3d = true; }); toast('Đã tạo gói CDE có manifest và checksum', 'ok'); right(); };
  box.querySelector('#report').onclick = () => { const clean = { ...run, result: run.result ? { ...run.result, vehicleIds: `[${run.result.vehicleIds.length} unique IDs; first=${run.result.vehicleIds[0]}, last=${run.result.vehicleIds.at(-1)}]` } : null, disclaimer: TRUST_LEVELS[run.level]?.note }; download(`SimulationReport_${run.runId}.json`, JSON.stringify(clean, null, 2), 'application/json'); };
}

function right() {
  const el = root.querySelector('#right'), t = T(), run = activeRun(), p = currentPlan(), m = p ? planMetrics(p) : null;
  el.innerHTML = `<section class="panel" style="padding:14px"><div class="ph"><div><div class="kicker">Version & provenance</div><h3>Nguồn dữ liệu</h3></div><button class="btn sm ai" id="explain">🤖 Giải thích</button></div><div class="mt"><span>Dataset hợp lệ</span><span>${t.datasets.filter((d) => d.status === 'VALIDATED').length}/${t.datasets.length}</span><span>dataVersion</span><span>${esc(t.dataVersionId || '—')}</span><span>modelVersion</span><span>${esc(t.modelVersionId || '—')}</span><span>Scenario / run</span><span>${esc(t.selectedScenario)} / ${run?.runId || '—'}</span></div>${m ? `<hr><div class="mt"><span>Phương án</span><span>${esc(p.name.split('–')[0])}</span><span>Tổng sàn</span><span>${fmtInt(m.gfa)} m²</span><span>MĐXD / HSSDĐ</span><span>${fmt(m.mdxd, 1)}% / ${fmt(m.far, 2)}</span></div>` : ''}</section>
  <section class="panel" style="padding:14px"><div class="kicker">Mức tin cậy bắt buộc</div>${Object.entries(TRUST_LEVELS).map(([k, v]) => `<div class="chk"><span class="badge ${v.tone}">${k}</span><span class="grow"><b>${v.label.split('·')[1]}</b><div class="small muted">${v.note}</div></span></div>`).join('')}</section>
  <section class="panel" style="padding:14px"><div class="kicker">Đầu ra Stage-Gate</div>${[['dataReady', 'G0', 'Dataset nền đã phát hành'], ['gis', 'G0', 'CRS/ranh giới đã xác minh'], ['qtoReady', 'G2', 'QTO/BOM có nguồn'], ['earthwork', 'G2', 'Đào đắp L1'], ['flood', 'G3', 'Nước mặt L1'], ['reconstructed', 'G4', 'Model đa nguồn'], ['export2d', 'G5', 'Bản vẽ 2D'], ['export3d', 'G5/G6', 'Mô hình 3D'], ['surveyUpdates', 'G12', 'Cập nhật hiện trạng']].map(([k, g, l]) => `<div class="chk"><span class="i">${t[k] ? '✅' : '⬜'}</span><span class="grow">${l}</span><span class="badge blue">${g}</span></div>`).join('')}</section>
  <section class="panel" style="padding:14px"><div class="kicker">CDE · phiên bản bất biến</div>${t.cde.length ? t.cde.slice(-6).reverse().map((c) => `<div class="chk"><span class="i">${c.kind === '3D' ? '🧊' : c.kind === 'CDE' ? '☁' : '📐'}</span><span class="grow small">${esc(c.name)}<div class="muted">${esc(c.modelVersionId || '')}</div></span></div>`).join('') : '<p class="small muted">Chưa có tệp phát hành.</p>'}</section>`;
  el.querySelector('#explain').onclick = () => openCopilot('Giải thích phạm vi Digital Twin hiện tại, provenance, mức L0–L3 và các dữ liệu còn thiếu để chạy solver L2');
}

function draw2d() {
  const el = root.querySelector('#view2d'), t = T(), p = currentPlan(), pad = p ? currentPad() : null;
  if (!t.reconstructed) { el.innerHTML = '<section class="panel"><p class="muted">Chưa có modelVersion để hiển thị.</p></section>'; return; }
  if (step === 2 && planTab === 'planning' && p) {
    el.innerHTML = `<section class="panel plan-editor-wrap"><div class="ph"><div><div class="kicker">Interactive Site Planner</div><h3>Kéo–thả khối công trình trên địa hình</h3><p>Chọn khối, giữ chuột và kéo. Tọa độ được lưu thành model revision mới.</p></div><button class="btn sm" id="back3d">🧊 Xem lại 3D</button></div>${editablePlanSVG(p)}</section>`;
    el.querySelector('#back3d').onclick = () => { view = '3d'; drawAll(); };
    bindPlanDrag(el, p);
    return;
  }
  el.innerHTML = `<section class="panel" style="padding:10px">${planSVG(p, { pad })}</section>${p ? `<section class="panel" style="padding:10px">${sectionSVG(150, pad)}</section>` : ''}`;
}

function editablePlanSVG(plan) {
  const Y = (y) => SITE.H - y;
  const boundary = SITE.boundary.map(([x, y]) => `${x},${Y(y)}`).join(' ');
  return `<svg id="planEditorSvg" class="plan-svg plan-editor-svg" viewBox="-10 -10 ${SITE.W + 20} ${SITE.H + 20}" aria-label="Mặt bằng kéo thả">
    <defs><pattern id="siteGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#dbe4ec" stroke-width=".35"/></pattern></defs>
    <rect x="-10" y="-10" width="${SITE.W + 20}" height="${SITE.H + 20}" fill="#edf4e8"/><rect x="0" y="0" width="${SITE.W}" height="${SITE.H}" fill="url(#siteGrid)"/>
    <polygon points="${boundary}" fill="#d9e8c9" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="5 3"/>
    ${plan.roads.map((r) => `<rect x="${r.x1}" y="${Y(r.y2)}" width="${r.x2 - r.x1}" height="${r.y2 - r.y1}" fill="#6b7280" opacity=".8"/>`).join('')}
    ${plan.lakes.map((l) => `<ellipse cx="${l.cx}" cy="${Y(l.cy)}" rx="${l.rx}" ry="${l.ry}" fill="#38bdf8" opacity=".75"/>`).join('')}
    ${plan.buildings.map((b) => `<g class="drag-building ${b.id === selectedBuildingId ? 'selected' : ''}" data-drag-id="${b.id}"><rect x="${b.x}" y="${Y(b.y + b.d)}" width="${b.w}" height="${b.d}" rx="2" fill="${buildingColor(b.materialCode)}"/><text x="${b.cx}" y="${Y(b.cy)}" text-anchor="middle" dominant-baseline="middle">${b.id} · ${b.floors}T</text></g>`).join('')}
    <text x="${SITE.W - 6}" y="10" text-anchor="end" font-size="6" fill="#334155">${esc(T().modelVersionId || '')}</text>
  </svg>`;
}

function buildingColor(code) {
  return ({ 'BT-C30': '#e2e8f0', 'THEP-CB400': '#94a3b8', 'GACH-AAC': '#f5d0a9', 'KINH-ELOW': '#7dd3fc' })[code] || '#f8fafc';
}

function bindPlanDrag(el, plan) {
  const svg = el.querySelector('#planEditorSvg');
  let drag = null;
  const point = (event) => {
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.querySelectorAll('[data-drag-id]').forEach((group) => {
    group.onpointerdown = (event) => {
      event.preventDefault();
      const b = plan.buildings.find((x) => x.id === group.dataset.dragId), p = point(event);
      selectedBuildingId = b.id;
      drag = { group, b, start: p, x: b.x, y: b.y, nx: b.x, ny: b.y };
      group.setPointerCapture(event.pointerId);
      svg.querySelectorAll('.drag-building').forEach((g) => g.classList.remove('selected'));
      group.classList.add('selected');
    };
    group.onpointermove = (event) => {
      if (!drag || drag.group !== group) return;
      const p = point(event), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      drag.nx = Math.max(0, Math.min(SITE.W - drag.b.w, drag.x + dx));
      drag.ny = Math.max(0, Math.min(SITE.H - drag.b.d, drag.y - dy));
      const rect = group.querySelector('rect'), text = group.querySelector('text');
      rect.setAttribute('x', drag.nx); rect.setAttribute('y', SITE.H - drag.ny - drag.b.d);
      text.setAttribute('x', drag.nx + drag.b.w / 2); text.setAttribute('y', SITE.H - drag.ny - drag.b.d / 2);
    };
    group.onpointerup = () => {
      if (!drag) return;
      const { b, nx, ny } = drag; drag = null;
      updateBuilding(b.id, { x: +nx.toFixed(2), y: +ny.toFixed(2) });
      drawAll();
    };
  });
}

function bindNeed(el) {
  el.querySelector('[data-need]')?.addEventListener('click', (e) => { step = +e.currentTarget.dataset.need; drawAll(); });
}

function scenarioStepV2() {
  const box = root.querySelector('#stepbox'), t = T();
  if (!t.dataReady) { box.innerHTML = need('Cần phát hành dataVersion trước khi tạo scenarioVersion.'); bindNeed(box); return; }
  const selected = SCENARIO_LIBRARY.find((s) => s.id === t.selectedScenario) || SCENARIO_LIBRARY[0];
  const input = scenarioInputFor(selected.id), fromMap = mapModelInputs(selected.id), quick = runScreeningModel(selected.id, input);
  const fields = SCENARIO_INPUTS[selected.id] || [], c = t.runConfig;
  const fieldHtml = (f) => `<label class="f ${f.kind === 'limit' ? 'lim' : ''}">${f.label}${fromMap.keys.includes(f.key) && !(t.scenarioInputs[selected.id] || {})[f.key] ? ' <span class="badge blue" title="Lấy từ mô hình Bản đồ 3D">🗺️</span>' : ''}<div class="input-unit"><input type="number" data-si="${f.key}" value="${input[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}"><span>${f.unit}</span></div></label>`;
  const capacity = selected.id === 'BR-01' ? Math.floor(input.bridgeLength / (input.vehicleLength + input.gap)) * input.lanes : 0;
  box.innerHTML = `<div class="task"><div class="row"><h5>18 kịch bản công trình + UR-01 khu vực</h5><span class="spacer"></span><span class="badge green">19 L1 MODELS</span></div><input id="scenarioSearch" placeholder="Lọc theo mã hoặc công trình…"><div id="scenarioList" class="scenario-list scroll" style="max-height:250px"></div></div>
  <div class="task scenario-lab"><div class="row"><h5>${selected.id} · ${esc(selected.title)}</h5><span class="spacer"></span><span class="badge blue">L1 INTERACTIVE</span></div>
    <div class="mt"><span>Công trình</span><span>${esc(selected.asset)}</span><span>Solver L2 yêu cầu</span><span>${esc(selected.solver)}</span><span>scenarioVersion</span><span>${selected.version}</span></div>
    ${selected.id === 'BR-01' ? `<label class="f">Chế độ<select data-c2="mode"><option value="FLOW" ${c.mode === 'FLOW' ? 'selected' : ''}>A · Dòng xe qua cầu</option><option value="SIMULTANEOUS" ${c.mode === 'SIMULTANEOUS' ? 'selected' : ''}>B · Cùng hiện diện</option></select></label>` : ''}
    ${fromMap.keys.length ? `<div class="disclaimer" id="mapNote">🗺️ Lấy từ mô hình đã chỉnh trên Bản đồ 3D (phương án ${esc(fromMap.variant)}): ${fromMap.keys.join(', ')}. <button class="btn sm" id="fromMap">↺ Lấy lại từ Bản đồ 3D</button></div>` : ''}
    <h5 class="sub-h">Tham số tải / hình học</h5>
    <div class="grid g2 scenario-inputs" style="gap:7px">${fields.filter((f) => f.kind !== 'limit').map(fieldHtml).join('')}</div>
    <h5 class="sub-h">⚖ Ngưỡng chấp nhận <span class="small muted">(tham số demo do kỹ sư nhập)</span></h5>
    <div class="grid g2 scenario-inputs" style="gap:7px">${fields.filter((f) => f.kind === 'limit').map(fieldHtml).join('')}</div>
    <div class="quick-status" id="quickStatus" data-status="${quick.status}"><b>Xem nhanh L1:</b> <span class="st ${quick.status.toLowerCase()}">${quick.status}</span> ${quick.metrics.filter((m) => m.limit).map((m) => `<span class="st ${m.status.toLowerCase()}" title="${esc(m.label)}">${esc(m.label)}: ${fmt(m.value, 3)} ${m.limit.type === 'max' ? '≤' : '≥'} ${fmt(m.limit.value, 3)}</span>`).join(' ')}</div>
    ${selected.id === 'BR-01' ? `<div class="disclaimer">Sức chứa hình học: <b>${capacity} xe</b>. ${c.mode === 'SIMULTANEOUS' && capacity < input.vehicles ? '<b style="color:var(--red)">Cùng hiện diện không hợp lệ.</b>' : 'Thay tham số sẽ thay đổi dòng tải L1.'}</div>` : ''}
    <label class="f">Mức chạy<select data-c2="level"><option value="L0" ${c.level === 'L0' ? 'selected' : ''}>L0 · Trực quan</option><option value="L1" ${c.level === 'L1' ? 'selected' : ''}>L1 · Screening model tương tác</option><option value="L2" ${c.level === 'L2' ? 'selected' : ''}>L2 · Solver chuyên ngành</option></select></label>
    <div class="row"><button class="btn pri" id="runScenarioV2">▶ Chạy thử & tính lại</button>${['BR-01', 'UR-01'].includes(selected.id) ? `<a class="btn sm" href="#map?focus=hcm&view=province${selected.id === 'BR-01' ? '&sel=BR-01' : ''}">📍 Xem trên Bản đồ 3D</a>` : ''}</div><p>L1 dùng công thức proxy có đơn vị; không được dùng làm kết luận an toàn.</p></div>`;
  drawScenarioListV2(box.querySelector('#scenarioList'), '');
  box.querySelector('#scenarioSearch').oninput = (e) => drawScenarioListV2(box.querySelector('#scenarioList'), e.target.value);
  box.querySelectorAll('[data-c2]').forEach((i) => (i.onchange = () => { setState((s) => (s.twin.runConfig[i.dataset.c2] = i.value), true); scenarioStepV2(); }));
  box.querySelectorAll('[data-si]').forEach((i) => (i.onchange = () => { setState((s) => { s.twin.scenarioInputs[selected.id] = { ...(s.twin.scenarioInputs[selected.id] || {}), [i.dataset.si]: +i.value }; }, true); scenarioStepV2(); }));
  box.querySelector('#runScenarioV2').onclick = (e) => runScenarioV2(e.currentTarget);
  box.querySelector('#fromMap')?.addEventListener('click', () => { setState((s) => { const cur = { ...(s.twin.scenarioInputs[selected.id] || {}) }; fromMap.keys.forEach((k) => delete cur[k]); s.twin.scenarioInputs[selected.id] = cur; }, true); scenarioStepV2(); toast('Đã lấy lại tham số từ mô hình Bản đồ 3D', 'ok'); });
  labPanel();
}

function drawScenarioListV2(el, query) {
  const q = query.toLowerCase(), cur = T().selectedScenario;
  el.innerHTML = SCENARIO_LIBRARY.filter((s) => `${s.id} ${s.asset} ${s.title}`.toLowerCase().includes(q)).map((s) => `<button class="scenario-row ${cur === s.id ? 'on' : ''}" data-scenario2="${s.id}"><b>${s.id}</b><span>${esc(s.title)}</span><i>L1 thử nghiệm</i></button>`).join('');
  el.querySelectorAll('[data-scenario2]').forEach((b) => (b.onclick = () => { setState((s) => { s.twin.selectedScenario = b.dataset.scenario2; s.twin.scenarioVersion = 'S1.0'; s.twin.runConfig.level = 'L1'; }); labOut = null; scenarioStepV2(); refreshScene(); }));
}

async function runScenarioV2(button) {
  const t = T(), cfg = { ...t.runConfig }, scenario = SCENARIO_LIBRARY.find((s) => s.id === t.selectedScenario);
  const input = scenarioInputFor(scenario.id);
  button.innerHTML = '<span class="spin"></span> Đang tính lại từ tham số…';
  await sleep(450);
  let status = 'COMPLETED', errorCode = null, message = '', result = null;
  if (cfg.level === 'L2') {
    status = 'BLOCKED'; errorCode = 'INSUFFICIENT_DATA';
    message = 'Thiếu mô hình tính, điều kiện biên, ruleSet và solver đã V&V.';
  } else if (scenario.id === 'BR-01' && cfg.mode === 'SIMULTANEOUS') {
    const capacity = Math.floor(input.bridgeLength / (input.vehicleLength + input.gap)) * input.lanes;
    if (capacity < input.vehicles) { status = 'BLOCKED'; errorCode = 'INVALID_SCENARIO_GEOMETRY'; message = `Hình học chỉ chứa khoảng ${capacity}/${input.vehicles} xe.`; }
  }
  if (status === 'COMPLETED') {
    const screening = runScreeningModel(scenario.id, input);
    if (cfg.level === 'L0' && scenario.id !== 'BR-01') {
      status = 'BLOCKED'; errorCode = 'L0_VISUAL_NOT_CONFIGURED'; message = 'Hãy chọn L1 để chạy mô hình sàng lọc tương tác cho kịch bản này.';
    } else {
      result = { ...screening, source: cfg.level === 'L0' ? 'ILLUSTRATIVE_REFERENCE' : screening.method };
      message = screening.summary;
      if (scenario.id === 'BR-01') {
        const vehicleIds = Array.from({ length: input.vehicles }, (_, i) => `VEH-${String(i + 1).padStart(4, '0')}`);
        const capacity = Math.floor(input.bridgeLength / (input.vehicleLength + input.gap)) * input.lanes;
        Object.assign(result, { vehicles: input.vehicles, uniqueVehicleIds: new Set(vehicleIds).size, vehicleIds, peakOnBridge: Math.min(capacity, Math.max(1, Math.ceil(input.vehicles * input.bridgeLength / 1000 / 45 / (input.duration / 60)))), passedBridge: input.vehicles, durationMin: input.duration });
      }
    }
  }
  const now = new Date(), runId = `RUN-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)}`;
  const run = {
    runId, scenarioId: scenario.id, scenarioVersion: scenario.version, modelVersionId: t.modelVersionId, dataVersionId: t.dataVersionId,
    level: cfg.level, status, errorCode, message, createdAt: now.toISOString(), input,
    solverVersion: cfg.level === 'L1' ? 'screening-lab/1.0' : cfg.level === 'L0' ? 'reference-player/1.0' : 'NOT_CONNECTED',
    inputHash: `sha256:${pseudoHash(JSON.stringify(input) + JSON.stringify(cfg) + t.modelVersionId)}…`, result,
  };
  setState((s) => { s.twin.runs.unshift(run); s.twin.activeRunId = runId; });
  if (status === 'COMPLETED') { toast(`${scenario.id} đã tính lại ở ${cfg.level}; kết quả phụ thuộc tham số vừa nhập`, 'ok'); step = 4; resultTab = 'runs'; view = '3d'; }
  else toast(`${errorCode}: ${message}`, 'warn');
  drawAll();
}

function runResultsV2(el, t) {
  const run = activeRun();
  if (!t.runs.length) { el.innerHTML = need('Chưa có run. Chọn một kịch bản, sửa tham số và chạy thử L1.', 3); bindNeed(el); return; }
  el.innerHTML = `<div class="task"><h5>Lịch sử run bất biến</h5>${t.runs.slice(0, 10).map((r) => `<button class="run-row ${r.runId === run?.runId ? 'on' : ''}" data-run2="${r.runId}"><b>${r.runId}</b><span>${r.scenarioId} · ${r.level}</span><i class="badge ${r.status === 'COMPLETED' ? 'green' : 'orange'}">${r.status}</i></button>`).join('')}</div>${run ? runDetailHtml(run) : ''}`;
  el.querySelectorAll('[data-run2]').forEach((b) => (b.onclick = () => { setState((s) => (s.twin.activeRunId = b.dataset.run2)); runResultsV2(el, T()); refreshScene(); right(); }));
  el.querySelector('#explainRun2')?.addEventListener('click', () => openCopilot(`Giải thích ${run.runId}: công thức proxy L1, giả định, đơn vị và dữ liệu cần bổ sung cho L2`));
}

function runDetailHtml(run) {
  const r = run.result;
  return `<div class="task ${run.status === 'COMPLETED' ? 'done' : ''}"><div class="row"><h5>${run.scenarioId} · ${run.runId}</h5><span class="spacer"></span><span class="badge ${TRUST_LEVELS[run.level]?.tone || 'orange'}">${TRUST_LEVELS[run.level]?.label || run.level}</span></div>
    <div class="mt"><span>Model</span><span>${esc(run.modelVersionId)}</span><span>Engine</span><span>${esc(run.solverVersion)}</span><span>inputHash</span><span>${esc(run.inputHash)}</span><span>Trạng thái</span><span>${run.errorCode || r?.status || run.status}</span></div>
    ${r ? `${r.vehicles ? `<div class="metric-strip"><div><b>${r.vehicles}</b><span>vehicleId</span></div><div><b>${r.uniqueVehicleIds}</b><span>ID duy nhất</span></div><div><b>${r.peakOnBridge}</b><span>đồng thời cực đại</span></div><div><b>${r.durationMin}</b><span>phút</span></div></div>` : ''}
      <div class="screening-metrics">${(r.metrics || []).map((m) => `<div class="screening-metric ${m.status.toLowerCase()}"><span>${esc(m.label)}</span><b>${fmt(m.value, 3)} ${esc(m.unit)}</b><i>${m.status}${m.limit ? ` · ngưỡng ${m.limit.type === 'max' ? '≤' : '≥'} ${fmt(m.limit.value, 3)}` : ''}</i></div>`).join('')}</div>
      ${screeningChart(r.series || [])}<div class="disclaimer"><b>${esc(r.source || r.method)}</b> · ${esc(r.summary || run.message)} Kết quả L1 chỉ dùng sàng lọc; không phải kết luận an toàn hay nghiệm thu.</div>` : `<div class="disclaimer"><b>${run.errorCode}</b> · ${esc(run.message)} Không sinh kết quả thay thế.</div>`}
    <button class="btn ai" id="explainRun2">🤖 Giải thích công thức & giới hạn</button></div>`;
}

function screeningChart(data) {
  if (!data.length) return '';
  const max = Math.max(...data.map((p) => p.value), 0.001), pts = data.map((p, i) => `${20 + i / (data.length - 1) * 480},${100 - p.value / max * 78}`).join(' ');
  return `<svg class="timeseries" viewBox="0 0 520 120" role="img" aria-label="Đồ thị kết quả L1"><line x1="20" y1="100" x2="500" y2="100" stroke="#94a3b8"/><line x1="20" y1="15" x2="20" y2="100" stroke="#94a3b8"/><polyline points="${pts}" fill="none" stroke="#0ea5e9" stroke-width="4"/><text x="22" y="114">t0</text><text x="480" y="114">t-end</text><text x="25" y="14">max ${fmt(max, 2)}</text></svg>`;
}

// ======================================================================
// Tham số từ mô hình Bản đồ 3D (chỉ đọc) + Phòng phân tích tham số L1
// ======================================================================
const MAP_KEYS = { length: 'bridgeLength', spans: 'spans', width: 'deckWidth', clearance: 'clearance', lanes: 'lanes' };
function mapModelInputs(id) {
  const m = getState().map?.model?.hcm, b = m?.bridge, out = { keys: [], values: {}, variant: m?.variantName || 'đang làm việc' };
  if (!b || !['BR-01', 'BR-04', 'BR-05'].includes(id)) return out;
  const fields = SCENARIO_INPUTS[id] || [];
  Object.entries(MAP_KEYS).forEach(([src, key]) => { if (b[src] != null && Number.isFinite(+b[src]) && fields.some((f) => f.key === key)) { out.keys.push(key); out.values[key] = +b[src]; } });
  return out;
}
function scenarioInputFor(id) {
  return { ...scenarioDefaults(id), ...mapModelInputs(id).values, ...(T().scenarioInputs[id] || {}) };
}

let labTab = 's1', labOut = null;
const labForm = {};
const ST_COLOR = { PASS: '#16a34a', WARNING: '#f59e0b', FAIL: '#dc2626', INFO: '#64748b' };
const fv = (v) => fmt(v, Math.abs(v) >= 100 ? 0 : 3);

function labPanel() {
  const el = root?.querySelector('#lab');
  if (!el) return;
  const t = T();
  if (step !== 3 || !t.dataReady) { el.innerHTML = ''; return; }
  const id = t.selectedScenario, input = scenarioInputFor(id), fields = SCENARIO_INPUTS[id] || [], loads = fields.filter((f) => f.kind !== 'limit');
  const mets = metricLabels(id, input), pm = primaryMetric(id, input);
  const F = (k, d) => (labForm[id + k] ?? d);
  const keyOpts = (sel, list = fields) => list.map((f) => `<option value="${f.key}" ${f.key === sel ? 'selected' : ''}>${esc(f.label)}${f.kind === 'limit' ? ' (ngưỡng)' : ''}</option>`).join('');
  const metOpts = (sel, withAll) => (withAll ? `<option value="" ${sel === '' ? 'selected' : ''}>Trạng thái tổng thể</option>` : '') + mets.map((m) => `<option value="${m.i}" ${String(m.i) === String(sel) ? 'selected' : ''}>${esc(m.label)}${m.limited ? ' ⚖' : ''}</option>`).join('');
  const range = (key) => { const f = fields.find((q) => q.key === key) || fields[0]; const v = input[f.key]; return [+(Math.max(f.min, v * 0.5)).toFixed(4), +(Math.min(f.max, v === 0 ? f.max / 4 : v * 1.5)).toFixed(4)]; };
  const k1 = F('s1Key', loads[0]?.key), [a1, b1] = range(k1);
  const kx = F('s2X', loads[0]?.key), ky = F('s2Y', (loads[1] || loads[0])?.key), [ax, bx] = range(kx), [ay, by] = range(ky);
  const custom = (t.modelCases || {})[id] || [];
  const tabs = [['s1', '📈 Quét 1 tham số'], ['s2', '🟩 Quét 2 tham số'], ['tor', '🌪 Độ nhạy (tornado)'], ['mc', '🎲 Monte Carlo'], ['cases', '🧪 Bộ ca kiểm thử']];
  let form = '';
  if (labTab === 's1') form = `<div class="lab-form"><label class="f">Tham số<select id="s1Key">${keyOpts(k1)}</select></label><label class="f">Từ<input id="s1Min" type="number" value="${F('s1Min', a1)}"></label><label class="f">Đến<input id="s1Max" type="number" value="${F('s1Max', b1)}"></label><label class="f">Số bước (≤ 50)<input id="s1Steps" type="number" min="2" max="50" value="${F('s1Steps', 21)}"></label><label class="f">Chỉ tiêu đầu ra<select id="s1Metric">${metOpts(F('s1Metric', pm))}</select></label><button class="btn pri" id="s1Run">▶ Quét</button></div>`;
  else if (labTab === 's2') form = `<div class="lab-form"><label class="f">Trục X<select id="s2X">${keyOpts(kx, loads)}</select></label><label class="f">X từ<input id="s2XMin" type="number" value="${F('s2XMin', ax)}"></label><label class="f">X đến<input id="s2XMax" type="number" value="${F('s2XMax', bx)}"></label><label class="f">Trục Y<select id="s2Y">${keyOpts(ky, loads)}</select></label><label class="f">Y từ<input id="s2YMin" type="number" value="${F('s2YMin', ay)}"></label><label class="f">Y đến<input id="s2YMax" type="number" value="${F('s2YMax', by)}"></label><label class="f">Lưới (≤ 25)<input id="s2Steps" type="number" min="2" max="25" value="${F('s2Steps', 11)}"></label><label class="f">Chỉ tiêu<select id="s2Metric">${metOpts(F('s2Metric', ''), true)}</select></label><button class="btn pri" id="s2Run">▶ Quét lưới</button></div>`;
  else if (labTab === 'tor') form = `<div class="lab-form"><label class="f">Biên dao động ±%<input id="torPct" type="number" min="1" max="90" value="${F('torPct', 20)}"></label><label class="f">Chỉ tiêu<select id="torMetric">${metOpts(F('torMetric', pm))}</select></label><button class="btn pri" id="torRun">▶ Phân tích độ nhạy</button></div>`;
  else if (labTab === 'mc') form = `<div class="lab-form"><label class="f">Bất định ±% (đều)<input id="mcPct" type="number" min="1" max="90" value="${F('mcPct', 15)}"></label><label class="f">Số lần lặp N<input id="mcN" type="number" min="10" max="5000" value="${F('mcN', 1000)}"></label><label class="f">Chỉ tiêu<select id="mcMetric">${metOpts(F('mcMetric', pm))}</select></label><button class="btn pri" id="mcRun">▶ Chạy Monte Carlo</button></div>`;
  else form = `<div class="lab-form"><button class="btn pri" id="casesRun">▶ Chạy toàn bộ ca của ${id}</button><button class="btn" id="casesAll">▶▶ Chạy toàn bộ 19 kịch bản × mọi ca</button><span class="spacer"></span><label class="f">Tên ca mới<input id="caseName" placeholder="vd: Lũ 2025 thực đo"></label><button class="btn" id="caseAdd">＋ Thêm ca từ tham số hiện tại</button></div>
    <div class="small muted">Ca định sẵn: Thông thường (mặc định) · Bất lợi (tải ×1,15, khả năng ÷1,15) · Cực đoan (×1,5) · Biên dưới (×0,6). Ca tự định nghĩa: ${custom.length ? custom.map((c) => `<span class="chip">${esc(c.name)} <a data-cdel="${c.id}" title="Xóa">✕</a></span>`).join(' ') : 'chưa có'}.</div>`;
  const out = labOut && labOut.scenario === id && labOut.tab === labTab ? labOut.html : '<p class="small muted">Chọn tham số và bấm chạy. Mọi phép tính dùng mô hình proxy L1 của kịch bản đang chọn, với tham số hiện tại làm điểm cơ sở.</p>';
  const has = labOut && labOut.scenario === id;
  el.innerHTML = `<section class="panel lab-panel" style="padding:12px"><div class="row"><div><div class="kicker">MOD-03 · Phòng thử mô hình L1</div><h3 style="color:var(--primary2)">🔬 Phân tích tham số — ${esc(id)}</h3></div><span class="spacer"></span><button class="btn sm" id="labCsv" ${has ? '' : 'disabled'}>⬇ Xuất CSV</button><button class="btn sm pri" id="labSave" ${has ? '' : 'disabled'}>💾 Lưu vào lịch sử run</button></div>
    <div class="steps lab-tabs">${tabs.map(([k, l]) => `<button data-lab="${k}" class="${labTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${form}<div id="labOut" class="lab-out">${out}</div>
    <div class="disclaimer">Kết quả quét/độ nhạy/Monte Carlo là sàng lọc L1 trên công thức proxy; ngưỡng là tham số demo. Không dùng làm kết luận an toàn hay nghiệm thu.</div></section>`;
  el.querySelectorAll('[data-lab]').forEach((b) => (b.onclick = () => { labTab = b.dataset.lab; labPanel(); }));
  el.querySelectorAll('.lab-form input, .lab-form select').forEach((i) => i.addEventListener('change', () => {
    labForm[id + i.id] = i.type === 'number' ? +i.value : i.value;
    const reset = { s1Key: ['s1Min', 's1Max'], s2X: ['s2XMin', 's2XMax'], s2Y: ['s2YMin', 's2YMax'] }[i.id];
    if (reset) { reset.forEach((k) => delete labForm[id + k]); labPanel(); }
  }));
  const val = (q) => el.querySelector(q)?.value;
  el.querySelector('#s1Run')?.addEventListener('click', () => {
    const mi = +val('#s1Metric'), r = sweep1(id, input, val('#s1Key'), +val('#s1Min'), +val('#s1Max'), +val('#s1Steps'), mi), f = fields.find((q) => q.key === r.key), m = mets[mi];
    const html = `<div class="row"><b>${esc(f.label)}</b>&nbsp;→&nbsp;<b>${esc(m.label)}</b><span class="spacer"></span><span class="small">${r.pts.length} điểm</span></div>${lineChartSVG(r.pts, f, m)}
      <div id="s1Trans" class="trans" data-n="${r.transitions.length}">${r.transitions.length ? `<b>Điểm chuyển trạng thái:</b> ${r.transitions.map((x) => `<span class="st ${x.to.toLowerCase()}">${x.from} → ${x.to} tại ${esc(f.key)} ≈ ${fv(x.at)} ${esc(f.unit)} (giữa ${fv(x.between[0])}–${fv(x.between[1])})</span>`).join(' ')}` : '<b>Không có điểm chuyển trạng thái</b> trong dải quét — mở rộng dải hoặc đổi chỉ tiêu.'}</div>
      ${tableHtml(['#', esc(f.label), esc(m.label), 'Ngưỡng', 'Trạng thái chỉ tiêu', 'Tổng thể'], r.pts.map((p, i) => [i + 1, fv(p.x), fv(p.y), p.limit == null ? '—' : (p.limitType === 'max' ? '≤ ' : '≥ ') + fv(p.limit), stBadge(p.status), stBadge(p.overall)]))}`;
    setOut(id, html, { type: 'Quét 1 tham số', key: r.key, csv: [[r.key, m.label, 'limit', 'status', 'overall'], ...r.pts.map((p) => [p.x, p.y, p.limit ?? '', p.status, p.overall])], metrics: [lm('Số điểm quét', r.pts.length, 'điểm'), lm('Điểm chuyển trạng thái', r.transitions.length, 'điểm', r.transitions.length ? 'WARNING' : 'INFO'), ...r.transitions.slice(0, 3).map((x) => lm(`${x.from}→${x.to} tại ${r.key}`, x.at, f.unit, x.to))], series: r.pts.map((p, i) => ({ t: i / (r.pts.length - 1), value: p.y })), status: worst(r.pts.map((p) => p.overall)) });
  });
  el.querySelector('#s2Run')?.addEventListener('click', () => {
    const ms = val('#s2Metric'), mi = ms === '' ? null : +ms, r = sweep2(id, input, val('#s2X'), [+val('#s2XMin'), +val('#s2XMax')], val('#s2Y'), [+val('#s2YMin'), +val('#s2YMax')], +val('#s2Steps'), mi);
    const fx = fields.find((q) => q.key === r.kx), fy = fields.find((q) => q.key === r.ky), tot = r.grid.flat().length;
    const html = `<div class="row"><b>${esc(fy.label)} (dọc) × ${esc(fx.label)} (ngang)</b>&nbsp;→&nbsp;<b>${mi == null ? 'Trạng thái tổng thể' : esc(mets[mi].label)}</b><span class="spacer"></span>${['PASS', 'WARNING', 'FAIL'].map((s) => `<span class="st ${s.toLowerCase()}">${s}: ${r.count[s] || 0}/${tot}</span>`).join(' ')}</div>
      <div class="heat-wrap"><table class="heat" id="s2Heat"><tr><th>${esc(fy.key)} ↓ / ${esc(fx.key)} →</th>${r.xs.map((x) => `<th>${fv(x)}</th>`).join('')}</tr>${r.ys.map((y, j) => `<tr><th>${fv(y)}</th>${r.grid[j].map((c) => `<td class="h-${c.status.toLowerCase()}" title="${c.status}${c.value != null ? ' · ' + fv(c.value) : ''}">${c.value != null ? fv(c.value) : c.status[0]}</td>`).join('')}</tr>`).reverse().join('')}</table></div>`;
    const csv = [[r.ky, r.kx, 'status', 'value']]; r.ys.forEach((y, j) => r.xs.forEach((x, i) => csv.push([y, x, r.grid[j][i].status, r.grid[j][i].value ?? ''])));
    setOut(id, html, { type: 'Quét 2 tham số', key: `${r.kx}×${r.ky}`, csv, metrics: ['PASS', 'WARNING', 'FAIL'].map((s) => lm(`Số ô ${s}`, r.count[s] || 0, `/${tot} ô`, s)), series: r.grid.map((row, j) => ({ t: j / (r.ys.length - 1), value: row.filter((c) => c.status === 'FAIL').length })), status: r.count.FAIL ? 'FAIL' : r.count.WARNING ? 'WARNING' : 'PASS' });
  });
  el.querySelector('#torRun')?.addEventListener('click', () => {
    const mi = +val('#torMetric'), r = tornado(id, input, +val('#torPct'), mi), m = mets[mi];
    const html = `<div class="row"><b>Độ nhạy của “${esc(m.label)}” với ±${r.pct}% từng tham số</b><span class="spacer"></span><span class="small">Giá trị cơ sở: <b>${fv(r.base)} ${esc(m.unit)}</b></span></div>${tornadoSVG(r)}
      ${tableHtml(['Hạng', 'Tham số', `−${r.pct}%`, `+${r.pct}%`, 'Kết quả (−)', 'Kết quả (+)', 'Biên ảnh hưởng'], r.rows.map((x, i) => [i + 1, esc(x.label), fv(x.lo), fv(x.hi), fv(x.vLo), fv(x.vHi), `<b>${fv(x.swing)}</b>`]), 'tor-table')}`;
    setOut(id, html, { type: 'Độ nhạy tornado', key: `±${r.pct}%`, csv: [['param', 'low', 'high', 'result_low', 'result_high', 'swing'], ...r.rows.map((x) => [x.key, x.lo, x.hi, x.vLo, x.vHi, x.swing])], metrics: [lm('Giá trị cơ sở', r.base, m.unit), ...r.rows.slice(0, 3).map((x, i) => lm(`#${i + 1} ${x.label}`, x.swing, m.unit, 'INFO'))], series: r.rows.map((x, i) => ({ t: i / Math.max(1, r.rows.length - 1), value: x.swing })), status: 'INFO' });
  });
  el.querySelector('#mcRun')?.addEventListener('click', () => {
    const mi = +val('#mcMetric'), r = monteCarlo(id, input, +val('#mcPct'), +val('#mcN'), mi), m = mets[mi];
    const html = `<div class="row"><b>Monte Carlo N = ${r.N}, tham số tải/hình học dao động đều ±${r.pct}%</b><span class="spacer"></span><span class="st fail" id="mcPfail" data-p="${r.pFail}">Xác suất FAIL: ${fmt(r.pFail * 100, 1)}%</span>&nbsp;<span class="st warning">WARNING: ${fmt(r.pWarn * 100, 1)}%</span></div>
      ${histSVG(r, m)}<div class="mt"><span>Trung bình</span><span>${fv(r.mean)} ${esc(m.unit)}</span><span>P5 / P50 / P95</span><span>${fv(r.p05)} / ${fv(r.p50)} / ${fv(r.p95)} ${esc(m.unit)}</span><span>Ngưỡng chỉ tiêu</span><span>${r.limit ? (r.limit.type === 'max' ? '≤ ' : '≥ ') + fv(r.limit.value) : '—'}</span><span>Seed</span><span>2026 (tái lập được)</span></div>`;
    setOut(id, html, { type: 'Monte Carlo', key: `N=${r.N} ±${r.pct}%`, csv: [['bin_from', 'bin_to', 'count'], ...r.hist.map((h) => [h.x0, h.x1, h.n])], metrics: [lm('Xác suất FAIL', r.pFail * 100, '%', r.pFail > 0.05 ? 'FAIL' : r.pFail > 0 ? 'WARNING' : 'PASS'), lm('P95 chỉ tiêu', r.p95, m.unit), lm('Trung bình', r.mean, m.unit)], series: r.hist.map((h, i) => ({ t: i / (r.hist.length - 1), value: h.n })), status: r.pFail > 0.05 ? 'FAIL' : r.pFail > 0 ? 'WARNING' : 'PASS' });
  });
  el.querySelector('#casesRun')?.addEventListener('click', () => {
    const res = runCases(id, [...presetCases(id), ...custom]), lim = (res[0]?.metrics || []).map((m, i) => ({ m, i })).filter((x) => x.m.limit);
    const ok = res.filter((r) => r.status === 'PASS').length, fail = res.filter((r) => r.status === 'FAIL').length;
    const html = `<div class="row"><b>${res.length} ca × ${lim.length} chỉ tiêu có ngưỡng</b><span class="spacer"></span><span class="st pass" id="casesSum" data-n="${res.length}" data-pass="${ok}" data-fail="${fail}">Đạt ${ok}</span>&nbsp;<span class="st warning">Cảnh báo ${res.length - ok - fail}</span>&nbsp;<span class="st fail">Không đạt ${fail}</span></div>
      ${tableHtml(['Ca', 'Tên', ...lim.map((x) => esc(x.m.label)), 'Kết luận'], res.map((r) => [esc(r.id), esc(r.name) + (r.preset ? '' : ' <span class="badge blue">tự định nghĩa</span>'), ...lim.map((x) => `<span class="st ${r.metrics[x.i].status.toLowerCase()}">${fv(r.metrics[x.i].value)}</span>`), stBadge(r.status)]), 'cases-table')}`;
    setOut(id, html, { type: 'Bộ ca kiểm thử', key: `${res.length} ca`, csv: [['case', 'name', ...lim.map((x) => x.m.label), 'status'], ...res.map((r) => [r.id, r.name, ...lim.map((x) => r.metrics[x.i].value), r.status])], metrics: [lm('Số ca', res.length, 'ca'), lm('Đạt', ok, 'ca', 'PASS'), lm('Không đạt', fail, 'ca', fail ? 'FAIL' : 'PASS')], series: res.map((r, i) => ({ t: i / Math.max(1, res.length - 1), value: r.status === 'FAIL' ? 2 : r.status === 'WARNING' ? 1 : 0 })), status: fail ? 'FAIL' : ok < res.length ? 'WARNING' : 'PASS' });
  });
  el.querySelector('#casesAll')?.addEventListener('click', () => {
    const all = SCENARIO_LIBRARY.map((s) => { const res = runCases(s.id, [...presetCases(s.id), ...((T().modelCases || {})[s.id] || [])]); return { id: s.id, title: s.title, n: res.length, pass: res.filter((r) => r.status === 'PASS').length, warn: res.filter((r) => r.status === 'WARNING').length, fail: res.filter((r) => r.status === 'FAIL').length, statuses: res.map((r) => r.status) }; });
    const tot = all.reduce((a, r) => ({ n: a.n + r.n, pass: a.pass + r.pass, warn: a.warn + r.warn, fail: a.fail + r.fail }), { n: 0, pass: 0, warn: 0, fail: 0 });
    const html = `<div class="row"><b>Tổng hợp ${all.length} kịch bản · ${tot.n} ca</b><span class="spacer"></span><span class="st pass" id="casesAllSum" data-scen="${all.length}" data-n="${tot.n}">Đạt ${tot.pass}</span>&nbsp;<span class="st warning">Cảnh báo ${tot.warn}</span>&nbsp;<span class="st fail">Không đạt ${tot.fail}</span></div>
      ${tableHtml(['Kịch bản', 'Nội dung', 'Số ca', 'Đạt', 'Cảnh báo', 'Không đạt', 'Chuỗi kết quả'], all.map((r) => [`<b>${r.id}</b>`, esc(r.title), r.n, r.pass, r.warn, r.fail, r.statuses.map((s) => `<span class="dot" style="background:${ST_COLOR[s]}" title="${s}"></span>`).join('')]), 'cases-all')}`;
    setOut(id, html, { type: 'Toàn bộ 19 kịch bản × mọi ca', key: `${tot.n} ca`, csv: [['scenario', 'cases', 'pass', 'warning', 'fail'], ...all.map((r) => [r.id, r.n, r.pass, r.warn, r.fail])], metrics: [lm('Tổng số ca', tot.n, 'ca'), lm('Đạt', tot.pass, 'ca', 'PASS'), lm('Cảnh báo', tot.warn, 'ca', 'WARNING'), lm('Không đạt', tot.fail, 'ca', 'FAIL')], series: all.map((r, i) => ({ t: i / (all.length - 1), value: r.fail })), status: tot.fail ? 'FAIL' : tot.warn ? 'WARNING' : 'PASS' });
  });
  el.querySelector('#caseAdd')?.addEventListener('click', () => {
    const name = (val('#caseName') || '').trim() || `Ca tự định nghĩa ${custom.length + 1}`;
    setState((s) => { s.twin.modelCases = s.twin.modelCases || {}; const list = s.twin.modelCases[id] || []; list.push({ id: `${id}-U${String(list.length + 1).padStart(2, '0')}`, name, input: { ...input } }); s.twin.modelCases[id] = list; }, true);
    toast(`Đã thêm ca “${name}” cho ${id}`, 'ok'); labPanel();
  });
  el.querySelectorAll('[data-cdel]').forEach((a) => (a.onclick = () => { setState((s) => { s.twin.modelCases[id] = (s.twin.modelCases[id] || []).filter((c) => c.id !== a.dataset.cdel); }, true); labPanel(); }));
  el.querySelector('#labCsv')?.addEventListener('click', () => {
    const q = (v) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    download(`${id}_${labOut.meta.type.replace(/[^\p{L}\p{N}]+/gu, '_')}_${todayISO()}.csv`, '﻿' + labOut.meta.csv.map((r) => r.map(q).join(',')).join('\n'), 'text/csv;charset=utf-8');
  });
  el.querySelector('#labSave')?.addEventListener('click', () => saveLabRun(id, input));
}

const lm = (label, value, unit, status = 'INFO') => ({ label, value: Number.isFinite(+value) ? +(+value).toFixed(4) : 0, unit, status });
const worst = (arr) => (arr.includes('FAIL') ? 'FAIL' : arr.includes('WARNING') ? 'WARNING' : 'PASS');
const stBadge = (s) => `<span class="st ${String(s).toLowerCase()}">${s}</span>`;
const tableHtml = (head, rows, cls = '') => `<div class="lab-table"><table class="tb small ${cls}"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
function setOut(id, html, meta) {
  labOut = { scenario: id, tab: labTab, html, meta };
  labPanel();
}
function saveLabRun(id, input) {
  const t = T(), sc = SCENARIO_LIBRARY.find((s) => s.id === id), now = new Date(), runId = `RUN-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)}`, m = labOut.meta;
  const run = { runId, scenarioId: id, scenarioVersion: sc?.version || 'S1.0', modelVersionId: t.modelVersionId, dataVersionId: t.dataVersionId, level: 'L1', status: 'COMPLETED', errorCode: null,
    message: `${m.type} (${m.key})`, createdAt: now.toISOString(), input: { ...input, analysis: m.type, analysisKey: m.key }, solverVersion: 'screening-lab/1.1 · param-study',
    inputHash: `sha256:${pseudoHash(JSON.stringify(input) + m.type + m.key)}…`,
    result: { status: m.status, metrics: m.metrics, summary: `${m.type} · ${m.key}. Phân tích tham số trên mô hình proxy L1; ngưỡng là tham số demo.`, series: m.series.length > 1 ? m.series : [{ t: 0, value: 0 }, { t: 1, value: m.series[0]?.value || 0 }], method: 'L1_PARAM_STUDY/1.0', analysis: { type: m.type, key: m.key, rows: m.csv.length - 1 } } };
  setState((s) => { s.twin.runs.unshift(run); s.twin.activeRunId = runId; }, true);
  toast(`Đã lưu ${runId} (${m.type}) vào lịch sử run — xem ở bước 4`, 'ok');
  right();
}

// ---------- biểu đồ SVG ----------
function lineChartSVG(pts, f, m) {
  const W = 680, H = 230, l = 56, r = 16, tp = 14, b = 34;
  const ys = pts.map((p) => p.y).concat(pts[0].limit != null ? [pts[0].limit] : []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const X = (v) => l + ((v - x0) / (x1 - x0 || 1)) * (W - l - r), Y = (v) => tp + (1 - (v - y0) / (y1 - y0)) * (H - tp - b);
  const lim = pts[0].limit;
  return `<svg class="sweep-chart" id="s1Chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ quét tham số">
    <line x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}" stroke="#94a3b8"/><line x1="${l}" y1="${tp}" x2="${l}" y2="${H - b}" stroke="#94a3b8"/>
    ${[0, 0.5, 1].map((k) => { const v = y0 + (y1 - y0) * k; return `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e8f0"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end">${fv(v)}</text>`; }).join('')}
    ${lim != null ? `<line class="limit-line" x1="${l}" x2="${W - r}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="#dc2626" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${W - r - 4}" y="${Y(lim) - 5}" text-anchor="end" fill="#dc2626">ngưỡng ${pts[0].limitType === 'max' ? '≤' : '≥'} ${fv(lim)}</text>` : ''}
    <polyline points="${pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="none" stroke="#0ea5e9" stroke-width="2.5"/>
    ${pts.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${ST_COLOR[p.status]}"><title>${f.key}=${fv(p.x)} → ${fv(p.y)} (${p.status})</title></circle>`).join('')}
    <text x="${l}" y="${H - 12}">${fv(x0)}</text><text x="${W - r}" y="${H - 12}" text-anchor="end">${fv(x1)}</text><text x="${(l + W - r) / 2}" y="${H - 12}" text-anchor="middle">${esc(f.label)} (${esc(f.unit)})</text>
    <text x="${l + 4}" y="${tp + 10}">${esc(m.label)} (${esc(m.unit)})</text></svg>`;
}
function tornadoSVG(r) {
  const rows = r.rows, W = 680, rowH = 22, H = rows.length * rowH + 40, l = 230, rr = 20;
  const vals = rows.flatMap((x) => [x.vLo, x.vHi]).concat([r.base]);
  let a = Math.min(...vals), b = Math.max(...vals);
  if (b - a < 1e-9) { a -= 1; b += 1; }
  const X = (v) => l + ((v - a) / (b - a)) * (W - l - rr);
  return `<svg class="sweep-chart" id="torChart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ tornado">
    ${rows.map((x, i) => { const y = 10 + i * rowH; return `<text x="${l - 6}" y="${y + 14}" text-anchor="end">${esc(x.label.slice(0, 34))}</text><rect x="${Math.min(X(x.vLo), X(r.base))}" y="${y + 3}" width="${Math.abs(X(x.vLo) - X(r.base))}" height="${rowH - 7}" fill="#60a5fa"><title>−${r.pct}%: ${fv(x.vLo)}</title></rect><rect x="${Math.min(X(x.vHi), X(r.base))}" y="${y + 3}" width="${Math.abs(X(x.vHi) - X(r.base))}" height="${rowH - 7}" fill="#f97316"><title>+${r.pct}%: ${fv(x.vHi)}</title></rect>`; }).join('')}
    <line x1="${X(r.base)}" x2="${X(r.base)}" y1="4" y2="${H - 24}" stroke="#0f172a"/><text x="${X(r.base)}" y="${H - 8}" text-anchor="middle">cơ sở ${fv(r.base)}</text>
    <text x="${l}" y="${H - 8}">${fv(a)}</text><text x="${W - rr}" y="${H - 8}" text-anchor="end">${fv(b)}</text>
    <rect x="${W - 200}" y="${H - 20}" width="10" height="10" fill="#60a5fa"/><text x="${W - 186}" y="${H - 11}">−${r.pct}%</text><rect x="${W - 140}" y="${H - 20}" width="10" height="10" fill="#f97316"/><text x="${W - 126}" y="${H - 11}">+${r.pct}%</text></svg>`;
}
function histSVG(r, m) {
  const W = 680, H = 210, l = 40, rr = 16, tp = 12, b = 32, mxN = Math.max(...r.hist.map((h) => h.n), 1);
  const a = r.hist[0].x0, z = r.hist[r.hist.length - 1].x1, X = (v) => l + ((v - a) / (z - a || 1)) * (W - l - rr), bw = (W - l - rr) / r.hist.length;
  const lim = r.limit;
  const col = (h) => {
    if (!lim) return '#0ea5e9';
    const mid = (h.x0 + h.x1) / 2;
    const s = lim.type === 'max' ? (mid > lim.value ? 'FAIL' : mid > lim.value * 0.85 ? 'WARNING' : 'PASS') : (mid < lim.value ? 'FAIL' : mid < lim.value / 0.85 ? 'WARNING' : 'PASS');
    return ST_COLOR[s];
  };
  return `<svg class="sweep-chart" id="mcHist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram Monte Carlo">
    <line x1="${l}" y1="${H - b}" x2="${W - rr}" y2="${H - b}" stroke="#94a3b8"/>
    ${r.hist.map((h, i) => { const hh = (h.n / mxN) * (H - tp - b); return `<rect x="${l + i * bw + 1}" y="${H - b - hh}" width="${Math.max(1, bw - 2)}" height="${hh}" fill="${col(h)}"><title>${fv(h.x0)}–${fv(h.x1)}: ${h.n}</title></rect>`; }).join('')}
    ${lim && lim.value >= a && lim.value <= z ? `<line x1="${X(lim.value)}" x2="${X(lim.value)}" y1="${tp}" y2="${H - b}" stroke="#dc2626" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${X(lim.value) + 4}" y="${tp + 10}" fill="#dc2626">ngưỡng ${fv(lim.value)}</text>` : ''}
    <text x="${l}" y="${H - 12}">${fv(a)}</text><text x="${W - rr}" y="${H - 12}" text-anchor="end">${fv(z)}</text><text x="${(l + W - rr) / 2}" y="${H - 12}" text-anchor="middle">${esc(m.label)} (${esc(m.unit)}) · chiều cao cột = số lần</text></svg>`;
}
