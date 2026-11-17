import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 600 }, // the lazily loaded chart chunk carries ECharts
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:3100', changeOrigin: true },
      ...(process.env.API_V2_TOKEN ? { '/exec': {
        target: 'http://localhost:3300', changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/exec/, '/api/v2/exec'),
        configure: (proxy: { on: (event: string, handler: (request: { setHeader: (name: string, value: string) => void }) => void) => void }) => {
          proxy.on('proxyReq', request => request.setHeader('Authorization', `Bearer ${process.env.API_V2_TOKEN}`));
        },
      } } : {}),
    },
  },
});
