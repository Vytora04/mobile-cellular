import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  plugins: [tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/bima-api': {
        target: 'https://bimaplus-api.ioh.co.id',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bima-api/, ''),
        headers: {
          origin: 'https://bimatri.ioh.co.id',
          referer: 'https://bimatri.ioh.co.id/',
        },
      },
    },
  },
});
