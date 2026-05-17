import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: {
      USER_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      INTERNAL_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      INTERNAL_JWT_AUDIENCE: 'polyforge-internal',
      INTERNAL_JWT_ISSUERS: 'auth-service,api-service',
      ADMIN_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      TOTP_ENCRYPTION_KEY: '0'.repeat(64),
      COOKIE_SECURE: 'false',
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:4200',
      EMAIL_DRIVER: 'mailhog',
      MAILHOG_HOST: 'localhost',
      MAILHOG_PORT: '1025',
      REDIS_URL: 'redis://localhost:6379',
    },
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
        'src/mail/**', // external SMTP — tested via integration tests
        'src/common/**', // health controller — trivial infrastructure
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 78,
        statements: 85,
      },
    },
  },
});
