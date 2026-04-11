import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the News feed page (/news).
 *
 * Handles filtering news by sentiment and source,
 * viewing news cards, and pagination.
 *
 * Key implementation details:
 * - Sentiment filters are button tabs (All, Positive, Negative, Neutral)
 * - Source filter is a native <select> element with aria-label="Filter by news source"
 * - News cards use data-testid="news-card"
 * - Sentiment badge: data-testid="news-sentiment"
 * - Source badge: data-testid="news-source"
 * - Navigation to detail: <Link to={/news/${id}}>View details →</Link>
 */
export class NewsPage {
    readonly page: Page;
    readonly sentimentFilters: Record<string, Locator>;
    readonly sourceSelect: Locator;
    readonly newsCards: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    constructor(page: Page) {
        this.page = page;

        this.sentimentFilters = {
            All: page.locator('button', { hasText: /^All$/ }),
            Positive: page.locator('button', { hasText: /^Positive$/ }),
            Neutral: page.locator('button', { hasText: /^Neutral$/ }),
            Negative: page.locator('button', { hasText: /^Negative$/ }),
        };

        // Source filter is a native <select> element, not buttons
        this.sourceSelect = page.locator('select[aria-label="Filter by news source"]');

        this.newsCards = page.locator('[data-testid="news-card"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/news');
        await expect(this.page.locator('h1', { hasText: 'News' })).toBeVisible({ timeout: 15_000 });
    }

    async filterBySentiment(sentiment: 'All' | 'Positive' | 'Neutral' | 'Negative'): Promise<void> {
        await this.sentimentFilters[sentiment].click();
        // Wait for the news cards to update after filter change
        await this.page.waitForTimeout(500);
    }

    async filterBySource(source: string): Promise<void> {
        await this.sourceSelect.selectOption(source);
        // Wait for the news cards to update after filter change
        await this.page.waitForTimeout(500);
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
    }
}
