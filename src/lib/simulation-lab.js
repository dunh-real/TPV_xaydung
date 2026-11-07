// Bộ tính L1 phục vụ sandbox tương tác. Đây là các proxy/screening model có
// công thức và đơn vị minh bạch; không thay thế solver chuyên ngành L2.
// Tham số kind:'limit' là NGƯỠNG CHẤP NHẬN do kỹ sư nhập — giá trị mặc định là
// tham số demo, không phải trị số tiêu chuẩn đã xác minh.

const n = (key, label, value, min, max, step, unit, kind = 'input') => ({ key, label, value, min, max, step, unit, kind });
const L = (key, label, value, min, max, step, unit) => n(key, label, value, min, max, step, unit, 'limit');

export const SCENARIO_INPUTS = {
  'BR-01': [n('vehicles', 'Số lượt xe', 500, 10, 1000, 10, 'xe'), n('duration', 'Cửa sổ thời gian', 60, 10, 180, 5, 'phút'), n('bridgeLength', 'Chiều dài cầu', 300, 50, 2000, 10, 'm'), n('lanes', 'Số làn', 2, 1, 8, 1, 'làn'), n('vehicleLength', 'Chiều dài xe TB', 12, 3, 25, 0.5, 'm'), n('gap', 'Khoảng cách xe', 5, 1, 50, 1, 'm'), n('axleLoad', 'Tải trục tham chiếu', 100, 20, 250, 5, 'kN'),
    n('spans', 'Số nhịp', 3, 1, 20, 1, 'nhịp'), n('deckWidth', 'Bề rộng mặt cầu', 18, 6, 50, 0.5, 'm'), n('clearance', 'Tĩnh không thông thuyền thiết kế', 12, 2, 60, 0.5, 'm'), n('impactFactor', 'Hệ số xung kích', 1.25, 1, 2, 0.05, ''),
    L('allowableLoad', 'Tải cho phép mỗi nhịp', 300, 50, 5000, 10, 'kN'), L('requiredClearance', 'Tĩnh không yêu cầu', 10, 2, 60, 0.5, 'm'), L('minLaneWidth', 'Bề rộng làn tối thiểu', 3.5, 2.5, 5, 0.05, 'm')],
  'BR-02': [n('grossMass', 'Khối lượng xe', 48, 5, 120, 1, 'tấn'), n('braking', 'Gia tốc phanh', 3.5, 0.5, 8, 0.1, 'm/s²'), n('laneOffset', 'Lệch tâm làn', 2.5, 0, 8, 0.1, 'm'),
    n('impactFactor', 'Hệ số động', 1.3, 1, 2, 0.05, ''), n('importance', 'Hệ số tầm quan trọng', 1, 0.8, 1.5, 0.05, ''),
    L('allowableDynamic', 'Tải động cho phép', 1000, 100, 5000, 10, 'kN'), L('allowableMoment', 'Mô men lệch tâm cho phép', 2500, 100, 20000, 50, 'kN·m')],
  'BR-03': [n('axleLoad', 'Tải trục', 100, 20, 250, 5, 'kN'), n('cycles', 'Số chu kỳ quy đổi', 2000000, 10000, 20000000, 10000, 'chu kỳ'), n('detailClass', 'Ngưỡng mỏi tham chiếu', 80, 30, 160, 5, 'MPa'),
    n('stressFactor', 'Hệ số ứng suất / kN tải trục', 0.42, 0.1, 1.5, 0.01, 'MPa/kN'), n('designLife', 'Tuổi thọ thiết kế', 100, 10, 150, 5, 'năm'), n('growth', 'Tăng trưởng giao thông', 2, 0, 10, 0.5, '%/năm'),
    L('damageLimit', 'Chỉ số tích lũy mỏi cho phép', 1, 0.1, 2, 0.05, '')],
  'BR-04': [n('windSpeed', 'Vận tốc gió', 35, 5, 80, 1, 'm/s'), n('tempDelta', 'Biên nhiệt', 35, 5, 70, 1, '°C'), n('bridgeLength', 'Chiều dài cầu', 300, 50, 2000, 10, 'm'),
    n('gustFactor', 'Hệ số giật', 1.4, 1, 2.5, 0.05, ''), n('alpha', 'Hệ số giãn nở nhiệt', 12, 5, 20, 0.5, '×10⁻⁶/°C'), n('spans', 'Số nhịp (số khe co giãn = nhịp − 1, tối thiểu 1)', 3, 1, 20, 1, 'nhịp'),
    L('allowablePressure', 'Áp lực gió cho phép', 2.5, 0.2, 10, 0.1, 'kPa'), L('jointCapacity', 'Hành trình khe co giãn cho phép', 160, 20, 1000, 10, 'mm')],
  'BR-05': [n('waterVelocity', 'Lưu tốc lũ', 4.2, 0.2, 12, 0.1, 'm/s'), n('waterDepth', 'Chiều sâu nước', 9, 1, 30, 0.5, 'm'), n('pierWidth', 'Bề rộng trụ', 3, 0.5, 10, 0.1, 'm'),
    n('returnPeriod', 'Chu kỳ lặp lũ thiết kế', 100, 10, 1000, 10, 'năm'), n('foundationDepth', 'Độ sâu móng dưới đáy sông', 12, 1, 60, 0.5, 'm'),
    L('scourSafety', 'Hệ số an toàn xói yêu cầu', 1.5, 1, 5, 0.1, ''), L('allowablePressure', 'Áp lực thủy động cho phép', 15, 1, 100, 0.5, 'kPa')],
  'BD-01': [n('occupants', 'Số người tập trung', 1200, 50, 10000, 50, 'người'), n('area', 'Diện tích sử dụng', 2400, 100, 20000, 100, 'm²'), n('personLoad', 'Tải quy đổi/người', 0.8, 0.5, 1.5, 0.05, 'kN'),
    n('dynamicFactor', 'Hệ số động đám đông', 1, 1, 2, 0.05, ''), L('allowableLive', 'Hoạt tải cho phép', 4, 1, 10, 0.1, 'kPa'), L('maxDensity', 'Mật độ người tối đa', 0.65, 0.1, 4, 0.05, 'người/m²')],
  'BD-02': [n('windSpeed', 'Vận tốc gió', 42, 5, 90, 1, 'm/s'), n('height', 'Chiều cao nhà', 150, 20, 600, 5, 'm'), n('facadeWidth', 'Bề rộng đón gió', 36, 10, 100, 1, 'm'),
    n('terrainFactor', 'Hệ số địa hình – độ cao', 1.2, 0.6, 2, 0.05, ''), n('importance', 'Hệ số tầm quan trọng', 1, 0.8, 1.5, 0.05, ''), n('stiffness', 'Độ cứng ngang tổng thể', 25, 1, 200, 1, 'kN/mm'),
    L('allowableForce', 'Lực ngang cho phép', 12000, 500, 100000, 100, 'kN'), L('driftLimit', 'Giới hạn chuyển vị đỉnh H/…', 500, 100, 1000, 10, '')],
  'BD-03': [n('pga', 'Gia tốc nền PGA', 0.18, 0.02, 0.6, 0.01, 'g'), n('mass', 'Khối lượng tham gia', 42000, 1000, 300000, 1000, 'tấn'), n('responseFactor', 'Hệ số đáp ứng giả định', 2.5, 0.5, 6, 0.1, ''),
    n('importance', 'Hệ số tầm quan trọng', 1, 0.8, 1.5, 0.05, ''), n('behaviorFactor', 'Hệ số ứng xử q', 1, 1, 6, 0.1, ''),
    L('shearCapacity', 'Khả năng chịu cắt đáy', 240000, 1000, 2000000, 1000, 'kN')],
  'BD-04': [n('occupants', 'Số người', 1800, 50, 10000, 50, 'người'), n('exitWidth', 'Tổng bề rộng thoát', 8, 1, 40, 0.5, 'm'), n('travelDistance', 'Quãng đường TB', 45, 5, 150, 5, 'm'),
    n('walkSpeed', 'Tốc độ đi bộ', 1.1, 0.4, 2, 0.05, 'm/s'), n('flowRate', 'Lưu lượng riêng qua lối thoát', 1.3, 0.5, 2, 0.05, 'người/m/s'), n('preMovement', 'Thời gian phản ứng', 1.5, 0, 10, 0.5, 'phút'),
    L('allowableEgress', 'Thời gian thoát cho phép', 6, 1, 30, 0.5, 'phút'), L('maxTravel', 'Quãng đường thoát tối đa', 60, 10, 150, 5, 'm')],
  'BD-05': [n('damagedColumns', 'Số cột giả định hỏng', 1, 1, 8, 1, 'cột'), n('redundancy', 'Chỉ số dự phòng', 1.4, 0.5, 3, 0.1, ''), n('loadRatio', 'Tỷ lệ tải hiện hữu', 0.65, 0.1, 1.2, 0.05, ''),
    n('dynamicAmplification', 'Hệ số động mất cột đột ngột', 2, 1, 3, 0.1, ''), n('alternatePaths', 'Số đường truyền tải thay thế', 2, 1, 6, 1, 'đường'),
    L('indexLimit', 'Chỉ số phân phối lại cho phép', 1, 0.2, 2, 0.05, '')],
  'TU-01': [n('inflow', 'Lưu lượng tràn vào', 2.8, 0, 20, 0.1, 'm³/s'), n('pumpCapacity', 'Năng lực bơm', 1.5, 0, 20, 0.1, 'm³/s'), n('duration', 'Thời gian sự cố', 90, 5, 360, 5, 'phút'), n('floorArea', 'Diện tích tầng hầm', 12000, 500, 100000, 500, 'm²'),
    n('pumpAvailability', 'Tỷ lệ bơm sẵn sàng', 1, 0, 1, 0.05, ''), n('storage', 'Dung tích hố thu/bể chứa', 0, 0, 50000, 100, 'm³'),
    L('allowableDepth', 'Độ sâu ngập cho phép', 0.3, 0.05, 2, 0.05, 'm'), L('equipmentHeight', 'Cao độ đặt thiết bị trọng yếu', 0.6, 0.1, 3, 0.05, 'm')],
  'TU-02': [n('excavationDepth', 'Chiều sâu đào', 18, 2, 60, 1, 'm'), n('groundwater', 'Cột nước ngầm', 8, 0, 30, 0.5, 'm'), n('soilModulus', 'Mô đun đất giả định', 25, 5, 150, 1, 'MPa'),
    n('wallFactor', 'Hệ số độ cứng tường vây', 1, 0.5, 3, 0.1, ''), n('distanceToBuilding', 'Khoảng cách tới công trình lân cận', 10, 0, 100, 1, 'm'),
    L('allowableSettlement', 'Lún bề mặt cho phép', 30, 5, 150, 1, 'mm'), L('buildingSettlement', 'Lún cho phép tại công trình lân cận', 15, 2, 100, 1, 'mm')],
  'CS-01': [n('craneDistance', 'Khoảng cách hai cẩu', 72, 10, 200, 1, 'm'), n('radiusA', 'Bán kính cẩu A', 55, 10, 100, 1, 'm'), n('radiusB', 'Bán kính cẩu B', 50, 10, 100, 1, 'm'), n('overlapTime', 'Thời gian làm đồng thời', 45, 0, 480, 5, 'phút'),
    n('verticalSeparation', 'Chênh cao móc/cần giữa hai cẩu', 3, 0, 30, 0.5, 'm'), n('windOp', 'Gió khi vận hành', 10, 0, 30, 0.5, 'm/s'),
    L('safetyBuffer', 'Khoảng an toàn ngang yêu cầu', 0, 0, 20, 0.5, 'm'), L('requiredVertical', 'Chênh cao tối thiểu để chồng vùng', 5, 0, 20, 0.5, 'm'), L('windLimit', 'Gió tối đa cho phép vận hành', 15, 5, 30, 0.5, 'm/s')],
  'CS-02': [n('stockMass', 'Khối lượng tập kết', 85, 1, 500, 1, 'tấn'), n('stockArea', 'Diện tích kê tải', 36, 5, 500, 1, 'm²'), n('allowedLoad', 'Tải sàn cho phép đã duyệt', 12, 1, 50, 0.5, 'kPa'),
    n('dynamicFactor', 'Hệ số động bốc xếp', 1, 1, 2, 0.05, ''), n('propsFactor', 'Hệ số tăng cường chống tạm', 1, 1, 4, 0.1, ''),
    L('utilLimit', 'Tỷ lệ sử dụng tối đa', 1, 0.3, 1.2, 0.05, '')],
  'RD-01': [n('trucksPerDay', 'Xe nặng/ngày', 3200, 100, 30000, 100, 'xe'), n('axleLoad', 'Tải trục TB', 115, 40, 250, 5, 'kN'), n('years', 'Thời gian khai thác', 10, 1, 30, 1, 'năm'),
    n('growth', 'Tăng trưởng xe nặng', 0, 0, 15, 0.5, '%/năm'), n('laneDistribution', 'Hệ số phân bố làn', 1, 0.3, 1, 0.05, ''),
    L('designESAL', 'ESAL thiết kế', 60, 1, 500, 1, 'triệu trục'), L('legalAxle', 'Tải trục cho phép khai thác', 120, 60, 250, 5, 'kN')],
  'RD-02': [n('rainfall', 'Mưa tích lũy 72h', 280, 20, 1000, 10, 'mm'), n('slope', 'Độ dốc mái', 38, 5, 70, 1, '°'), n('drainage', 'Hiệu quả thoát nước', 0.55, 0, 1, 0.05, ''),
    n('soilStrength', 'Hệ số cường độ đất', 1, 0.3, 3, 0.05, ''), n('vegetation', 'Độ phủ thực vật', 0, 0, 1, 0.05, ''),
    L('indexLimit', 'Chỉ số nhạy cảm cho phép', 1, 0.2, 2, 0.05, '')],
  'HY-01': [n('inflow', 'Lưu lượng đến', 4200, 100, 20000, 100, 'm³/s'), n('outflow', 'Lưu lượng xả', 2800, 0, 20000, 100, 'm³/s'), n('duration', 'Thời gian đỉnh lũ', 6, 1, 72, 1, 'h'), n('reservoirArea', 'Diện tích mặt hồ', 42, 1, 500, 1, 'km²'),
    n('spillwayCapacity', 'Năng lực xả tràn tối đa', 20000, 100, 30000, 100, 'm³/s'), n('crestMargin', 'Khoảng cách mực nước hiện tại tới đỉnh đập', 3, 0.5, 20, 0.1, 'm'),
    L('maxRise', 'Mực dâng cho phép', 1.5, 0.1, 10, 0.1, 'm'), L('freeboardRequired', 'Độ cao an toàn tối thiểu', 1, 0.2, 5, 0.1, 'm')],
  'UR-01': [n('rain', 'Lượng mưa', 120, 10, 400, 5, 'mm/h'), n('tide', 'Mực triều/nước dâng', 1.6, 0, 4, 0.05, 'm'), n('hours', 'Thời gian mưa', 3, 0.5, 24, 0.5, 'h'), n('drain', 'Năng lực tiêu thoát', 40, 0, 200, 5, 'mm/h'), n('lowGround', 'Cao độ nền thấp nhất khu vực', 1.2, -1, 10, 0.1, 'm'), n('buildings', 'Số công trình trong vùng (từ MOD-00)', 1200, 1, 50000, 10, 'mảnh'),
    n('returnPeriod', 'Chu kỳ lặp mưa', 10, 2, 200, 1, 'năm'), n('imperviousness', 'Tỷ lệ bê tông hóa', 0.75, 0.1, 1, 0.05, ''), n('pumpCapacity', 'Trạm bơm quy đổi', 0, 0, 100, 5, 'mm/h'), n('seaLevelRise', 'Nước biển dâng', 0, 0, 1.5, 0.05, 'm'),
    L('allowableDepth', 'Độ ngập cho phép', 0.5, 0.05, 2, 0.05, 'm'), L('allowableAffected', 'Số công trình ảnh hưởng chấp nhận', 300, 0, 50000, 10, 'mảnh')],
  'IN-01': [n('machineFreq', 'Tần số máy', 18, 1, 100, 0.5, 'Hz'), n('naturalFreq', 'Tần số riêng giả định', 16.5, 1, 100, 0.5, 'Hz'), n('damping', 'Tỷ số cản', 0.04, 0.01, 0.2, 0.01, ''),
    n('unbalanceForce', 'Lực mất cân bằng', 5, 0.1, 100, 0.1, 'kN'), n('stiffness', 'Độ cứng gối/móng máy', 50, 1, 1000, 1, 'kN/mm'),
    L('dafLimit', 'Hệ số khuếch đại cho phép', 3, 1, 10, 0.1, ''), L('allowableAmp', 'Biên độ cho phép', 0.1, 0.01, 2, 0.01, 'mm'), L('separationLimit', 'Độ lệch tần số tối thiểu', 20, 0, 50, 1, '%')],
};

