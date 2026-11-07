// E2E — MOD-03 Phòng thử mô hình L1: tham số mới + ngưỡng, quét 1/2 tham số,
// độ nhạy tornado, Monte Carlo, bộ ca kiểm thử, liên kết mô hình từ Bản đồ 3D.
// Được gọi từ suite chính: require('./e2e_twin_cases.cjs')({ page, t, expect, shot })
const KEY = 'aipm-dt-demo-v3';

module.exports = async ({ page, t, expect, shot }) => {
  const base = () => page.url().split('#')[0];
  const open = async (id) => {
    await page.goto(base() + '#hero'); // đổi hash để router render lại bước 3
    await page.goto(base() + '#twin?mode=simulation&scenario=' + id);
    await page.waitForSelector('#quickStatus');
    await page.waitForSelector('#lab .lab-panel');
  };
  const setInput = (key, v) => page.evaluate(([k, val]) => { const i = document.querySelector(`input[data-si="${k}"]`); i.value = val; i.dispatchEvent(new Event('change', { bubbles: true })); }, [key, v]);
  const setLab = (sel, v) => page.evaluate(([s, val]) => { const i = document.querySelector(s); i.value = val; i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
  const tab = async (k) => { await page.click(`[data-lab="${k}"]`); };
  const resetInputs = (id) => page.evaluate(([k, sid]) => { const s = JSON.parse(localStorage.getItem(k)); if (s?.twin?.scenarioInputs) delete s.twin.scenarioInputs[sid]; if (s?.map) delete s.map.model; localStorage.setItem(k, JSON.stringify(s)); }, [KEY, id]);

  await t('UC-02.P1', 'Tham số mới (nhịp, bề rộng, tĩnh không, xung kích, ngưỡng) hiển thị và làm đổi kết quả', async () => {
    await open('BR-01');
    await resetInputs('BR-01');
    await open('BR-01');
    for (const k of ['spans', 'deckWidth', 'clearance', 'impactFactor', 'allowableLoad', 'requiredClearance', 'minLaneWidth']) expect(await page.$(`input[data-si="${k}"]`), 'thiếu tham số ' + k);
    const limits = await page.$$eval('label.f.lim input[data-si]', (a) => a.length);
    expect(limits === 3, 'BR-01 phải có 3 ngưỡng, có ' + limits);
    const before = await page.textContent('#quickStatus');
    await setInput('spans', 1);
    await page.waitForFunction((b) => document.querySelector('#quickStatus').textContent !== b, before);
    const after = await page.textContent('#quickStatus');
    expect(/500/.test(after), 'tải mỗi nhịp phải tăng lên 500 kN khi 1 nhịp: ' + after);
    await setInput('spans', 3);
    await page.click('#runScenarioV2');
    await page.waitForSelector('.screening-metric i', { timeout: 8000 });
    const txt = await page.textContent('#stepbox');
    expect(/ngưỡng ≤ 300/.test(txt), 'kết quả run không hiện ngưỡng');
    return '7 tham số mới; 1 nhịp → 500 kN/nhịp; run hiện ngưỡng';
  });

  await t('UC-02.P2', 'Ngưỡng do kỹ sư nhập làm đổi PASS ↔ FAIL', async () => {
    await open('BR-01');
    const s0 = await page.getAttribute('#quickStatus', 'data-status');
    await setInput('allowableLoad', 100);
    await page.waitForFunction(() => document.querySelector('#quickStatus')?.dataset.status === 'FAIL');
    await setInput('allowableLoad', 300);
    await page.waitForFunction(() => document.querySelector('#quickStatus')?.dataset.status === 'PASS');
    await setInput('requiredClearance', 13);
    await page.waitForFunction(() => document.querySelector('#quickStatus')?.dataset.status === 'FAIL');
    await setInput('requiredClearance', 10);
    return `${s0} → FAIL (tải cho phép 100) → PASS → FAIL (tĩnh không yêu cầu 13 m)`;
  });

  await t('UC-02.P3', 'Quét 1 tham số: biểu đồ, đường ngưỡng, điểm chuyển trạng thái', async () => {
    await open('BR-01');
    await tab('s1');
    await setLab('#s1Key', 'vehicles');
    await setLab('#s1Min', 100); await setLab('#s1Max', 2000); await setLab('#s1Steps', 30);
    const mi = await page.$eval('#s1Metric', (s) => [...s.options].find((o) => o.textContent.startsWith('Tải có xung kích')).value);
    await setLab('#s1Metric', mi);
    await page.click('#s1Run');
    await page.waitForSelector('#s1Chart');
    const dots = await page.$$eval('#s1Chart circle', (a) => a.length);
    const lim = await page.$('#s1Chart .limit-line');
    const n = +(await page.getAttribute('#s1Trans', 'data-n'));
    expect(dots === 30 && lim && n >= 2, `điểm=${dots}, ngưỡng=${!!lim}, chuyển=${n}`);
    await shot('20_twin_sweep1');
    return `30 điểm, ${n} điểm chuyển: ` + (await page.textContent('#s1Trans')).replace(/\s+/g, ' ').slice(0, 120);
  });

  await t('UC-02.P4', 'Quét 2 tham số → ma trận nhiệt PASS/WARN/FAIL', async () => {
    await tab('s2');
    await setLab('#s2X', 'vehicles'); await setLab('#s2Y', 'axleLoad'); await setLab('#s2Steps', 11);
    await page.click('#s2Run');
    await page.waitForSelector('#s2Heat');
    const cells = await page.$$eval('#s2Heat td', (a) => a.length);
    const pass = await page.$$eval('#s2Heat td.h-pass', (a) => a.length), fail = await page.$$eval('#s2Heat td.h-fail', (a) => a.length);
    expect(cells === 121 && pass > 0 && fail > 0, `ô=${cells}, PASS=${pass}, FAIL=${fail}`);
    await shot('21_twin_heatmap');
    return `121 ô · PASS ${pass} · FAIL ${fail}`;
  });

  await t('UC-02.P5', 'Độ nhạy tornado ±20%, sắp xếp theo ảnh hưởng', async () => {
    await tab('tor');
    await page.click('#torRun');
    await page.waitForSelector('#torChart');
    const swings = await page.$$eval('.tor-table tr td:last-child', (a) => a.map((x) => parseFloat(x.textContent.replace(/\./g, '').replace(',', '.'))));
    expect(swings.length === 11, 'BR-01 có 11 tham số tải/hình học, có ' + swings.length);
    expect(swings.every((v, i) => i === 0 || v <= swings[i - 1] + 1e-9), 'chưa sắp xếp giảm dần: ' + swings.join(','));
    return `11 tham số; ảnh hưởng lớn nhất = ${swings[0]}`;
  });

  await t('UC-02.P6', 'Monte Carlo UR-01: xác suất FAIL + histogram; lưu vào lịch sử run', async () => {
    await open('UR-01');
    await tab('mc');
    await setLab('#mcN', 800);
    await page.click('#mcRun');
    await page.waitForSelector('#mcHist');
    const p = +(await page.getAttribute('#mcPfail', 'data-p'));
    const bars = await page.$$eval('#mcHist rect', (a) => a.length);
    expect(p > 0 && p <= 1 && bars === 20, `pFail=${p}, cột=${bars}`);
    await page.click('#labSave');
    const m = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).twin.runs[0].result.method, KEY);
    expect(m === 'L1_PARAM_STUDY/1.0', 'run chưa lưu: ' + m);
    await shot('22_twin_montecarlo');
    return `P(FAIL)=${(p * 100).toFixed(1)}%, 20 cột, đã lưu run`;
  });

  await t('UC-02.P7', 'Bộ ca kiểm thử: 4 ca định sẵn + ca tự định nghĩa; chạy toàn bộ 19 kịch bản', async () => {
    await open('BR-01');
    await tab('cases');
    await page.click('#casesRun');
    await page.waitForSelector('#casesSum');
    const n0 = +(await page.getAttribute('#casesSum', 'data-n'));
    await page.fill('#caseName', 'Ca E2E tự định nghĩa');
    await page.click('#caseAdd');
    await page.click('#casesRun');
    await page.waitForFunction((n) => +document.querySelector('#casesSum')?.dataset.n === n + 1, n0);
    await page.click('#casesAll');
    await page.waitForSelector('#casesAllSum');
    const scen = +(await page.getAttribute('#casesAllSum', 'data-scen')), tot = +(await page.getAttribute('#casesAllSum', 'data-n'));
    expect(n0 === 4 && scen === 19 && tot === 19 * 4 + 1, `ca BR-01=${n0}, kịch bản=${scen}, tổng ca=${tot}`);
    await shot('23_twin_cases');
    // dọn ca tự định nghĩa để lần chạy sau tái lập
    await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.twin.modelCases = {}; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    return `BR-01: 4 → 5 ca; toàn bộ: 19 kịch bản × ${tot} ca`;
  });

  await t('UC-02.P8', 'Tham số BR-01 lấy từ mô hình đã chỉnh trên Bản đồ 3D', async () => {
    await open('BR-01');
    await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.map = s.map || {}; s.map.model = { hcm: { variantName: 'PA-E2E', bridge: { length: 420, spans: 5, width: 24, clearance: 14, lanes: 4 } } }; delete s.twin.scenarioInputs['BR-01']; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await page.reload();
    await page.waitForSelector('#mapNote');
    const note = await page.textContent('#mapNote'), len = await page.inputValue('input[data-si="bridgeLength"]'), sp = await page.inputValue('input[data-si="spans"]');
    expect(note.includes('PA-E2E') && len === '420' && sp === '5', `note=${note.slice(0, 60)} len=${len} spans=${sp}`);
    await resetInputs('BR-01');
    return 'Chiều dài 420 m, 5 nhịp từ phương án PA-E2E';
  });
};
