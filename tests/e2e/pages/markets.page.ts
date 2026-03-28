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
    readonly viewToggle: Locator;
    readonly marketCards: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;
    readonly pageInfo: Locator;

    constructor(page: Page) {
        this.page = page;
        this.searchInput = page.locator('input[placeholder*="Search"]').first();

        // Category chips
        this.categoryChips = {
            All: page.locator('button', { hasText: 'All' }),
            Sports: page.locator('button', { hasText: 'Sports' }),
            Crypto: page.locator('button', { hasText: 'Crypto' }),
            Politics: page.locator('button', { hasText: 'Politics' }),
            Economics: page.locator('button', { hasText: 'Economics' }),
            Finance: page.locator('button', { hasText: 'Finance' }),
            Technology: page.locator('button', { hasText: 'Technology' }),
        };

        this.sortDropdown = page.locator('select, [role="combobox"]').first();
        this.viewToggle = page.locator('button[data-testid="view-toggle"]');
        this.marketCards = page.locator('[data-testid="market-card"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
        this.pageInfo = page.locator('[data-testid="page-info"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/markets');
        await expect(this.page.locator('h1', { hasText: 'Markets' })).toBeVisible({ timeout: 15_000 });
    }

    async search(term: string): Promise<void> {
        await this.searchInput.fill(term);
        await this.page.waitForLoadState('networkidle');
    }

    async selectCategory(category: 'All' | 'Sports' | 'Crypto' | 'Politics' | 'Economics' | 'Finance' | 'Technology'): Promise<void> {
        await this.categoryChips[category].click();
        await this.page.waitForLoadState('networkidle');
    }

    async selectSort(sort: 'volume' | 'newest' | 'closingSoon' | 'liquidity'): Promise<void> {
        await this.sortDropdown.click();
        const sortMap: Record<string, string> = {
            volume: 'Volume',
            newest: 'Newest',
            closingSoon: 'Closing Soon',
            liquidity: 'Liquidity',
        };
        await this.page.locator('text=' + sortMap[sort]).click();
        await this.page.waitForLoadState('networkidle');
    }

    async toggleView(): Promise<void> {
        await this.viewToggle.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
        await this.page.waitForLoadState('networkidle');
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
}