export const isLimit = (id, key) => (SCENARIO_INPUTS[id] || []).some((f) => f.key === key && f.kind === 'limit');

export function scenarioDefaults(id) {
  return Object.fromEntries((SCENARIO_INPUTS[id] || []).map((x) => [x.key, x.value]));
}

// ---- trạng thái theo ngưỡng: PASS ≤ 85 % ngưỡng < WARNING ≤ ngưỡng < FAIL
const WARN_BAND = 0.85;
export const chkMax = (v, lim) => (v > lim ? 'FAIL' : v > lim * WARN_BAND ? 'WARNING' : 'PASS');
export const chkMin = (v, lim) => (v < lim ? 'FAIL' : v < lim / WARN_BAND ? 'WARNING' : 'PASS');
const metric = (label, value, unit, status = 'INFO', limit = null) => ({ label, value: Number.isFinite(value) ? value : 0, unit, status, ...(limit ? { limit } : {}) });
const mx = (label, value, unit, lim) => metric(label, value, unit, chkMax(value, lim), { value: lim, type: 'max' });
const mn = (label, value, unit, lim) => metric(label, value, unit, chkMin(value, lim), { value: lim, type: 'min' });
const round = (v, d = 2) => +(+v).toFixed(d);
const series = (peak, count = 32) => Array.from({ length: count }, (_, i) => {
  const x = i / (count - 1);
  return { t: x, value: round(peak * (0.18 + 0.82 * Math.sin(Math.PI * x) ** 1.6) * (0.94 + 0.06 * Math.sin(i * 2.7)), 3) };
});

