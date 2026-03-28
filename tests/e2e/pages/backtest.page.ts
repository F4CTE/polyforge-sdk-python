import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Backtest page (/backtest).
 *
 * Handles strategy selection, date range input, running backtests,
 * viewing history with pagination, and extracting result statistics.
 */
export class BacktestPage {
    readonly page: Page;
    readonly strategySelect: Locator;
    readonly startDateInput: Locator;
    readonly endDateInput: Locator;
    readonly runButton: Locator;
    readonly historyTable: Locator;
    readonly historyRows: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    // Result details
    readonly resultDetailsPnl: Locator;
    readonly resultDetailsWinRate: Locator;
    readonly resultDetailsOrders: Locator;
    readonly resultDetailsGaps: Locator;

    constructor(page: Page) {
        this.page = page;
        this.strategySelect = page.locator('#backtest-strategy');
        this.startDateInput = page.locator('#backtest-start');
        this.endDateInput = page.locator('#backtest-end');
        this.runButton = page.locator('button', { hasText: 'Run Backtest' });
        this.historyTable = page.locator('[data-testid="backtest-history-table"]');
        this.historyRows = page.locator('[data-testid="backtest-history-row"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');

        this.resultDetailsPnl = page.locator('[data-testid="result-pnl"]');
        this.resultDetailsWinRate = page.locator('[data-testid="result-win-rate"]');
        this.resultDetailsOrders = page.locator('[data-testid="result-orders"]');
        this.resultDetailsGaps = page.locator('[data-testid="result-gaps"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/backtest');
        await expect(this.page.locator('h1', { hasText: 'Backtest' })).toBeVisible({ timeout: 15_000 });
    }

    async selectStrategy(name: string): Promise<void> {
        await this.strategySelect.click();
        await this.page.locator('text=' + name).click();
    }

    async setDateRange(start: string, end: string): Promise<void> {
        await this.startDateInput.fill(start);
        await this.endDateInput.fill(end);
    }

    async runBacktest(): Promise<void> {
        await this.runButton.click();
        await this.page.waitForLoadState('networkidle');
        await expect(this.historyTable).toBeVisible({ timeout: 30_000 });
    }

    async getHistoryCount(): Promise<number> {
        return await this.historyRows.count();
    }

    async getResultStats(): Promise<{
        pnl: string;
        winRate: string;
        orders: string;
        gaps: string;
    }> {
        return {
            pnl: (await this.resultDetailsPnl.textContent()) ?? '',
            winRate: (await this.resultDetailsWinRate.textContent()) ?? '',
            orders: (await this.resultDetailsOrders.textContent()) ?? '',
            gaps: (await this.resultDetailsGaps.textContent()) ?? '',
        };
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
        await this.page.waitForLoadState('networkidle');
    }
}
