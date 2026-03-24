import { test, expect } from '@playwright/test';
import { LoginPage }    from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import {
    apiRegister,
    uniqueEmail,
    uniqueUsername,
} from '../helpers/api';
import {
    clearAllMessages,
    getVerificationUrl,
    getPasswordResetUrl,
} from '../helpers/mailhog';

/**
 * Auth flow E2E tests.
 *
 * Covers:
 *   - Register → verify email → login
 *   - Login with wrong credentials (error shown)
 *   - Redirect to login if unauthenticated
 *   - Logout
 *   - Forgot password → email → reset link navigation
 */

test.describe('Auth flow', () => {

    test.beforeEach(async () => {
        await clearAllMessages();
    });

    // ─── Registration ──────────────────────────────────────────────────────────

    test('register page renders and navigates back to login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.clickCreateAccount();
        await expect(page).toHaveURL(/\/register/);
        await expect(page.locator('h2', { hasText: 'Create account' })).toBeVisible();
    });

    test('register with valid credentials sends verification email', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email    = uniqueEmail('reg');
        const username = uniqueUsername('reg');

        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // After registration, a verification email should be sent
        const verifyUrl = await getVerificationUrl(email);
        expect(verifyUrl).toContain('/verify-email');
    });

    test('full register → verify → login flow', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage    = new LoginPage(page);
        const email        = uniqueEmail('verify');
        const username     = uniqueUsername('verify');
        const password     = 'Password123!';

        // 1. Register
        await registerPage.goto();
        await registerPage.register({ email, username, password });

        // 2. Fetch verification link from MailHog and navigate to it
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);

        // 3. Verification page shows success
        await expect(page.locator('h2', { hasText: 'Email verified' })).toBeVisible({ timeout: 15_000 });

        // 4. Navigate to login and sign in with the new credentials
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, password);
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('register with duplicate email shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email    = uniqueEmail('dup');
        const username = uniqueUsername('dup');

        // Pre-create user via API
        await apiRegister(email, username, 'Password123!');

        // Try to register again via UI
        await registerPage.goto();
        await registerPage.register({ email, username: uniqueUsername('dup2'), password: 'Password123!' });

        const errText = await registerPage.errorText();
        expect(errText.toLowerCase()).toMatch(/already|taken|exists/);
    });

    test('register form blocks submit without TOS checkbox', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        await registerPage.email.fill(uniqueEmail());
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Password123!');
        await registerPage.email.click();
        await page.waitForTimeout(300);
        await registerPage.confirmPassword.fill('Password123!');
        await registerPage.email.click();
        await page.waitForTimeout(300);
        // Do NOT check TOS
        await registerPage.submit.click();

        // Should remain on /register (no redirect)
        await expect(page).toHaveURL(/\/register/);
    });

    // ─── Login ─────────────────────────────────────────────────────────────────

    test('login with wrong password shows error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login('alice@dev.local', 'wrongpassword');
        const err = await loginPage.errorText();
        expect(err.toLowerCase()).toMatch(/invalid|incorrect|credentials/);
    });

    test('login with unknown email shows error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login('nobody@nowhere.test', 'Password123!');
        const err = await loginPage.errorText();
        expect(err.toLowerCase()).toMatch(/invalid|not found|credentials/);
    });

    test('unauthenticated access to protected route redirects to login', async ({ page }) => {
        await page.goto('/strategies');
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        await expect(page).toHaveURL(/\/login/);
    });

    // ─── Logout ────────────────────────────────────────────────────────────────

    test('logout redirects to login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect('alice@dev.local', 'password123');

        // Open user menu dropdown and click Sign out
        await page.locator('[data-testid="user-menu-btn"]').click();
        await page.locator('button', { hasText: /sign out/i }).click();

        await expect(page).toHaveURL(/\/login/);
    });

    // ─── Forgot password ───────────────────────────────────────────────────────

    test('forgot password link is on login page', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await expect(page.locator('a', { hasText: 'Forgot password?' })).toBeVisible();
    });

    test('forgot password sends reset email and reset link navigates', async ({ page }) => {
        const email = uniqueEmail('reset');
        const username = uniqueUsername('reset');
        await apiRegister(email, username, 'Password123!');

        // Wait for the verification email to arrive, then clear all
        await new Promise(r => setTimeout(r, 2000));
        await clearAllMessages();

        // Navigate to forgot-password page
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.clickForgotPassword();
        await expect(page).toHaveURL(/\/forgot-password/);

        // Fill and submit email
        await page.locator('input[type="email"]').fill(email);
        await page.locator('button', { hasText: /send|reset/i }).click();

        // Get reset link from MailHog
        const resetUrl = await getPasswordResetUrl(email);
        expect(resetUrl).toContain('/reset-password');

        // Navigate to reset page — should not 404
        await page.goto(resetUrl);
        await expect(page.locator('h2, h1').first()).toBeVisible({ timeout: 8_000 });
    });

});
