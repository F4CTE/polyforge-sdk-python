import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Portfolio page (/portfolio).
 *
 * Handles switching between live and paper trading tabs, filtering
 * positions by period, closing/redeeming positions, and resetting the
 * paper trading account.
 */
export class PortfolioPage {
    readonly page: Page;
    readonly liveTab: Locator;
    readonly paperTab: Locator;
    readonly periodButtons: Record<string, Locator>;
    readonly positionsTable: Locator;
    readonly pnlChart: Locator;
    readonly resetPaperButton: Locator;
    readonly resetConfirmDialog: Locator;
    readonly resetConfirmButton: Locator;
    readonly resetCancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.liveTab = page.locator('[role="tab"]', { hasText: 'Live' });
        this.paperTab = page.locator('[role="tab"]', { hasText: 'Paper' });

        this.periodButtons = {
            '7d': page.locator('button', { hasText: '7d' }),
            '30d': page.locator('button', { hasText: '30d' }),
            '90d': page.locator('button', { hasText: '90d' }),
            All: page.locator('button', { hasText: 'All' }),
        };

        this.positionsTable = page.locator('[data-testid="positions-table"]');
        this.pnlChart = page.locator('[data-testid="pnl-chart"]');
        this.resetPaperButton = page.locator('button', { hasText: 'Reset Paper Account' });
        this.resetConfirmDialog = page.locator('[role="dialog"]');
        this.resetConfirmButton = page.locator('[role="dialog"] button', { hasText: 'Reset' });
        this.resetCancelButton = page.locator('[role="dialog"] button', { hasText: 'Cancel' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/portfolio');
        await expect(this.page.locator('h1', { hasText: 'Portfolio' })).toBeVisible({ timeout: 15_000 });
    }

    async selectPeriod(period: '7d' | '30d' | '90d' | 'All'): Promise<void> {
        await this.periodButtons[period].click();
        await this.page.waitForTimeout(300);
    }

    async switchToLive(): Promise<void> {
        await this.liveTab.click();
        // Wait for the tab to become selected rather than using a fixed timeout.
        await expect(this.liveTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    }

    async switchToPaper(): Promise<void> {
        await this.paperTab.click();
        // Wait for the tab to become selected (aria-selected="true") rather
        // than using a fixed timeout — prevents flakiness on slow CI runners.
        await expect(this.paperTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    }

    getClosePositionButton(marketId: string): Locator {
        return this.page.locator(`[data-testid="close-position-${marketId}"]`);
    }

    getRedeemButton(marketId: string): Locator {
        return this.page.locator(`[data-testid="redeem-position-${marketId}"]`);
    }

    async closePosition(market: string): Promise<void> {
        await this.getClosePositionButton(market).click();
        await expect(this.resetConfirmDialog).toBeVisible();
        await this.resetConfirmButton.click();
        await this.page.waitForTimeout(300);
    }

    async redeemPosition(market: string): Promise<void> {
        await this.getRedeemButton(market).click();
        await expect(this.resetConfirmDialog).toBeVisible();
        await this.resetConfirmButton.click();
        await this.page.waitForTimeout(300);
    }

    async resetPaperAccount(): Promise<void> {
        await this.resetPaperButton.click();
        await expect(this.resetConfirmDialog).toBeVisible();
        await this.resetConfirmButton.click();
        await this.page.waitForTimeout(300);
    }

    async getSummaryStats(): Promise<{ pnl: string; return: string; win_rate: string }> {
        return {
            pnl: (await this.page.locator('[data-testid="stat-pnl"]').textContent()) ?? '',
            return: (await this.page.locator('[data-testid="stat-return"]').textContent()) ?? '',
            win_rate: (await this.page.locator('[data-testid="stat-win-rate"]').textContent()) ?? '',
        };
    }
}
