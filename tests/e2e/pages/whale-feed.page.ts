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
        this.minSizeInput = page.locator('input[placeholder*="Minimum"]');
        this.whaleFeedItems = page.locator('[data-testid="whale-feed-item"]');
        this.paginationPrev = page.locator('button[aria-label="Previous page"]');
        this.paginationNext = page.locator('button[aria-label="Next page"]');
        this.followingLink = page.locator('a', { hasText: 'Following' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/whale-feed');
        await expect(this.page.locator('h1', { hasText: 'Whale Feed' })).toBeVisible({ timeout: 15_000 });
    }

    async setMinSize(size: string): Promise<void> {
        await this.minSizeInput.fill(size);
        await this.page.waitForLoadState('networkidle');
    }

    getFollowButton(address: string): Locator {
        return this.page.locator(`[data-testid="follow-${address}"]`);
    }

    getUnfollowButton(address: string): Locator {
        return this.page.locator(`[data-testid="unfollow-${address}"]`);
    }

    async followWhale(address: string): Promise<void> {
        await this.getFollowButton(address).click();
        await this.page.waitForLoadState('networkidle');
    }

    async unfollowWhale(address: string): Promise<void> {
        await this.getUnfollowButton(address).click();
        await this.page.waitForLoadState('networkidle');
    }

    async getItemCount(): Promise<number> {
        return await this.whaleFeedItems.count();
    }

    async goToProfile(address: string): Promise<void> {
        await this.page.locator(`[data-testid="whale-${address}"]`).click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToFollowing(): Promise<void> {
        await this.followingLink.click();
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
}
