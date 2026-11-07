# Sổ tay sản phẩm — AIPM OS × AI Digital Twin (demo v2.0 toàn quốc)

Căn cứ: `SRS_AI_Digital_Twin_v2.0_toan_quoc_tham_chieu_eCity.md` (phiên bản 2.0, 04/11/2026).
Mục tiêu: demo chạy được, đủ chức năng SRS 2.0 ở mức trình diễn (PoC). Không thay hồ sơ thật.

## 1. Quyết định chốt (giả định mặc định, cần người dùng xác nhận)

| # | Nội dung | Chốt cho demo | Lý do |
|---|---|---|---|
| D1 | 02 tỉnh/thành mẫu cho Demo 0 | **TP. Hồ Chí Minh** (tham chiếu e-City) + **Đồng Nai** (địa điểm dự án thí điểm DA-2026-017) | SRS mục 8 để mở; Đồng Nai trùng địa điểm dự án sẵn có |
| D2 | Công nghệ bản đồ 3D | **Three.js** (đã có trong dự án), không dùng CesiumJS | Demo build ra 1 file HTML chạy offline; Cesium cần tile server/Ion token |
| D3 | Dữ liệu nền 3D | **Sinh thủ tục (procedural) có seed**, gắn nhãn "Dữ liệu mô phỏng"; ranh giới là đường bao minh họa, không phải ranh pháp lý | Không có quyền/kết nối nguồn chính thức trong demo |
| D4 | Ngưỡng MĐXD theo QCVN 01 cho Demo 3 | Tham số cấu hình demo (15 tầng → ≤ 40 %), gắn "[Cần xác minh bảng QCVN]" | Không tự đặt ngưỡng quy chuẩn như số liệu thật |
| D5 | Xuất Excel dự toán | SpreadsheetML (.xls) nhiều sheet, có công thức sống | Không thêm thư viện; Excel/LibreOffice mở được |
| D6 | 7 làn BPMN theo chính quyền 2 cấp | Giữ 7 làn; làn UBND gắn cấp **tỉnh/xã** theo từng hồ sơ; bảng ánh xạ cơ quan–SLA theo tenant | Giữ đúng "7 làn" của AIPM OS (SRS mục 8 "Giữ nguyên") |
| D7 | Nền bản đồ GIS (yêu cầu bổ sung 06/11/2026) | **Ảnh vệ tinh Esri World Imagery** tải trực tiếp khi chạy (cần Internet, ghi nguồn); thêm nền Bản đồ đường phố/Địa hình Esri; mất mạng → tự chuyển **nền vẽ từ dữ liệu OSM** | Người dùng chọn "vệ tinh thật + nhà OSM". Không đóng gói ảnh vệ tinh (điều khoản Esri) |
| D8 | Dữ liệu nền thay cho dữ liệu mô phỏng ở 02 cảnh mẫu | **OpenStreetMap** (công trình, ranh phường/xã admin_level 6 sau sắp xếp 2025, mặt nước, sử dụng đất, đường, cơ sở dịch vụ) + **DEM Terrarium/SRTM 30 m**; tải 1 lần bằng `tools/fetch_gis.cjs`, đóng gói vào `src/data/osm/` | Có nguồn thật, giấy phép ODbL; chạy được ngoại tuyến (trừ ảnh vệ tinh). Chiều cao: `height` → Giá trị trong nguồn; `building:levels` → Số tầng × 3,2 m; thiếu → Ước lượng (ghi nhãn) |
| D9 | Cảnh mẫu | TP.HCM: khu trung tâm + Thủ Thiêm 6 × 6 km; Đồng Nai: trung tâm Biên Hòa 6 × 6 km. Cầu BR-01 đặt ở vị trí vượt sông Sài Gòn **minh họa**; khu đất DA-2026-017 đặt trên khu đất trống thật trong cảnh | Gần dữ liệu OSM dày; không gán cho dự án thật nào |
| D10 | Ô quy hoạch | **Mô phỏng**: lưới ô ~300 m, chức năng suy từ hiện trạng sử dụng đất OSM; chỉ tiêu MĐXD/tầng cao/HSSDĐ là **tham số demo**; ghi rõ "không phải đồ án được duyệt" | Chưa có đồ án quy hoạch số được phép dùng |
| D11 | Biên tập mô hình | Sửa công trình (tầng/chiều cao, di chuyển, xoay, co giãn, xóa, thêm khối), sửa tham số cầu BR-01 và khu DA-2026-017; lưu nhiều phương án, so sánh, hoàn tác, xuất/nhập JSON; kiểm tra chỉ tiêu quy hoạch tức thì. Dữ liệu gốc OSM không bị sửa | Phương án là lớp chỉnh sửa chồng lên dữ liệu nền |
| D12 | Kịch bản kiểm thử mô hình | Thêm tham số + ngưỡng chấp nhận cho 19 kịch bản; quét 1–2 tham số, tornado, Monte Carlo; bộ ca định sẵn mỗi kịch bản; mở rộng E2E | Giá trị ngưỡng là tham số demo (proxy L1) |
| D13 | Đợt 3 — công trình cho CAD/mô phỏng (06/11/2026, chốt 1A) | Nhà khung BTCT (khối nhà DA-2026-017), mặt bằng tầng điển hình | Phổ biến, tính kết cấu rõ ràng |
| D14 | Màn CAD (chốt 2A) | Khoảng 40 lệnh kiểu AutoCAD + công cụ cấu kiện (trục/cột/dầm/sàn/vách/tường/móng) → dựng 3D; DXF R12 vào/ra | Không thể làm "đủ AutoCAD"; ưu tiên lệnh cốt lõi |
| D15 | Tính toán (chốt 3A) | Bộ giải khung 3D (phần tử dầm 12 bậc tự do) + tổ hợp tải TCVN 2737 + kiểm tra TCVN 5574 đơn giản hóa; gió QCVN 02/TCVN 2737; động đất TCVN 9386 (lực ngang tương đương); khối lượng + cung ứng; Monte Carlo | Gắn nhãn L2* — chưa V&V |
| D16 | AI (chốt 4A) | Claude API (nếu có key) đề xuất kịch bản theo vị trí + diễn giải; dự phòng quy tắc offline; tính toán luôn cục bộ | |

