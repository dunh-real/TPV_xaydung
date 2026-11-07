import { SITE, demGrid, polyArea, planMetrics, earthwork } from './engine.js';
import { currentPlan } from './plan.js';
import { qto, levels } from './struct/design.js';

export const REPORT_TYPES = {
  proposal: { name: '01 · Đề xuất dự án đầu tư (A.I.4)', gate: 'G1' },
  feasibility: { name: '02 · Tờ trình thẩm định BCNCKT (TT-1)', gate: 'G5' },
  eia: { name: '03 · Báo cáo ĐTM 2026', gate: 'G3' },
  estimate: { name: '04 · Dự toán san nền & Tổng mức đầu tư', gate: 'G2' },
};

// Giá trị số giữ nguyên đơn vị. Tỷ lệ chi phí là 0..1 (0.02 = 2%).
export const REPORT_FIELDS = {
  model_scope: 'Nguồn quy mô công trình: twin, cad hoặc map (công trình đã chọn)',
  issue_date: 'Ngày lập hồ sơ YYYY-MM-DD', document_place: 'Địa danh lập hồ sơ',
  project_name: 'Tên dự án', investor: 'Chủ đầu tư/nhà đầu tư', project_location: 'Địa điểm',
  project_group: 'Nhóm dự án', building_type: 'Loại công trình', building_grade: 'Cấp công trình', design_life: 'Thời hạn sử dụng theo thiết kế',
  decider: 'Người quyết định đầu tư', capital_source: 'Nguồn vốn', contact: 'Thông tin liên hệ chủ đầu tư', recipient: 'Cơ quan nhận',
  document_number: 'Số văn bản', signer: 'Họ tên người ký', duration: 'Tiến độ/phân kỳ đầu tư', operating_term: 'Thời hạn hoạt động',
  survey: 'Nguồn/phương pháp khảo sát', crs: 'Hệ tọa độ', coordinates: 'Tọa độ ranh giới', boundaries: 'Tứ cận',
  land_number: 'Số thửa', map_number: 'Số tờ bản đồ', land_type: 'Hiện trạng sử dụng đất', planning_approval: 'Quy hoạch được duyệt',
  objectives: 'Mục tiêu dự án', products: 'Sản phẩm/công suất', capital_plan: 'Cơ cấu và tiến độ góp vốn',
  vsic_code: 'Mã ngành VSIC', cpc_code: 'Mã ngành CPC nếu có', housing_type: 'Loại nhà ở', urban_status: 'Có/không thuộc đô thị',
  heritage_status: 'Có/không thuộc phạm vi bảo vệ di tích', restricted_development_status: 'Có/không thuộc khu hạn chế phát triển',
  contribution_method: 'Phương thức góp vốn', contribution_schedule: 'Tiến độ góp vốn', exchange_rate_source: 'Nguồn/ngày tỷ giá',
  socioeconomic: 'Hiệu quả kinh tế xã hội', land_explanation: 'Nhu cầu đất/chuyển mục đích/GPMB', planning_explanation: 'Sự phù hợp quy hoạch',
  foreign_conditions: 'Điều kiện nhà đầu tư nước ngoài', investment_conditions: 'Điều kiện suất đầu tư/lao động', incentives: 'Đề xuất ưu đãi/hỗ trợ và căn cứ',
  standards: 'Tiêu chuẩn/quy chuẩn lựa chọn', legal_basis: 'Căn cứ pháp lý đã đối chiếu', designer: 'Đơn vị lập BCNCKT', surveyor: 'Đơn vị khảo sát', reviewer: 'Đơn vị thẩm tra',
  appraisal_scope: 'Phạm vi trình thẩm định', attachments: 'Hồ sơ gửi kèm', contractor_capacity: 'Chứng chỉ năng lực/hành nghề',
  eia_baseline: 'Số liệu môi trường nền', sensitive_receptors: 'Yếu tố nhạy cảm', eia_impacts: 'Tác động thi công', eia_mitigation: 'Biện pháp giảm thiểu',
  operation_impact_assessment: 'Tác động vận hành', monitoring_program: 'Chương trình quan trắc', consult: 'Kết quả tham vấn',
  dust_emission: 'Phát thải bụi', noise_level: 'Tiếng ồn', waste_quantity: 'Chất thải rắn',
  wastewater_source: 'Nguồn công suất XLNT', mitigation_status: 'Trạng thái biện pháp BVMT', design_status: 'Trạng thái thiết kế', appraisal_status: 'Trạng thái thẩm định',
  terrain_validation: 'Xác nhận địa hình', design_elevation_approval: 'Phê duyệt cao độ san nền', earthwork_validation: 'Xác nhận đào đắp', drainage_design: 'Thiết kế thoát nước',
  material_factor_note: 'Hệ số nở rời/đầm chặt/vật liệu',
  reliability_assessment: 'Đánh giá độ tin cậy dữ liệu ĐTM', restoration_plan: 'Phục hồi môi trường/bồi hoàn đa dạng sinh học',
  green_classification: 'Phân loại xanh nếu đề nghị', conclusion: 'Kết luận/kiến nghị/cam kết của chủ dự án',
};
export const REPORT_NUMBERS = {
  site_area: 'm²', building_footprint: 'm²', floor_area: 'm²', road_area: 'm²', green_area: 'm²', technical_area: 'm²',
  cut_volume: 'm³', fill_volume: 'm³', drain_length: 'm', water_pipe_length: 'm', duration_months: 'tháng', ww_capacity: 'm³/ngày', expected_jobs: 'người',
  land_cost: 'VND', equipment_cost: 'VND', pm_rate: '0..1', consult_rate: '0..1', other_rate: '0..1', quantity_reserve: '0..1', price_reserve: '0..1',
  rain_intensity: 'mm/h', runoff_coeff: '0..1', floors: 'tầng', building_height: 'm', population: 'người', units: 'căn',
  design_elevation: 'm', natural_elevation_min: 'm', natural_elevation_max: 'm', natural_elevation_mean: 'm',
  total_investment: 'VND',
  equity_capital: 'VND', loan_capital: 'VND', other_capital: 'VND', reinvested_profit: 'VND', investment_usd: 'USD', equity_usd: 'USD', equity_percent: '%', planning_compatible_area: 'm²',
};
export const PRICE_CODES = ['SN_DAO', 'SN_DAP', 'SN_CAPDAT', 'GT_DUONG', 'TN_CONG', 'CN_ONG', 'XD_XUONG', 'CX_CANHQUAN'];
export const REQUIRED = {
  proposal: ['project_name', 'investor', 'project_location', 'site_area', 'objectives', 'products', 'total_investment', 'capital_plan', 'operating_term', 'duration', 'expected_jobs', 'land_explanation', 'planning_approval', 'signer'],
  feasibility: ['project_name', 'investor', 'project_group', 'building_type', 'building_grade', 'design_life', 'project_location', 'contact', 'recipient', 'total_investment', 'capital_source', 'duration', 'standards', 'designer', 'surveyor', 'appraisal_scope', 'legal_basis', 'attachments', 'contractor_capacity', 'signer'],
  eia: ['project_name', 'investor', 'project_location', 'site_area', 'survey', 'coordinates', 'eia_baseline', 'sensitive_receptors', 'ww_capacity', 'wastewater_source', 'monitoring_program', 'consult', 'terrain_validation', 'design_elevation_approval', 'earthwork_validation', 'drainage_design'],
  estimate: ['site_area', 'building_footprint', 'floor_area', 'road_area', 'green_area', 'technical_area', 'cut_volume', 'fill_volume', 'drain_length', 'water_pipe_length', 'duration_months', 'ww_capacity', 'expected_jobs', 'land_cost', 'equipment_cost', 'pm_rate', 'consult_rate', 'other_rate', 'quantity_reserve', 'price_reserve', 'rain_intensity', 'runoff_coeff', 'crs'],
};

