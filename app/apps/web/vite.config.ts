import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 600 }, // the lazily loaded chart chunk carries ECharts
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3100', changeOrigin: true } },
  },
});
