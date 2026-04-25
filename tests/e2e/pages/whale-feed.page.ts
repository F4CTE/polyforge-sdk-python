import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Whale tracker page (/whale-feed).
 *
 * Handles following/unfollowing whales, filtering by minimum position size,
 * and pagination through the whale feed.
 */
export class WhaleFeedPage {
    readonly page: Page;
    readonly minSizeFilter: Locator;
    readonly minSizeInput: Locator;
    readonly whaleFeedItems: Locator;
    readonly paginationPrev: Locator;
    readonly paginationNext: Locator;
    readonly followingLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.minSizeFilter = page.locator('[data-testid="min-size-filter"]');
        // The min size filter uses buttons ($5K+, $10K+, etc.), not an input.
        // Keep minSizeInput for backward compatibility but it won't match.
        this.minSizeInput = page.locator('input[placeholder*="Minimum"]');
        this.whaleFeedItems = page.locator('[data-testid="whale-feed-item"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
        this.followingLink = page.locator('a', { hasText: 'Following' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/whales');
        await expect(this.page.locator('h1', { hasText: 'Whale Tracker' })).toBeVisible({ timeout: 15_000 });
        // Wait for data to load — either feed items appear or the empty state shows
        const feedItem = this.page.locator('[data-testid="whale-feed-item"]').first();
        const emptyState = this.page.locator('text=/No whale trades/i');
        await expect(feedItem.or(emptyState)).toBeVisible({ timeout: 15_000 });
    }

    /**
     * Set minimum size filter by clicking the corresponding button.
     * Available sizes: '5000' ($5K+), '10000' ($10K+), '50000' ($50K+), '100000' ($100K+).
     */
    async setMinSize(size: string): Promise<void> {
        const sizeLabels: Record<string, string> = {
            '5000': '$5K+',
            '10000': '$10K+',
            '50000': '$50K+',
            '100000': '$100K+',
        };
        const label = sizeLabels[size];
        if (label) {
            await this.page.locator('button', { hasText: label }).click();
        }
    }

    getFollowButton(address: string): Locator {
        return this.page.locator(`[data-testid="follow-${address}"]`);
    }

    getUnfollowButton(address: string): Locator {
        return this.page.locator(`[data-testid="unfollow-${address}"]`);
    }

    async followWhale(address: string): Promise<void> {
        await this.getFollowButton(address).click();
    }

    async unfollowWhale(address: string): Promise<void> {
        await this.getUnfollowButton(address).click();
    }

    async getItemCount(): Promise<number> {
        return await this.whaleFeedItems.count();
    }

    async goToProfile(address: string): Promise<void> {
        await this.page.locator(`[data-testid="whale-${address}"]`).click();
    }

    /**
     * Get the full wallet address from a whale feed item.
     * The displayed address is truncated, but the link testid contains
     * the full address as data-testid="whale-{fullAddress}".
     * Returns null if the item or link doesn't exist (e.g. empty feed).
     */
    async getFullAddress(item: import('@playwright/test').Locator): Promise<string | null> {
        // Guard: if the item itself isn't visible, return null immediately
        if (!(await item.isVisible().catch(() => false))) return null;
        const link = item.locator('a[data-testid^="whale-"]').first();
        if (!(await link.isVisible().catch(() => false))) return null;
        const testid = await link.getAttribute('data-testid', { timeout: 5_000 }).catch(() => null);
        return testid ? testid.replace('whale-', '') : null;
    }

    async goToFollowing(): Promise<void> {
        await this.followingLink.click();
        await this.page.waitForURL(/\/whales\/following/, { timeout: 30_000 });
    }

    async goToPage(direction: 'next' | 'prev'): Promise<void> {
        if (direction === 'next') {
            await this.paginationNext.click();
        } else {
            await this.paginationPrev.click();
        }
    }
}
