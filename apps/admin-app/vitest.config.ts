import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Force React dev build so React.act exists in @testing-library/react
    'process.env.NODE_ENV': '"test"',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
