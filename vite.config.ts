import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 'base' is crucial for GitHub Pages to ensure assets are loaded relatively
  // This allows the app to work at https://<user>.github.io/<repo>/
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});