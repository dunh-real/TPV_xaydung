# Báo cáo kiểm thử — Chức năng + Tự động (E2E) — AIPM OS × AI Digital Twin v2.0
Phiên bản báo cáo: v1 | Ngày: 04/11/2026 | Người thực hiện (agent): lead-san-pham (tester + auto-test gộp)
Đối tượng: demo `aipm-digital-twin-demo` bản build 04/11/2026 (dataset MOD-00 `VN-2026.11-r1`)
Căn cứ: SRS v2.0 (04/11/2026); danh sách use case trong `00_so_tay.md` mục 3

## 1. Phạm vi và mục tiêu
- Phạm vi: phần mới MOD-00 (Bản đồ 3D toàn quốc, Demo 0), UR-01, cập nhật MOD-04/05/06 (Demo 2–4), hồi quy 7 tab cũ.
- Mục tiêu: xác nhận demo đủ chức năng SRS 2.0 ở mức PoC, không lỗi JavaScript.
- Môi trường: `dist/index.html` (build 1 file), Chrome headless (WebGL SwiftShader), viewport 1680×1000, localStorage trống trước khi chạy.

## 2. Cơ sở test
- Bộ test tự động Playwright, 23 ca, ánh xạ 1–1 với use case trong sổ tay.
- Tiêu chí đạt: assertion của từng ca đúng và không có `pageerror` hoặc `console.error`.

## 3. Kết quả tổng hợp
| Hạng mục | Số ca | Đạt | Không đạt | Chặn | Tỷ lệ đạt |
|---|---|---|---|---|---|
| MOD-00 Bản đồ 3D (UC-00.x) | 15 | 15 | 0 | 0 | 100% |
| UR-01 (UC-02.UR) | 1 | 1 | 0 | 0 | 100% |
| MOD-04/05/06 (UC-04.1, UC-05.1, UC-06.1–3) | 5 | 5 | 0 | 0 | 100% |
| Hồi quy 7 tab cũ + điều hướng BR-01 | 2 | 2 | 0 | 0 | 100% |
| **Tổng** | **23** | **23** | **0** | **0** | **100%** |

Kết luận: đạt ở lần chạy cuối, 0 lỗi JS. Đủ điều kiện để người dùng xem demo (cổng c).

Chạy lại ngày 06/11/2026 sau khi giải phóng ổ đĩa: build trực tiếp trong thư mục dự án, chạy bằng `08_test/e2e_demo.cjs` → **23/23 đạt, 0 lỗi JS** (gồm cả bản sửa BUG-04).

| UC | Kết quả đo được |
|---|---|
| UC-00.1 | 34 nhãn tỉnh; có Hoàng Sa, Trường Sa, Côn Đảo, Phú Quốc; chọn TP.HCM → breadcrumb đúng |
| UC-00.3 | 16/168 xã/phường hiển thị kèm số mảnh |
| UC-00.4 | Thông tin công trình đủ 11 trường provenance theo SRS 2.0 |
| UC-00.5 | Ngày / Giờ vàng / Đêm; tô theo nguồn chiều cao; lớp Mưa·triều·ngập có nhãn nguồn và giới hạn |
| UC-00.6 | Phân tích 1 km² tại tâm, biểu đồ hình thái liên kết danh sách; xuất CSV + JSON phương pháp; vẽ đa giác |
| UC-00.7 | 21 nguồn, đủ 10 trường bắt buộc; tài liệu quy hoạch đủ 5 trường |
| UC-00.8 | Tô màu vùng; tạo vùng quản lý; xuất GeoJSON |
| UC-00.9 | KPI "Chưa có"; A/B cơ sở; khoanh phương án ≤ 10 ha; tab Ảnh; tạo công việc cục bộ → đẩy sang BPMN |
| UC-00.10 | Danh mục Tương lai, 7 tab, cảnh báo "đã qua mốc ≠ hoàn thành" |
| UC-00.11 | Dashboard cấp tỉnh → quốc gia; trang Quy hoạch & hồ sơ, Dự án & Stage-Gate; chế độ Đối chiếu; chứng cứ nguồn; xuất CSV |
| UC-00.12 | Deep-link `v/focus/view/mode/sel` mở lại đúng Đồng Nai, chế độ Đêm, chọn DA-2026-017 |
| UC-00.13 | Đăng nhập quản trị tỉnh mở lớp độ cao chi tiết; có ghi nhật ký truy cập |
| UC-00.14 | Click cầu BR-01 → "Mở dự án/kịch bản" → `#twin` đúng BR-01, chạy được L1 |
| UC-02.UR | Thư viện 19 mô hình (18 + UR-01); chạy UR-01 trên bản đồ ra danh sách công trình bị ảnh hưởng |
| UC-04.1 | 1 nút tạo 3 hồ sơ + Excel 6 sheet, 54 công thức |
| UC-05.1 | Tờ trình mẫu: đúng 2 vị trí tô đỏ (NĐ 10/2021, MĐXD 55 %) + cảnh báo QCVN 01:2026 → sửa 1 nút → 0 lỗi |
| UC-06.1 | Xác nhận hợp lệ: checklist 0 → 34 mục trọng yếu, BPMN chuyển làn sang Sở XD, qua G0, G1 |
| UC-06.2 | Kịch bản C (thép trễ 21 ngày) → G12 +41 ngày; duyệt cập nhật lịch |
| UC-06.3 | Làn NN&MT, Công an PCCC, UBND tỉnh/xã; 8 chip vị trí; bảng ánh xạ theo tenant |

