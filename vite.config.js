import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { reportApi } from './server/api.js';

// UI build thành một HTML. Xuất template/gọi Qwen cần API chạy cùng dev/preview.
export default defineConfig(({ mode }) => ({
  plugins: [viteSingleFile(), {
    name: 'aipm-report-api',
    configureServer(server) { server.middlewares.use(reportApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })); },
    configurePreviewServer(server) { server.middlewares.use(reportApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })); },
  }],
  build: { chunkSizeWarningLimit: 4000 },
}));
