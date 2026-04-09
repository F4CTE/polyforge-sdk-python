import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the News feed page (/news).
 *
 * Handles filtering news by sentiment and source,
 * viewing news cards, and pagination.
 */
export class NewsPage {
    readonly page: Page;
    readonly sentimentFilters: Record<string, Locator>;
    readonly sourceFilters: Record<string, Locator>;
    readonly newsCards: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    constructor(page: Page) {
        this.page = page;

        this.sentimentFilters = {
            Positive: page.locator('button', { hasText: 'Positive' }),
            Neutral: page.locator('button', { hasText: 'Neutral' }),
            Negative: page.locator('button', { hasText: 'Negative' }),
        };

        this.sourceFilters = {
            Twitter: page.locator('button', { hasText: 'Twitter' }),
            Bloomberg: page.locator('button', { hasText: 'Bloomberg' }),
            Reuters: page.locator('button', { hasText: 'Reuters' }),
            CoinDesk: page.locator('button', { hasText: 'CoinDesk' }),
        };

        this.newsCards = page.locator('[data-testid="news-card"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/news');
        await expect(this.page.locator('h1', { hasText: 'News' })).toBeVisible({ timeout: 15_000 });
    }

    async filterBySentiment(sentiment: 'Positive' | 'Neutral' | 'Negative'): Promise<void> {
        await this.sentimentFilters[sentiment].click();
        await this.page.waitForTimeout(300);
    }

    async filterBySource(source: string): Promise<void> {
        if (source in this.sourceFilters) {
            await this.sourceFilters[source as keyof typeof this.sourceFilters].click();
        } else {
            await this.page.locator('button', { hasText: source }).click();
        }
        await this.page.waitForTimeout(300);
    }

    async getNewsCount(): Promise<number> {
        return await this.newsCards.count();
    }

    getNewsCardByIndex(i: number): Locator {
        return this.page.locator('[data-testid="news-card"]').nth(i);
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
