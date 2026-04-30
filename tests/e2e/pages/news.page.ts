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
        // Wait for initial data load — either cards appear or empty state shows
        await this.page.locator('[data-testid="news-card"], text=Adjust filters').first()
            .waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    }

    async filterBySentiment(sentiment: 'All' | 'Positive' | 'Neutral' | 'Negative'): Promise<void> {
        // Filtering triggers a server-side fetch; wait for the /api/v1/news response
        await Promise.all([
            this.page.waitForResponse(
                res => res.url().includes('/api/v1/news') && !res.url().includes('/signals') && res.status() === 200,
                { timeout: 15_000 },
            ),
            this.sentimentFilters[sentiment].click(),
        ]);
    }

    async filterBySource(source: string): Promise<void> {
        const expectedSource = source.toLowerCase();

        // Filtering triggers a server-side fetch; wait for the article endpoint
        // with the matching source query. The initial unfiltered article request
        // can still be in flight when the select changes, and treating that as
        // the filtered response leaves stale cards in the DOM on slow CI runs.
        const [response] = await Promise.all([
            this.page.waitForResponse(
                res => {
                    if (res.status() !== 200) return false;
                    const url = new URL(res.url());
                    if (!url.pathname.endsWith('/api/v1/news')) return false;
                    const responseSource = url.searchParams.get('source');
                    return source === 'All' ? responseSource === null : responseSource === source;
                },
                { timeout: 15_000 },
            ),
            this.sourceSelect.selectOption(source),
        ]);
        const json = await response.json().catch(() => null) as { data?: unknown[] } | null;
        const expectedCount = json?.data?.length ?? 0;
        if (expectedCount > 0) {
            await expect(this.newsCards.first()).toBeVisible({ timeout: 10_000 });
            if (source !== 'All') {
                await expect.poll(
                    async () => {
                        const sources = (await this.newsCards.locator('[data-testid="news-source"]').allTextContents())
                            .map(text => text.trim().toLowerCase());
                        return sources.length === expectedCount
                            && sources.every(sourceText => sourceText.includes(expectedSource));
                    },
                    { timeout: 10_000 },
                ).toBe(true);
            } else {
                await expect.poll(
                    async () => this.newsCards.count(),
                    { timeout: 10_000 },
                ).toBe(expectedCount);
            }
        } else {
            await expect(
                this.page.locator('text=No news articles found')
                    .or(this.page.locator('text=Adjust filters'))
                    .first(),
            ).toBeVisible({ timeout: 10_000 });
        }
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
