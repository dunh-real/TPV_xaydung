# Hướng dẫn sử dụng — kịch bản trình diễn Demo 0–4

Dành cho người trình diễn demo AIPM OS × AI Digital Twin v2.0. Cách mở demo xem `README_chay_thu.md`.
Mỗi bước ghi: bấm gì → khán giả thấy gì. Tổng thời lượng khoảng 45–60 phút.

**Chuẩn bị trước buổi demo:**
- Xóa khóa localStorage `aipm-dt-demo-v3` để bắt đầu từ trạng thái sạch.
- Mở sẵn link nhanh ở mục 3 của README.

---

## Demo 0 — Bản đồ 3D toàn quốc (tab 🗺️ Bản đồ 3D) · ~10 phút
| # | Thao tác | Kết quả cần chỉ ra |
|---|---|---|
| 1 | Mở tab **Bản đồ 3D** | Bản đồ 34 tỉnh/thành, có Hoàng Sa, Trường Sa, Côn Đảo, Phú Quốc |
| 2 | Chọn **TP. Hồ Chí Minh** (ô chọn tỉnh, hoặc nhấp trên bản đồ) | Bay vào cảnh đô thị 3D; breadcrumb Toàn quốc › TP.HCM |
| 3 | Thanh bên trái → **🗂️ Dữ liệu** | Danh sách xã/phường kèm số mảnh công trình; thống kê theo nguồn chiều cao |
| 4 | Bảng phải → tab **Lớp**: bật *Tô theo nguồn chiều cao*, đổi Ngày → Giờ vàng → Đêm | Màu theo 5 lớp nguồn gốc chiều cao; ánh sáng thay đổi |
| 5 | Bật **Mưa · triều · ngập** | Lớp nước kèm nhãn nguồn và giới hạn: nhấn mạnh "không bịa số liệu" |
| 6 | Nhóm **📊 Phân tích** → *Phân tích tại tâm* (1 km²) → nhấp một cột biểu đồ → *Xuất CSV* | Biểu đồ hình thái liên kết với bản đồ; file CSV + JSON phương pháp |
| 7 | Nhấp cầu **BR-01** trên sông | Tab Chi tiết: 11 trường provenance (nguồn, năm, LOD, độ tin cậy…) |
| 8 | Bấm **Mở dự án/kịch bản BR-01** | Chuyển sang tab Digital Twin, nạp sẵn kịch bản BR-01 |
| 9 | Quay lại bản đồ → **📊 Dashboard** | Các trang Tổng quan · Quy hoạch & hồ sơ · Dự án & Stage-Gate; drill-down quốc gia ↔ tỉnh; nút chứng cứ nguồn |
| 10 | **🔗 Deep-link** | Link có phiên bản dữ liệu `v=VN-2026.11-r2`; mở lại đúng cảnh (kể cả nền bản đồ `bm=`) |

**Phần nói thêm nếu còn thời gian:**
- **Đăng nhập theo địa bàn**: vai trò quản trị tỉnh mở được lớp độ cao chi tiết; mỗi lần mở ghi nhật ký truy cập.
- **🧩 Vùng**: tô màu theo chủ đề; tạo vùng quản lý; nhập/xuất GeoJSON.
- **🛰️ Điều hành**: 5 tab. KPI chưa có nguồn thì hiện "Chưa có". Tab Kịch bản có *Chạy UR-01 (L1)* trên vùng chọn. Có thể tạo công việc và đẩy sang BPMN.
- **🚄 Tương lai**: danh mục dự án hạ tầng. Dự án đã qua mốc nhưng chưa có xác nhận thì không coi là đã hoàn thành.
- **🎥 Tham quan**: bay tự động; bấm Dừng để thoát.
- Chuyển sang **Đồng Nai** để thấy dự án thí điểm DA-2026-017 (link nhanh có chế độ Đêm).

