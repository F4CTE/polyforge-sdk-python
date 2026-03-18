import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            // Map the generated Prisma client to a lightweight enum mock so
            // unit tests don't require `prisma generate` to have been run.
            '.prisma/client': path.resolve(__dirname, 'test/mocks/prisma-client.ts'),
        },
    },
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
                'src/**/*.filter.ts',
                'src/health/**',
                'src/common/**',
                'src/gateway/**',          // WebSocket — integration test territory
                'src/**/*.controller.ts',  // thin HTTP adapters — service logic is fully tested
            ],
            thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
        },
    },
});
