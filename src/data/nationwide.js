// =====================================================================
// MOD-00 · Dữ liệu nền tảng Bản đồ 3D toàn quốc (tham chiếu e-City)
// Danh mục/tenant/dự án là DỮ LIỆU MÔ PHỎNG cho demo/PoC; nền 02 cảnh mẫu dùng GIS thật (OSM, DEM, ảnh Esri). Nguyên tắc e-City: số liệu
// nào cũng kèm nguồn/thời điểm/giấy phép; thiếu nguồn → "Chưa có".
// =====================================================================

export const DATASET_VERSION = 'VN-2026.11-r2'; // r2: nền GIS thật (OSM + DEM + ảnh vệ tinh Esri) cho 02 cảnh mẫu
export const NA = 'Chưa có';

// 34 tỉnh, thành phố trực thuộc Trung ương (mô hình chính quyền 2 cấp từ 01/7/2025).
// Tọa độ tâm là gần đúng để hiển thị; số ĐVHC cấp xã chỉ ghi khi demo có nguồn.
export const TENANTS = [
  ['ha-noi', 'Hà Nội', 'TP', 105.85, 21.03], ['hue', 'Huế', 'TP', 107.58, 16.46], ['hai-phong', 'Hải Phòng', 'TP', 106.68, 20.86],
  ['da-nang', 'Đà Nẵng', 'TP', 108.05, 15.75], ['hcm', 'TP. Hồ Chí Minh', 'TP', 106.7, 10.85], ['can-tho', 'Cần Thơ', 'TP', 105.78, 9.9],
  ['cao-bang', 'Cao Bằng', 'T', 106.25, 22.67], ['lai-chau', 'Lai Châu', 'T', 103.3, 22.3], ['dien-bien', 'Điện Biên', 'T', 103.0, 21.4],
  ['lang-son', 'Lạng Sơn', 'T', 106.76, 21.85], ['son-la', 'Sơn La', 'T', 103.9, 21.2], ['quang-ninh', 'Quảng Ninh', 'T', 107.3, 21.1],
  ['thanh-hoa', 'Thanh Hóa', 'T', 105.6, 19.9], ['nghe-an', 'Nghệ An', 'T', 104.9, 19.2], ['ha-tinh', 'Hà Tĩnh', 'T', 105.9, 18.35],
  ['tuyen-quang', 'Tuyên Quang', 'T', 105.1, 22.45], ['lao-cai', 'Lào Cai', 'T', 104.2, 21.95], ['thai-nguyen', 'Thái Nguyên', 'T', 105.85, 21.85],
  ['phu-tho', 'Phú Thọ', 'T', 105.2, 21.05], ['bac-ninh', 'Bắc Ninh', 'T', 106.3, 21.3], ['hung-yen', 'Hưng Yên', 'T', 106.25, 20.6],
  ['ninh-binh', 'Ninh Bình', 'T', 105.97, 20.2], ['quang-tri', 'Quảng Trị', 'T', 106.6, 17.3], ['quang-ngai', 'Quảng Ngãi', 'T', 108.2, 14.8],
  ['gia-lai', 'Gia Lai', 'T', 108.4, 14.0], ['khanh-hoa', 'Khánh Hòa', 'T', 109.0, 12.0], ['lam-dong', 'Lâm Đồng', 'T', 108.0, 11.6],
  ['dak-lak', 'Đắk Lắk', 'T', 108.6, 12.9], ['dong-nai', 'Đồng Nai', 'T', 107.0, 11.35], ['tay-ninh', 'Tây Ninh', 'T', 106.15, 10.95],
  ['vinh-long', 'Vĩnh Long', 'T', 106.25, 9.95], ['dong-thap', 'Đồng Tháp', 'T', 105.9, 10.4], ['ca-mau', 'Cà Mau', 'T', 105.15, 9.2],
  ['an-giang', 'An Giang', 'T', 105.1, 10.3],
].map(([id, name, kind, lon, lat]) => ({ id, name, kind, lon, lat, has3d: id === 'hcm' || id === 'dong-nai' }));

