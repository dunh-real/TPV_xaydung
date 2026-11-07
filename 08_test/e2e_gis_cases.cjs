// E2E đợt 2 — nền GIS, ô quy hoạch, biên tập mô hình, phương án (UC-00.15 … UC-00.19, UC-02.UR2)
// Gọi từ e2e_demo.cjs: await require('./e2e_gis_cases.cjs')({ page, t, expect, shot });
module.exports = async ({ page, t, expect, shot }) => {
  const base = page.url().split('#')[0];
  const go = async (hash, wait = 2500) => { await page.goto(base + '#hero'); await page.goto(base + '#' + hash); await page.waitForSelector('#mapx canvas'); await page.waitForTimeout(wait); };
  const imgReady = () => page.waitForFunction(() => /LOD1 ·|ngoại tuyến/.test(document.querySelector('#status')?.textContent || ''), null, { timeout: 90000 });
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).map);
  const grp = async (g) => { const on = await page.$eval(`[data-g="${g}"]`, (e) => e.classList.contains('on')); if (!on) await page.click(`[data-g="${g}"]`); await page.waitForTimeout(200); };
  const closeModal = async () => { const b = await page.$('.modal-wrap .modal-foot .btn:last-child'); if (b) await b.click(); };

  await t('UC-00.15', 'Nền GIS: ảnh vệ tinh Esri + công trình OSM + đổi nền / ngoại tuyến', async () => {
    await go('map?focus=hcm&view=province', 1000);
    await imgReady();
    const s0 = await page.textContent('#status');
    const attr = await page.textContent('.map-attr');
    expect(attr.includes('OpenStreetMap'), 'thiếu ghi công OSM');
    const online = s0.includes('Ảnh vệ tinh');
    if (online) expect(attr.includes('Esri'), 'thiếu ghi công Esri');
    await shot('20_ve_tinh_hcm');
    await page.click('[data-i="layers"]');
    expect((await page.$$('#ip [data-bm]')).length === 5, 'thiếu 5 lựa chọn nền');
    await page.click('#ip [data-bm="street"]');
    await page.waitForFunction(() => /Bản đồ đường phố|ngoại tuyến/.test(document.querySelector('#status').textContent), null, { timeout: 60000 });
    await page.click('#ip [data-bm="offline"]');
    await page.waitForFunction(() => /ngoại tuyến/i.test(document.querySelector('#status').textContent), null, { timeout: 20000 });
    await shot('21_nen_ngoai_tuyen');
    await page.click('#ip [data-bm="sat"]');
    await imgReady();
    // công trình OSM có bản ghi gốc
    await go('map?focus=hcm&view=province&sel=HCM-B-000200', 2500);
    const ip = await page.textContent('#ip');
    expect(ip.includes('osm:') && ip.includes('ODbL') && ip.includes('OpenStreetMap'), 'thiếu provenance OSM');
    return `${online ? 'trực tuyến: ' + s0.trim() : 'không có mạng → nền ngoại tuyến'} · 5 nền · đổi nền OK · công trình có osm:id`;
  });

  await t('UC-00.16', 'Ô quy hoạch: bật lớp, chọn ô vượt chỉ tiêu, xem chỉ tiêu tối đa/hiện tại', async () => {
    await grp('plan');
    await page.check('#gp input[data-l="zoning"]');
    await page.waitForTimeout(500);
    const kp = await page.textContent('#gp');
    const m = kp.match(/Vượt chỉ tiêu\s*(\d+)/);
    expect(m && +m[1] > 0 && +m[1] < 120, 'số ô vượt bất thường: ' + (m && m[1]));
    await page.click('#gp [data-zone]');
    await page.waitForTimeout(1300);
    const ip = await page.textContent('#ip');
    expect(ip.includes('Ô quy hoạch') && ip.includes('Mật độ xây dựng gộp') && ip.includes('Hệ số sử dụng đất') && ip.includes('Vượt'), 'chi tiết ô thiếu');
    expect((await page.textContent('#legend')).includes('Vượt chỉ tiêu'), 'chú giải thiếu');
    await shot('22_o_quy_hoach');
    return `${m[1]} lô vượt · chi tiết ô có tối đa/hiện tại/kết luận`;
  });

  await t('UC-00.17', 'Biên tập công trình: đổi tầng, di chuyển, hoàn tác/làm lại, xóa, thêm khối mới', async () => {
    await go('map?focus=hcm&view=province&sel=HCM-B-000200', 2500);
    await grp('edit');
    await page.waitForSelector('#eFloors');
    await page.fill('#eFloors', '40');
    await page.click('#eApply');
    await page.waitForTimeout(500);
    let ip = await page.textContent('#ip');
    expect(ip.includes('Phương án biên tập') && ip.includes('132'), 'tầng cao chưa áp dụng (40 × 3,3 = 132 m)');
    await page.click('[data-mv="5,0"]');
    await page.click('[data-rot="15"]');
    let w = (await st()).work.hcm;
    expect(w.data.edits['199'] && w.data.edits['199'].dx === 5 && w.data.edits['199'].rot === 15, 'chưa lưu di chuyển/xoay');
    await page.click('#eUndo'); await page.click('#eUndo');
    w = (await st()).work.hcm;
    expect(!w.data.edits['199'].dx && !w.data.edits['199'].rot && w.data.edits['199'].floors === 40, 'hoàn tác sai');
    await page.click('#eRedo');
    expect((await st()).work.hcm.data.edits['199'].dx === 5, 'làm lại sai');
    await shot('23_bien_tap_cong_trinh');
    // thêm khối: bấm "Đặt khối" rồi nhấp giữa bản đồ
    await page.fill('#nF', '18');
    await page.click('#eAdd');
    const box = await page.$eval('#mv', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.mouse.click(box[0], box[1]);
    await page.waitForTimeout(600);
    await page.click('#eAdd');
    w = (await st()).work.hcm;
    expect(w.data.added.length === 1 && w.data.added[0].floors === 18 && w.data.added[0].id === 'HCM-PA-001', 'chưa thêm khối mới');
    // xóa công trình khác
    await go('map?focus=hcm&view=province&sel=HCM-B-000300', 2200);
    await grp('edit');
    await page.waitForSelector('#eDel');
    await page.click('#eDel');
    expect((await st()).work.hcm.data.edits['299'].deleted === true, 'chưa xóa');
    const gp = await page.textContent('#gp');
    expect(/sửa 1 · thêm 1 · xóa 1/.test(gp), 'tổng hợp thay đổi sai: ' + gp.slice(0, 200));
    return 'tầng 40 → 132 m · di chuyển/xoay · hoàn tác/làm lại · thêm HCM-PA-001 (18 tầng) · xóa 1';
  });

  await t('UC-00.18', 'Biên tập mô hình dự án: cầu BR-01 + khu DA-2026-017 → khối lượng, kiểm tra, sang Digital Twin', async () => {
    await page.click('[data-et="proj"]');
    await page.fill('#bS', '5'); await page.fill('#bC', '8'); await page.fill('#bLn', '6');
    await page.click('#bApply');
    await page.waitForTimeout(500);
    const gp = await page.textContent('#gp');
    expect(gp.includes('Bê tông sơ bộ') && gp.includes('Vượt'), 'thiếu khối lượng/cảnh báo tĩnh không');
    const md = (await st()).model.hcm;
    expect(md.bridge.spans === 5 && md.bridge.clearance === 8 && md.bridge.lanes === 6, 'map.model chưa cập nhật');
    const lbl = await page.textContent('.map-labels');
    expect(lbl.includes('5 nhịp'), 'mô hình 3D cầu chưa cập nhật');
    await shot('24_mo_hinh_cau');
    // sang Digital Twin: tham số lấy từ bản đồ
    await page.goto(base + '#hero');
    await page.goto(base + '#twin?mode=simulation&scenario=BR-01&from=map');
    await page.waitForTimeout(1500);
    const tw = await page.textContent('body');
    expect(tw.includes('Bản đồ 3D'), 'Twin không ghi nguồn từ bản đồ');
    // khu đất Đồng Nai
    await go('map?focus=dong-nai&view=province&sel=DA-2026-017', 2500);
    await grp('edit');
    await page.click('[data-et="proj"]');
    const before = await page.textContent('#gp');
    await page.fill('#sF', '30'); await page.fill('#sB', '8');
    await page.click('#sApply');
    await page.waitForTimeout(500);
    const after = await page.textContent('#gp');
    expect(after !== before && after.includes('Tổng diện tích sàn') && after.includes('San nền'), 'mô hình khu đất chưa tính lại');
    const sm = (await st()).model['dong-nai'];
    expect(sm.site.floors === 30 && sm.site.blocks === 8 && sm.site.fail === true, 'khu đất 30 tầng phải vượt chỉ tiêu ô');
    await shot('25_mo_hinh_khu_dat');
    return `cầu 5 nhịp, tĩnh không 8 m → cảnh báo; Twin nhận thông số · khu đất 8 khối × 30 tầng → vượt chỉ tiêu (${sm.site.zone})`;
  });

  await t('UC-00.19', 'Phương án: lưu, so sánh, về hiện trạng, nạp lại, xuất JSON, giữ sau khi tải lại trang', async () => {
    await go('map?focus=hcm&view=province', 2000);
    await grp('edit');
    await page.click('[data-et="var"]');
    await page.click('#vSave');
    await page.waitForTimeout(800);
    let s = await st();
    const v = s.variants.find((x) => x.tenant === 'hcm');
    expect(v && v.id === 'PAN-HCM-001' && v.stats.added === 1 && v.stats.deleted === 1, 'chưa lưu phương án đúng');
    await page.click('#vReset');
    s = await st();
    expect(!Object.keys(s.work.hcm.data.edits).length && !s.work.hcm.data.added.length, 'chưa về hiện trạng');
    await page.click('#vCmp');
    await page.waitForSelector('#cmpTbl');
    const cols = await page.$$eval('#cmpTbl tr:first-child th', (e) => e.length);
    expect(cols >= 4, 'bảng so sánh thiếu cột');
    const cmp = await page.textContent('#cmpTbl');
    expect(cmp.includes('Cầu: dài / nhịp') && cmp.includes('Ô quy hoạch vượt'), 'bảng so sánh thiếu chỉ số');
    await shot('26_so_sanh_phuong_an');
    await closeModal();
    await page.click(`[data-vload="${v.id}"]`);
    await page.waitForTimeout(600);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#vExpCur')]);
    expect(/PhuongAn_hcm_.*\.json$/.test(dl.suggestedFilename()), 'tên file xuất sai');
    await page.reload();
    await page.waitForSelector('#mapx canvas');
    await page.waitForTimeout(2500);
    await grp('edit');
    const gp = await page.textContent('#gp');
    expect(gp.includes(v.id) && /thêm 1/.test(gp), 'phương án làm việc không giữ sau tải lại');
    return `${v.id} lưu/so sánh ${cols - 1} cột/nạp lại/xuất ${dl.suggestedFilename()}/giữ sau reload`;
  });

  await t('UC-02.UR2', 'UR-01 trên DEM thật với tham số mở rộng (nước biển dâng, trạm bơm, bê tông hóa)', async () => {
    await grp('ops');
    await page.click('[data-ot="scenario"]');
    await page.fill('[data-ur="slr"]', '0');
    await page.click('[data-a="ur01"]');
    await page.waitForTimeout(800);
    const n0 = +(await page.textContent('#gp')).match(/Công trình bị ảnh hưởng\s*([\d.]+)/)[1].replace(/\./g, '');
    await page.fill('[data-ur="slr"]', '0.8');
    await page.click('[data-a="ur01"]');
    await page.waitForTimeout(800);
    const n1 = +(await page.textContent('#gp')).match(/Công trình bị ảnh hưởng\s*([\d.]+)/)[1].replace(/\./g, '');
    expect(n1 > n0, `nước biển dâng không làm tăng số công trình ảnh hưởng (${n0} → ${n1})`);
    await page.fill('[data-ur="pump"]', '200');
    await page.click('[data-a="ur01"]');
    await page.waitForTimeout(800);
    const n2 = +(await page.textContent('#gp')).match(/Công trình bị ảnh hưởng\s*([\d.]+)/)[1].replace(/\./g, '');
    expect(n2 <= n1, 'trạm bơm không làm giảm ảnh hưởng');
    await shot('27_ur01_dem_that');
    return `ảnh hưởng: 0 m → ${n0}; +0,8 m nước biển dâng → ${n1}; + trạm bơm → ${n2}`;
  });
  // dọn trạng thái: không để phương án/mô hình của đợt này ảnh hưởng ca sau (cách ly testcase)
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('aipm-dt-demo-v3')); s.map.work = {}; s.map.model = {}; localStorage.setItem('aipm-dt-demo-v3', JSON.stringify(s)); });
  await page.goto(base + '#hero'); await page.reload();
};
