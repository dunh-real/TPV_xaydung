# AIPM OS × AI Digital Twin — Sản phẩm demo (v2.0 · quy mô toàn quốc)

Đây là bản Demo/PoC cho nền tảng AI Digital Twin & Quản trị Dự án Xây dựng theo SRS v2.0 (04/11/2026): **MOD-00 Bản đồ 3D toàn quốc (tham chiếu e-City) + 6 module chuyên môn**. Mọi dự án, hồ sơ, cổng Stage-Gate và công việc BPMN đều có vị trí trên một nền bản đồ 3D chung 34 tỉnh/thành.

Tài liệu sản xuất: `00_so_tay.md` (quyết định, phân tích khoảng trống, use case) · `08_test/` (báo cáo + script kiểm thử) · `09_ban_giao/` (README chạy thử, hướng dẫn sử dụng).

Dữ liệu khung AIPM OS (G0–G16, bước, checklist, BPMN, RACI, rủi ro, pháp lý) là cấu hình demo và phải được đối soát phạm vi trước khi chốt baseline sản xuất. Các nhóm số liệu thống kê có thể không cùng phạm vi áp dụng.

## Yêu cầu môi trường

- Windows 10/11, macOS hoặc Linux.
- Node.js `^20.19.0` hoặc `>=22.12.0` và npm đi kèm.
- Chrome hoặc Microsoft Edge phiên bản tương đối mới, có WebGL.

Kiểm tra môi trường trong PowerShell:

```powershell
node --version
npm.cmd --version
where.exe node
where.exe npm
```

Nếu `node` không được nhận diện, hãy cài Node.js từ trang chính thức, đóng terminal cũ rồi mở terminal mới.

## Chạy project trên Windows PowerShell

**Luồng hồ sơ template 01–04 + Qwen (cập nhật):** xem [Input hồ sơ](docs/INPUT_HO_SO.md). Cần thêm Python 3 để xuất DOCX/XLSX. Chạy bằng Vite để có API hồ sơ; mở riêng HTML không có các API này.

Trên macOS:

```bash
cd "/Users/binhphuccompany/Documents/TPV/xaydung/aipm-digital-twin-demo"
npm ci
cp .env.example .env
npm run dev
```

### 1. Mở đúng thư mục project

```powershell
Set-Location -LiteralPath 'G:\Shared drives\Phong\Code demo\aipm-digital-twin-demo'
Get-ChildItem package.json
```

### 2. Cài thư viện

Trong PowerShell, nên gọi trực tiếp `npm.cmd` để tránh việc PowerShell chặn `npm.ps1`:

```powershell
npm.cmd install
```

Lệnh này đọc `package.json`/`package-lock.json` và tạo hoặc cập nhật thư mục `node_modules`.

### 3. Chạy chế độ phát triển

```powershell
npm.cmd run dev
```

Sau khi Vite báo `ready`, mở địa chỉ được in trong terminal, mặc định `http://localhost:5173`. Không đóng terminal đang chạy Vite. Khi muốn dừng server, nhấn `Ctrl+C`.

### 4. Chạy bằng cổng khác khi cổng 5173 đang bận

```powershell
npm.cmd run dev -- --port 5174
```

Sau đó mở `http://localhost:5174`.

### 5. Cho máy khác trong cùng mạng truy cập

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Vite sẽ in thêm địa chỉ `Network`. Windows Firewall có thể yêu cầu cho phép Node.js nhận kết nối. Chỉ bật tùy chọn này trên mạng tin cậy.

## Lỗi `npm.ps1 cannot be loaded because running scripts is disabled`

Đây là chính sách thực thi script của PowerShell. Khi gõ `npm`, PowerShell ưu tiên file `C:\Program Files\nodejs\npm.ps1`, nhưng máy đang chặn script `.ps1`. Đây không phải lỗi của project và cũng không có nghĩa Node/npm bị hỏng.

### Cách 1 — Khuyến nghị: dùng `npm.cmd`

Không cần đổi chính sách hệ thống:

```powershell
npm.cmd install
npm.cmd run dev
```

### Cách 2 — Dùng Command Prompt

Mở `cmd.exe`, chuyển vào project rồi dùng lệnh npm bình thường:

```bat
cd /d "G:\Shared drives\Phong\Code demo\aipm-digital-twin-demo"
npm install
npm run dev
```