export function runScreeningModel(id, raw) {
  const input = { ...scenarioDefaults(id), ...(raw || {}) };
  let metrics = [], peak = 1, summary = '';
  const g = 9.80665;
  switch (id) {
    case 'BR-01': {
      const capacity = Math.floor(input.bridgeLength / (input.vehicleLength + input.gap)) * input.lanes;
      const flow = input.vehicles / (input.duration / 60);
      peak = Math.min(capacity, Math.ceil(flow * (input.bridgeLength / 1000) / 45));
      const perSpan = (peak * input.axleLoad * input.impactFactor) / Math.max(1, input.spans);
      metrics = [metric('Sức chứa hình học', capacity, 'xe'), metric('Lưu lượng', round(flow), 'xe/h'), metric('Xe đồng thời ước tính', peak, 'xe'), metric('Tổng tải trục tham chiếu cực đại', round(peak * input.axleLoad), 'kN', 'INFO'),
        mx('Tải có xung kích trên mỗi nhịp', round(perSpan), 'kN', input.allowableLoad), mn('Tĩnh không thông thuyền', round(input.clearance), 'm', input.requiredClearance), mn('Bề rộng mỗi làn', round(input.deckWidth / input.lanes), 'm', input.minLaneWidth)];
      summary = 'Mô hình dòng xe L1; tải chia đều theo nhịp có hệ số xung kích, chưa ánh xạ vào phần tử kết cấu.';
      break;
    }
    case 'BR-02': {
      const weight = input.grossMass * g, dynamic = weight * (1 + input.braking / g) * input.impactFactor * input.importance, moment = dynamic * input.laneOffset;
      peak = dynamic; metrics = [metric('Trọng lượng xe', round(weight), 'kN'), mx('Tải động sơ bộ', round(dynamic), 'kN', input.allowableDynamic), mx('Mô men lệch tâm proxy', round(moment), 'kN·m', input.allowableMoment)]; summary = 'Kiểm tra tải dọc/lệch tâm sơ bộ; cần mô hình cầu và lịch sử tải cho L2.'; break;
    }
    case 'BR-03': {
      const stressProxy = input.axleLoad * input.stressFactor, life = (input.designLife / 100) * (1 + input.growth / 100) ** (input.designLife / 20);
      const damage = input.cycles / 2000000 * (stressProxy / input.detailClass) ** 3 * life;
      peak = stressProxy; metrics = [metric('Biên độ ứng suất proxy', round(stressProxy), 'MPa', chkMax(stressProxy, input.detailClass), { value: input.detailClass, type: 'max' }), mx('Chỉ số tích lũy mỏi proxy', round(damage, 3), '', input.damageLimit)]; summary = 'Chỉ số proxy theo quy tắc lũy thừa bậc 3 có hệ số tuổi thọ/tăng trưởng; không thay thế kiểm tra mỏi theo tiêu chuẩn.'; break;
    }
    case 'BR-04': {
      const q = 0.000613 * (input.windSpeed * input.gustFactor) ** 2, thermal = input.alpha * 1e-6 * input.tempDelta * input.bridgeLength * 1000, perJoint = thermal / Math.max(1, input.spans - 1);
      peak = q; metrics = [mx('Áp lực gió có giật', round(q, 3), 'kPa', input.allowablePressure), metric('Giãn nở nhiệt tự do toàn cầu', round(thermal), 'mm'), mx('Hành trình mỗi khe co giãn', round(perJoint), 'mm', input.jointCapacity)]; summary = 'Tải gió có hệ số giật và giãn nở tự do chia theo khe; chưa tính mode dao động hoặc liên kết/gối cầu.'; break;
    }
    case 'BR-05': {
      const v = input.waterVelocity * (1 + 0.08 * Math.log10(input.returnPeriod / 100));
      const pressure = 0.5 * 1000 * v ** 2 / 1000, scour = 1.3 * input.pierWidth * (v / Math.sqrt(g * input.waterDepth)) * Math.max(0.5, Math.min(2, (input.waterDepth / input.pierWidth) ** 0.35));
      peak = pressure; metrics = [metric('Lưu tốc theo chu kỳ lặp', round(v), 'm/s'), mx('Áp lực thủy động', round(pressure), 'kPa', input.allowablePressure), metric('Chiều sâu xói proxy', round(scour), 'm'), mn('Hệ số an toàn xói (móng/xói)', round(input.foundationDepth / Math.max(0.01, scour)), '', input.scourSafety)]; summary = 'Sàng lọc thủy động/xói theo chu kỳ lặp; cần địa chất, hình học lòng dẫn và solver thủy lực.'; break;
    }
    case 'BD-01': { const load = input.occupants * input.personLoad / input.area * input.dynamicFactor, dens = input.occupants / input.area; peak = load; metrics = [mx('Mật độ người', round(dens, 3), 'người/m²', input.maxDensity), mx('Hoạt tải quy đổi', round(load, 3), 'kPa', input.allowableLive)]; summary = 'Hoạt tải sử dụng quy đổi có hệ số động đám đông; chưa phân phối vào sàn/dầm/cột.'; break; }
    case 'BD-02': {
      const q = 0.000613 * input.windSpeed ** 2, force = q * input.terrainFactor * input.importance * input.height * input.facadeWidth, drift = force / input.stiffness;
      peak = q; metrics = [metric('Áp lực gió động', round(q, 3), 'kPa'), mx('Lực mặt đứng proxy', round(force), 'kN', input.allowableForce), mx('Chuyển vị đỉnh proxy', round(drift), 'mm', input.height * 1000 / input.driftLimit)]; summary = 'Tải mặt đứng sơ bộ có hệ số địa hình; chuyển vị = lực/độ cứng tổng thể; chưa tính khí động và đáp ứng mode.'; break;
    }
    case 'BD-03': {
      const coef = input.pga * input.responseFactor * input.importance / input.behaviorFactor, shear = coef * input.mass * g;
      peak = shear; metrics = [metric('Hệ số lực ngang proxy', round(coef, 3), 'W'), mx('Lực cắt đáy proxy', round(shear), 'kN', input.shearCapacity), metric('Tỷ lệ nhu cầu/khả năng', round(shear / input.shearCapacity, 3), '', chkMax(shear / input.shearCapacity, 1))]; summary = 'Phép tính sàng lọc theo PGA có hệ số tầm quan trọng và hệ số ứng xử; không phải phân tích phổ/phi tuyến.'; break;
    }
    case 'BD-04': {
      const capacity = input.exitWidth * input.flowRate * 60, egress = input.occupants / capacity + input.travelDistance / input.walkSpeed / 60 + input.preMovement;
      peak = egress; metrics = [metric('Năng lực thoát', round(capacity), 'người/phút'), mx('Thời gian thoát proxy', round(egress, 2), 'phút', input.allowableEgress), mx('Quãng đường thoát', round(input.travelDistance), 'm', input.maxTravel)]; summary = 'Mô hình dòng người đơn giản (phản ứng + đi bộ + hàng chờ); lan khói/nhiệt cần CFD và mô hình PCCC L2.'; break;
    }
    case 'BD-05': { const index = input.loadRatio * input.damagedColumns * input.dynamicAmplification / (input.redundancy * input.alternatePaths); peak = index; metrics = [mx('Chỉ số phân phối lại proxy', round(index, 3), '', input.indexLimit)]; summary = 'Chỉ số sàng lọc mất cấu kiện có hệ số động và số đường truyền tải; không kết luận sụp đổ dây chuyền.'; break; }
    case 'TU-01': {
      const net = Math.max(0, input.inflow - input.pumpCapacity * input.pumpAvailability), vol = Math.max(0, net * input.duration * 60 - input.storage), depth = vol / input.floorArea;
      peak = depth; metrics = [metric('Lưu lượng ròng', round(net, 2), 'm³/s'), metric('Thể tích ngập sau bể chứa', round(vol), 'm³'), mx('Độ sâu ngập', round(depth, 3), 'm', input.allowableDepth), mx('Ngập so với cao độ thiết bị', round(depth, 3), 'm', input.equipmentHeight)]; summary = 'Cân bằng thể tích một ngăn có bể chứa và tỷ lệ bơm sẵn sàng; chưa tính mạng dòng chảy và cao độ cục bộ.'; break;
    }
    case 'TU-02': {
      const settlement = input.excavationDepth * (1 + input.groundwater / Math.max(1, input.excavationDepth)) / input.soilModulus * 18 / input.wallFactor, atBuilding = settlement * Math.exp(-input.distanceToBuilding / input.excavationDepth);
      peak = settlement; metrics = [mx('Lún bề mặt proxy', round(settlement, 2), 'mm', input.allowableSettlement), mx('Lún tại công trình lân cận', round(atBuilding, 2), 'mm', input.buildingSettlement)]; summary = 'Quan hệ proxy có hệ số độ cứng tường và suy giảm theo khoảng cách; cần mô hình địa tầng và trình tự đào L2.'; break;
    }
    case 'CS-01': {
      const overlap = Math.max(0, input.radiusA + input.radiusB + input.safetyBuffer - input.craneDistance), index = overlap * input.overlapTime;
      const separated = input.verticalSeparation >= input.requiredVertical;
      const st = overlap <= 0 ? 'PASS' : separated ? 'WARNING' : 'FAIL';
      peak = overlap; metrics = [metric('Bề rộng vùng giao nhau (gồm khoảng an toàn)', round(overlap), 'm', st, { value: 0, type: 'max' }), metric('Chỉ số xung đột thời gian', round(index), 'm·phút', st), mn('Chênh cao giữa hai cẩu', round(input.verticalSeparation), 'm', input.requiredVertical), mx('Gió khi vận hành', round(input.windOp), 'm/s', input.windLimit)]; summary = 'Kiểm tra hình học 4D; vùng giao nhau chỉ chấp nhận có điều kiện khi đủ chênh cao, cần phân vùng cấm hoặc interlock.'; break;
    }
    case 'CS-02': {
      const load = input.stockMass * g / input.stockArea * input.dynamicFactor, ratio = load / (input.allowedLoad * input.propsFactor);
      peak = load; metrics = [metric('Tải phân bố tập kết', round(load, 2), 'kPa', chkMax(ratio, input.utilLimit)), mx('Tỷ lệ nhu cầu/cho phép', round(ratio, 2), '', input.utilLimit)]; summary = 'So sánh với tải cho phép do kỹ sư nhập (có hệ số chống tạm); chưa kiểm tra đâm thủng.'; break;
    }
    case 'RD-01': {
      const factor = (input.axleLoad / 80) ** 4, gr = input.growth / 100, sum = gr > 0 ? ((1 + gr) ** input.years - 1) / gr : input.years, esal = input.trucksPerDay * 365 * sum * factor * input.laneDistribution;
      peak = factor; metrics = [metric('Hệ số tải trục quy đổi', round(factor, 2), ''), mx('ESAL tích lũy proxy', round(esal / 1e6, 2), 'triệu trục', input.designESAL), mx('Tải trục TB so với cho phép', round(input.axleLoad), 'kN', input.legalAxle)]; summary = 'Quy đổi tải trục lũy thừa 4 có tăng trưởng và phân bố làn; cần kết cấu áo đường và hiệu chuẩn địa phương.'; break;
    }
    case 'RD-02': { const index = input.rainfall / 300 * Math.tan(input.slope * Math.PI / 180) * (1.4 - input.drainage) * (1 - 0.4 * input.vegetation) / input.soilStrength; peak = index; metrics = [mx('Chỉ số nhạy cảm trượt', round(index, 3), '', input.indexLimit)]; summary = 'Chỉ số nhạy cảm tương đối có cường độ đất và thực vật; không phải hệ số ổn định mái dốc.'; break; }
    case 'HY-01': {
      const out = Math.min(input.outflow, input.spillwayCapacity), rise = Math.max(0, input.inflow - out) * input.duration * 3600 / (input.reservoirArea * 1e6), free = input.crestMargin - rise;
      peak = rise; metrics = [metric('Lưu lượng dư', round(input.inflow - out), 'm³/s'), mx('Mực nước dâng proxy', round(rise, 3), 'm', input.maxRise), mn('Độ cao an toàn còn lại', round(free, 2), 'm', input.freeboardRequired)]; summary = 'Cân bằng hồ tuyến tính, xả giới hạn bởi năng lực tràn; cần quan hệ dung tích–mực nước và diễn toán lũ L2.'; break;
    }
    case 'IN-01': {
      const r = input.machineFreq / input.naturalFreq, daf = 1 / Math.sqrt((1 - r ** 2) ** 2 + (2 * input.damping * r) ** 2), amp = input.unbalanceForce / input.stiffness * daf, sep = Math.abs(r - 1) * 100;
      peak = daf; metrics = [metric('Tỷ số tần số', round(r, 3), ''), mx('Hệ số khuếch đại động proxy', round(daf, 2), '', input.dafLimit), mx('Biên độ dao động proxy', round(amp, 3), 'mm', input.allowableAmp), mn('Độ lệch tần số máy/kết cấu', round(sep, 1), '%', input.separationLimit)]; summary = 'Dao động một bậc tự do có lực mất cân bằng; cần mode shape, tải máy và liên kết thực cho L2.'; break;
    }
    case 'UR-01': {
      const rainEff = input.rain * (1 + 0.15 * Math.log10(input.returnPeriod / 10));
      const net = Math.max(0, rainEff - input.drain - input.pumpCapacity) / 1000 * input.hours * input.imperviousness * 0.8;
      const level = input.tide + input.seaLevelRise + net * 1.8, depth = Math.max(0, level - input.lowGround), share = Math.min(1, depth / 2.5), affected = Math.round(input.buildings * share * 0.35);
      peak = depth; metrics = [metric('Mưa thiết kế theo chu kỳ lặp', round(rainEff, 1), 'mm/h'), metric('Mực nước proxy', round(level), 'm'), mx('Độ ngập tại nền thấp nhất', round(depth), 'm', input.allowableDepth), mx('Công trình có thể bị ảnh hưởng (proxy)', affected, 'mảnh', input.allowableAffected)];
      summary = 'Cân bằng thể tích proxy mưa + triều + nước biển dâng, có tỷ lệ bê tông hóa và trạm bơm; chạy trên vùng chọn ở Bản đồ 3D (MOD-00) để có danh sách công trình. Liên kết TU-01/RD-02/BR-05 cho từng công trình; lớp kiểu e-City (nước lịch sử) chỉ là L0.'; break;
    }
    default: return { status: 'INSUFFICIENT_DATA', metrics: [], summary: 'Chưa có mô hình sàng lọc.', series: [] };
  }
  const status = metrics.some((m) => m.status === 'FAIL') ? 'FAIL' : metrics.some((m) => m.status === 'WARNING') ? 'WARNING' : 'PASS';
  return { status, metrics, summary: summary + ' Ngưỡng chấp nhận là tham số demo do kỹ sư nhập.', series: series(Math.max(0.001, peak)), method: 'L1_SCREENING_MODEL/1.1' };
}

