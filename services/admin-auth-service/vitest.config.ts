import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.module.ts',
                'src/main.ts',
                'src/instrument.ts',
                'src/generate-swagger.ts',
                'src/**/*.dto.ts',
                'src/**/*.filter.ts',
                'src/common/**',
            ],
            thresholds: {
                lines: 78,
                functions: 78,
                branches: 72,
                statements: 78,
            },
        },
    },
});
