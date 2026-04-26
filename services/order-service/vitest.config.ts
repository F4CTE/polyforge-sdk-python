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
                'src/**/*.module.ts',
                'src/main.ts',
                'src/instrument.ts',
                'src/health/**',
                'src/common/**',
                'src/**/*.dto.ts',
                'src/**/*.guard.ts',
                'src/**/*.filter.ts',
                'src/**/*.controller.ts',   // HTTP wiring only — tested at service layer
                'src/stream/**',            // Redis stream consumer — event loop, integration test
            ],
            thresholds: {
                lines:      85,
                functions:  85,
                branches:   75,
                statements: 85,
            },
        },
    },
});