// Thông tin chi tiết của 02 tenant mẫu (D1 trong sổ tay).
export const TENANT_DETAIL = {
  hcm: {
    code: '79', seed: 79, communes: 168, communeNote: '113 phường · 54 xã · 1 đặc khu (theo e-City citywide-31; cần đối chiếu danh mục hiện hành)',
    buildingsTotal: '≈ 3,13 triệu mảnh ở zoom 14 (e-City citywide-31)', crs: 'VN-2000 · KTT 105°45′ · múi 3° (tham số theo tỉnh – cần xác minh)',
    focus: 'saigon', focusName: 'Khu trung tâm & Thủ Thiêm (cảnh 6 × 6 km, dữ liệu OSM thật)', terrain: 'flat', origin: [106.705, 10.776], waterLevel: 0.6,
    wards: ['Phường An Khánh', 'Phường Bàn Cờ', 'Phường Bến Thành', 'Phường Bình Thạnh', 'Phường Cầu Kiệu', 'Phường Cầu Ông Lãnh', 'Phường Chánh Hưng', 'Phường Chợ Quán', 'Phường Đức Nhuận', 'Phường Gia Định', 'Phường Hòa Hưng', 'Phường Khánh Hội',
      'Phường Nhiêu Lộc', 'Phường Phú Nhuận', 'Phường Sài Gòn', 'Phường Tân Định', 'Phường Tân Hưng', 'Phường Tân Thuận', 'Phường Thạnh Mỹ Tây', 'Phường Vĩnh Hội', 'Phường Vườn Lài', 'Phường Xóm Chiếu', 'Phường Xuân Hòa'],
    center: [0, 0],
  },
  'dong-nai': {
    code: '75', seed: 75, communes: 95, communeNote: '23 phường · 72 xã (cần đối chiếu danh mục ĐVHC sau sắp xếp 2025)',
    buildingsTotal: NA, crs: 'VN-2000 · KTT 107°45′ · múi 3° (tham số theo tỉnh – cần xác minh)',
    focus: 'bien-hoa', focusName: 'Trung tâm Biên Hòa (cảnh 6 × 6 km, dữ liệu OSM thật)', terrain: 'flat', origin: [106.825, 10.95], waterLevel: 0.6,
    wards: ['Phường Biên Hòa', 'Phường Tam Hiệp', 'Phường Tân Triều', 'Phường Trảng Dài', 'Phường Trấn Biên'],
    center: [0, 0],
  },
};

export const HEIGHT_SOURCES = {
  SRC: { label: 'Giá trị trong nguồn', color: '#2563eb', priority: 1 },
  FLOORS: { label: 'Số tầng × 3,3 m', color: '#16a34a', priority: 2 },
  IMG: { label: 'Suy luận ảnh (ghi năm mẫu)', color: '#f59e0b', priority: 3 },
  PRIOR: { label: 'Ước lượng vùng – diện tích – giả định', color: '#a855f7', priority: 4 },
  NONE: { label: 'Thiếu / lỗi chiều cao', color: '#94a3b8', priority: 5 },
  PLAN: { label: 'Phương án biên tập (người dùng nhập)', color: '#e11d48', priority: 0 },
};

export const LOD_LEVELS = [
  ['LOD0', 'Địa hình + ảnh nền'], ['LOD1', 'Khối nhà = mặt bằng × chiều cao'], ['LOD2', 'Mái/khối chi tiết (ảnh nghiêng, mẫu đủ điều kiện)'], ['LOD3', 'BIM/drone (MOD-01/MOD-03)'],
];

// 9 nhóm chức năng (thanh bên) theo e-City
export const GROUPS = [
  ['ops', '🛰️', 'Điều hành'], ['plan', '🗺️', 'Quy hoạch'], ['edit', '🛠️', 'Biên tập'], ['svc', '🏥', 'Dịch vụ'], ['future', '🚄', 'Tương lai'], ['region', '🧩', 'Vùng'],
  ['area', '📍', 'Khu vực'], ['tour', '🎥', 'Tham quan'], ['analysis', '📊', 'Phân tích'], ['data', '🗂️', 'Dữ liệu'],
];

// Registry nguồn — các trường bắt buộc theo SRS 2.0 (mục 2.0, MOD-00)
const src = (id, scope, theme, name, provider, coverage, srcSampling, dispSampling, observed, session, licence, redistribution, attribution, verify, status, tenant = '*') =>
  ({ id, scope, theme, name, provider, coverage, srcSampling, dispSampling, observed, session, licence, redistribution, attribution, verify, status, tenant });
