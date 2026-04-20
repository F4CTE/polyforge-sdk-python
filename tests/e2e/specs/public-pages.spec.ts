import { test, expect } from '@playwright/test';

/**
 * Public pages smoke tests — @smoke
 *
 * Verifies that public (unauthenticated) routes load correctly
 * without redirecting to /login.  These pages have no auth guard
 * and must remain accessible to users who are not logged in.
 *
 * Covers: /privacy, /terms, /api-docs
 */

test.describe('Public pages', () => {

    test('@smoke /privacy page renders correctly', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.locator('h1', { hasText: 'Privacy Policy' })).toBeVisible({ timeout: 15_000 });
        // Must not redirect to login
        await expect(page).not.toHaveURL(/\/login/);
        // Back navigation present
        await expect(page.locator('a', { hasText: /back/i }).first()).toBeVisible();
    });

    test('@smoke /terms page renders correctly', async ({ page }) => {
        await page.goto('/terms');
        await expect(page.locator('h1', { hasText: 'Terms of Service' })).toBeVisible({ timeout: 15_000 });
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('a', { hasText: /back/i }).first()).toBeVisible();
    });

    test('@smoke /api-docs page renders without auth', async ({ page }) => {
        await page.goto('/api-docs');
        // Should not redirect to login
        await expect(page).not.toHaveURL(/\/login/);
        // API docs content is present (any heading or key text)
        await expect(
            page.locator('h1, h2, [aria-label="API Reference"]').first()
        ).toBeVisible({ timeout: 15_000 });
    });

    test('/privacy page has accessible heading structure', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
        // At least one h2 section present
        await expect(page.locator('h2').first()).toBeVisible();
    });

    test('/terms page has accessible heading structure', async ({ page }) => {
        await page.goto('/terms');
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('h2').first()).toBeVisible();
    });

});
