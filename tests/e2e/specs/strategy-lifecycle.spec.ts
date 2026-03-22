import { test, expect } from '@playwright/test';
import { LoginPage }           from '../pages/login.page';
import { StrategiesListPage }  from '../pages/strategies-list.page';
import { StrategyBuilderPage } from '../pages/strategy-builder.page';
import {
    apiLogin,
    apiGetStrategies,
    apiDeleteStrategy,
    apiStopStrategy,
    uniqueEmail,
    uniqueUsername,
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
 * Uses alice@dev.local which is pre-seeded, verified, and connected.
 */

const ALICE_EMAIL    = 'alice@dev.local';
const ALICE_PASSWORD = 'password123';

let aliceToken = '';

test.beforeAll(async () => {
    const resp = await apiLogin(ALICE_EMAIL, ALICE_PASSWORD);
    aliceToken = resp.token;
});

test.afterAll(async () => {
    // Best-effort cleanup: stop + delete any strategies created by this suite
    if (!aliceToken) return;
    const strategies = await apiGetStrategies(aliceToken);
    for (const s of strategies.filter(s => s.name.startsWith('E2E-'))) {
        if (s.status === 'RUNNING' || s.status === 'PAUSED') {
            await apiStopStrategy(aliceToken, s.id);
        }
        await apiDeleteStrategy(aliceToken, s.id);
    }
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

    test('start (paper) → status becomes RUNNING', async ({ page }) => {
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

        // Status should update to RUNNING
        await expect(async () => {
            const status = await listPage.statusOf(strategyName);
            expect(status).toMatch(/RUNNING/i);
        }).toPass({ timeout: 8_000 });
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
        await listPage.startPaper(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/RUNNING/i);
        }).toPass({ timeout: 8_000 });

        // ── Pause ──────────────────────────────────────────────────────────
        await listPage.pauseStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/PAUSED/i);
        }).toPass({ timeout: 8_000 });

        // ── Resume ─────────────────────────────────────────────────────────
        await listPage.resumeStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/RUNNING/i);
        }).toPass({ timeout: 8_000 });

        // ── Stop ───────────────────────────────────────────────────────────
        await listPage.stopStrategy(strategyName);
        await expect(async () => {
            expect(await listPage.statusOf(strategyName)).toMatch(/IDLE|STOPPED/i);
        }).toPass({ timeout: 8_000 });
    });

    test('edit strategy name via builder', async ({ page }) => {
        const loginPage   = new LoginPage(page);
        const builderPage = new StrategyBuilderPage(page);
        const listPage    = new StrategiesListPage(page);
        const original     = `E2E-${Date.now().toString(36)}`;
        const renamed      = `${original}-edited`;

        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);

        // Create
        await builderPage.gotoNew();
        await builderPage.fillName(original);
        await builderPage.saveAndRedirect();

        // Navigate to list and open edit
        // Navigate to list, click card to get to detail, then navigate to edit
        await listPage.goto();
        await listPage.clickCard(original);
        // Now on /strategies/:id — extract ID from URL and go to edit
        await page.waitForURL(/\/strategies\/[a-z0-9-]+$/, { timeout: 15_000 });
        const editUrl = page.url() + '/edit';
        await page.goto(editUrl);
        await expect(page).toHaveURL(/\/edit$/);

        // Rename
        await builderPage.nameInput.fill('');
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

        // Confirm the block appears
        await expect(builderPage.blockCards().filter({ hasText: 'Price Crosses Up' })).toBeVisible();

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
        await expect(page.locator('span.rounded-full')).toContainText(/IDLE/i);
    });

});
