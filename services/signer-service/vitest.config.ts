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
                'src/instrument.ts',
                'src/health/**',
                'src/common/**',
                'src/canary/**',          // honeypot startup logic — no testable units
                'src/**/*.dto.ts',
                'src/**/*.guard.ts',
                'src/**/*.filter.ts',
                'src/**/*.controller.ts',   // HTTP wiring only — tested at service layer
                'src/encryption/native-encryption.service.ts',  // NAPI Rust addon — requires native binary, integration-test territory
                'src/signing/signing.service.ts',               // EIP712 signing requires @polymarket/clob-client (not a devDep)
                'src/encryption/kek-rotation.service.ts',       // Prisma-dependent batch rotation — integration-test territory
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