## 4. Phát hiện (đã xử lý trong đợt)
| Mã | Mô tả | UC | Mức độ | Loại | Tuyến xử lý | Trạng thái |
|---|---|---|---|---|---|---|
| BUG-01 | Ô "Độ cao chi tiết" không giữ trạng thái sau khi bật (bảng vẽ lại) | UC-00.13 | Trung bình | Kỹ thuật | dev → sửa cờ `ui.elev` | Đóng (đạt ở run 2) |
| BUG-02 | Không thấy mặt nước dưới cầu BR-01: lòng sông không thấp hơn mặt đất | UC-00.14 | Nhẹ | Thiết kế (mô hình địa hình) | Khoét lòng sông, mặt nước theo bờ | Đóng (đạt ở run 4, đã kiểm ảnh) |
| BUG-03 | Cảnh mẫu TP.HCM thưa (~1.800 mảnh), chưa giống đô thị | UC-00.1 | Nhẹ | Thiết kế | Tăng mật độ → 7.728 mảnh | Đóng |
| TC-01 | Script test gọi `location` trong Node | UC-00.14 | — | Sai testcase | Sửa testcase | Đóng |
| ENV-01 | Ổ C:/G: đầy 100 %, Google Drive từ chối ghi → `citygen.js` bị cắt về 0 byte | — | Chặn | Môi trường | Khôi phục từ bản sao; đã kiểm toàn bộ file | Đóng (06/11: ổ còn ~42 GB trống, build lại trong dự án đạt) |
| BUG-04 | Deep-link `dashboard=<giá trị lạ>` (vd `1`) mở Dashboard trống | UC-00.12 | Nhẹ | Kỹ thuật | dev → giá trị không hợp lệ rơi về trang Tổng quan | Đóng (đã kiểm `dashboard=1` → Tổng quan, `dashboard=projects` → Dự án & Stage-Gate) |

## 5. Khuyến nghị
- Khi có quyết định thật: thay dữ liệu procedural bằng 3D Tiles/PostGIS và ranh ĐVHC chính thức; thay ngưỡng MĐXD demo bằng bảng QCVN đã xác minh.
- Cổng G2/G3 chỉ mở sau khi chạy mô phỏng san nền/ngập trên Digital Twin. Đây là hành vi đúng của AI Gatekeeper, không phải lỗi.

## 6. Phụ lục
- Script E2E: `08_test/e2e_demo.cjs`, chạy bằng `playwright-core` trên Chrome cài sẵn của máy (không thêm phụ thuộc vào dự án). Cách chạy: `09_ban_giao/README_chay_thu.md` mục 4.
- Hiệu năng: chưa đo theo yêu cầu phi chức năng (≤ 3 s, ≥ 30 fps, 2.000 CCU). Ngoài phạm vi demo.