### Cách 3 — Chỉ cho phép trong cửa sổ PowerShell hiện tại

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm run dev
```

Thiết lập này tự mất khi đóng cửa sổ PowerShell và thường không cần quyền Administrator.

### Cách 4 — Thiết lập cho tài khoản hiện tại

Chỉ dùng khi bạn hiểu chính sách bảo mật của máy:

```powershell
Get-ExecutionPolicy -List
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Đóng và mở lại PowerShell rồi thử `npm --version`. Trên máy công ty có Group Policy, không nên cố ghi đè chính sách quản trị; hãy dùng `npm.cmd` hoặc `cmd.exe`.

## Build bản production

### 1. Tạo file build

```powershell
npm.cmd run build
```

Kết quả là file đơn `dist/index.html`.

### 2. Kiểm tra bản production bằng server preview

```powershell
npm.cmd run preview
```

Mở địa chỉ Vite in ra, mặc định `http://localhost:4173`. Dừng bằng `Ctrl+C`.

Vì project dùng `vite-plugin-singlefile`, có thể mở trực tiếp `dist/index.html` bằng Chrome/Edge sau khi build. Chạy qua `preview` vẫn được khuyến nghị vì gần với môi trường web thật hơn.

### 3. Đưa lên hosting tĩnh

Có thể triển khai nội dung thư mục `dist` lên Vercel, Netlify hoặc máy chủ web tĩnh. Entry point là `dist/index.html`.

## Xử lý sự cố thường gặp

### `npm.cmd install` không tải được package

- Kiểm tra Internet, proxy/VPN và quyền truy cập `registry.npmjs.org`.
- Chạy `npm.cmd config get registry`; giá trị mặc định thường là `https://registry.npmjs.org/`.
- Nếu dùng mạng doanh nghiệp, hỏi quản trị viên về proxy/chứng chỉ thay vì tắt kiểm tra SSL.

### Vite báo cổng đang được sử dụng

```powershell
npm.cmd run dev -- --port 5174
```

### Trang mở được nhưng không thấy mô hình 3D

- Dùng Chrome/Edge mới và bật Hardware Acceleration.
- Kiểm tra WebGL tại `chrome://gpu` hoặc `edge://gpu`.
- Tải lại bằng `Ctrl+F5` và xem lỗi trong DevTools (`F12` → Console).

### Muốn đưa demo về trạng thái ban đầu

Trong ứng dụng, bấm **📁 Dự án** → **Khôi phục dữ liệu demo**. Thao tác này xóa trạng thái demo trong `localStorage`, không xóa file nguồn của project.

## AI
- Mặc định gọi **Qwen/Qwen3.6-35B-A3B-FP8** qua server cùng origin, `LLM_ENABLE_THINKING=false`. Cấu hình endpoint và key nằm trong `.env`/biến môi trường, theo `.env.example`.
- Trong **Cài đặt AI**, chọn **Mô phỏng offline** để dùng câu trả lời mẫu và điền template không gọi LLM.
- **Hồ sơ AI** dùng 4 template gốc trong `templates/`, xuất DOCX/XLSX; có nút bổ sung input và đóng gói JSON. Danh mục input: `examples/report-input.json`, schema tương ứng và `docs/INPUT_HO_SO.md`.

## Kịch bản trình diễn (45–60 phút)

0. **Demo 0 — Bản đồ 3D toàn quốc (tab 🗺️ Bản đồ 3D):** toàn quốc 34 tỉnh/thành → chọn TP.HCM hoặc Đồng Nai → nhóm **Dữ liệu** (xã/phường, nguồn chiều cao) → tab **Lớp**: Ngày/Giờ vàng/Đêm, *Mưa · triều · ngập* (có nhãn nguồn) → nhóm **Phân tích** → *Phân tích tại tâm* 1 km² → nhấp cầu **BR-01** → *Thông tin công trình* → **Mở dự án/kịch bản BR-01** → **📊 Dashboard** (Tổng quan, Quy hoạch & hồ sơ, Dự án & Stage-Gate) → **🔗 Deep-link** có phiên bản.
   - Link nhanh: `#map?v=VN-2026.11-r2&focus=hcm&view=province&sel=BR-01` · `#map?focus=dong-nai&view=province&sel=DA-2026-017` · thêm `&bm=offline|street|topo|hybrid` để chọn nền
