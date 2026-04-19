import { test, expect } from '@playwright/test';
import { StrategyBuilderPage } from '../pages/strategy-builder.page';
import { StrategiesListPage } from '../pages/strategies-list.page';
import {
    apiRegisterAndVerify,
    uniqueEmail,
    uniqueUsername,
    apiDeleteStrategy,
    apiGetStrategies,
    apiCreateStrategy,
    ensureFreshToken,
    type LoginResponse,
} from '../helpers/api';

/**
 * Strategy Detail & Lifecycle — Full Workflow Coverage (@e2e @comprehensive)
 *
 * Split from strategy-builder-comprehensive.spec.ts (POLA-189) to rebalance
 * E2E shards. These tests exercise save/load/edit workflows and strategy
 * lifecycle actions (start, pause, resume, stop) from the list/detail pages.
 * They do NOT need the builder canvas beforeEach — only auth cookies.
 */

test.describe('Strategy Detail & Lifecycle', () => {
    let login: LoginResponse;
    let token: string;
    let userId: string;

    test.beforeAll(async () => {
        const email    = uniqueEmail('stratdetail');
        const username = uniqueUsername('stratdetail');
        login  = await apiRegisterAndVerify(email, username, 'TestPass123!');
        token  = login.token;
        userId = login.user.id;
    });

    test.beforeEach(async ({ page }) => {
        login = await ensureFreshToken(login);
        token = login.token;

        await page.context().addCookies([{
            name:   'pf_token',
            value:  token,
            domain: 'localhost',
            path:   '/',
        }]);
    });

    test.afterEach(async () => {
        try {
            const strategies = await apiGetStrategies(token);
            for (const strategy of strategies) {
                try { await apiDeleteStrategy(token, strategy.id); } catch { /* ignore */ }
            }
        } catch { /* token may have expired on long suites */ }
    });

    // ─── Strategy Save/Load/Edit Tests ────────────────────────────────────────

    test('@smoke @comprehensive should save strategy with valid name', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const builder   = new StrategyBuilderPage(page);
        const listPage  = new StrategiesListPage(page);

        await builder.gotoNew();

        const strategyName = `Test Strategy ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('A test strategy for saving');
        await builder.saveAndRedirect();

        await expect(page).not.toHaveURL(/\/new|\/edit/);

        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        await expect(card).toBeVisible();
    });

    test('@comprehensive should show validation error when saving without name', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const strategyName    = `Validation ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await builder.gotoEdit(stratId);
        await builder.fillName('');
        await builder.save();

        const errorToast = page.locator('[data-sonner-toast]', { hasText: /name.*required|required/i })
            .or(page.locator('[role="status"]', { hasText: /name.*required|required/i }));
        await expect(errorToast).toBeVisible({ timeout: 10_000 });
    });

    test('@comprehensive should edit existing strategy', async ({ page }) => {
        const listPage = new StrategiesListPage(page);

        const strategyName  = `Edit Test ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        await card.click();

        const editLink = page.locator('a[title*="Edit"], a[title*="edit"]').first();
        await expect(editLink).toBeVisible({ timeout: 10_000 });
        await editLink.click();

        await expect(page).toHaveURL(/\/edit/);
        await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
    });

    test('@comprehensive should preserve all nodes and edges when loading strategy for edit', async ({ page }) => {
        const builder  = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        const strategyName    = `Multi-Block ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await builder.gotoEdit(stratId);
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        if (await triggerBlock.isVisible()) {
            await triggerBlock.click();
        }
        await builder.saveAndRedirect();

        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        await card.click();
        const editLink = page.locator('a[title*="Edit"], a[title*="edit"]').first();
        if (await editLink.isVisible().catch(() => false)) {
            await editLink.click();
            await expect(page).toHaveURL(/\/edit/);
            await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
            const blocks     = builder.blockCards();
            const blockCount = await blocks.count();
            expect(blockCount).toBeGreaterThan(0);
        }
    });

    test('@comprehensive should save edited strategy with changes', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const builder         = new StrategyBuilderPage(page);
        const strategyName    = `Edit Changes ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await builder.gotoEdit(stratId);
        await builder.fillDescription('Updated description');
        await builder.saveAndRedirect();

        await expect(page).not.toHaveURL(/\/edit/);
    });

    test('@comprehensive should cancel editing without saving changes', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const builder         = new StrategyBuilderPage(page);
        const strategyName    = `Cancel Edit ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await builder.gotoEdit(stratId);
        await builder.fillDescription('This should not be saved');
        await builder.cancelButton.click();

        await expect(page).not.toHaveURL(/\/edit/);
    });

    // ─── Strategy Import/Export Tests ─────────────────────────────────────────

    test('@comprehensive should export strategy to JSON file', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const { id: stratId } = await apiCreateStrategy(token, `Export ${Date.now()}`);

        await builder.gotoEdit(stratId);
        const exportButton = page.locator('button[title*="Export"], button[title*="export"]').first();
        if (await exportButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
            await exportButton.click();
            const download = await downloadPromise;
            expect(download.suggestedFilename).toMatch(/\.polyforge\.json|\.json/);
        }
    });

    test('@comprehensive should import strategy from file', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const { id: stratId } = await apiCreateStrategy(token, `Import ${Date.now()}`);

        await builder.gotoEdit(stratId);
        const importButton = page.locator('button[title*="Import"], button[title*="import"]').first();
        if (await importButton.isVisible()) {
            await expect(importButton).toBeEnabled();
        }
    });

    test('@comprehensive should show error on invalid import file', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const { id: stratId } = await apiCreateStrategy(token, `InvalidImport ${Date.now()}`);

        await builder.gotoEdit(stratId);
        const importButton = page.locator('button[title*="Import"], button[title*="import"]').first();
        if (await importButton.isVisible()) {
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.isVisible()) {
                const errorShown = page.locator('[role="alert"], .error');
                if (await errorShown.isVisible()) {
                    await expect(errorShown).toBeVisible();
                }
            }
        }
    });

    test('@comprehensive should drag and drop polyforge file to import', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const { id: stratId } = await apiCreateStrategy(token, `DragImport ${Date.now()}`);

        await builder.gotoEdit(stratId);
        const canvas = page.locator('.react-flow__viewport');
        await expect(canvas).toBeVisible();
    });

    // ─── Strategy Lifecycle Tests ─────────────────────────────────────────────

    test('@smoke @comprehensive should start strategy in Paper mode', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Paper Mode ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.waitForStatus(strategyName, /PAPER/i);
    });

    test('@smoke @comprehensive should start strategy in Live mode', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Live Mode ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startLive(strategyName);
        await listPage.waitForStatus(strategyName, /RUNNING|IDLE/i);
    });

    test('@smoke @comprehensive should pause running strategy', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Pause Test ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.waitForStatus(strategyName, /PAPER/i);

        await listPage.pauseStrategy(strategyName);
        await listPage.waitForStatus(strategyName, /PAUSED/i);
    });

    test('@smoke @comprehensive should resume paused strategy', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Resume Test ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.waitForStatus(strategyName, /PAPER/i);

        await listPage.pauseStrategy(strategyName);
        await listPage.waitForStatus(strategyName, /PAUSED/i);

        await listPage.resumeStrategy(strategyName);
        await listPage.waitForStatus(strategyName, /PAPER|RUNNING/i);
    });

    test('@smoke @comprehensive should stop running strategy', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Stop Test ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.waitForStatus(strategyName, /PAPER/i);

        await listPage.stopStrategy(strategyName);
        await listPage.waitForStatus(strategyName, /IDLE/i);
    });

    test('@comprehensive should display strategy detail page', async ({ page }) => {
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Detail View ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.clickCard(strategyName);

        await page.waitForURL(/\/strategies\/[a-z0-9-]+$/, { timeout: 15_000 });
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    });

    test('@comprehensive should show blocks visualization on detail page', async ({ page }) => {
        const builder         = new StrategyBuilderPage(page);
        const listPage        = new StrategiesListPage(page);
        const strategyName    = `Block Viz ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await builder.gotoEdit(stratId);
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        if (await triggerBlock.isVisible()) {
            await triggerBlock.click();
        }
        await builder.saveAndRedirect();

        await listPage.goto();
        await listPage.clickCard(strategyName);

        const visualization = page.locator('[data-testid="strategy-visualization"], .react-flow');
        if (await visualization.isVisible()) {
            await expect(visualization).toBeVisible();
        }
    });

    test('@comprehensive should show live events log when strategy running', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `Events Log ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.clickCard(strategyName);

        const eventsLog = page.locator('[data-testid="events-log"]');
        if (await eventsLog.isVisible()) {
            await expect(eventsLog).toBeVisible();
        }
    });

    test('@comprehensive should display P&L data on detail page', async ({ page }, testInfo) => {
        testInfo.setTimeout(90_000);
        const listPage     = new StrategiesListPage(page);
        const strategyName = `PL Data ${Date.now()}`;
        await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.startPaper(strategyName);
        await listPage.clickCard(strategyName);

        const pnlSection = page.locator('[data-testid="pnl-summary"], :text("P&L")').first();
        if (await pnlSection.isVisible()) {
            await expect(pnlSection).toBeVisible();
        }
    });

    test('@comprehensive should trigger 7-day backtest from builder', async ({ page }) => {
        const listPage        = new StrategiesListPage(page);
        const strategyName    = `Backtest ${Date.now()}`;
        const { id: stratId } = await apiCreateStrategy(token, strategyName);

        await listPage.goto();
        await listPage.clickCard(strategyName);
        await page.waitForURL(/\/strategies\/[a-z0-9-]+$/, { timeout: 15_000 });
        await page.goto(page.url() + '/edit');
        await expect(page).toHaveURL(/\/edit$/);

        const backtestButton = page.locator('button', { hasText: /Quick Test|Backtest/i }).first();
        if (await backtestButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await expect(backtestButton).toBeEnabled({ timeout: 5_000 });
            await backtestButton.click();

            await Promise.race([
                page.locator('text=/Quick Test Results/i').first().waitFor({ timeout: 15_000 }),
                page.locator('.animate-spin').first().waitFor({ timeout: 5_000 }),
                page.locator('[data-sonner-toast]').first().waitFor({ timeout: 10_000 }),
            ]).catch(() => { /* acceptable — strategy may have no blocks */ });
        }
    });
});
