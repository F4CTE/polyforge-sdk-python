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
                'src/health/**',
            ],
            thresholds: {
                lines: 78,
                functions: 80,
                branches: 55,
                statements: 78,
            },
        },
    },
});
