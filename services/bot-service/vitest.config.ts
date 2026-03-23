import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        env: {
            INTERNAL_JWT_SECRET: 'test-internal-jwt-secret-for-bot-service',
        },
        include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
        passWithNoTests: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.module.ts',
                'src/main.ts',
                'src/**/*.dto.ts',
            ],
        },
    },
});
