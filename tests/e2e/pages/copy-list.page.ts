import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Copy Trading list page (/copy).
 *
 * Handles viewing copy trading profiles, filtering by status,
 * pagination, and navigation to create new copy trades.
 */
export class CopyListPage {
    readonly page: Page;
    readonly newCopyButton: Locator;
    readonly copyCards: Locator;
    readonly statusFilter: Record<string, Locator>;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;

    constructor(page: Page) {
        this.page = page;
        this.newCopyButton = page.locator('button', { hasText: 'New Copy Trade' });
        this.copyCards = page.locator('[data-testid="copy-card"]');

        this.statusFilter = {
            Active: page.locator('button', { hasText: 'Active' }),
            Inactive: page.locator('button', { hasText: 'Inactive' }),
            All: page.locator('button', { hasText: 'All' }),
        };

        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/copy');
        await expect(this.page.locator('h1', { hasText: 'Copy Trading' })).toBeVisible({ timeout: 15_000 });
    }

    async goToNewCopy(): Promise<void> {
        await this.newCopyButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    getCopyByName(name: string): Locator {
        return this.page.locator('[data-testid="copy-card"]', { hasText: name });
    }

    async getCopyCount(): Promise<number> {
        return await this.copyCards.count();
    }

    getStatusBadge(name: string): Locator {
        return this.getCopyByName(name).locator('[data-testid="status-badge"]');
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
        await this.page.waitForLoadState('networkidle');
    }
}
