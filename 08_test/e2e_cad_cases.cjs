// E2E đợt 3 — CAD 2D → 3D → phân tích kết cấu → vật liệu → kịch bản cực đoan (UC-07.1 … UC-07.8)
module.exports = async ({ page, t, expect, shot }) => {
  const base = page.url().split('#')[0];
  const cmd = async (...xs) => { for (const x of xs) { await page.fill('#cadCmd', x); await page.press('#cadCmd', 'Enter'); await page.waitForTimeout(60); } };
  const cad = () => page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).cad);
  const hist = () => page.textContent('#cadHist');

  await t('UC-07.1', 'CAD 2D: lệnh vẽ & sửa kiểu AutoCAD (L, REC, C, DLI, O, TR, M, CO, U/REDO)', async () => {
    await page.goto(base + '#hero'); await page.goto(base + '#cad'); await page.waitForSelector('#cadCv'); await page.waitForTimeout(800);
    const n0 = (await cad()).doc.ents.length;
    await cmd('L', '-9000,-8000', '@6000,0', '@0,3000', '');
    await cmd('REC', '-9000,-15000', '@4000,2500');
    await cmd('C', '-4000,-12000', '1200');
    await cmd('DLI', '-9000,-8000', '-3000,-8000', '-6000,-9500');
    expect((await hist()).includes('Kích thước = 6.000 mm'), 'ghi kích thước sai');
    await cmd('O', '500', '-9000,-15000', '-7000,-13500', '');
    await cmd('L', '-12000,-10000', '@8000,0', '');
    await cmd('TR', '-3500,-10000', '');
    await cmd('CO', '-9000,-8000', '');
    let c = await cad();
    expect(c.doc.ents.length >= n0 + 7, 'thiếu đối tượng: ' + (c.doc.ents.length - n0));
    await cmd('U'); const a = (await cad()).doc.ents.length; await cmd('REDO'); const b = (await cad()).doc.ents.length;
    expect(b === a + 1 || b === a, 'hoàn tác/làm lại sai');
    await cmd('DI', '0,0', '@3000,4000');
    expect((await hist()).includes('Khoảng cách = 5.000'), 'DIST sai');
    await shot('30_cad_2d');
    return `${b - n0} đối tượng mới · DIST 5.000 mm · Offset/Trim/Undo OK`;
  });

  await t('UC-07.2', 'Công cụ kết cấu: lưới trục, cột, dầm, sàn, móng tự động', async () => {
    await cmd('TRUC', '7200*4', '7500*3');
    let st = (await cad()).doc.struct;
    expect(st.grid.xs.length === 5 && st.grid.ys.length === 4, 'lưới trục sai');
    await cmd('COT', '600x600', 'A');
    await cmd('DAM', '300x600', 'A');
    await cmd('SAN', '140', 'A');
    st = (await cad()).doc.struct;
    expect(st.slabs.length >= 12 && st.beams.length >= 31, `thiếu sàn/dầm: ${st.slabs.length}/${st.beams.length}`);
    await cmd('MONG', 'A');
    st = (await cad()).doc.struct;
    expect(st.foots.length >= st.cols.length, 'chưa đủ móng');
    return `${st.cols.length} cột · ${st.beams.length} dầm · ${st.slabs.length} sàn · ${st.foots.length} móng`;
  });

  await t('UC-07.3', 'Phân tích kết cấu khung 3D: đủ tiêu chí kỹ thuật, thời gian giải', async () => {
    await cmd('KHUNG', 'C');
    const t0 = Date.now();
    await page.click('#cadRun'); await page.waitForSelector('#critTbl');
    const rows = await page.$$eval('#critTbl tr', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')));
    expect(rows.length === 8, 'thiếu tiêu chí: ' + rows.length);
    expect(rows.every((r) => r.includes('Đạt')), 'thiết kế mẫu phải đạt: ' + rows.filter((r) => !r.includes('Đạt')).join(' | '));
    const h = await hist();
    expect(/bậc tự do/.test(h), 'không có thông tin bộ giải');
    await shot('31_cad_ketqua');
    return `8/8 tiêu chí đạt · ${Date.now() - t0} ms (gồm hiển thị) · ${h.match(/(\d[\d.]*) bậc tự do/)[1]} bậc tự do`;
  });

  await t('UC-07.4', 'Dựng 3D từ bản vẽ, tô mức sử dụng, hình biến dạng', async () => {
    await page.click('[data-v="3d"]'); await page.waitForTimeout(1500);
    expect(await page.isVisible('#cad3d canvas'), 'không có khung 3D');
    await page.check('#defo'); await page.waitForTimeout(800);
    await shot('32_cad_3d');
    await page.uncheck('#defo'); await page.click('[data-v="2d"]');
    return '3D + biến dạng ×80';
  });

  await t('UC-07.5', 'Vật liệu: bóc khối lượng từ mô hình, đủ/thiếu theo hợp đồng, kịp tiến độ', async () => {
    await page.click('[data-p="qto"]');
    let tx = await page.textContent('#cadPanel');
    expect(tx.includes('Đủ khối lượng'), 'mặc định phải đủ');
    await page.fill('[data-sq="steel"]', '300'); await page.press('[data-sq="steel"]', 'Tab'); await page.waitForTimeout(200);
    tx = await page.textContent('#cadPanel');
    expect(tx.includes('THIẾU') && tx.includes('Thiếu'), 'không phát hiện thiếu thép');
    await page.fill('[data-sm="concrete"]', '200'); await page.press('[data-sm="concrete"]', 'Tab'); await page.waitForTimeout(200);
    tx = await page.textContent('#cadPanel');
    const m = tx.match(/trễ phần thân ≈ (\d+) ngày/);
    expect(m && +m[1] > 0, 'không tính trễ tiến độ');
    await shot('33_cad_vatlieu');
    return `thép hợp đồng 300 t → THIẾU · bê tông 200 m³/tháng → trễ ${m[1]} ngày`;
  });

  await t('UC-07.6', 'Kịch bản cực đoan (bão, lũ, động đất, nhiệt, vật liệu, cung ứng) + AI đánh giá + Monte Carlo', async () => {
    await page.click('[data-p="scen"]');
    await page.click('#aiGen'); await page.waitForTimeout(300);
    await page.click('#runAll'); await page.waitForTimeout(600);
    const cards = await page.$$eval('.task.scen', (r) => r.map((x) => x.innerText));
    const fail = cards.filter((x) => x.includes('Không đạt')).length, pass = cards.filter((x) => x.includes('Đạt') && !x.includes('Không đạt')).length;
    expect(cards.length >= 6 && fail >= 2 && pass >= 1, `kết quả kịch bản bất thường: ${pass} đạt / ${fail} không đạt`);
    await page.click('[data-sv="0"]'); await page.waitForTimeout(1200);
    await shot('34_cad_bao');
    await page.click('#aiExp'); await page.waitForTimeout(500);
    const ai = await page.textContent('#aiOut');
    expect(ai.length > 100 && /Biện pháp|biện pháp|đề xuất/i.test(ai), 'AI không đề xuất biện pháp');
    await page.click('[data-p="analysis"]'); await page.click('#cadRun'); await page.waitForSelector('#mcRun');
    await page.click('#mcRun'); await page.waitForTimeout(300);
    const mc = await page.textContent('#mcOut');
    expect(/Xác suất vượt khả năng/.test(mc), 'không có Monte Carlo');
    await page.click('[data-v="2d"]');
    return `${cards.length} kịch bản: ${pass} đạt, ${fail} không đạt · ${mc.match(/khả năng \(thân công trình\): ([\d,]+%)/)?.[1] || ''} P(vượt)`;
  });

  await t('UC-07.7', 'Xuất / nhập DXF (khứ hồi)', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), cmd('DXFOUT')]);
    const path = require('path').join(__dirname, 'shots', 'roundtrip.dxf');
    await dl.saveAs(path);
    const txt = require('fs').readFileSync(path, 'utf8');
    expect(txt.includes('S-COL') && txt.includes('AC1009') && txt.includes('ENTITIES'), 'DXF thiếu nội dung');
    const n0 = (await cad()).doc.ents.length;
    await page.setInputFiles('#dxfIn', path); await page.waitForTimeout(600);
    const n1 = (await cad()).doc.ents.length;
    expect(n1 > n0 + 50, 'nhập DXF không tạo đối tượng');
    await cmd('U');
    return `DXF ${Math.round(txt.length / 1024)} KB · nhập lại +${n1 - n0} đối tượng`;
  });

  await t('UC-07.8', 'Lưu run kết cấu sang Digital Twin; Twin có lối vào mô hình thực', async () => {
    await page.click('[data-p="analysis"]'); await page.click('#cadRun'); await page.waitForSelector('#saveRun');
    await page.click('#saveRun'); await page.waitForTimeout(200);
    const runs = await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).twin.runs);
    expect(runs[0].result.method.startsWith('FEM_FRAME3D') && runs[0].level === 'L2*', 'run chưa lưu đúng');
    await page.goto(base + '#hero'); await page.goto(base + '#twin'); await page.waitForTimeout(800);
    expect(await page.isVisible('#toCad'), 'Twin thiếu lối vào CAD');
    return `${runs[0].runId} · ${runs[0].result.status}`;
  });

  await t('UC-07.9', 'Sa bàn: đưa mô hình thiết kế CAD vào khu đất thực trên bản đồ (tương lai ↔ hiện trạng, tiến độ thi công)', async () => {
    await page.goto(base + '#hero'); await page.goto(base + '#cad'); await page.waitForSelector('#toMap');
    await page.click('#toMap');
    await page.waitForSelector('#mapx canvas'); await page.waitForTimeout(3500);
    const lbl = async () => page.textContent('.map-labels');
    expect((await lbl()).includes('Sa bàn DA-2026-017'), 'chưa đặt sa bàn lên bản đồ');
    expect(await page.isChecked('#sbOn'), 'ô Xem tương lai chưa bật');
    const site = (await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).map.model['dong-nai'].site));
    const cadB = (await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).cad.b));
    expect(site.floors === cadB.storeys, 'khu đất chưa đồng bộ số tầng thiết kế');
    await shot('35_sa_ban');
    await page.$eval('#sbProg', (e) => { e.value = 50; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(400);
    const half = await lbl();
    expect(half.includes('đang thi công 6/12'), 'thanh tiến độ không cập nhật: ' + half.match(/Sa bàn[^📍]*/)?.[0]);
    await shot('36_sa_ban_thi_cong');
    await page.$eval('#sbProg', (e) => { e.value = 100; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
    await page.fill('#sbRot', '30'); await page.press('#sbRot', 'Tab');
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem('aipm-dt-demo-v3')).cad.place.rot)) === 30, 'chưa lưu hướng xoay');
    await page.uncheck('#sbOn'); await page.waitForTimeout(400);
    expect(!(await lbl()).includes('Sa bàn'), 'tắt tương lai nhưng sa bàn vẫn hiện');
    await page.check('#sbOn'); await page.waitForTimeout(400);
    return `${site.floors} tầng · ${site.bw}×${site.bd} m · tiến độ 50 % → 6/12 tầng · xoay 30° · bật/tắt tương lai OK`;
  });
};
