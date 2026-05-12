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
                'src/**/*.dto.ts',
                'src/health/**',
                'src/stream/**',
                'src/instrument.ts',              // Sentry init — side-effect only
            ],
            thresholds: { lines: 80, functions: 84, branches: 70, statements: 80 },
        },
    },
});