## Demo 0b — Nền GIS, quy hoạch, biên tập mô hình · ~10 phút
| # | Thao tác | Kết quả cần chỉ ra |
|---|---|---|
| 1 | Tab **Lớp → Nền bản đồ GIS**: Ảnh vệ tinh → Vệ tinh + nhãn → Đường phố → Ngoại tuyến | Ảnh vệ tinh Esri thật; phóng gần tự nạp ảnh cận cảnh z18 (≈ 0,6 m/pixel). Nền ngoại tuyến vẽ từ OSM, dùng khi mất mạng |
| 2 | Nhấp một nhà bất kỳ | Thông tin công trình: mã `osm:` mở được trên openstreetmap.org, phương pháp chiều cao (nguồn / số tầng / ước lượng), giấy phép ODbL |
| 3 | Nhóm **🗺️ Quy hoạch** → bật *Ô quy hoạch & chỉ tiêu* | Bản đồ chức năng sử dụng đất; ô gạch đỏ là ô vượt chỉ tiêu. Nhấp ô → bảng MĐXD / tầng cao / HSSDĐ: tối đa – hiện tại – kết luận |
| 4 | Nhóm **🛠️ Biên tập** → chọn nhà → đổi *Số tầng* 40 → *Áp dụng* | Khối nhà cao lên ngay; hệ thống báo ô quy hoạch có vượt chỉ tiêu không |
| 5 | Di chuyển ◀ ▶ ▲ ▼, xoay ⟲ ⟳, co giãn, ↶ hoàn tác / ↷ làm lại; *Xóa khỏi phương án* | Dữ liệu gốc OSM không bị sửa; nút *Khôi phục gốc OSM* |
| 6 | *Đặt khối: nhấp lên bản đồ* (hoặc *Vẽ mặt bằng*) | Khối mới; bật *Tô theo trạng thái biên tập* (đỏ = sửa, xanh = thêm) |
| 7 | Tab **Mô hình dự án**: cầu BR-01 đổi số nhịp, tĩnh không, số làn → *Áp dụng* | Cầu 3D dựng lại; bê tông/thép/chi phí sơ bộ; cảnh báo tĩnh không < 12 m (tham số demo) |
| 8 | *🧊 Mô phỏng BR-01 với thông số này* | Digital Twin ghi "Lấy từ mô hình đã chỉnh trên Bản đồ 3D" và dùng chiều dài/nhịp/tĩnh không mới |
| 9 | Chuyển Đồng Nai → khu DA-2026-017: đổi số khối, số tầng, cao độ san nền | GFA, MĐXD, HSSDĐ so với ô quy hoạch; khối lượng đào/đắp |
| 10 | Tab **Phương án**: *Lưu thành phương án* (A, B…) → *⚖ So sánh* → *Xuất JSON* | Bảng so sánh hiện trạng – các phương án: GFA, chiều cao, số ô vượt, thông số cầu/khu đất; xuất CSV |

> Lưu ý khi nói: ô quy hoạch và chỉ tiêu là **mô phỏng**; ảnh vệ tinh cần Internet.

## Demo 1 — Digital Twin & mô phỏng · ~10 phút
1. Ở tab **Digital Twin & Mô phỏng**, chạy kịch bản BR-01 (L1).
2. Mở thư viện kịch bản: có 18 kịch bản + **UR-01** (19 mô hình L1).
3. Nút **📍 Xem trên Bản đồ 3D** đưa về đúng vị trí trên MOD-00.
4. Chạy thêm mô phỏng san nền và ngập. Đây là điều kiện để cổng G2/G3 mở được ở Demo 4.
5. **Tham số và ngưỡng:** ở bước nhập tham số, mỗi kịch bản có nhóm *⚖ Ngưỡng chấp nhận (tham số demo)*. Đổi ngưỡng để thấy kết quả chuyển PASS ↔ FAIL.
6. Khối **🔬 Phân tích tham số** (dưới khung 3D) có 5 tab:
   - *Quét 1 tham số*: biểu đồ có đường ngưỡng và điểm chuyển trạng thái;
   - *Quét 2 tham số*: ma trận nhiệt PASS/WARNING/FAIL;
   - *Tornado*: tham số nào ảnh hưởng mạnh nhất;
   - *Monte Carlo*: xác suất FAIL;
   - *Bộ ca kiểm thử*: các ca Thông thường / Bất lợi / Cực đoan / Biên dưới, thêm ca tự định nghĩa, *Chạy toàn bộ 19 kịch bản*.
