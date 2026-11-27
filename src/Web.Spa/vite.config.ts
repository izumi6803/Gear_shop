import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// Dev & preview đều proxy sang 2 API để SPA chỉ nói chuyện với 1 origin
// (production: nginx trong Dockerfile đảm nhiệm vai trò này).
const proxy: Record<string, ProxyOptions> = {
  '/ordering-api': {
    target: process.env.VITE_ORDERING_TARGET ?? 'http://localhost:5081',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ordering-api/, ''),
  },
  '/catalog-api': {
    target: process.env.VITE_CATALOG_TARGET ?? 'http://localhost:5080',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/catalog-api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  // Không cache index.html / bundle để bản mới luôn được dùng sau mỗi lần build
  // (tránh trường hợp trình duyệt giữ JS cũ và hành xử theo bug đã sửa).
  server: {
    port: 5173,
    strictPort: true,
    proxy,
    headers: { 'Cache-Control': 'no-store' },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy,
    headers: { 'Cache-Control': 'no-store' },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
