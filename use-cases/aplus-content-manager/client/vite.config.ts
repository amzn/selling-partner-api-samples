import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server on 127.0.0.1 only; /api is proxied to the Express server (server/, port 8787).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8787', '/fonts': 'http://127.0.0.1:8787' },
  },
  resolve: { alias: { '@shared': new URL('../shared', import.meta.url).pathname } },
});