7. Xuất CSV hoặc *Lưu vào lịch sử run* để báo cáo/CDE thấy được.

## Demo 5 — CAD & Kết cấu (tab 📐 CAD & Kết cấu) · ~12 phút
| # | Thao tác | Kết quả cần chỉ ra |
|---|---|---|
| 1 | Mở tab: bản vẽ mẫu khung BTCT 7 × 5 trục (khối nhà DA-2026-017) | Nền tối, lưới trục có bong bóng tên trục, cột/dầm/sàn/vách/móng theo lớp S-* |
| 2 | Gõ `L` Enter → `0,0` → `@6000,0` → Enter; `REC`, `C`, `DLI`, `O`, `TR`, `M`, `CO`; F3/F8; `?` xem danh sách lệnh | Thao tác như AutoCAD: tọa độ tuyệt đối/tương đối/cực, bắt điểm cuối/trung điểm/giao/tâm/vuông góc |
| 3 | `TRUC` (vd `7200*6`), `COT` → `A`, `DAM` → `A`, `SAN` → `A`, `MONG` → `A`; `TANG` sửa số tầng, mác bê tông, vị trí | Dựng kết cấu nhanh; móng tự chọn kích thước theo phản lực |
| 4 | **▶ Phân tích** | 8 tiêu chí kỹ thuật với % khả năng chịu lực; chu kỳ T1, lực cắt đáy, chuyển vị đỉnh; danh sách cấu kiện bất lợi |
| 5 | **🧊 Mô hình 3D**, bật *Hình biến dạng* | Công trình 3D tô màu xanh → đỏ theo mức sử dụng; biến dạng theo tổ hợp gió/động đất |
| 6 | Tab **Vật liệu**: hạ "Hợp đồng" thép, giảm "Giao/tháng" bê tông | Báo THIẾU; tính số ngày trễ phần thân theo chu kỳ tầng |
| 7 | Tab **Kịch bản**: 🤖 sinh kịch bản → *Chạy tất cả* → *Xem 3D* bão cấp 14 | Bão/lũ/động đất/nắng nóng/vật liệu kém/thiếu cung ứng: đạt hay không, vì sao; mưa gió 3D |
| 8 | *AI đánh giá & đề xuất biện pháp*; tab Kết cấu → *🎲 Monte Carlo* → *💾 Lưu run sang Digital Twin* | Biện pháp kỹ thuật; xác suất vượt khả năng; run L2* trong Digital Twin |

| 9 | **🗺 Sa bàn trên bản đồ** → kéo *Tiến độ thi công*, đổi *Hướng xoay*, *🎥 Bay vòng tổng quan*, bỏ/tích *🔮 Xem tương lai* | Mô hình thiết kế đứng đúng vị trí thực trên ảnh vệ tinh; tầng đang thi công có cẩu tháp; so sánh hiện trạng ↔ tương lai; chỉ tiêu lô quy hoạch đạt/vượt |

> Lưu ý khi nói: bộ giải là demo **chưa kiểm định**; tham số vùng (W0, agR, R đất) cần tra số liệu chính thức. Có Claude API key thì AI đề xuất kịch bản theo vị trí.

## Demo 2 — Hồ sơ AI (tab 📝 Hồ sơ AI) · ~8 phút
1. Bấm **⚡ AI Khởi tạo bộ hồ sơ từ Digital Twin**.
   - Kết quả: 3 hồ sơ (Chủ trương, Dự toán, ĐTM) lấy số liệu từ mô hình.
   - Căn cứ trích theo bộ 2026: Luật XD 135/2025, NĐ 206/2026, TT 36/37/38/2026.
2. Bấm **📊 Xuất Excel Dự toán**: file 6 sheet có công thức sống.
   - Các sheet: Tổng hợp · Tiên lượng 3D · BOM/QTO · So sánh A-B-C · Nhu cầu theo tiến độ · Giả định & cảnh báo.
   - Mở bằng Excel, sửa một khối lượng → tổng tự tính lại.

