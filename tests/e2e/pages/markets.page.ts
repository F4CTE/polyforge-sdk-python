import { type Page, type Locator, expect } from '@playwright/test';

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
        const chipRow = page.locator('.flex.gap-2.overflow-x-auto');
        this.categoryChips = {
            All: chipRow.getByRole('button', { name: /^All$/i }),
            Sports: chipRow.getByRole('button', { name: /Sports/i }),
            Crypto: chipRow.getByRole('button', { name: /Crypto/i }),
            Politics: chipRow.getByRole('button', { name: /Politics/i }),
            Economics: chipRow.getByRole('button', { name: /Economics/i }),
            Finance: chipRow.getByRole('button', { name: /Finance/i }),
            Technology: chipRow.getByRole('button', { name: /Technology/i }),
        };

        // Sort dropdown is a native <select> element with id="sort-select"
        this.sortDropdown = page.locator('select#sort-select');

        // View toggle: two separate buttons with aria-labels
        this.cardViewButton = page.getByRole('button', { name: 'Card view' });
        this.tableViewButton = page.getByRole('button', { name: 'Table view' });

        // Market cards use data-testid="market-card" on <Link> elements
        this.marketCards = page.locator('[data-testid="market-card"]');

        // Pagination buttons
        this.paginationPrev = page.getByRole('button', { name: 'Previous page' });
        this.paginationNext = page.getByRole('button', { name: 'Next page' });

        // Page info: <span aria-live="polite">Page X of Y</span>
        this.pageInfo = page.locator('span[aria-live="polite"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/markets');
        await expect(this.page.locator('h1', { hasText: 'Markets' })).toBeVisible({ timeout: 15_000 });
    }

    async search(term: string): Promise<void> {
        // The input uses defaultValue + onChange (uncontrolled), so we clear then
        // type to trigger the onChange handler which debounces.
        await this.searchInput.clear();
        await this.searchInput.fill(term);
        // Wait for debounce (component debounces search input)
        await this.page.waitForTimeout(400);
    }

    async selectCategory(category: 'All' | 'Sports' | 'Crypto' | 'Politics' | 'Economics' | 'Finance' | 'Technology'): Promise<void> {
        await this.categoryChips[category].click();
    }

    async selectSort(sort: 'volume' | 'newest' | 'closingSoon' | 'liquidity'): Promise<void> {
        // The sort dropdown is a native <select> element. Use selectOption().
        // Map the test keys to the actual <option> values used by the component.
        const sortMap: Record<string, string> = {
            volume: 'volume',
            newest: 'newest',
            closingSoon: 'closing_soon',
            liquidity: 'liquidity',
        };
        await this.sortDropdown.selectOption(sortMap[sort]);
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
        const tableActive = await this.tableViewButton.evaluate(
            (el) => el.classList.contains('bg-elevated') || el.classList.contains('bg-pf-elevated'),
        ).catch(() => false);
        if (tableActive) {
            await this.switchToCardView();
        } else {
            await this.switchToTableView();
        }
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
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
        return (await this.pageInfo.textContent()) ?? '';
    }

    /** Check if currently in table view by looking for <table> element */
    async isTableView(): Promise<boolean> {
        return await this.page.locator('table[aria-label="Markets"]').isVisible().catch(() => false);
    }

    /** Check if currently in card view by checking market cards are visible */
    async isCardView(): Promise<boolean> {
        const count = await this.marketCards.count();
        return count > 0;
    }
}