export const SOURCES = [
  src('S-ADM-01', 'Nguồn nền', 'Địa giới', 'Địa giới & danh mục ĐVHC sau sắp xếp 2025', 'Cơ quan quản lý nhà nước (nền địa lý quốc gia)', '34 tỉnh/thành · cấp xã', 'Vector', 'Vector', '07/2025', '—', 'Theo quy định đo đạc – bản đồ', 'Theo phân quyền', 'Cơ quan cung cấp', 'Polygon pháp lý chưa được cấp → hiển thị "Chưa lấy được polygon pháp lý"', 'chỉ metadata'),
  src('S-ADM-02', 'Nguồn nền', 'Địa giới', 'Ranh hành chính OSM (lớp tạm)', 'OpenStreetMap contributors', 'Toàn quốc (có thể gồm vùng biển)', 'Vector', 'Vector đơn giản hóa', '10/2026', 'osm-2026-10', 'ODbL 1.0', 'Có (share-alike)', '© OpenStreetMap contributors', 'Thay bằng ranh chính thức khi được cung cấp; tách đất liền/biển khi tính diện tích', 'xác thực'),
  src('S-BLD-01', 'Nguồn nền', 'Công trình', 'Mặt bằng công trình Overture Buildings (lớp tạm)', 'Overture Maps Foundation', 'Toàn quốc', 'Vector', 'LOD1 3D Tiles', '2026-Q3', 'ovt-2026-09', 'ODbL / CDLA (theo theme)', 'Có điều kiện', 'Overture Maps Foundation', 'Ưu tiên CSDL nhà ở/công trình của địa phương', 'xác thực'),
  src('S-BLD-02', 'Nguồn nền', 'Công trình', 'Open Buildings 2.5D (lớp tạm)', 'Google Research', 'Toàn quốc', 'Raster 4 m / vector', 'LOD1', '2023', 'ob-v3', 'CC BY 4.0 / ODbL [đối chiếu]', 'Có', 'Google Open Buildings', 'Chiều cao suy luận — ghi năm mẫu và độ phân tán', 'xác thực'),
  src('S-BLD-04', 'Nguồn nền', 'Công trình', 'Mặt bằng công trình OpenStreetMap (02 cảnh mẫu, đang dùng)', 'OpenStreetMap contributors · Overpass API', 'TP.HCM khu trung tâm + Thủ Thiêm; Biên Hòa (6 × 6 km mỗi cảnh)', 'Vector', 'LOD1 ép khối theo mặt bằng', '11/2026', 'osm-overpass-2026-11', 'ODbL 1.0', 'Có (share-alike)', '© OpenStreetMap contributors', 'Chiều cao: height → building:levels × 3,3 m → ước lượng theo loại + diện tích (ghi nhãn); ưu tiên CSDL địa phương khi có', 'xác thực'),
  src('S-IMG-02', 'Nguồn nền', 'Ảnh', 'Ảnh vệ tinh Esri World Imagery (nền hiển thị)', 'Esri, Maxar, Earthstar Geographics, GIS User Community', 'Toàn cầu', 'Tile Web Mercator (≈ 0,3–1 m đô thị)', 'z16 ≈ 2,3 m/px · z18 ≈ 0,6 m/px', 'Theo mosaic Esri (không công bố ngày theo pixel)', 'tải khi chạy', 'Điều khoản Esri (hiển thị, không đóng gói/tải xuống)', 'Không', 'Esri, Maxar, Earthstar Geographics', 'Chỉ dùng hiển thị nền; không dùng làm số liệu phân tích', 'xác thực'),
  src('S-IMG-03', 'Nguồn nền', 'Ảnh', 'Bản đồ nền Esri (đường phố, địa hình, nhãn)', 'Esri, HERE, Garmin, © OpenStreetMap contributors', 'Toàn cầu', 'Tile Web Mercator', 'z16–z18', 'Theo Esri', 'tải khi chạy', 'Điều khoản Esri', 'Không', 'Esri và đối tác', 'Chỉ hiển thị', 'xác thực'),
  src('S-DEM-03', 'Nguồn nền', 'Địa hình', 'AWS Terrain Tiles (Terrarium) — SRTM/NASADEM', 'Mapzen / AWS Open Data', '02 cảnh mẫu (lưới 50 m)', '≈ 30 m', 'Lưới 50 m, lọc trung vị 5×5', '2000 (SRTM)', 'terrarium-z13', 'Công khai (ghi nguồn)', 'Có', 'Mapzen, NASA SRTM', 'DSM — có thể gồm mái/cây; không dùng suy độ sâu ngập thực', 'xác thực'),
  src('S-LU-01', 'Nguồn nền', 'Quy hoạch', 'Hiện trạng sử dụng đất OpenStreetMap (landuse/leisure/amenity)', 'OpenStreetMap contributors', '02 cảnh mẫu (lưới 20 m)', 'Vector', 'Raster 20 m', '11/2026', 'osm-overpass-2026-11', 'ODbL 1.0', 'Có (share-alike)', '© OpenStreetMap contributors', 'Chỉ là hiện trạng do cộng đồng gắn nhãn — không phải bản đồ quy hoạch', 'xác thực'),
  src('S-QH-01', 'Chiến dịch', 'Quy hoạch', 'Ô quy hoạch & chỉ tiêu (MÔ PHỎNG cho demo)', 'Nền tảng (sinh từ S-LU-01 + mật độ công trình)', '02 cảnh mẫu · lưới ≈ 300 m', 'Ô ≈ 9 ha', 'Lớp phủ dán địa hình', '11/2026', 'zones-sim-1', 'Nội bộ', 'Không', 'Mô phỏng', 'Thay bằng đồ án QHPK/QHCT được duyệt đã số hóa (TL-02, TL-05) khi có', 'chỉ metadata'),
  src('S-BLD-03', 'Chiến dịch', 'Công trình', 'CSDL nhà ở/công trình của địa phương', 'Sở Xây dựng (tenant)', NA, NA, NA, NA, '—', 'Theo thỏa thuận', 'Không', 'Sở Xây dựng', 'Chưa kết nối — KPI hiển thị "Chưa có"', 'rỗng'),
  src('S-DEM-01', 'Nguồn nền', 'Địa hình', 'Copernicus DEM GLO-30 (lớp tạm)', 'ESA / Copernicus', 'Toàn cầu', '30 m', 'Terrain quantized-mesh', '2011–2015', 'glo30-2021', 'Copernicus DEM licence', 'Có điều kiện', '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018', 'Là DSM — gồm mái/cây, KHÔNG phải DTM; không dùng suy độ sâu ngập', 'xác thực'),
  src('S-DEM-02', 'Nguồn nền', 'Địa hình', 'DEM/DTM quốc gia', 'Cơ quan đo đạc bản đồ', 'Toàn quốc', NA, NA, NA, '—', 'Dữ liệu hạn chế theo Luật Đo đạc và bản đồ 2018, NĐ 27/2019', 'Không', '—', 'Chỉ hiển thị theo phân quyền; nhật ký truy cập bắt buộc', 'chỉ metadata'),
  src('S-IMG-01', 'Nguồn nền', 'Ảnh', 'Sentinel-2 L2A (lọc mây SCL)', 'ESA / Copernicus', 'Toàn quốc', '10 m', 'COG 10 m', '01/09–31/10/2026', 's2-2026-10', 'Copernicus open licence', 'Có', 'Contains modified Copernicus Sentinel data 2026', 'Cập nhật có kiểm soát: chỉ thay pixel đạt ngưỡng mây + vùng đệm', 'xác thực'),
  src('S-WAT-01', 'Nguồn nền', 'Thủy hệ', 'Thủy hệ nguồn mở', 'OpenStreetMap contributors', 'Toàn quốc', 'Vector', 'Vector', '10/2026', 'osm-2026-10', 'ODbL 1.0', 'Có', '© OpenStreetMap contributors', 'Không thay thế bản đồ thủy văn chính thức', 'xác thực'),
  src('S-WAT-02', 'Nguồn nền', 'Thủy hệ', 'Nước lịch sử JRC 1984–2024', 'EC Joint Research Centre', 'Toàn cầu', '30 m', '30 m', '1984–2024', 'gsw', 'CC BY 4.0', 'Có', 'EC JRC / Google', 'Tần suất có nước LỊCH SỬ — không phải ngập hiện tại', 'xác thực'),
  src('S-LC-01', 'Nguồn nền', 'Lớp phủ', 'ESA WorldCover 10 m', 'ESA', 'Toàn cầu', '10 m', '10 m', '2021', 'v200', 'CC BY 4.0', 'Có', '© ESA WorldCover project', 'Phân loại lớp phủ mức khu vực', 'xác thực'),
  src('S-PLN-01', 'Chiến dịch', 'Quy hoạch', 'Quy hoạch công bố (cổng thông tin quy hoạch)', 'Sở Xây dựng / Sở Quy hoạch (tenant)', 'Tenant', 'PDF/ảnh', 'Liên kết', '2026', '—', 'Công bố công khai', 'Hạn chế', 'Cơ quan công bố', 'Chỉ phủ lên 3D khi đã georeference và kiểm định', 'chỉ metadata'),
  src('S-PLN-02', 'Chiến dịch', 'Quy hoạch', 'GIS quy hoạch · thửa đất · QHPK 1/2000', 'Sở Nông nghiệp và Môi trường (tenant)', 'Tenant', 'WMS/WFS', NA, NA, '—', 'Theo thỏa thuận', 'Không', '—', 'Dịch vụ trả HEAD 200 nhưng chưa đọc được lớp', 'chưa đọc được'),
  src('S-OPN-01', 'Chiến dịch', 'Dữ liệu mở', 'Cổng dữ liệu mở địa phương', 'UBND tỉnh (tenant)', 'Tenant', 'CSV/JSON', NA, NA, '—', 'Giấy phép dữ liệu mở', 'Có', 'UBND tỉnh', 'Bộ dữ liệu rỗng tại thời điểm khảo sát', 'rỗng'),
  src('S-ENV-01', 'Chiến dịch', 'Môi trường', 'Geoportal TN&MT (WMS)', 'Sở Nông nghiệp và Môi trường', 'Tenant', 'WMS', NA, NA, '—', '—', 'Không', '—', 'GetCapabilities sai cấu trúc', 'sai cấu trúc'),
  src('S-ENV-02', 'Chiến dịch', 'Môi trường', 'Giấy phép môi trường – quan trắc', 'Sở Nông nghiệp và Môi trường', 'Tenant', NA, NA, NA, '—', '—', 'Không', '—', 'Chưa kết nối', 'rỗng'),
  src('S-TRF-01', 'Chiến dịch', 'Giao thông', 'Giao thông – công trường – đường thủy', 'Sở Xây dựng (tenant)', 'Tenant', NA, NA, NA, '—', '—', 'Không', '—', 'Chưa kết nối', 'rỗng'),
  src('S-HYD-01', 'Chiến dịch', 'Ngập', 'Mưa – triều – vận hành công trình – ngập', 'Đài KTTV khu vực / Trung tâm chống ngập (tenant)', 'Tenant', 'Trạm', NA, NA, '—', '—', 'Không', '—', 'Chưa kết nối — lớp "Mưa · triều · ngập" dùng kết quả MOD-02 (L1) và gắn nhãn', 'rỗng'),
  src('S-STAT-01', 'Chiến dịch', 'Thống kê', 'Niên giám thống kê (dân cư, kinh tế, ngân sách)', 'Cục/Chi cục Thống kê (tenant)', 'Tenant', 'Bảng', NA, NA, '—', '—', 'Có', 'Cơ quan thống kê', 'Chưa nạp — dashboard hiển thị "Chưa có"', 'rỗng'),
  src('S-FAC-01', 'Chiến dịch', 'Cơ sở', 'Danh mục trường học, trạm y tế, điểm dịch vụ', 'Sở GD&ĐT / Sở Y tế (tenant)', 'Tenant', 'Bảng địa chỉ', 'Điểm', '2026', 'fac-2026-q3', 'Công bố', 'Có điều kiện', 'Cơ quan công bố', 'Một phần chưa có tọa độ hoặc quy mô có kỳ → hàng đợi xác minh', 'xác thực'),
  src('S-PRJ-01', 'Chiến dịch', 'Dự án', 'Dữ liệu Digital Twin dự án (MOD-01/MOD-03)', 'Ban QLDA (nội bộ)', 'Khu đất dự án', 'Mây điểm 320 đ/m² · DEM 1 m', 'LOD3', 'Theo đợt bay/quét', 'dataVersion', 'Nội bộ dự án', 'Không', 'Ban QLDA', 'CRS gốc phải khai báo trước khi ghép', 'xác thực'),
];