// ============ Phân tích tham số (quét, độ nhạy, Monte Carlo, bộ ca) ============
const fieldOf = (id, key) => (SCENARIO_INPUTS[id] || []).find((f) => f.key === key);
const clampF = (f, v) => Math.min(f.max, Math.max(f.min, v));
// chỉ tiêu có ngưỡng trước (ưu tiên cái đang gần ngưỡng nhất)
export function primaryMetric(id, input) {
  const r = runScreeningModel(id, input);
  let best = 0, bestU = -1;
  r.metrics.forEach((m, i) => { if (!m.limit) return; const u = m.limit.type === 'max' ? m.value / (m.limit.value || 1e-9) : (m.limit.value || 1e-9) / Math.max(1e-9, m.value); if (u > bestU) { bestU = u; best = i; } });
  return best;
}
export const metricLabels = (id, input) => runScreeningModel(id, input).metrics.map((m, i) => ({ i, label: m.label, unit: m.unit, limited: !!m.limit }));

export function sweep1(id, input, key, min, max, steps, mi) {
  steps = Math.max(2, Math.min(50, Math.round(steps)));
  const pts = [];
  for (let k = 0; k < steps; k++) {
    const v = round(min + ((max - min) * k) / (steps - 1), 6);
    const r = runScreeningModel(id, { ...input, [key]: v });
    const m = r.metrics[mi] || r.metrics[0];
    pts.push({ x: v, y: m.value, status: m.status, overall: r.status, limit: m.limit?.value ?? null, limitType: m.limit?.type || null });
  }
  const transitions = [];
  for (let k = 1; k < pts.length; k++) if (pts[k].status !== pts[k - 1].status) transitions.push({ from: pts[k - 1].status, to: pts[k].status, between: [pts[k - 1].x, pts[k].x], at: round((pts[k - 1].x + pts[k].x) / 2, 4) });
  return { key, mi, pts, transitions };
}

