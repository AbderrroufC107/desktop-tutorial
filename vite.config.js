import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// One React page per HTML file, so the existing links (?u=, ?c=, admin.html) keep working.
// Relative base lets the same build run on GitHub Pages' sub-path and on a custom domain.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Built into docs/ and committed: GitHub Pages serves main /docs directly, no Actions needed.
    outDir: 'docs',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