// Registry tài liệu quy hoạch (tab "Tài liệu") — tài liệu mẫu, số hiệu là placeholder
export const PLAN_DOCS = [
  { id: 'TL-01', tenant: 'hcm', title: 'Đồ án quy hoạch chung đô thị (tài liệu tham khảo)', no: 'Số …/QĐ-TTg (mẫu)', date: NA, geometry: 'Chưa georeference', signature: 'Bản scan có chữ ký', rights: 'Tham khảo', validity: 'Cần MOD-05 kiểm tra', head: 'HEAD 200', overlay: false },
  { id: 'TL-02', tenant: 'hcm', title: 'QHPK 1/2000 khu trung tâm (mẫu)', no: 'Số …/QĐ-UBND (mẫu)', date: NA, geometry: 'Đã georeference · đã kiểm định', signature: 'Chữ ký số hợp lệ', rights: 'Được phép phủ 3D', validity: 'Còn hiệu lực (mẫu)', head: 'HEAD 200', overlay: true },
  { id: 'TL-03', tenant: 'hcm', title: 'Quy chế quản lý kiến trúc (mẫu)', no: 'Số …/QĐ-UBND (mẫu)', date: NA, geometry: 'Không có hình học', signature: '—', rights: 'Tham khảo', validity: 'Cần MOD-05 kiểm tra', head: 'Sai cấu trúc', overlay: false },
  { id: 'TL-04', tenant: 'dong-nai', title: 'Quy hoạch tỉnh thời kỳ 2021–2030 (tài liệu tham khảo)', no: 'Số …/QĐ-TTg (mẫu)', date: NA, geometry: 'Chưa georeference', signature: 'Bản scan', rights: 'Tham khảo', validity: 'Cần MOD-05 kiểm tra', head: 'HEAD 200', overlay: false },
  { id: 'TL-05', tenant: 'dong-nai', title: 'QHPK 1/2000 khu vực Trấn Biên (mẫu)', no: 'Số …/QĐ-UBND (mẫu)', date: NA, geometry: 'Đã georeference · đã kiểm định', signature: 'Chữ ký số hợp lệ', rights: 'Được phép phủ 3D', validity: 'Còn hiệu lực (mẫu)', head: 'HEAD 200', overlay: true },
  { id: 'TL-06', tenant: 'dong-nai', title: 'Quyết định công bố đơn giá xây dựng (mẫu)', no: 'Số …/QĐ-UBND (mẫu)', date: NA, geometry: 'Không có hình học', signature: '—', rights: 'Dùng cho MOD-04', validity: 'Cần MOD-05 kiểm tra', head: 'Chưa đọc được', overlay: false },
  { id: 'TL-07', tenant: 'dong-nai', title: 'Công bố giá vật liệu xây dựng quý III/2026 (mẫu)', no: 'Số …/SXD-KTXD (mẫu)', date: NA, geometry: 'Không có hình học', signature: '—', rights: 'Dùng cho MOD-04', validity: 'Cần MOD-05 kiểm tra', head: 'HEAD 200', overlay: false },
];

