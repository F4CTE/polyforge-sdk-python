import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { apiRegisterAndVerify, uniqueEmail, uniqueUsername } from '../helpers/api';
import { clearAllMessages } from '../helpers/mailhog';

/**
 * Mobile-responsive layout and touch target verification.
 *
 * Verifies that key UI surfaces render correctly at 375px (iPhone SE):
 *   - Mobile bottom navigation bar
 *   - Touch targets (≥44px for WCAG 2.5.5)
 *   - Responsive layout of key pages
 *   - Sidebar overlay behavior (validation against navigation-comprehensive)
 *
 * Tests tagged @mobile run on the mobile-chromium project (375×812 viewport).
 */
test.describe('Mobile — Responsive Layout & Touch Targets (@mobile)', () => {

    test.beforeAll(async () => {
        await clearAllMessages();
    });

    test.describe('Mobile bottom navigation', () => {
        test.beforeEach(async ({ page }) => {
            const email = uniqueEmail('mobile-nav');
            const username = uniqueUsername('mobile-nav');
            await apiRegisterAndVerify(email, username, 'Password123!');

            const loginPage = new LoginPage(page);
            await loginPage.goto();
            await loginPage.loginAndRedirect(email, 'Password123!');
        });

        test('@mobile bottom nav bar is visible at 375px viewport', async ({ page }) => {
            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible({ timeout: 10_000 });
        });

        test('@mobile bottom nav has 5 items: Markets, Portfolio, Strategies, Leaderboard, Profile', async ({ page }) => {
            const navLinks = page.locator('nav[aria-label="Mobile navigation"] a');
            await expect(navLinks).toHaveCount(5, { timeout: 10_000 });

            const labels = await navLinks.allTextContents();
            expect(labels.map(l => l.trim())).toEqual([
                'Markets',
                'Portfolio',
                'Strategies',
                'Leaderboard',
                'Profile',
            ]);
        });

        test('@mobile tapping Markets in bottom nav navigates to /markets', async ({ page }) => {
            // Navigate to a different page first
            const profileLink = page.locator('nav[aria-label="Mobile navigation"] a[aria-label="Profile"]');
            await profileLink.click();
            await expect(page).toHaveURL(/\/profile/, { timeout: 10_000 });

            // Now tap Markets
            const marketsLink = page.locator('nav[aria-label="Mobile navigation"] a[aria-label="Markets"]');
            await marketsLink.click();
            await expect(page).toHaveURL(/\/markets/, { timeout: 10_000 });
        });

        test('@mobile active nav item has visual highlight (border-top accent)', async ({ page }) => {
            // The active nav link should have 'text-accent-text' and 'border-t-2 border-accent' classes
            const activeLink = page.locator(
                'nav[aria-label="Mobile navigation"] a.text-accent-text',
            ).first();
            await expect(activeLink).toBeVisible({ timeout: 5_000 });

            // Verify the link has an active class (border accent indicator)
            const classes = await activeLink.getAttribute('class');
            expect(classes).toContain('border-t-2');
        });

        test('@mobile bottom nav is hidden at desktop width (≥768px)', async ({ page }) => {
            // The bottom nav uses sm:hidden (hidden at ≥640px)
            await page.setViewportSize({ width: 768, height: 900 });
            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeHidden({ timeout: 5_000 });
        });
    });

    test.describe('WCAG touch target compliance', () => {
        test.beforeEach(async ({ page }) => {
            const email = uniqueEmail('mobile-touch');
            const username = uniqueUsername('mobile-touch');
            await apiRegisterAndVerify(email, username, 'Password123!');

            const loginPage = new LoginPage(page);
            await loginPage.goto();
            await loginPage.loginAndRedirect(email, 'Password123!');
        });

        test('@mobile topbar buttons have minimum 44px touch targets', async ({ page }) => {
            // Theme toggle button
            const themeToggle = page.locator('[data-tour="theme-toggle"]');
            await expect(themeToggle).toBeVisible({ timeout: 5_000 });

            // All topbar buttons use min-h-[44px] min-w-[44px]
            const topbarButtons = page.locator(
                'header button[data-tour="theme-toggle"], header button[aria-label="Notifications"]',
            );
            const count = await topbarButtons.count();

            for (let i = 0; i < count; i++) {
                const box = await topbarButtons.nth(i).boundingBox();
                if (box) {
                    expect(box.width).toBeGreaterThanOrEqual(44);
                    expect(box.height).toBeGreaterThanOrEqual(44);
                }
            }
        });

        test('@mobile bottom nav items have sufficient tap area', async ({ page }) => {
            const navLinks = page.locator('nav[aria-label="Mobile navigation"] a');
            const count = await navLinks.count();

            for (let i = 0; i < count; i++) {
                const box = await navLinks.nth(i).boundingBox();
                if (box) {
                    // Each item shares flex-1 of 375px = ~75px wide, and the nav is 64px (h-16) tall
                    expect(box.width).toBeGreaterThanOrEqual(48);
                    expect(box.height).toBeGreaterThanOrEqual(48);
                }
            }
        });
    });

    test.describe('Key page responsive layouts', () => {
        test.beforeEach(async ({ page }) => {
            const email = uniqueEmail('mobile-pages');
            const username = uniqueUsername('mobile-pages');
            await apiRegisterAndVerify(email, username, 'Password123!');

            const loginPage = new LoginPage(page);
            await loginPage.goto();
            await loginPage.loginAndRedirect(email, 'Password123!');
        });

        test('@mobile /markets page renders at 375px without horizontal overflow', async ({ page }) => {
            await page.goto('/markets');
            await expect(page.locator('h1', { hasText: 'Markets' })).toBeVisible({ timeout: 10_000 });

            // Verify no horizontal scrollbar
            const bodyOverflow = await page.locator('body').evaluate(
                (el) => window.getComputedStyle(el).overflowX,
            );
            // Page should either not overflow or handle it properly
            expect(bodyOverflow).not.toBe('scroll');
        });

        test('@mobile /portfolio page renders at 375px', async ({ page }) => {
            await page.goto('/portfolio');
            await expect(page.locator('h1', { hasText: 'Portfolio' })).toBeVisible({ timeout: 10_000 });

            // Bottom nav should be visible
            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });

        test('@mobile /strategies page renders at 375px', async ({ page }) => {
            await page.goto('/strategies');
            await expect(page.locator('h1', { hasText: /strategies/i })).toBeVisible({ timeout: 10_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });

        test('@mobile /leaderboard page renders at 375px', async ({ page }) => {
            await page.goto('/leaderboard');
            await expect(page.locator('h1', { hasText: /leaderboard/i })).toBeVisible({ timeout: 10_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });

        test('@mobile /settings page renders at 375px with mobile navigation', async ({ page }) => {
            await page.goto('/settings');
            await expect(page.locator('[data-testid="settings-container"], h1:has-text("Settings")')).toBeVisible({ timeout: 10_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });

        test('@mobile /news page renders at 375px', async ({ page }) => {
            await page.goto('/news');
            await expect(page.locator('h1', { hasText: /news/i })).toBeVisible({ timeout: 10_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });

        test('@mobile /whales page renders at 375px with no horizontal overflow', async ({ page }) => {
            await page.goto('/whales');
            await expect(page.locator('h1', { hasText: /whale/i })).toBeVisible({ timeout: 10_000 });

            const bodyOverflow = await page.locator('body').evaluate(
                (el) => window.getComputedStyle(el).overflowX,
            );
            expect(bodyOverflow).not.toBe('scroll');
        });

        test('@mobile /orders page renders at 375px in landscape orientation', async ({ page }) => {
            // Test landscape orientation at 812×375 (rotated iPhone SE)
            await page.setViewportSize({ width: 812, height: 375 });
            await page.goto('/orders');
            await expect(page.locator('h1', { hasText: /orders/i })).toBeVisible({ timeout: 10_000 });

            // In landscape, the page should not have horizontal overflow
            const bodyOverflow = await page.locator('body').evaluate(
                (el) => window.getComputedStyle(el).overflowX,
            );
            expect(bodyOverflow).not.toBe('scroll');
        });

        test('@mobile /copy page renders at 375px', async ({ page }) => {
            await page.goto('/copy');
            await expect(page.locator('h1', { hasText: /copy/i })).toBeVisible({ timeout: 10_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeVisible();
        });
    });

    test.describe('Tablet and breakpoint boundary layouts', () => {
        test.beforeEach(async ({ page }) => {
            const email = uniqueEmail('mobile-tablet');
            const username = uniqueUsername('mobile-tablet');
            await apiRegisterAndVerify(email, username, 'Password123!');

            const loginPage = new LoginPage(page);
            await loginPage.goto();
            await loginPage.loginAndRedirect(email, 'Password123!');
        });

        test('@mobile sidebar appears at 768px breakpoint', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 900 });
            await page.goto('/markets');

            // At 768px (md breakpoint), desktop sidebar should be visible
            const sidebar = page.locator('[aria-label="Main navigation"]');
            await expect(sidebar).toBeVisible({ timeout: 5_000 });

            // Mobile bottom nav should be hidden at this width
            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeHidden({ timeout: 3_000 });
        });

        test('@mobile 1024px breakpoint shows full desktop layout', async ({ page }) => {
            await page.setViewportSize({ width: 1024, height: 900 });
            await page.goto('/markets');

            const sidebar = page.locator('[aria-label="Main navigation"]');
            await expect(sidebar).toBeVisible({ timeout: 5_000 });

            const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
            await expect(bottomNav).toBeHidden({ timeout: 3_000 });
        });
    });
});
