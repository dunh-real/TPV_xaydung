# README chạy thử — AIPM OS × AI Digital Twin (demo v2.0 toàn quốc)

Bản bàn giao: 06/11/2026 (đợt 2) · Dataset bản đồ: `VN-2026.11-r2` (OSM tải 05/11/2026) · Căn cứ: SRS v2.0 (04/11/2026) + yêu cầu bổ sung 06/11/2026

## 1. Cách nhanh nhất: mở file build sẵn
Mở `dist/index.html` bằng Chrome hoặc Edge (bấm đúp). Không cần cài đặt.
Đây là bản build một file (~3,7 MB, gồm dữ liệu OSM của 2 cảnh), đã qua 46/46 ca kiểm thử tự động.

**Cần Internet để hiện ảnh vệ tinh/bản đồ nền Esri.** Không có mạng thì demo vẫn chạy: bản đồ tự chuyển sang nền vẽ từ dữ liệu OSM và báo trên thanh trạng thái. Công trình, ranh phường, quy hoạch, biên tập vẫn dùng được ngoại tuyến.

Lưu ý:
- Trình duyệt phải bật WebGL (mặc định đều bật). Nếu bản đồ 3D để trống, kiểm tra cài đặt "Use hardware acceleration".
- Dữ liệu demo (dự án, hồ sơ, cổng, vùng quản lý…) lưu trong localStorage của trình duyệt, khóa `aipm-dt-demo-v3`. Muốn về trạng thái ban đầu: F12 → Application → Local Storage → xóa khóa này, rồi tải lại trang.

## 2. Chạy từ mã nguồn
Yêu cầu: Node.js 20 trở lên.

```powershell
npm.cmd install
npm.cmd run dev        # máy chủ phát triển, mở http://localhost:5173
npm.cmd run build      # tạo lại dist/index.html
```

(Dùng `npm.cmd` trong PowerShell để tránh bị chặn bởi chính sách chạy script `npm.ps1`.)

## 3. Link nhanh khi trình diễn
Gắn sau đường dẫn của trang (`dist/index.html` hoặc `http://localhost:5173/`):

| Mục đích | Hash |
|---|---|
| Bản đồ toàn quốc | `#map` |
| TP.HCM, chọn sẵn cầu BR-01 | `#map?v=VN-2026.11-r2&focus=hcm&view=province&sel=BR-01` |
| Đồng Nai, ban đêm, chọn dự án thí điểm | `#map?focus=dong-nai&view=province&mode=night&sel=DA-2026-017` |
| Chọn nền bản đồ | thêm `&bm=hybrid` (vệ tinh + nhãn), `street`, `topo`, `offline` |
| Một công trình OSM cụ thể | `#map?focus=hcm&view=province&sel=HCM-B-000200` |
| Mở Dashboard ngay | thêm `&dashboard=overview` (hoặc `projects`, `plan`, `budget`…) |
| Digital Twin, kịch bản BR-01 | `#twin?mode=simulation&scenario=BR-01` |

## 4. Chạy lại kiểm thử tự động
Script: `08_test/e2e_demo.cjs` — 45 ca (gồm `e2e_cad_cases.cjs` cho CAD & Kết cấu), ánh xạ use case trong `00_so_tay.md`. File này tự gọi thêm `e2e_gis_cases.cjs` (nền GIS, quy hoạch, biên tập, phương án) và `e2e_twin_cases.cjs` (tham số, quét, bộ ca kiểm thử mô hình). Script dùng Chrome cài sẵn trên máy, không thêm phụ thuộc vào `package.json`. Ca UC-00.15 cần Internet để kiểm tra ảnh vệ tinh; không có mạng thì ca ghi nhận nền ngoại tuyến.

```powershell
npm.cmd run build
npm.cmd install --no-save playwright-core
node 08_test/e2e_demo.cjs > 08_test/ket_qua_e2e.json
```

- Chrome ở chỗ khác thì đặt biến `CHROME_PATH` trước khi chạy: `$env:CHROME_PATH = "đường\dẫn\chrome.exe"`.
- Ảnh chụp màn hình ghi vào `08_test/shots/`.
- Đạt khi mọi ca có `"ok": true` và mảng `errors` rỗng.