export function sweep2(id, input, kx, xr, ky, yr, steps, mi) {
  steps = Math.max(2, Math.min(25, Math.round(steps)));
  const xs = Array.from({ length: steps }, (_, k) => round(xr[0] + ((xr[1] - xr[0]) * k) / (steps - 1), 6));
  const ys = Array.from({ length: steps }, (_, k) => round(yr[0] + ((yr[1] - yr[0]) * k) / (steps - 1), 6));
  const grid = ys.map((y) => xs.map((x) => { const r = runScreeningModel(id, { ...input, [kx]: x, [ky]: y }); const m = mi == null ? null : r.metrics[mi]; return { status: m ? m.status : r.status, value: m ? m.value : null }; }));
  const count = { PASS: 0, WARNING: 0, FAIL: 0, INFO: 0 };
  grid.flat().forEach((c) => (count[c.status] = (count[c.status] || 0) + 1));
  return { kx, ky, xs, ys, grid, count };
}

export function tornado(id, input, pct, mi) {
  const base = runScreeningModel(id, input).metrics[mi]?.value ?? 0;
  const rows = (SCENARIO_INPUTS[id] || []).filter((f) => f.kind !== 'limit').map((f) => {
    const lo = clampF(f, input[f.key] * (1 - pct / 100)), hi = clampF(f, input[f.key] * (1 + pct / 100));
    const vLo = runScreeningModel(id, { ...input, [f.key]: lo }).metrics[mi]?.value ?? 0, vHi = runScreeningModel(id, { ...input, [f.key]: hi }).metrics[mi]?.value ?? 0;
    return { key: f.key, label: f.label, lo, hi, vLo, vHi, swing: Math.abs(vHi - vLo) };
  }).sort((a, b) => b.swing - a.swing);
  return { base, pct, mi, rows };
}

