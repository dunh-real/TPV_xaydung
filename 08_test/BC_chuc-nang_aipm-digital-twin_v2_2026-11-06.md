# Báo cáo kiểm thử — Đợt 2: Nền GIS · Quy hoạch · Biên tập mô hình · Tham số kịch bản — AIPM OS × AI Digital Twin v2.0
Phiên bản báo cáo: v2 | Ngày: 06/11/2026 | Người thực hiện (agent): lead-san-pham (tester + auto-test gộp)
Đối tượng: `dist/index.html` bản build 06/11/2026 · dataset MOD-00 `VN-2026.11-r2` (OSM tải 05/11/2026)
Căn cứ: yêu cầu bổ sung của người dùng 06/11/2026 (đã chốt 4 lựa chọn) · quyết định D7–D12 và use case UC-00.15 … UC-00.19, UC-02.P trong `00_so_tay.md`

## 1. Phạm vi và mục tiêu
- Phạm vi mới:
  - nền bản đồ GIS: ảnh vệ tinh Esri, bản đồ đường phố/địa hình, nền ngoại tuyến;
  - công trình, ranh phường, thủy hệ, sử dụng đất và cơ sở dịch vụ từ OpenStreetMap thật; DEM SRTM;
  - ô quy hoạch và chỉ tiêu (mô phỏng);
  - biên tập công trình và mô hình dự án (cầu BR-01, khu DA-2026-017); quản lý phương án;
  - UR-01 trên DEM thật;
  - tham số, ngưỡng, quét tham số, tornado, Monte Carlo và bộ ca kiểm thử cho 19 kịch bản Digital Twin.
- Hồi quy: toàn bộ 23 ca của đợt 1.
- Môi trường:
  - Chrome headless, WebGL SwiftShader, viewport 1680×1000, có Internet để tải tile Esri;
  - localStorage trống khi bắt đầu.

## 2. Cơ sở test
- Bộ test tự động gồm 37 ca:
  - `08_test/e2e_demo.cjs`: 23 ca đợt 1;
  - `08_test/e2e_gis_cases.cjs`: 6 ca mới;
  - `08_test/e2e_twin_cases.cjs`: 8 ca mới.
- Tiêu chí đạt: assertion của từng ca đúng và không có `pageerror` hay `console.error`.
- Kết quả máy đọc được: `08_test/ket_qua_e2e.json`. Ảnh chụp: `08_test/shots/`.

## 3. Kết quả tổng hợp
| Hạng mục | Số ca | Đạt | Không đạt | Tỷ lệ đạt |
|---|---|---|---|---|
| Hồi quy đợt 1 (MOD-00, UR-01, Demo 2–4, 7 tab) | 23 | 23 | 0 | 100% |
| Nền GIS · quy hoạch · biên tập · phương án (UC-00.15–19, UC-02.UR2) | 6 | 6 | 0 | 100% |
| Tham số & quét kịch bản kiểm thử mô hình (UC-02.P1–P8) | 8 | 8 | 0 | 100% |
| **Tổng** | **37** | **37** | **0** | **100%** |

Kết luận: đạt ở lần chạy cuối trên bản build trong thư mục dự án, 0 lỗi JS. Đủ điều kiện để người dùng xem demo (cổng c).

| UC | Kết quả đo được |
|---|---|
| UC-00.15 | Ảnh vệ tinh z16 tải trong khoảng 4–6 s (132 tile); có 5 lựa chọn nền. Đổi sang Đường phố và Ngoại tuyến đều đúng; ghi công Esri và OSM. Công trình có `osm:id`, giấy phép ODbL. Khi phóng gần tự nạp ảnh cận cảnh z18 (≈ 0,6 m/pixel). |
| UC-00.16 | TP.HCM: 33/400 ô vượt chỉ tiêu. Chi tiết ô hiện tối đa / hiện tại / kết luận cho MĐXD, tầng cao, HSSDĐ. Có chú giải "Vượt chỉ tiêu". |
| UC-00.17 | Đổi tầng 40 → cao 132 m. Di chuyển 5 m, xoay 15°; hoàn tác/làm lại đúng. Thêm khối HCM-PA-001 (18 tầng) bằng nhấp bản đồ; xóa 1 công trình. Tổng hợp "sửa 1 · thêm 1 · xóa 1". |
| UC-00.18 | Cầu BR-01 sửa thành 5 nhịp, tĩnh không 8 m, 6 làn: mô hình 3D, khối lượng và chi phí cập nhật, cảnh báo tĩnh không < 12 m; Digital Twin nhận thông số và ghi nguồn "Bản đồ 3D". Khu DA-2026-017 sửa thành 8 khối × 30 tầng: tính lại GFA, MĐXD, HSSDĐ, san nền, kết luận vượt chỉ tiêu ô DNA-QH-1015. |
| UC-00.19 | Lưu PAN-HCM-001 (thêm 1, xóa 1). Về hiện trạng; bảng so sánh 3 cột (hiện trạng, phương án, đang làm). Nạp lại, xuất JSON; phương án làm việc được giữ sau khi tải lại trang. |
| UC-02.UR2 | UR-01 trên DEM thật: 251 công trình bị ảnh hưởng; thêm nước biển dâng 0,8 m → 497; thêm trạm bơm → 407. |
| UC-02.P1–P8 | BR-01 có 7 tham số mới. Đổi ngưỡng chuyển PASS ↔ FAIL. Quét 30 điểm có 2 điểm chuyển trạng thái; ma trận 121 ô. Tornado 11 tham số. Monte Carlo P(FAIL) = 78,4 %. 19 kịch bản × 77 ca. Thông số lấy từ phương án bản đồ. |

