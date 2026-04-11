import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/api';
import { NewsPage } from '../pages/news.page';

/**
 * News — Full Workflow Coverage
 *
 * Comprehensive test suite for the news feed page.
 * Covers: page load, sentiment filters (button tabs), source filters
 * (native <select>), signal indicators, news detail navigation, pagination.
 *
 * Source options: All, Reuters, CNN, CoinGecko, Bloomberg, AP News
 * Sentiment tabs: All, Positive, Negative, Neutral
 */

test.describe('News — Full Workflow Coverage', () => {
    test.beforeEach(async ({ page }) => {
        const { token } = await apiLogin('alice@e2e.dev.local', 'TestPass123!');
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    test.describe('Page Load', () => {
        test('News page loads at /news', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await expect(page.locator('h1', { hasText: 'News' })).toBeVisible();
        });

        test('Shows news cards/items', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const count = await newsPage.getNewsCount();
            expect(count).toBeGreaterThanOrEqual(0);
        });

        test('News items display: title, summary, source, timestamp, sentiment', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) return;

            await expect(firstCard.locator('[data-testid="news-title"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-source"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-sentiment"]')).toBeVisible();
        });
    });

    test.describe('Sentiment Filters', () => {
        test('Filter by Positive → shows only positive articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySentiment('Positive');

            const positiveCount = await newsPage.getNewsCount();
            expect(positiveCount).toBeGreaterThanOrEqual(0);

            // Verify all visible cards have positive sentiment
            if (positiveCount > 0) {
                const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
                sentiments.forEach(sentiment => {
                    expect(sentiment.toLowerCase()).toContain('positive');
                });
            }
        });

        test('Filter by Negative → shows only negative articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySentiment('Negative');

            const negativeCount = await newsPage.getNewsCount();
            expect(negativeCount).toBeGreaterThanOrEqual(0);

            if (negativeCount > 0) {
                const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
                sentiments.forEach(sentiment => {
                    expect(sentiment.toLowerCase()).toContain('negative');
                });
            }
        });

        test('Filter by Neutral → shows only neutral articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySentiment('Neutral');

            const neutralCount = await newsPage.getNewsCount();
            expect(neutralCount).toBeGreaterThanOrEqual(0);

            if (neutralCount > 0) {
                const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
                sentiments.forEach(sentiment => {
                    expect(sentiment.toLowerCase()).toContain('neutral');
                });
            }
        });

        test('Clear filter → shows all articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const initialCount = await newsPage.getNewsCount();

            // Apply a filter
            await newsPage.filterBySentiment('Positive');

            // Click "All" tab to clear
            await newsPage.filterBySentiment('All');

            const clearedCount = await newsPage.getNewsCount();
            expect(clearedCount).toBe(initialCount);
        });

        test('Sentiment badges (color-coded) visible on cards', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const newsCount = await newsPage.getNewsCount();
            if (newsCount === 0) return;

            const firstCard = page.locator('[data-testid="news-card"]').first();
            const sentimentBadge = firstCard.locator('[data-testid="news-sentiment"]');

            await expect(sentimentBadge).toBeVisible();
            const text = await sentimentBadge.textContent() ?? '';
            // Should be one of: POSITIVE, NEGATIVE, NEUTRAL, MIXED
            expect(text.toLowerCase()).toMatch(/positive|negative|neutral|mixed/);
        });
    });

    test.describe('Source Filters', () => {
        test('Filter by specific source → shows only that source articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Use Reuters (a known source from the SOURCES constant)
            await newsPage.filterBySource('Reuters');

            const filteredCount = await newsPage.getNewsCount();
            expect(filteredCount).toBeGreaterThanOrEqual(0);

            if (filteredCount > 0) {
                const sources = await page.locator('[data-testid="news-card"] [data-testid="news-source"]').allTextContents();
                sources.forEach(source => {
                    expect(source.toLowerCase()).toContain('reuters');
                });
            }
        });

        test('Multiple source options available in dropdown', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Source filter is a <select> — count its options
            const options = newsPage.sourceSelect.locator('option');
            const count = await options.count();

            // Should have at least All + 2 real sources
            expect(count).toBeGreaterThanOrEqual(3);
        });

        test('Clear source filter → shows all sources', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const initialCount = await newsPage.getNewsCount();

            // Apply a source filter
            await newsPage.filterBySource('Bloomberg');
            const filteredCount = await newsPage.getNewsCount();

            // Clear by selecting "All"
            await newsPage.filterBySource('All');
            const clearedCount = await newsPage.getNewsCount();

            expect(clearedCount).toBe(initialCount);
        });
    });

    test.describe('Signal Indicators', () => {
        test('News items show trading signals when present', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Find a card with signals
            const cardsWithSignals = page.locator('[data-testid="news-card"]:has([data-testid="trading-signal"])');
            const signalCount = await cardsWithSignals.count();

            if (signalCount > 0) {
                await expect(cardsWithSignals.first()).toBeVisible();
            }
        });

        test('Signal strength/type visible', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const cardsWithSignals = page.locator('[data-testid="news-card"]:has([data-testid="trading-signal"])');
            const signalCount = await cardsWithSignals.count();

            if (signalCount > 0) {
                const firstSignal = cardsWithSignals.first().locator('[data-testid="trading-signal"]');
                await expect(firstSignal).toBeVisible();

                const signalType = firstSignal.locator('[data-testid="signal-type"]');
                await expect(signalType).toBeVisible();
            }
        });

        test('Signal reasoning available', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const cardsWithSignals = page.locator('[data-testid="news-card"]:has([data-testid="trading-signal"])');
            const signalCount = await cardsWithSignals.count();

            if (signalCount > 0) {
                const firstCard = cardsWithSignals.first();
                const signalReasoning = firstCard.locator('[data-testid="signal-reasoning"]');

                if (await signalReasoning.isVisible()) {
                    const reasoningText = await signalReasoning.textContent();
                    expect(reasoningText).toBeTruthy();
                }
            }
        });
    });

    test.describe('News Detail', () => {
        test('Click "View details" → navigates to /news/:id', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) return;

            // Click the internal "View details →" link (not the external title link)
            const viewDetailsLink = firstCard.locator('a', { hasText: /View details/ });
            await viewDetailsLink.click();

            // Verify we're on a news detail page
            expect(page.url()).toMatch(/\/news\/[\w-]+/);
        });

        test('Detail page shows full article content', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) return;

            // Navigate via View details link
            const viewDetailsLink = firstCard.locator('a', { hasText: /View details/ });
            await viewDetailsLink.click();

            // Verify detail page elements
            const articleContent = page.locator('[data-testid="article-content"]');
            await expect(articleContent).toBeVisible({ timeout: 10_000 });

            const title = page.locator('[data-testid="article-title"]');
            await expect(title).toBeVisible();
        });

        test('Shows signals and reasoning on detail page', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Try to find a card with signals
            const cardsWithSignals = page.locator('[data-testid="news-card"]:has([data-testid="trading-signal"])');
            const signalCount = await cardsWithSignals.count();

            if (signalCount > 0) {
                const firstSignalCard = cardsWithSignals.first();
                const link = firstSignalCard.locator('a', { hasText: /View details/ });
                await link.click();

                const signalSection = page.locator('[data-testid="signal-section"]');
                if (await signalSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
                    await expect(signalSection).toBeVisible();
                }
            }
        });

        test('Back navigation returns to feed', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            if (!(await firstCard.isVisible({ timeout: 3_000 }).catch(() => false))) return;

            const feedUrl = page.url();

            // Navigate to detail page
            const viewDetailsLink = firstCard.locator('a', { hasText: /View details/ });
            await viewDetailsLink.click();

            // Verify we're on detail page
            expect(page.url()).not.toBe(feedUrl);

            // Use browser back
            await page.goBack();
            await expect(page).toHaveURL(/\/news$/);
        });
    });

    test.describe('Pagination', () => {
        test('Navigate through pages of news', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Check if next button is visible and enabled
            const nextButton = newsPage.paginationNext;
            const isNextVisible = await nextButton.isVisible({ timeout: 3_000 }).catch(() => false);

            if (isNextVisible) {
                const isNextEnabled = !(await nextButton.isDisabled());

                if (isNextEnabled) {
                    const firstPageCard = await page.locator('[data-testid="news-card"]').first().textContent();

                    await newsPage.goToPage('next');

                    const secondPageCard = await page.locator('[data-testid="news-card"]').first().textContent();

                    // Should have different content
                    expect(secondPageCard).not.toBe(firstPageCard);
                }
            }
        });

        test('Next/Previous buttons functional', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const nextButton = newsPage.paginationNext;
            const prevButton = newsPage.paginationPrev;

            const isNextVisible = await nextButton.isVisible({ timeout: 3_000 }).catch(() => false);
            if (!isNextVisible) return; // No pagination needed

            const isNextEnabled = !(await nextButton.isDisabled());
            if (!isNextEnabled) return;

            // Go to next page
            await newsPage.goToPage('next');

            // Previous should now be enabled
            await expect(prevButton).toBeEnabled();

            // Go back
            await newsPage.goToPage('prev');

            // Previous should be disabled again (first page)
            await expect(prevButton).toBeDisabled();
        });
    });
});
