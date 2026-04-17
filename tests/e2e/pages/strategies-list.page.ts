import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Strategies list page (/strategies).
 *
 * Updated for React + shadcn frontend (replaces Angular + PrimeNG).
 * Strategy cards are plain divs with cursor-pointer and group class.
 * Action buttons use Lucide icons with title attributes for identification.
 */
export class StrategiesListPage {
    readonly page:          Page;
    readonly newButton:     Locator;
    readonly strategyCards: Locator;

    constructor(page: Page) {
        this.page          = page;
        // "New Strategy" is an <a> (Link) in React, not a p-button
        this.newButton     = page.locator('a', { hasText: 'New Strategy' });
        // Each strategy card has data-testid="strategy-card"
        this.strategyCards = page.locator('[data-testid="strategy-card"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/strategies');
        await expect(this.page.locator('h1', { hasText: 'My Strategies' })).toBeVisible({ timeout: 30_000 });
    }

    /** Find a strategy card by name */
    cardByName(name: string): Locator {
        return this.strategyCards.filter({ has: this.page.locator('h3', { hasText: name }) });
    }

    /** Get the status badge text for a strategy card */
    async statusOf(name: string): Promise<string> {
        // Status badge has data-testid="status-badge"
        const badge = this.cardByName(name).locator('[data-testid="status-badge"]');
        await expect(badge).toBeVisible();
        return (await badge.textContent() ?? '').trim();
    }

    /** Wait for a strategy's status badge to match a pattern (polls until timeout) */
    async waitForStatus(name: string, pattern: RegExp, timeout = 30_000): Promise<void> {
        const badge = this.cardByName(name).locator('[data-testid="status-badge"]');
        await expect(badge).toHaveText(pattern, { timeout });
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

    /** Click the Pause button (icon-only, identified by title) on a specific strategy card */
    async pauseStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button[title="Pause strategy"]').click();
    }

    /** Click the Resume button (icon-only, identified by title) on a specific strategy card */
    async resumeStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button[title="Resume strategy"]').click();
    }

    /** Click the Stop button (icon-only, identified by title) on a specific strategy card */
    async stopStrategy(name: string): Promise<void> {
        const card = this.cardByName(name);
        await card.locator('button[title="Stop strategy"]').click();
    }

    async clickNew(): Promise<void> {
        await this.newButton.click();
    }
}
