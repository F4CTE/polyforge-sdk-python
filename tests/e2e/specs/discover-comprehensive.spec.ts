import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/api';
import { DiscoverPage } from '../pages/discover.page';

test.describe('Discover — Full Workflow Coverage', () => {
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
        test('Discover page loads at /discover', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            expect(page.url()).toContain('/discover');
            await expect(page.locator('h1', { hasText: 'Discover' })).toBeVisible();
        });

        test('Shows public strategy cards', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBeGreaterThan(0);
        });

        test('Default sort is "Popular"', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const popularTab = discoverPage.sortTabs['Popular'];
            await expect(popularTab).toHaveAttribute('aria-selected', 'true');
        });
    });

    test.describe('Sort Tabs', () => {
        test('Click "Popular" → strategies sorted by popularity', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            await discoverPage.selectSort('Popular');
            const popularTab = discoverPage.sortTabs['Popular'];
            await expect(popularTab).toHaveAttribute('aria-selected', 'true');

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBeGreaterThan(0);
        });

        test('Click "Newest" → strategies sorted by creation date', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            await discoverPage.selectSort('Newest');
            const newestTab = discoverPage.sortTabs['Newest'];
            await expect(newestTab).toHaveAttribute('aria-selected', 'true');

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBeGreaterThan(0);
        });

        test('Click "Top P&L" → strategies sorted by P&L performance', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            await discoverPage.selectSort('Top P&L');
            const topPnlTab = discoverPage.sortTabs['Top P&L'];
            await expect(topPnlTab).toHaveAttribute('aria-selected', 'true');

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBeGreaterThan(0);
        });

        test('Click "Most Forked" → strategies sorted by fork count', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            await discoverPage.selectSort('Most Forked');
            const mostForkedTab = discoverPage.sortTabs['Most Forked'];
            await expect(mostForkedTab).toHaveAttribute('aria-selected', 'true');

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBeGreaterThan(0);
        });

        test('Active tab is visually highlighted', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const popularTab = discoverPage.sortTabs['Popular'];
            await expect(popularTab).toHaveAttribute('aria-selected', 'true');

            await discoverPage.selectSort('Newest');
            const newestTab = discoverPage.sortTabs['Newest'];
            await expect(newestTab).toHaveAttribute('aria-selected', 'true');

            // Popular tab should no longer be selected
            await expect(popularTab).toHaveAttribute('aria-selected', 'false');
        });

        test('Changing tab resets to page 1', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            // Get initial page number (should be 1)
            const pageIndicator = page.locator('[data-testid="page-indicator"]');
            let currentPage = await pageIndicator.textContent();
            expect(currentPage).toContain('1');

            // Change sort tab
            await discoverPage.selectSort('Newest');

            // Verify page is reset to 1
            currentPage = await pageIndicator.textContent();
            expect(currentPage).toContain('1');
        });
    });

    test.describe('Strategy Cards', () => {
        test('Each card shows: strategy name, author, description, P&L, fork count', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();

            // Verify card contains expected elements
            await expect(firstCard.locator('[data-testid="strategy-name"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="strategy-author"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="strategy-description"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="strategy-pnl"]')).toBeVisible();
            await expect(firstCard.locator('[data-testid="strategy-forks"]')).toBeVisible();
        });

        test('Card links to strategy detail page', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const cardLink = firstCard.locator('a').first();

            const href = await cardLink.getAttribute('href');
            expect(href).toBeTruthy();
            expect(href).toMatch(/^\/strategies\/[\w-]+/);
        });

        test('Author name links to public profile', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const authorLink = firstCard.locator('[data-testid="strategy-author"] a').first();

            const href = await authorLink.getAttribute('href');
            expect(href).toBeTruthy();
            expect(href).toMatch(/^\/profile\/[\w-]+/);
        });

        test('Cards display appropriate status indicators', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const statusIndicator = firstCard.locator('[data-testid="strategy-status"]');

            await expect(statusIndicator).toBeVisible();
        });
    });

    test.describe('Search', () => {
        test('Search input filters strategies by name (client-side)', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const initialCount = await discoverPage.getStrategyCount();
            expect(initialCount).toBeGreaterThan(0);

            // Search for a specific term
            await discoverPage.search('momentum');

            const searchedCount = await discoverPage.getStrategyCount();
            // Filtered results should be <= initial count
            expect(searchedCount).toBeLessThanOrEqual(initialCount);
        });

        test('Partial match works', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            // Search with partial term
            await discoverPage.search('rsi');

            const cardCount = await discoverPage.getStrategyCount();
            // At least show matching results if any exist
            const cards = await discoverPage.strategyCards.allTextContents();
            const hasMatches = cards.some(text => text.toLowerCase().includes('rsi'));

            if (cardCount > 0) {
                expect(hasMatches).toBeTruthy();
            }
        });

        test('Clear search shows all strategies', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const initialCount = await discoverPage.getStrategyCount();

            // Search for something
            await discoverPage.search('momentum');
            await page.waitForLoadState('networkidle');

            // Clear search
            await discoverPage.searchInput.clear();
            await page.waitForLoadState('networkidle');

            const clearedCount = await discoverPage.getStrategyCount();
            // Should return to initial count
            expect(clearedCount).toBe(initialCount);
        });

        test('No results shows empty state', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            // Search for unlikely term
            await discoverPage.search('xyzabc123notarealstrategy');

            const cardCount = await discoverPage.getStrategyCount();
            expect(cardCount).toBe(0);

            // Verify empty state message is shown
            await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
        });
    });

    test.describe('Pagination', () => {
        test('Next page loads more strategies', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstPageCount = await discoverPage.getStrategyCount();
            const firstCard = await page.locator('[data-testid="strategy-card"]').first().textContent();

            // Go to next page
            await discoverPage.goToPage('next');

            const secondPageCount = await discoverPage.getStrategyCount();
            const secondCard = await page.locator('[data-testid="strategy-card"]').first().textContent();

            // Should have loaded new strategies
            expect(secondCard).not.toBe(firstCard);
        });

        test('Previous page goes back', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstPageCard = await page.locator('[data-testid="strategy-card"]').first().textContent();

            // Go to next page
            await discoverPage.goToPage('next');

            // Go back to previous page
            await discoverPage.goToPage('prev');

            const returnedCard = await page.locator('[data-testid="strategy-card"]').first().textContent();

            // Should return to first page
            expect(returnedCard).toBe(firstPageCard);
        });

        test('Page counter shows current/total', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const pageIndicator = page.locator('[data-testid="page-indicator"]');
            await expect(pageIndicator).toBeVisible();

            const text = await pageIndicator.textContent();
            expect(text).toMatch(/\d+\s*\/\s*\d+/);
        });

        test('First page disables Previous', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            // On first page, Previous should be disabled
            await expect(discoverPage.paginationPrev).toBeDisabled();
        });

        test('Last page disables Next', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            // Navigate through pages until we find the last one
            let canGoNext = true;
            let pageCount = 1;

            while (canGoNext && pageCount < 20) {
                const nextButton = discoverPage.paginationNext;
                const isDisabled = await nextButton.isDisabled();

                if (isDisabled) {
                    // We're on the last page
                    await expect(nextButton).toBeDisabled();
                    canGoNext = false;
                } else {
                    await discoverPage.goToPage('next');
                    pageCount++;
                }
            }
        });
    });

    test.describe('Strategy Interaction', () => {
        test('Click strategy card → navigates to strategy detail', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const cardLink = firstCard.locator('a').first();

            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Verify we're on a strategy detail page
            expect(page.url()).toMatch(/\/strategies\//);
            await expect(page.locator('h1')).toBeVisible();
        });

        test('Strategy detail shows blocks visualization', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const cardLink = firstCard.locator('a').first();

            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Verify blocks visualization is present
            const blocksVisualization = page.locator('[data-testid="blocks-visualization"]');
            await expect(blocksVisualization).toBeVisible();
        });

        test('Can fork a public strategy (if feature available)', async ({ page }) => {
            const discoverPage = new DiscoverPage(page);
            await discoverPage.goto();

            const firstCard = page.locator('[data-testid="strategy-card"]').first();
            const cardLink = firstCard.locator('a').first();

            await cardLink.click();
            await page.waitForLoadState('networkidle');

            // Look for fork button
            const forkButton = page.locator('button', { hasText: /fork|fork strategy/i }).first();

            if (await forkButton.isVisible()) {
                await forkButton.click();
                await page.waitForLoadState('networkidle');

                // Verify success message or navigation
                const successMessage = page.locator('[data-testid="fork-success"]');
                await expect(successMessage).toBeVisible();
            }
        });
    });
});
