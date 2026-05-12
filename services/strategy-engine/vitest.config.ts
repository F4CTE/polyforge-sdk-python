import { defineConfig } from 'vitest/config';
import path from 'path';

const isCI = !!process.env.CI;

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
        fileParallelism: !isCI,
        pool: 'forks',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.module.ts',
                'src/main.ts',
                'src/instrument.ts',
                'src/app.module.ts',
                'src/health/**',
                'src/internal/**',
                'src/common/**',
                'src/blocks/__helpers__.ts',
                'src/blocks/block.types.ts',       // interfaces only — no runtime code
                'src/strategy/strategy-registry.service.ts', // event loop — integration test
            ],
            thresholds: {
                lines: 85,
                functions: 88,
                branches: 68,
                statements: 85,
            },
        },
    },
});
