import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Leaderboard page (/leaderboard).
 *
 * Handles viewing trader rankings across different time periods
 * (7d, 30d, allTime) and pagination through results.
 */
export class LeaderboardPage {
    readonly page: Page;
    readonly periodTabs: Record<string, Locator>;
    readonly traderRows: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    constructor(page: Page) {
        this.page = page;

        this.periodTabs = {
            '7d': page.locator('[role="tab"]', { hasText: '7 Days' }),
            '30d': page.locator('[role="tab"]', { hasText: '30 Days' }),
            allTime: page.locator('[role="tab"]', { hasText: 'All Time' }),
        };

        this.traderRows = page.locator('[data-testid="trader-row"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/leaderboard');
        await expect(this.page.locator('h1', { hasText: 'Leaderboard' })).toBeVisible({ timeout: 15_000 });
    }

    async selectPeriod(period: '7d' | '30d' | 'allTime'): Promise<void> {
        await this.periodTabs[period].click();
        await this.page.waitForTimeout(300);
    }

    async getTraderByRank(rank: number): Promise<string> {
        const row = await this.page
            .locator('[data-testid="trader-row"]')
            .nth(rank - 1)
            .textContent();
        return row ?? '';
    }

    async getTraderCount(): Promise<number> {
        return await this.traderRows.count();
    }

    async goToProfile(username: string): Promise<void> {
        await this.page.locator(`[data-testid="trader-${username}"]`).click();
        await this.page.waitForTimeout(300);
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
        await this.page.waitForTimeout(300);
    }
}
