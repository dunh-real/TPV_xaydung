// Chạy khi Vite đang mở: node tests/report-smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildReportInput, PRICE_CODES } from '../src/lib/report-input.js';

const base = process.env.REPORT_TEST_URL || 'http://127.0.0.1:5178';
const out = process.env.REPORT_TEST_OUTPUT || '/tmp/aipm-template-qa';
const st = {
  project: { name: 'Dự án kiểm thử template', code: 'QA-01', owner: 'Đơn vị kiểm thử', location: 'Hà Nội', group: 'Nhóm B', category: 'Dân dụng', capital: 'Vốn khác', decider: 'Chủ đầu tư' },
  params: { mdxd: 40, floorsMin: 3, floorsMax: 12, setback: 6, far: 2.6 },
  twin: { scenario: 'A', planEdits: {}, customBuildings: [], datasets: [], runs: [], pad: 20, earthwork: true },
  report: { inputs: {} }, map: { model: {} }, gates: {}, checklist: {},
};
const input = buildReportInput(st);
async function post(path, payload) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res;
}
await fs.mkdir(out, { recursive: true });
for (const type of ['proposal', 'feasibility', 'eia']) {
  const r = await (await post('/api/reports/generate', { type, input, useAI: false })).json();
  assert.ok(r.html.includes('Dự án kiểm thử template'));
  assert.equal(r.model, null);
  assert.ok(!r.html.includes('{{'));
  const res = await post('/api/reports/export', { type, input, sections: r.sections });
  const data = Buffer.from(await res.arrayBuffer());
  assert.equal(data.subarray(0, 2).toString(), 'PK');
  await fs.writeFile(`${out}/${type}.docx`, data);
}
const xlsx = await post('/api/reports/export', { type: 'estimate', input });
await fs.writeFile(`${out}/estimate.xlsx`, Buffer.from(await xlsx.arrayBuffer()));
st.report.inputs = { site_area: 1000, building_footprint: 100, floor_area: 50, road_area: 20, green_area: 60, technical_area: 820,
  cut_volume: 10, fill_volume: 15, drain_length: 30, water_pipe_length: 40, duration_months: 12, ww_capacity: 5, expected_jobs: 10,
  land_cost: 100, equipment_cost: 200, pm_rate: 0.02, consult_rate: 0.03, other_rate: 0.01, quantity_reserve: 0.1, price_reserve: 0.05, rain_intensity: 90, runoff_coeff: 0.5, crs: 'LOCAL_DEMO_METERS',
  unit_prices: Object.fromEntries(PRICE_CODES.map((k) => [k, { value: 2, source: 'Dữ liệu kiểm thử, không dùng lập dự toán' }])) };
const complete = buildReportInput(st);
assert.ok(Math.abs(complete.values.total_investment - 905.74) < 1e-8);
const full = await post('/api/reports/export', { type: 'estimate', input: complete });
await fs.writeFile(`${out}/estimate-complete.xlsx`, Buffer.from(await full.arrayBuffer()));
const config = await (await fetch(base + '/api/llm/config')).json();
assert.equal(config.enableThinking, false);
assert.equal(config.model, 'Qwen/Qwen3.6-35B-A3B-FP8');
if (process.env.TEST_LLM === '1' || process.argv.includes('--llm')) {
  const chat = await (await post('/api/llm/chat', { prompt: 'Chỉ trả lời: Kết nối thành công', maxTokens: 32 })).json();
  assert.ok(chat.text.length);
  console.log('Qwen chat:', chat.text);
  const generated = await (await post('/api/reports/generate', { type: 'eia', input, useAI: true })).json();
  assert.equal(generated.model, config.model);
  assert.ok(!generated.html.includes('{{'));
  const aiDoc = await post('/api/reports/export', { type: 'eia', input, sections: generated.sections });
  await fs.writeFile(`${out}/eia-qwen.docx`, Buffer.from(await aiDoc.arrayBuffer()));
  console.log('Qwen tạo ĐTM:', Object.keys(generated.sections).join(', '));
}
console.log('API: 3 preview Word, 3 DOCX, 2 XLSX và cấu hình Qwen đạt.');