0b. **Nền GIS · quy hoạch · biên tập (đợt 2):** tab **Lớp → Nền bản đồ GIS** (ảnh vệ tinh Esri / vệ tinh + nhãn / đường phố / địa hình / ngoại tuyến vẽ từ OSM; phóng gần tự nạp ảnh cận cảnh z18) → nhóm **🗺️ Quy hoạch**: bật *Ô quy hoạch & chỉ tiêu* (mô phỏng), nhấp ô vượt chỉ tiêu → nhóm **🛠️ Biên tập**: chọn nhà → đổi tầng/di chuyển/xoay/xóa, *Đặt khối* mới → kiểm tra chỉ tiêu tức thì → tab *Mô hình dự án*: sửa cầu BR-01 (dài, nhịp, tĩnh không, làn) hoặc khu DA-2026-017 (khối, tầng, san nền) → tab *Phương án*: lưu A/B, ⚖ so sánh, xuất/nhập JSON → *Mô phỏng BR-01 với thông số này* sang Digital Twin.
1. **Tổng quan:** giới thiệu kiến trúc MOD-00 + 6 module và ba nhóm người dùng.
2. **Dữ liệu đa nguồn:** nạp bộ mẫu IFC + DEM đo mặt đất + point cloud TLS; xem trạng thái `VALIDATED`, CRS, checksum, `dataVersion` và `modelVersion`.
3. **Phương án & QTO:** sinh ba phương án tổng mặt bằng ở mức L1; xem QTO/BOM có GlobalId nguồn và so sánh A/B/C mà không sửa baseline.
4. **Thư viện 18 kịch bản + UR-01 (khu vực):** lọc đủ mã BR/BD/TU/CS/RD/HY/IN/UR; UR-01 chạy trên vùng chọn ở Bản đồ 3D; từng kịch bản có bộ tham số, metric, timeseries và cảnh 3D riêng để chạy thử L1.
5. **Scenario sandbox:** thay tải trọng, hình học hoặc điều kiện môi trường rồi chạy lại; BR-01 vẫn chặn trường hợp số xe đồng thời không phù hợp hình học cầu. Mỗi kịch bản có thêm tham số và **⚖ ngưỡng chấp nhận** (PASS/WARNING/FAIL). Khối **🔬 Phân tích tham số**: quét 1 tham số (điểm chuyển trạng thái), quét 2 tham số (ma trận nhiệt), tornado độ nhạy, Monte Carlo (xác suất FAIL), **bộ ca kiểm thử** (Thông thường/Bất lợi/Cực đoan/Biên dưới + ca tự định nghĩa; chạy cả 19 kịch bản).
6. **Readiness L2:** yêu cầu mức L2 để thấy hệ thống chặn do thiếu mô hình tính, điều kiện biên, ruleSet và solver đã V&V.
7. **Kết quả khu đất:** ghi nhận đào đắp/nước mặt L1 với giả định và giới hạn phương pháp.
8. **Hiện trạng 4D:** nhập bản cập nhật hiện trạng đa nguồn; tạo diff/nhiệm vụ rà soát, không tự đổi baseline hay khối lượng nghiệm thu.
8b. **Demo 2 — Hồ sơ AI:** *⚡ AI Khởi tạo bộ hồ sơ từ Digital Twin* (Chủ trương + Dự toán + ĐTM) và **Excel dự toán 6 sheet có công thức** (Tổng hợp · Tiên lượng 3D · BOM/QTO · So sánh A-B-C · Nhu cầu theo tiến độ · Giả định).
8c. **Demo 3 — Pháp lý:** khu *AI Kiểm toán Pháp lý 2026*: tờ trình mẫu cài sẵn 2 lỗi (NĐ 10/2021 → NĐ 206/2026; MĐXD vượt QCVN) + cảnh báo QCVN 01:2026 hiệu lực 01/01/2027 theo ngày thẩm định dự kiến → *Cập nhật căn cứ chuẩn (1 nút)*.
8d. **Demo 4 — Liên thông:** trong Hồ sơ AI bấm *✅ Xác nhận hợp lệ & liên thông* → tích checklist, chuyển làn BPMN, mở cổng đủ điều kiện (người có thẩm quyền xác nhận); Timeline có panel *cung ứng vật liệu 4D/5D*.
9. **Báo cáo/CDE:** xuất DXF/SVG/PNG/GLB và báo cáo run có `runId`, `inputHash`, version, L0–L3 và disclaimer.
9b. **Demo 5 — CAD & Kết cấu (tab 📐):** bản vẽ 2D kiểu AutoCAD (dòng lệnh L/PL/REC/C/M/CO/O/TR…, bắt điểm F3, ORTHO F8, lớp, DXF) → lệnh kết cấu TRUC/COT/DAM/SAN/VACH/MONG → **▶ Phân tích** (khung 3D phần tử hữu hạn, 8 tiêu chí TCVN) → 🧊 3D tô mức sử dụng / biến dạng → tab **Vật liệu** (đủ/thiếu, kịp tiến độ) → tab **Kịch bản** (bão, lũ, động đất, nắng nóng, vật liệu kém, thiếu cung ứng; 🤖 Claude/offline; Monte Carlo) → lưu run sang Digital Twin → **🗺 Sa bàn trên bản đồ**: đặt đúng mô hình thiết kế (tỉ lệ thật) vào khu đất DA-2026-017 trên ảnh vệ tinh, chỉnh số khối/hướng/tiến độ thi công, bật/tắt hiện trạng ↔ tương lai.
10. **Hồ sơ, Stage-Gate, BPMN, Timeline:** minh họa liên thông nhưng phê duyệt vẫn thuộc người có thẩm quyền.

