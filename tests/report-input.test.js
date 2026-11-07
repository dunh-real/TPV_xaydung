import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportInput, buildingReportSource, validateReportInputs, PRICE_CODES } from '../src/lib/report-input.js';
import { currentPlan } from '../src/lib/plan.js';
import { planMetrics } from '../src/lib/engine.js';
import { defaultBuilding, frameTemplate } from '../src/lib/struct/design.js';

export const state = () => ({
  project: { name: 'Dự án kiểm thử', code: 'TEST-01', owner: 'Chủ đầu tư thử nghiệm', location: 'Hà Nội', category: 'Dân dụng', group: 'Nhóm B', capital: 'Vốn khác', decider: 'Chủ đầu tư' },
  params: { mdxd: 40, floorsMin: 3, floorsMax: 12, setback: 6, far: 2.6 },
  twin: { scenario: 'A', planEdits: {}, customBuildings: [], designRevision: 0, datasets: [], runs: [], pad: 20, earthwork: false },
  report: { inputs: {} }, map: { model: {} }, gates: {}, checklist: {},
});
test('Hồ sơ lấy mô hình Twin đã sửa, thêm và xóa công trình', () => {
  const st = state(), base = currentPlan(st);
  st.twin.planEdits[base.buildings[0].id] = { floors: 20, w: 11 };
  st.twin.planEdits[base.buildings[1].id] = { deleted: true };
  st.twin.customBuildings.push({ id: 'NEW', x: 0, y: 0, w: 10, d: 12, floors: 2, fh: 3.3, use: 'res' });
  const input = buildReportInput(st), m = planMetrics(currentPlan(st));
  assert.equal(input.values.floor_area, m.gfa);
  assert.equal(input.values.building_footprint, m.bfoot);
  assert.equal(input.values.floors, 20);
  assert.ok(input.values.floor_area !== planMetrics(base).gfa);
});

test('Không tự chạy đào đắp, gán công suất XLNT hay đơn giá', () => {
  const input = buildReportInput(state());
  assert.equal(input.values.cut_volume, null);
  assert.equal(input.values.ww_capacity, null);
  assert.deepEqual(input.values.unit_prices, {});
  assert.ok(input.missing.eia.includes('eia_baseline'));
  assert.ok(input.missing.estimate.includes('unit_prices.SN_DAO'));
});

test('Giá trị 0 hợp lệ; tổng mức dùng công thức và đơn giá của mẫu 04', () => {
  const st = state();
  st.report.inputs = { cut_volume: 10, fill_volume: 15, road_area: 20, drain_length: 30, water_pipe_length: 40, floor_area: 50, green_area: 60,
    land_cost: 100, equipment_cost: 200, pm_rate: 0.02, consult_rate: 0.03, other_rate: 0.01, quantity_reserve: 0.1, price_reserve: 0.05,
    technical_area: 0, unit_prices: Object.fromEntries(PRICE_CODES.map((k) => [k, { value: 2, source: 'Nguồn kiểm thử' }])) };
  const input = buildReportInput(st);
  assert.ok(Math.abs(input.values.total_investment - 905.74) < 1e-8);
  assert.ok(!input.missing.estimate.includes('technical_area'));
  assert.equal(input.sources.technical_area.source, 'report.inputs (người dùng bổ sung)');
});

test('Gói input là snapshot, không đổi khi module bị sửa tiếp', () => {
  const st = state(), input = buildReportInput(st);
  st.map.model.demo = { floors: 99 };
  st.twin.datasets.push({ name: 'new' });
  assert.deepEqual(input.modules.map.model, {});
  assert.deepEqual(input.modules.twin.datasets, []);
});

test('Chọn CAD lấy diện tích mm² đổi sang m² và đúng phạm vi một công trình', () => {
  const st = state();
  st.cad = { doc: { seq: 12, struct: frameTemplate() }, b: defaultBuilding() };
  st.report.inputs = { model_scope: 'cad', design_elevation: -1.5 };
  const packet = buildReportInput(st);
  assert.equal(packet.values.design_elevation, -1.5);
  assert.equal(packet.values.floors, 12);
  assert.equal(packet.values.floor_area, packet.values.building_footprint * 12);
  assert.equal(packet.values.population, null);
  assert.ok(packet.modules.cad.quantities.net.concrete > 0);
  assert.match(packet.sources.floor_area.source, /CAD\/12/);
});

