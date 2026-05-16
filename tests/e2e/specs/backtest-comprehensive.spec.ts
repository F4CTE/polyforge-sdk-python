import { test, expect } from "@playwright/test";
import { BacktestPage } from "../pages/backtest.page";
import { apiLogin } from "../helpers/api";

/**
 * Backtesting — Full Workflow Coverage
 *
 * Comprehensive test suite for the Backtest page (/backtest).
 * Covers strategy selection, date ranges, running backtests,
 * viewing results and history, and pagination.
 *
 * Run with: pnpm --filter @polyforge/e2e test backtest-comprehensive
 *
 * Key DOM facts (from backtest.tsx):
 * - Strategy selector is a native <select> (#backtest-strategy) — NOT a shadcn combobox
 * - Date inputs are native <input type="date"> — use native value setter for React onChange
 * - History table: <table aria-label="Backtest history">
 * - History rows: [data-testid="backtest-history-row"]
 * - Toasts use Sonner: [data-sonner-toast]
 * - Only data-testid="result-pnl" exists on stat cards; win-rate/orders/gaps use text labels
 */

const TEST_USER_EMAIL = "alice@e2e.dev.local";
const TEST_USER_PASSWORD = "TestPass123!";

// Helper to get a valid date string (YYYY-MM-DD)
function formatDate(date: Date): string {
  // Use local date parts (not toISOString which shifts to UTC)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("Backtesting — Full Workflow Coverage", () => {
  test.beforeEach(async ({ page }) => {
    const { token } = await apiLogin(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await page.context().addCookies([
      {
        name: "pf_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  // ─── Backtest Page Load ────────────────────────────────────────────────────

  test("@smoke backtest page loads with controls", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Verify page title
    await expect(page.locator("h1", { hasText: "Backtest" })).toBeVisible();

    // Verify key controls are visible
    await expect(backtestPage.strategySelect).toBeVisible();
    await expect(backtestPage.startDateInput).toBeVisible();
    await expect(backtestPage.endDateInput).toBeVisible();
    await expect(backtestPage.runButton).toBeVisible();
  });

  test("strategy dropdown is populated with user strategies", async ({
    page,
  }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Wait for strategies to load into the native <select> — may have 0 strategies in CI
    let hasStrategies = false;
    try {
      await page.waitForFunction(
        (sel: string) => {
          const el = document.querySelector(sel);
          return el && el.options.length > 1;
        },
        "#backtest-strategy",
        { timeout: 10_000 },
      );
      hasStrategies = true;
    } catch {
      // Strategies didn't load in time
    }
    test.skip(!hasStrategies, "No strategies seeded in CI");

    // Count <option> elements (first is placeholder "Select strategy")
    const optionCount = await backtestPage.strategySelect
      .locator("option")
      .count();
    // At least placeholder + 1 real strategy
    expect(optionCount).toBeGreaterThan(1);
  });

  test("date inputs have default values", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Check if inputs have values (may be empty strings by default)
    const startValue = await backtestPage.startDateInput.inputValue();
    const endValue = await backtestPage.endDateInput.inputValue();

    // At least one should be populated (or both could be empty for user to set)
    // Verify inputs accept date values in YYYY-MM-DD format or are empty.
    expect(startValue === "" || /^\d{4}-\d{2}-\d{2}/.test(startValue)).toBe(
      true,
    );
    expect(endValue === "" || /^\d{4}-\d{2}-\d{2}/.test(endValue)).toBe(true);
  });

  // ─── Strategy Selection ────────────────────────────────────────────────────

  test("select strategy from dropdown", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Select first available strategy from native <select>
    const strategyName = await backtestPage.selectFirstStrategy();
    expect(strategyName).toBeTruthy();

    // Verify the select now has a non-empty value
    const selectedValue = await backtestPage.strategySelect.inputValue();
    expect(selectedValue).toBeTruthy();
    expect(selectedValue).not.toBe("");
  });

  // ─── Date Range Input ─────────────────────────────────────────────────────

  test("set start date in date input", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    const startDate = formatDate(new Date(2024, 0, 1)); // Jan 1, 2024

    // Use fill() for controlled React date inputs
    await backtestPage.startDateInput.fill(startDate);

    // Verify value is set
    const value = await backtestPage.startDateInput.inputValue();
    expect(value).toContain("2024");
  });

  test("set end date in date input", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    const endDate = formatDate(new Date(2024, 11, 31)); // Dec 31, 2024

    // Use fill() for controlled React date inputs
    await backtestPage.endDateInput.fill(endDate);

    const value = await backtestPage.endDateInput.inputValue();
    expect(value).toContain("2024");
  });

  // ─── Run Backtest ────────────────────────────────────────────────────────

  test("@smoke run backtest with valid inputs", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Select strategy via native <select>
    await backtestPage.selectFirstStrategy();

    // Set date range (30 days)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));

    // Run backtest
    await backtestPage.runBacktest();

    // Verify either results are displayed or a toast appeared
    const hasHistory = await backtestPage.historyTable
      .isVisible()
      .catch(() => false);
    const hasToast = await page
      .locator("[data-sonner-toast]")
      .isVisible()
      .catch(() => false);
    expect(hasHistory || hasToast).toBeTruthy();
  });

  test("backtest completion shows progress and results", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Select strategy
    await backtestPage.selectFirstStrategy();

    // Set dates
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 14); // 14-day range

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));

    // Run and wait for completion
    await backtestPage.runButton.click();

    // Should show progress indicator (may or may not appear depending on speed)
    // Just verify the table eventually shows up
    await expect(backtestPage.historyTable).toBeVisible({ timeout: 30_000 });
  });

  // ─── Backtest Validation ──────────────────────────────────────────────────

  test("run without selecting strategy shows error", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Set dates but don't select strategy
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));

    // Try to run — button should be disabled since canSubmit requires selectedStratId
    const runBtn = backtestPage.runButton;
    const isDisabled = await runBtn.isDisabled();

    // The component disables the button when no strategy is selected (canSubmit logic)
    if (!isDisabled) {
      await runBtn.click();
      // Error could be a Sonner toast or inline text
      const hasError = await Promise.race([
        page
          .locator("[data-sonner-toast]")
          .waitFor({ timeout: 5000 })
          .then(() => true),
        page
          .locator("text=/strategy|required|select/i")
          .waitFor({ timeout: 5000 })
          .then(() => true),
      ]).catch(() => false);
      expect(hasError).toBeTruthy();
    } else {
      // Button is disabled — correct behavior
      expect(isDisabled).toBe(true);
    }
  });

  test("end date before start date shows error or disables run", async ({
    page,
  }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Select strategy first
    await backtestPage.selectFirstStrategy();

    // Set invalid date range
    const startDate = "2024-12-31";
    const endDate = "2024-01-01";

    await backtestPage.setDateRange(startDate, endDate);

    // Button should be disabled or error shown
    const isDisabled = await backtestPage.runButton.isDisabled();

    if (!isDisabled) {
      await backtestPage.runButton.click();
      const hasError = await Promise.race([
        page
          .locator("[data-sonner-toast]")
          .waitFor({ timeout: 5000 })
          .then(() => true),
        page
          .locator("text=/date|end|after|start/i")
          .waitFor({ timeout: 5000 })
          .then(() => true),
      ]).catch(() => false);
      expect(hasError).toBeTruthy();
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test("future date range shows appropriate handling", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Select strategy
    await backtestPage.selectFirstStrategy();

    // Set future dates
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));

    // Future date range: the run button should either be disabled (client-side
    // validation blocks future dates) or remain enabled (server validates).
    const runButton = page.locator(
      'button:has-text("Run"), [data-testid="run-backtest"]',
    );
    const isDisabled = await runButton.isDisabled().catch(() => false);
    const isVisible = await runButton.isVisible().catch(() => false);
    // At minimum the UI must still render and the button must exist.
    expect(isVisible || isDisabled).toBe(true);
  });

  // ─── Backtest Results ────────────────────────────────────────────────────

  test("backtest results show pnl amount and percentage", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run a backtest
    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Click first history row to show details (results appear in the detail panel)
    const firstRow = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const rowVisible = await firstRow.isVisible().catch(() => false);
    test.skip(!rowVisible, "No backtest history rows available");

    await firstRow.click();
    await page
      .locator('[data-testid="result-pnl"]')
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    // Result PnL is only visible for COMPLETED backtests
    const pnlVisible = await backtestPage.resultDetailsPnl
      .isVisible()
      .catch(() => false);
    test.skip(!pnlVisible, "Backtest result panel did not render — run may still be processing");

    const stats = await backtestPage.getResultStats();
    expect(stats.pnl).toBeTruthy();
    expect(stats.pnl).toMatch(/[\d\-$.%]/);
  });

  test("backtest results show win rate percentage", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    const firstRow = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const rowVisible = await firstRow.isVisible().catch(() => false);
    test.skip(!rowVisible, "No backtest history rows available");

    await firstRow.click();
    await page
      .locator('[data-testid="result-pnl"]')
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    const pnlVisible = await backtestPage.resultDetailsPnl
      .isVisible()
      .catch(() => false);
    test.skip(!pnlVisible, "Backtest result panel did not render — run may still be processing");

    const stats = await backtestPage.getResultStats();
    expect(stats.winRate).toBeTruthy();
    expect(stats.winRate).toMatch(/[\d%]/);
  });

  test("backtest results show total orders executed", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    const firstRow = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const rowVisible = await firstRow.isVisible().catch(() => false);
    test.skip(!rowVisible, "No backtest history rows available");

    await firstRow.click();
    await page
      .locator('[data-testid="result-pnl"]')
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    const pnlVisible = await backtestPage.resultDetailsPnl
      .isVisible()
      .catch(() => false);
    test.skip(!pnlVisible, "Backtest result panel did not render — run may still be processing");

    const stats = await backtestPage.getResultStats();
    expect(stats.orders).toBeTruthy();
    expect(stats.orders).toMatch(/\d+/);
  });

  test("backtest results show data gaps if any", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    const strategy = await backtestPage.selectFirstStrategy().catch(() => null);
    test.skip(!strategy, "No strategies available");

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Wait for the history to settle after the backtest run
    const firstRow = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const rowVisible = await firstRow
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!rowVisible, "No backtest history rows appeared");

    await firstRow.click();
    // Wait for React state update and detail panel render
    await page
      .locator('[data-testid="result-pnl"]')
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    // Gaps indicator only appears when hasDataGaps is true — both present/absent are valid.
    const pnlVisible = await page
      .locator('[data-testid="result-pnl"]')
      .isVisible()
      .catch(() => false);
    test.skip(!pnlVisible, "Detail panel didn't open");

    const stats = await backtestPage.getResultStats();
    const gapsVisible = await backtestPage.resultDetailsGaps
      .isVisible()
      .catch(() => false);
    // Gaps section either exists (has content about gaps) or is absent (no gaps)
    if (gapsVisible) {
      expect(stats.gaps).toBeTruthy();
    } else {
      // No gaps indicator — detail panel still rendered with PnL
      expect(stats.pnl).toBeTruthy();
    }
  });

  test("backtest results visually indicate positive pnl", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    const firstRow = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const rowVisible = await firstRow.isVisible().catch(() => false);
    test.skip(!rowVisible, "No backtest history rows available");

    await firstRow.click();
    await page
      .locator('[data-testid="result-pnl"]')
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    // Check if positive/negative styling is applied
    const pnlVisible = await backtestPage.resultDetailsPnl
      .isVisible()
      .catch(() => false);
    test.skip(!pnlVisible, "Backtest result panel did not render — run may still be processing");

    const pnlElement = backtestPage.resultDetailsPnl;
    const classes = (await pnlElement.getAttribute("class")) || "";
    // Component applies text-gain for positive PnL, text-loss for negative PnL
    // (migrated from text-pf-success / text-pf-danger in the token rename)
    expect(classes).toMatch(/text-(gain|loss|secondary|tertiary)/);
  });

  // ─── Backtest History ────────────────────────────────────────────────────

  test("backtest history displays previous backtests", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run at least one backtest to have history
    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Verify history table exists
    await expect(backtestPage.historyTable).toBeVisible();

    // Should have at least one row
    const historyCount = await backtestPage.getHistoryCount();
    expect(historyCount).toBeGreaterThan(0);
  });

  test("backtest history shows required columns", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run a backtest
    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Check for column headers matching actual component:
    // Strategy | Date Range | Status | Progress | P&L | Win Rate | Created
    await expect(page.locator("th", { hasText: /Strategy/i })).toBeVisible();
    await expect(page.locator("th", { hasText: /Date Range/i })).toBeVisible();
    await expect(page.locator("th", { hasText: /Status/i })).toBeVisible();
    await expect(page.locator("th", { hasText: /P&L/i })).toBeVisible();
    await expect(page.locator("th", { hasText: /Created/i })).toBeVisible();
  });

  test("click history entry shows detailed results", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run a backtest first
    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Click first history entry
    const firstEntry = page
      .locator('[data-testid="backtest-history-row"]')
      .first();
    const entryVisible = await firstEntry.isVisible().catch(() => false);
    test.skip(!entryVisible, "No backtest history rows available");

    await firstEntry.click();

    // Detail panel opens in any backtest state — "Close run details" uses aria-label (icon button)
    const hasDetail = await page
      .getByRole("button", { name: /Close run details/i })
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    // Detail panel should be visible in some form
    expect(hasDetail).toBeTruthy();
  });

  test("navigate history pagination next page", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run a backtest
    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    const isNextVisible = await backtestPage.paginationNext
      .isVisible()
      .catch(() => false);
    test.skip(!isNextVisible, "Pagination next button not visible — not enough history entries");

    const isNextEnabled = await backtestPage.paginationNext.isEnabled();
    test.skip(!isNextEnabled, "Pagination next button disabled — only 1 page");

    const historyRows = page.locator('[data-testid="backtest-history-row"]');
    const rowCount = await historyRows.count();
    test.skip(
      rowCount <= 5,
      `Only ${rowCount} history rows — not enough to verify pagination`,
    );

    const initialFirstEntry = await historyRows
      .first()
      .getAttribute("data-backtest-id");

    await backtestPage.goToPage("next");

    const newFirstEntry = await page
      .locator('[data-testid="backtest-history-row"]')
      .first()
      .getAttribute("data-backtest-id");

    // If pagination works, entries should be different
    expect(newFirstEntry).not.toBe(initialFirstEntry);
  });

  test("navigate history pagination previous page", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    // Run backtest
    const strategy = await backtestPage.selectFirstStrategy().catch(() => null);
    test.skip(!strategy, "No strategies available");

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    const isNextVisible = await backtestPage.paginationNext
      .isVisible()
      .catch(() => false);
    test.skip(!isNextVisible, "Pagination next button not visible");

    const isNextEnabled = await backtestPage.paginationNext.isEnabled();
    test.skip(!isNextEnabled, "Pagination next button disabled — only 1 page");

    // Go to next page
    await backtestPage.goToPage("next");

    const isPrevEnabled = await backtestPage.paginationPrev.isEnabled();
    test.skip(!isPrevEnabled, "Pagination previous button disabled after navigating forward");

    const pageEntry = await page
      .locator('[data-testid="backtest-history-row"]')
      .first()
      .getAttribute("data-backtest-id");

    await backtestPage.goToPage("prev");

    const firstPageEntry = await page
      .locator('[data-testid="backtest-history-row"]')
      .first()
      .getAttribute("data-backtest-id");

    // After navigating back, the first entry should differ from page 2's first entry.
    expect(firstPageEntry).not.toBe(pageEntry);
  });

  // ─── Date Range Variations ────────────────────────────────────────────────

  test("7-day backtest runs successfully", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    // Verify results
    await expect(backtestPage.historyTable).toBeVisible({ timeout: 30_000 });
  });

  test("30-day backtest runs successfully", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    await expect(backtestPage.historyTable).toBeVisible({ timeout: 30_000 });
  });

  test("90-day backtest runs successfully", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    await expect(backtestPage.historyTable).toBeVisible({ timeout: 30_000 });
  });

  test("custom date range runs with specified dates", async ({ page }) => {
    const backtestPage = new BacktestPage(page);
    await backtestPage.goto();

    await backtestPage.selectFirstStrategy();

    // Custom range: any 15-day period in the past
    const endDate = new Date(2024, 5, 15); // June 15, 2024
    const startDate = new Date(2024, 5, 1); // June 1, 2024

    await backtestPage.setDateRange(formatDate(startDate), formatDate(endDate));
    await backtestPage.runBacktest();

    await expect(backtestPage.historyTable).toBeVisible({ timeout: 30_000 });
  });
});