## 2. Phân tích khoảng trống (trước khi sửa)

| Mã YC | Yêu cầu SRS 2.0 | Hiện trạng demo cũ | Xử lý |
|---|---|---|---|
| MOD-00 / 2.0 | Bản đồ 3D toàn quốc, 13 nhóm tính năng nền tảng | **Chưa có** | Thêm tab `#map` (Bản đồ 3D) — mới hoàn toàn |
| Demo 0 | Toàn quốc → tỉnh → khu vực → công trình → mở BR-01 | Chưa có | Luồng trong `#map`, nút "Mở dự án/kịch bản" → `#twin` |
| 2.0 Dashboard | Dashboard toàn màn hình đa cấp + "Dự án & Stage-Gate" | Chưa có | Lớp phủ Dashboard trong `#map` |
| 7.2 UR-01 | Kịch bản khu vực mưa + triều trên MOD-00 | Thiếu (chỉ 18 ca) | Thêm UR-01 vào thư viện + chạy trên bản đồ |
| MOD-04 | Căn cứ NĐ 206/2026, TT 36/37/38/2026; Excel dự toán nhiều sheet; mã ĐVHC | Căn cứ cũ chung chung; chưa có Excel | Cập nhật docgen, thêm xuất Excel, gói "AI Khởi tạo bộ hồ sơ từ Digital Twin" |
| MOD-05 / Demo 3 | Bắt NĐ 10/2021 hết hiệu lực, MĐXD vượt QCVN 01:2021, cảnh báo QCVN 01:2026 hiệu lực 01/01/2027 theo ngày thẩm định | Chưa có các quy tắc này | Bổ sung CSDL quy tắc 2026, kiểm tra chỉ tiêu theo ngày thẩm định, tờ trình mẫu cài 2 lỗi, sửa 1 nút |
| 2.3 / MOD-06 | Ánh xạ 7 làn theo CQĐP 2 cấp, NĐ 217/2026, SLA theo tenant, công việc gắn vị trí | Làn chung, không vị trí | Đổi tên làn, bảng ánh xạ, gắn địa bàn + liên kết bản đồ |
| Demo 4 | Hồ sơ hợp lệ → tự tích checklist, mở G1–G3, chuyển làn BPMN, dashboard bản đồ cập nhật | Phải thao tác tay từng nơi | Nút "Xác nhận hợp lệ & liên thông" trong Hồ sơ AI |
| MOD-06 | Cung ứng vật liệu 4D/5D ảnh hưởng đường găng | Có A/B/C ở QTO, chưa nối Timeline | Panel cung ứng vật liệu trong Timeline (chỉ đổi baseline sau duyệt) |
| Tổng quan | "MOD-00 + 6 module", tên đơn vị Bình Phúc | "sáu module", ghi "Bình Phước" | Sửa |

