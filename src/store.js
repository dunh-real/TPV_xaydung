// Trạng thái ứng dụng (lưu localStorage) + logic AI Gatekeeper
import DATA from './data/aipm-data.js';
import { todayISO, addDays } from './lib/util.js';

const KEY = 'aipm-dt-demo-v3';

export const LANES = [
  { id: 'CDT', name: 'Chủ đầu tư / Ban QLDA', short: 'Chủ đầu tư', color: '#076da5' },
  { id: 'SXD', name: 'Sở Xây dựng (thẩm quyền theo NĐ 217/2026)', short: 'Sở XD', color: '#7c3aed' },
  { id: 'MT', name: 'Sở Nông nghiệp và Môi trường (MT/Đất đai)', short: 'NN&MT', color: '#16a34a' },
  { id: 'PCCC', name: 'Công an (PCCC & CNCH)', short: 'Công an PCCC', color: '#dc5526' },
  { id: 'TV', name: 'Đơn vị tư vấn', short: 'Tư vấn', color: '#0891b2' },
  { id: 'UB', name: 'UBND cấp tỉnh / cấp xã (theo thẩm quyền 2 cấp)', short: 'UBND', color: '#b45309' },
  { id: 'NT', name: 'Nhà thầu', short: 'Nhà thầu', color: '#475569' },
];

// Điều kiện đầu ra 3D/2D & hồ sơ AI cho từng cổng (AI Gatekeeper)
export const GATE_REQ = {
  G0: [
    { key: 'dataReady', label: 'Dataset nền đã được kiểm tra và phát hành' },
    { key: 'gis', label: 'Ranh giới/CRS đã được xác minh trên lớp GIS' },
  ],
  G1: [
    { key: 'scenario', label: 'Chọn phương án quy hoạch trên Digital Twin' },
    { doc: 'totrinh', label: 'Tờ trình đề nghị thẩm định chủ trương đầu tư (AI)' },
  ],
  G2: [
    { key: 'earthwork', label: 'Mô phỏng khối lượng san nền đào – đắp' },
    { doc: 'tmdt', label: 'Sơ bộ tổng mức đầu tư (AI bóc tách từ mô hình)' },
  ],
  G3: [{ key: 'flood', label: 'Mô phỏng thoát nước mưa / ngập úng' }, { doc: 'dtm', label: 'Báo cáo ĐTM (dự thảo AI)' }],
  G4: [{ key: 'reconstructed', label: 'Mô hình BIM/địa hình/hiện trạng đã chuẩn hóa' }],
  G5: [
    { key: 'export2d', label: 'Xuất bộ bản vẽ 2D (mặt bằng, mặt cắt) chuẩn CAD' },
    { key: 'export3d', label: 'Xuất mô hình 3D Digital Twin lên CDE' },
  ],
  G6: [{ key: 'export3d', label: 'Mô hình 3D đã đưa vào môi trường CDE' }],
  G9: [{ key: 'construction', label: 'Mô phỏng biện pháp tổ chức thi công & PCCC' }],
  G12: [{ key: 'surveyUpdates', label: 'Ít nhất 01 lần cập nhật hiện trạng có nguồn và độ tin cậy' }],
  G14: [{ doc: 'nghiemthu', label: 'Biên bản nghiệm thu khối lượng (AI từ dữ liệu 4D)' }],
};

export const DOC_TYPES = {
  totrinh: { name: 'Tờ trình đề nghị thẩm định chủ trương đầu tư', gate: 'G1', icon: '📄' },
  tmdt: { name: 'Sơ bộ tổng mức đầu tư', gate: 'G2', icon: '💰' },
  dtm: { name: 'Báo cáo đánh giá tác động môi trường (dự thảo)', gate: 'G3', icon: '🌿' },
  nghiemthu: { name: 'Biên bản nghiệm thu khối lượng hoàn thành', gate: 'G14', icon: '✅' },
  congvan: { name: 'Công văn đề nghị thẩm định / cho ý kiến', gate: '*', icon: '✉️' },
  demo3: { name: 'Tờ trình mẫu Demo 3 (cài sẵn 2 lỗi pháp lý)', gate: 'G5', icon: '🧪' },
};

function seedWorkflow() {
  const t = todayISO();
  return [
    { id: 'HS-101', title: 'Hồ sơ đề xuất chủ trương đầu tư', gate: 'G1', route: ['CDT', 'TV', 'SXD', 'UB'], at: 2, days: 9, sla: 7, log: [] },
    { id: 'HS-102', title: 'Hồ sơ thông tin quy hoạch & ranh giới GIS', gate: 'G0', route: ['CDT', 'SXD', 'UB'], at: 1, days: 3, sla: 10, log: [] },
    { id: 'HS-103', title: 'Hồ sơ ĐTM – tham vấn cộng đồng', gate: 'G3', route: ['TV', 'CDT', 'MT', 'UB'], at: 2, days: 18, sla: 15, log: [] },
    { id: 'HS-104', title: 'Hồ sơ thiết kế PCCC (thẩm duyệt)', gate: 'G9', route: ['TV', 'CDT', 'PCCC'], at: 2, days: 4, sla: 15, log: [] },
    { id: 'HS-105', title: 'Phương án bồi thường, GPMB đợt 1', gate: 'G8', route: ['CDT', 'MT', 'UB'], at: 1, days: 25, sla: 20, log: [] },
    { id: 'HS-106', title: 'Báo cáo dữ liệu khảo sát/hiện trạng đa nguồn', gate: 'G4', route: ['TV', 'CDT'], at: 0, days: 2, sla: 5, log: [] },
    { id: 'HS-107', title: 'Hồ sơ đề nghị tạm ứng hợp đồng thi công', gate: 'G11', route: ['NT', 'TV', 'CDT'], at: 0, days: 1, sla: 7, log: [] },
  ].map((x, i) => ({ ...x, created: addDays(t, -x.days), tenant: 'dong-nai', ward: 'Phường Trấn Biên', ubLevel: ['HS-102', 'HS-105'].includes(x.id) ? 'xã' : 'tỉnh', loc: [900 + (i % 3) * 60 - 60, -600 + Math.floor(i / 3) * 60 - 60] }));
}

