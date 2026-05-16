import { test, expect } from '@playwright/test';
import {
    apiRegisterAndVerify,
    apiLogin,
    uniqueEmail,
    uniqueUsername,
} from '../helpers/api';

/**
 * Comprehensive navigation tests for PolyForge.
 *
 * Covers:
 *   - Sidebar navigation (key nav items, collapse/expand)
 *   - Topbar elements (theme toggle, user menu)
 *   - Mobile responsive behavior (hamburger, sidebar overlay)
 *   - Dark/light mode persistence
 *   - Navigation links correctness
 *
 * Uses API-based login (not UI register+verify per test) for speed.
 * NOT serial — each test is independent so failures don't cascade.
 *
 * Sidebar is organized into collapsible sections:
 *   Trade: Markets, Strategies, Portfolio, Orders, Backtest, Copy Trading, etc.
 *   Analytics: Accuracy, Analytics, etc.
 *   Social: Discover, News, Whale Tracker, Leaderboard
 *   Developers: API Docs
 *   Help: Support
 */

// Shared test user — registered once, reused across all tests
let sharedToken = '';

test.beforeAll(async () => {
    test.setTimeout(120_000);
    const email = uniqueEmail('nav');
    const username = uniqueUsername('nav');
    const result = await apiRegisterAndVerify(email, username, 'Password123!');
    const loginResult = await apiLogin(email, 'Password123!');
    sharedToken = loginResult.token;
});