## 3. Use case (gốc truy vết cho code và testcase)

| UC | Tên | Transaction chính |
|---|---|---|
| UC-00.1 | Xem bản đồ toàn quốc, chọn tỉnh | Mở `#map` → chọn tỉnh trên bản đồ/ô chọn → bay tới tỉnh |
| UC-00.2 | Tìm khu vực/công trình | Gõ tên → chọn kết quả → bay tới |
| UC-00.3 | Xem dữ liệu trong khu vực, danh sách xã/phường | Nhóm Dữ liệu → bảng theo nguồn chiều cao + xã/phường |
| UC-00.4 | Nhấp công trình xem provenance | Click mảnh → tab Chi tiết đủ trường |
| UC-00.5 | Bật/tắt lớp, Ngày/Giờ vàng/Đêm, Mưa·triều·ngập | Tab Lớp |
| UC-00.6 | Phân tích tại tâm/vẽ vùng, xuất CSV | Nhóm Phân tích |
| UC-00.7 | Registry nguồn, tài liệu quy hoạch | Tab Nguồn, Tài liệu |
| UC-00.8 | Vùng quản lý: tạo, tô màu, nhập/xuất | Nhóm Vùng |
| UC-00.9 | Điều hành 5 tab (Vùng/Dịch vụ/Kịch bản/Ảnh/Báo cáo) | Nhóm Điều hành |
| UC-00.10 | Tương lai: danh mục dự án hạ tầng, tiến độ | Nhóm Tương lai |
| UC-00.11 | Dashboard đa cấp, drill-down, chứng cứ nguồn, xuất | Nút Dashboard |
| UC-00.12 | Deep-link có phiên bản | Sao chép link → mở lại đúng cảnh |
| UC-00.13 | Đăng nhập theo địa bàn, phân quyền lớp hạn chế | Chọn vai trò; lớp độ cao chi tiết theo quyền; nhật ký truy cập |
| UC-00.14 | Mở dự án/kịch bản BR-01 từ bản đồ | Click cầu → "Mở dự án/kịch bản" |
| UC-02.UR | Chạy UR-01 trên khu vực | Kịch bản → UR-01 → lớp ngập + danh sách công trình bị ảnh hưởng |
| UC-04.1 | AI khởi tạo bộ hồ sơ + Excel dự toán | Hồ sơ AI → "AI Khởi tạo bộ hồ sơ" / "Xuất Excel dự toán" |
| UC-05.1 | Kiểm toán pháp lý 2026 tờ trình mẫu | Pháp lý → nạp tờ trình mẫu → kiểm toán → cập nhật 1 nút |
| UC-06.1 | Liên thông sau khi hồ sơ hợp lệ | Hồ sơ AI → Xác nhận hợp lệ → checklist/Stage-Gate/BPMN/bản đồ |
| UC-06.2 | Mô phỏng cung ứng vật liệu tới đường găng | Timeline → chọn kịch bản A/B/C → xem tác động, duyệt |
| UC-06.3 | BPMN theo chính quyền 2 cấp, công việc gắn vị trí | Phối hợp → làn Sở NN&MT / Công an / UBND tỉnh-xã → bảng ánh xạ theo tenant → chip vị trí mở bản đồ |
| UC-00.15 | Đổi nền bản đồ GIS | Tab Lớp → Nền: Vệ tinh / Vệ tinh + nhãn / Đường phố / Địa hình / Ngoại tuyến (OSM) → nền đổi, có ghi nguồn; mất mạng tự chuyển ngoại tuyến |
| UC-00.16 | Xem ô quy hoạch & chỉ tiêu | Nhóm Quy hoạch → bật Ô quy hoạch → nhấp ô → chức năng, chỉ tiêu tối đa vs hiện trạng vs phương án → đạt/vượt |
| UC-00.17 | Biên tập công trình trên bản đồ | Nhóm Biên tập → chọn nhà → đổi tầng/di chuyển/xoay/co giãn/xóa; Thêm khối mới → kiểm tra chỉ tiêu tức thì; hoàn tác/làm lại |
| UC-00.18 | Biên tập mô hình dự án | Biên tập → Cầu BR-01 (dài, nhịp, bề rộng, tĩnh không, số làn) / Khu DA-2026-017 (số khối, tầng, cao độ san nền) → 3D + khối lượng cập nhật → đưa sang Digital Twin |
| UC-00.19 | Quản lý phương án mô hình | Lưu phương án A/B/C → so sánh chỉ số → nạp/xóa → xuất/nhập JSON |
| UC-02.P | Tham số & quét kịch bản kiểm thử mô hình | Digital Twin → tham số mở rộng + ngưỡng → quét 1/2 tham số, tornado, Monte Carlo → bộ ca kiểm thử → xuất CSV |
| UC-07.1 | Vẽ/sửa 2D kiểu AutoCAD | Tab CAD & Kết cấu → dòng lệnh L, PL, REC, C, A, DLI, T, H, M, CO, RO, MI, SC, O, TR, EX, F, AR, E, DI, AA, LI, U/REDO; bắt điểm F3, ORTHO F8 |
| UC-07.2 | Dựng cấu kiện kết cấu | TRUC → COT (A) → DAM (A) → SAN (A) → VACH/TUONG → MONG (A) · KHUNG mẫu · TANG thông số |
| UC-07.3 | Phân tích kết cấu & tiêu chí kỹ thuật | ▶ Phân tích → 8 tiêu chí (N–M cột/vách, uốn/cắt dầm, độ võng, lệch tầng gió, chuyển vị đỉnh, động đất, móng) |
| UC-07.4 | Dựng 3D & xem kết quả | Mô hình 3D → tô mức sử dụng → biến dạng theo tổ hợp |
| UC-07.5 | Đủ vật liệu & kịp tiến độ? | Tab Vật liệu → khối lượng từ mô hình (kể hao hụt) vs hợp đồng + năng lực giao/tháng → đủ/thiếu, trễ ngày |
| UC-07.6 | Kịch bản cực đoan + AI | Tab Kịch bản → AI/offline sinh kịch bản → chạy → 3D minh họa → AI đánh giá & biện pháp · Monte Carlo |
| UC-07.7 | Trao đổi bản vẽ | Xuất/nhập DXF |
| UC-07.9 | Sa bàn tương lai dự án | CAD → 🗺 Sa bàn trên bản đồ (hoặc Bản đồ → Biên tập → Mô hình dự án → 🔮 Xem tương lai) → mô hình thiết kế đặt vào khu đất DA-2026-017 thật; số khối, hướng xoay, thanh tiến độ thi công, bay vòng; kiểm tra chỉ tiêu lô; bật/tắt hiện trạng ↔ tương lai |
| UC-07.8 | Liên thông Digital Twin | Lưu run kết cấu sang lịch sử run Twin; Twin có lối vào CAD |

