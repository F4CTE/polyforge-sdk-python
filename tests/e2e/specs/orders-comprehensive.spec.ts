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

        // Orders tab should be active by default
        await expect(ordersPage.ordersTab).toHaveAttribute('aria-selected', 'true');
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
        await expect(ordersPage.statusFilter.All).toHaveAttribute('aria-pressed', 'true');
    });

    test('filter confirmed shows only confirmed orders', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Filter by Confirmed
        await ordersPage.filterByStatus('Confirmed');

        // Verify filter is active
        await expect(ordersPage.statusFilter.Confirmed).toHaveAttribute('aria-pressed', 'true');

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
        await expect(ordersPage.statusFilter.Live).toHaveAttribute('aria-pressed', 'true');

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
        await expect(ordersPage.statusFilter.Pending).toHaveAttribute('aria-pressed', 'true');

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
        await expect(ordersPage.statusFilter.Cancelled).toHaveAttribute('aria-pressed', 'true');

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
        await expect(ordersPage.statusFilter.Failed).toHaveAttribute('aria-pressed', 'true');

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
        await expect(ordersPage.conditionalTab).toHaveAttribute('aria-selected', 'true');
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

    test('create take_profit conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'TAKE_PROFIT',
            side: 'BUY',
            outcome: 'YES',
            size: '10',
            triggerPrice: '0.75',
        });

        // Verify order was created
        const finalCount = await ordersPage.getOrderCount();
        expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('create stop_loss conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'STOP_LOSS',
            side: 'SELL',
            outcome: 'YES',
            size: '5',
            triggerPrice: '0.30',
        });

        const finalCount = await ordersPage.getOrderCount();
        expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('create trailing_stop conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'TRAILING_STOP',
            side: 'SELL',
            outcome: 'NO',
            size: '8',
            trailingPct: '5',
        });

        const finalCount = await ordersPage.getOrderCount();
        expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('create limit conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'LIMIT',
            side: 'BUY',
            outcome: 'NO',
            size: '12',
            limitPrice: '0.45',
        });

        const finalCount = await ordersPage.getOrderCount();
        expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('create pegged conditional order succeeds', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const initialCount = await ordersPage.getOrderCount();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'PEGGED',
            side: 'BUY',
            outcome: 'YES',
            size: '7',
        });

        const finalCount = await ordersPage.getOrderCount();
        expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('conditional order with expiration date is saved', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'TAKE_PROFIT',
            side: 'BUY',
            outcome: 'YES',
            size: '10',
            triggerPrice: '0.75',
            expiresAt: expiryDate,
        });

        // Verify the order appears in the list
        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

    test('conditional order without expiration is saved', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();
        await ordersPage.switchToConditional();

        await ordersPage.createConditionalOrder({
            market: 'TRUMP',
            type: 'STOP_LOSS',
            side: 'SELL',
            outcome: 'NO',
            size: '5',
            triggerPrice: '0.25',
        });

        const count = await ordersPage.getOrderCount();
        expect(count).toBeGreaterThan(0);
    });

    // ─── Conditional Order Validation ──────────────────────────────────────────

    test('submit conditional order with empty market shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Try to submit without selecting market
        const submitBtn = page.locator('[role="dialog"] button', { hasText: 'Submit' });

        // Submit button should be disabled or error should appear on submit
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
            await submitBtn.click();
            // Expect error message
            await expect(page.locator('text=/market|required/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('submit conditional order with missing size shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Fill market and other fields but skip size
        await ordersPage.marketSelect.click();
        await page.locator('text=TRUMP').click();

        await ordersPage.typeSelect.click();
        await page.locator('text=Take Profit').click();

        await ordersPage.sideSelect.click();
        await page.locator('text=BUY').click();

        // Submit without size
        const submitBtn = page.locator('[role="dialog"] button', { hasText: 'Submit' });
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
            await submitBtn.click();
            await expect(page.locator('text=/size|required/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('submit conditional order with missing trigger price shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Fill required fields except trigger price
        await ordersPage.marketSelect.click();
        await page.locator('text=TRUMP').click();

        await ordersPage.typeSelect.click();
        await page.locator('text=Take Profit').click();

        await ordersPage.sideSelect.click();
        await page.locator('text=BUY').click();

        await ordersPage.outcomeSelect.click();
        await page.locator('text=YES').click();

        await ordersPage.sizeInput.fill('10');

        // Submit without trigger price
        const submitBtn = page.locator('[role="dialog"] button', { hasText: 'Submit' });
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
            await submitBtn.click();
            await expect(page.locator('text=/trigger|required/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('submit conditional order with zero size shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        await ordersPage.marketSelect.click();
        await page.locator('text=TRUMP').click();

        await ordersPage.typeSelect.click();
        await page.locator('text=Take Profit').click();

        await ordersPage.sideSelect.click();
        await page.locator('text=BUY').click();

        await ordersPage.outcomeSelect.click();
        await page.locator('text=YES').click();

        // Set size to 0
        await ordersPage.sizeInput.fill('0');

        const submitBtn = page.locator('[role="dialog"] button', { hasText: 'Submit' });
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
            await submitBtn.click();
            await expect(page.locator('text=/size|must|greater/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('submit conditional order with negative trigger price shows error', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        await ordersPage.newConditionalButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        await ordersPage.marketSelect.click();
        await page.locator('text=TRUMP').click();

        await ordersPage.typeSelect.click();
        await page.locator('text=Take Profit').click();

        await ordersPage.sideSelect.click();
        await page.locator('text=BUY').click();

        await ordersPage.outcomeSelect.click();
        await page.locator('text=YES').click();

        await ordersPage.sizeInput.fill('10');
        await ordersPage.triggerPriceInput.fill('-0.5');

        const submitBtn = page.locator('[role="dialog"] button', { hasText: 'Submit' });
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
            await submitBtn.click();
            await expect(page.locator('text=/trigger|price|negative|positive/i')).toBeVisible({ timeout: 5000 });
        }
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

        // Check if next button is enabled (there are more pages)
        const isNextEnabled = await ordersPage.paginationNext.isEnabled();

        if (isNextEnabled) {
            const initialOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

            await ordersPage.paginationNext.click();
            await page.waitForTimeout(300);

            const newOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

            // Orders should be different
            expect(newOrderId).not.toBe(initialOrderId);
        }
    });

    test('navigate to previous page in pagination', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Only test if we can go to next page
        const isNextEnabled = await ordersPage.paginationNext.isEnabled();

        if (isNextEnabled) {
            // Go to next page
            await ordersPage.paginationNext.click();
            await page.waitForTimeout(300);

            // Check if prev button is enabled
            const isPrevEnabled = await ordersPage.paginationPrev.isEnabled();

            if (isPrevEnabled) {
                const pageOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

                // Go back
                await ordersPage.paginationPrev.click();
                await page.waitForTimeout(300);

                const firstPageOrderId = await page.locator('[data-testid="order-row"]').first().getAttribute('data-order-id');

                expect(firstPageOrderId).not.toBe(pageOrderId);
            }
        }
    });

    test('page counter updates on pagination', async ({ page }) => {
        const ordersPage = new OrdersPage(page);
        await ordersPage.goto();

        // Get initial page number
        const initialPageText = await page.locator('[data-testid="page-info"]').textContent() || 'Page 1';

        const isNextEnabled = await ordersPage.paginationNext.isEnabled();
        if (isNextEnabled) {
            await ordersPage.paginationNext.click();
            await page.waitForTimeout(300);

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
