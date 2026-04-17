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
    readonly profileButton: Locator;
    readonly settingsButton: Locator;
    readonly signOutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        // Component uses data-tour (not data-testid) for tour anchors
        this.themeToggle = page.locator('[data-tour="theme-toggle"]');
        this.notificationBell = page.locator('[data-tour="notification-bell"] button[aria-label="Notifications"]');
        this.unreadBadge = page.locator('[data-tour="notification-bell"] [aria-label*="unread"]');
        this.notificationDropdown = page.locator('[role="dialog"][aria-label="Notifications"]');
        this.markAllReadButton = page.locator('button', { hasText: 'Mark all as read' });
        // User menu trigger uses data-testid="user-menu-btn"
        this.userMenuButton = page.locator('[data-testid="user-menu-btn"]');
        // Dropdown uses role="menu" (no data-testid on container)
        this.userMenu = page.locator('[role="menu"]');
        // Profile/Settings/SignOut are menuitem buttons — not anchor links
        this.profileButton = page.locator('[role="menu"] button[role="menuitem"]', { hasText: 'Profile' });
        this.settingsButton = page.locator('[role="menu"] button[role="menuitem"]', { hasText: 'Settings' });
        this.signOutButton = page.locator('[role="menu"] button[role="menuitem"]', { hasText: /sign out/i });
    }

    async toggleTheme(): Promise<void> {
        await this.themeToggle.click();
    }

    async openNotifications(): Promise<void> {
        await this.notificationBell.click();
        await expect(this.notificationDropdown).toBeVisible();
    }

    async markAllRead(): Promise<void> {
        await this.markAllReadButton.click();
    }

    async getUnreadCount(): Promise<number> {
        const label = await this.unreadBadge.getAttribute('aria-label');
        const match = label?.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    async openUserMenu(): Promise<void> {
        await this.userMenuButton.click();
        await expect(this.userMenu).toBeVisible();
    }

    async goToProfile(): Promise<void> {
        await this.openUserMenu();
        await this.profileButton.click();
    }

    async goToSettings(): Promise<void> {
        await this.openUserMenu();
        await this.settingsButton.click();
    }

    async signOut(): Promise<void> {
        await this.openUserMenu();
        await this.signOutButton.click();
    }

    async isDarkMode(): Promise<boolean> {
        const theme = await this.page.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        return theme === 'dark';
    }
}