// Danh mục dự án của AIPM OS trên bản đồ (dữ liệu mô phỏng; DA-2026-017 lấy trạng thái thật từ store)
export const PROJECTS = [
  { id: 'DA-2026-017', name: 'Khu dân cư sinh thái Phân khu A (thí điểm)', tenant: 'dong-nai', ward: 'Phường Trấn Biên', x: 900, z: -600, gate: 'live', group: 'B', risk: { schedule: 0, flood: 1, material: 1 }, live: true },
  { id: 'DA-2026-031', name: 'Cầu BR-01 – mô hình kiểm thử Digital Twin', tenant: 'hcm', ward: 'Phường An Khánh', x: 0, z: 200, gate: 'G9', group: 'A', risk: { schedule: 1, flood: 1, material: 0 }, bridge: true },
  { id: 'DA-2026-008', name: 'Trường học liên cấp (mẫu)', tenant: 'hcm', ward: 'Phường Bàn Cờ', x: -1300, z: 900, gate: 'G5', group: 'C', risk: { schedule: 0, flood: 0, material: 0 } },
  { id: 'DA-2026-012', name: 'Trạm bơm chống ngập (mẫu)', tenant: 'hcm', ward: 'Phường Khánh Hội', x: 2000, z: 2200, gate: 'G12', group: 'B', risk: { schedule: 2, flood: 2, material: 1 } },
  { id: 'DA-2026-020', name: 'Đường trục kết nối KCN (mẫu)', tenant: 'dong-nai', ward: 'Phường Tam Hiệp', x: -600, z: 400, gate: 'G10', group: 'B', risk: { schedule: 1, flood: 0, material: 2 } },
  { id: 'DA-2026-002', name: 'Bệnh viện đa khoa khu vực (mẫu)', tenant: 'ha-noi', gate: 'G7', group: 'A', risk: { schedule: 1, flood: 0, material: 1 } },
  { id: 'DA-2026-004', name: 'Kè chống sạt lở (mẫu)', tenant: 'can-tho', gate: 'G12', group: 'B', risk: { schedule: 2, flood: 2, material: 0 } },
  { id: 'DA-2026-005', name: 'Cải tạo hồ điều hòa (mẫu)', tenant: 'hue', gate: 'G3', group: 'C', risk: { schedule: 0, flood: 1, material: 0 } },
  { id: 'DA-2026-006', name: 'Cầu vượt nút giao (mẫu)', tenant: 'da-nang', gate: 'G11', group: 'B', risk: { schedule: 1, flood: 0, material: 1 } },
  { id: 'DA-2026-009', name: 'Trụ sở hành chính tập trung (mẫu)', tenant: 'thanh-hoa', gate: 'G1', group: 'B', risk: { schedule: 0, flood: 0, material: 0 } },
  { id: 'DA-2026-010', name: 'Hạ tầng KCN sinh thái (mẫu)', tenant: 'hai-phong', gate: 'G8', group: 'A', risk: { schedule: 2, flood: 1, material: 1 } },
  { id: 'DA-2026-014', name: 'Đường ven biển (mẫu)', tenant: 'quang-ngai', gate: 'G4', group: 'B', risk: { schedule: 1, flood: 1, material: 0 } },
  { id: 'DA-2026-015', name: 'Nhà ở xã hội (mẫu)', tenant: 'bac-ninh', gate: 'G14', group: 'C', risk: { schedule: 0, flood: 0, material: 1 } },
  { id: 'DA-2026-019', name: 'Hồ chứa nước (mẫu)', tenant: 'dak-lak', gate: 'G6', group: 'B', risk: { schedule: 1, flood: 2, material: 0 } },
];

