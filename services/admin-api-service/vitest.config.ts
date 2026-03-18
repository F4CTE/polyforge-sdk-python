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
                'src/**/*.module.ts', 'src/main.ts', 'src/**/*.dto.ts',
                'src/**/*.filter.ts', 'src/health/**', 'src/common/health*',
                'src/retention/**',    // cron job — integration test territory
                'src/dashboard/**',    // cron + external health polling
                'src/mail/**',         // SMTP — integration test territory
            ],
            thresholds: { lines: 45, functions: 38, branches: 44, statements: 45 },
        },
    },
});
