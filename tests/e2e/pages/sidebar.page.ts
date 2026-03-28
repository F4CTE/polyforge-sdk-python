import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Sidebar navigation component.
 *
 * Handles navigation to different pages via sidebar links,
 * toggling sidebar collapse, and accessing user-related shortcuts.
 */
export class SidebarPage {
    readonly page: Page;
    readonly collapseToggle: Locator;
    readonly edgeRatingLink: Locator;
    readonly settingsLink: Locator;

    // Navigation items
    readonly navItems: Record<string, Locator>;

    constructor(page: Page) {
        this.page = page;
        this.collapseToggle = page.locator('[data-testid="sidebar-collapse"]');
        this.edgeRatingLink = page.locator('[data-testid="edge-rating-link"]');
        this.settingsLink = page.locator('[data-testid="settings-link"]');

        this.navItems = {
            dashboard: page.locator('a[href="/dashboard"]'),
            markets: page.locator('a[href="/markets"]'),
            portfolio: page.locator('a[href="/portfolio"]'),
            orders: page.locator('a[href="/orders"]'),
            strategies: page.locator('a[href="/strategies"]'),
            discover: page.locator('a[href="/discover"]'),
            copy: page.locator('a[href="/copy"]'),
            backtest: page.locator('a[href="/backtest"]'),
            whaleFeed: page.locator('a[href="/whale-feed"]'),
            news: page.locator('a[href="/news"]'),
            leaderboard: page.locator('a[href="/leaderboard"]'),
        };
    }

    async navigateTo(page: keyof typeof this.navItems): Promise<void> {
        await this.navItems[page].click();
        await this.page.waitForLoadState('networkidle');
    }

    async collapse(): Promise<void> {
        const isCollapsed = await this.isCollapsed();
        if (!isCollapsed) {
            await this.collapseToggle.click();
            await this.page.waitForLoadState('networkidle');
        }
    }

    async expand(): Promise<void> {
        const isCollapsed = await this.isCollapsed();
        if (isCollapsed) {
            await this.collapseToggle.click();
            await this.page.waitForLoadState('networkidle');
        }
    }

    async isCollapsed(): Promise<boolean> {
        const sidebar = this.page.locator('[data-testid="sidebar"]');
        const classList = await sidebar.evaluate(el => el.classList.toString());
        return classList.includes('collapsed');
    }

    async getEdgeRating(): Promise<string> {
        return (await this.edgeRatingLink.textContent()) ?? '';
    }

    async goToSettings(): Promise<void> {
        await this.settingsLink.click();
        await this.page.waitForLoadState('networkidle');
    }
}