// Nhóm "Tương lai": danh mục dự án hạ tầng liên vùng/đô thị (tên mẫu, số liệu mô phỏng)
export const FUTURE = [
  { id: 'TL-NET', cat: 'Toàn mạng', name: 'Mạng hạ tầng liên vùng phía Nam (hồ sơ mẹ – mẫu)', parent: null, milestone: '12/2030', progress: 18, lateRisk: 2, execRatio: 0.21, tenant: 'hcm', passedMilestone: false },
  { id: 'TL-AIR', cat: 'Hàng không', name: 'Cảng hàng không khu vực (mẫu)', parent: 'TL-NET', milestone: '06/2026', progress: 72, lateRisk: 1, execRatio: 0.68, tenant: 'dong-nai', passedMilestone: true },
  { id: 'TL-RD1', cat: 'Đường bộ', name: 'Vành đai đô thị – đoạn mẫu 1', parent: 'TL-NET', milestone: '09/2026', progress: 64, lateRisk: 2, execRatio: 0.55, tenant: 'hcm', passedMilestone: true },
  { id: 'TL-RD2', cat: 'Đường bộ', name: 'Cao tốc liên vùng – đoạn mẫu 2', parent: 'TL-NET', milestone: '12/2027', progress: 35, lateRisk: 0, execRatio: 0.33, tenant: 'dong-nai', passedMilestone: false },
  { id: 'TL-RL1', cat: 'Đường sắt', name: 'Đường sắt đô thị – tuyến mẫu', parent: 'TL-NET', milestone: '12/2029', progress: 12, lateRisk: 1, execRatio: 0.1, tenant: 'hcm', passedMilestone: false },
  { id: 'TL-PRT', cat: 'Cảng – logistics', name: 'Cảng – trung tâm logistics ven sông (mẫu)', parent: 'TL-NET', milestone: '03/2028', progress: 27, lateRisk: 1, execRatio: 0.24, tenant: 'dong-nai', passedMilestone: false },
];

