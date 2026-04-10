import { defineConfig, devices } from '@playwright/test';

/**
 * Polyforge E2E test configuration.
 *
 * Requires the full dev stack running:
 *   docker compose up -d
 *   pnpm --filter user-app-react dev
 *
 * Environment variables:
 *   BASE_URL     — React app URL (default: http://localhost — Docker gateway)
 *   API_URL      — api-service URL  (default: http://localhost:3002)
 *   AUTH_URL     — auth-service URL (default: http://localhost:3001)
 *   MAILHOG_URL  — MailHog web URL  (default: http://localhost:8025)
 */
export default defineConfig({
    globalSetup: './global-setup.ts',
    testDir:   './specs',
    fullyParallel: false,           // sequential within a file, but each file gets a fresh context
    forbidOnly: !!process.env.CI,
    retries:   process.env.CI ? 2 : 0,
    workers:   1,                   // serial execution — one browser, one DB state
    reporter:  [['html', { open: 'never' }], ['list']],

    use: {
        baseURL:       process.env.BASE_URL    ?? 'http://localhost',
        trace:         'on-first-retry',
        screenshot:    'only-on-failure',
        video:         'retain-on-failure',
        // Seed user credentials (alice is pre-verified + pre-connected)
        storageState:  undefined,
        // Allow extra time for SPA loading through nginx proxy in Docker.
        // First cold-start navigation can take up to 25s on a dev machine.
        navigationTimeout: 30_000,
        actionTimeout:     15_000,
        // Larger viewport to avoid cookie banner overlapping form buttons
        viewport:      { width: 1280, height: 900 },
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // Firefox is slow on GitHub Actions runners causing flaky timeouts.
        // Run locally for cross-browser coverage; skip on CI for reliability.
        ...(!process.env.CI ? [{
            name: 'firefox' as const,
            use: { ...devices['Desktop Firefox'] },
        }] : []),
    ],

    // Global timeout per test — allow extra for nginx proxy + SPA bootstrap
    timeout: 60_000,
    expect: { timeout: 20_000 },
});
