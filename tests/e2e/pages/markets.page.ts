import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the Markets list page (/markets).
 *
 * Handles market search, filtering by category, sorting, view toggling,
 * and pagination across the market catalog.
 */
export class MarketsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly categoryChips: Record<string, Locator>;
  readonly sortDropdown: Locator;
  readonly cardViewButton: Locator;
  readonly tableViewButton: Locator;
  readonly marketCards: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    this.page = page;

    // The search input uses placeholder="Search markets..." and aria-label="Search markets"
    this.searchInput = page.locator('input[aria-label="Search markets"]');

    // Category chips — rendered as <Button> elements inside a scrollable row.
    // The "all" category renders display text "All". Each chip has the category
    // text alongside an icon. Use getByRole to scope to the category chip row.
    const chipRow = page.locator(".flex.gap-2.overflow-x-auto");
    this.categoryChips = {
      All: chipRow.getByRole("button", { name: /^All$/i }),
      Sports: chipRow.getByRole("button", { name: /Sports/i }),
      Crypto: chipRow.getByRole("button", { name: /Crypto/i }),
      Politics: chipRow.getByRole("button", { name: /Politics/i }),
      Economics: chipRow.getByRole("button", { name: /Economics/i }),
      Finance: chipRow.getByRole("button", { name: /Finance/i }),
      Technology: chipRow.getByRole("button", { name: /Technology/i }),
    };

    // Sort dropdown is a native <select> element with id="sort-select"
    this.sortDropdown = page.locator("select#sort-select");

    // View toggle: two separate buttons with aria-labels
    this.cardViewButton = page.getByRole("button", { name: "Card view" });
    this.tableViewButton = page.getByRole("button", { name: "Table view" });

    // Market cards use data-testid="market-card" on <Link> elements
    this.marketCards = page.locator('[data-testid="market-card"]');

    // Pagination buttons
    this.paginationPrev = page.getByRole("button", { name: "Previous page" });
    this.paginationNext = page.getByRole("button", { name: "Next page" });

    // Page info: <span aria-live="polite">Page X of Y</span>
    this.pageInfo = page.locator('span[aria-live="polite"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/markets");
    await expect(this.page.locator("h1", { hasText: "Markets" })).toBeVisible({
      timeout: 15_000,
    });
    await this.waitForResults();
  }

  async search(
    term: string,
    options: { waitForResults?: boolean } = {},
  ): Promise<void> {
    const response =
      (options.waitForResults ?? true)
        ? this.waitForMainMarketsResponse((params) =>
            term ? params.get("search") === term : !params.has("search"),
          )
        : null;
    await this.searchInput.clear();
    await this.searchInput.fill(term);
    if (response) {
      await response;
      await this.waitForResults();
    }
  }

  async selectCategory(
    category:
      | "All"
      | "Sports"
      | "Crypto"
      | "Politics"
      | "Economics"
      | "Finance"
      | "Technology",
  ): Promise<void> {
    // No-op guard: clicking the already-active category does not trigger a
    // new fetch, so skip the network wait and just verify results are visible.
    const chip = this.categoryChips[category];
    const isActive = await chip
      .evaluate((el) => el.classList.contains("bg-accent-subtle"))
      .catch(() => false);
    if (isActive) {
      await this.waitForResults();
      return;
    }

    const responsePromise = this.waitForMainMarketsResponse((params) => {
      if (category === "All") return !params.has("category");
      return params.get("category") === category;
    });
    await chip.click();
    await responsePromise;
    await this.waitForResults();
  }

  async selectSort(
    sort: "volume" | "newest" | "closingSoon" | "liquidity",
  ): Promise<void> {
    // The sort dropdown is a native <select> element. Use selectOption().
    // Map the test keys to the actual <option> values used by the component.
    const sortMap: Record<string, string> = {
      volume: "volume",
      newest: "newest",
      closingSoon: "closing_soon",
      liquidity: "liquidity",
    };
    const optionValue = sortMap[sort];
    // No-op guard: selecting the current sort does not trigger a new fetch.
    if ((await this.sortDropdown.inputValue()) === optionValue) {
      await this.waitForResults();
      return;
    }

    const responsePromise = this.waitForMainMarketsResponse(
      (params) => params.get("sort") === optionValue,
    );
    await this.sortDropdown.selectOption(optionValue);
    await responsePromise;
    await this.waitForResults();
  }

  async switchToCardView(): Promise<void> {
    await this.cardViewButton.click();
  }

  async switchToTableView(): Promise<void> {
    await this.tableViewButton.click();
  }

  /** @deprecated Use switchToCardView() or switchToTableView() instead */
  async toggleView(): Promise<void> {
    // Determine current view and toggle to the other
    // Active view button has bg-elevated class (renamed from bg-pf-elevated)
    const tableActive = await this.tableViewButton
      .evaluate(
        (el) =>
          el.classList.contains("bg-elevated") ||
          el.classList.contains("bg-pf-elevated"),
      )
      .catch(() => false);
    if (tableActive) {
      await this.switchToCardView();
    } else {
      await this.switchToTableView();
    }
  }

  async goToPage(direction: "next" | "prev"): Promise<void> {
    if (direction === "next") {
      await this.paginationNext.click();
    } else {
      await this.paginationPrev.click();
    }
  }

  getMarketCardByName(name: string): Locator {
    return this.page.locator('[data-testid="market-card"]', { hasText: name });
  }

  async getMarketCount(): Promise<number> {
    return await this.marketCards.count();
  }

  async getPageInfo(): Promise<string> {
    return (await this.pageInfo.textContent()) ?? "";
  }

  /** Check if currently in table view by looking for <table> element */
  async isTableView(): Promise<boolean> {
    return await this.page
      .locator('table[aria-label="Markets"]')
      .isVisible()
      .catch(() => false);
  }

  /** Check if currently in card view by checking market cards are visible */
  async isCardView(): Promise<boolean> {
    const count = await this.marketCards.count();
    return count > 0;
  }

  async waitForResults(timeout = 45_000): Promise<void> {
    // Wait for loading skeletons to disappear before checking content,
    // ensuring we don't pass on stale pre-action results that are still
    // visible before React flips to loading state.
    await this.page
      .locator(".animate-shimmer")
      .first()
      .waitFor({ state: "hidden", timeout })
      .catch(() => {});
    await expect(
      this.marketCards
        .first()
        .or(this.page.locator('table[aria-label="Markets"]'))
        .or(this.page.locator('main [role="status"]').first()),
    ).toBeVisible({ timeout });
  }

  private async waitForMainMarketsResponse(
    matches: (params: URLSearchParams) => boolean,
  ): Promise<void> {
    await this.page.waitForResponse(
      (resp) => {
        if (
          resp.request().method() !== "GET" ||
          !resp.url().includes("/api/v1/markets?")
        ) {
          return false;
        }
        try {
          const params = new URL(resp.url()).searchParams;
          return (
            resp.status() >= 200 &&
            resp.status() < 300 &&
            params.get("limit") === "25" &&
            matches(params)
          );
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    );
  }
}