// Ánh xạ 7 làn BPMN → cơ quan theo chính quyền địa phương 2 cấp & NĐ 217/2026 (cấu hình theo tenant)
// SLA là giá trị cấu hình demo — cần xác minh thời hạn pháp định trước khi dùng thật.
export function agencyMap(tenantId) {
  const t = TENANTS.find((x) => x.id === tenantId) || TENANTS.find((x) => x.id === 'dong-nai');
  const pre = t.kind === 'TP' ? 'TP. ' : 'tỉnh ';
  const nm = t.name.replace(/^TP\. /, '');
  return [
    { lane: 'CDT', agency: 'Chủ đầu tư / Ban QLDA', basis: '—', sla: 7 },
    { lane: 'SXD', agency: `Sở Xây dựng ${pre}${nm} (hoặc Bộ Xây dựng/UBND cấp xã theo phân cấp)`, basis: 'NĐ 217/2026/NĐ-CP — thẩm quyền thẩm định', sla: 20 },
    { lane: 'MT', agency: `Sở Nông nghiệp và Môi trường ${pre}${nm}`, basis: 'Đất đai, môi trường', sla: 15 },
    { lane: 'PCCC', agency: `Công an ${pre}${nm} (PCCC & CNCH)`, basis: 'Thẩm duyệt PCCC', sla: 15 },
    { lane: 'TV', agency: 'Đơn vị tư vấn', basis: 'Hợp đồng tư vấn', sla: 10 },
    { lane: 'UB', agency: `UBND ${pre}${nm} (cấp tỉnh) / UBND cấp xã nơi có dự án`, basis: 'Theo thẩm quyền 2 cấp', sla: 15 },
    { lane: 'NT', agency: 'Nhà thầu', basis: 'Hợp đồng xây dựng', sla: 7 },
  ];
}

