import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Tauri attend le frontend exactement sur ce port (cf. tauri.conf.json → build.devUrl)
  server: {
    port: 1420,
    strictPort: true,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
