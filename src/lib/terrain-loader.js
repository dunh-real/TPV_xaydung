// Parser nhẹ cho địa hình đo thực, chạy hoàn toàn trong trình duyệt.
// Hỗ trợ ESRI ASCII Grid (.asc) và point XYZ (.xyz: x y z hoặc x,y,z).

let activeTerrain = null;

export const getActiveTerrain = () => activeTerrain;

export async function loadTerrainFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const text = await file.text();
  const terrain = ext === 'asc' ? parseAsciiGrid(text) : ext === 'xyz' ? parseXYZ(text) : null;
  if (!terrain) throw new Error('Định dạng địa hình chưa hỗ trợ. Dùng .asc hoặc .xyz.');
  activeTerrain = { ...terrain, name: file.name, size: file.size };
  return activeTerrain;
}

function parseAsciiGrid(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = {};
  let start = 0;
  for (; start < Math.min(10, lines.length); start++) {
    const parts = lines[start].trim().split(/\s+/), key = parts[0].toLowerCase();
    if (!['ncols', 'nrows', 'xllcorner', 'yllcorner', 'xllcenter', 'yllcenter', 'cellsize', 'nodata_value'].includes(key)) break;
    header[key] = +parts[1];
  }
  const nx = header.ncols, ny = header.nrows;
  if (!nx || !ny || lines.length - start < ny) throw new Error('ASCII Grid thiếu ncols/nrows hoặc số hàng cao độ.');
  const nodata = header.nodata_value ?? -9999, values = new Float32Array(nx * ny);
  let sum = 0, count = 0, min = Infinity, max = -Infinity;
  for (let row = 0; row < ny; row++) {
    const vals = lines[start + row].trim().split(/\s+/).map(Number);
    if (vals.length < nx) throw new Error(`ASCII Grid: hàng ${row + 1} thiếu giá trị.`);
    for (let col = 0; col < nx; col++) {
      const raw = vals[col], v = raw === nodata || !Number.isFinite(raw) ? NaN : raw;
      values[row * nx + col] = v;
      if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); sum += v; count++; }
    }
  }
  const mean = count ? sum / count : 0;
  for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) values[i] = mean;
  return { nx, ny, values, min, max, mean, cellSize: header.cellsize || 1, crs: 'Theo metadata dự án' };
}

function parseXYZ(text) {
  const points = text.trim().split(/\r?\n/).map((line) => line.trim().split(/[\s,;]+/).slice(0, 3).map(Number)).filter((p) => p.length === 3 && p.every(Number.isFinite));
  if (points.length < 10) throw new Error('XYZ cần tối thiểu 10 điểm hợp lệ dạng x y z.');
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const nx = 96, ny = 72, sums = new Float64Array(nx * ny), counts = new Uint32Array(nx * ny);
  for (const [x, y, z] of points) {
    const i = Math.min(nx - 1, Math.max(0, Math.round((x - xmin) / Math.max(1e-9, xmax - xmin) * (nx - 1))));
    const j = Math.min(ny - 1, Math.max(0, Math.round((ymax - y) / Math.max(1e-9, ymax - ymin) * (ny - 1))));
    const k = j * nx + i; sums[k] += z; counts[k]++;
  }
  const sourceMean = points.reduce((a, p) => a + p[2], 0) / points.length;
  const values = new Float32Array(nx * ny);
  for (let k = 0; k < values.length; k++) values[k] = counts[k] ? sums[k] / counts[k] : sourceMean;
  // Làm mượt ô rỗng bằng lân cận để tránh các hố do point cloud thưa.
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i;
    if (!counts[k]) values[k] = (values[k - 1] + values[k + 1] + values[k - nx] + values[k + nx]) / 4;
  }
  const min = Math.min(...values), max = Math.max(...values), mean = values.reduce((a, v) => a + v, 0) / values.length;
  return { nx, ny, values, min, max, mean, cellSize: Math.max((xmax - xmin) / nx, (ymax - ymin) / ny), crs: 'Theo tọa độ XYZ đầu vào' };
}