test('Chặn input sai kiểu, tỷ lệ ngoài miền và đơn giá không có nguồn', () => {
  for (const raw of [{ site_area: '179.35' }, { site_area: -1 }, { pm_rate: 2 }, { wrong: 1 }, { model_scope: 'random' }, { unit_prices: { SN_DAO: { value: 1 } } }]) assert.throws(() => validateReportInputs(raw));
  assert.equal(validateReportInputs({ site_area: 179.35, contact: null }).site_area, 179.35);
  const st = state(); st.report.inputs = { model_scope: 'cad' }; assert.throws(() => buildReportInput(st), /Chưa có mô hình CAD/);
});


test('Công trình bản đồ giữ snapshot nguồn và không lấy số liệu của khu demo', () => {
  const st = state(); st.twin.earthwork = true;
  const b = { id: 'HCM-B-000138', name: 'Times Square', typeName: 'Thương mại', area: 3520, h: 164.9,
    floors: 40, ground: 13, osm: 'w165491082', _base: { snap: { ground: 13.12 } } };
  st.report = { inputs: { model_scope: 'map' }, building: buildingReportSource(b, {
    tenant: 'hcm', province: 'TP. Hồ Chí Minh', location: 'Phường Sài Gòn, TP. Hồ Chí Minh',
    boundary: [[106.7, 10.77], [106.71, 10.77]], fetched: '2026-11-05' }) };
  const packet = buildReportInput(st), v = packet.values;
  assert.equal(v.project_name, 'Times Square'); assert.equal(v.building_footprint, 3520);
  assert.equal(v.floors, 40); assert.equal(v.building_height, 164.9);
  for (const k of ['site_area', 'floor_area', 'investor', 'capital_source', 'cut_volume', 'fill_volume', 'population', 'natural_elevation_mean']) assert.equal(v[k], null, k);
  assert.equal(packet.modules.planning, null); assert.equal(packet.modules.cad, null);
  assert.equal(packet.modules.map.building.building._base.snap.ground, 13);
  assert.match(packet.sources.building_height.source, /w165491082/);
  b.name = 'Đã thay đổi'; assert.equal(packet.modules.map.building.building.name, 'Times Square');
  st.report.inputs.site_area = 4000; assert.equal(buildReportInput(st).values.site_area, 4000);
  delete st.report.building; assert.throws(() => buildReportInput(st), /Chọn công trình/);
});


test('Input hardcode Times Square khớp dữ liệu bản đồ và không có số liệu đất giả', () => {
  const building = JSON.parse(readFileSync(new URL('../src/data/report-building.json', import.meta.url), 'utf8'));
  const st = state(); st.report = { building, inputs: { model_scope: 'map' } };
  const packet = buildReportInput(st);
  assert.equal(packet.projectCode, 'HCM-B-000138');
  assert.equal(packet.values.project_name, 'Times Square');
  assert.equal(packet.values.building_height, 164.9); assert.equal(packet.values.floors, 40);
  assert.ok(Math.abs(packet.values.building_footprint - 3520.36) < 0.001);
  assert.equal(packet.values.site_area, null); assert.equal(packet.values.investor, 'Công ty Cổ phần Đầu tư Phát triển Minh Phú');
  assert.match(packet.values.legal_basis, /18\/QĐ-MP/); assert.ok(!packet.values.legal_basis.includes('DEMO')); assert.match(building.demoNote, /hư cấu/); assert.equal(packet.sources.legal_basis.status, 'demo');
  st.report.inputs.legal_basis = 'Căn cứ người dùng nhập';
  assert.equal(buildReportInput(st).values.legal_basis, 'Căn cứ người dùng nhập');
  assert.equal(packet.modules.map.building.building.osm, 'w165491082');
  assert.equal(building.boundary.length, 6);
});
