// Dữ liệu cấu hình cho PoC. Mọi kết quả kỹ thuật trong file này đều là dữ liệu
// tham chiếu/minh họa, không phải đầu ra của một bộ giải chuyên ngành.

export const TRUST_LEVELS = {
  L0: { label: 'L0 · Minh họa trực quan', tone: 'orange', note: 'Không đưa ra kết luận kỹ thuật.' },
  L1: { label: 'L1 · Tính toán sơ bộ', tone: 'blue', note: 'Chỉ dùng sàng lọc phương án; giả định phải được truy vết.' },
  L2: { label: 'L2 · Mô phỏng có bộ giải', tone: 'violet', note: 'Cần mô hình tính, điều kiện biên, solver và hồ sơ V&V.' },
  L3: { label: 'L3 · Đã được xem xét/xác nhận', tone: 'green', note: 'Cần kỹ sư có thẩm quyền phê duyệt; không thay thế kiểm định.' },
};

export const SAMPLE_DATASETS = [
  {
    id: 'DS-IFC-001', name: 'CongTrinh_Mau_IFC4.ifc', type: 'BIM/IFC', source: 'Hồ sơ thiết kế mẫu',
    crs: 'Hệ trục công trình cục bộ · m', size: '18,4 MB', status: 'VALIDATED', version: 'D1.0',
    hash: 'sha256:8f3a…91c2', quality: 'GlobalId 100% · vật liệu 96% · QTO 94%', license: 'Nội bộ dự án',
  },
  {
    id: 'DS-DEM-001', name: 'DiaHinh_Mau_VN2000.tif', type: 'DEM/GeoTIFF', source: 'Đo địa hình mặt đất',
    crs: 'VN-2000 / TM-3 106-15 · m', size: '42,7 MB', status: 'VALIDATED', version: 'D1.0',
    hash: 'sha256:27bd…c014', quality: 'NoData 0,3% · lưới 1 m · datum đã khai báo', license: 'Nội bộ dự án',
  },
  {
    id: 'DS-PC-001', name: 'HienTrang_TLS.laz', type: 'Point cloud/LAZ', source: 'Máy quét laser mặt đất (TLS)',
    crs: 'VN-2000 / TM-3 106-15 · m', size: '286 MB', status: 'VALIDATED', version: 'D1.0',
    hash: 'sha256:5aa1…ee70', quality: 'Mật độ 320 điểm/m² · 2 vùng che khuất', license: 'Nội bộ dự án',
  },
];

export const SCENARIO_LIBRARY = [
  ['BR-01', 'Cầu đường bộ', '500 xe qua cầu / 500 xe đồng thời', 'Giao thông + kết cấu'],
  ['BR-02', 'Cầu', 'Xe quá tải, ùn tắc, phanh gấp, đổi làn', 'Giao thông + kết cấu'],
  ['BR-03', 'Cầu', 'Tải lặp, mỏi kết cấu', 'Mỏi kết cấu'],
  ['BR-04', 'Cầu', 'Gió mạnh, biến thiên nhiệt độ, rung', 'Khí động + kết cấu'],
  ['BR-05', 'Cầu qua sông', 'Lũ, xói trụ, vật trôi va chạm', 'Thủy lực + địa kỹ thuật'],
  ['BD-01', 'Nhà cao tầng', 'Tập trung đông người', 'Kết cấu'],
  ['BD-02', 'Nhà cao tầng', 'Gió giật, dao động tòa nhà', 'CFD + kết cấu'],
  ['BD-03', 'Nhà cao tầng', 'Động đất', 'Động lực học kết cấu'],
  ['BD-04', 'Nhà/công trình công cộng', 'Cháy, lan khói, thoát nạn', 'PCCC + CFD + thoát nạn'],
  ['BD-05', 'Nhà/kết cấu', 'Hư hỏng dầm/cột/liên kết cục bộ', 'Kết cấu phi tuyến'],
  ['TU-01', 'Hầm/tầng hầm', 'Mưa lớn, bơm hỏng, nước tràn', 'Thủy lực'],
  ['TU-02', 'Hầm đào/metro', 'Lún và biến dạng khi thi công đào', 'Địa kỹ thuật'],
  ['CS-01', 'Công trường', 'Xung đột hai cẩu tháp và tải treo', '4D + kiểm tra hình học'],
  ['CS-02', 'Công trường', 'Chất vật liệu tập trung lên sàn/chống tạm', 'Thi công + kết cấu'],
  ['RD-01', 'Đường bộ', 'Tăng đột biến lưu lượng xe nặng', 'Giao thông + áo đường'],
  ['RD-02', 'Đường/ta-luy', 'Mưa kéo dài, trượt mái dốc', 'Địa kỹ thuật + thủy văn'],
  ['HY-01', 'Đập/hồ chứa', 'Lũ lớn, mực nước dâng, xả lũ', 'Thủy văn + thủy lực'],
  ['IN-01', 'Nhà xưởng', 'Rung máy, thay thiết bị, tải mái', 'Dao động kết cấu'],
  ['UR-01', 'Đô thị / khu vực (MOD-00)', 'Mưa lớn + triều cường, ngập diện rộng nhiều công trình', 'Thủy văn + thủy lực 2D khu vực'],
].map(([id, asset, title, solver]) => ({
  id, asset, title, solver,
  support: id === 'BR-01' ? 'L0_L1_INTERACTIVE' : 'L1_SCREENING',
  version: 'S1.0',
}));

export const QTO_ROWS = [
  { code: 'BT-C30', material: 'Bê tông C30/37', unit: 'm³', qty: 12840, waste: 0.02, price: 1420000, source: 'IfcSlab/IfcBeam · 1.284 GlobalId' },
  { code: 'THEP-CB400', material: 'Thép cốt bê tông CB400-V', unit: 'tấn', qty: 1860, waste: 0.035, price: 15800000, source: 'IfcReinforcingBar · 8.442 GlobalId' },
  { code: 'GACH-AAC', material: 'Gạch bê tông khí AAC', unit: 'm³', qty: 3240, waste: 0.04, price: 1180000, source: 'IfcWall · 2.106 GlobalId' },
  { code: 'KINH-ELOW', material: 'Kính Low-E hộp', unit: 'm²', qty: 6760, waste: 0.025, price: 1650000, source: 'IfcCurtainWall · 912 GlobalId' },
];

export const MATERIAL_VARIANTS = {
  A: { label: 'A · Thiết kế cơ sở', qty: 1, price: 1, delay: 0, note: 'Baseline khóa · giá/hao hụt/nguồn cung mẫu' },
  B: { label: 'B · Tối ưu vật liệu/thi công', qty: 0.96, price: 0.98, delay: -9, note: 'Chỉ trong miền thông số chuyên gia cho phép · chưa xác nhận kết cấu' },
  C: { label: 'C · Bất lợi', qty: 1, price: 1.12, delay: 24, note: 'Giao thép trễ 21 ngày · năng suất giảm · dự báo, không sửa baseline' },
};
