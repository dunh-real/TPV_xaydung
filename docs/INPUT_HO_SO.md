# Input và sinh hồ sơ theo template 01–04

Chạy bằng `npm run dev` hoặc `npm run build` rồi `npm run preview`. Cần Node như README và Python 3 (`python3` trên PATH, hoặc khai báo `PYTHON_BIN` trong `.env`). API hồ sơ chạy cùng Vite, không cần mở thêm backend. Mở riêng `dist/index.html` hoặc đưa riêng HTML lên hosting tĩnh sẽ không có API xuất template/gọi Qwen.

`.env.example` chứa cấu hình Qwen đã yêu cầu. Server đọc các biến `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_ENABLE_THINKING`; có thể sao chép thành `.env` để thay đổi. Key không được gửi xuống trình duyệt. Endpoint hiện là địa chỉ mạng riêng, máy chạy Vite cần truy cập được mạng đó.

## Sử dụng

1. Nhập thông tin trong **Dự án**, chọn và chỉnh phương án trên **Digital Twin**; chạy/ghi nhận đào đắp nếu cần.
2. Vào **Hồ sơ AI → Bổ sung input hồ sơ**. Nhập JSON theo `examples/report-input.json`; null để trống, giữ số 0 khi thực sự bằng 0. Đơn giá cần cả `value` và `source`. Tỷ lệ chi phí dùng 0..1, ví dụ `0.02` là 2%.
3. Nhấn **Đóng gói input JSON** để lấy snapshot dữ liệu đã gom từ các module. Nhấn từng mẫu hoặc **Tạo bộ hồ sơ 01–03 & Excel 04**.
4. Xuất Word `.docx` hoặc Excel `.xlsx`. Chỉnh sửa văn bản trong preview rồi bấm Lưu/Word sẽ được mang vào DOCX. Với template, nên sửa nội dung trong từng đoạn, giữ các đoạn/bảng của mẫu.

Mặc định Qwen soạn diễn giải cho mẫu 01 và 03. Mẫu 02 điền trực tiếp thông tin, mẫu 04 tính bằng công thức, không cần gọi LLM. **Cài đặt AI → Mô phỏng offline** sẽ chỉ điền template. Khi Qwen lỗi, ứng dụng báo lỗi để thử lại/chuyển chế độ, không âm thầm tạo nội dung thay thế.

## Gói dữ liệu

`buildReportInput(state)` trong `src/lib/report-input.js` trả về:

```json
{
  "schemaVersion": "aipm.report-input/1.0",
  "generatedAt": "...",
  "projectCode": "...",
  "versions": { "dataVersion": null, "modelVersion": null, "designRevision": 0 },
  "values": { "project_name": "...", "site_area": 179.35, "ww_capacity": null, "unit_prices": {} },
  "sources": { "site_area": { "source": "...", "status": "demo", "unit": "m²" } },
  "missing": { "proposal": [], "feasibility": [], "eia": [], "estimate": [] },
  "warnings": [],
  "modules": { "planning": null, "cad": null, "map": {}, "twin": {}, "workflow": {} }
}
```

`values` là dữ liệu điền template; `sources` ghi xuất xứ/trạng thái từng trường (`demo`, `unverified`, `missing`). `missing` là các trường cần cho từng mẫu, không phải kết luận hồ sơ đủ điều kiện pháp lý. Các mục tùy trường hợp vẫn có thể có dấu `[Cần bổ sung: ...]` trong văn bản.

`modules` giữ bản chụp mô hình, CAD/QTO/cung ứng, phiên bản dữ liệu, run mô phỏng và Stage-Gate/checklist để truy vết. LLM chỉ nhận `values`, `sources`, `warnings`, không nhận toàn bộ hình học hoặc lịch sử module. LLM chỉ trả các đoạn diễn giải cho phép, không được ghi đè dữ liệu số hay phần xác nhận/quan trắc/tham vấn.

| Nguồn | Dữ liệu được dùng |
|---|---|
| `project` | Tên/mã dự án, chủ đầu tư, địa điểm, nhóm/loại công trình, người quyết định, nguồn vốn |
| Digital Twin | Mô hình A/B/C đã áp dụng `planEdits`, công trình thêm/xóa; diện tích chiếm đất, tổng sàn, tầng cao, chiều cao, dân số/số căn tham chiếu |
| `engine.SITE` và `demGrid()` | Ranh/diện tích và cao độ tham chiếu, ghi rõ hệ tọa độ cục bộ demo |
| Twin đào đắp | Chỉ lấy khối lượng khi `twin.earthwork=true` và có `twin.pad`; L1, không nhận là LiDAR đã kiểm định |
| CAD & Kết cấu | QTO và cung ứng trong `modules.cad`. Chọn `model_scope: "cad"` để lấy footprint từ sàn CAD (mm² → m²), tổng sàn theo số tầng và chiều cao của một khung CAD |
| Input bổ sung | Cấp/thời hạn công trình, số thửa/tờ bản đồ, địa điểm, quy hoạch được duyệt, cơ cấu vốn, nhà thầu, nguồn pháp lý, hạ tầng, công suất XLNT, quan trắc/tham vấn, đơn giá và tỷ lệ chi phí |

