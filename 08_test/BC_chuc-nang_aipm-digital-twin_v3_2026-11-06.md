# Báo cáo kiểm thử — Đợt 3: CAD 2D → 3D → Kết cấu → Vật liệu → Kịch bản cực đoan · Bản đồ chân thực
Phiên bản báo cáo: v3 | Ngày: 06/11/2026 | Người thực hiện (agent): lead-san-pham (tester + auto-test gộp)
Đối tượng: `dist/index.html` bản build 06/11/2026 (≈ 3,8 MB)
Căn cứ: yêu cầu bổ sung 06/11/2026, đã chốt 1A 2A 3A 4A (quyết định D13–D16; use case UC-07.1 … UC-07.8 trong `00_so_tay.md`)

## 1. Phạm vi
- **Tab mới 📐 CAD & Kết cấu:**
  - Bản vẽ 2D kiểu AutoCAD: dòng lệnh, khoảng 40 lệnh, bắt điểm, ORTHO, lớp, DXF.
  - Công cụ cấu kiện: trục, cột, dầm, sàn, vách, tường, móng.
  - Dựng 3D.
  - Bộ giải khung 3D bằng phần tử hữu hạn, kiểm tra theo TCVN.
  - Khối lượng vật liệu và đối chiếu cung ứng.
  - Kịch bản cực đoan, AI (Claude hoặc offline), Monte Carlo.
  - Lưu kết quả phân tích (run) sang Digital Twin.
- **Bản đồ 3D:**
  - mặt đứng có cửa sổ/tầng, ban đêm sáng đèn;
  - mái nhiều màu;
  - bóng đổ;
  - ô quy hoạch bám đường phố OSM.
- **Hồi quy:** toàn bộ 37 ca của đợt 1–2.

## 2. Kiểm chứng bộ giải (trước khi test giao diện)
| Bài toán | Kết quả bộ giải | Nghiệm giải tích |
|---|---|---|
| Công xôn 3 m, P = 10 kN | 4,44 mm | PL³/3EI = 4,44 mm |
| Dầm ngàm hai đầu 6 m, q = 20 kN/m: độ võng | 3,333 mm | qL⁴/384EI = 3,333 mm |
| Dầm ngàm hai đầu: mô-men / lực cắt đầu dầm | 60,0 kN·m / 60,0 kN | qL²/12 = 60 / qL/2 = 60 |
| Thanh ngàm hai đầu chịu nhiệt ΔT = 30 °C | 810,0 kN | EAαΔT = 810,0 kN |
| Khung cổng 1 tầng, tải ngang | 0,81 mm | nằm giữa hai cận 0,33 mm (dầm cứng) và 1,32 mm (công xôn) |

## 3. Kết quả tổng hợp
| Hạng mục | Số ca | Đạt | Tỷ lệ |
|---|---|---|---|
| Hồi quy đợt 1–2 | 37 | 37 | 100% |
| CAD & Kết cấu (UC-07.1–07.8) | 8 | 8 | 100% |
| Sa bàn (UC-07.9, bổ sung 06/11) | 1 | 1 | 100% |
| **Tổng** | **46** | **46** | **100%**, 0 lỗi JS |

