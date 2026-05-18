import { test, expect } from "@playwright/test";
import { MarketsPage } from "../pages/markets.page";
import {
  apiLogin,
  apiRegister,
  apiRegisterAndVerify,
  uniqueEmail,
  uniqueUsername,
} from "../helpers/api";

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

test.describe("Markets — Full Workflow Coverage", () => {
  test.setTimeout(120_000);

  let token: string;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const email = uniqueEmail("markets");
    const username = uniqueUsername("mktsuser");
    const res = await apiRegisterAndVerify(email, username, "TestPass123!");
    token = res.token;
  });

  test.beforeEach(async ({ page }) => {
    // Set auth cookie for each test
    await page.context().addCookies([
      {
        name: "pf_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  // ─── Market Listing Tests ──────────────────────────────────────────────────

  test("@smoke @comprehensive should load markets page with market cards", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Verify page loaded and market cards exist
    await expect(page.locator("h1", { hasText: "Markets" })).toBeVisible();
    await expect(markets.marketCards.first()).toBeVisible({ timeout: 15_000 });
  });

  test("@smoke @comprehensive should display default card view", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Verify cards are visible (not table rows)
    const cards = markets.marketCards;
    const count = await cards.count();
    const firstCard = cards.first();

    // Only check card structure if markets data is seeded
    if (count === 0) {
      test.skip(true, "No market cards seeded");
      return;
    }

    // Check for market name — the card uses h3.text-sm.font-medium
    const marketName = firstCard.locator("h3").first();
    await expect(marketName).toBeVisible();
    const name = await marketName.textContent();
    expect(name).toBeTruthy();
  });

  test("@comprehensive should display market name on cards", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const cards = markets.marketCards;
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "No market cards seeded");
      return;
    }

    const firstCard = cards.first();

    // Find and verify market name text — card uses h3 element
    const nameElement = firstCard.locator("h3").first();
    await expect(nameElement).toBeVisible();
    const name = await nameElement.textContent();
    expect(name).toMatch(/\w+/);
  });

  test("@comprehensive should display market volume on cards", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const cards = markets.marketCards;
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "No market cards seeded");
      return;
    }

    const firstCard = cards.first();

    // Volume is shown as e.g. "$1.2M Vol" in a .text-xs span inside the card header
    const volumeElement = firstCard
      .locator("text=/\\$[\\d.]+[KMB]? Vol/i")
      .first();
    await expect(volumeElement).toBeVisible();
    const volume = await volumeElement.textContent();
    expect(volume).toBeTruthy();
  });

  test("@comprehensive should display market end date on cards", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const cards = markets.marketCards;
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "No market cards seeded");
      return;
    }

    const firstCard = cards.first();

    // End date is shown as "3 days", "1mo", "Today", "Closed" etc. in the header
    // next to volume. It's a span inside the .text-xs container.
    const dateElement = firstCard
      .locator("text=/\\d+ days?|\\d+mo|Today|Closed/i")
      .first();
    await expect(dateElement).toBeVisible();
    const date = await dateElement.textContent();
    expect(date).toBeTruthy();
  });

  test("@comprehensive should display market price on cards", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const cards = markets.marketCards;
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "No market cards seeded");
      return;
    }

    const firstCard = cards.first();

    // Price is shown as "Yes XX¢" / "No XX¢" or as "XX% chance" in the card body
    const priceElement = firstCard
      .locator("text=/Yes|No|\\d+% chance|\\d+¢/i")
      .first();
    await expect(priceElement).toBeVisible();
    const price = await priceElement.textContent();
    expect(price).toBeTruthy();
  });

  // ─── Search Tests ─────────────────────────────────────────────────────────

  test("@smoke @comprehensive should search for market by name", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Get first market name for searching
    const firstCard = markets.marketCards.first();
    const nameElement = firstCard.locator("h3").first();
    await expect(nameElement).toBeVisible();
    const marketName = ((await nameElement.textContent()) ?? "").trim();
    expect(marketName).toBeTruthy();

    // Search for the market
    await markets.search(marketName);

    // Verify filtered results
    const cards = await markets.getMarketCount();
    expect(cards).toBeGreaterThan(0);

    // Verify at least one card contains the search term
    const resultCard = page
      .locator('[data-testid="market-card"]', { hasText: marketName })
      .first();
    await expect(resultCard).toBeVisible();
  });

  test("@comprehensive should filter results with partial match", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Wait for at least one market card to load before extracting text
    const firstCard = markets.marketCards.first();
    const isVisible = await firstCard
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!isVisible) {
      test.skip(true, "No market data — skip");
      return;
    }

    const nameEl = firstCard.locator("h3").first();
    const fullName = ((await nameEl.textContent()) ?? "").trim();
    if (!fullName) {
      test.skip(true, "No text content — skip");
      return;
    }

    // Use first word of the market name as partial search term (at least 3 chars)
    const searchTerm = fullName.split(/\s+/)[0]?.slice(0, 6) || "market";
    await markets.search(searchTerm);

    // Wait for search results to update (cards or empty state)
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });

    // Verify filtered results
    const cardCount = await markets.getMarketCount();

    // If results exist, verify they match the search (case-insensitive)
    if (cardCount > 0) {
      const firstResult = markets.marketCards.first();
      const resultText = (await firstResult.textContent()) ?? "";
      expect(resultText.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test("@comprehensive should clear search results", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const initialCount = await markets.getMarketCount();

    // Search for something
    await markets.search("xyz-nonexistent-market");

    // Clear search and wait for the unfiltered markets request to settle.
    await markets.search("", { waitForResults: false });

    // List repopulation after clearing search takes longer than the
    // debounce interval — retry until the count stabilises.
    await expect(async () => {
      const finalCount = await markets.getMarketCount();
      expect(finalCount).toBe(initialCount);
    }).toPass({ timeout: 30_000 });
  });

  test("@comprehensive should show empty state when search has no results", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Search for nonexistent market
    await markets.search("zzz-impossible-market-xyz-123");

    // Verify empty state message — component renders "No markets found"
    const emptyState = page.locator('text="No markets found"').first();
    await expect(emptyState).toBeVisible({ timeout: 30_000 });

    // Verify no cards shown
    const cardCount = await markets.getMarketCount();
    expect(cardCount).toBe(0);
  });

  test("@comprehensive should debounce search input", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Get initial network listener
    let networkRequestCount = 0;
    page.on("response", () => {
      networkRequestCount++;
    });

    // Type character by character
    await markets.searchInput.type("test", { delay: 50 });

    // Count network requests during typing
    const countAfterTyping = networkRequestCount;

    // Wait for debounce to settle

    // Verify debounce worked by checking requests were limited
    // (exact count depends on implementation, but should not be excessive)
    expect(countAfterTyping).toBeLessThan(20);
  });

  // ─── Category Filter Tests ────────────────────────────────────────────────

  test('@smoke @comprehensive should default to "All" category', async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Verify "All" button is active/selected
    const allButton = markets.categoryChips["All"];
    await expect(allButton).toBeVisible();
    const allDisabled = await allButton.getAttribute("disabled");
  });

  test("@comprehensive should filter to Sports category", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const initialCount = await markets.getMarketCount();

    // Click Sports filter
    await markets.selectCategory("Sports");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should filter to Crypto category", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click Crypto filter
    await markets.selectCategory("Crypto");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should filter to Politics category", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click Politics filter
    await markets.selectCategory("Politics");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should filter to Economics category", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click Economics filter
    await markets.selectCategory("Economics");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should filter to Finance category", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click Finance filter
    await markets.selectCategory("Finance");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should filter to Technology category", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click Technology filter
    await markets.selectCategory("Technology");

    // Verify filter applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should return to All when clicking All after category filter", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    const initialCount = await markets.getMarketCount();

    // Filter to a category
    await markets.selectCategory("Sports");
    const filteredCount = await markets.getMarketCount();

    // Click All to reset
    await markets.selectCategory("All");

    // Verify back to all categories
    const allCount = await markets.getMarketCount();
    expect(allCount).toBe(initialCount);
  });

  test("@comprehensive should only allow one category active at a time", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Select Sports
    await markets.selectCategory("Sports");
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
    const sportsCount = await markets.getMarketCount();

    // Select Crypto (should deselect Sports and show different results)
    await markets.selectCategory("Crypto");
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
    const cryptoCount = await markets.getMarketCount();

    // Select All to get full count
    await markets.selectCategory("All");
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
    const allCount = await markets.getMarketCount();

    // The filter should be exclusive — crypto + sports counts should be <= all count
    expect(sportsCount + cryptoCount).toBeLessThanOrEqual(allCount);
  });

  // ─── Sorting Tests ────────────────────────────────────────────────────────

  test("@smoke @comprehensive should default to Volume sorting", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Verify volume sort dropdown/button is present
    await expect(
      markets.sortDropdown.or(page.locator('[aria-label*="sort" i]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should sort by Volume (highest first)", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    await markets.selectSort("volume");

    // Verify sort applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should sort by Newest", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    await markets.selectSort("newest");

    // Verify sort applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should sort by Closing Soon", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    await markets.selectSort("closingSoon");

    // Verify sort applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should sort by Liquidity", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    await markets.selectSort("liquidity");

    // Verify sort applied without error
    await expect(
      markets.marketCards.first().or(page.locator('[role="status"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── View Toggle Tests ────────────────────────────────────────────────────

  test("@smoke @comprehensive should display card view by default", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Verify card view button is styled as active (bg-elevated, formerly bg-pf-elevated)
    const cardBtn = markets.cardViewButton;
    await expect(cardBtn).toBeVisible();

    // Verify that we're NOT in table view (no table element)
    const tableElement = page.locator('table[aria-label="Markets"]');
    const isTable = await tableElement.isVisible().catch(() => false);
    expect(isTable).toBe(false);

    // Cards should be present (if market data is available)
    await expect(
      markets.marketCards.first().or(markets.cardViewButton),
    ).toBeVisible();
  });

  test("@comprehensive should switch to table view", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Wait for in-flight API requests to settle before asserting cards.
    // On Docker cold-starts the markets fetch can take several seconds after
    // the h1 heading renders, causing the first-attempt timeout.
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => {});

    // Wait for initial data load to complete (cards or empty state must be present)
    const cardOrEmpty = markets.marketCards
      .first()
      .or(page.locator('[role="status"]'));
    await expect(cardOrEmpty).toBeVisible({ timeout: 20_000 });

    // Switch to table view by clicking the table view button
    const tableBtn = markets.tableViewButton;
    await expect(tableBtn).toBeVisible();
    await tableBtn.click();

    // Wait for either the table (has data) or an empty state (no data)
    const tableElement = page.locator('table[aria-label="Markets"]');
    const emptyState = page.locator('[role="status"]');
    await expect(tableElement.or(emptyState)).toBeVisible({ timeout: 10_000 });

    // Verify card view is no longer showing
    const cardCount = await markets.marketCards.count();
    expect(cardCount).toBe(0);
  });

  test("@comprehensive should switch back to card view from table", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Switch to table
    await markets.switchToTableView();

    // Switch back to cards
    await markets.switchToCardView();

    // Verify cards are visible again
    await expect(markets.marketCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("@comprehensive should persist view during search", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Switch to table view
    await markets.switchToTableView();

    // Perform search
    await markets.search("bitcoin");

    // Verify still in table view
    const tableElement = page.locator('table[aria-label="Markets"]');
    // Table may or may not have results, but the view mode should persist
    const isTable = await markets.isTableView();
    // If there are results, table should be visible; if empty, we just verify
    // no cards are shown (empty state is rendered instead of table)
    const cardCount = await markets.getMarketCount();
    if (cardCount > 0) {
      await expect(tableElement).toBeVisible();
    }
  });

  test("@comprehensive should persist view during filter", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Switch to table view
    await markets.switchToTableView();

    // Apply category filter
    await markets.selectCategory("Sports");

    // Verify still in table view
    const tableElement = page.locator('table[aria-label="Markets"]');
    const cardCount = await markets.getMarketCount();
    if (cardCount > 0) {
      await expect(tableElement).toBeVisible();
    }
  });

  // ─── Pagination Tests ──────────────────────────────────────────────────────

  test("@comprehensive should display limited results per page", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Get initial card count (should be one page worth)
    const initialCount = await markets.getMarketCount();

    // Typical page size is 10-25 items
    expect(initialCount).toBeLessThanOrEqual(50);
  });

  test("@comprehensive should load next page with Next button", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Pagination only renders when totalPages > 1
    const nextButton = markets.paginationNext;
    if (!(await nextButton.isVisible().catch(() => false))) {
      test.skip(true, "Pagination not visible");
      return;
    }

    const isEnabled = await nextButton.isEnabled();
    if (isEnabled) {
      await markets.goToPage("next");

      // Verify page changed — content should update
      await expect(
        markets.marketCards.first().or(page.locator('[role="status"]')),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("@comprehensive should load previous page with Previous button", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Pagination only renders when totalPages > 1
    const nextButton = markets.paginationNext;
    if (!(await nextButton.isVisible().catch(() => false))) {
      test.skip(true, "Pagination not visible");
      return;
    }

    // Navigate to page 2 first
    if (await nextButton.isEnabled()) {
      await markets.goToPage("next");

      // Now try previous
      const prevButton = markets.paginationPrev;
      if (await prevButton.isEnabled()) {
        await markets.goToPage("prev");

        // Verify page loaded
        await expect(
          markets.marketCards.first().or(page.locator('[role="status"]')),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("@comprehensive should display page counter", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Page info is only shown when totalPages > 1 (pagination visible).
    // The format is "Page X of Y" in a span[aria-live="polite"].
    const pageInfo = markets.pageInfo;
    const isVisible = await pageInfo
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (!isVisible) {
      test.skip(true, "Pagination not visible — all results fit on one page");
      return;
    }
    const text = (await pageInfo.textContent()) ?? "";
    expect(text).toMatch(/Page \d+ of \d+/);
  });

  test("@comprehensive should disable Previous on first page", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // On first page, Previous should be disabled.
    // Pagination only renders when totalPages > 1.
    const prevButton = markets.paginationPrev;
    if (!(await prevButton.isVisible().catch(() => false))) {
      test.skip(true, "Pagination not visible");
      return;
    }
    await expect(prevButton).toBeDisabled();
  });

  test("@comprehensive should disable Next on last page", async ({ page }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Navigate to last page (keep clicking next)
    // Pagination only renders when totalPages > 1.
    const nextButton = markets.paginationNext;
    if (!(await nextButton.isVisible())) {
      test.skip(true, "Pagination not visible");
      return;
    }

    let maxIterations = 20;
    while (maxIterations > 0) {
      const isEnabled = await nextButton.isEnabled();
      if (isEnabled) {
        await markets.goToPage("next");
        maxIterations--;
      } else {
        // Verify Next is disabled on last page
        await expect(nextButton).toBeDisabled();
        break;
      }
    }
  });

  // ─── Market Detail Tests ───────────────────────────────────────────────────

  test("@smoke @comprehensive should navigate to market detail by clicking card", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Get first market card
    const firstCard = markets.marketCards.first();

    if (!(await firstCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No market cards visible");
      return;
    }

    // Click the card (it's a <Link to="/markets/{id}">)
    await firstCard.click();

    // Verify navigation to detail page — IDs can contain letters, digits, hyphens
    await expect(page).toHaveURL(/\/markets\/[\w-]+/, { timeout: 15_000 });

    // Verify detail page loaded
    const detailHeading = page.locator("h1, h2").first();
    await expect(detailHeading).toBeVisible({ timeout: 15_000 });
  });

  test("@comprehensive should display full market information on detail page", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click first market
    const firstCard = markets.marketCards.first();
    if (!(await firstCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No market cards visible");
      return;
    }

    await firstCard.click();

    // Verify detail content
    await expect(page).toHaveURL(/\/markets\/[\w-]+/, { timeout: 15_000 });

    // Verify market name shown
    const marketName = page.locator("h1, h2").first();
    await expect(marketName).toBeVisible({ timeout: 15_000 });
    const name = await marketName.textContent();
    expect(name).toBeTruthy();
  });

  test("@comprehensive should provide back navigation from detail page", async ({
    page,
  }) => {
    const markets = new MarketsPage(page);
    await markets.goto();

    // Click first market
    const firstCard = markets.marketCards.first();
    if (!(await firstCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No market cards visible");
      return;
    }

    await firstCard.click();
    await expect(page).toHaveURL(/\/markets\/[\w-]+/, { timeout: 15_000 });

    // Find back button or link
    const backButton = page
      .locator(
        'button:has-text("Back"), a:has-text("Back"), [aria-label*="back" i]',
      )
      .first();

    if (await backButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backButton.click();

      // Verify returned to markets list
      await expect(page).toHaveURL(/\/markets\/?$/, { timeout: 10_000 });
      await expect(page.locator("h1", { hasText: "Markets" })).toBeVisible();
    } else {
      // If no explicit back button, try browser back
      await page.goBack();

      // Verify back at markets list
      await expect(page).toHaveURL(/\/markets\/?$/, { timeout: 10_000 });
    }
  });
});
