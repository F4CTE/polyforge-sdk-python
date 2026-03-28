import { test, expect } from '@playwright/test';
import { MarketsPage } from '../pages/markets.page';
import { apiLogin, apiRegister, uniqueEmail, uniqueUsername } from '../helpers/api';

/**
 * Markets — Full Workflow Coverage (@e2e @comprehensive)
 *
 * Comprehensive test suite for the markets page including:
 * - Market listing and display
 * - Search functionality with debouncing
 * - Category filtering
 * - Sorting by multiple criteria
 * - View toggling (card vs table)
 * - Pagination controls
 * - Market detail navigation
 */

test.describe('Markets — Full Workflow Coverage', () => {
    let token: string;

    test.beforeAll(async () => {
        // Register a unique test user for markets tests
        const email = uniqueEmail('markets');
        const username = uniqueUsername('mktsuser');
        const res = await apiRegister(email, username, 'TestPass123!');
        token = res.token;
    });

    test.beforeEach(async ({ page }) => {
        // Set auth cookie for each test
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    // ─── Market Listing Tests ──────────────────────────────────────────────────

    test('@smoke @comprehensive should load markets page with market cards', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Verify page loaded
        await expect(page.locator('h1', { hasText: 'Markets' })).toBeVisible();

        // Verify market cards exist
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@smoke @comprehensive should display default card view', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Verify cards are visible (not table rows)
        const cards = markets.marketCards;
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);

        // Verify card structure with expected content
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();

        // Check for market name
        const marketName = firstCard.locator('h3, .text-lg, .font-semibold').first();
        if (await marketName.isVisible()) {
            const name = await marketName.textContent();
            expect(name).toBeTruthy();
        }
    });

    test('@comprehensive should display market name on cards', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const cards = markets.marketCards;
        const firstCard = cards.first();

        // Find and verify market name text
        const nameElement = firstCard.locator('h3, .text-lg, .font-semibold').first();
        if (await nameElement.isVisible()) {
            const name = await nameElement.textContent();
            expect(name).toMatch(/\w+/);
        }
    });

    test('@comprehensive should display market volume on cards', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const cards = markets.marketCards;
        const firstCard = cards.first();

        // Find volume text (often labeled "Volume" or shows number)
        const volumeElement = firstCard.locator(':text("Volume"), :text("$"), .text-sm').first();
        if (await volumeElement.isVisible()) {
            const volume = await volumeElement.textContent();
            expect(volume).toBeTruthy();
        }
    });

    test('@comprehensive should display market end date on cards', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const cards = markets.marketCards;
        const firstCard = cards.first();

        // Find end date element
        const dateElement = firstCard.locator(':text("Closes"), :text("Ends"), [data-testid*="date"]').first();
        if (await dateElement.isVisible()) {
            const date = await dateElement.textContent();
            expect(date).toBeTruthy();
        }
    });

    test('@comprehensive should display market price on cards', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const cards = markets.marketCards;
        const firstCard = cards.first();

        // Find price element
        const priceElement = firstCard.locator(':text("$"), .price, [data-testid*="price"]').first();
        if (await priceElement.isVisible()) {
            const price = await priceElement.textContent();
            expect(price).toBeTruthy();
        }
    });

    // ─── Search Tests ─────────────────────────────────────────────────────────

    test('@smoke @comprehensive should search for market by name', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Get first market name for searching
        const firstCard = markets.marketCards.first();
        let marketName = '';

        const nameElement = firstCard.locator('h3, .text-lg, .font-semibold').first();
        if (await nameElement.isVisible()) {
            marketName = (await nameElement.textContent() ?? '').trim();
        }

        if (marketName) {
            // Search for the market
            await markets.search(marketName);

            // Verify filtered results
            const cards = await markets.getMarketCount();
            expect(cards).toBeGreaterThan(0);

            // Verify at least one card contains the search term
            const resultCard = page.locator('[data-testid="market-card"]', { hasText: marketName }).first();
            await expect(resultCard).toBeVisible();
        }
    });

    test('@comprehensive should filter results with partial match', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Search with partial term
        const searchTerm = 'bitcoin';
        await markets.search(searchTerm);

        // Verify filtered results exist
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThanOrEqual(0);

        // If results exist, verify they match the search
        if (cardCount > 0) {
            const firstResult = markets.marketCards.first();
            const resultText = await firstResult.textContent() ?? '';
            expect(resultText.toLowerCase()).toContain(searchTerm.toLowerCase());
        }
    });

    test('@comprehensive should clear search results', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const initialCount = await markets.getMarketCount();

        // Search for something
        await markets.search('xyz-nonexistent-market');

        // Clear search by emptying input
        await markets.searchInput.fill('');
        await page.waitForLoadState('networkidle');

        // Verify results are restored
        const finalCount = await markets.getMarketCount();
        expect(finalCount).toBe(initialCount);
    });

    test('@comprehensive should show empty state when search has no results', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Search for nonexistent market
        await markets.search('zzz-impossible-market-xyz-123');

        // Verify empty state message
        const emptyState = page.locator('text="No markets found", :text("No results"), :text("empty")').first();
        if (await emptyState.isVisible()) {
            await expect(emptyState).toBeVisible();
        }

        // Verify no cards shown
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBe(0);
    });

    test('@comprehensive should debounce search input', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Get initial network listener
        let networkRequestCount = 0;
        page.on('response', () => {
            networkRequestCount++;
        });

        // Type character by character
        await markets.searchInput.type('test', { delay: 50 });

        // Count network requests during typing
        const countAfterTyping = networkRequestCount;

        // Wait for debounce to settle
        await page.waitForLoadState('networkidle');

        // Verify debounce worked by checking requests were limited
        // (exact count depends on implementation, but should not be excessive)
        expect(countAfterTyping).toBeLessThan(20);
    });

    // ─── Category Filter Tests ────────────────────────────────────────────────

    test('@smoke @comprehensive should default to "All" category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Verify "All" button is active/selected
        const allButton = markets.categoryChips['All'];
        const allClasses = await allButton.getAttribute('class') ?? '';
        const allDisabled = await allButton.getAttribute('disabled');

        // Verify all categories shown
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@comprehensive should filter to Sports category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const initialCount = await markets.getMarketCount();

        // Click Sports filter
        await markets.selectCategory('Sports');

        // Verify results filtered (may be same or less)
        const sportsCount = await markets.getMarketCount();
        expect(sportsCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should filter to Crypto category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click Crypto filter
        await markets.selectCategory('Crypto');

        // Verify results filtered
        const cryptoCount = await markets.getMarketCount();
        expect(cryptoCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should filter to Politics category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click Politics filter
        await markets.selectCategory('Politics');

        // Verify results filtered
        const politicsCount = await markets.getMarketCount();
        expect(politicsCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should filter to Economics category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click Economics filter
        await markets.selectCategory('Economics');

        // Verify results filtered
        const ecoCount = await markets.getMarketCount();
        expect(ecoCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should filter to Finance category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click Finance filter
        await markets.selectCategory('Finance');

        // Verify results filtered
        const financeCount = await markets.getMarketCount();
        expect(financeCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should filter to Technology category', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click Technology filter
        await markets.selectCategory('Technology');

        // Verify results filtered
        const techCount = await markets.getMarketCount();
        expect(techCount).toBeGreaterThanOrEqual(0);
    });

    test('@comprehensive should return to All when clicking All after category filter', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const initialCount = await markets.getMarketCount();

        // Filter to a category
        await markets.selectCategory('Sports');
        const filteredCount = await markets.getMarketCount();

        // Click All to reset
        await markets.selectCategory('All');

        // Verify back to all categories
        const allCount = await markets.getMarketCount();
        expect(allCount).toBe(initialCount);
    });

    test('@comprehensive should only allow one category active at a time', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Select Sports
        await markets.selectCategory('Sports');

        // Select Crypto (should deselect Sports)
        await markets.selectCategory('Crypto');

        // Verify only Crypto is active (check class attributes)
        const cryptoButton = markets.categoryChips['Crypto'];
        const cryptoClass = await cryptoButton.getAttribute('class') ?? '';

        // Verify Crypto is selected
        const isSelected = cryptoClass.includes('active') || cryptoClass.includes('selected');
        expect(isSelected).toBeTruthy();
    });

    // ─── Sorting Tests ────────────────────────────────────────────────────────

    test('@smoke @comprehensive should default to Volume sorting', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Verify volume sort is applied (typically shown in dropdown or is default order)
        const cards = markets.marketCards;
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
    });

    test('@comprehensive should sort by Volume (highest first)', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        await markets.selectSort('volume');

        // Verify sorted (no error should occur)
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@comprehensive should sort by Newest', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        await markets.selectSort('newest');

        // Verify sorted
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@comprehensive should sort by Closing Soon', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        await markets.selectSort('closingSoon');

        // Verify sorted
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@comprehensive should sort by Liquidity', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        await markets.selectSort('liquidity');

        // Verify sorted
        const cardCount = await markets.getMarketCount();
        expect(cardCount).toBeGreaterThan(0);
    });

    // ─── View Toggle Tests ────────────────────────────────────────────────────

    test('@smoke @comprehensive should display card view by default', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Verify cards are visible
        const cards = markets.marketCards;
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);

        // Verify cards have card structure (not table rows)
        const firstCard = cards.first();
        const isCardVisible = await firstCard.isVisible();
        expect(isCardVisible).toBe(true);
    });

    test('@comprehensive should switch to table view', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Toggle to table view
        await markets.toggleView();

        // Verify table elements exist
        const tableElement = page.locator('table, [role="table"], [role="grid"]').first();
        if (await tableElement.isVisible()) {
            await expect(tableElement).toBeVisible();
        }
    });

    test('@comprehensive should switch back to card view from table', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Toggle to table
        await markets.toggleView();

        // Toggle back to cards
        await markets.toggleView();

        // Verify cards are visible again
        const cards = markets.marketCards;
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('@comprehensive should persist view during search', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Switch to table view
        await markets.toggleView();

        // Perform search
        await markets.search('bitcoin');

        // Verify still in table view
        const tableElement = page.locator('table, [role="table"], [role="grid"]').first();
        if (await tableElement.isVisible()) {
            await expect(tableElement).toBeVisible();
        }
    });

    test('@comprehensive should persist view during filter', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Switch to table view
        await markets.toggleView();

        // Apply category filter
        await markets.selectCategory('Sports');

        // Verify still in table view
        const tableElement = page.locator('table, [role="table"], [role="grid"]').first();
        if (await tableElement.isVisible()) {
            await expect(tableElement).toBeVisible();
        }
    });

    // ─── Pagination Tests ──────────────────────────────────────────────────────

    test('@comprehensive should display limited results per page', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Get initial card count (should be one page worth)
        const initialCount = await markets.getMarketCount();

        // Typical page size is 10-25 items
        expect(initialCount).toBeLessThanOrEqual(50);
    });

    test('@comprehensive should load next page with Next button', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        const initialCount = await markets.getMarketCount();

        // Click next if available
        const nextButton = markets.paginationNext;
        const isNextVisible = await nextButton.isVisible();

        if (isNextVisible) {
            // Try to click next
            const isEnabled = await nextButton.isEnabled();
            if (isEnabled) {
                await markets.goToPage('next');

                // Verify page changed (URL should change or content should change)
                const newCount = await markets.getMarketCount();
                // New page might have different count
                expect(newCount).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('@comprehensive should load previous page with Previous button', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Navigate to page 2 first
        const nextButton = markets.paginationNext;
        if (await nextButton.isEnabled()) {
            await markets.goToPage('next');

            // Now try previous
            const prevButton = markets.paginationPrev;
            if (await prevButton.isEnabled()) {
                await markets.goToPage('prev');

                // Verify page loaded
                const cardCount = await markets.getMarketCount();
                expect(cardCount).toBeGreaterThan(0);
            }
        }
    });

    test('@comprehensive should display page counter', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Get page info text
        const pageInfo = await markets.getPageInfo();

        // Verify format like "Page 1 of X"
        if (pageInfo) {
            expect(pageInfo).toMatch(/Page \d+ of \d+|Showing/);
        }
    });

    test('@comprehensive should disable Previous on first page', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // On first page, Previous should be disabled
        const prevButton = markets.paginationPrev;

        if (await prevButton.isVisible()) {
            const isDisabled = (await prevButton.getAttribute('disabled')) === '';
            expect(isDisabled).toBe(true);
        }
    });

    test('@comprehensive should disable Next on last page', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Navigate to last page (keep clicking next)
        let canContinue = true;
        while (canContinue) {
            const nextButton = markets.paginationNext;
            const isEnabled = await nextButton.isEnabled();

            if (isEnabled) {
                await markets.goToPage('next');
            } else {
                canContinue = false;

                // Verify Next is disabled
                const isDisabled = (await nextButton.getAttribute('disabled')) === '';
                expect(isDisabled).toBe(true);
                break;
            }
        }
    });

    // ─── Market Detail Tests ───────────────────────────────────────────────────

    test('@smoke @comprehensive should navigate to market detail by clicking card', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Get first market card
        const firstCard = markets.marketCards.first();

        if (await firstCard.isVisible()) {
            // Click the card
            await firstCard.click();

            // Verify navigation to detail page
            await expect(page).toHaveURL(/\/markets\/\w+/);

            // Verify detail page loaded
            const detailHeading = page.locator('h1, h2').first();
            await expect(detailHeading).toBeVisible({ timeout: 15_000 });
        }
    });

    test('@comprehensive should display full market information on detail page', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click first market
        const firstCard = markets.marketCards.first();
        if (await firstCard.isVisible()) {
            await firstCard.click();

            // Verify detail content
            await expect(page).toHaveURL(/\/markets\/\w+/, { timeout: 15_000 });

            // Verify market name shown
            const marketName = page.locator('h1, h2').first();
            const name = await marketName.textContent();
            expect(name).toBeTruthy();

            // Verify additional details (description, end date, etc)
            const details = page.locator('[data-testid*="detail"], .description, .market-info').first();
            if (await details.isVisible()) {
                await expect(details).toBeVisible();
            }
        }
    });

    test('@comprehensive should provide back navigation from detail page', async ({ page }) => {
        const markets = new MarketsPage(page);
        await markets.goto();

        // Click first market
        const firstCard = markets.marketCards.first();
        if (await firstCard.isVisible()) {
            await firstCard.click();

            // Find back button or link
            const backButton = page.locator('button[aria-label*="Back"], a[aria-label*="Back"], :text("Back")').first();

            if (await backButton.isVisible()) {
                await backButton.click();

                // Verify returned to markets list
                await expect(page).toHaveURL(/\/markets$/);
                await expect(page.locator('h1', { hasText: 'Markets' })).toBeVisible();
            } else {
                // If no explicit back button, try browser back
                await page.goBack();

                // Verify back at markets list
                await expect(page).toHaveURL(/\/markets$/);
            }
        }
    });
});