// RNG có seed (mulberry32) để kết quả Monte Carlo tái lập được
function rngSeed(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function monteCarlo(id, input, pct, N, mi, seed = 2026) {
  N = Math.max(10, Math.min(5000, Math.round(N)));
  const R = rngSeed(seed), fields = (SCENARIO_INPUTS[id] || []).filter((f) => f.kind !== 'limit');
  const vals = [], count = { PASS: 0, WARNING: 0, FAIL: 0 };
  for (let k = 0; k < N; k++) {
    const inp = { ...input };
    fields.forEach((f) => { inp[f.key] = clampF(f, input[f.key] * (1 + (R() * 2 - 1) * pct / 100)); if (f.step >= 1) inp[f.key] = Math.round(inp[f.key]); });
    const r = runScreeningModel(id, inp);
    vals.push(r.metrics[mi]?.value ?? 0);
    count[r.status] = (count[r.status] || 0) + 1;
  }
  const sorted = [...vals].sort((a, b) => a - b), q = (p) => sorted[Math.min(N - 1, Math.floor(p * N))];
  const lo = sorted[0], hi = sorted[N - 1], B = 20, w = (hi - lo) / B || 1;
  const hist = Array.from({ length: B }, (_, b) => ({ x0: lo + b * w, x1: lo + (b + 1) * w, n: 0 }));
  vals.forEach((v) => { hist[Math.min(B - 1, Math.floor((v - lo) / w))].n++; });
  return { N, pct, mi, count, pFail: count.FAIL / N, pWarn: count.WARNING / N, mean: vals.reduce((s, v) => s + v, 0) / N, p05: q(0.05), p50: q(0.5), p95: q(0.95), hist, limit: runScreeningModel(id, input).metrics[mi]?.limit || null };
}

// Bộ ca kiểm thử định sẵn: tải/hình học tăng (up) hoặc khả năng giảm (down)
const STRESS = {
  'BR-01': { up: ['vehicles', 'axleLoad', 'impactFactor'], down: ['duration', 'clearance', 'spans'] },
  'BR-02': { up: ['grossMass', 'braking', 'laneOffset', 'impactFactor'], down: [] },
  'BR-03': { up: ['axleLoad', 'cycles', 'growth'], down: ['detailClass'] },
  'BR-04': { up: ['windSpeed', 'tempDelta', 'gustFactor'], down: ['spans'] },
  'BR-05': { up: ['waterVelocity', 'returnPeriod', 'pierWidth'], down: ['foundationDepth'] },
  'BD-01': { up: ['occupants', 'personLoad', 'dynamicFactor'], down: ['area'] },
  'BD-02': { up: ['windSpeed', 'terrainFactor'], down: ['stiffness'] },
  'BD-03': { up: ['pga', 'responseFactor', 'importance'], down: ['behaviorFactor'] },
  'BD-04': { up: ['occupants', 'travelDistance', 'preMovement'], down: ['exitWidth', 'walkSpeed', 'flowRate'] },
  'BD-05': { up: ['damagedColumns', 'loadRatio', 'dynamicAmplification'], down: ['redundancy', 'alternatePaths'] },
  'TU-01': { up: ['inflow', 'duration'], down: ['pumpCapacity', 'pumpAvailability', 'storage'] },
  'TU-02': { up: ['excavationDepth', 'groundwater'], down: ['soilModulus', 'wallFactor', 'distanceToBuilding'] },
  'CS-01': { up: ['radiusA', 'radiusB', 'overlapTime', 'windOp'], down: ['craneDistance', 'verticalSeparation'] },
  'CS-02': { up: ['stockMass', 'dynamicFactor'], down: ['stockArea', 'allowedLoad'] },
  'RD-01': { up: ['trucksPerDay', 'axleLoad', 'years', 'growth'], down: [] },
  'RD-02': { up: ['rainfall', 'slope'], down: ['drainage', 'soilStrength', 'vegetation'] },
  'HY-01': { up: ['inflow', 'duration'], down: ['outflow', 'reservoirArea', 'crestMargin'] },
  'UR-01': { up: ['rain', 'tide', 'hours', 'returnPeriod', 'seaLevelRise'], down: ['drain', 'lowGround'] },
  'IN-01': { up: ['unbalanceForce'], down: ['damping', 'stiffness'] },
};
const CASE_LEVELS = [['TT', 'Thông thường', 1], ['BL', 'Bất lợi', 1.15], ['CD', 'Cực đoan', 1.5], ['BD', 'Biên dưới', 0.6]];
export function presetCases(id) {
  const base = scenarioDefaults(id), s = STRESS[id] || { up: [], down: [] };
  return CASE_LEVELS.map(([code, name, k]) => {
    const input = { ...base };
    if (k !== 1) {
      s.up.forEach((key) => { const f = fieldOf(id, key); if (f) input[key] = round(clampF(f, base[key] === 0 ? (f.max - f.min) * (k - 1) / 4 : base[key] * k), 4); });
      s.down.forEach((key) => { const f = fieldOf(id, key); if (f) input[key] = round(clampF(f, base[key] / k), 4); });
      (SCENARIO_INPUTS[id] || []).forEach((f) => { if (f.step >= 1 && f.kind !== 'limit') input[f.key] = Math.round(input[f.key]); });
    }
    return { id: `${id}-${code}`, name, preset: true, input };
  });
}
export function runCases(id, cases) {
  return cases.map((c) => { const r = runScreeningModel(id, c.input); return { ...c, status: r.status, metrics: r.metrics }; });
}
