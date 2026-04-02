import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
    resolve: {
        alias: {
            '.prisma/client': path.resolve(__dirname, 'test/mocks/prisma-client.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.module.ts', 'src/main.ts', 'src/**/*.dto.ts',
                'src/health/**', 'src/stream/**',
            ],
            thresholds: { lines: 75, functions: 75, branches: 70, statements: 75 },
        },
    },
});