## Demo 3 — Kiểm toán pháp lý 2026 (tab ⚖️ Pháp lý) · ~8 phút
1. Nhập **ngày thẩm định dự kiến** (mặc định 15/02/2027).
2. Bấm **⚖ AI Kiểm toán Pháp lý 2026** trên tờ trình mẫu. Kết quả:
   - 2 vị trí tô đỏ:
     - NĐ 10/2021 đã hết hiệu lực → thay bằng NĐ 206/2026.
     - Mật độ xây dựng 55 % vượt ngưỡng cho công trình 15 tầng.
   - Cảnh báo QCVN 01:2026 có hiệu lực 01/01/2027. Thẩm định sau ngày đó phải áp quy chuẩn mới.
3. Bấm **✨ Cập nhật căn cứ pháp lý chuẩn (1 nút)** → 0 lỗi. Bấm **💾 Lưu vào Hồ sơ AI**.
4. Bấm **↺ Nạp lại bản lỗi** nếu muốn diễn lại.
5. Gợi ý: đổi ngày thẩm định về trước 01/01/2027 để cho thấy quy tắc thay đổi theo thời điểm.

> Lưu ý khi nói: ngưỡng mật độ theo tầng cao là tham số demo, chưa phải bảng QCVN đã xác minh.

## Demo 4 — Liên thông sau khi hồ sơ hợp lệ · ~8 phút
1. Ở **Hồ sơ AI**, bấm **✅ Xác nhận hợp lệ & liên thông**:
   - Checklist tự tích các mục trọng yếu G0–G3.
   - Hồ sơ trên BPMN chuyển từ làn Chủ đầu tư/Tư vấn sang Sở Xây dựng (hoặc Sở NN&MT).
   - Hộp xác nhận: người có thẩm quyền bấm qua các cổng đủ điều kiện. Cổng G2/G3 cần mô phỏng ở Demo 1.
2. Mở các tab để chứng minh dữ liệu đã liên thông:
   - **Stage-Gate**: trạng thái cổng mới, nút 📍 Vị trí dự án.
   - **Checklist**.
   - **Phối hợp (BPMN)**: 7 làn theo chính quyền 2 cấp, gồm Sở NN&MT, Công an (PCCC), UBND cấp tỉnh/xã. Có bảng ánh xạ cơ quan – thời hạn xử lý theo tỉnh, chip vị trí mở bản đồ.
   - **Bản đồ 3D → Dashboard → Dự án & Stage-Gate**: trạng thái dự án mới.
3. Ở **Timeline 4D**, tới khối *Cung ứng vật liệu gắn tiến độ*:
   - Chọn kịch bản C (thép trễ 21 ngày) → đường găng G12 lùi khoảng 41 ngày, kèm chi phí.
   - Bấm **✔ Người quản lý duyệt cập nhật lịch kế hoạch** → Gantt cập nhật. Có nút *↺ Hủy duyệt*.

---

## Câu hỏi thường gặp khi trình diễn
- **Dữ liệu bản đồ có thật không?** Có, ở 2 cảnh mẫu: nhà, ranh phường, sông, sử dụng đất lấy từ OpenStreetMap; ảnh vệ tinh Esri. Riêng ô quy hoạch/chỉ tiêu, vị trí cầu BR-01 và phần lớn chiều cao nhà là mô phỏng/ước lượng, có ghi nhãn. Khi triển khai thật thay bằng CSDL địa phương, 3D Tiles và đồ án quy hoạch số.
- **Sao có khu trên ảnh có nhà mà không có khối 3D?** Nhà ở đó chưa được số hóa trên OSM; demo không tự sinh nhà giả.
- **Mất mạng thì sao?** Bản đồ tự chuyển nền vẽ từ OSM; mọi chức năng khác vẫn chạy.
- **Tại sao một số ô hiện "Chưa có"?** Theo nguyên tắc e-City: không có nguồn thì không hiển thị số.
- **Cổng không mở?** AI Gatekeeper chặn khi thiếu điều kiện, ví dụ chưa chạy mô phỏng hoặc hồ sơ còn lỗi pháp lý. Đây là hành vi đúng.
- **Làm lại từ đầu?** Xóa khóa localStorage `aipm-dt-demo-v3` rồi tải lại trang.