## 5. Hạn chế đã biết (phạm vi demo)
- 2 cảnh 3D (TP.HCM khu trung tâm + Thủ Thiêm; Biên Hòa, mỗi cảnh 6 × 6 km) dùng **dữ liệu OSM thật**: công trình, ranh 23 + 5 phường sau sắp xếp 2025, thủy hệ, sử dụng đất, cơ sở dịch vụ. Ranh OSM là lớp tạm, **không phải ranh pháp lý**.
- **Độ phủ nhà OSM chưa đầy đủ**: khu có nhà trên ảnh vệ tinh nhưng không có khối 3D là nhà chưa được số hóa. Khoảng 90 % chiều cao là **ước lượng** theo loại + diện tích (ghi nhãn "Ước lượng"), vì OSM ít có thẻ chiều cao.
- **Ô quy hoạch và chỉ tiêu là mô phỏng** (suy từ hiện trạng sử dụng đất OSM, ngưỡng là tham số demo), không phải đồ án quy hoạch được duyệt.
- Cầu BR-01 đặt ở vị trí vượt sông Sài Gòn **minh họa**, không gắn với dự án thật nào.
- Ảnh nền Esri chỉ để hiển thị (điều khoản Esri: không tải xuống/đóng gói); không dùng làm số liệu phân tích.
- **CAD & Kết cấu:** bộ giải khung 3D và kiểm tra TCVN là bản demo **chưa kiểm định (V&V)**, nhãn L2*; W0, agR, R đất, cấp phối, hao hụt là tham số demo. Mặt bằng kết cấu là tầng điển hình áp dụng mọi tầng; chưa có móng cọc, dầm công xôn. Hồ sơ thật phải thẩm tra bằng phần mềm chuyên ngành.
- DEM SRTM 30 m là DSM (có thể gồm mái/cây). UR-01 chỉ là sàng lọc L1.
- Chỉ 2 tỉnh/thành có cảnh 3D chi tiết. 32 tỉnh/thành còn lại có trên bản đồ toàn quốc (nền vệ tinh) và Dashboard.
- Dùng Three.js thay CesiumJS/3D Tiles, để chạy offline trong một file.
- Ngưỡng mật độ xây dựng theo tầng cao (Demo 3) là **tham số cấu hình demo**. Phải đối chiếu bảng QCVN thật trước khi dùng cho hồ sơ thật.
- Đăng nhập, phân quyền, nhật ký truy cập là mô phỏng phía trình duyệt, không có máy chủ.
- AI trả lời bằng bộ luật và mẫu cục bộ (offline), không gọi mô hình ngôn ngữ trực tuyến.
- File Excel dự toán là SpreadsheetML (.xls). Excel hiện cảnh báo định dạng khi mở; bấm "Yes" là mở được, công thức vẫn tính.
- Chưa đo các yêu cầu hiệu năng của SRS (≤ 3 s, ≥ 30 fps, 2.000 CCU).

## 6. Danh mục bàn giao
| Tài liệu | Vị trí |
|---|---|
| Đặc tả gốc | `SRS_AI_Digital_Twin_v2.0_toan_quoc_tham_chieu_eCity.md` |
| Sổ tay: quyết định, khoảng trống, use case, nhật ký lỗi | `00_so_tay.md` |
| Báo cáo kiểm thử | đợt 3: `08_test/BC_chuc-nang_aipm-digital-twin_v3_2026-11-06.md` · đợt 1: `08_test/BC_chuc-nang_aipm-digital-twin_v1_2026-11-04.md` · đợt 2: `08_test/BC_chuc-nang_aipm-digital-twin_v2_2026-11-06.md` |
| Script kiểm thử tự động | `08_test/e2e_demo.cjs` (+ `e2e_gis_cases.cjs`, `e2e_twin_cases.cjs`) · kết quả `08_test/ket_qua_e2e.json` · ảnh `08_test/shots/` |
| Làm mới dữ liệu GIS | `node tools/fetch_gis.cjs` (cần Internet) rồi `npm.cmd run build` |
| Hướng dẫn sử dụng / kịch bản trình diễn | `09_ban_giao/huong_dan_su_dung.md` |
| Bản build | `dist/index.html` |
| Mã nguồn | `src/` (cấu trúc mô tả trong `README.md`) |
