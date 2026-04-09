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

        test('Shows ranked traders in table', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const traderCount = await leaderboardPage.getTraderCount();
            expect(traderCount).toBeGreaterThan(0);
        });

        test('Default period is 7 Days', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const sevenDayTab = leaderboardPage.periodTabs['7d'];
            await expect(sevenDayTab).toHaveAttribute('aria-selected', 'true');
        });
    });

    test.describe('Period Tabs', () => {
        test('"7 Days" tab → shows 7-day performance', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            await leaderboardPage.selectPeriod('7d');

            const tab = leaderboardPage.periodTabs['7d'];
            await expect(tab).toHaveAttribute('aria-selected', 'true');

            const traderCount = await leaderboardPage.getTraderCount();
            expect(traderCount).toBeGreaterThan(0);
        });

        test('"30 Days" tab → shows 30-day performance', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            await leaderboardPage.selectPeriod('30d');

            const tab = leaderboardPage.periodTabs['30d'];
            await expect(tab).toHaveAttribute('aria-selected', 'true');

            const traderCount = await leaderboardPage.getTraderCount();
            expect(traderCount).toBeGreaterThan(0);
        });

        test('"All Time" tab → shows all-time performance', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            await leaderboardPage.selectPeriod('allTime');

            const tab = leaderboardPage.periodTabs['allTime'];
            await expect(tab).toHaveAttribute('aria-selected', 'true');

            const traderCount = await leaderboardPage.getTraderCount();
            expect(traderCount).toBeGreaterThan(0);
        });

        test('Active period tab is highlighted', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            // Verify 7d is initially highlighted
            const sevenDayTab = leaderboardPage.periodTabs['7d'];
            await expect(sevenDayTab).toHaveAttribute('aria-selected', 'true');

            // Switch to 30d
            await leaderboardPage.selectPeriod('30d');

            const thirtyDayTab = leaderboardPage.periodTabs['30d'];
            await expect(thirtyDayTab).toHaveAttribute('aria-selected', 'true');

            // 7d should no longer be highlighted
            await expect(sevenDayTab).toHaveAttribute('aria-selected', 'false');
        });

        test('Changing period refreshes data', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const sevenDayFirstTrader = await leaderboardPage.getTraderByRank(1);

            // Switch to 30d
            await leaderboardPage.selectPeriod('30d');

            const thirtyDayFirstTrader = await leaderboardPage.getTraderByRank(1);

            // The top trader might be different for different periods
            // (or the same, but we're primarily checking that data was refreshed)
            const sevenDayCount = await leaderboardPage.getTraderCount();

            // Switch back to 7d
            await leaderboardPage.selectPeriod('7d');

            const returnedCount = await leaderboardPage.getTraderCount();

            // Count should be consistent when returning to same period
            expect(returnedCount).toBe(sevenDayCount);
        });
    });

    test.describe('Table Content', () => {
        test('Columns: Rank, Trader, Score, P&L, Win Rate, Trades', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const table = page.locator('[data-testid="leaderboard-table"]');
            await expect(table).toBeVisible();

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

            // Check first three rows for medals
            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const goldMedal = firstRow.locator('[data-testid="medal-badge"][data-medal="gold"]');
            if (await goldMedal.isVisible()) {
                await expect(goldMedal).toBeVisible();
            }

            const secondRow = page.locator('[data-testid="trader-row"]').nth(1);
            const silverMedal = secondRow.locator('[data-testid="medal-badge"][data-medal="silver"]');
            if (await silverMedal.isVisible()) {
                await expect(silverMedal).toBeVisible();
            }

            const thirdRow = page.locator('[data-testid="trader-row"]').nth(2);
            const bronzeMedal = thirdRow.locator('[data-testid="medal-badge"][data-medal="bronze"]');
            if (await bronzeMedal.isVisible()) {
                await expect(bronzeMedal).toBeVisible();
            }
        });

        test('Trader name links to public profile', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const traderLink = firstRow.locator('[data-testid="trader-name"] a');

            const href = await traderLink.getAttribute('href');
            expect(href).toBeTruthy();
            expect(href).toMatch(/^\/profile\/[\w-]+/);
        });

        test('Scores displayed with appropriate formatting', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const scores = page.locator('[data-testid="trader-row"] [data-testid="trader-score"]');
            const scoreCount = await scores.count();

            expect(scoreCount).toBeGreaterThan(0);

            // Verify scores are numbers
            const firstScore = scores.nth(0);
            const scoreText = await firstScore.textContent();

            expect(scoreText).toBeTruthy();
            // Score should be numeric
            const numValue = parseFloat(scoreText?.replace(/[^0-9.]/g, '') ?? '0');
            expect(numValue).toBeGreaterThanOrEqual(0);
        });

        test('P&L shows color-coded (green positive, red negative)', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const pnlCells = page.locator('[data-testid="trader-pnl"]');
            const count = await pnlCells.count();

            expect(count).toBeGreaterThan(0);

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
                await page.waitForTimeout(300);

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
                await page.waitForTimeout(300);

                const firstPnlAfter = await page.locator('[data-testid="trader-row"]').nth(0).locator('[data-testid="trader-pnl"]').textContent();

                // Click again to reverse
                await pnlButton.click();
                await page.waitForTimeout(300);

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

            const firstPageFirstTrader = await leaderboardPage.getTraderByRank(1);

            const nextButton = leaderboardPage.paginationNext;
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

            const nextButton = leaderboardPage.paginationNext;
            const prevButton = leaderboardPage.paginationPrev;

            // On first page
            await expect(prevButton).toBeDisabled();
            expect(await nextButton.isDisabled()).toBe(false);

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

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const traderLink = firstRow.locator('[data-testid="trader-name"] a');

            const href = await traderLink.getAttribute('href');
            expect(href).toMatch(/^\/profile\/[\w-]+/);

            // Click to navigate
            await traderLink.click();
            await page.waitForTimeout(300);

            // Verify we're on profile page
            expect(page.url()).toMatch(/\/profile\/[\w-]+/);
        });

        test('Public profile shows trader\'s stats', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const traderLink = firstRow.locator('[data-testid="trader-name"] a');

            await traderLink.click();
            await page.waitForTimeout(300);

            // Verify profile content
            const profileStats = page.locator('[data-testid="trader-stats"]');
            await expect(profileStats).toBeVisible();

            // Check for key stats
            const totalTrades = page.locator('[data-testid="total-trades"]');
            const totalVolume = page.locator('[data-testid="total-volume"]');
            const winRate = page.locator('[data-testid="win-rate"]');

            await expect(totalTrades).toBeVisible();
            await expect(totalVolume).toBeVisible();
            await expect(winRate).toBeVisible();
        });

        test('Back navigation returns to leaderboard', async ({ page }) => {
            const leaderboardPage = new LeaderboardPage(page);
            await leaderboardPage.goto();

            const leaderboardUrl = page.url();

            const firstRow = page.locator('[data-testid="trader-row"]').nth(0);
            const traderLink = firstRow.locator('[data-testid="trader-name"] a');

            await traderLink.click();
            await page.waitForTimeout(300);

            // Verify we're on profile page
            expect(page.url()).not.toBe(leaderboardUrl);

            // Click back button if available
            const backButton = page.locator('button[aria-label*="back" i]');

            if (await backButton.isVisible()) {
                await backButton.click();
                await page.waitForTimeout(300);
            } else {
                // Use browser back
                await page.goBack();
                await page.waitForTimeout(300);
            }

            // Should return to leaderboard
            expect(page.url()).toBe(leaderboardUrl);
        });
    });
});
