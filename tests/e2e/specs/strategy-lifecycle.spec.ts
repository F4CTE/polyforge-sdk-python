import { test, expect } from '@playwright/test';
import { LoginPage }           from '../pages/login.page';
import { StrategiesListPage }  from '../pages/strategies-list.page';
import { StrategyBuilderPage } from '../pages/strategy-builder.page';
import {
    apiLogin,
    apiCreateStrategy,
    apiGetStrategies,
    apiDeleteStrategy,
    apiStopStrategy,
} from '../helpers/api';

/**
 * Strategy lifecycle E2E tests.
 *
 * Covers:
 *   - Create strategy via builder
 *   - Start (paper), Pause, Resume, Stop
 *   - Edit an existing strategy
 *   - Delete strategy via API (teardown)
 *
 * Uses alice@e2e.dev.local which is pre-seeded, verified, and connected.
 */

const ALICE_EMAIL    = 'alice@e2e.dev.local';
const ALICE_PASSWORD = 'TestPass123!';

let aliceToken = '';

async function cleanupE2EStrategies() {
    if (!aliceToken) return;
    const strategies = await apiGetStrategies(aliceToken);
    for (const s of strategies.filter(s => s.name.startsWith('E2E-'))) {
        try {
            if (s.status === 'RUNNING' || s.status === 'PAUSED') {
                await apiStopStrategy(aliceToken, s.id);
            }
            await apiDeleteStrategy(aliceToken, s.id);
        } catch { /* best-effort */ }
    }
}

test.beforeAll(async () => {
    const resp = await apiLogin(ALICE_EMAIL, ALICE_PASSWORD);
    aliceToken = resp.token;
    await cleanupE2EStrategies();
});

test.afterEach(async () => {
    try { await cleanupE2EStrategies(); } catch { /* ignore */ }
});

test.afterAll(async () => {
    const cleanup = cleanupE2EStrategies();
    const timeout = new Promise((_r, reject) => setTimeout(() => reject(new Error('cleanup timeout')), 30_000));
    await Promise.race([cleanup, timeout]).catch(() => { /* ignore */ });
});

test.describe('Strategy lifecycle', () => {

    test('strategies list page shows "New Strategy" button', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        const listPage = new StrategiesListPage(page);
        await listPage.goto();
        await expect(listPage.newButton).toBeVisible();
    });

    test('navigating to builder shows New Strategy form', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        const builderPage = new StrategyBuilderPage(page);
        await builderPage.gotoNew();
        await expect(builderPage.nameInput).toBeVisible();
        await expect(builderPage.saveButton).toBeVisible();
    });

    test('create a strategy and it appears in the list', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const strategyName = `E2E-${Date.now().toString(36)}`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        await builderPage.gotoNew();
        await builderPage.fillName(strategyName);
        await builderPage.saveAndRedirect();

        // Navigate to list and verify strategy appears
        await listPage.goto();
        await expect(listPage.cardByName(strategyName)).toBeVisible();
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/IDLE/i);
    });

    test('start (paper) → status becomes RUNNING or PAPER', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const strategyName = `E2E-${Date.now().toString(36)}`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        // Create strategy
        await builderPage.gotoNew();
        await builderPage.fillName(strategyName);
        await builderPage.saveAndRedirect();

        // Navigate to list and start paper
        await listPage.goto();
        await listPage.startPaper(strategyName);

        // Status should update to RUNNING or PAPER (paper trading uses PAPER status)
        await expect(async () => {
            const status = await listPage.statusOf(strategyName);
            expect(status).toMatch(/RUNNING|PAPER/i);
        }).toPass({ timeout: 10_000 });
    });

    test('full lifecycle: create → start paper → pause → resume → stop', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const strategyName = `E2E-${Date.now().toString(36)}`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        // ── Create ─────────────────────────────────────────────────────────
        await builderPage.gotoNew();
        await builderPage.fillName(strategyName);
        await builderPage.saveAndRedirect();

        await listPage.goto();
        await expect(listPage.cardByName(strategyName)).toBeVisible();

        // ── Start paper ────────────────────────────────────────────────────
        // After startPaper, status transitions IDLE → PAPER → RUNNING.
        // Under Docker the bot-service can take 10-15s to transition fully.
        await listPage.startPaper(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/RUNNING|PAPER/i);
        }).toPass({ timeout: 15_000 });

        // ── Pause ──────────────────────────────────────────────────────────
        await listPage.pauseStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/PAUSED/i);
        }).toPass({ timeout: 10_000 });

        // ── Resume ─────────────────────────────────────────────────────────
        await listPage.resumeStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/RUNNING|PAPER/i);
        }).toPass({ timeout: 10_000 });

        // ── Stop ───────────────────────────────────────────────────────────
        await listPage.stopStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/IDLE|STOPPED/i);
        }).toPass({ timeout: 10_000 });
    });

    test('edit strategy name via builder', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const original     = `E2E-${Date.now().toString(36)}`;
        const renamed      = `${original}-edited`;

        // Login via UI for a fresh session — the beforeAll token may have
        // expired (15m JWT TTL) by the time this test runs late in the shard.
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        // Create strategy via the fresh session's token.
        const freshResp = await apiLogin(ALICE_EMAIL, ALICE_PASSWORD);
        const { id: strategyId } = await apiCreateStrategy(freshResp.token, original);

        // Navigate directly to edit mode (session cookie is set by loginAndRedirect).
        await builderPage.gotoEdit(strategyId);

        // Wait for loadStrategy() to populate the input — without this,
        // fillName() races against the async store hydration and the
        // store overwrites the DOM value after our fill.
        await expect(builderPage.nameInput).toHaveValue(original, { timeout: 10_000 });

        await builderPage.fillName(renamed);
        await builderPage.saveAndRedirect();

        // Navigate to list — should appear under new name
        await listPage.goto();
        await expect(listPage.cardByName(renamed)).toBeVisible();
    });

    test('builder adds a block to the Triggers section', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const strategyName = `E2E-${Date.now().toString(36)}`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        await builderPage.gotoNew();
        await builderPage.fillName(strategyName);

        // Navigate to Triggers section and add a block
        await builderPage.selectSection('Triggers');
        await builderPage.addBlock('Price Crosses Up');

        // Confirm a block was added to the canvas (text may be truncated in the node)
        await expect(builderPage.blockCards().first()).toBeVisible({ timeout: 5_000 });

        // Save and verify redirect
        await builderPage.saveAndRedirect();
    });

    test('strategy detail page shows correct status', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const strategyName = `E2E-${Date.now().toString(36)}`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        await builderPage.gotoNew();
        await builderPage.fillName(strategyName);
        await builderPage.saveAndRedirect();

        // After save we may be on detail page already, or navigate from list
        if (!page.url().match(/\/strategies\/[a-z0-9-]+$/)) {
            await listPage.goto();
            await listPage.clickCard(strategyName);
        }
        await expect(page).toHaveURL(/\/strategies\/[a-z0-9-]+$/);
        await expect(page.locator('h1', { hasText: strategyName })).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('[data-testid="status-badge"]')).toContainText(/IDLE/i);
    });

});