// Phép chiếu đơn giản lon/lat ↔ hệ cảnh quốc gia (đơn vị cảnh) và cảnh tỉnh (mét cục bộ)
export const natXY = (lon, lat) => [(lon - 106) * 108, -(lat - 16) * 111];
const originOf = (tenantId) => { const d = TENANT_DETAIL[tenantId]; if (d?.origin) return d.origin; const t = TENANTS.find((q) => q.id === tenantId); return [t.lon, t.lat]; };
export function localToLonLat(tenantId, x, z) {
  const [lon0, lat0] = originOf(tenantId);
  return [lon0 + x / (111320 * Math.cos((lat0 * Math.PI) / 180)), lat0 - z / 110540];
}
export function lonLatToLocal(tenantId, lon, lat) {
  const [lon0, lat0] = originOf(tenantId);
  return [(lon - lon0) * 111320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110540];
}

// Đường bao lãnh thổ minh họa (lon, lat) — KHÔNG phải ranh giới pháp lý
export const VN_OUTLINE = [
  [102.14, 22.4], [102.6, 22.75], [103.3, 22.8], [104.0, 22.55], [104.8, 22.85], [105.35, 23.3], [106.1, 22.98], [106.75, 22.85], [107.35, 22.6], [108.05, 21.55],
  [107.4, 21.25], [106.75, 20.75], [106.55, 20.2], [105.95, 19.65], [105.75, 18.95], [106.45, 18.1], [107.0, 17.25], [107.75, 16.55], [108.25, 16.05], [108.85, 15.35],
  [109.2, 13.9], [109.45, 12.6], [109.2, 11.6], [108.55, 11.1], [107.6, 10.55], [106.75, 10.3], [106.6, 9.65], [105.85, 9.1], [105.1, 8.6], [104.75, 8.65],
  [104.85, 9.6], [104.55, 10.4], [105.1, 10.95], [106.15, 11.05], [106.45, 11.7], [107.5, 12.3], [107.55, 13.5], [107.45, 14.5], [107.65, 15.35], [107.25, 15.95],
  [106.65, 16.45], [106.0, 17.35], [105.6, 18.2], [104.95, 18.75], [103.95, 19.25], [104.6, 19.85], [104.1, 20.15], [103.2, 20.6], [102.85, 21.2], [102.2, 21.0],
];
export const ISLANDS = [
  { name: 'Quần đảo Hoàng Sa', lon: 112.0, lat: 16.5 },
  { name: 'Quần đảo Trường Sa', lon: 114.2, lat: 10.0 },
  { name: 'Đặc khu Côn Đảo', lon: 106.6, lat: 8.7 },
  { name: 'Đặc khu Phú Quốc', lon: 103.95, lat: 10.25 },
];
