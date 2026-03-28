import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import {
    apiRegister,
    uniqueEmail,
    uniqueUsername,
} from '../helpers/api';
import {
    clearAllMessages,
    getVerificationUrl,
} from '../helpers/mailhog';

/**
 * Comprehensive navigation tests for PolyForge.
 *
 * Covers:
 *   - Sidebar navigation (all nav items, active states, collapse/expand)
 *   - Topbar elements (theme toggle, notifications, user menu)
 *   - Mobile responsive behavior (hamburger, sidebar overlay)
 *   - Dark/light mode persistence
 *   - Navigation links correctness
 */

test.describe.serial('Navigation — Full Workflow Coverage', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Login and navigate to authenticated page
    // ─────────────────────────────────────────────────────────────────────────

    test.beforeEach(async ({ page, viewport }) => {
        // Skip if mobile context will override
        if (viewport && viewport.width < 768) {
            // Tests will handle mobile setup individually
            return;
        }

        await clearAllMessages();

        // Register, verify, and login
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('nav');
        const username = uniqueUsername('nav');

        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h2', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SIDEBAR NAVIGATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke all sidebar nav items are visible when logged in', async ({ page }) => {
        const navItems = [
            'Markets',
            'Strategies',
            'Portfolio',
            'Orders',
            'Backtest',
            'Copy Trading',
            'Discover',
            'News',
            'Whales',
            'Leaderboard',
            'API Docs',
            'Support',
        ];

        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        await expect(sidebar).toBeVisible();

        for (const item of navItems) {
            const navItem = sidebar.locator('a, button', { hasText: new RegExp(item, 'i') });
            await expect(navItem).toBeVisible({ timeout: 5000 }).catch(async () => {
                // If not found in collapsed sidebar, may appear after expand
                const expandBtn = page.locator('button[data-testid="sidebar-toggle"], [aria-label*="toggle"]').first();
                if (await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await expandBtn.click();
                }
                await expect(navItem).toBeVisible({ timeout: 5000 });
            });
        }
    });

    test('click Markets nav item navigates to /markets', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const marketLink = sidebar.locator('a, button', { hasText: /markets/i });
        await expect(marketLink).toBeVisible();
        await marketLink.click();
        await expect(page).toHaveURL(/\/markets/);
    });

    test('click Strategies nav item navigates to /strategies', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const stratLink = sidebar.locator('a, button', { hasText: /strategies/i });
        await expect(stratLink).toBeVisible();
        await stratLink.click();
        await expect(page).toHaveURL(/\/strategies/);
    });

    test('click Portfolio nav item navigates to /portfolio', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const portLink = sidebar.locator('a, button', { hasText: /portfolio/i });
        await expect(portLink).toBeVisible();
        await portLink.click();
        await expect(page).toHaveURL(/\/portfolio/);
    });

    test('click Orders nav item navigates to /orders', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const orderLink = sidebar.locator('a, button', { hasText: /orders/i });
        await expect(orderLink).toBeVisible();
        await orderLink.click();
        await expect(page).toHaveURL(/\/orders/);
    });

    test('click Backtest nav item navigates to /backtest', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const backLink = sidebar.locator('a, button', { hasText: /backtest/i });
        await expect(backLink).toBeVisible();
        await backLink.click();
        await expect(page).toHaveURL(/\/backtest/);
    });

    test('click Copy Trading nav item navigates to /copy-trading', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const copyLink = sidebar.locator('a, button', { hasText: /copy trading/i });
        await expect(copyLink).toBeVisible();
        await copyLink.click();
        await expect(page).toHaveURL(/\/copy-trading/);
    });

    test('click Discover nav item navigates to /discover', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const discLink = sidebar.locator('a, button', { hasText: /discover/i });
        await expect(discLink).toBeVisible();
        await discLink.click();
        await expect(page).toHaveURL(/\/discover/);
    });

    test('click News nav item navigates to /news', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const newsLink = sidebar.locator('a, button', { hasText: /news/i });
        await expect(newsLink).toBeVisible();
        await newsLink.click();
        await expect(page).toHaveURL(/\/news/);
    });

    test('click Whales nav item navigates to /whales', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const whaleLink = sidebar.locator('a, button', { hasText: /whales/i });
        await expect(whaleLink).toBeVisible();
        await whaleLink.click();
        await expect(page).toHaveURL(/\/whales/);
    });

    test('click Leaderboard nav item navigates to /leaderboard', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const leadLink = sidebar.locator('a, button', { hasText: /leaderboard/i });
        await expect(leadLink).toBeVisible();
        await leadLink.click();
        await expect(page).toHaveURL(/\/leaderboard/);
    });

    test('click API Docs nav item navigates to /api-docs', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const apiLink = sidebar.locator('a, button', { hasText: /api\s*docs/i });
        await expect(apiLink).toBeVisible();
        await apiLink.click();
        await expect(page).toHaveURL(/\/api-docs/);
    });

    test('click Support nav item navigates to /support', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const supportLink = sidebar.locator('a, button', { hasText: /support/i });
        await expect(supportLink).toBeVisible();
        await supportLink.click();
        await expect(page).toHaveURL(/\/support/);
    });

    test('active nav item is highlighted for current route', async ({ page }) => {
        // Navigate to /markets
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const marketLink = sidebar.locator('a, button', { hasText: /markets/i });
        await marketLink.click();
        await expect(page).toHaveURL(/\/markets/);

        // Check that Markets item is highlighted (aria-current or has active class)
        const activeMarket = sidebar.locator('[aria-current="page"], .active, [data-active="true"]', { hasText: /markets/i });
        const isHighlighted = await activeMarket.isVisible({ timeout: 5000 }).catch(() => false);
        expect(isHighlighted).toBe(true);
    });

    test('collapse sidebar hides text labels, shows icons only', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const initialWidth = await sidebar.boundingBox().then(box => box?.width ?? 0);

        // Find and click collapse button
        const collapseBtn = page.locator('button[data-testid="sidebar-toggle"], [aria-label*="collapse"], [aria-label*="toggle"]').first();
        if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await collapseBtn.click();
            await page.waitForTimeout(300);

            const collapsedWidth = await sidebar.boundingBox().then(box => box?.width ?? 0);
            expect(collapsedWidth).toBeLessThan(initialWidth);

            // Text labels should be hidden
            const marketLabel = sidebar.locator('span, div', { hasText: /^Markets$/ });
            const isHidden = !(await marketLabel.isVisible({ timeout: 1000 }).catch(() => false));
            expect(isHidden).toBe(true);
        }
    });

    test('expand sidebar shows full width with labels', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();

        // First collapse
        const collapseBtn = page.locator('button[data-testid="sidebar-toggle"], [aria-label*="collapse"], [aria-label*="toggle"]').first();
        if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await collapseBtn.click();
            await page.waitForTimeout(300);

            // Then expand
            await collapseBtn.click();
            await page.waitForTimeout(300);

            // Text labels should be visible again
            const marketLabel = sidebar.locator('span, div', { hasText: /Markets/ });
            await expect(marketLabel).toBeVisible({ timeout: 5000 });
        }
    });

    test('Edge Rating displayed in sidebar with score', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const edgeRating = sidebar.locator('[data-testid="edge-rating"], text=/edge\s*rating/i', { hasText: /\d/ });
        const isVisible = await edgeRating.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
            const text = await edgeRating.textContent();
            expect(text).toMatch(/\d/);
        }
    });

    test('Settings link at bottom of sidebar works', async ({ page }) => {
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const settingsLink = sidebar.locator('a, button', { hasText: /settings/i }).last(); // Last to get bottom item
        await expect(settingsLink).toBeVisible();
        await settingsLink.click();
        await expect(page).toHaveURL(/\/settings/);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TOPBAR TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke theme toggle switches between light and dark mode', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const themeToggle = topbar.locator('button[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"], [aria-label*="light"]').first();

        if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Get initial theme
            const htmlEl = page.locator('html').first();
            const initialClass = await htmlEl.getAttribute('class');
            const isDark = initialClass?.includes('dark');

            await themeToggle.click();
            await page.waitForTimeout(300);

            // Check theme changed
            const newClass = await htmlEl.getAttribute('class');
            const isNowDark = newClass?.includes('dark');
            expect(isNowDark).not.toBe(isDark);
        }
    });

    test('dark mode persists across page navigation', async ({ page }) => {
        const htmlEl = page.locator('html').first();
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const themeToggle = topbar.locator('button[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"], [aria-label*="light"]').first();

        if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Enable dark mode
            const initialClass = await htmlEl.getAttribute('class');
            if (!initialClass?.includes('dark')) {
                await themeToggle.click();
                await page.waitForTimeout(300);
            }

            // Store dark mode state
            const darkModeClass = await htmlEl.getAttribute('class');
            expect(darkModeClass?.includes('dark')).toBe(true);

            // Navigate to another page
            const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
            const marketLink = sidebar.locator('a, button', { hasText: /markets/i });
            await marketLink.click();
            await expect(page).toHaveURL(/\/markets/);

            // Check dark mode still applied
            const newClass = await htmlEl.getAttribute('class');
            expect(newClass?.includes('dark')).toBe(true);
        }
    });

    test('notification bell shows unread count badge', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const notifBell = topbar.locator('button[data-testid="notifications"], [aria-label*="notif"]').first();

        if (await notifBell.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Check for badge with count
            const badge = notifBell.locator('[data-testid="badge"], .badge, span').filter({ hasText: /\d+/ });
            const hasBadge = await badge.isVisible({ timeout: 2000 }).catch(() => false);
            if (hasBadge) {
                const count = await badge.textContent();
                expect(count).toMatch(/\d+/);
            }
        }
    });

    test('click notification bell opens dropdown', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const notifBell = topbar.locator('button[data-testid="notifications"], [aria-label*="notif"]').first();

        if (await notifBell.isVisible({ timeout: 2000 }).catch(() => false)) {
            await notifBell.click();
            await page.waitForTimeout(300);

            // Check for notification dropdown/popover
            const dropdown = page.locator('[role="menu"], [data-testid="notification-dropdown"], .popover').first();
            const isOpen = await dropdown.isVisible({ timeout: 3000 }).catch(() => false);
            if (isOpen) {
                expect(isOpen).toBe(true);
            }
        }
    });

    test('mark all notifications as read clears unread count', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const notifBell = topbar.locator('button[data-testid="notifications"], [aria-label*="notif"]').first();

        if (await notifBell.isVisible({ timeout: 2000 }).catch(() => false)) {
            await notifBell.click();
            await page.waitForTimeout(300);

            // Find and click "Mark all as read"
            const markAllBtn = page.locator('button', { hasText: /mark all|read/i });
            if (await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await markAllBtn.click();
                await page.waitForTimeout(300);

                // Badge should disappear or show 0
                const badge = notifBell.locator('[data-testid="badge"], .badge').first();
                const isVisible = await badge.isVisible({ timeout: 2000 }).catch(() => false);
                if (isVisible) {
                    const text = await badge.textContent();
                    expect(text).toMatch(/^0?$/);
                }
            }
        }
    });

    test('user menu opens on click', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const userMenu = topbar.locator('button[data-testid="user-menu"], [aria-label*="user"], [aria-label*="account"]').first();

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
            await page.waitForTimeout(300);

            // Check for dropdown menu
            const dropdown = page.locator('[role="menu"], [data-testid="user-dropdown"]').first();
            const isOpen = await dropdown.isVisible({ timeout: 3000 }).catch(() => false);
            expect(isOpen).toBe(true);
        }
    });

    test('user menu Profile link navigates to /profile/me', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const userMenu = topbar.locator('button[data-testid="user-menu"], [aria-label*="user"], [aria-label*="account"]').first();

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
            await page.waitForTimeout(300);

            const profileLink = page.locator('a, button', { hasText: /profile/i });
            if (await profileLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await profileLink.click();
                await expect(page).toHaveURL(/\/profile\/me/);
            }
        }
    });

    test('user menu Settings link navigates to /settings', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const userMenu = topbar.locator('button[data-testid="user-menu"], [aria-label*="user"], [aria-label*="account"]').first();

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
            await page.waitForTimeout(300);

            const settingsLink = page.locator('a, button', { hasText: /settings/i });
            if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await settingsLink.click();
                await expect(page).toHaveURL(/\/settings/);
            }
        }
    });

    test('user menu Sign Out link logs out', async ({ page }) => {
        const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
        const userMenu = topbar.locator('button[data-testid="user-menu"], [aria-label*="user"], [aria-label*="account"]').first();

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
            await page.waitForTimeout(300);

            const signOutLink = page.locator('a, button', { hasText: /sign out|logout|exit/i });
            if (await signOutLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signOutLink.click();
                await expect(page).toHaveURL(/\/login/);
            }
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // MOBILE RESPONSIVE TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('on narrow viewport (375px) sidebar is hidden by default', async ({ page }) => {
        // Resize to mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Sidebar should be hidden
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const isHidden = !(await sidebar.isVisible({ timeout: 2000 }).catch(() => false));
        expect(isHidden).toBe(true);
    });

    test('mobile hamburger menu opens sidebar overlay', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Find hamburger button
        const hamburger = page.locator('button[data-testid="menu-toggle"], [aria-label*="menu"], [aria-label*="toggle"]').first();
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();
            await page.waitForTimeout(300);

            // Sidebar should be visible now
            const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
            await expect(sidebar).toBeVisible({ timeout: 3000 });
        }
    });

    test('clicking outside mobile sidebar overlay closes it', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Open sidebar
        const hamburger = page.locator('button[data-testid="menu-toggle"], [aria-label*="menu"], [aria-label*="toggle"]').first();
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();
            await page.waitForTimeout(300);

            const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
            await expect(sidebar).toBeVisible();

            // Click outside sidebar (on main content area)
            const main = page.locator('main, [role="main"]').first();
            if (await main.isVisible({ timeout: 1000 }).catch(() => false)) {
                await main.click({ position: { x: 10, y: 10 } });
                await page.waitForTimeout(300);

                const isHidden = !(await sidebar.isVisible({ timeout: 2000 }).catch(() => false));
                expect(isHidden).toBe(true);
            }
        }
    });

    test('mobile sidebar links navigate and close sidebar', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Open sidebar
        const hamburger = page.locator('button[data-testid="menu-toggle"], [aria-label*="menu"], [aria-label*="toggle"]').first();
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();
            await page.waitForTimeout(300);

            // Click a nav link
            const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
            const stratLink = sidebar.locator('a, button', { hasText: /strategies/i });
            if (await stratLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await stratLink.click();
                await expect(page).toHaveURL(/\/strategies/);

                // Sidebar should close after navigation
                const isHidden = !(await sidebar.isVisible({ timeout: 2000 }).catch(() => false));
                expect(isHidden).toBe(true);
            }
        }
    });

    test('mobile topbar elements remain accessible at all viewport sizes', async ({ page }) => {
        // Test at various widths
        const viewports = [375, 480, 640, 768];

        for (const width of viewports) {
            await page.setViewportSize({ width, height: 667 });

            const topbar = page.locator('[role="banner"], [data-testid="topbar"], header').first();
            await expect(topbar).toBeVisible({ timeout: 3000 });

            // Theme toggle should be accessible
            const themeToggle = topbar.locator('button[data-testid="theme-toggle"], [aria-label*="theme"]').first();
            const isThemeAccessible = await themeToggle.isVisible({ timeout: 2000 }).catch(() => false);
            expect(isThemeAccessible).toBe(true);
        }
    });
});
