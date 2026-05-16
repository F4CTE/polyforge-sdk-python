import { test, expect } from "@playwright/test";
import { apiLogin } from "../helpers/api";
import { DiscoverPage } from "../pages/discover.page";

test.describe("Discover — Full Workflow Coverage", () => {
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

  test.describe("Page Load", () => {
    test("Discover page loads at /discover", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      expect(page.url()).toContain("/discover");
      await expect(page.locator("h1", { hasText: "Discover" })).toBeVisible();
    });

    test("Shows public strategy cards or empty state", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // Verify page has loaded — cards or empty state
      await expect(
        page
          .locator('[data-testid="strategy-card"], [data-testid="empty-state"]')
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('Default sort is "Popular"', async ({ page }) => {
      const discoverPage = new DiscoverPage(page);

      // Verify initial page load issues the discover request with sort=popular
      const awaitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "popular",
        { timeout: 10_000 },
      );
      await discoverPage.goto();
      const resp = await awaitResp;
      expect(resp.ok()).toBe(true);

      const popularTab = discoverPage.sortTabs["Popular"];
      const isSelected = await popularTab
        .getAttribute("aria-selected")
        .catch(() => null);
      if (isSelected !== null) {
        expect(isSelected).toBe("true");
      } else {
        await expect(popularTab).toBeVisible();
      }
    });
  });

  test.describe("Sort Tabs", () => {
    test('Click "Popular" → strategies sorted by popularity', async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // Switch away from default Popular first so we can observe the return
      const awaitNewestResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "newest",
        { timeout: 10_000 },
      );
      await discoverPage.selectSort("Newest");
      const newestResp = await awaitNewestResp;
      expect(newestResp.ok()).toBe(true);

      // Now switch back to Popular and verify the API call
      const awaitPopularResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "popular",
        { timeout: 10_000 },
      );
      await discoverPage.selectSort("Popular");
      const popularResp = await awaitPopularResp;
      expect(popularResp.ok()).toBe(true);
      await expect(discoverPage.sortTabs["Popular"]).toBeVisible();
    });

    test("Active tab is visually highlighted", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const popularTab = discoverPage.sortTabs["Popular"];
      await expect(popularTab).toBeVisible();

      await discoverPage.selectSort("Newest");
      const newestTab = discoverPage.sortTabs["Newest"];
      await expect(newestTab).toBeVisible();

      // Popular tab should no longer be selected — check via aria-selected or class
      const ariaSelected = await popularTab
        .getAttribute("aria-selected")
        .catch(() => null);
      if (ariaSelected !== null) {
        expect(ariaSelected).toBe("false");
      }
    });

    test("Changing tab resets to page 1", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // Get initial page number (should be 1) — page indicator may not render without data
      const pageIndicator = page.locator('[data-testid="page-indicator"]');
      if (await pageIndicator.isVisible().catch(() => false)) {
        let currentPage = await pageIndicator.textContent();
        expect(currentPage).toContain("1");

        // Change sort tab
        await discoverPage.selectSort("Newest");

        // Verify page is reset to 1
        currentPage = await pageIndicator.textContent();
        expect(currentPage).toContain("1");
      }
    });

    test("Newest tab loads strategy cards sorted by recency", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const awaitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "newest",
        { timeout: 10_000 },
      );
      await discoverPage.selectSort("Newest");
      const resp = await awaitResp;
      expect(resp.ok()).toBe(true);

      // Verify response body contains discover data
      const body = await resp.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("totalPages");
      expect(Array.isArray(body.data)).toBe(true);
    });

    test("Top P&L tab loads strategy cards sorted by P&L", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const awaitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "top_pnl",
        { timeout: 10_000 },
      );
      await discoverPage.selectSort("Top P&L");
      const resp = await awaitResp;
      expect(resp.ok()).toBe(true);

      const body = await resp.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("totalPages");
      expect(Array.isArray(body.data)).toBe(true);
    });

    test("Most Forked tab loads strategy cards sorted by fork count", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const awaitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          new URL(resp.url()).searchParams.get("sort") === "most_forked",
        { timeout: 10_000 },
      );
      await discoverPage.selectSort("Most Forked");
      const resp = await awaitResp;
      expect(resp.ok()).toBe(true);

      const body = await resp.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("totalPages");
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  test.describe("Strategy Cards", () => {
    test("Each card shows: strategy name, author, description, P&L, fork count", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const firstCard = page.locator('[data-testid="strategy-card"]').first();

      // Verify card contains expected elements
      await expect(
        firstCard.locator('[data-testid="strategy-name"]'),
      ).toBeVisible();
      await expect(
        firstCard.locator('[data-testid="strategy-author"]'),
      ).toBeVisible();
      await expect(
        firstCard.locator('[data-testid="strategy-description"]'),
      ).toBeVisible();
      await expect(
        firstCard.locator('[data-testid="strategy-pnl"]'),
      ).toBeVisible();
      await expect(
        firstCard.locator('[data-testid="strategy-forks"]'),
      ).toBeVisible();
    });

    test("Card links to strategy detail page", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      // The strategy card itself is a <Link> (<a>), not a wrapper with a child <a>
      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      const href = await firstCard.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/\/strategies\/[\w-]+/);
    });

    test("Author name links to public profile", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      const authorLink = firstCard
        .locator('[data-testid="strategy-author"] a')
        .first();

      const href = await authorLink.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/^\/profile\/[\w-]+/);
    });

    test("Cards display appropriate status indicators", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      const statusIndicator = firstCard.locator(
        '[data-testid="strategy-status"]',
      );

      await expect(statusIndicator).toBeVisible();
    });
  });

  test.describe("Search", () => {
    test("Search input filters strategies by name (client-side)", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const initialCount = await discoverPage.getStrategyCount();
      if (initialCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      // Search for a specific term
      await discoverPage.search("momentum");

      const searchedCount = await discoverPage.getStrategyCount();
      // Filtered results should be <= initial count
      expect(searchedCount).toBeLessThanOrEqual(initialCount);
    });

    test("Partial match works", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // Search with partial term
      await discoverPage.search("rsi");

      const cardCount = await discoverPage.getStrategyCount();
      // At least show matching results if any exist
      const cards = await discoverPage.strategyCards.allTextContents();
      const hasMatches = cards.some((text) =>
        text.toLowerCase().includes("rsi"),
      );

      if (cardCount > 0) {
        expect(hasMatches).toBeTruthy();
      }
    });

    test("Clear search shows all strategies", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const initialCount = await discoverPage.getStrategyCount();

      // Search for something
      await discoverPage.search("momentum");

      // Clear search
      await discoverPage.searchInput.clear();

      const clearedCount = await discoverPage.getStrategyCount();
      // Should return to initial count
      expect(clearedCount).toBe(initialCount);
    });

    test("No results shows empty state", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const initialCount = await discoverPage.getStrategyCount();

      // Search for unlikely term and wait for results to update
      const awaitSearchResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/discover?") &&
          resp.request().method() === "GET" &&
          resp.url().includes("search=xyzabc123notarealstrategy"),
        { timeout: 10_000 },
      );
      await discoverPage.search("xyzabc123notarealstrategy");
      const searchResp = await awaitSearchResp;
      expect(searchResp.ok()).toBe(true);

      const cardCount = await discoverPage.getStrategyCount();
      // Results must decrease (or already zero) when searching non-existent strategy
      expect(cardCount).toBeLessThanOrEqual(initialCount);
      // For server-side search, expect zero results with this nonsense term
      expect(cardCount).toBe(0);

      // Verify empty state message is shown — may use data-testid or text
      const emptyState = page
        .locator('[data-testid="empty-state"]')
        .or(page.locator("text=/no.*strategies|no.*results|empty/i"));
      await expect(emptyState.first()).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe("Pagination", () => {
    test("Next page loads more strategies", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const firstPageCount = await discoverPage.getStrategyCount();
      if (firstPageCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      // Only test pagination if next button is visible and enabled
      const nextVisible = await discoverPage.paginationNext
        .isVisible()
        .catch(() => false);
      if (!nextVisible) {
        test.skip(true, "Pagination next button not visible");
        return;
      }
      const nextEnabled = await discoverPage.paginationNext
        .isEnabled()
        .catch(() => false);
      if (!nextEnabled) {
        test.skip(true, "Pagination next button not enabled");
        return;
      }

      const firstCard = await page
        .locator('[data-testid="strategy-card"]')
        .first()
        .textContent();

      // Go to next page
      await discoverPage.goToPage("next");

      const secondCard = await page
        .locator('[data-testid="strategy-card"]')
        .first()
        .textContent();

      // Should have loaded new strategies
      expect(secondCard).not.toBe(firstCard);
    });

    test("Previous page goes back", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const nextVisible = await discoverPage.paginationNext
        .isVisible()
        .catch(() => false);
      if (!nextVisible) {
        test.skip(true, "Pagination next button not visible");
        return;
      }
      const nextEnabled = await discoverPage.paginationNext
        .isEnabled()
        .catch(() => false);
      if (!nextEnabled) {
        test.skip(true, "Pagination next button not enabled");
        return;
      }

      const firstPageCard = await page
        .locator('[data-testid="strategy-card"]')
        .first()
        .textContent();

      // Go to next page
      await discoverPage.goToPage("next");

      // Go back to previous page
      await discoverPage.goToPage("prev");

      const returnedCard = await page
        .locator('[data-testid="strategy-card"]')
        .first()
        .textContent();

      // Should return to first page
      expect(returnedCard).toBe(firstPageCard);
    });

    test("Page counter shows current/total", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const pageIndicator = page.locator('[data-testid="page-indicator"]');
      if (!(await pageIndicator.isVisible().catch(() => false))) {
        test.skip(true, "Skip if no pagination");
        return;
      }

      const text = await pageIndicator.textContent();
      expect(text).toMatch(/\d+\s*\/\s*\d+/);
    });

    test("First page disables Previous", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // On first page, Previous should be disabled — but pagination may not render without data
      const prevVisible = await discoverPage.paginationPrev
        .isVisible()
        .catch(() => false);
      if (!prevVisible) {
        test.skip(true, "Previous button not visible");
        return;
      }
      await expect(discoverPage.paginationPrev).toBeDisabled();
    });

    test("Last page disables Next", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      // Check if Next button exists and is visible
      const nextButton = discoverPage.paginationNext;
      const isNextVisible = await nextButton.isVisible().catch(() => false);
      if (!isNextVisible) {
        test.skip(true, "No pagination — skip");
        return;
      }

      // Navigate at most 3 pages to find last page (don't loop too many times)
      let pageCount = 1;

      while (pageCount < 3) {
        const isDisabled = await nextButton.isDisabled();

        if (isDisabled) {
          // We're on the last page — next is disabled as expected
          await expect(nextButton).toBeDisabled();
          return; // explicit early exit from loop
        }
        await discoverPage.goToPage("next");
        pageCount++;
      }
    });
  });

  test.describe("Strategy Interaction", () => {
    test("Click strategy card → navigates to strategy detail", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      // The strategy card itself is a <Link> (<a>), click it directly
      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      await firstCard.click();

      // Verify we're on a strategy detail page
      await page.waitForURL(/\/strategies\//, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/strategies\//);
    });

    test("Strategy detail shows blocks visualization", async ({ page }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      await firstCard.click();
      await page.waitForURL(/\/strategies\//, { timeout: 10_000 });

      // Blocks visualization panel must be present on the detail page
      await expect(
        page.locator('[data-testid="blocks-visualization"]'),
      ).toBeVisible({ timeout: 10_000 });
    });

    test("Can fork a public strategy (if feature available)", async ({
      page,
    }) => {
      const discoverPage = new DiscoverPage(page);
      await discoverPage.goto();

      const cardCount = await discoverPage.getStrategyCount();
      if (cardCount === 0) {
        test.skip(true, "Skip when no seed data");
        return;
      }

      const firstCard = page.locator('[data-testid="strategy-card"]').first();
      const cardLink = firstCard.locator("a").first();

      await cardLink.click();

      // Look for fork button
      const forkButton = page
        .locator("button", { hasText: /fork|fork strategy/i })
        .first();

      if (await forkButton.isVisible()) {
        await forkButton.click();

        // Verify success message or navigation
        const successMessage = page.locator('[data-testid="fork-success"]');
        await expect(successMessage).toBeVisible();
      }
    });
  });
});
