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
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-recharts': ['recharts'],
          'vendor-xyflow': ['@xyflow/react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': process.env.AUTH_API_URL || 'http://localhost:3001',
      '/api/v1': process.env.API_URL || 'http://localhost:3002',
      '/ws': { target: process.env.WS_URL || 'ws://localhost:3002', ws: true },
    },
  },
});
