import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Profile page (/profile/:username).
 *
 * Handles viewing user profile, badges, edge rating, and navigation
 * to related pages like settings and trading account.
 */
export class ProfilePage {
    readonly page: Page;
    readonly editProfileButton: Locator;
    readonly displayName: Locator;
    readonly username: Locator;
    readonly bio: Locator;
    readonly statusChips: Locator;
    readonly edgeRating: Locator;
    readonly badges: Locator;
    readonly settingsLink: Locator;
    readonly tradingAccountLink: Locator;
    readonly myStrategiesLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.editProfileButton = page.locator('button', { hasText: 'Edit Profile' });
        this.displayName = page.locator('[data-testid="profile-display-name"]');
        this.username = page.locator('[data-testid="profile-username"]');
        this.bio = page.locator('[data-testid="profile-bio"]');
        this.statusChips = page.locator('[data-testid="status-chip"]');
        this.edgeRating = page.locator('[data-testid="edge-rating"]');
        this.badges = page.locator('[data-testid="badge"]');
        this.settingsLink = page.locator('a', { hasText: 'Settings' });
        this.tradingAccountLink = page.locator('a', { hasText: 'Trading Account' });
        this.myStrategiesLink = page.locator('a', { hasText: 'My Strategies' });
    }

    async gotoProfile(username: string): Promise<void> {
        await this.page.goto(`/profile/${username}`);
        await expect(this.page.locator('h1')).toBeVisible({ timeout: 15_000 });
    }

    async goToEditProfile(): Promise<void> {
        await this.editProfileButton.click();
    }

    async getDisplayName(): Promise<string> {
        return (await this.displayName.textContent()) ?? '';
    }

    async getUsername(): Promise<string> {
        return (await this.username.textContent()) ?? '';
    }

    async getBio(): Promise<string> {
        return (await this.bio.textContent()) ?? '';
    }

    async getEdgeRating(): Promise<string> {
        return (await this.edgeRating.textContent()) ?? '';
    }

    async getBadgeCount(): Promise<number> {
        return await this.badges.count();
    }

    async goToSettings(): Promise<void> {
        await this.settingsLink.click();
    }

    async goToTradingAccount(): Promise<void> {
        await this.tradingAccountLink.click();
    }

    async goToMyStrategies(): Promise<void> {
        await this.myStrategiesLink.click();
    }
}
