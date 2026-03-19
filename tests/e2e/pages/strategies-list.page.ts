import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Strategies list page (/strategies).
 */
export class StrategiesListPage {
    readonly page:          Page;
    readonly newButton:     Locator;
    readonly strategyCards: Locator;

    constructor(page: Page) {
        this.page          = page;
        this.newButton     = page.locator('p-button').filter({ hasText: 'New Strategy' }).locator('button').first();
        this.strategyCards = page.locator('.strategy-card');
    }

    async goto(): Promise<void> {
        await this.page.goto('/strategies');
        await expect(this.page.locator('h1', { hasText: 'My Strategies' })).toBeVisible({ timeout: 15_000 });
    }

    /** Find a strategy card by name */
    cardByName(name: string): Locator {
        return this.strategyCards.filter({ has: this.page.locator('.strategy-name', { hasText: name }) });
    }

    /** Get the status badge text for a strategy card */
    async statusOf(name: string): Promise<string> {
        const badge = this.cardByName(name).locator('.status-badge');
        await expect(badge).toBeVisible();
        return (await badge.textContent() ?? '').trim();
    }

    async clickCard(name: string): Promise<void> {
        await this.cardByName(name).click();
    }

    /** Click the Paper button on a specific strategy card */
    async startPaper(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button', { hasText: 'Paper' }).click();
    }

    /** Click the Live button on a specific strategy card */
    async startLive(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button', { hasText: 'Live' }).click();
    }

    /** Click the Pause button (icon-only) on a specific strategy card */
    async pauseStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        // Pause button has only an icon (pi-pause), no text label
        await card.locator('button:has(.pi-pause)').click();
    }

    /** Click the Resume button (icon-only) on a specific strategy card */
    async resumeStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button:has(.pi-play)').click();
    }

    /** Click the Stop button (icon-only) on a specific strategy card */
    async stopStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button:has(.pi-stop-circle)').click();
    }

    async clickNew(): Promise<void> {
        await this.newButton.click();
    }
}
