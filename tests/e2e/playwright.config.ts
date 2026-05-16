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
    globalSetup: process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP ? undefined : './global-setup.ts',
    testDir:   './specs',
    fullyParallel: false,           // sequential within a file, but each file gets a fresh context
    forbidOnly: !!process.env.CI,
    retries:   process.env.CI ? 2 : 0,
    workers:   1,  // Sequential: 2 workers cause resource contention on shared Docker backend
    reporter:  [['html', { open: 'never' }], ['list']],

    use: {
        baseURL:       process.env.BASE_URL    ?? 'http://localhost',
        ignoreHTTPSErrors: true,
        trace:         'on-first-retry',
        screenshot:    'only-on-failure',
        video:         'retain-on-failure',
        // Pre-populate localStorage so the onboarding welcome modal
        // (pf-onboarding-complete) is dismissed for all tests.  Without this,
        // the modal appears 500ms after the AppLayout mounts and blocks
        // element interactions, causing 41s timeouts on CI.
        storageState:  './storage-state.json',
        // Allow extra time for SPA loading through nginx proxy in Docker.
        // First cold-start navigation can take up to 25s on a dev machine.
        navigationTimeout: process.env.CI ? 30_000 : 30_000,
        actionTimeout:     process.env.CI ? 12_000 : 15_000,
        // Larger viewport to avoid cookie banner overlapping form buttons
        viewport:      { width: 1280, height: 900 },
    },

    projects: [
        {
            name: 'chromium',
            grepInvert: /@mobile/,
            use: {
                ...devices['Desktop Chrome'],
                // CI Docker containers have limited /dev/shm (64 MB default).
                // These flags prevent Chromium OOM crashes and reduce GPU overhead.
                ...(process.env.CI ? {
                    launchOptions: {
                        args: [
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--no-sandbox',
                        ],
                    },
                } : {}),
            },
        },
        // Mobile viewport project — tests tagged with @mobile run at iPhone SE size.
        // These tests verify responsive layout, touch targets, bottom nav, and
        // mobile sidebar overlay behavior at 375px (WCAG 2.5.5 compliant touch targets).
        {
            name: 'mobile-chromium',
            testMatch: '**/*.spec.ts',
            grep: /@mobile/,
            use: {
                // Use proper mobile device emulation: touch events, mobile user agent,
                // viewport sized for iPhone SE (375×812). Falls back to Desktop Chrome
                // launch args on CI to avoid GPU/shm issues.
                ...devices['iPhone SE'],
                viewport: { width: 375, height: 812 },
                storageState: './storage-state.json',
                ...(process.env.CI ? {
                    launchOptions: {
                        args: [
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--no-sandbox',
                        ],
                    },
                } : {}),
            },
        },
        // Firefox is slow on GitHub Actions runners causing flaky timeouts.
        // Run locally for cross-browser coverage; skip on CI for reliability.
        ...(!process.env.CI ? [{
            name: 'firefox' as const,
            grepInvert: /@mobile/,
            use: { ...devices['Desktop Firefox'] },
        }] : []),
    ],

    // Global timeout per test — allow extra for nginx proxy + SPA bootstrap
    timeout: 60_000,
    expect: { timeout: 20_000 },
    // Hard cap on the entire test run; prevents CI hangs when Playwright blocks
    // on a selector with no GitHub Actions job-level timeout to rescue it.
    // CI overrides this via --global-timeout=1440000 (24 min per shard, 4-shard config).
    globalTimeout: process.env.CI ? 65 * 60 * 1000 : 0,
});