## Tương tác mô hình và mô phỏng

- Trong **Dữ liệu**, kéo thả DEM đo thực dạng ESRI ASCII Grid (`.asc`) hoặc tập điểm `x y z` (`.xyz`). Cảnh 3D sẽ thay bề mặt địa hình và HUD hiển thị tên tệp, cao độ nhỏ nhất/lớn nhất.
- DEM nhập trong bản demo được nội suy vào khung khu đất để thử nghiệm tương tác. Triển khai dự án thật cần giữ nguyên CRS, mốc cao độ, phạm vi XY và kiểm định với hồ sơ khảo sát.
- Trong **Phương án & QTO → Phương án**, chọn phương án rồi dùng **Chỉnh mô hình quy hoạch** để đổi tọa độ, kích thước, số tầng, chiều cao tầng và vật liệu.
- Bấm **Kéo thả trên mặt bằng 2D**, giữ chuột trên khối nhà và kéo tới vị trí mới. Khi thả, hệ thống tạo `modelVersion` revision mới.
- Có thể nhân bản hoặc xóa khối. Thay đổi trong sandbox không tự cập nhật baseline đã duyệt.
- Trong **QTO/BOM A-B-C**, có thể sửa net quantity, hao hụt và đơn giá rồi tính lại lượng đặt mua/chi phí.
- Cả 18 kịch bản có input riêng và chạy được ở mức **L1 Screening**. Thay input sẽ tính lại metric, trạng thái, timeseries và lớp 3D theo nhóm công trình.
- Mức **L2** vẫn yêu cầu mô hình tính, điều kiện biên, solver chuyên ngành và hồ sơ V&V; kết quả L1 không phải kết luận an toàn.

Nút **📁 Dự án** dùng để sửa thông tin dự án, hoặc **khôi phục dữ liệu demo** trước mỗi buổi trình diễn.

## Lưu ý
- Địa hình, QTO, chi phí, đơn giá và run BR-01 là **dữ liệu tham chiếu/minh họa**. Hồ sơ thật phải dùng dữ liệu dự án đã kiểm chứng.
- L0 là minh họa; L1 chỉ sàng lọc. L2 cần solver và hồ sơ V&V; L3 cần kỹ sư có thẩm quyền xác nhận.
- Văn bản pháp lý: demo không bịa số hiệu. Văn bản nào chưa chắc chắn được gắn nhãn [Cần xác minh]. Bộ căn cứ 2026 theo SRS v2.0 mục 7.9; ngưỡng MĐXD theo tầng cao là **tham số cấu hình demo**, cần xác minh với bảng QCVN.
- Bản đồ 3D (dataset r2): 02 cảnh 6 × 6 km dùng **dữ liệu GIS thật** — công trình, ranh phường (admin_level 6 sau sắp xếp 2025), thủy hệ, sử dụng đất, cơ sở dịch vụ từ **OpenStreetMap (ODbL)**, DEM **SRTM/Terrarium**, ảnh nền **Esri** tải khi chạy (cần Internet; mất mạng tự chuyển nền vẽ từ OSM). Ranh OSM là lớp tạm, không phải ranh pháp lý; độ phủ nhà OSM chưa đầy đủ. **Ô quy hoạch và chỉ tiêu là mô phỏng**. Cầu BR-01 đặt ở vị trí vượt sông **minh họa**. Làm mới dữ liệu: `node tools/fetch_gis.cjs`.
- Nguyên tắc: **AI đề xuất – Kỹ sư quyết định và chịu trách nhiệm.**