## 4. Phát hiện (đã xử lý trong đợt)
| Mã | Mô tả | UC | Mức độ | Loại | Tuyến xử lý | Trạng thái |
|---|---|---|---|---|---|---|
| BUG-05 | Cầu BR-01 đặt qua một kênh rộng 1 ô lưới (50 m) thay vì sông Sài Gòn | UC-00.18 | Trung bình | Thiết kế dữ liệu | Chỉ chọn "nước rộng" (cách bờ ≥ 60 m); bỏ qua lỗ nhỏ của lưới nước → 410 m, khổ sông ≈ 290 m | Đóng |
| BUG-06 | Tỷ lệ ô quy hoạch vượt chỉ tiêu quá cao (279/400): mặt nước bị xét; đất trống có cỏ bị coi là cây xanh; OSM chưa số hóa đủ nhà nên ô thiếu nhà bị gán cây xanh | UC-00.16 | Trung bình | Thiết kế (tham số demo) | Mặt nước không xét; grassland/scrub → đất trống; ô không nhãn nội đô → đất ở; chỉnh ngưỡng demo; thêm ghi chú độ phủ OSM | Đóng (33/400) |
| BUG-07 | Danh sách "ô vượt chỉ tiêu" bị co về chiều cao 0 trong panel trái | UC-00.16 | Trung bình | Kỹ thuật (CSS flex) | `flex-shrink:0` cho khối con của panel | Đóng |
| BUG-08 | Sửa cầu nhưng `map.model` gửi sang Digital Twin vẫn là thông số cũ (lưu trước khi cảnh cập nhật) | UC-00.18 | Cao | Kỹ thuật | Lưu sau khi áp phương án lên cảnh | Đóng |
| BUG-09 | Chuyển trang nhiều lần → khung 3D trắng (ngữ cảnh WebGL không được trả); lỗi `_detail` khi hẹn giờ chạy sau khi hủy bản đồ | UC-00.14 | Cao | Kỹ thuật | `forceContextLoss()` khi rời trang (cả bản đồ và Digital Twin); hủy hẹn giờ; kiểm tra 10 lần chuyển liên tiếp | Đóng |
| BUG-10 | Nền ngoại tuyến có thể dùng nhầm của tỉnh trước khi đổi tỉnh | UC-00.15 | Nhẹ | Kỹ thuật | Gắn nền ngoại tuyến theo từng tỉnh, có bộ nhớ đệm | Đóng |
| TC-02 | Testcase đợt 1 cập nhật theo dữ liệu thật: 23/168 phường (thay 16/168), 3,3 m/tầng, dataset r2 | UC-00.3/5/12 | — | Sai testcase (do thay đổi đã chốt) | Sửa testcase | Đóng |
| TC-03 | Bấm nút nhóm khi nhóm đang mở thì nhóm bị đóng; trạng thái mô hình của ca trước làm sai ca sau (P2/P4) | UC-00.16–18, UC-02.P2/P4 | — | Sai testcase | Bấm nhóm có kiểm tra; dọn trạng thái sau nhóm ca GIS | Đóng |
| TC-04 | Ảnh `07_br01` chụp khi khung hình đầu chưa vẽ (SwiftShader chậm) | UC-00.14 | — | Môi trường test | Chờ 3,5 s; lưu sẵn nền ngoại tuyến | Đóng |

## 5. Khuyến nghị
- **Ảnh vệ tinh cần Internet.** Khi mất mạng, demo tự chuyển sang nền vẽ từ OSM và báo trên thanh trạng thái. Nên kiểm tra mạng phòng họp trước buổi trình diễn.
- **Độ phủ nhà trên OSM ở TP.HCM chưa đầy đủ** (≈ 10,3 nghìn mảnh trong 36 km²). Nhiều khu dân cư có trên ảnh nhưng chưa có khối 3D; giao diện đã ghi chú. Khi triển khai thật, thay bằng CSDL công trình địa phương hoặc Overture/Open Buildings.
- **Ô quy hoạch và chỉ tiêu là mô phỏng.** Cần thay bằng đồ án QHPK/QHCT đã số hóa trước khi dùng cho thẩm định.
- **Hiệu năng.** Khởi tạo cảnh khoảng 2 s trên GPU phần mềm. Chưa đo theo yêu cầu phi chức năng của SRS (≤ 3 s, ≥ 30 fps) trên máy có GPU thật.
- **Kích thước bản build** 3,7 MB (gzip 0,9 MB), do đóng gói dữ liệu OSM của 2 cảnh.

## 6. Phụ lục
- Dữ liệu GIS: `tools/fetch_gis.cjs` tải từ Overpass API và AWS Terrain Tiles một lần, rồi đóng gói vào `src/data/osm/*.json`. Chạy lại để làm mới dữ liệu (cần Internet).
- Cách chạy test: xem `09_ban_giao/README_chay_thu.md` mục 4.
