import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Orders page (/orders).
 *
 * Handles order management including regular orders and conditional orders
 * (TAKE_PROFIT, STOP_LOSS, TRAILING_STOP, LIMIT, PEGGED), filtering by status,
 * and pagination.
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

    // Conditional order dialog fields
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
    readonly submitButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.ordersTab = page.locator('[role="tab"]', { hasText: 'Orders' });
        this.conditionalTab = page.locator('[role="tab"]', { hasText: 'Conditional' });

        this.statusFilter = {
            All: page.locator('button', { hasText: 'All' }),
            Confirmed: page.locator('button', { hasText: 'Confirmed' }),
            Live: page.locator('button', { hasText: 'Live' }),
            Pending: page.locator('button', { hasText: 'Pending' }),
            Cancelled: page.locator('button', { hasText: 'Cancelled' }),
            Failed: page.locator('button', { hasText: 'Failed' }),
        };

        this.newConditionalButton = page.locator('button', { hasText: 'New Conditional Order' });
        this.orderRows = page.locator('[data-testid="order-row"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');

        // Conditional order dialog
        this.marketSelect = page.locator('[data-testid="market-select"]');
        this.tokenIdField = page.locator('input[placeholder*="Token ID"]');
        this.typeSelect = page.locator('[data-testid="type-select"]');
        this.sideSelect = page.locator('[data-testid="side-select"]');
        this.outcomeSelect = page.locator('[data-testid="outcome-select"]');
        this.sizeInput = page.locator('input[placeholder*="Size"]');
        this.triggerPriceInput = page.locator('input[placeholder*="Trigger Price"]');
        this.limitPriceInput = page.locator('input[placeholder*="Limit Price"]');
        this.trailingPctInput = page.locator('input[placeholder*="Trailing"]');
        this.expiresAtInput = page.locator('input[placeholder*="Expires"]');
        this.submitButton = page.locator('[role="dialog"] button', { hasText: 'Submit' });
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

    async createConditionalOrder(params: {
        market: string;
        tokenId?: string;
        type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED';
        side: 'BUY' | 'SELL';
        outcome: 'YES' | 'NO';
        size: string;
        triggerPrice?: string;
        limitPrice?: string;
        trailingPct?: string;
        expiresAt?: string;
    }): Promise<void> {
        await this.newConditionalButton.click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();

        // Fill market select
        await this.marketSelect.click();
        await this.page.locator('text=' + params.market).click();

        // Fill token ID if provided
        if (params.tokenId) {
            await this.tokenIdField.fill(params.tokenId);
        }

        // Fill type select
        await this.typeSelect.click();
        const typeMap: Record<string, string> = {
            TAKE_PROFIT: 'Take Profit',
            STOP_LOSS: 'Stop Loss',
            TRAILING_STOP: 'Trailing Stop',
            LIMIT: 'Limit',
            PEGGED: 'Pegged',
        };
        await this.page.locator('text=' + typeMap[params.type]).click();

        // Fill side select
        await this.sideSelect.click();
        await this.page.locator('text=' + params.side).click();

        // Fill outcome select
        await this.outcomeSelect.click();
        await this.page.locator('text=' + params.outcome).click();

        // Fill size
        await this.sizeInput.fill(params.size);

        // Fill conditional price fields based on type
        if (params.triggerPrice && ['TAKE_PROFIT', 'STOP_LOSS'].includes(params.type)) {
            await this.triggerPriceInput.fill(params.triggerPrice);
        }

        if (params.limitPrice && params.type === 'LIMIT') {
            await this.limitPriceInput.fill(params.limitPrice);
        }

        if (params.trailingPct && params.type === 'TRAILING_STOP') {
            await this.trailingPctInput.fill(params.trailingPct);
        }

        // Fill expiration if provided
        if (params.expiresAt) {
            await this.expiresAtInput.fill(params.expiresAt);
        }

        // Submit
        await this.submitButton.click();
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
