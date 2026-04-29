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

    async waitForPaperLoaded(): Promise<void> {
        // The Paper tab renders skeletons while /paper/summary is loading, then
        // shows either summary cards or the empty-state. Local gateway runs can
        // transiently fail this request with net::ERR_NETWORK_CHANGED, leaving
        // the tab selected but without Paper content. Re-clicking the selected
        // tab re-invokes the same load path because `paper` is still null.
        const ready = this.page.locator('text="Paper P&L"')
            .or(this.page.locator('text="No paper positions"'))
            .first();
        const isPaperRequest = (url: string) => url.includes('/api/v1/paper/summary');

        for (let attempt = 0; attempt < 5; attempt += 1) {
            if (await ready.isVisible({ timeout: 500 }).catch(() => false)) return;

            const paperRequestSettled = Promise.race([
                this.page.waitForResponse(response => isPaperRequest(response.url()), { timeout: 8_000 })
                    .then(response => response.ok()),
                this.page.waitForEvent('requestfailed', {
                    predicate: request => isPaperRequest(request.url()),
                    timeout:   8_000,
                }).then(() => false),
            ]).catch(() => false);

            await this.paperTab.click();
            await expect(this.paperTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });

            const responseOk = await paperRequestSettled;
            if (responseOk && await ready.isVisible({ timeout: 5_000 }).catch(() => false)) return;
        }

        await expect(ready).toBeVisible({ timeout: 15_000 });
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
    }

    async redeemPosition(market: string): Promise<void> {
        await this.getRedeemButton(market).click();
        await expect(this.resetConfirmDialog).toBeVisible();
        await this.resetConfirmButton.click();
    }

    async resetPaperAccount(): Promise<void> {
        await this.resetPaperButton.click();
        await expect(this.resetConfirmDialog).toBeVisible();
        await this.resetConfirmButton.click();
    }

    async getSummaryStats(): Promise<{ pnl: string; return: string; win_rate: string }> {
        // The route heading appears before /portfolio and /portfolio/pnl settle.
        // Wait for the summary-card contract so slow CI does not read during the
        // skeleton state and incorrectly treat a fresh zero-value account as empty.
        await this.page.locator('[data-testid="stat-pnl"]')
            .or(this.page.locator('text="Unrealized P&L"'))
            .or(this.page.locator('text="Failed to load portfolio"'))
            .first()
            .waitFor({ state: 'visible', timeout: 20_000 })
            .catch(() => {});

        const safeText = async (...selectors: string[]) => {
            for (const selector of selectors) {
                try {
                    const text = (await this.page.locator(selector).first().textContent({ timeout: 1_000 })) ?? '';
                    if (text.trim().length > 0) return text;
                } catch {
                    // Try the next selector.
                }
            }
            return '';
        };
        return {
            pnl: await safeText(
                '[data-testid="stat-pnl"]',
                'xpath=//*[normalize-space()="Unrealized P&L"]/following-sibling::*[1]',
            ),
            return: await safeText(
                '[data-testid="stat-return"]',
                'xpath=//*[normalize-space()="Realized P&L"]/following-sibling::*[1]',
            ),
            win_rate: await safeText(
                '[data-testid="stat-win-rate"]',
                'xpath=//*[normalize-space()="Win Rate"]/following-sibling::*[1]',
            ),
        };
    }
}
