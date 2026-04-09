import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Discover page (/discover).
 *
 * Handles browsing and filtering strategies by sort order,
 * searching for strategies, and pagination across the feed.
 */
export class DiscoverPage {
    readonly page: Page;
    readonly sortTabs: Record<string, Locator>;
    readonly searchInput: Locator;
    readonly strategyCards: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    constructor(page: Page) {
        this.page = page;

        this.sortTabs = {
            Popular: page.locator('[role="tab"]', { hasText: 'Popular' }),
            Newest: page.locator('[role="tab"]', { hasText: 'Newest' }),
            'Top P&L': page.locator('[role="tab"]', { hasText: 'Top P&L' }),
            'Most Forked': page.locator('[role="tab"]', { hasText: 'Most Forked' }),
        };

        this.searchInput = page.locator('input[placeholder*="Search"]').first();
        this.strategyCards = page.locator('[data-testid="strategy-card"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/discover');
        await expect(this.page.locator('h1', { hasText: 'Discover' })).toBeVisible({ timeout: 15_000 });
    }

    async selectSort(sort: 'Popular' | 'Newest' | 'Top P&L' | 'Most Forked'): Promise<void> {
        await this.sortTabs[sort].click();
        await this.page.waitForTimeout(300);
    }

    async search(term: string): Promise<void> {
        await this.searchInput.fill(term);
        await this.page.waitForTimeout(300);
    }

    getStrategyByName(name: string): Locator {
        return this.page.locator('[data-testid="strategy-card"]', { hasText: name });
    }

    async getStrategyCount(): Promise<number> {
        return await this.strategyCards.count();
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