| UC | Kết quả đo được |
|---|---|
| UC-07.1 | Các lệnh L, REC, C, DLI (kích thước 6.000 mm), O, TR, CO, U/REDO chạy đúng; DIST cho 5.000 mm. |
| UC-07.2 | Lưới trục `7200*4 / 7500*3`; cột, dầm, sàn, móng tự động: 35 cột · 58 dầm · 24 sàn · 37 móng. |
| UC-07.3 | Khung mẫu 12 tầng: 481 nút, 2.664 bậc tự do. Giải và kiểm tra mất khoảng 0,2–0,5 s. Đạt 8/8 tiêu chí: cột 81 %, dầm 74 %, độ võng 24 %, lệch tầng do gió 55 %, động đất 73 %, móng 100 %. |
| UC-07.4 | Dựng 3D từ bản vẽ; tô màu theo mức sử dụng; hình biến dạng phóng đại 80 lần. |
| UC-07.5 | Mặc định đủ vật liệu. Hạ hợp đồng thép xuống 300 t → báo THIẾU. Bê tông giao 200 m³/tháng → trễ phần thân khoảng 490 ngày. |
| UC-07.6 | 7 kịch bản: 3 đạt, 4 không đạt (bão cấp 14, lũ ngập móng, động đất 0,10g, thiếu/trễ thép). AI offline đề xuất biện pháp. Monte Carlo: P(vượt) = 13,7 %. |
| UC-07.7 | Xuất DXF R12 37 KB; nhập lại tạo 246 đối tượng. |
| UC-07.9 | Từ CAD đưa mô hình lên khu đất thật (6 khối × 12 tầng, 44 × 31 m); khu đất đồng bộ số tầng/kích thước; tiến độ 50 % → 6/12 tầng + cẩu tháp; xoay 30°; bật/tắt tương lai. Sa bàn báo vượt chỉ tiêu vì lô mô phỏng là Nông nghiệp (≤ 4 tầng). |
| UC-07.8 | Run `FEM_FRAME3D` mức L2* (chưa V&V) lưu vào lịch sử Digital Twin; tab Digital Twin có nút dẫn sang màn CAD. |

## 4. Phát hiện (đã xử lý trong đợt)
| Mã | Mô tả | Loại | Xử lý | Trạng thái |
|---|---|---|---|---|
| BUG-11 | Giải mất khoảng 20 s: nút đánh số lộn xộn làm ma trận băng rộng 6.611 | Kỹ thuật | Sắp xếp nút theo tầng; dầm 1 phần tử/nhịp, giữa nhịp tính giải tích → băng 227, ~150 ms | Đóng |
| BUG-12 | Chuyển vị đỉnh do gió 1,5 m: vách lõi đứng tự do, không nối với sàn | Thiết kế mô hình tính | Thêm liên kết sàn cứng nối vách với cột (chỉ truyền lực ngang) → 29,5 mm | Đóng |
| BUG-13 | Sai công thức khả năng chịu cắt dầm; Monte Carlo thu nhỏ độ lệch chuẩn | Kỹ thuật | Sửa theo Qb + Qsw; độ lệch chuẩn đúng giá trị khai báo | Đóng |
| BUG-14 | Khung mẫu ban đầu: cột sát giới hạn (97 %), móng thiếu | Thiết kế mẫu | Tăng cột (cột giữa 850 mm); tự chọn kích thước móng | Đóng |
| BUG-15 | ROTATE/CIRCLE không nhận số gõ vào (ký tự `\d` bị mất khi vá mã) | Kỹ thuật | Sửa biểu thức chính quy | Đóng |
| BUG-16 | Thanh công cụ và thanh điều hướng bị tràn sau khi thêm tab CAD | Giao diện | Thanh công cụ xuống dòng; thu gọn đệm tab | Đóng |

## 5. Hạn chế và khuyến nghị
- **Bộ giải và cách kiểm tra là bản demo chưa kiểm định (V&V):**
  - đàn hồi tuyến tính, độ cứng nứt quy ước (cột 0,7EI, dầm 0,35EI);
  - tương tác N–M tuyến tính (bảo thủ), độ võng nhân 2,0;
  - gió tĩnh (chưa xét thành phần động), động đất theo phương pháp lực ngang tương đương.
  
  Hồ sơ thật phải thẩm tra bằng ETABS/SAP2000/Midas; kỹ sư có thẩm quyền quyết định.
- **W0, agR, sức chịu tải đất, cấp phối, hao hụt là tham số demo** theo vùng. Phải tra QCVN 02:2022/BXD, TCVN 9386:2012, báo cáo địa chất và định mức hiện hành.
- **Bản vẽ kết cấu là một mặt bằng tầng điển hình** áp dụng cho mọi tầng; chưa hỗ trợ tầng khác nhau, dầm công xôn, móng cọc.
- **AI:** khi có Claude API key, Claude đề xuất kịch bản và diễn giải kết quả; tham số Claude đưa ra được kẹp trong miền hợp lệ. Phần tính toán luôn chạy cục bộ.
