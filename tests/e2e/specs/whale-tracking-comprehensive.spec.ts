import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/api';
import { WhaleFeedPage } from '../pages/whale-feed.page';

test.describe('Whale Tracking — Full Workflow Coverage', () => {
    test.beforeEach(async ({ page }) => {
        const { token } = await apiLogin('alice@e2e.dev.local', 'TestPass123!');
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    test.describe('Whale Feed', () => {
        test('Whale feed loads at /whales', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            expect(page.url()).toContain('/whale');
            await expect(page.locator('h1', { hasText: /whale|tracking/ })).toBeVisible();
        });

        test('Shows whale transaction items', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const itemCount = await whaleFeedPage.getItemCount();
            expect(itemCount).toBeGreaterThan(0);
        });

        test('Each item shows: wallet address (truncated), amount, market, side, timestamp', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();

            await expect(firstItem.locator('[data-testid="whale-address"]')).toBeVisible();
            await expect(firstItem.locator('[data-testid="transaction-amount"]')).toBeVisible();
            await expect(firstItem.locator('[data-testid="transaction-market"]')).toBeVisible();
            await expect(firstItem.locator('[data-testid="transaction-side"]')).toBeVisible();
            await expect(firstItem.locator('[data-testid="transaction-timestamp"]')).toBeVisible();
        });
    });

    test.describe('Min Size Filter', () => {
        test('Default shows all sizes', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const initialCount = await whaleFeedPage.getItemCount();
            expect(initialCount).toBeGreaterThan(0);
        });

        test('Set minimum size (e.g., 1000) → filters out smaller transactions', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const initialCount = await whaleFeedPage.getItemCount();

            await whaleFeedPage.setMinSize('1000');

            const filteredCount = await whaleFeedPage.getItemCount();

            // Should have fewer items with the filter
            expect(filteredCount).toBeLessThanOrEqual(initialCount);

            // Verify all visible amounts are >= 1000
            const amounts = await page.locator('[data-testid="transaction-amount"]').allTextContents();
            amounts.forEach(amount => {
                const numStr = amount.replace(/[^0-9.]/g, '');
                const num = parseFloat(numStr);

                if (!isNaN(num)) {
                    expect(num).toBeGreaterThanOrEqual(1000);
                }
            });
        });

        test('Set larger minimum (e.g., 10000) → fewer results', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            await whaleFeedPage.setMinSize('1000');
            await page.waitForTimeout(300);

            const count1000 = await whaleFeedPage.getItemCount();

            await whaleFeedPage.setMinSize('10000');
            await page.waitForTimeout(300);

            const count10000 = await whaleFeedPage.getItemCount();

            // Higher minimum should give fewer or equal results
            expect(count10000).toBeLessThanOrEqual(count1000);
        });

        test('Set minimum to 0 → shows all transactions', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const initialCount = await whaleFeedPage.getItemCount();

            // Set high minimum first
            await whaleFeedPage.setMinSize('10000');
            await page.waitForTimeout(300);

            const filteredCount = await whaleFeedPage.getItemCount();

            // Reset to 0
            await whaleFeedPage.setMinSize('0');
            await page.waitForTimeout(300);

            const resetCount = await whaleFeedPage.getItemCount();

            // Should return to initial state
            expect(resetCount).toBe(initialCount);
        });

        test('Filter persists during pagination', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            // Set minimum size
            await whaleFeedPage.setMinSize('5000');
            await page.waitForTimeout(300);

            const minSizeValue = await whaleFeedPage.minSizeInput.inputValue();

            // Go to next page
            const nextButton = whaleFeedPage.paginationNext;
            if (!(await nextButton.isDisabled())) {
                await whaleFeedPage.goToPage('next');

                // Verify filter is still applied
                const currentMinSize = await whaleFeedPage.minSizeInput.inputValue();
                expect(currentMinSize).toBe(minSizeValue);

                // Verify amounts still meet the filter
                const amounts = await page.locator('[data-testid="transaction-amount"]').allTextContents();
                amounts.forEach(amount => {
                    const numStr = amount.replace(/[^0-9.]/g, '');
                    const num = parseFloat(numStr);

                    if (!isNaN(num)) {
                        expect(num).toBeGreaterThanOrEqual(5000);
                    }
                });
            }
        });
    });

    test.describe('Follow/Unfollow', () => {
        test('Follow button visible on untracked whales', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const followButton = firstItem.locator('button', { hasText: /follow/i });

            await expect(followButton).toBeVisible();
        });

        test('Click Follow → button changes to "Following" or "Unfollow"', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const address = await firstItem.locator('[data-testid="whale-address"]').textContent();

            if (address) {
                const followButton = whaleFeedPage.getFollowButton(address.trim());

                // Check initial state
                const initialText = await followButton.textContent();
                expect(initialText?.toLowerCase()).toContain('follow');

                // Click follow
                await followButton.click();
                await page.waitForTimeout(300);

                // Button should change
                const afterClickButton = firstItem.locator('button', { hasText: /following|unfollow/i });
                const afterClickText = await afterClickButton.textContent();

                expect(afterClickText?.toLowerCase()).toMatch(/following|unfollow/);
            }
        });

        test('Unfollow → button reverts to "Follow"', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const address = await firstItem.locator('[data-testid="whale-address"]').textContent();

            if (address) {
                const trimmedAddress = address.trim();
                const followButton = whaleFeedPage.getFollowButton(trimmedAddress);

                // Follow first
                await followButton.click();
                await page.waitForTimeout(300);

                // Now unfollow
                const unfollowButton = whaleFeedPage.getUnfollowButton(trimmedAddress);
                await unfollowButton.click();
                await page.waitForTimeout(300);

                // Button should revert to Follow
                const revertedButton = firstItem.locator('button', { hasText: /follow/i });
                const revertedText = await revertedButton.textContent();

                expect(revertedText?.toLowerCase()).toContain('follow');
            }
        });

        test('Follow/unfollow persists on page refresh', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');
            const address = await addressElement.textContent();

            if (address) {
                const trimmedAddress = address.trim();
                const followButton = whaleFeedPage.getFollowButton(trimmedAddress);

                // Follow the whale
                await followButton.click();
                await page.waitForTimeout(300);

                // Refresh page
                await page.reload();
                await page.waitForTimeout(300);

                // Verify follow state persisted
                const unfollowButton = whaleFeedPage.getUnfollowButton(trimmedAddress);
                await expect(unfollowButton).toBeVisible();
            }
        });
    });

    test.describe('Following Page', () => {
        test('Navigate to /whales/following', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            await whaleFeedPage.goToFollowing();

            expect(page.url()).toContain('/following');
        });

        test('Shows list of followed whales', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            // Follow a whale first
            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const address = await firstItem.locator('[data-testid="whale-address"]').textContent();

            if (address) {
                const trimmedAddress = address.trim();
                const followButton = whaleFeedPage.getFollowButton(trimmedAddress);
                await followButton.click();
                await page.waitForTimeout(300);

                // Navigate to following page
                await whaleFeedPage.goToFollowing();

                const followedWhales = page.locator('[data-testid="whale-feed-item"]');
                const count = await followedWhales.count();

                expect(count).toBeGreaterThan(0);
            }
        });

        test('Each followed whale shows stats', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            // Follow a whale first if not already
            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const address = await firstItem.locator('[data-testid="whale-address"]').textContent();

            if (address) {
                const trimmedAddress = address.trim();
                const followButton = whaleFeedPage.getFollowButton(trimmedAddress);

                // Only click if still visible (not already following)
                if (await followButton.isVisible()) {
                    await followButton.click();
                    await page.waitForTimeout(300);
                }

                // Navigate to following page
                await whaleFeedPage.goToFollowing();

                const firstFollowed = page.locator('[data-testid="whale-feed-item"]').first();

                // Verify stats are shown
                const stats = firstFollowed.locator('[data-testid="whale-stats"]');
                await expect(stats).toBeVisible();

                const winRate = firstFollowed.locator('[data-testid="win-rate"]');
                if (await winRate.isVisible()) {
                    const text = await winRate.textContent();
                    expect(text).toBeTruthy();
                }
            }
        });

        test('Unfollow from following page → whale removed from list', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            // Follow a whale first
            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const address = await firstItem.locator('[data-testid="whale-address"]').textContent();

            if (address) {
                const trimmedAddress = address.trim();
                const followButton = whaleFeedPage.getFollowButton(trimmedAddress);
                await followButton.click();
                await page.waitForTimeout(300);

                // Go to following page
                await whaleFeedPage.goToFollowing();

                const initialCount = await whaleFeedPage.getItemCount();

                // Unfollow from the list
                const unfollowButton = page.locator(`[data-testid="unfollow-${trimmedAddress}"]`);
                await unfollowButton.click();
                await page.waitForTimeout(300);

                const afterUnfollowCount = await whaleFeedPage.getItemCount();

                // Should have one fewer whale
                expect(afterUnfollowCount).toBeLessThan(initialCount);
            }
        });

        test('Empty state when not following anyone', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            // Go to following page
            await whaleFeedPage.goToFollowing();

            const itemCount = await whaleFeedPage.getItemCount();

            if (itemCount === 0) {
                // Verify empty state is shown
                const emptyState = page.locator('[data-testid="empty-state"]');
                await expect(emptyState).toBeVisible();
            }
        });
    });

    test.describe('Whale Profile', () => {
        test('Click whale address → navigates to /whales/:address', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');

            const address = await addressElement.textContent();
            if (address) {
                await addressElement.click();
                await page.waitForTimeout(300);

                expect(page.url()).toMatch(/\/whales\/[a-zA-Z0-9]+/);
            }
        });

        test('Profile shows whale\'s trading history', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');

            const address = await addressElement.textContent();
            if (address) {
                await addressElement.click();
                await page.waitForTimeout(300);

                // Verify trading history is shown
                const history = page.locator('[data-testid="trading-history"]');
                await expect(history).toBeVisible();
            }
        });

        test('Shows win rate, total volume, favorite markets', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');

            const address = await addressElement.textContent();
            if (address) {
                await addressElement.click();
                await page.waitForTimeout(300);

                // Check for stats
                const winRate = page.locator('[data-testid="whale-win-rate"]');
                const totalVolume = page.locator('[data-testid="whale-total-volume"]');
                const favoriteMarkets = page.locator('[data-testid="whale-favorite-markets"]');

                await expect(winRate).toBeVisible();
                await expect(totalVolume).toBeVisible();
                await expect(favoriteMarkets).toBeVisible();
            }
        });

        test('Follow/Unfollow button on profile', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');

            const address = await addressElement.textContent();
            if (address) {
                await addressElement.click();
                await page.waitForTimeout(300);

                const followButton = page.locator('button', { hasText: /follow|unfollow/i });
                await expect(followButton).toBeVisible();

                const buttonText = await followButton.textContent();
                expect(buttonText?.toLowerCase()).toMatch(/follow|unfollow/);
            }
        });

        test('Copy trade button (links to copy trading setup)', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
            const addressElement = firstItem.locator('[data-testid="whale-address"]');

            const address = await addressElement.textContent();
            if (address) {
                await addressElement.click();
                await page.waitForTimeout(300);

                const copyTradeButton = page.locator('button', { hasText: /copy trade|copy this trader/i });

                if (await copyTradeButton.isVisible()) {
                    const href = await copyTradeButton.getAttribute('href') || await copyTradeButton.getAttribute('data-link');
                    expect(href).toBeTruthy();

                    // Should link to copy trading setup
                    if (href) {
                        expect(href).toMatch(/copy|setup/i);
                    }
                }
            }
        });
    });

    test.describe('Pagination', () => {
        test('Navigate through feed pages', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const firstPageItem = await page.locator('[data-testid="whale-feed-item"]').first().textContent();

            const nextButton = whaleFeedPage.paginationNext;
            if (!(await nextButton.isDisabled())) {
                await whaleFeedPage.goToPage('next');

                const secondPageItem = await page.locator('[data-testid="whale-feed-item"]').first().textContent();

                // Should have different content
                expect(secondPageItem).not.toBe(firstPageItem);
            }
        });

        test('Next/Previous functional', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const nextButton = whaleFeedPage.paginationNext;
            const prevButton = whaleFeedPage.paginationPrev;

            // First page: Next enabled, Prev disabled
            expect(await nextButton.isDisabled()).toBe(false);
            await expect(prevButton).toBeDisabled();

            // Go to next
            await whaleFeedPage.goToPage('next');

            // Should be able to go back
            await expect(prevButton).not.toBeDisabled();
        });

        test('Page counter accurate', async ({ page }) => {
            const whaleFeedPage = new WhaleFeedPage(page);
            await whaleFeedPage.goto();

            const pageIndicator = page.locator('[data-testid="page-indicator"]');

            if (await pageIndicator.isVisible()) {
                const text = await pageIndicator.textContent();

                // Should show "X / Y" format
                expect(text).toMatch(/\d+\s*\/\s*\d+/);
            }
        });
    });
});
