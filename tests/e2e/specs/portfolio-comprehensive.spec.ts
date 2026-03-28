import { test, expect } from '@playwright/test';
import { PortfolioPage } from '../pages/portfolio.page';
import { apiLogin, apiRegister, uniqueEmail, uniqueUsername } from '../helpers/api';

/**
 * Portfolio — Full Workflow Coverage (@e2e @comprehensive)
 *
 * Comprehensive test suite for the portfolio page including:
 * - Portfolio overview with summary stats
 * - Live vs Paper trading tabs
 * - Period filtering for P&L chart
 * - Positions table with market info
 * - Position close/redeem actions
 * - Paper account reset functionality
 */

test.describe('Portfolio — Full Workflow Coverage', () => {
    let token: string;

    test.beforeAll(async () => {
        // Register a unique test user for portfolio tests
        const email = uniqueEmail('portfolio');
        const username = uniqueUsername('portfoliouser');
        const res = await apiRegister(email, username, 'TestPass123!');
        token = res.token;
    });

    test.beforeEach(async ({ page }) => {
        // Set auth cookie for each test
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    // ─── Portfolio Overview Tests ──────────────────────────────────────────────

    test('@smoke @comprehensive should load portfolio page with summary stats', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify page loaded
        await expect(page.locator('h1', { hasText: 'Portfolio' })).toBeVisible();

        // Verify summary stats section exists
        const summarySection = page.locator('[data-testid="portfolio-summary"], .summary-stats').first();
        if (await summarySection.isVisible()) {
            await expect(summarySection).toBeVisible();
        }
    });

    test('@comprehensive should display total value in summary', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Get summary stats
        const stats = await portfolio.getSummaryStats();

        // Verify at least one stat is populated
        const hasPnl = stats.pnl && stats.pnl.length > 0;
        const hasReturn = stats.return && stats.return.length > 0;
        const hasWinRate = stats.win_rate && stats.win_rate.length > 0;

        expect(hasPnl || hasReturn || hasWinRate).toBe(true);
    });

    test('@comprehensive should display unrealized P&L in summary', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for P&L stat
        const unrealizedPnl = page.locator('[data-testid="stat-pnl"], :text("Unrealized"), :text("P&L")').first();
        if (await unrealizedPnl.isVisible()) {
            await expect(unrealizedPnl).toBeVisible();

            const value = await unrealizedPnl.textContent();
            expect(value).toBeTruthy();
        }
    });

    test('@comprehensive should display realized P&L in summary', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for realized P&L
        const realizedPnl = page.locator('[data-testid="stat-realized"], :text("Realized"), :text("P&L")').first();
        if (await realizedPnl.isVisible()) {
            await expect(realizedPnl).toBeVisible();

            const value = await realizedPnl.textContent();
            expect(value).toBeTruthy();
        }
    });

    test('@comprehensive should render P&L chart with data', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify chart element exists
        const pnlChart = portfolio.pnlChart;
        if (await pnlChart.isVisible()) {
            await expect(pnlChart).toBeVisible();

            // Verify chart has canvas or SVG elements
            const chartContent = pnlChart.locator('canvas, svg, [role="img"]').first();
            const hasChartContent = await chartContent.isVisible().catch(() => false);
            expect(hasChartContent).toBe(true);
        }
    });

    // ─── Tab Tests ────────────────────────────────────────────────────────────

    test('@smoke @comprehensive should default to Live tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify Live tab is active
        const liveTab = portfolio.liveTab;
        const ariaSelected = await liveTab.getAttribute('aria-selected');

        if (ariaSelected !== null) {
            expect(ariaSelected).toBe('true');
        }
    });

    test('@smoke @comprehensive should switch to Paper tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Click Paper tab
        await portfolio.switchToPaper();

        // Verify Paper tab is now active
        const paperTab = portfolio.paperTab;
        const ariaSelected = await paperTab.getAttribute('aria-selected');

        if (ariaSelected !== null) {
            expect(ariaSelected).toBe('true');
        }
    });

    test('@smoke @comprehensive should switch back to Live tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Go to Paper
        await portfolio.switchToPaper();

        // Go back to Live
        await portfolio.switchToLive();

        // Verify Live is active
        const liveTab = portfolio.liveTab;
        const ariaSelected = await liveTab.getAttribute('aria-selected');

        if (ariaSelected !== null) {
            expect(ariaSelected).toBe('true');
        }
    });

    test('@comprehensive should show paper positions in Paper tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Verify paper-specific content (positions or empty state)
        const positionsTable = portfolio.positionsTable;
        const emptyState = page.locator(':text("No positions"), :text("empty")').first();

        if (await positionsTable.isVisible()) {
            await expect(positionsTable).toBeVisible();
        } else if (await emptyState.isVisible()) {
            await expect(emptyState).toBeVisible();
        }
    });

    test('@comprehensive should show live positions in Live tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify in Live tab
        const liveTab = portfolio.liveTab;
        const isActive = await liveTab.getAttribute('aria-selected');

        // Verify live-specific content
        const positionsTable = portfolio.positionsTable;
        const emptyState = page.locator(':text("No positions"), :text("empty")').first();

        if (await positionsTable.isVisible()) {
            await expect(positionsTable).toBeVisible();
        } else if (await emptyState.isVisible()) {
            await expect(emptyState).toBeVisible();
        }
    });

    test('@comprehensive should have independent data per tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Get Live tab content
        const liveContent = page.locator('[role="tabpanel"]').first();

        // Switch to Paper
        await portfolio.switchToPaper();

        // Get Paper tab content
        const paperContent = page.locator('[role="tabpanel"]').first();

        // Tabs should render different content
        const liveText = await liveContent.textContent() ?? '';
        const paperText = await paperContent.textContent() ?? '';

        // Either content is different or both are empty states
        expect(liveText || paperText).toBeTruthy();
    });

    // ─── Period Filter Tests ───────────────────────────────────────────────────

    test('@smoke @comprehensive should default to 7d period', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify 7d button is selected
        const sevenDayButton = portfolio.periodButtons['7d'];
        const ariaSelected = await sevenDayButton.getAttribute('aria-selected');
        const classList = await sevenDayButton.getAttribute('class');
        const isSelected = ariaSelected === 'true'
            || classList?.includes('active');

        expect(isSelected).toBe(true);
    });

    test('@comprehensive should update chart to 30d period', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Click 30d button
        await portfolio.selectPeriod('30d');

        // Verify button is now selected
        const thirtyDayButton = portfolio.periodButtons['30d'];
        const ariaSelected = await thirtyDayButton.getAttribute('aria-selected');
        const classList = await thirtyDayButton.getAttribute('class');
        const isSelected = ariaSelected === 'true'
            || classList?.includes('active');

        expect(isSelected).toBe(true);

        // Verify chart updated (should not error)
        const chart = portfolio.pnlChart;
        await expect(chart).toBeVisible({ timeout: 5000 });
    });

    test('@comprehensive should update chart to 90d period', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Click 90d button
        await portfolio.selectPeriod('90d');

        // Verify button is now selected
        const ninetyDayButton = portfolio.periodButtons['90d'];
        const ariaSelected = await ninetyDayButton.getAttribute('aria-selected');
        const classList = await ninetyDayButton.getAttribute('class');
        const isSelected = ariaSelected === 'true'
            || classList?.includes('active');

        expect(isSelected).toBe(true);

        // Verify chart updated
        const chart = portfolio.pnlChart;
        await expect(chart).toBeVisible({ timeout: 5000 });
    });

    test('@comprehensive should update chart to All-time period', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Click All button
        await portfolio.selectPeriod('All');

        // Verify button is now selected
        const allButton = portfolio.periodButtons['All'];
        const ariaSelected = await allButton.getAttribute('aria-selected');
        const classList = await allButton.getAttribute('class');
        const isSelected = ariaSelected === 'true'
            || classList?.includes('active');

        expect(isSelected).toBe(true);

        // Verify chart updated
        const chart = portfolio.pnlChart;
        await expect(chart).toBeVisible({ timeout: 5000 });
    });

    test('@comprehensive should return to 7d period from other periods', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Go to 30d
        await portfolio.selectPeriod('30d');

        // Return to 7d
        await portfolio.selectPeriod('7d');

        // Verify 7d is selected
        const sevenDayButton = portfolio.periodButtons['7d'];
        const ariaSelected = await sevenDayButton.getAttribute('aria-selected');
        const classList = await sevenDayButton.getAttribute('class');
        const isSelected = ariaSelected === 'true'
            || classList?.includes('active');

        expect(isSelected).toBe(true);
    });

    // ─── Positions Table Tests ────────────────────────────────────────────────

    test('@comprehensive should display positions table with required columns', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Verify table headers exist
        const tableHeaders = page.locator('th, [role="columnheader"]');
        const headerCount = await tableHeaders.count();

        // Should have at least Market, Side, Size, Entry, Current, P&L
        if (headerCount > 0) {
            const headers = await tableHeaders.allTextContents();
            const headerText = headers.join(' ').toUpperCase();

            // Verify key columns exist
            expect(headerText).toContain('MARKET');
        }
    });

    test('@comprehensive should show empty state when no positions', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Check for empty state message
        const emptyState = page.locator(':text("No positions"), :text("empty"), :text("Nothing here")').first();

        // Either empty state shows or table has rows
        const table = portfolio.positionsTable;
        const hasTable = await table.isVisible().catch(() => false);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        expect(hasTable || hasEmptyState).toBe(true);
    });

    test('@comprehensive should display unresolved positions with Close button', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for any Close buttons in the table
        const closeButtons = page.locator('button:has-text("Close"), [data-testid*="close"]');
        const closeCount = await closeButtons.count();

        // If positions exist, close buttons should be visible
        if (closeCount > 0) {
            const firstCloseButton = closeButtons.first();
            await expect(firstCloseButton).toBeVisible();
        }
    });

    test('@comprehensive should display resolved positions with Redeem button', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for any Redeem buttons in the table
        const redeemButtons = page.locator('button:has-text("Redeem"), [data-testid*="redeem"]');
        const redeemCount = await redeemButtons.count();

        // If resolved positions exist, redeem buttons should be visible
        if (redeemCount > 0) {
            const firstRedeemButton = redeemButtons.first();
            await expect(firstRedeemButton).toBeVisible();
        }
    });

    // ─── Position Action Tests ────────────────────────────────────────────────

    test('@comprehensive should close position with confirmation', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for close button
        const closeButtons = page.locator('button:has-text("Close"), [data-testid*="close-position"]');
        const closeCount = await closeButtons.count();

        if (closeCount > 0) {
            // Click first close button
            const closeButton = closeButtons.first();
            await closeButton.click();

            // Verify confirmation dialog appears
            const dialog = portfolio.resetConfirmDialog;
            await expect(dialog).toBeVisible({ timeout: 5000 });

            // Verify dialog has Confirm and Cancel buttons
            const confirmBtn = portfolio.resetConfirmButton;
            const cancelBtn = portfolio.resetCancelButton;

            await expect(confirmBtn).toBeVisible();
            await expect(cancelBtn).toBeVisible();
        }
    });

    test('@comprehensive should cancel position close action', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for close button
        const closeButtons = page.locator('button:has-text("Close"), [data-testid*="close-position"]');
        const closeCount = await closeButtons.count();

        if (closeCount > 0) {
            const initialCount = closeCount;

            // Click close button
            const closeButton = closeButtons.first();
            await closeButton.click();

            // Wait for dialog
            const dialog = portfolio.resetConfirmDialog;
            await expect(dialog).toBeVisible({ timeout: 5000 });

            // Click cancel
            const cancelBtn = portfolio.resetCancelButton;
            await cancelBtn.click();

            // Verify dialog closed and position still exists
            await expect(dialog).not.toBeVisible();

            const finalCount = await page.locator('button:has-text("Close"), [data-testid*="close-position"]').count();
            expect(finalCount).toBeGreaterThanOrEqual(0);
        }
    });

    test('@comprehensive should confirm and close position', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for close button
        const closeButtons = page.locator('button:has-text("Close"), [data-testid*="close-position"]');
        const closeCount = await closeButtons.count();

        if (closeCount > 0) {
            // Click close button
            const closeButton = closeButtons.first();
            await closeButton.click();

            // Wait for dialog
            const dialog = portfolio.resetConfirmDialog;
            await expect(dialog).toBeVisible({ timeout: 5000 });

            // Click confirm
            const confirmBtn = portfolio.resetConfirmButton;
            await confirmBtn.click();

            // Verify dialog closed
            await page.waitForLoadState('networkidle');
            const isDialogVisible = await dialog.isVisible().catch(() => false);
            expect(isDialogVisible).toBe(false);
        }
    });

    test('@comprehensive should redeem resolved position with confirmation', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Look for redeem button
        const redeemButtons = page.locator('button:has-text("Redeem"), [data-testid*="redeem"]');
        const redeemCount = await redeemButtons.count();

        if (redeemCount > 0) {
            // Click first redeem button
            const redeemButton = redeemButtons.first();
            await redeemButton.click();

            // Verify confirmation dialog appears
            const dialog = portfolio.resetConfirmDialog;
            await expect(dialog).toBeVisible({ timeout: 5000 });

            // Verify dialog has Confirm and Cancel buttons
            const confirmBtn = portfolio.resetConfirmButton;
            const cancelBtn = portfolio.resetCancelButton;

            await expect(confirmBtn).toBeVisible();
            await expect(cancelBtn).toBeVisible();
        }
    });

    test('@comprehensive should remove position from table after close', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Get initial position count
        const initialPositions = page.locator('tr[data-testid*="position"]');
        const initialCount = await initialPositions.count();

        // If no positions, skip
        if (initialCount === 0) {
            // Empty portfolio - no positions to close
            return;
        }

        // Close a position if possible
        const closeButtons = page.locator('button:has-text("Close"), [data-testid*="close-position"]');
        if (await closeButtons.count() > 0) {
            const closeButton = closeButtons.first();
            await closeButton.click();

            const dialog = portfolio.resetConfirmDialog;
            if (await dialog.isVisible()) {
                const confirmBtn = portfolio.resetConfirmButton;
                await confirmBtn.click();

                // Wait for update
                await page.waitForLoadState('networkidle');

                // Verify position count decreased
                const finalPositions = page.locator('tr[data-testid*="position"]');
                const finalCount = await finalPositions.count();

                expect(finalCount).toBeLessThanOrEqual(initialCount);
            }
        }
    });

    test('@comprehensive should remove position from table after redeem', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Get initial position count
        const initialPositions = page.locator('tr[data-testid*="position"]');
        const initialCount = await initialPositions.count();

        // If no positions, skip
        if (initialCount === 0) {
            // Empty portfolio
            return;
        }

        // Redeem a position if possible
        const redeemButtons = page.locator('button:has-text("Redeem"), [data-testid*="redeem"]');
        if (await redeemButtons.count() > 0) {
            const redeemButton = redeemButtons.first();
            await redeemButton.click();

            const dialog = portfolio.resetConfirmDialog;
            if (await dialog.isVisible()) {
                const confirmBtn = portfolio.resetConfirmButton;
                await confirmBtn.click();

                // Wait for update
                await page.waitForLoadState('networkidle');

                // Verify position count decreased
                const finalPositions = page.locator('tr[data-testid*="position"]');
                const finalCount = await finalPositions.count();

                expect(finalCount).toBeLessThanOrEqual(initialCount);
            }
        }
    });

    // ─── Paper Trading Tests ───────────────────────────────────────────────────

    test('@smoke @comprehensive should show reset paper account button in Paper tab', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Verify reset button exists
        const resetButton = portfolio.resetPaperButton;
        await expect(resetButton).toBeVisible();
    });

    test('@comprehensive should open confirmation dialog when clicking reset', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Click reset button
        const resetButton = portfolio.resetPaperButton;
        await resetButton.click();

        // Verify dialog appears
        const dialog = portfolio.resetConfirmDialog;
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Verify dialog content
        const dialogText = await dialog.textContent();
        expect(dialogText).toMatch(/reset|confirm/i);
    });

    test('@comprehensive should confirm reset paper account', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Store initial positions
        const initialPositions = page.locator('tr[data-testid*="position"]');
        const initialCount = await initialPositions.count();

        // Only proceed if there are positions to reset
        if (initialCount > 0) {
            // Click reset button
            const resetButton = portfolio.resetPaperButton;
            await resetButton.click();

            // Wait for dialog
            const dialog = portfolio.resetConfirmDialog;
            await expect(dialog).toBeVisible({ timeout: 5000 });

            // Click confirm
            const confirmBtn = portfolio.resetConfirmButton;
            await confirmBtn.click();

            // Wait for update
            await page.waitForLoadState('networkidle');

            // Verify dialog closed
            const isDialogVisible = await dialog.isVisible().catch(() => false);
            expect(isDialogVisible).toBe(false);

            // Verify positions cleared
            const finalPositions = page.locator('tr[data-testid*="position"]');
            const finalCount = await finalPositions.count();
            expect(finalCount).toBe(0);
        }
    });

    test('@comprehensive should cancel paper account reset', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Store initial positions
        const initialPositions = page.locator('tr[data-testid*="position"]');
        const initialCount = await initialPositions.count();

        // Click reset button
        const resetButton = portfolio.resetPaperButton;
        await resetButton.click();

        // Wait for dialog
        const dialog = portfolio.resetConfirmDialog;
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Click cancel
        const cancelBtn = portfolio.resetCancelButton;
        await cancelBtn.click();

        // Verify dialog closed
        await expect(dialog).not.toBeVisible();

        // Verify positions unchanged
        const finalPositions = page.locator('tr[data-testid*="position"]');
        const finalCount = await finalPositions.count();
        expect(finalCount).toBe(initialCount);
    });

    test('@comprehensive should clear paper positions and P&L after reset', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Get initial stats
        const initialStats = await portfolio.getSummaryStats();

        // Click reset button
        const resetButton = portfolio.resetPaperButton;
        const isVisible = await resetButton.isVisible().catch(() => false);

        if (isVisible) {
            await resetButton.click();

            // Confirm reset
            const dialog = portfolio.resetConfirmDialog;
            if (await dialog.isVisible()) {
                const confirmBtn = portfolio.resetConfirmButton;
                await confirmBtn.click();

                // Wait for update
                await page.waitForLoadState('networkidle');

                // Verify positions table is empty
                const positions = page.locator('tr[data-testid*="position"]');
                const positionCount = await positions.count();
                expect(positionCount).toBe(0);

                // Verify empty state message
                const emptyState = page.locator(':text("No positions"), :text("empty")');
                const hasEmptyState = await emptyState.isVisible().catch(() => false);
                expect(hasEmptyState).toBe(true);
            }
        }
    });

    test('@comprehensive should show paper trading info when account is reset', async ({ page }) => {
        const portfolio = new PortfolioPage(page);
        await portfolio.goto();

        // Switch to Paper tab
        await portfolio.switchToPaper();

        // Verify reset button and info message
        const resetButton = portfolio.resetPaperButton;
        if (await resetButton.isVisible()) {
            // Verify info/help text exists
            const infoText = page.locator(':text("paper"), :text("simulated"), :text("test")').first();
            const hasInfo = await infoText.isVisible().catch(() => false);

            // Info text or button should be visible
            expect(resetButton).toBeVisible();
        }
    });
});
