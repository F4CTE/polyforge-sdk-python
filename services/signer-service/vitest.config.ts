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
                'src/common/**',
                'src/canary/**',          // honeypot startup logic — no testable units
                'src/**/*.dto.ts',
                'src/**/*.guard.ts',
                'src/**/*.filter.ts',
                'src/**/*.controller.ts',   // HTTP wiring only — tested at service layer
            ],
            thresholds: {
                lines:      85,
                functions:  85,
                branches:   65,             // production EIP712 path needs @polymarket/clob-client (not installed as devDep)
                statements: 85,
            },
        },
    },
});