## 4. Trạng thái

| Phần | Trạng thái |
|---|---|
| Đặc tả/gap | Xong (mục 2–3) |
| Code MOD-00 + liên thông | Xong — `src/views/map*.js`, `src/lib/citymap3d.js`, `citygen.js`, `xlsx.js`, `data/nationwide.js`; cập nhật ai/docgen/docs/legal/bpmn/stagegate/timeline/twin |
| Test | 23/23 ca E2E đạt, 0 lỗi JS — `08_test/BC_chuc-nang_aipm-digital-twin_v1_2026-11-04.md` |
| Đợt 2 (06/11) — GIS/quy hoạch/biên tập/tham số | Xong — `tools/fetch_gis.cjs`, `src/data/osm/`, `citygen.js` + `citymap3d.js` viết lại theo GIS thật, `views/map-edit.js` (ô quy hoạch, biên tập, phương án), `simulation-lab.js` + `twin-v2.js` (tham số, quét, tornado, Monte Carlo, bộ ca) |
| Test đợt 2 | 37/37 ca E2E đạt, 0 lỗi JS — `08_test/BC_chuc-nang_aipm-digital-twin_v2_2026-11-06.md` |
| Đợt 3 (06/11) — CAD/kết cấu/kịch bản/bản đồ chân thực | Xong — `src/views/cad.js`, `src/lib/struct/{fem,design}.js`, `src/lib/cad/{dxf,view3d}.js`; bản đồ: mặt đứng/mái/bóng đổ, lô quy hoạch theo đường. Test 45/45 — `08_test/BC_chuc-nang_aipm-digital-twin_v3_2026-11-06.md` |
| Bàn giao | Xong (đợt 1) — `09_ban_giao/README_chay_thu.md`, `09_ban_giao/huong_dan_su_dung.md`; script test `08_test/e2e_demo.cjs` (chạy lại 06/11: 23/23 đạt) |