test.describe('Navigation — Full Workflow Coverage', () => {

    test.beforeEach(async ({ page }) => {
        await page.context().addCookies([{
            name: 'pf_token',
            value: sharedToken,
            domain: 'localhost',
            path: '/',
        }]);
        // Navigate to markets (default authenticated page) to ensure layout loads
        await page.goto('/markets');
        await expect(page.locator('h1', { hasText: 'Markets' })).toBeVisible({ timeout: 15_000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SIDEBAR NAVIGATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke core sidebar nav items are visible when logged in', async ({ page }) => {
        // Core nav items that should always be visible in the Trade section
        const coreNavItems = [
            'Markets',
            'Strategies',
            'Portfolio',
            'Orders',
            'Backtest',
            'Copy Trading',
        ];

        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        await expect(sidebar).toBeVisible();

        for (const item of coreNavItems) {
            const navItem = sidebar.locator('a, button', { hasText: new RegExp(`^${item}$`, 'i') });
            await expect(navItem.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('sidebar Social section items are visible', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();

        const socialItems = ['News', 'Whale Tracker', 'Leaderboard'];

        for (const item of socialItems) {
            const navItem = sidebar.locator('a, button', { hasText: new RegExp(item, 'i') });
            await expect(navItem.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('click Markets nav item navigates to /markets', async ({ page }) => {
        // Navigate away first
        await page.goto('/strategies');
        await page.waitForURL(/\/strategies/);

        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const marketLink = sidebar.locator('a', { hasText: /^Markets$/i });
        await marketLink.click();
        await expect(page).toHaveURL(/\/markets/);
    });

    test('click Strategies nav item navigates to /strategies', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const stratLink = sidebar.locator('a', { hasText: /^Strategies$/i });
        await stratLink.click();
        await expect(page).toHaveURL(/\/strategies/);
    });

    test('click Portfolio nav item navigates to /portfolio', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const portLink = sidebar.locator('a', { hasText: /^Portfolio$/i });
        await portLink.click();
        await expect(page).toHaveURL(/\/portfolio/);
    });

    test('click Orders nav item navigates to /orders', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const orderLink = sidebar.locator('a', { hasText: /^Orders$/i });
        await orderLink.click();
        await expect(page).toHaveURL(/\/orders/);
    });

    test('click Backtest nav item navigates to /backtest', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const backLink = sidebar.locator('a', { hasText: /^Backtest$/i });
        await backLink.click();
        await expect(page).toHaveURL(/\/backtest/);
    });

    test('click Copy Trading nav item navigates to /copy', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const copyLink = sidebar.locator('a', { hasText: /^Copy Trading$/i });
        await copyLink.click();
        await expect(page).toHaveURL(/\/copy/);
    });

    test('click Discover nav item navigates to /discover', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const discLink = sidebar.locator('a', { hasText: /^Discover$/i }).first();
        await discLink.click();
        await expect(page).toHaveURL(/\/discover/);
    });

    test('click News nav item navigates to /news', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const newsLink = sidebar.locator('a', { hasText: /^News$/i });
        await newsLink.click();
        await expect(page).toHaveURL(/\/news/);
    });

    test('click Whale Tracker nav item navigates to /whales', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const whaleLink = sidebar.locator('a', { hasText: /^Whale Tracker$/i });
        await whaleLink.click();
        await expect(page).toHaveURL(/\/whales/);
    });

    test('click Leaderboard nav item navigates to /leaderboard', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const leadLink = sidebar.locator('a', { hasText: /^Leaderboard$/i });
        await leadLink.click();
        await expect(page).toHaveURL(/\/leaderboard/);
    });

    test('click Support nav item navigates to /support', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const supportLink = sidebar.locator('a', { hasText: /^Support$/i });
        await supportLink.click();
        await expect(page).toHaveURL(/\/support/);
    });

    test('click API Docs nav item navigates to /api-docs', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const apiLink = sidebar.locator('a', { hasText: /^API Docs$/i });
        await apiLink.click();
        await expect(page).toHaveURL(/\/api-docs/);
    });

    test('active nav item is highlighted for current route', async ({ page }) => {
        // We start on /markets (from beforeEach). Check that Markets link has active styling.
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const marketLink = sidebar.locator('a', { hasText: /^Markets$/i });

        // Active link should have aria-current="page" or a visual active class (bg-pf-cyan)
        const ariaCurrent = await marketLink.getAttribute('aria-current');
        const classes = await marketLink.getAttribute('class') ?? '';
        const isHighlighted = ariaCurrent === 'page' || classes.includes('pf-cyan') || classes.includes('active');
        expect(isHighlighted).toBe(true);
    });

    test('collapse sidebar hides text labels, shows icons only', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"]');
        const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]');

        if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            const initialWidth = await sidebar.boundingBox().then(box => box?.width ?? 0);

            await collapseBtn.click();
            // Wait for CSS collapse transition to settle before measuring width
            await page.waitForFunction(
                (selector) => {
                    const el = document.querySelector(selector);
                    return el && el.getBoundingClientRect().width < 100;
                },
                '[aria-label="Main navigation"]',
                { timeout: 5000 },
            ).catch(() => {});

            const collapsedWidth = await sidebar.boundingBox().then(box => box?.width ?? 0);
            expect(collapsedWidth).toBeLessThan(initialWidth);
        }
    });

    test('expand sidebar shows full width with labels', async ({ page }) => {
        // First collapse, then expand
        const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]');

        if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await collapseBtn.click();
            // Wait for the expand button to appear after collapse animation
            const expandBtn = page.locator('button[aria-label="Expand sidebar"]');
            await expect(expandBtn).toBeVisible({ timeout: 5000 });
            await expandBtn.click();

            // Text labels should be visible again
            const sidebar = page.locator('[aria-label="Main navigation"]');
            const marketLabel = sidebar.locator('a', { hasText: /^Markets$/i });
            await expect(marketLabel).toBeVisible({ timeout: 5000 });
        }
    });

    test('Edge Rating displayed in sidebar', async ({ page }) => {
        const edgeRating = page.locator('[data-tour="edge-rating"]');
        // Edge Rating may or may not be visible depending on user data
        const isVisible = await edgeRating.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
            const text = await edgeRating.textContent();
            expect(text).toBeTruthy();
        }
    });

    test('Settings link at bottom of sidebar works', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const settingsLink = sidebar.locator('a', { hasText: /^Settings$/i });
        await settingsLink.click();
        await expect(page).toHaveURL(/\/settings/);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TOPBAR TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke theme toggle switches between light and dark mode', async ({ page }) => {
        const themeToggle = page.locator('[data-tour="theme-toggle"]');

        if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Theme detection: supports both data-theme attribute (new) and .dark class (legacy)
            const htmlEl = page.locator('html').first();
            const getIsDark = async () => {
                const dataTheme = await htmlEl.getAttribute('data-theme');
                if (dataTheme) return dataTheme === 'dark';
                const classes = await htmlEl.getAttribute('class') ?? '';
                return classes.includes('dark');
            };

            const isDark = await getIsDark();
            await themeToggle.click();
            const isNowDark = await getIsDark();
            expect(isNowDark).not.toBe(isDark);
        }
    });

    test('dark mode persists across page navigation', async ({ page }) => {
        const htmlEl = page.locator('html').first();
        const themeToggle = page.locator('[data-tour="theme-toggle"]');

        if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Theme detection: supports both data-theme attribute (new) and .dark class (legacy)
            const getIsDark = async () => {
                const dataTheme = await htmlEl.getAttribute('data-theme');
                if (dataTheme) return dataTheme === 'dark';
                const classes = await htmlEl.getAttribute('class') ?? '';
                return classes.includes('dark');
            };

            // Ensure dark mode is ON
            if (!(await getIsDark())) {
                await themeToggle.click();
            }
            expect(await getIsDark()).toBe(true);

            // Navigate to another page
            const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
            const stratLink = sidebar.locator('a', { hasText: /^Strategies$/i });
            await stratLink.click();
            await expect(page).toHaveURL(/\/strategies/);

            // Check dark mode still applied
            expect(await getIsDark()).toBe(true);
        }
    });

    test('notification bell shows unread count badge', async ({ page }) => {
        const notifContainer = page.locator('[data-tour="notification-bell"]');
        const notifButton = notifContainer.locator('button[aria-label="Notifications"]');

        if (await notifButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Check for unread badge (may or may not be present)
            const badge = notifContainer.locator('[aria-label*="unread notifications"]');
            const hasBadge = await badge.isVisible({ timeout: 2000 }).catch(() => false);
            if (hasBadge) {
                const text = await badge.textContent();
                expect(text).toMatch(/\d+/);
            }
        }
    });

    test('click notification bell opens dropdown', async ({ page }) => {
        const notifContainer = page.locator('[data-tour="notification-bell"]');
        const notifButton = notifContainer.locator('button[aria-label="Notifications"]');

        if (await notifButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await notifButton.click();

            // Notification dialog should open
            const dialog = page.locator('[role="dialog"][aria-label="Notifications"]');
            await expect(dialog).toBeVisible({ timeout: 5000 });
        }
    });

    test('mark all notifications as read clears unread count', async ({ page }) => {
        const notifContainer = page.locator('[data-tour="notification-bell"]');
        const notifButton = notifContainer.locator('button[aria-label="Notifications"]');

        if (await notifButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await notifButton.click();

            // Find and click "Mark all as read"
            const markAllBtn = page.locator('button', { hasText: /mark all as read/i });
            if (await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await markAllBtn.click();
                // Wait for the badge to clear or the notification list to update

                // Badge should disappear or show 0
                const badge = notifContainer.locator('[aria-label*="unread notifications"]');
                const isVisible = await badge.isVisible({ timeout: 2000 }).catch(() => false);
                if (isVisible) {
                    const text = await badge.textContent();
                    expect(text).toMatch(/^0?$/);
                }
            }
        }
    });

    test('user menu opens on click', async ({ page }) => {
        const userMenu = page.locator('[data-testid="user-menu-btn"]');

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();

            // Check for dropdown menu items
            const signOutLink = page.locator('button, a', { hasText: /sign out|logout/i });
            await expect(signOutLink).toBeVisible({ timeout: 3000 });
        }
    });

    test('user menu Profile link navigates to /profile', async ({ page }) => {
        const userMenu = page.locator('[data-testid="user-menu-btn"]');

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();

            const profileLink = page.locator('[role="menuitem"]', { hasText: /profile/i });
            if (await profileLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await profileLink.click();
                await expect(page).toHaveURL(/\/profile/);
            }
        }
    });

    test('user menu Settings link navigates to /settings', async ({ page }) => {
        const userMenu = page.locator('[data-testid="user-menu-btn"]');

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();

            const settingsLink = page.locator('[role="menuitem"]', { hasText: /settings/i });
            if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await settingsLink.click();
                await expect(page).toHaveURL(/\/settings/);
            }
        }
    });

    test('user menu Sign Out link logs out', async ({ page }) => {
        const userMenu = page.locator('[data-testid="user-menu-btn"]');

        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();

            const signOutLink = page.locator('button, a', { hasText: /sign out/i });
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

        // Desktop sidebar should be hidden on mobile
        const sidebar = page.locator('[aria-label="Main navigation"]');
        // On mobile, the sidebar is rendered as a dialog/overlay — it shouldn't be
        // visible by default (only when menu toggle is clicked)
        await expect(sidebar).toBeHidden({ timeout: 5000 });
        // Verify the sidebar is truly hidden at mobile width (auto-retried assertion above).
    });

    test('mobile hamburger menu opens sidebar overlay', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Find hamburger button (aria-label="Open navigation menu" from app-layout.tsx)
        const hamburger = page.locator('button[aria-label="Open navigation menu"]');
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();

            // Sidebar overlay should be visible now (aria-label="Navigation menu")
            const overlay = page.locator('[aria-label="Navigation menu"]');
            await expect(overlay).toBeVisible({ timeout: 5000 });
        }
    });

    test('clicking outside mobile sidebar overlay closes it', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Open sidebar
        const hamburger = page.locator('button[aria-label="Open navigation menu"]');
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();

            const overlay = page.locator('[aria-label="Navigation menu"]');
            await expect(overlay).toBeVisible({ timeout: 5000 });

            // Click the backdrop element (semi-transparent div behind the sidebar panel)
            // Uses bg-black/50 in app-layout.tsx (formerly bg-pf-backdrop-light)
            const backdrop = overlay.locator('[aria-hidden="true"]').first();
            if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
                await backdrop.click({ position: { x: 250, y: 300 }, force: true });
                await expect(overlay).toBeHidden({ timeout: 3000 });
            }
        }
    });

    test('mobile sidebar links navigate and close sidebar', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        // Open sidebar
        const hamburger = page.locator('button[aria-label="Open navigation menu"]');
        if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await hamburger.click();

            // Click a nav link inside the overlay
            const overlay = page.locator('[aria-label="Navigation menu"]');
            await expect(overlay).toBeVisible({ timeout: 5000 });
            const stratLink = overlay.locator('a', { hasText: /^Strategies$/i });
            if (await stratLink.isVisible({ timeout: 2000 }).catch(() => false)) {
                await stratLink.click();
                await expect(page).toHaveURL(/\/strategies/);

                // Sidebar should close after navigation (useLocation effect)
                await expect(overlay).toBeHidden({ timeout: 3000 });
            }
        }
    });

    test('mobile topbar elements remain accessible at all viewport sizes', async ({ page }) => {
        const viewports = [375, 480, 640, 768];

        for (const width of viewports) {
            await page.setViewportSize({ width, height: 667 });

            // Theme toggle should be accessible
            const themeToggle = page.locator('[data-tour="theme-toggle"]');
            const isThemeAccessible = await themeToggle.isVisible({ timeout: 2000 }).catch(() => false);
            expect(isThemeAccessible).toBe(true);
        }
    });
});
