import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build ra 1 file HTML duy nhất (dist/index.html) — mở trực tiếp bằng trình duyệt,
// không cần máy chủ, tương tự DXF-Toolkit-v2.html.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { chunkSizeWarningLimit: 4000 },
});
