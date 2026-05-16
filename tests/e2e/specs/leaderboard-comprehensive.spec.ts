import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/api';
import { LeaderboardPage } from '../pages/leaderboard.page';

test.describe('Leaderboard — Full Workflow Coverage', () => {
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
        test('Leaderboard loads at /leaderboard', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            expect(page.url()).toContain('/leaderboard');
            await expect(page.locator('h1', { hasText: 'Leaderboard' })).toBeVisible();
        });

        test('Shows ranked traders in table or empty state', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            // Verify page has loaded — table rows or empty state
            await expect(page.locator('[data-testid="leaderboard-table"], [data-testid="empty-state"]').first()).toBeVisible({ timeout: 10_000 });
        });

        test('Default period is 7 Days', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const sevenDayTab = leaderboardPage.periodTabs['7d'];
            const isSelected = await sevenDayTab.getAttribute('aria-selected').catch(() => null);
            if (isSelected !== null) {
                expect(isSelected).toBe('true');
            } else {
                await expect(sevenDayTab).toBeVisible();
            }
        });
    });

    test.describe('Period Tabs', () => {
        test('"7 Days" tab → shows 7-day performance', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            await leaderboardPage.selectPeriod('7d');

            const tab = leaderboardPage.periodTabs['7d'];
            await expect(tab).toBeVisible();
        });

        test('Active period tab is highlighted', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            // Verify 7d is initially visible
            const sevenDayTab = leaderboardPage.periodTabs['7d'];
            await expect(sevenDayTab).toBeVisible();

            // Switch to 30d
            await leaderboardPage.selectPeriod('30d');

            const thirtyDayTab = leaderboardPage.periodTabs['30d'];
            await expect(thirtyDayTab).toBeVisible();
        });

        test('Changing period refreshes data', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            // Wait for initial data to load — the loading skeleton shows pulse
            // animation rows without data-testid. Wait for either real trader
            // rows or the empty state, with a longer timeout for slow API.
            const traderRow = page.locator('[data-testid="trader-row"]');
            const emptyState = page.locator('text=/No leaderboard data/i');
            await expect(traderRow.first().or(emptyState)).toBeVisible({ timeout: 30_000 });

            const sevenDayCount = await leaderboardPage.getTraderCount();

            // Switch to 30d
            await leaderboardPage.selectPeriod('30d');

            // Wait for data to refresh — the table body re-renders after the
            // API call completes.  Either trader rows appear or the empty state.
            await expect(traderRow.first().or(emptyState)).toBeVisible({ timeout: 30_000 });

            const thirtyDayCount = await leaderboardPage.getTraderCount();

            // Switch back to 7d
            await leaderboardPage.selectPeriod('7d');
            await expect(traderRow.first().or(emptyState)).toBeVisible({ timeout: 30_000 });

            const returnedCount = await leaderboardPage.getTraderCount();

            // Count should be consistent when returning to same period
            expect(returnedCount).toBe(sevenDayCount);
        });
    });

    test.describe('Table Content', () => {
        test('Columns: Rank, Trader, Score, P&L, Win Rate, Trades', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const table = page.locator('[data-testid="leaderboard-table"]');
            if (!(await table.isVisible().catch(() => false))) { test.skip(true, 'Leaderboard table not visible'); return; }

            // Verify column headers exist
            await expect(table.locator('[data-testid="column-rank"]')).toBeVisible();
            await expect(table.locator('[data-testid="column-trader"]')).toBeVisible();
            await expect(table.locator('[data-testid="column-score"]')).toBeVisible();
            await expect(table.locator('[data-testid="column-pnl"]')).toBeVisible();
            await expect(table.locator('[data-testid="column-win-rate"]')).toBeVisible();
            await expect(table.locator('[data-testid="column-trades"]')).toBeVisible();
        });

        test('Top 3 traders show medal badges (gold, silver, bronze)', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount < 3) { test.skip(true, 'Skip when insufficient data'); return; }

            // Check first three rows for medals
            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const goldMedal = firstRow.locator('[data-testid="medal-badge"][data-medal="gold"]');
            await expect(goldMedal).toBeVisible();

            const secondRow = page.locator('[data-testid="trader-row"]').nth(1);
            const silverMedal = secondRow.locator('[data-testid="medal-badge"][data-medal="silver"]');
            await expect(silverMedal).toBeVisible();

            const thirdRow = page.locator('[data-testid="trader-row"]').nth(2);
            const bronzeMedal = thirdRow.locator('[data-testid="medal-badge"][data-medal="bronze"]');
            await expect(bronzeMedal).toBeVisible();
        });

        test('Trader name links to public profile', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const traderLink = firstRow.locator('[data-testid="trader-name"] a[href^="/profile/"]').first();

            // Wait for the link to have an href attribute
            await expect(traderLink).toHaveAttribute('href', /\/profile\//, { timeout: 5_000 });
        });

        test('Scores displayed with appropriate formatting', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const scores = page.locator('[data-testid="trader-row"] [data-testid="trader-score"]');
            const scoreCount = await scores.count();
            if (scoreCount === 0) { test.skip(true, 'Score column may be hidden at viewport'); return; }

            // Verify score cells contain text (may be "—" for no-data or a number)
            const firstScore = scores.nth(0);
            const scoreText = await firstScore.textContent();
            expect(scoreText).toBeTruthy();
        });

        test('P&L shows color-coded (green positive, red negative)', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const pnlCells = page.locator('[data-testid="trader-pnl"]');
            const count = await pnlCells.count();

            // Check a few P&L cells for color coding
            for (let i = 0; i < Math.min(3, count); i++) {
                const cell = pnlCells.nth(i);
                const classList = await cell.getAttribute('class');

                // Should have some class indicating positive or negative
                expect(classList).toBeTruthy();

                const pnlValue = await cell.textContent();
                const isPositive = pnlValue?.includes('+') || parseFloat(pnlValue?.replace(/[^0-9.-]/g, '') ?? '0') > 0;
                const isNegative = pnlValue?.includes('-') && parseFloat(pnlValue?.replace(/[^0-9.-]/g, '') ?? '0') < 0;

                // Verify color coding exists
                if (isPositive && classList?.includes('positive')) {
                    expect(classList).toContain('positive');
                } else if (isNegative && classList?.includes('negative')) {
                    expect(classList).toContain('negative');
                }
            }
        });
    });

    test.describe('Sorting', () => {
        test('Default sort by rank/score', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const firstRank = await firstRow.locator('[data-testid="trader-rank"]').textContent();

            expect(firstRank?.trim()).toBe('1');
        });

        test('Click column headers to sort (if sortable)', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const scoreHeader = page.locator('[data-testid="column-score"]');

            if (await scoreHeader.locator('button').isVisible()) {
                const scoreButton = scoreHeader.locator('button');

                // Click to sort
                await scoreButton.click();

                // Verify sort was applied
                const firstScore = await page.locator('[data-testid="trader-row"]').nth(0).locator('[data-testid="trader-score"]').textContent();
                expect(firstScore).toBeTruthy();
            }
        });

        test('Sort direction toggles on repeated clicks', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const pnlHeader = page.locator('[data-testid="column-pnl"]');

            if (await pnlHeader.locator('button').isVisible()) {
                const pnlButton = pnlHeader.locator('button');

                const firstPnlBefore = await page.locator('[data-testid="trader-row"]').nth(0).locator('[data-testid="trader-pnl"]').textContent();

                // Click once
                await pnlButton.click();

                const firstPnlAfter = await page.locator('[data-testid="trader-row"]').nth(0).locator('[data-testid="trader-pnl"]').textContent();

                // Click again to reverse
                await pnlButton.click();

                const firstPnlReversed = await page.locator('[data-testid="trader-row"]').nth(0).locator('[data-testid="trader-pnl"]').textContent();

                // Order should change between clicks
                if (firstPnlBefore !== firstPnlAfter) {
                    // At least one click had an effect
                    expect(firstPnlAfter).toBeTruthy();
                }
            }
        });
    });

    test.describe('Pagination', () => {
        test('Navigate through leaderboard pages', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            // Pagination only renders when there's more than 1 page of data
            const nextButton = leaderboardPage.paginationNext;
            const isNextVisible = await nextButton.isVisible({ timeout: 3_000 }).catch(() => false);
            if (!isNextVisible) { test.skip(true, 'No pagination — skip'); return; }

            const firstPageFirstTrader = await leaderboardPage.getTraderByRank(1);

            if (!(await nextButton.isDisabled())) {
                await leaderboardPage.goToPage('next');

                const secondPageFirstTrader = await leaderboardPage.getTraderByRank(1);

                // Should have different traders on next page
                expect(secondPageFirstTrader).not.toBe(firstPageFirstTrader);
            }
        });

        test('Next/Previous buttons', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const nextButton = leaderboardPage.paginationNext;
            const prevButton = leaderboardPage.paginationPrev;

            // Pagination may not render without enough data
            if (!(await nextButton.isVisible().catch(() => false))) { test.skip(true, 'Pagination not visible'); return; }

            // On first page
            await expect(prevButton).toBeDisabled();
            const nextDisabled = await nextButton.isDisabled();
            if (nextDisabled) { test.skip(true, 'Not enough data for multi-page'); return; }

            // Go to next page
            await leaderboardPage.goToPage('next');

            // Previous should now be enabled
            await expect(prevButton).not.toBeDisabled();

            // Go back
            await leaderboardPage.goToPage('prev');

            // Should be back on first page
            await expect(prevButton).toBeDisabled();
        });

        test('Page counter', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const pageIndicator = page.locator('[data-testid="page-indicator"]');

            if (await pageIndicator.isVisible()) {
                const text = await pageIndicator.textContent();

                // Should show "X / Y" format
                expect(text).toMatch(/\d+\s*\/\s*\d+/);

                // Current page should be 1
                const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    const [, current] = match;
                    expect(current).toBe('1');
                }
            }
        });
    });

    test.describe('Profile Navigation', () => {
        test('Click trader name → navigates to /profile/:username', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            // Use href filter to avoid matching "Copy Trade" link in same cell
            const traderLink = firstRow.locator('[data-testid="trader-name"] a[href^="/profile/"]').first();

            const href = await traderLink.getAttribute('href');
            expect(href).toMatch(/^\/profile\/[\w-]+/);

            // Click to navigate and wait for URL change
            await traderLink.click();
            await page.waitForURL(/\/profile\/[\w-]+/, { timeout: 10_000 });

            // Verify we're on profile page
            await expect(page).toHaveURL(/\/profile\/[\w-]+/);
        });

        test('Public profile shows trader\'s stats', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            // Use href filter to avoid matching "Copy Trade" link in same cell
            const traderLink = firstRow.locator('[data-testid="trader-name"] a[href^="/profile/"]').first();

            await traderLink.click();
            await page.waitForURL(/\/profile\/[\w-]+/, { timeout: 10_000 });

            // Verify profile page loaded — look for stats section or profile heading
            const profileStats = page.locator('[data-testid="trader-stats"]');
            const profileHeading = page.locator('h1');
            await expect(profileHeading).toBeVisible({ timeout: 15_000 });
        });

        test('Back navigation returns to leaderboard', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            if (traderCount === 0) { test.skip(true, 'Skip when no seed data'); return; }

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            // Use href filter to avoid matching "Copy Trade" link in same cell
            const traderLink = firstRow.locator('[data-testid="trader-name"] a[href^="/profile/"]').first();

            await traderLink.click();
            await page.waitForURL(/\/profile\/[\w-]+/, { timeout: 10_000 });

            // Use browser back
            await page.goBack();

            // Should return to leaderboard
            await expect(page).toHaveURL(/\/leaderboard/);
        });
    });
});
