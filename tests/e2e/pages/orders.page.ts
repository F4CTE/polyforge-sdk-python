import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Orders page (/orders).
 *
 * Handles order management including regular orders and conditional orders
 * (TAKE_PROFIT, STOP_LOSS, TRAILING_STOP, LIMIT, PEGGED), filtering by status,
 * and pagination.
 *
 * Key implementation details:
 * - View tabs: "Orders" and "Conditional" (role="tab")
 * - New conditional button: "New Conditional" (not "New Conditional Order")
 * - Dialog fields use native <Select> with id="cond-*" attributes
 * - Market select populates from portfolio positions
 * - Submit button says "Create" (not "Submit")
 */
export class OrdersPage {
    readonly page: Page;
    readonly ordersTab: Locator;
    readonly conditionalTab: Locator;
    readonly statusFilter: Record<string, Locator>;
    readonly newConditionalButton: Locator;
    readonly orderRows: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    // Conditional order dialog fields (native <select> and <input> by id)
    readonly marketSelect: Locator;
    readonly tokenIdField: Locator;
    readonly typeSelect: Locator;
    readonly sideSelect: Locator;
    readonly outcomeSelect: Locator;
    readonly sizeInput: Locator;
    readonly triggerPriceInput: Locator;
    readonly limitPriceInput: Locator;
    readonly trailingPctInput: Locator;
    readonly expiresAtInput: Locator;
    readonly createButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.ordersTab = page.locator('[role="tab"]', { hasText: 'Orders' });
        this.conditionalTab = page.locator('[role="tab"]', { hasText: 'Conditional' });

        this.statusFilter = {
            All: page.getByRole('button', { name: 'All', exact: true }),
            Confirmed: page.getByRole('button', { name: 'Confirmed', exact: true }),
            Live: page.getByRole('button', { name: 'Live', exact: true }),
            Pending: page.getByRole('button', { name: 'Pending', exact: true }),
            Cancelled: page.getByRole('button', { name: 'Cancelled', exact: true }),
            Failed: page.getByRole('button', { name: 'Failed', exact: true }),
        };

        this.newConditionalButton = page.locator('button', { hasText: 'New Conditional' });
        this.orderRows = page.locator('[data-testid="order-row"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');

        // Conditional order dialog — all fields are native elements with id="cond-*"
        this.marketSelect = page.locator('#cond-market-select');
        this.tokenIdField = page.locator('#cond-token-id');
        this.typeSelect = page.locator('#cond-type');
        this.sideSelect = page.locator('#cond-side');
        this.outcomeSelect = page.locator('#cond-outcome');
        this.sizeInput = page.locator('#cond-size');
        this.triggerPriceInput = page.locator('#cond-trigger-price');
        this.limitPriceInput = page.locator('#cond-limit-price');
        this.trailingPctInput = page.locator('#cond-trailing-pct');
        this.expiresAtInput = page.locator('#cond-expires-at');
        this.createButton = page.locator('[role="dialog"] button', { hasText: 'Create' });
        this.cancelButton = page.locator('[role="dialog"] button', { hasText: 'Cancel' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/orders');
        await expect(this.page.locator('h1', { hasText: 'Orders' })).toBeVisible({ timeout: 15_000 });
    }

    async switchToOrders(): Promise<void> {
        await this.ordersTab.click();
    }

    async switchToConditional(): Promise<void> {
        await this.conditionalTab.click();
    }

    async filterByStatus(status: 'All' | 'Confirmed' | 'Live' | 'Pending' | 'Cancelled' | 'Failed'): Promise<void> {
        await this.statusFilter[status].click();
    }

    /**
     * Open the create conditional order dialog and fill in the form.
     * Market is selected from portfolio positions via native <select>.
     * Type, side, and outcome are also native <select> elements.
     */
    async createConditionalOrder(params: {
        market?: string; // Optional: value or partial label to match in the position select
        tokenId?: string;
        type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED';
        side: 'BUY' | 'SELL';
        outcome: 'YES' | 'NO';
        size: string;
        triggerPrice?: string;
        limitPrice?: string;
        trailingPct?: string;
        expiresAt?: string;
    }): Promise<boolean> {
        const portfolioResponsePromise = this.page.waitForResponse(
            response =>
                response.url().includes('/api/v1/portfolio') &&
                response.request().method() === 'GET',
            { timeout: 10_000 },
        );
        await this.newConditionalButton.click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();

        const portfolioResponse = await portfolioResponsePromise;
        expect(portfolioResponse.ok()).toBeTruthy();
        const portfolioData = await portfolioResponse.json();
        const positions = Array.isArray(portfolioData?.positions) ? portfolioData.positions : [];
        if (positions.length === 0) {
            await this.cancelButton.click();
            return false;
        }

        // Select market from positions dropdown. Prefer an explicit market match,
        // but fall back to the first seeded position so tests do not depend on
        // a specific demo market label.
        const options = this.marketSelect.locator('option');
        await expect
            .poll(() => options.count(), { timeout: 10_000 })
            .toBeGreaterThan(1);
        const optionCount = await options.count();

        let selectedValue = await options.nth(1).getAttribute('value') ?? '';
        if (params.market) {
            for (let i = 1; i < optionCount; i++) { // skip placeholder
                const text = await options.nth(i).textContent() ?? '';
                if (text.toLowerCase().includes(params.market.toLowerCase())) {
                    selectedValue = await options.nth(i).getAttribute('value') ?? selectedValue;
                    break;
                }
            }
        }
        await this.marketSelect.selectOption(selectedValue);

        // Select type (native <select>)
        await this.typeSelect.selectOption(params.type);

        // Select side (native <select>)
        await this.sideSelect.selectOption(params.side);

        // Select outcome (native <select>)
        await this.outcomeSelect.selectOption(params.outcome);

        // Fill size
        await this.sizeInput.fill(params.size);

        // Fill trigger price
        if (params.triggerPrice) {
            await this.triggerPriceInput.fill(params.triggerPrice);
        }

        // Fill limit price
        if (params.limitPrice) {
            await this.limitPriceInput.fill(params.limitPrice);
        }

        // Fill trailing pct
        if (params.trailingPct) {
            await this.trailingPctInput.fill(params.trailingPct);
        }

        // Fill expiration
        if (params.expiresAt) {
            await this.expiresAtInput.fill(params.expiresAt);
        }

        // Submit and wait for the app to reload the conditional-order list.
        const createResponse = this.page.waitForResponse(
            response =>
                response.url().includes('/api/v1/orders/conditional') &&
                response.request().method() === 'POST',
            { timeout: 10_000 },
        );
        await this.createButton.click();
        const response = await createResponse;
        expect(response.ok()).toBeTruthy();
        await expect(this.page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 });
        await expect(this.orderRows.first()).toBeVisible({ timeout: 10_000 });
        return true;
    }

    async cancelOrder(id: string): Promise<void> {
        await this.page.locator(`[data-testid="cancel-order-${id}"]`).click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();
        await this.page.locator('[role="dialog"] button', { hasText: 'Confirm' }).click();
    }

    async getOrderCount(): Promise<number> {
        return await this.orderRows.count();
    }
}