Các giá trị bổ sung có ưu tiên cao hơn số liệu tự động và được ghi nguồn `report.inputs`. Khi đổi diện tích khu đất, phải kiểm tra lại phạm vi mô hình/khối lượng. Không tự ghép quy mô một khung CAD với dân số toàn khu. Mô hình sa bàn bản đồ được giữ trong `modules.map`, không tự coi là bản thiết kế đã phê duyệt.

DEM đo thực hiện mới thay bề mặt hiển thị trong dự án gốc. Bộ gom vẫn ghi nguồn cao độ/đào đắp là engine tham chiếu; cần dữ liệu tính đã đối soát hoặc input bổ sung để dùng hồ sơ thật. Không tự lấy chiều dài cống bằng hai lần chiều dài đường; không suy công suất XLNT từ diện tích/dân số; không tự lấy đơn giá minh họa làm giá được duyệt.

## Template và công thức

`templates/` chứa bản sao 4 file người dùng cung cấp, thêm bản DOCX chuyển từ mẫu 01 `.doc`. Các file gốc không bị chỉnh sửa. `server/templates.py` điền bản sao XML trong DOCX/XLSX, giữ những package part còn lại. Preview HTML giữ thứ tự đoạn/bảng để chỉnh nội dung; bố cục trang chính thức nằm trong file Office.

Mẫu 01 hỗ trợ một nhà đầu tư và một mục tiêu chính trong bảng; các dòng còn lại của mẫu để bổ sung khi có nhiều nhà đầu tư/ngành. Có các trường riêng cho VSIC/CPC, vốn góp, vốn vay, USD, nguồn tỷ giá, phương thức và tiến độ góp vốn. Không tự quy đổi ngoại tệ.

Mẫu 04 giữ 6 sheet `Dau_vao`, `Don_gia`, `Du_toan`, `Tong_muc`, `Quy_hoach`, `Kiem_tra`. Khối lượng, đơn giá, tỷ lệ là kiểu số. Công thức gốc được bọc điều kiện thiếu đầu vào để không hiển thị tổng 0/OK gây hiểu nhầm; Excel/LibreOffice tính lại khi mở. Tổng mức trong input và bảng tính dùng cùng công thức, chưa VAT; lượng cấp bù chỉ là `max(0, đắp − đào)`, chưa xét hệ số vật liệu. Mọi đơn giá phải có nguồn do người dùng cung cấp.

Mỗi hồ sơ giữ snapshot input và đoạn LLM đã tạo; đổi module không sửa hồ sơ cũ. Xuất lại không gọi LLM lần nữa. Quy tắc kiểm tra pháp lý cũ vẫn là CSDL demo; không dùng nút thay căn cứ tự động cho hồ sơ template.

## Kiểm thử

```bash
node --test tests/report-input.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
```

Khi Vite chạy cổng 5178: `node tests/report-smoke.mjs`; thêm `--llm` để kiểm tra thật Qwen. Có thể đổi cổng qua `REPORT_TEST_URL`. Script smoke ghi file kiểm tra vào thư mục tạm, mặc định `/tmp/aipm-template-qa`.

### Chọn công trình trên Bản đồ 3D

Nhấp công trình → **Chi tiết → Dùng cho Hồ sơ AI**. Ứng dụng lưu snapshot công trình, nguồn chiều cao, hình học, phường/tỉnh, ô quy hoạch mô phỏng và phiên bản dữ liệu. Trong Hồ sơ AI, chọn mẫu 01–04; có thể tải gói input JSON để đối chiếu toàn bộ thông tin tại `modules.map.building`.

`model_scope: "map"` điền tên, loại, vị trí, mặt bằng, chiều cao, số tầng và tọa độ quy đổi. Không lấy số liệu Twin/CAD của khu demo, không dùng mặt bằng làm diện tích đất và không tự nhân số tầng thành tổng sàn. Các trường thiếu bổ sung bằng **Bổ sung input hồ sơ**. AI nhận cả snapshot nguồn để diễn giải đúng giới hạn dữ liệu; ô quy hoạch mô phỏng không xác nhận quy hoạch được duyệt.

Input bổ sung được giữ riêng theo công trình. **Dùng dữ liệu dự án / Twin** quay về input dự án trước đó. Khi công trình được biên tập tiếp, bấm lại **Dùng cho Hồ sơ AI**, rồi tạo lại mẫu để cập nhật; hồ sơ cũ giữ snapshot.

Đầu vào mặc định được hardcode tại `src/data/report-building.json`: Times Square, HCM-B-000138, OSM w165491082. Lần đầu vào Hồ sơ AI sau cập nhật sẽ tự nạp snapshot này, giữ input dự án trước đó để quay lại. File phương án A ngày 07/11/2026 không có chỉnh sửa nên dùng hình học và thông tin từ dữ liệu OSM đóng gói hiện tại. Thông tin không có trong nguồn vẫn để trống.