export function validateReportInputs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Input phải là một object JSON.');
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || v === '') continue;
    if (k in REPORT_NUMBERS) {
      if (typeof v !== 'number' || !Number.isFinite(v) || (!k.includes('elevation') && v < 0) || (REPORT_NUMBERS[k] === '0..1' && v > 1) || (k === 'equity_percent' && v > 100)) throw new Error(`${k}: giá trị số ngoài miền cho phép${REPORT_NUMBERS[k] === '0..1' ? ' (0..1)' : ''}.`);
    } else if (k in REPORT_FIELDS) {
      if (typeof v !== 'string' || v.length > 20000) throw new Error(`${k}: cần chuỗi tối đa 20.000 ký tự.`);
      if (k === 'model_scope' && !['twin', 'cad', 'map'].includes(v)) throw new Error('model_scope chỉ nhận twin, cad hoặc map.');
    } else if (k === 'unit_prices') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('unit_prices phải là object theo mã công tác.');
      for (const [code, p] of Object.entries(v)) {
        if (!PRICE_CODES.includes(code) || typeof p?.value !== 'number' || !Number.isFinite(p.value) || p.value < 0 || typeof p.source !== 'string' || !p.source.trim()) throw new Error(`Đơn giá ${code}: cần value không âm và source.`);
      }
    } else throw new Error(`Trường không hỗ trợ: ${k}`);
    out[k] = v;
  }
  return out;
}

