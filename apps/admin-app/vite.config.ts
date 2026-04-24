import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/'))
            return 'vendor-react';
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/auth': process.env.AUTH_API_URL || 'http://localhost:3001',
      '/api': process.env.API_URL || 'http://localhost:3002',
    },
  },
});
