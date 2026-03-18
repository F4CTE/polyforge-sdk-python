import { defineConfig } from 'vitest/config';

export default defineConfig({
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
                'src/app.module.ts',
                'src/health/**',
                'src/internal/**',
                'src/common/**',
                'src/blocks/__helpers__.ts',
                'src/blocks/block.types.ts',       // interfaces only — no runtime code
                'src/strategy/strategy-registry.service.ts', // event loop — integration test
            ],
            thresholds: {
                lines: 45,
                functions: 38,
                branches: 50,
                statements: 45,
            },
        },
    },
});
