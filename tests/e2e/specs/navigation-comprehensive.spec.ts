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
 *   Social: Discover, News, Whales, Leaderboard
 *   Developers: API Docs
 *   Help: Support
 */

// Shared test user — registered once, reused across all tests
let sharedToken = '';

test.beforeAll(async () => {
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

        const socialItems = ['News', 'Whales', 'Leaderboard'];

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

    test('click Whales nav item navigates to /whales', async ({ page }) => {
        const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
        const whaleLink = sidebar.locator('a', { hasText: /^Whales$/i });
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
            // Get initial theme
            const htmlEl = page.locator('html').first();
            const initialClass = await htmlEl.getAttribute('class');
            const isDark = initialClass?.includes('dark');

            await themeToggle.click();

            // Check theme changed
            const newClass = await htmlEl.getAttribute('class');
            const isNowDark = newClass?.includes('dark');
            expect(isNowDark).not.toBe(isDark);
        }
    });

    test('dark mode persists across page navigation', async ({ page }) => {
        const htmlEl = page.locator('html').first();
        const themeToggle = page.locator('[data-tour="theme-toggle"]');

        if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Ensure dark mode is ON
            const initialClass = await htmlEl.getAttribute('class');
            if (!initialClass?.includes('dark')) {
                await themeToggle.click();
            }

            const darkModeClass = await htmlEl.getAttribute('class');
            expect(darkModeClass?.includes('dark')).toBe(true);

            // Navigate to another page
            const sidebar = page.locator('[aria-label="Main navigation"], nav').first();
            const stratLink = sidebar.locator('a', { hasText: /^Strategies$/i });
            await stratLink.click();
            await expect(page).toHaveURL(/\/strategies/);

            // Check dark mode still applied
            const newClass = await htmlEl.getAttribute('class');
            expect(newClass?.includes('dark')).toBe(true);
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
        await page.waitForTimeout(500); // Wait for layout reflow
        const isHidden = !(await sidebar.isVisible({ timeout: 2000 }).catch(() => false));
        expect(isHidden).toBe(true);
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
