import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Top bar/header component.
 *
 * Handles theme toggling, notifications, user menu, and other
 * header-level interactions.
 */
export class TopbarPage {
    readonly page: Page;
    readonly themeToggle: Locator;
    readonly notificationBell: Locator;
    readonly unreadBadge: Locator;
    readonly notificationDropdown: Locator;
    readonly markAllReadButton: Locator;
    readonly userMenuButton: Locator;
    readonly userMenu: Locator;
    readonly profileLink: Locator;
    readonly settingsLink: Locator;
    readonly signOutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.themeToggle = page.locator('[data-testid="theme-toggle"]');
        this.notificationBell = page.locator('[data-testid="notification-bell"]');
        this.unreadBadge = page.locator('[data-testid="unread-badge"]');
        this.notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
        this.markAllReadButton = page.locator('button', { hasText: 'Mark all as read' });
        this.userMenuButton = page.locator('[data-testid="user-menu-button"]');
        this.userMenu = page.locator('[data-testid="user-menu"]');
        this.profileLink = page.locator('[data-testid="user-menu"] a', { hasText: 'Profile' });
        this.settingsLink = page.locator('[data-testid="user-menu"] a', { hasText: 'Settings' });
        this.signOutButton = page.locator('[data-testid="user-menu"] button', { hasText: 'Sign Out' });
    }

    async toggleTheme(): Promise<void> {
        await this.themeToggle.click();
        await this.page.waitForTimeout(300);
    }

    async openNotifications(): Promise<void> {
        await this.notificationBell.click();
        await expect(this.notificationDropdown).toBeVisible();
    }

    async markAllRead(): Promise<void> {
        await this.markAllReadButton.click();
        await this.page.waitForTimeout(300);
    }

    async getUnreadCount(): Promise<string> {
        const badge = await this.unreadBadge.textContent();
        return badge ?? '0';
    }

    async openUserMenu(): Promise<void> {
        await this.userMenuButton.click();
        await expect(this.userMenu).toBeVisible();
    }

    async goToProfile(): Promise<void> {
        await this.openUserMenu();
        await this.profileLink.click();
        await this.page.waitForTimeout(300);
    }

    async goToSettings(): Promise<void> {
        await this.openUserMenu();
        await this.settingsLink.click();
        await this.page.waitForTimeout(300);
    }

    async signOut(): Promise<void> {
        await this.openUserMenu();
        await this.signOutButton.click();
        await this.page.waitForTimeout(300);
    }

    async isDarkMode(): Promise<boolean> {
        const theme = await this.page.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        return theme === 'dark';
    }
}