## Cấu trúc mã
- `src/views/cad.js`: màn CAD 2D (dòng lệnh, bắt điểm, lớp, lệnh vẽ/sửa/kết cấu), bảng thuộc tính/kết cấu/vật liệu/kịch bản
- `src/lib/struct/fem.js`: bộ giải khung 3D (phần tử dầm 12 bậc tự do, ma trận băng, nhiều trường hợp tải)
- `src/lib/struct/design.js`: bản vẽ → mô hình tính, tải trọng (gió, động đất, nhiệt), tổ hợp, kiểm tra TCVN 5574, khối lượng, cung ứng, kịch bản cực đoan, Monte Carlo, khung mẫu
- `src/lib/cad/dxf.js`, `src/lib/cad/view3d.js`: DXF R12 vào/ra; khung nhìn 3D công trình
- `tools/fetch_gis.cjs`: tải 1 lần dữ liệu OSM (Overpass) + DEM Terrarium → `src/data/osm/<tenant>.json`
- `src/views/map-edit.js`: ô quy hoạch & chỉ tiêu, biên tập công trình/mô hình dự án, phương án (lưu, so sánh, hoàn tác, xuất/nhập)
- `src/views/map.js`, `src/views/map-dashboard.js`: MOD-00 — thanh bên 9 nhóm, bảng thông tin 5 tab, Điều hành 5 tab, phân tích khu vực, vùng quản lý, Tương lai, đăng nhập theo địa bàn, deep-link, Dashboard đa cấp
- `src/lib/citymap3d.js`: trình xem 3D toàn quốc → tỉnh (Three.js): nền tile Esri Web Mercator + cận cảnh z18, công trình OSM ép khối theo mặt bằng (sửa tại chỗ), lớp phủ dán địa hình, cầu/khu đất theo tham số; thay được bằng CesiumJS/3D Tiles
- `src/lib/citygen.js`: dựng cảnh từ dữ liệu GIS (provenance chiều cao), ô quy hoạch mô phỏng, áp phương án biên tập, phân tích khu vực, UR-01 trên DEM thật
- `src/data/nationwide.js`: 34 tenant, registry nguồn, tài liệu quy hoạch, danh mục dự án, ánh xạ làn BPMN ↔ cơ quan (chính quyền 2 cấp)
- `src/lib/xlsx.js`: xuất Excel dự toán nhiều sheet có công thức
- `src/lib/engine.js`: địa hình DEM, sinh quy hoạch, san nền, ngập, nắng, thi công, 4D, chi phí
- `src/lib/terrain-loader.js`: đọc DEM đo thực `.asc`/`.xyz` và chuẩn hóa lưới hiển thị
- `src/data/digital-twin.js`: dataset mẫu, 18 kịch bản, mức L0–L3 và QTO/BOM
- `src/lib/simulation-lab.js`: tham số + ngưỡng 19 kịch bản, quét 1/2 tham số, tornado, Monte Carlo, bộ ca kiểm thử
- `src/views/twin-v2.js`: luồng nhập dữ liệu → QTO → scenario → run → báo cáo
- `src/lib/scene3d.js`: cảnh 3D (Three.js): point cloud, địa hình, công trình và lớp BR-01 L0
- `src/lib/drawing.js`: bản vẽ 2D SVG và xuất DXF
- `src/lib/docgen.js`: sinh hồ sơ từ dữ liệu Digital Twin
- `src/lib/ai.js`: gọi Claude API, trả lời offline, quy tắc pháp lý, kiểm tra thể thức
- `src/views/*`: 9 màn hình
- `src/store.js`: trạng thái và AI Gatekeeper
