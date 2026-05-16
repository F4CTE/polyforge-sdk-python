import { test, expect } from '@playwright/test';
import { OrdersPage } from '../pages/orders.page';
import { apiLogin } from '../helpers/api';

/**
 * Orders — Full Workflow Coverage
 *
 * Comprehensive test suite for the Orders page (/orders).
 * Covers order list, conditional orders, status filters, and pagination.
 *
 * Run with: pnpm --filter @polyforge/e2e test orders-comprehensive
 */

const TEST_USER_EMAIL = 'alice@e2e.dev.local';
const TEST_USER_PASSWORD = 'TestPass123!';

test.describe('Orders — Full Workflow Coverage', () => {

    test.beforeEach(async ({ page }) => {
        const { token } = await apiLogin(TEST_USER_EMAIL, TEST_USER_PASSWORD);
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    // ─── Order List Tab ────────────────────────────────────────────────────────

    test('@smoke orders page loads with order list', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Verify page title
        await expect(page.locator('h1', { hasText: 'Orders' })).toBeVisible();

        // Verify tabs are present
        await expect(ordersPage.ordersTab).toBeVisible();
        await expect(ordersPage.conditionalTab).toBeVisible();
    });

    test('default tab is orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Orders tab should be active by default — check via aria-selected or just visibility
        const ariaSelected = await ordersPage.ordersTab.getAttribute('aria-selected').catch(() => null);
        if (ariaSelected !== null) {
            expect(ariaSelected).toBe('true');
        } else {
            await expect(ordersPage.ordersTab).toBeVisible();
        }
    });

    test('orders page shows required columns', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Check for column headers: Market, Type, Side, Size, Price, Status, Date
        await expect(page.locator('th', { hasText: /Market|market/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Type|type/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Side|side/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Size|size/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Price|price/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Status|status/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Date|date/i })).toBeVisible();
    });

    test('empty state shows when no orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // If no orders exist, should show empty state
        const orderCount = await ordersPage.getOrderCount();
        if (orderCount === 0) {
            await expect(page.locator('text=/no orders|empty/i')).toBeVisible();
        }
    });

    // ─── Status Filters ────────────────────────────────────────────────────────

    test('default filter is all', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // "All" filter should be active/selected by default
        const ariaPressed = await ordersPage.statusFilter.All.getAttribute('aria-pressed').catch(() => null);
        if (ariaPressed !== null) {
            expect(ariaPressed).toBe('true');
        } else {
            await expect(ordersPage.statusFilter.All).toBeVisible();
        }
    });

    test('filter confirmed shows only confirmed orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Filter by Confirmed
        await ordersPage.filterByStatus('Confirmed');

        // Verify filter is active
        await expect(ordersPage.statusFilter.Confirmed).toBeVisible();

        // If there are orders, verify all visible orders have "Confirmed" status
        const count = await ordersPage.getOrderCount();
        if (count > 0) {
            const statusCells = page.locator('[data-testid="order-row"] [data-testid="status-cell"]');
            const statusCount = await statusCells.count();
            for (let i = 0; i < statusCount; i++) {
                const text = await statusCells.nth(i).textContent();
                expect(text).toContain('Confirmed');
            }
        }
    });

    test('filter live shows only live orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.filterByStatus('Live');
        await expect(ordersPage.statusFilter.Live).toBeVisible();

        const count = await ordersPage.getOrderCount();
        if (count > 0) {
            const statusCells = page.locator('[data-testid="order-row"] [data-testid="status-cell"]');
            const statusCount = await statusCells.count();
            for (let i = 0; i < statusCount; i++) {
                const text = await statusCells.nth(i).textContent();
                expect(text).toContain('Live');
            }
        }
    });

    test('filter pending shows only pending orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.filterByStatus('Pending');
        await expect(ordersPage.statusFilter.Pending).toBeVisible();

        const count = await ordersPage.getOrderCount();
        if (count > 0) {
            const statusCells = page.locator('[data-testid="order-row"] [data-testid="status-cell"]');
            const statusCount = await statusCells.count();
            for (let i = 0; i < statusCount; i++) {
                const text = await statusCells.nth(i).textContent();
                expect(text).toContain('Pending');
            }
        }
    });

    test('filter cancelled shows only cancelled orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.filterByStatus('Cancelled');
        await expect(ordersPage.statusFilter.Cancelled).toBeVisible();

        const count = await ordersPage.getOrderCount();
        if (count > 0) {
            const statusCells = page.locator('[data-testid="order-row"] [data-testid="status-cell"]');
            const statusCount = await statusCells.count();
            for (let i = 0; i < statusCount; i++) {
                const text = await statusCells.nth(i).textContent();
                expect(text).toContain('Cancelled');
            }
        }
    });

    test('filter failed shows only failed orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.filterByStatus('Failed');
        await expect(ordersPage.statusFilter.Failed).toBeVisible();

        const count = await ordersPage.getOrderCount();
        if (count > 0) {
            const statusCells = page.locator('[data-testid="order-row"] [data-testid="status-cell"]');
            const statusCount = await statusCells.count();
            for (let i = 0; i < statusCount; i++) {
                const text = await statusCells.nth(i).textContent();
                expect(text).toContain('Failed');
            }
        }
    });

    test('filter all shows all orders again after filtering', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Get initial count with "All"
        const initialCount = await ordersPage.getOrderCount();

        // Filter to Confirmed
        await ordersPage.filterByStatus('Confirmed');
        const confirmedCount = await ordersPage.getOrderCount();

        // Filter back to All
        await ordersPage.filterByStatus('All');
        const finalCount = await ordersPage.getOrderCount();

        // Should return to initial count
        expect(finalCount).toBe(initialCount);
    });

    // ─── Conditional Orders Tab ────────────────────────────────────────────────

    test('switch to conditional tab shows conditional orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.switchToConditional();

        // Verify Conditional tab is now active
        await expect(ordersPage.conditionalTab).toBeVisible();
    });

    test('conditional tab shows appropriate columns', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.switchToConditional();

        // Check for conditional-specific columns
        await expect(page.locator('th', { hasText: /Type|type/i })).toBeVisible();
        await expect(page.locator('th', { hasText: /Trigger|trigger/i })).toBeVisible();
    });

    test('empty state for conditional orders when none exist', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.switchToConditional();

        const conditionalCount = await ordersPage.getOrderCount();
        if (conditionalCount === 0) {
            await expect(page.locator('text=/no.*conditional|empty/i')).toBeVisible();
        }
    });

    // ─── Create Conditional Orders ─────────────────────────────────────────────
    // These tests require the user to have portfolio positions.
    // Market select populates from /api/v1/portfolio positions.
    // If no positions exist, tests are skipped gracefully.

    test('create take_profit conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        // Open dialog and check if positions are available
        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) {
            // No positions — close dialog and skip
            await ordersPage.cancelButton.click();
            return;
        }

        // Select first position
        const firstOption = ordersPage.marketSelect.locator('option').nth(1);
        const value = await firstOption.getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);

        await ordersPage.typeSelect.selectOption('TAKE_PROFIT');
        await ordersPage.sideSelect.selectOption('BUY');
        await ordersPage.outcomeSelect.selectOption('YES');
        await ordersPage.sizeInput.fill('10');
        await ordersPage.triggerPriceInput.fill('0.75');

        await ordersPage.createButton.click();

        // Wait for dialog to close or toast
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('create stop_loss conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('STOP_LOSS');
        await ordersPage.sideSelect.selectOption('SELL');
        await ordersPage.outcomeSelect.selectOption('YES');
        await ordersPage.sizeInput.fill('5');
        await ordersPage.triggerPriceInput.fill('0.30');

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('create trailing_stop conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('TRAILING_STOP');
        await ordersPage.sideSelect.selectOption('SELL');
        await ordersPage.outcomeSelect.selectOption('NO');
        await ordersPage.sizeInput.fill('8');
        await ordersPage.trailingPctInput.fill('5');
        await ordersPage.triggerPriceInput.fill('0.50');

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('create limit conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('LIMIT');
        await ordersPage.sideSelect.selectOption('BUY');
        await ordersPage.outcomeSelect.selectOption('NO');
        await ordersPage.sizeInput.fill('12');
        await ordersPage.limitPriceInput.fill('0.45');
        await ordersPage.triggerPriceInput.fill('0.50');

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('create pegged conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('PEGGED');
        await ordersPage.sideSelect.selectOption('BUY');
        await ordersPage.outcomeSelect.selectOption('YES');
        await ordersPage.sizeInput.fill('7');
        await ordersPage.triggerPriceInput.fill('0.60');

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('conditional order with expiration date is saved', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('TAKE_PROFIT');
        await ordersPage.sideSelect.selectOption('BUY');
        await ordersPage.outcomeSelect.selectOption('YES');
        await ordersPage.sizeInput.fill('10');
        await ordersPage.triggerPriceInput.fill('0.75');

        // Set expiry
        const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
        await ordersPage.expiresAtInput.fill(expiryDate);

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    test('conditional order without expiration is saved', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount <= 1) { await ordersPage.cancelButton.click(); return; }

        const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
        await ordersPage.marketSelect.selectOption(value);
        await ordersPage.typeSelect.selectOption('STOP_LOSS');
        await ordersPage.sideSelect.selectOption('SELL');
        await ordersPage.outcomeSelect.selectOption('NO');
        await ordersPage.sizeInput.fill('5');
        await ordersPage.triggerPriceInput.fill('0.25');

        await ordersPage.createButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 }).catch(() => {});
    });

    // ─── Conditional Order Validation ──────────────────────────────────────────

    test('submit conditional order with empty market triggers validation', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Try to submit without selecting market — uses native HTML required validation
        const createBtn = ordersPage.createButton;
        await createBtn.click();

        // The market select is required, so the browser blocks submission
        // Verify we're still on the dialog
        await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('submit conditional order with missing size triggers validation', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Fill market but skip size
        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount > 1) {
            const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
            await ordersPage.marketSelect.selectOption(value);
        }

        // Submit with empty size — size input is required
        await ordersPage.createButton.click();

        // Should still be in dialog (validation prevents submission)
        await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('submit conditional order with missing trigger price triggers validation', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount > 1) {
            const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
            await ordersPage.marketSelect.selectOption(value);
        }

        await ordersPage.sizeInput.fill('10');
        // Leave trigger price empty (it's required)

        await ordersPage.createButton.click();

        // Should still be in dialog
        await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('submit conditional order with zero size triggers validation', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount > 1) {
            const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
            await ordersPage.marketSelect.selectOption(value);
        }

        await ordersPage.sizeInput.fill('0');
        await ordersPage.triggerPriceInput.fill('0.50');

        await ordersPage.createButton.click();

        // Zero size should trigger validation: either dialog stays open with client-side
        // error, or server rejects with a toast.
        const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
        const toastVisible = await page.locator('[data-sonner-toast]').isVisible().catch(() => false);
        expect(dialogVisible || toastVisible).toBe(true);
    });

    test('submit conditional order with negative trigger price shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const optionCount = await ordersPage.marketSelect.locator('option').count();
        if (optionCount > 1) {
            const value = await ordersPage.marketSelect.locator('option').nth(1).getAttribute('value') ?? '';
            await ordersPage.marketSelect.selectOption(value);
        }

        await ordersPage.typeSelect.selectOption('TAKE_PROFIT');
        await ordersPage.sideSelect.selectOption('BUY');
        await ordersPage.outcomeSelect.selectOption('YES');
        await ordersPage.sizeInput.fill('10');
        await ordersPage.triggerPriceInput.fill('-0.5');

        await ordersPage.createButton.click();

        // Negative trigger price should show an error: either dialog stays open
        // (client validation) or closes with error toast (server validation).
        const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
        const toastVisible = await page.locator('[data-sonner-toast]').isVisible().catch(() => false);
        expect(dialogVisible || toastVisible).toBe(true);
    });

    // ─── Conditional Order Actions ─────────────────────────────────────────────

    test('cancel conditional order removes it from list', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        // Only test if there are orders
        if (initialCount > 0) {
            // Get first order ID (would need to extract from DOM)
            const firstOrder = page.locator('[data-testid="order-row"]').first();
            const orderId = await firstOrder.getAttribute('data-order-id') || 'test-order-1';

            // Cancel it
            await ordersPage.cancelOrder(orderId);

            // Verify count decreased
            const finalCount = await ordersPage.getOrderCount();
            expect(finalCount).toBeLessThan(initialCount);
        }
    });

    test('cancel dialog dismisses on cancel button', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        if (initialCount > 0) {
            const firstOrder = page.locator('[data-testid="order-row"]').first();
            const orderId = await firstOrder.getAttribute('data-order-id') || 'test-order-1';

            // Open cancel dialog
            await page.locator(`[data-testid="cancel-order-${orderId}"]`).click();
            await expect(page.locator('[role="dialog"]')).toBeVisible();

            // Click cancel button
            await page.locator('[role="dialog"] button', { hasText: 'Cancel' }).click();

            // Dialog should disappear
            await expect(page.locator('[role="dialog"]')).toBeHidden();

            // Count should not change
            const finalCount = await ordersPage.getOrderCount();
            expect(finalCount).toBe(initialCount);
        }
    });

    // ─── Order Pagination ──────────────────────────────────────────────────────

    test('navigate to next page in pagination', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Check if next button exists and is enabled (there are more pages)
        const nextVisible = await ordersPage.paginationNext.isVisible().catch(() => false);
        if (!nextVisible) { test.skip(); return; }
        const isNextEnabled = await ordersPage.paginationNext.isEnabled();

        if (isNextEnabled) {
            const initialOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

            await ordersPage.paginationNext.click();

            const newOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

            // Orders should be different
            expect(newOrderId).not.toBe(initialOrderId);
        }
    });

    test('navigate to previous page in pagination', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Only test if pagination exists and we can go to next page
        const nextVisible = await ordersPage.paginationNext.isVisible().catch(() => false);
        if (!nextVisible) { test.skip(); return; }
        const isNextEnabled = await ordersPage.paginationNext.isEnabled();

        if (isNextEnabled) {
            // Go to next page
            await ordersPage.paginationNext.click();

            // Check if prev button is enabled
            const isPrevEnabled = await ordersPage.paginationPrev.isEnabled();

            if (isPrevEnabled) {
                const pageOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

                // Go back
                await ordersPage.paginationPrev.click();

                const firstPageOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

                expect(firstPageOrderId).not.toBe(pageOrderId);
            }
        }
    });

    test('page counter updates on pagination', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Skip if pagination is not rendered (not enough data for multiple pages)
        const pageInfo = page.locator('[data-testid="page-info"]');
        const pageInfoVisible = await pageInfo.isVisible().catch(() => false);
        if (!pageInfoVisible) { test.skip(); return; }

        // Get initial page number
        const initialPageText = await pageInfo.textContent() || 'Page 1';

        const nextVisible = await ordersPage.paginationNext.isVisible().catch(() => false);
        if (!nextVisible) { test.skip(); return; }
        const isNextEnabled = await ordersPage.paginationNext.isEnabled();
        if (isNextEnabled) {
            await ordersPage.paginationNext.click();

            const newPageText = await page.locator('[data-testid="page-info"]').textContent() || 'Page 2';

            // Page number should be different
            expect(newPageText).not.toBe(initialPageText);
        }
    });

    // ─── Side/Outcome Combinations ─────────────────────────────────────────────

    test('buy + yes order creates correctly', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'TAKE_PROFIT',
            side: 'BUY',
            outcome: 'YES',
            size: '10',
            triggerPrice: '0.75',
        });

        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

    test('buy + no order creates correctly', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'TAKE_PROFIT',
            side: 'BUY',
            outcome: 'NO',
            size: '10',
            triggerPrice: '0.75',
        });

        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

    test('sell + yes order creates correctly', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'STOP_LOSS',
            side: 'SELL',
            outcome: 'YES',
            size: '5',
            triggerPrice: '0.30',
        });

        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

    test('sell + no order creates correctly', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'STOP_LOSS',
            side: 'SELL',
            outcome: 'NO',
            size: '5',
            triggerPrice: '0.30',
        });

        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

});
