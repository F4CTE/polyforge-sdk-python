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
                'src/health/**', 'src/stream/**',
                'src/**/mail.service.ts',  // SMTP integration
                'src/**/digest.service.ts', // timer-based
            ],
            thresholds: { lines: 73, functions: 75, branches: 55, statements: 73 },
        },
    },
});
