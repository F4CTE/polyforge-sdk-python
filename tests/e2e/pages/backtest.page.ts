import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Backtest page (/backtest).
 *
 * Handles strategy selection, date range input, running backtests,
 * viewing history with pagination, and extracting result statistics.
 *
 * The backtest component uses:
 * - Native <select> for strategy dropdown (not shadcn combobox)
 * - Native <input type="date"> for date inputs
 * - <table aria-label="Backtest history"> for the history table
 * - data-testid="result-pnl" on the P&L stat card (other stats lack data-testid)
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
        // Native <select> element — use selectOption() not click+role=option
        this.strategySelect = page.locator('#backtest-strategy');
        // Native <input type="date"> — use setNativeDate() helper instead of fill()
        this.startDateInput = page.locator('#backtest-start');
        this.endDateInput = page.locator('#backtest-end');
        this.runButton = page.locator('button', { hasText: 'Run Backtest' });
        // The table uses aria-label, not data-testid
        this.historyTable = page.locator('table[aria-label="Backtest history"]');
        this.historyRows = page.locator('[data-testid="backtest-history-row"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');

        // Only result-pnl has a data-testid in the component.
        // Win rate, orders, and gaps are identified by their label text.
        this.resultDetailsPnl = page.locator('[data-testid="result-pnl"]');
        this.resultDetailsWinRate = page.locator('.bg-pf-surface:has(> span:text-is("Win Rate")) >> span.font-mono');
        this.resultDetailsOrders = page.locator('.bg-pf-surface:has(> span:text-is("Orders Placed")) >> span.font-mono');
        this.resultDetailsGaps = page.locator('.bg-pf-warning\\/10');
    }

    async goto(): Promise<void> {
        await this.page.goto('/backtest');
        await expect(this.page.locator('h1', { hasText: 'Backtest' })).toBeVisible({ timeout: 15_000 });
    }

    /**
     * Select a strategy by its visible name from the native <select> dropdown.
     */
    async selectStrategy(name: string): Promise<void> {
        await this.strategySelect.selectOption({ label: name });
    }

    /**
     * Select the first available strategy from the native <select>.
     * Returns the strategy name or null if no strategies are available.
     */
    async selectFirstStrategy(): Promise<string | null> {
        // Wait for strategies to load (options beyond the placeholder)
        await this.page.waitForFunction(
            (sel: string) => {
                const el = document.querySelector(sel) as HTMLSelectElement | null;
                return el && el.options.length > 1;
            },
            '#backtest-strategy',
            { timeout: 10_000 },
        );

        const options = this.strategySelect.locator('option');
        const count = await options.count();
        if (count <= 1) return null; // only the placeholder "Select strategy"

        const firstReal = options.nth(1);
        const name = await firstReal.textContent();
        const value = await firstReal.getAttribute('value');
        if (value) {
            await this.strategySelect.selectOption(value);
        }
        return name?.trim() ?? null;
    }

    /**
     * Set a date on a native <input type="date"> using the native setter
     * so React's onChange fires correctly.
     */
    async setNativeDate(selector: string, value: string): Promise<void> {
        await this.page.evaluate(
            ({ sel, val }: { sel: string; val: string }) => {
                const el = document.querySelector(sel) as HTMLInputElement | null;
                if (!el) throw new Error(`Element not found: ${sel}`);
                const nativeSetter = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype, 'value',
                )?.set;
                if (nativeSetter) {
                    nativeSetter.call(el, val);
                } else {
                    el.value = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            },
            { sel: selector, val: value },
        );
    }

    async setDateRange(start: string, end: string): Promise<void> {
        await this.setNativeDate('#backtest-start', start);
        await this.setNativeDate('#backtest-end', end);
    }

    async runBacktest(): Promise<void> {
        await expect(this.runButton).toBeEnabled({ timeout: 5_000 });
        await this.runButton.click();
        // Wait for either the history table to refresh or a toast error
        await Promise.race([
            expect(this.historyTable).toBeVisible({ timeout: 30_000 }),
            this.page.locator('[data-sonner-toast]').waitFor({ timeout: 30_000 }).catch(() => {}),
        ]);
        // Wait for history table to populate with at least one row
        await this.historyRows.first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});
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
        // Click the first completed row to expand details if not already visible
        const pnlVisible = await this.resultDetailsPnl.isVisible().catch(() => false);
        if (!pnlVisible) {
            // Try clicking a completed row to show detail panel
            const completedRow = this.page.locator('[data-testid="backtest-history-row"]').first();
            if (await completedRow.isVisible().catch(() => false)) {
                await completedRow.click();
                await expect(this.resultDetailsPnl).toBeVisible({ timeout: 5_000 }).catch(() => {});
            }
        }

        return {
            pnl: (await this.resultDetailsPnl.textContent().catch(() => '')) ?? '',
            winRate: (await this.resultDetailsWinRate.textContent().catch(() => '')) ?? '',
            orders: (await this.resultDetailsOrders.textContent().catch(() => '')) ?? '',
            gaps: (await this.resultDetailsGaps.textContent().catch(() => '')) ?? '',
        };
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
        // Wait for table content to update after page change
        await this.historyRows.first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => {});
    }
}
