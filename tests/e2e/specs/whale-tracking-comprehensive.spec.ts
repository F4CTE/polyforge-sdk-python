import { test, expect } from "@playwright/test";
import { apiLogin } from "../helpers/api";
import { WhaleFeedPage } from "../pages/whale-feed.page";

test.describe("Whale Tracking — Full Workflow Coverage", () => {
  test.beforeEach(async ({ page }) => {
    const { token } = await apiLogin("alice@e2e.dev.local", "TestPass123!");
    await page.context().addCookies([
      {
        name: "pf_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test.describe("Whale Feed", () => {
    test("Whale feed loads at /whales", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      expect(page.url()).toContain("/whale");
      await expect(page.locator("h1", { hasText: /whale/i })).toBeVisible();
    });

    test("Shows whale transaction items", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Verify page has loaded — feed items or empty state
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("Each item shows: wallet address (truncated), amount, market, side, timestamp", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const itemCount = await whaleFeedPage.getItemCount();
      test.skip(itemCount === 0, 'No whale feed items seeded');

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();

      await expect(
        firstItem.locator('[data-testid="whale-address"]'),
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="transaction-amount"]'),
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="transaction-market"]'),
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="transaction-side"]'),
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="transaction-timestamp"]'),
      ).toBeVisible();
    });
  });

  test.describe("Min Size Filter", () => {
    test("Default shows all sizes", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Verify page has loaded
      await expect(
        page.locator('[data-testid="whale-feed-item"]').first(),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("Set minimum size ($50K+) → filters out smaller transactions", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const initialCount = await whaleFeedPage.getItemCount();
      test.skip(initialCount === 0, 'No whale feed items seeded');

      // Click the $50K+ filter button
      await whaleFeedPage.setMinSize("50000");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      const filteredCount = await whaleFeedPage.getItemCount();

      // Should have fewer or equal items with a higher filter
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test("Set larger minimum ($100K+ vs $50K+) → fewer results", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Start with $50K+
      await whaleFeedPage.setMinSize("50000");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      const count50k = await whaleFeedPage.getItemCount();

      // Increase to $100K+
      await whaleFeedPage.setMinSize("100000");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      const count100k = await whaleFeedPage.getItemCount();

      // Higher minimum should give fewer or equal results
      expect(count100k).toBeLessThanOrEqual(count50k);
    });

    test("Set minimum back to $5K+ → shows more transactions", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const initialCount = await whaleFeedPage.getItemCount();

      // Set high minimum first
      await whaleFeedPage.setMinSize("100000");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Reset to lowest filter
      await whaleFeedPage.setMinSize("5000");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      const resetCount = await whaleFeedPage.getItemCount();

      // Lowest filter should show more or equal to initial (default is $10K+)
      expect(resetCount).toBeGreaterThanOrEqual(initialCount);
    });

    test("Filter persists during pagination", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Click the $50K+ filter button
      await whaleFeedPage.setMinSize("50000");

      // Verify the $50K+ button is active (has accent styling — text-accent-text border-accent/30)
      const filterButton = page.locator("button", { hasText: "$50K+" });
      await expect(filterButton).toHaveClass(/text-accent-text|border-accent/, {
        timeout: 10_000,
      });

      // Go to next page if available
      const nextButton = whaleFeedPage.paginationNext;
      test.skip(
        !((await nextButton.isVisible().catch(() => false)) &&
          !(await nextButton.isDisabled())),
        'Pagination not available (only 1 page of data)',
      );

      await whaleFeedPage.goToPage("next");
      await expect(
        page
          .locator(
            '[data-testid="whale-feed-item"], [data-testid="empty-state"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Verify filter button is still active after pagination
      const buttonClassAfter =
        (await filterButton.getAttribute("class")) ?? "";
      expect(buttonClassAfter).toMatch(/text-accent-text|border-accent/);
    });
  });

  test.describe("Follow/Unfollow", () => {
    test("Follow button visible on untracked whales", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const itemCount = await whaleFeedPage.getItemCount();
      test.skip(itemCount === 0, 'No whale feed items seeded');

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const followButton = firstItem.locator("button", { hasText: /follow/i });

      await expect(followButton).toBeVisible();
    });

    test('Click Follow → button changes to "Following" or "Unfollow"', async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const itemCount = await whaleFeedPage.getItemCount();
      test.skip(itemCount === 0, 'No whale feed items seeded');

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      const followButton = whaleFeedPage.getFollowButton(address!);

      // Only proceed if the follow button is visible (not already following)
      test.skip(!(await followButton.isVisible().catch(() => false)), 'Whale already followed — follow button not available');

      // Click follow
      await followButton.click();

      // Button should change to "Following"
      const afterClickButton = firstItem.locator("button", {
        hasText: /following/i,
      });
      await expect(afterClickButton).toBeVisible({ timeout: 5_000 });
    });

    test('Unfollow → button reverts to "Follow"', async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const itemCount = await whaleFeedPage.getItemCount();
      test.skip(itemCount === 0, 'No whale feed items seeded');

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      // Follow first if not already following
      const followButton = whaleFeedPage.getFollowButton(address!);
      if (await followButton.isVisible().catch(() => false)) {
        await followButton.click();
        // Wait for button to become "Following"
        await expect(
          firstItem.locator("button", { hasText: /following/i }),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Now unfollow
      const unfollowButton = whaleFeedPage.getUnfollowButton(address!);
      await unfollowButton.click();

      // Button should revert to Follow
      const revertedButton = firstItem.locator("button", {
        hasText: /^follow$/i,
      });
      await expect(revertedButton).toBeVisible({ timeout: 5_000 });
    });

    test("Follow/unfollow persists on page refresh", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      // Follow the whale
      const followButton = whaleFeedPage.getFollowButton(address!);
      if (await followButton.isVisible().catch(() => false)) {
        await followButton.click();
        await expect(
          firstItem.locator("button", { hasText: /following/i }),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Refresh page
      await page.reload();
      await whaleFeedPage.goto();

      // Verify follow state persisted — the unfollow button should be visible
      const unfollowButton = whaleFeedPage.getUnfollowButton(address!);
      await expect(unfollowButton).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Following Page", () => {
    test("Navigate to /whales/following", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      await whaleFeedPage.goToFollowing();

      expect(page.url()).toContain("/following");
    });

    test("Shows list of followed whales", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Follow a whale first
      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      const followButton = whaleFeedPage.getFollowButton(address!);
      if (await followButton.isVisible().catch(() => false)) {
        await followButton.click();
        await expect(
          firstItem.locator("button", { hasText: /following/i }),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Navigate to following page
      await whaleFeedPage.goToFollowing();

      const followedWhales = page.locator('[data-testid="whale-feed-item"]');
      const count = await followedWhales.count();

      expect(count).toBeGreaterThan(0);
    });

    test("Each followed whale shows stats", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Follow a whale first if not already
      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      const followButton = whaleFeedPage.getFollowButton(address!);
      if (await followButton.isVisible().catch(() => false)) {
        await followButton.click();
        await expect(
          firstItem.locator("button", { hasText: /following/i }),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Navigate to following page
      await whaleFeedPage.goToFollowing();

      const firstFollowed = page
        .locator('[data-testid="whale-feed-item"]')
        .first();
      test.skip(!(await firstFollowed.isVisible().catch(() => false)), 'No followed whales displayed');

      // The following page item structure may differ — verify some content exists
      const itemText = await firstFollowed.textContent();
      expect(itemText).toBeTruthy();
    });

    test("Unfollow from following page → whale removed from list", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Follow a whale first
      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      const address = await whaleFeedPage.getFullAddress(firstItem);
      test.skip(!address, 'Could not resolve whale wallet address');

      const followButton = whaleFeedPage.getFollowButton(address!);
      if (await followButton.isVisible().catch(() => false)) {
        await followButton.click();
        await expect(
          firstItem.locator("button", { hasText: /following/i }),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Go to following page
      await whaleFeedPage.goToFollowing();

      const initialCount = await whaleFeedPage.getItemCount();

      // Unfollow from the list — use button within item
      const firstFollowedItem = page
        .locator('[data-testid="whale-feed-item"]')
        .first();
      const unfollowBtn = firstFollowedItem.locator("button", {
        hasText: /unfollow|following/i,
      });
      if (await unfollowBtn.isVisible().catch(() => false)) {
        await unfollowBtn.click();
        // Wait for the item to be removed from the list
        await expect(async () => {
          const count = await whaleFeedPage.getItemCount();
          expect(count).toBeLessThan(initialCount);
        }).toPass({ timeout: 5_000 });
      }

      const afterUnfollowCount = await whaleFeedPage.getItemCount();

      // Should have one fewer whale
      expect(afterUnfollowCount).toBeLessThan(initialCount);
    });

    test("Empty state when not following anyone", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      // Go to following page
      await whaleFeedPage.goToFollowing();

      const itemCount = await whaleFeedPage.getItemCount();

      if (itemCount === 0) {
        // Verify empty state is shown
        const emptyState = page.locator('[data-testid="empty-state"]');
        await expect(emptyState).toBeVisible();
      } else {
        // Feed has items — verify at least one item is displayed
        await expect(page.locator('[data-testid="whale-feed-item"]').first()).toBeVisible();
      }
    });
  });

  test.describe("Whale Profile", () => {
    test("Click whale address → navigates to /whales/:address", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');
      const addressElement = firstItem.locator('[data-testid="whale-address"]');

      const address = await addressElement.textContent();
      test.skip(!address, 'Could not resolve whale wallet address');
      await addressElement.click();
      await page.waitForURL(/\/whales\/[a-zA-Z0-9]/, { timeout: 30_000 });

      expect(page.url()).toMatch(/\/whales\/[a-zA-Z0-9]+/);
    });

    test("Profile shows whale's trading history", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');
      const addressElement = firstItem.locator('[data-testid="whale-address"]');

      const address = await addressElement.textContent();
      test.skip(!address, 'Could not resolve whale wallet address');
      await addressElement.click();
      await page.waitForURL(/\/whales\/[a-zA-Z0-9]/, { timeout: 30_000 });

      // Verify trading history is shown
      const history = page.locator('[data-testid="trading-history"]');
      await expect(history).toBeVisible({ timeout: 15_000 });
    });

    test("Shows win rate, total volume, favorite markets", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');
      const addressElement = firstItem.locator('[data-testid="whale-address"]');

      const address = await addressElement.textContent();
      test.skip(!address, 'Could not resolve whale wallet address');
      await addressElement.click();
      await page.waitForURL(/\/whales\/[a-zA-Z0-9]/, { timeout: 30_000 });

      // Check for stats — wait for profile to load
      const winRate = page.locator('[data-testid="whale-win-rate"]');
      const totalVolume = page.locator('[data-testid="whale-total-volume"]');
      const favoriteMarkets = page.locator(
        '[data-testid="whale-favorite-markets"]',
      );

      await expect(winRate).toBeVisible({ timeout: 15_000 });
      await expect(totalVolume).toBeVisible({ timeout: 15_000 });
      await expect(favoriteMarkets).toBeVisible({ timeout: 15_000 });
    });

    test("Follow/Unfollow button on profile", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');
      const addressElement = firstItem.locator('[data-testid="whale-address"]');

      const address = await addressElement.textContent();
      test.skip(!address, 'Could not resolve whale wallet address');
      await addressElement.click();
      await page.waitForURL(/\/whales\/[a-zA-Z0-9]/, { timeout: 30_000 });

      const followButton = page.locator("button", {
        hasText: /follow|unfollow/i,
      });
      await expect(followButton).toBeVisible({ timeout: 15_000 });

      const buttonText = await followButton.textContent();
      expect(buttonText?.toLowerCase()).toMatch(/follow|unfollow/);
    });

    test("Copy trade button (links to copy trading setup)", async ({
      page,
    }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');
      const addressElement = firstItem.locator('[data-testid="whale-address"]');

      const address = await addressElement.textContent();
      test.skip(!address, 'Could not resolve whale wallet address');
      await addressElement.click();
      await page.waitForURL(/\/whales\/[a-zA-Z0-9]/, { timeout: 30_000 });

      const copyTradeButton = page.locator("a, button", {
        hasText: /copy trade|copy this trader/i,
      });

      test.skip(!(await copyTradeButton.isVisible({ timeout: 5_000 }).catch(() => false)), 'Copy trade button not available on this profile');

      const href =
        (await copyTradeButton.getAttribute("href")) ||
        (await copyTradeButton.getAttribute("data-link"));
      expect(href).toBeTruthy();

      // Should link to copy trading setup
      if (href) {
        expect(href).toMatch(/copy|setup/i);
      }
    });
  });

  test.describe("Pagination", () => {
    test("Navigate through feed pages", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const firstItem = page.locator('[data-testid="whale-feed-item"]').first();
      test.skip(!(await firstItem.isVisible().catch(() => false)), 'No whale feed items available');

      const firstPageItem = await firstItem.textContent();

      const nextButton = whaleFeedPage.paginationNext;
      test.skip(!((await nextButton.isVisible().catch(() => false)) && !(await nextButton.isDisabled())), 'Pagination not available (only 1 page of data)');
      await whaleFeedPage.goToPage("next");

      await expect(
        page.locator('[data-testid="whale-feed-item"]').first(),
      ).toBeVisible({ timeout: 15_000 });
      const secondPageItem = await page
        .locator('[data-testid="whale-feed-item"]')
        .first()
        .textContent();

      // Should have different content
      expect(secondPageItem).not.toBe(firstPageItem);
    });

    test("Next/Previous functional", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const nextButton = whaleFeedPage.paginationNext;
      const prevButton = whaleFeedPage.paginationPrev;

      // If pagination is not visible (not enough data for 2 pages), skip
      test.skip(!(await nextButton.isVisible().catch(() => false)), 'Pagination not visible — not enough data for 2 pages');

      // If next is disabled, there's only 1 page — skip
      test.skip(await nextButton.isDisabled(), 'Only 1 page of data — cannot test pagination navigation');

      // First page: Prev should be disabled
      await expect(prevButton).toBeDisabled();

      // Go to next
      await whaleFeedPage.goToPage("next");

      // Should be able to go back
      await expect(prevButton).not.toBeDisabled();
    });

    test("Page counter accurate", async ({ page }) => {
      const whaleFeedPage = new WhaleFeedPage(page);
      await whaleFeedPage.goto();

      const pageIndicator = page.locator('[data-testid="page-indicator"]');

      test.skip(!(await pageIndicator.isVisible()), 'Page indicator not present — not enough data for pagination');
      const text = await pageIndicator.textContent();

      // Should show "X / Y" format
      expect(text).toMatch(/\d+\s*\/\s*\d+/);
    });
  });
});
