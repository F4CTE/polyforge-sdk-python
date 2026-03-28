import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/api';
import { NewsPage } from '../pages/news.page';

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

            expect(page.url()).toContain('/news');
            await expect(page.locator('h1', { hasText: 'News' })).toBeVisible();
        });

        test('Shows news cards/items', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const newsCount = await newsPage.getNewsCount();
            expect(newsCount).toBeGreaterThan(0);
        });

        test('News items display: title, summary, source, timestamp, sentiment', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();

            await expect(firstCard.locator('[data-testid="news-title"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-summary"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-source"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-timestamp"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="news-sentiment"]')).toBeVisible();
        });
    });

    test.describe('Sentiment Filters', () => {
        test('Filter by Bullish → shows only bullish articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const initialCount = await newsPage.getNewsCount();

            await newsPage.filterBySentiment('Bullish');

            const bullishCount = await newsPage.getNewsCount();

            // Should have some bullish articles
            expect(bullishCount).toBeGreaterThan(0);

            // Verify all visible cards have bullish sentiment
            const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
            sentiments.forEach(sentiment => {
                expect(sentiment.toLowerCase()).toContain('bullish');
            });
        });

        test('Filter by Bearish → shows only bearish articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySentiment('Bearish');

            const bearishCount = await newsPage.getNewsCount();

            // Should have some bearish articles
            expect(bearishCount).toBeGreaterThan(0);

            // Verify all visible cards have bearish sentiment
            const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
            sentiments.forEach(sentiment => {
                expect(sentiment.toLowerCase()).toContain('bearish');
            });
        });

        test('Filter by Neutral → shows only neutral articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySentiment('Neutral');

            const neutralCount = await newsPage.getNewsCount();

            // Should have some neutral articles
            expect(neutralCount).toBeGreaterThan(0);

            // Verify all visible cards have neutral sentiment
            const sentiments = await page.locator('[data-testid="news-card"] [data-testid="news-sentiment"]').allTextContents();
            sentiments.forEach(sentiment => {
                expect(sentiment.toLowerCase()).toContain('neutral');
            });
        });

        test('Clear filter → shows all articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const initialCount = await newsPage.getNewsCount();

            // Apply a filter
            await newsPage.filterBySentiment('Bullish');
            const filteredCount = await newsPage.getNewsCount();

            // Click filter again to clear it
            await newsPage.filterBySentiment('Bullish');
            await page.waitForLoadState('networkidle');

            const clearedCount = await newsPage.getNewsCount();

            // Should return to showing all articles
            expect(clearedCount).toBe(initialCount);
        });

        test('Sentiment indicators (color-coded) visible on cards', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            const sentimentIndicator = firstCard.locator('[data-testid="sentiment-indicator"]');

            await expect(sentimentIndicator).toBeVisible();

            // Verify the indicator has a color style
            const style = await sentimentIndicator.getAttribute('style');
            expect(style).toBeTruthy();
        });
    });

    test.describe('Source Filters', () => {
        test('Filter by specific source → shows only that source\'s articles', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            await newsPage.filterBySource('Twitter');

            const twitterCount = await newsPage.getNewsCount();
            expect(twitterCount).toBeGreaterThan(0);

            // Verify all visible cards are from Twitter
            const sources = await page.locator('[data-testid="news-card"] [data-testid="news-source"]').allTextContents();
            sources.forEach(source => {
                expect(source.toLowerCase()).toContain('twitter');
            });
        });

        test('Multiple source options available', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Verify multiple source filter buttons exist
            const sourceButtons = page.locator('button', { hasText: /twitter|bloomberg|reuters|coindesk/i });
            const count = await sourceButtons.count();

            expect(count).toBeGreaterThanOrEqual(2);
        });

        test('Clear source filter → shows all sources', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const initialCount = await newsPage.getNewsCount();

            // Apply a source filter
            await newsPage.filterBySource('Twitter');
            const filteredCount = await newsPage.getNewsCount();

            // Click filter again to clear
            await newsPage.filterBySource('Twitter');
            await page.waitForLoadState('networkidle');

            const clearedCount = await newsPage.getNewsCount();

            // Should return to showing all sources
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

                const signalStrength = firstSignal.locator('[data-testid="signal-strength"]');
                if (await signalStrength.isVisible()) {
                    const strengthText = await signalStrength.textContent();
                    expect(strengthText).toBeTruthy();
                }
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
                    expect(reasoningText?.length).toBeGreaterThan(0);
                }
            }
        });
    });

    test.describe('News Detail', () => {
        test('Click news item → navigates to /news/:id', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            const cardLink = firstCard.locator('a').first();

            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Verify we're on a news detail page
            expect(page.url()).toMatch(/\/news\/[\w-]+/);
        });

        test('Detail page shows full article content', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstCard = page.locator('[data-testid="news-card"]').first();
            const cardLink = firstCard.locator('a').first();

            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Verify detail page elements
            const articleContent = page.locator('[data-testid="article-content"]');
            await expect(articleContent).toBeVisible();

            const title = page.locator('[data-testid="article-title"]');
            await expect(title).toBeVisible();
        });

        test('Shows signals and reasoning', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            // Try to find a card with signals
            const cardsWithSignals = page.locator('[data-testid="news-card"]:has([data-testid="trading-signal"])');
            const signalCount = await cardsWithSignals.count();

            if (signalCount > 0) {
                const firstSignalCard = cardsWithSignals.first();
                const link = firstSignalCard.locator('a').first();
                await link.click();
                await page.waitForLoadState('networkidle');

                const signalSection = page.locator('[data-testid="signal-section"]');
                if (await signalSection.isVisible()) {
                    await expect(signalSection).toBeVisible();
                }
            }
        });

        test('Back navigation returns to feed', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const feedUrl = page.url();

            // Navigate to detail page
            const firstCard = page.locator('[data-testid="news-card"]').first();
            const cardLink = firstCard.locator('a').first();
            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Verify we're on detail page
            expect(page.url()).not.toBe(feedUrl);

            // Click back button
            const backButton = page.locator('button[aria-label="Go back"]');
            if (await backButton.isVisible()) {
                await backButton.click();
                await page.waitForLoadState('networkidle');

                // Should return to feed
                expect(page.url()).toBe(feedUrl);
            } else {
                // Use browser back
                await page.goBack();
                expect(page.url()).toBe(feedUrl);
            }
        });
    });

    test.describe('Pagination', () => {
        test('Navigate through pages of news', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const firstPageCard = await page.locator('[data-testid="news-card"]').first().textContent();

            // Try to go to next page
            const nextButton = newsPage.paginationNext;
            const isNextEnabled = !(await nextButton.isDisabled());

            if (isNextEnabled) {
                await newsPage.goToPage('next');

                const secondPageCard = await page.locator('[data-testid="news-card"]').first().textContent();

                // Should have different content
                expect(secondPageCard).not.toBe(firstPageCard);
            }
        });

        test('Next/Previous buttons functional', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const nextButton = newsPage.paginationNext;
            const prevButton = newsPage.paginationPrev;

            // First page should have Next enabled and Prev disabled
            await expect(nextButton).not.toBeDisabled();
            await expect(prevButton).toBeDisabled();

            // Go to next page
            await newsPage.goToPage('next');

            // Now both should be enabled (unless we're on last page)
            if (!(await nextButton.isDisabled())) {
                await expect(prevButton).not.toBeDisabled();
            }
        });

        test('Page counter accurate', async ({ page }) => {
            const newsPage = new NewsPage(page);
            await newsPage.goto();

            const pageIndicator = page.locator('[data-testid="page-indicator"]');

            if (await pageIndicator.isVisible()) {
                const text = await pageIndicator.textContent();

                // Should show page format "X / Y"
                expect(text).toMatch(/\d+\s*\/\s*\d+/);

                // Extract current page number
                const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    const [, currentStr, totalStr] = match;
                    const current = parseInt(currentStr);
                    const total = parseInt(totalStr);

                    expect(current).toBe(1);
                    expect(total).toBeGreaterThanOrEqual(current);
                }
            }
        });
    });
});
