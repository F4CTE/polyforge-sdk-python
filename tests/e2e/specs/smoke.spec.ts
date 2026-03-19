import { test, expect } from '@playwright/test';
import { LoginPage }    from '../pages/login.page';
import { apiLogin }     from '../helpers/api';

/**
 * Smoke tests — @smoke
 *
 * Run with: pnpm --filter @polyforge/e2e test:smoke
 *
 * These tests verify that the app is reachable, the login flow works,
 * and key authenticated routes are accessible.
 *
 * They rely on the pre-seeded alice@dev.local / password123 user
 * (active + verified, no Polymarket credentials required).
 */

const ALICE_EMAIL    = 'alice@dev.local';
const ALICE_PASSWORD = 'password123';

test.describe('Smoke', () => {

    test('@smoke app loads and redirects unauthenticated user to login', async ({ page }) => {
        // Navigate to a protected route — should redirect to /login
        await page.goto('/strategies');
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible();
    });

    test('@smoke login page renders correctly', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await expect(loginPage.email).toBeVisible();
        await expect(loginPage.password).toBeVisible();
        await expect(loginPage.submit).toBeEnabled();
    });

    test('@smoke successful login redirects to app', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);
        // Should land somewhere inside the app (not login)
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('@smoke strategies page is accessible after login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);
        await page.goto('/strategies');
        await expect(page.locator('h1', { hasText: 'My Strategies' })).toBeVisible();
    });

    test('@smoke settings page is accessible after login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);
        await page.goto('/settings');
        await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
    });

    test('@smoke sidebar navigation links are visible', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);
        // Sidebar nav items
        await expect(page.locator('.app-sidebar .nav-item', { hasText: 'Strategies' })).toBeVisible();
        await expect(page.locator('.app-sidebar .nav-item', { hasText: 'Markets' })).toBeVisible();
    });

    test('@smoke direct API health check — auth-service responds', async () => {
        // Bypass the browser — quick sanity check via API helper
        const resp = await apiLogin(ALICE_EMAIL, ALICE_PASSWORD);
        expect(resp.user.email).toBe(ALICE_EMAIL);
        expect(resp.user.id).toBeTruthy();
    });

});