## 5. Nhật ký lỗi
| Mã | Loại | Tuyến | Kết quả test lại |
|---|---|---|---|
| BUG-01 lớp độ cao không giữ trạng thái | Kỹ thuật | dev | Đạt |
| BUG-02 không thấy mặt nước dưới cầu | Thiết kế địa hình | dev (thiết kế cảnh) | Đạt |
| BUG-03 cảnh mẫu thưa | Thiết kế | dev | Đạt |
| ENV-01 ổ đĩa đầy, `citygen.js` bị cắt | Môi trường | khôi phục từ bản sao | Đạt; 06/11 ổ đã có ~42 GB trống |
| BUG-04 deep-link `dashboard=` giá trị lạ → Dashboard trống | Kỹ thuật | dev | Đạt |
| BUG-05 cầu BR-01 đặt qua kênh 50 m | Thiết kế dữ liệu | dev (thuật toán vượt sông) | Đạt |
| BUG-06 ô quy hoạch vượt chỉ tiêu quá nhiều (279/400) | Thiết kế (tham số demo) | thiết kế → dev | Đạt (33/400) |
| BUG-07 danh sách ô vượt bị co về 0 | Kỹ thuật (CSS) | dev | Đạt |
| BUG-08 map.model gửi Twin thông số cũ | Kỹ thuật | dev | Đạt |
| BUG-09 khung 3D trắng sau nhiều lần chuyển trang (ngữ cảnh WebGL) | Kỹ thuật | dev | Đạt |
| BUG-10 nền ngoại tuyến dùng nhầm tỉnh | Kỹ thuật | dev | Đạt |
| TC-02/03/04 testcase theo dữ liệu thật r2, cách ly trạng thái, thời gian chờ | Sai testcase/môi trường | sửa testcase | Đạt |
| BUG-11 bộ giải chậm 20 s (băng rộng) | Kỹ thuật | dev | Đạt (~150 ms) |
| BUG-12 vách lõi đứng tự do → chuyển vị 1,5 m | Thiết kế mô hình tính | thiết kế → dev | Đạt |
| BUG-13 công thức cắt dầm, độ lệch Monte Carlo | Kỹ thuật | dev | Đạt |
| BUG-14 khung mẫu sát giới hạn, móng thiếu | Thiết kế mẫu | thiết kế | Đạt |
| BUG-15 ROTATE/CIRCLE không nhận số | Kỹ thuật | dev | Đạt |
| BUG-16 tràn thanh công cụ/điều hướng | Giao diện | design → dev | Đạt |