const defaults = () => ({
  project: {
    name: 'Khu dân cư sinh thái Phân khu A (Dự án thí điểm)',
    code: 'DA-2026-017',
    owner: 'Ban Quản lý dự án đầu tư xây dựng tỉnh',
    decider: 'Ủy ban nhân dân tỉnh',
    location: 'Phường Trấn Biên, tỉnh Đồng Nai',
    tenant: 'dong-nai',
    ward: 'Phường Trấn Biên',
    maDvhc: 'Tỉnh 75 · xã/phường 26707 (mã mẫu — đối chiếu danh mục ĐVHC 2025)',
    appraisalDate: '2027-02-15',
    group: 'Nhóm B',
    category: 'Dân dụng & Hạ tầng kỹ thuật',
    capital: 'Vốn đầu tư công (ngân sách tỉnh)',
    start: todayISO(),
  },
  params: { mdxd: 40, floorsMin: 3, floorsMax: 12, setback: 6, far: 2.6 },
  twin: {
    datasets: [], dataReady: false, reconstructed: false, gis: false, filtered: false,
    dataVersionId: null, modelVersionId: null, qtoReady: false, materialVariant: 'A', materialEdits: {},
    planEdits: {}, customBuildings: [], designRevision: 0,
    selectedScenario: 'BR-01', scenarioVersion: 'S1.0', runs: [], activeRunId: null,
    scenarioInputs: {},
    runConfig: { level: 'L0', mode: 'FLOW', vehicles: 500, duration: 60, bridgeLength: 300, lanes: 2, vehicleLength: 12, gap: 5 },
    scenario: null, pad: null, earthwork: false, flood: false, construction: false,
    export2d: false, export3d: false, surveyUpdates: 0, cde: [],
  },
  checklist: {}, // id -> {done, file, draft, ai:'pass'|'warn', by}
  docs: [],
  workflow: seedWorkflow(),
  gates: {}, // G0 -> {passed:true, at}
  filter: 'all',
  map: { tenant: null, role: 'guest', user: null, regions: [], sketches: [], tasks: [], accessLog: [], analyses: [], basemap: 'sat', variants: [], work: {}, model: {} },
});

let state = load();
const subs = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.project) {
      const d = defaults();
      return { ...d, ...s, twin: { ...d.twin, ...s.twin }, params: { ...d.params, ...s.params }, project: { ...d.project, ...s.project }, map: { ...d.map, ...(s.map || {}) } };
    }
  } catch {}
  return defaults();
}
export const getState = () => state;
export function setState(fn, silent = false) {
  fn(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!silent) subs.forEach((f) => f(state));
}
export const subscribe = (f) => (subs.add(f), () => subs.delete(f));
export function resetState() {
  state = defaults();
  localStorage.setItem(KEY, JSON.stringify(state));
  subs.forEach((f) => f(state));
}

export { DATA };

// ---------- Tính trạng thái cổng ----------
export function gateChecklist(gid) {
  const items = DATA.checklists.filter((c) => c.gate === gid);
  const done = items.filter((c) => state.checklist[c.id]?.done).length;
  const crit = items.filter((c) => c.critical);
  const critDone = crit.filter((c) => state.checklist[c.id]?.done).length;
  return { items, done, total: items.length, crit: crit.length, critDone };
}
export function reqMet(r) {
  if (r.doc) return state.docs.some((d) => d.type === r.doc && !d.legalIssues); // tạo bởi MOD-04 + đạt kiểm tra MOD-05
  if (r.key === 'scenario') return !!state.twin.scenario;
  if (r.key === 'surveyUpdates') return state.twin.surveyUpdates > 0;
  return !!state.twin[r.key];
}
export function gateStatus(gid) {
  const idx = DATA.gates.findIndex((g) => g.id === gid);
  if (state.gates[gid]?.passed) return 'passed';
  const prevOk = idx === 0 || state.gates[DATA.gates[idx - 1].id]?.passed;
  const cl = gateChecklist(gid);
  const reqs = GATE_REQ[gid] || [];
  const ok = cl.critDone === cl.crit && reqs.every(reqMet);
  if (!prevOk) return 'locked';
  return ok ? 'ready' : 'active';
}
export function currentGate() {
  return DATA.gates.find((g) => !state.gates[g.id]?.passed) || DATA.gates[DATA.gates.length - 1];
}
export function overallChecklist() {
  const done = Object.values(state.checklist).filter((x) => x.done).length;
  return { done, total: DATA.checklists.length };
}
