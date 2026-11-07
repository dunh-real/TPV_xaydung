// E2E kiểm thử theo use case trong 00_so_tay.md — chạy trên dist/index.html
const { chromium } = require('playwright-core');
const path = require('path');
const URL = 'file:///' + path.resolve(__dirname, '../dist/index.html').replace(/\\/g, '/');
const results = [];
const errors = [];
const t = async (id, name, fn) => {
  const t0 = Date.now();
  try { const note = await fn(); results.push({ id, name, ok: true, note: note || '', ms: Date.now() - t0 }); }
  catch (e) { results.push({ id, name, ok: false, note: String(e.message).slice(0, 300), ms: Date.now() - t0 }); }
};
const expect = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept('Vùng quản lý test'));
  await page.goto(URL + '#map');
  await page.waitForSelector('#mapx canvas');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mapx canvas');
  require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
  const shot = (n) => page.screenshot({ path: `${require('path').join(__dirname, 'shots')}/${n}.png` });

  await t('UC-00.1', 'Bản đồ toàn quốc 34 tỉnh + chọn tỉnh', async () => {
    const n = await page.$$eval('.map-label.prov', (e) => e.length);
    expect(n === 34, 'số nhãn tỉnh = ' + n);
    const isl = await page.$$eval('.map-label.isl', (e) => e.map((x) => x.textContent));
    expect(isl.some((x) => x.includes('Hoàng Sa')) && isl.some((x) => x.includes('Trường Sa')), 'thiếu Hoàng Sa/Trường Sa');
    await shot('01_toanquoc');
    await page.selectOption('#tenantSel', 'hcm');
    await page.waitForTimeout(1500);
    const crumb = await page.textContent('#crumb');
    expect(crumb.includes('TP. Hồ Chí Minh'), 'crumb: ' + crumb);
    return `34 tỉnh, đảo: ${isl.length}; crumb="${crumb.trim()}"`;
  });
  await t('UC-00.3', 'Dữ liệu trong khu vực + danh sách xã/phường', async () => {
    const txt = await page.textContent('#gp');
    expect(/Xã\/phường trong cảnh \(23\/168\)/.test(txt), 'không thấy 23/168');
    await shot('02_hcm');
    return 'OK 23/168 phường (ranh OSM thật)';
  });
  await t('UC-00.2', 'Tìm khu vực/công trình', async () => {
    await page.fill('#q', 'Bến Thành');
    await page.waitForSelector('.qres button');
    await page.dispatchEvent('.qres button', 'mousedown');
    await page.waitForTimeout(1300);
    return await page.textContent('#crumb');
  });
  await t('UC-00.5', 'Lớp: Ngày/Giờ vàng/Đêm, nguồn chiều cao, Mưa·triều·ngập', async () => {
    await page.click('[data-i="layers"]');
    await page.click('[data-mode="golden"]');
    await page.click('[data-mode="night"]');
    await page.waitForTimeout(400);
    await shot('03_dem');
    await page.click('[data-mode="day"]');
    await page.check('#hsrc');
    const leg = await page.textContent('#legend');
    expect(leg.includes('Số tầng × 3,3 m'), 'legend nguồn chiều cao');
    await page.check('#flood');
    await page.waitForTimeout(500);
    const tag = await page.textContent('#floodTag');
    expect(tag.includes('MOD-02 UR-01') && tag.includes('quan trắc'), 'nhãn nguồn ngập');
    await shot('04_ngap');
    await page.uncheck('#flood');
    await page.uncheck('#hsrc');
    return 'Có nhãn nguồn & giới hạn';
  });
  await t('UC-00.6', 'Phân tích tại tâm 1 km² + biểu đồ hình thái + xuất CSV', async () => {
    await page.click('[data-g="analysis"]');
    await page.click('[data-a="center"]');
    await page.waitForTimeout(400);
    const p = await page.textContent('#gp');
    expect(p.includes('Số ID công trình') && p.includes('Trung vị chiều cao'), 'thiếu chỉ số');
    await page.click('[data-at="morph"]');
    await page.click('[data-bin="1"]');
    await page.click('[data-at="list"]');
    const rows = await page.$$eval('#gp [data-bld]', (e) => e.length);
    expect(rows > 0, 'danh sách lọc theo cột rỗng');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="export"]')]);
    await shot('05_phantich');
    return `${rows} dòng; tải ${dl.suggestedFilename()}`;
  });
  await t('UC-00.6b', 'Vẽ vùng (đa giác) ra bộ chỉ số', async () => {
    await page.click('[data-a="draw"]');
    const box = await page.locator('#mv canvas').boundingBox();
    for (const [dx, dy] of [[-120, -80], [120, -80], [140, 90], [-110, 100]]) await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await page.click('#dpOk');
    await page.waitForTimeout(300);
    const p = await page.textContent('#gp');
    expect(p.includes('Diện tích vùng'), 'không có kết quả đa giác');
    return 'OK';
  });
  await t('UC-00.4', 'Nhấp công trình → Thông tin công trình có provenance', async () => {
    await page.click('[data-at="list"]');
    await page.click('#gp [data-bld]');
    await page.waitForTimeout(1200);
    const ip = await page.textContent('#ip');
    for (const k of ['Phương pháp xác định chiều cao', 'Dải prior', 'Cao độ nền', 'không phải DTM', 'Nguồn mặt bằng', 'Bản ghi gốc', 'Giấy phép', 'Thời điểm mô hình', 'Phần mẫu đủ điều kiện', 'Độ phân tán mẫu', 'Diện mạo & vật liệu']) expect(ip.includes(k), 'thiếu trường ' + k);
    await shot('06_congtrinh');
    return 'Đủ 11 trường provenance';
  });
  await t('UC-00.7', 'Registry nguồn + tài liệu quy hoạch đủ trường', async () => {
    await page.click('[data-i="sources"]');
    const n = await page.$$eval('#ip details.src', (e) => e.length);
    await page.click('#ip details.src summary');
    const ip = await page.textContent('#ip');
    for (const k of ['Nhà cung cấp', 'Độ phủ', 'Lấy mẫu nguồn', 'Lấy mẫu hiển thị', 'Ngày quan sát', 'Phiên/tải', 'Giấy phép', 'Tái phân phối', 'Ghi công', 'Điều kiện xác minh']) expect(ip.includes(k), 'thiếu ' + k);
    await page.click('[data-i="docs"]');
    const d = await page.textContent('#ip');
    for (const k of ['Số / ngày', 'Hình học', 'Chữ ký', 'Quyền sử dụng', 'Kỳ hiệu lực']) expect(d.includes(k), 'thiếu ' + k);
    return `${n} nguồn`;
  });
  await t('UC-00.14', 'Click cầu BR-01 → Mở dự án/kịch bản sang Digital Twin', async () => {
    await page.goto(URL + '#map?focus=hcm&view=province&sel=BR-01');
    await page.waitForTimeout(3500); // khởi tạo cảnh OSM + bay tới cầu (SwiftShader chậm hơn GPU thật)
    const ip = await page.textContent('#ip');
    expect(ip.includes('Cầu BR-01'), 'không chọn được cầu');
    await shot('07_br01');
    await page.click('[data-act="openBR"]');
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => location.hash);
    const box = await page.textContent('#stepbox');
    expect(h.startsWith('#twin') && box.includes('BR-01'), 'không mở BR-01: ' + h);
    await page.click('#runScenarioV2');
    await page.waitForTimeout(1500);
    await shot('08_twin_br01');
    return h;
  });
  await t('UC-02.UR', 'UR-01 trong thư viện (19) và chạy trên bản đồ', async () => {
    await page.goto(URL + '#twin?mode=simulation&scenario=UR-01');
    await page.waitForTimeout(1200);
    const box = await page.textContent('#stepbox');
    expect(box.includes('UR-01') && box.includes('19 L1 MODELS'), 'UR-01 thiếu');
    await page.click('#runScenarioV2');
    await page.waitForTimeout(1200);
    await page.goto(URL + '#map?focus=hcm&view=province');
    await page.waitForTimeout(1200);
    await page.click('[data-g="ops"]');
    await page.click('[data-ot="scenario"]');
    await page.click('[data-a="ur01"]');
    await page.waitForTimeout(600);
    const g = await page.textContent('#gp');
    expect(g.includes('Công trình bị ảnh hưởng'), 'không có kết quả UR-01');
    await shot('09_ur01');
    return 'OK';
  });
  await t('UC-00.9', 'Điều hành 5 tab, KPI "Chưa có", phương án khoanh ≤10 ha, công việc gắn vị trí → BPMN', async () => {
    await page.click('[data-ot="region"]');
    let g = await page.textContent('#gp');
    expect((g.match(/Chưa có/g) || []).length >= 3, 'KPI Chưa có');
    await page.click('[data-ot="svc"]');
    await page.click('[data-a="ab"]');
    g = await page.textContent('#gp');
    expect(g.includes('Công trình trong 800 m'), 'A/B');
    await page.click('[data-ot="scenario"]');
    await page.click('[data-a="sketch"]');
    const box = await page.locator('#mv canvas').boundingBox();
    for (const [dx, dy] of [[-20, -15], [20, -15], [20, 15], [-20, 15]]) await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await page.click('#dpOk');
    await page.waitForTimeout(300);
    await page.click('[data-ot="img"]');
    g = await page.textContent('#gp');
    expect(g.includes('UAV chỉ phủ cục bộ'), 'tab Ảnh');
    await page.click('[data-ot="report"]');
    await page.selectOption('#tkGate', 'G1');
    await page.click('[data-a="mkTask"]');
    g = await page.textContent('#gp');
    expect(g.includes('CV-001') && g.includes('cục bộ thiết bị'), 'công việc cục bộ');
    const wf = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).workflow.filter((w) => /^HS-3/.test(w.id)).length);
    expect(wf === 1, 'không đẩy sang BPMN');
    const sk = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).map.sketches.length);
    return `sketch=${sk}, BPMN+1`;
  });
  await t('UC-00.8', 'Vùng quản lý: tô màu, tạo vùng, xuất GeoJSON', async () => {
    await page.click('[data-g="region"]');
    await page.selectOption('#rcol', 'type');
    await page.click('[data-rt="mgmt"]');
    await page.click('[data-a="newRegion"]');
    const box = await page.locator('#mv canvas').boundingBox();
    for (const [dx, dy] of [[-90, -60], [90, -60], [90, 60]]) await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await page.click('#dpOk');
    await page.waitForTimeout(300);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="exportRegions"]')]);
    return dl.suggestedFilename();
  });
  await t('UC-00.10', 'Tương lai: dự án hạ tầng, 7 tab, cảnh báo đã qua mốc', async () => {
    await page.click('[data-g="future"]');
    await page.click('[data-fut="TL-RD1"]');
    await page.click('[data-ft="prog"]');
    const g = await page.textContent('#gp');
    expect(g.includes('không đồng nghĩa hoàn thành'), 'thiếu cảnh báo mốc');
    return 'OK';
  });
  await t('UC-00.13', 'Đăng nhập theo địa bàn, lớp độ cao chi tiết + nhật ký', async () => {
    await page.click('#login');
    await page.selectOption('#lr', 'tinh');
    await page.click('.modal-foot .btn.pri');
    await page.click('[data-i="layers"]');
    const dis = await page.$eval('#elev', (e) => e.disabled);
    expect(!dis, 'quản trị tỉnh vẫn bị khóa');
    await page.check('#elev');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).map.accessLog.length);
    expect(log > 0, 'không có nhật ký');
    await page.uncheck('#elev');
    return `nhật ký ${log} bản ghi`;
  });
  await t('UC-00.11', 'Dashboard đa cấp: tổng quan, quy hoạch, Dự án & Stage-Gate, drill-down, chứng cứ, xuất', async () => {
    await page.click('#dashBtn');
    await page.waitForSelector('#dash:not([hidden])');
    let d = await page.textContent('#dash');
    expect(d.includes('Bức tranh TP. Hồ Chí Minh') && d.includes('Chưa có'), 'dashboard tỉnh');
    await shot('10_dash_tongquan');
    await page.click('[data-p="plan"]');
    d = await page.textContent('#dash');
    expect(d.includes('HEAD 200'), 'trang quy hoạch');
    await page.click('[data-p="projects"]');
    await page.click('[data-m="reconcile"]');
    await page.click('#ev');
    await page.click('.modal-foot .btn');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ex')]);
    await page.selectOption('#dl', '');
    await page.waitForTimeout(800);
    d = await page.textContent('#dash');
    expect(d.includes('toàn quốc') && d.includes('Drill-down'), 'cấp quốc gia');
    await shot('11_dash_quocgia');
    await page.click('#cl');
    return dl.suggestedFilename();
  });
  await t('UC-00.12', 'Deep-link có phiên bản tái lập cảnh', async () => {
    await page.goto(URL + '#map?v=VN-2026.11-r2&focus=dong-nai&view=province&mode=night&sel=DA-2026-017');
    await page.waitForTimeout(1800);
    const crumb = await page.textContent('#crumb');
    const ip = await page.textContent('#ip');
    expect(crumb.includes('Đồng Nai') && ip.includes('Khu dân cư'), 'không tái lập: ' + crumb);
    await shot('12_deeplink_dongnai_dem');
    await page.click('#link');
    const v = await page.inputValue('.modal-body textarea');
    expect(v.includes('v=VN-2026.11-r2') && v.includes('focus=dong-nai'), 'link thiếu v/focus');
    await page.click('.modal-foot .btn');
    return v.split('#')[1];
  });
  await t('UC-00.T', 'Tham quan tự động + Dừng', async () => {
    await page.click('[data-g="tour"]');
    await page.click('[data-tour="tour"]');
    await page.waitForTimeout(1200);
    await page.click('[data-stop]');
    return 'OK';
  });
  await t('UC-05.1', 'Demo 3: kiểm toán tờ trình mẫu → 2 lỗi + cảnh báo QCVN 2026 → sửa 1 nút', async () => {
    await page.goto(URL + '#legal');
    await page.waitForTimeout(500);
    await page.click('#audit');
    await page.waitForTimeout(1200);
    let r = await page.textContent('#res3');
    expect(r.includes('2 lỗi'), 'không đúng 2 lỗi: ' + r.slice(0, 120));
    expect(r.includes('206/2026') && r.includes('QCVN 01:2026'), 'thiếu văn bản thay thế');
    const marks = await page.$$eval('#paper3 mark.lg-exp', (e) => e.length);
    expect(marks === 2, 'số vị trí tô đỏ = ' + marks);
    await shot('13_demo3_loi');
    await page.click('#fix3');
    await page.waitForTimeout(400);
    r = await page.textContent('#res3');
    expect(r.includes('0 lỗi'), 'sau sửa vẫn lỗi');
    await shot('14_demo3_sua');
    return `${marks} vị trí đỏ → 0 lỗi`;
  });
  await t('UC-04.1', 'Demo 2: AI khởi tạo bộ hồ sơ + Excel dự toán', async () => {
    // chuẩn bị Digital Twin: dataset mẫu + phương án
    await page.goto(URL + '#twin?mode=data');
    await page.waitForTimeout(600);
    await page.click('#sample');
    await page.waitForTimeout(400);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('aipm-dt-demo-v3')); s.twin.scenario = s.twin.scenario || 'A'; localStorage.setItem('aipm-dt-demo-v3', JSON.stringify(s)); });
    await page.goto(URL + '#docs');
    await page.reload();
    await page.waitForTimeout(500);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bundle')]);
    await page.waitForTimeout(800);
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).docs.length);
    const p = await dl.path();
    const xml = require('fs').readFileSync(p, 'utf8');
    const sheets = (xml.match(/<Worksheet /g) || []).length, formulas = (xml.match(/ss:Formula=/g) || []).length;
    expect(n >= 3 && sheets === 6 && formulas > 20, `docs=${n} sheets=${sheets} f=${formulas}`);
    await shot('15_hoso');
    return `${n} hồ sơ, ${sheets} sheet, ${formulas} công thức`;
  });
  await t('UC-06.1', 'Demo 4: xác nhận hợp lệ → checklist, BPMN, cổng', async () => {
    const before = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).checklist).filter((c) => c.done).length);
    await page.click('[data-id]');
    await page.waitForTimeout(300);
    await page.click('#valid');
    await page.waitForTimeout(500);
    const m = await page.textContent('.modal-body');
    await page.click('.modal-foot .btn.ok');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('aipm-dt-demo-v3')); return { cl: Object.values(s.checklist).filter((c) => c.done).length, gates: Object.keys(s.gates), wf: s.workflow.filter((w) => w.log.some((l) => /hồ sơ hợp lệ/.test(l))).length }; });
    expect(after.cl > before, 'checklist không đổi');
    await shot('16_lienthong');
    return `checklist ${before}→${after.cl}; cổng qua: ${after.gates.join(',') || '—'}; BPMN chuyển: ${after.wf}; ${m.replace(/\s+/g, ' ').slice(0, 120)}`;
  });
  await t('UC-06.2', 'Timeline: kịch bản cung ứng vật liệu → tác động đường găng → duyệt', async () => {
    await page.goto(URL + '#timeline');
    await page.waitForTimeout(500);
    const s = await page.textContent('#supply');
    expect(s.includes('Tác động G12') && s.includes('Hạng mục chịu tác động'), 'panel cung ứng');
    await page.click('#supOk');
    await page.waitForTimeout(300);
    const a = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).project.approvedSupply);
    expect(a && a.days > 0, 'không duyệt');
    await shot('17_timeline_vattu');
    return `G12 +${a.days} ngày`;
  });
  await t('UC-06.3', 'BPMN: làn 2 cấp, vị trí, bảng ánh xạ tenant', async () => {
    await page.goto(URL + '#bpmn');
    await page.waitForTimeout(400);
    const b = await page.textContent('#view');
    expect(b.includes('Sở Nông nghiệp và Môi trường') && b.includes('UBND cấp tỉnh / cấp xã') && b.includes('NĐ 217/2026'), 'thiếu ánh xạ');
    const chips = await page.$$eval('.loc-chip', (e) => e.length);
    expect(chips > 0, 'không có vị trí');
    await page.selectOption('#agTen', 'hcm');
    await shot('18_bpmn');
    return `${chips} chip vị trí`;
  });
  await t('REG', 'Hồi quy: các tab cũ vẫn hiển thị', async () => {
    for (const h of ['hero', 'stage-gate', 'lookup', 'checklist', 'twin', 'docs', 'timeline']) {
      await page.goto(URL + '#' + h);
      await page.waitForTimeout(350);
      const len = (await page.textContent('#view')).length;
      expect(len > 200, h + ' rỗng');
    }
    await shot('19_overview');
    return '7 tab OK';
  });
  // đợt 2 (06/11/2026): nền GIS, quy hoạch, biên tập mô hình, phương án · tham số kịch bản kiểm thử mô hình
  await require('./e2e_gis_cases.cjs')({ page, t, expect, shot });
  await require('./e2e_twin_cases.cjs')({ page, t, expect, shot });
  // đợt 3 (06/11/2026): CAD 2D → 3D → kết cấu → vật liệu → kịch bản cực đoan
  await require('./e2e_cad_cases.cjs')({ page, t, expect, shot });
  await browser.close();
  console.log(JSON.stringify({ results, errors: [...new Set(errors)].slice(0, 30) }, null, 1));
})();