// Snapshot riêng cho công trình bản đồ; không dùng diện tích mặt bằng làm diện tích đất.
export function buildingReportSource(building, context) {
  const b = JSON.parse(JSON.stringify(building));
  if (!context.preciseElevation && b._base?.snap) b._base.snap.ground = b.ground;
  const values = { project_name: b.name || b.id, project_location: context.location,
    document_place: context.province, building_type: b.typeName,
    building_footprint: b.area, building_height: b.h, floors: b.floors || b.estFloors || null,
    crs: 'WGS84 — quy đổi từ hệ mét cục bộ của bản đồ',
    coordinates: context.boundary.map((p) => p.join(', ')).join('; ') };
  return { ...context, building: b, values, capturedAt: new Date().toISOString() };
}

export function buildReportInput(st) {
  const manual = validateReportInputs(st.report?.inputs || {});
  const selected = manual.model_scope === 'map' ? st.report?.building : null;
  if (manual.model_scope === 'map' && !selected) throw new Error('Chọn công trình trên Bản đồ 3D và bấm Dùng cho Hồ sơ AI trước.');
  const pr = st.project, t = st.twin, p = currentPlan(st), m = p ? planMetrics(p) : null;
  const values = {}, sources = {};
  const put = (k, value, source, status = 'unverified') => {
    values[k] = value ?? null;
    sources[k] = { source, status: value == null || value === '' ? 'missing' : status, unit: REPORT_NUMBERS[k] || null };
  };
  for (const [k, field] of Object.entries({ project_name: 'name', investor: 'owner', project_location: 'location', project_group: 'group', building_type: 'category', decider: 'decider', capital_source: 'capital' })) put(k, pr[field], `project.${field}`);
  put('issue_date', new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), 'Ngày lập hồ sơ');
  put('document_place', pr.location?.split(',').at(-1)?.trim(), 'project.location');
  for (const k of [...Object.keys(REPORT_FIELDS), ...Object.keys(REPORT_NUMBERS)]) if (!(k in values)) put(k, null, 'Cần bổ sung');
  if (!selected) {
    put('site_area', polyArea(), 'engine.SITE.boundary', 'demo');
    put('crs', 'LOCAL_DEMO_METERS', 'engine.SITE', 'demo');
    put('coordinates', SITE.boundary.map(([x, y]) => `${x}, ${y}`).join('; '), 'engine.SITE.boundary (tọa độ cục bộ, m)', 'demo');
    const dem = demGrid();
    for (const [k, value] of Object.entries({ natural_elevation_min: dem.min, natural_elevation_max: dem.max, natural_elevation_mean: dem.mean })) put(k, value, 'engine.demGrid (địa hình tham chiếu)', 'demo');
    if (m) {
      for (const [k, value] of Object.entries({ building_footprint: m.bfoot, floor_area: m.gfa, road_area: m.road, green_area: m.green, floors: m.floorsMax, population: m.pop, units: m.units, building_height: Math.max(0, ...p.buildings.map((b) => b.floors * b.fh)) })) put(k, value, `Twin PA ${t.scenario} · revision ${t.designRevision || 0}`, 'demo');
    }
    // Không tự chạy phép tính chưa được người dùng ghi nhận trên Twin.
    if (t.earthwork && t.pad != null) {
      const ew = earthwork(t.pad, p?.lakes || []);
      put('cut_volume', ew.cut, 'Twin.earthwork L1', 'demo');
      put('fill_volume', ew.fill, 'Twin.earthwork L1', 'demo');
      put('design_elevation', t.pad, 'twin.pad', 'unverified');
    }
  } else {
    for (const k of Object.keys(values)) if (!['issue_date'].includes(k)) put(k, null, 'Chưa có dữ liệu cho công trình được chọn');
    for (const [k, v] of Object.entries(selected.demoInputs || {})) put(k, v, 'Kịch bản pháp lý giả lập Times Square — không có giá trị pháp lý', 'demo');
    for (const [k, v] of Object.entries(selected.values)) put(k, v, `Bản đồ ${selected.tenant} · ${selected.building.id} · ${selected.building.osm || 'phương án biên tập'} · ${selected.fetched || ''}`, 'unverified');
  }
  if (manual.model_scope === 'cad') {
    if (!st.cad?.doc?.struct || !st.cad?.b) throw new Error('Chưa có mô hình CAD. Mở CAD & Kết cấu trước khi chọn model_scope=cad.');
    const b = st.cad.b;
    const footprint = st.cad.doc.struct.slabs.reduce((sum, s) => sum + polyArea(s.pts) / 1e6, 0);
    for (const [k, value] of Object.entries({ building_footprint: footprint, floor_area: footprint * b.storeys, floors: b.storeys, building_height: levels(b).at(-1) })) put(k, value, `CAD/${st.cad.doc.seq} (1 công trình; không nhân số khối sa bàn)`, 'demo');
    // Không ghép dân số/số căn của toàn khu với quy mô một khung CAD.
    put('population', null, 'Chưa xác định cho công trình CAD');
    put('units', null, 'Chưa xác định cho công trình CAD');
  }
  for (const [k, v] of Object.entries(manual)) if (k !== 'unit_prices') put(k, v, 'report.inputs (người dùng bổ sung)', 'unverified');
  values.unit_prices = manual.unit_prices || {};
  sources.unit_prices = { source: 'report.inputs.unit_prices', status: Object.keys(values.unit_prices).length ? 'unverified' : 'missing' };
  if (values.total_investment == null) {
    const quantities = [values.cut_volume, values.fill_volume, values.cut_volume != null && values.fill_volume != null ? Math.max(0, values.fill_volume - values.cut_volume) : null, values.road_area, values.drain_length, values.water_pipe_length, values.floor_area, values.green_area];
    const costs = ['land_cost', 'equipment_cost', 'pm_rate', 'consult_rate', 'other_rate', 'quantity_reserve', 'price_reserve'];
    if (quantities.every((n) => n != null) && PRICE_CODES.every((k) => values.unit_prices[k] != null) && costs.every((k) => values[k] != null)) {
      const construction = PRICE_CODES.reduce((sum, k, i) => sum + quantities[i] * values.unit_prices[k].value, 0);
      const base = values.land_cost + values.equipment_cost + construction * (1 + values.pm_rate + values.consult_rate + values.other_rate);
      put('total_investment', base * (1 + values.quantity_reserve + values.price_reserve), 'Cùng công thức template04: Du_toan + Tong_muc (chưa VAT)', 'unverified');
    }
  }
  const warnings = ['Số liệu demo/L1 và thông tin chưa xác minh cần người có thẩm quyền kiểm tra; template không xác nhận hiệu lực pháp lý.'];
  if (selected) warnings.push('Hồ sơ riêng một công trình bản đồ. Mặt bằng không phải ranh đất; số tầng/chiều cao có thể suy luận. Chưa có tổng sàn, chủ đầu tư hay quy hoạch được duyệt. Xem modules.map.building để đối chiếu nguồn.');
  if (!selected && manual.site_area != null && m) warnings.push('Diện tích nhập bổ sung và mô hình Twin là hai nguồn riêng; cần đối chiếu phạm vi trước khi dùng chung khối lượng.');
  const missing = Object.fromEntries(Object.entries(REQUIRED).map(([type, keys]) => [type, keys.filter((k) => values[k] == null || values[k] === '')]));
  missing.estimate.push(...PRICE_CODES.filter((c) => values.unit_prices[c] == null).map((c) => `unit_prices.${c}`));
  const cad = st.cad?.doc?.struct && st.cad?.b ? { model: `CAD/${st.cad.doc.seq}`, building: st.cad.b, quantities: qto(st.cad.doc.struct, st.cad.b), supply: st.cad.supply } : null;
  return JSON.parse(JSON.stringify({
    schemaVersion: 'aipm.report-input/1.0', generatedAt: new Date().toISOString(), projectCode: selected?.building.id || pr.code,
    versions: { dataVersion: t.dataVersionId, modelVersion: t.modelVersionId, designRevision: t.designRevision || 0 },
    values, sources, missing, warnings,
    modules: { planning: !selected && p ? { name: p.name, buildings: p.buildings, metrics: m } : null, cad: selected ? null : cad, map: selected ? { tenant: selected.tenant, building: selected } : { tenant: st.map?.tenant, model: st.map?.model },
      twin: { datasets: selected ? [] : t.datasets, runs: selected ? [] : t.runs?.map(({ runId, scenarioId, level, status, result }) => ({ runId, scenarioId, level, status, result })) },
      workflow: { gates: st.gates, checklist: st.checklist } },
  }));
}

export function emptyReportInputs(st) {
  return { ...Object.fromEntries([...Object.keys(REPORT_FIELDS), ...Object.keys(REPORT_NUMBERS)].map((k) => [k, null])), ...st.report?.inputs, unit_prices: st.report?.inputs?.unit_prices || {} };
}
