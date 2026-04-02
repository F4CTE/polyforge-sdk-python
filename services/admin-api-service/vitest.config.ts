import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        env: {
            INTERNAL_JWT_SECRET: 'test-internal-jwt-secret-for-admin-api',
        },
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
                'src/**/*.controller.ts',  // thin HTTP adapters — service logic is fully tested
                'src/sentiment/**',        // new module — integration tests pending
            ],
            thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
        },
    },
});
