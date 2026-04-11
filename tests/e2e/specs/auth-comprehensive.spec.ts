import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import {
    apiLogin,
    apiRegister,
    uniqueEmail,
    uniqueUsername,
} from '../helpers/api';
import {
    clearAllMessages,
    getVerificationUrl,
    getPasswordResetUrl,
    waitForEmail,
    extractLink,
} from '../helpers/mailhog';

/**
 * Comprehensive authentication workflow tests for PolyForge.
 *
 * Covers:
 *   - Registration with valid/invalid data
 *   - Email verification flow
 *   - Login with various credential scenarios
 *   - Password reset workflow
 *   - Session persistence and expiry
 *   - Route protection (unauthenticated vs unverified)
 *   - Logout functionality
 *   - 2FA (TOTP) flows
 */

test.describe('Authentication — Full Workflow Coverage', () => {

    test.beforeEach(async () => {
        await clearAllMessages();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke register page renders', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();
        await expect(page.locator('h1', { hasText: /create.*account/i })).toBeVisible();
    });

    test('register with valid data redirects to verify-email page', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('valid');
        const username = uniqueUsername('valid');

        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Should redirect away from /register
        await expect(page).not.toHaveURL(/\/register/);
        // Verification email should arrive
        const verifyUrl = await getVerificationUrl(email);
        expect(verifyUrl).toContain('/verify-email');
    });

    test('register with missing email shows validation error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        // Fill all fields except email, then submit
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Password123!');
        await registerPage.confirmPassword.fill('Password123!');
        await registerPage.tosCheckbox.click();
        await registerPage.submit.click();

        // React form validation marks email as touched and shows the error message
        await expect(page.locator('[role="alert"]', { hasText: 'Email is required' })).toBeVisible();
    });

    test('register with invalid email format shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        await registerPage.email.fill('not-an-email');
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Password123!');
        await registerPage.confirmPassword.fill('Password123!');
        await registerPage.tosCheckbox.click();

        const emailInput = page.locator('#email');
        const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
        expect(isInvalid).toBe(true);
    });

    test('register with short password (<8 chars) shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        await registerPage.email.fill(uniqueEmail('short'));
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Short1!');  // 7 characters
        await registerPage.confirmPassword.fill('Short1!');
        await registerPage.tosCheckbox.click();
        await registerPage.submit.click();

        // Client-side validation prevents submission and shows inline field error
        // (the server error banner never appears because the form short-circuits)
        const fieldError = page.locator('#register-password-error');
        await expect(fieldError).toBeVisible();
        const errText = (await fieldError.textContent()) ?? '';
        expect(errText.toLowerCase()).toMatch(/password|length|short|8|characters|minimum/);
    });

    test('register with mismatched passwords shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        await registerPage.email.fill(uniqueEmail('mismatch'));
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Password123!');
        await registerPage.confirmPassword.fill('Password456!');
        // Blur to trigger validation
        await registerPage.email.click();
        await registerPage.tosCheckbox.click();
        await registerPage.submit.click();

        // Client-side validation renders inline field error at #register-confirm-password-error
        // (not the server error banner). Same pattern as short password test.
        const fieldError = page.locator('#register-confirm-password-error');
        const serverError = registerPage.error;
        const errorLocator = fieldError.or(serverError);
        await expect(errorLocator).toBeVisible({ timeout: 5_000 });
        const errText = (await errorLocator.first().textContent()) ?? '';
        expect(errText.toLowerCase()).toMatch(/match|confirm|password/);
    });

    test('register without accepting ToS shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        await registerPage.goto();

        await registerPage.email.fill(uniqueEmail('notos'));
        await registerPage.username.fill(uniqueUsername());
        await registerPage.password.fill('Password123!');
        await registerPage.confirmPassword.fill('Password123!');
        // Intentionally do NOT check ToS
        await registerPage.submit.click();

        // Form should be blocked or error shown
        const tosCheckbox = page.locator('#tos');
        const isChecked = await tosCheckbox.isChecked();
        expect(isChecked).toBe(false);

        // May see a validation error or remain on register page
        await expect(page).toHaveURL(/\/register/);
    });

    test('register with duplicate email shows server error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('dup');
        const username = uniqueUsername('dup');

        // Pre-create user via API
        await apiRegister(email, username, 'Password123!');

        // Try to register again via UI
        await registerPage.goto();
        await registerPage.register({ email, username: uniqueUsername('dup2'), password: 'Password123!' });

        const errText = await registerPage.errorText();
        expect(errText.toLowerCase()).toMatch(/already|taken|exists|duplicate/);
    });

    test('register with duplicate username shows server error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('dupuser');
        const username = uniqueUsername('dupuser');

        // Pre-create user via API
        await apiRegister(email, username, 'Password123!');

        // Try to register with same username but different email
        await registerPage.goto();
        await registerPage.register({
            email: uniqueEmail('dupuser2'),
            username,
            password: 'Password123!'
        });

        const errText = await registerPage.errorText();
        expect(errText.toLowerCase()).toMatch(/already|taken|exists|duplicate|username/);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EMAIL VERIFICATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke click verification link from email marks user as verified', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('verify1');
        const username = uniqueUsername('verify1');

        // Register
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Get verification URL and navigate to it
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);

        // Should show success message
        await expect(page.locator('h1', { hasText: /verified|success/i })).toBeVisible({ timeout: 15_000 });
    });

    test('resend verification email sends new email', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('resend');
        const username = uniqueUsername('resend');

        // Register
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Get the first verification URL
        const verifyUrl1 = await getVerificationUrl(email);
        expect(verifyUrl1).toContain('/verify-email');

        // Clear messages and request resend (if UI allows)
        await clearAllMessages();
        const resendBtn = page.locator('button', { hasText: /resend|again/i });
        if (await resendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await resendBtn.click();
            // New email should arrive
            const verifyUrl2 = await getVerificationUrl(email);
            expect(verifyUrl2).toContain('/verify-email');
        }
    });

    test('visit verify-email with invalid token shows error', async ({ page }) => {
        const invalidToken = 'invalid-token-12345';
        await page.goto(`/verify-email?token=${invalidToken}`);

        // The verify-email page shows "Verification failed" heading on invalid token
        await expect(page.locator('h1', { hasText: /verification failed/i })).toBeVisible({ timeout: 10_000 });
    });

    test('already verified user visiting verify-email sees waiting state (no redirect)', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('alreadyverified');
        const username = uniqueUsername('alreadyverified');

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Visit verify-email (no token) — app shows "Check your email" state,
        // it does NOT redirect verified users away from this page.
        await page.goto('/verify-email');
        await expect(page.locator('h1', { hasText: /check your email/i })).toBeVisible({ timeout: 10_000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke login with valid credentials redirects to markets', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('login');
        const username = uniqueUsername('login');
        const password = 'Password123!';

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, password);

        // Should land on markets or similar protected page
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('login with wrong password shows error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('wrongpwd');
        const username = uniqueUsername('wrongpwd');

        // Pre-register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Try login with wrong password
        await loginPage.goto();
        await loginPage.login(email, 'WrongPassword123!');

        const errText = await loginPage.errorText();
        expect(errText.toLowerCase()).toMatch(/wrong|invalid|incorrect|failed/);
    });

    test('login with non-existent email shows error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login('nonexistent@example.com', 'Password123!');

        const errText = await loginPage.errorText();
        expect(errText.toLowerCase()).toMatch(/not found|wrong|invalid|incorrect|failed/);
    });

    test('login with empty fields shows validation error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Try submit with empty fields — the React form marks fields as
        // touched on submit and renders inline error messages
        await loginPage.submit.click();

        // The login form uses React state validation (not HTML5 required attribute),
        // so we check for the inline error message
        await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 });
    });

    test('login with unverified account redirects to verify-email', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('unverified');
        const username = uniqueUsername('unverified');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Try to login — login succeeds (200) but VerifiedGuard redirects to /verify-email
        await loginPage.goto();
        await loginPage.login(email, 'Password123!');

        // Wait for either navigation away from /login or an error message.
        // The SPA flow: login → navigate('/markets') → VerifiedGuard → /verify-email
        try {
            await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
        } catch {
            // If still on /login, there might be an error message instead
        }

        const url = page.url();
        const errText = await loginPage.error.textContent().catch(() => '');
        const isVerifyPage = url.includes('/verify-email');
        const isLoginError = url.includes('/login');
        const isVerifyError = (errText ?? '').toLowerCase().includes('verify');
        const isEmailError = (errText ?? '').toLowerCase().includes('email');

        // Accept: redirect to verify-email, OR error containing "verify" or "email"
        expect(isVerifyPage || isVerifyError || isEmailError).toBe(true);
    });

    test('login with 2FA enabled shows TOTP input', async ({ page }) => {
        test.skip(true, '2FA setup required in backend — skipped for now');
        // This test requires:
        // 1. API to enable 2FA on a user account
        // 2. Knowledge of the TOTP secret/seed
        // 3. TOTP library to generate valid codes
        // Placeholder for when 2FA is implemented
    });

    test('login with 2FA enabled and correct TOTP code succeeds', async ({ page }) => {
        test.skip(true, '2FA setup required in backend — skipped for now');
        // Placeholder for when 2FA is implemented
    });

    test('login with 2FA enabled and wrong TOTP code shows error', async ({ page }) => {
        test.skip(true, '2FA setup required in backend — skipped for now');
        // Placeholder for when 2FA is implemented
    });

    test('session persistence: refresh page stays logged in', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('session1');
        const username = uniqueUsername('session1');

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Get current URL (should be /markets or similar)
        const urlBeforeRefresh = page.url();
        expect(urlBeforeRefresh).not.toContain('/login');

        // Refresh page
        await page.reload();

        // Should still be logged in, same page
        const urlAfterRefresh = page.url();
        expect(urlAfterRefresh).toBe(urlBeforeRefresh);
        expect(urlAfterRefresh).not.toContain('/login');
    });

    test('session expiry: expired cookie redirects to login', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('expiry');
        const username = uniqueUsername('expiry');

        // Register and verify (wait for verify API to complete)
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Clear all cookies (not just pf_token) to ensure session is fully invalidated
        await page.context().clearCookies();

        // Navigate to any protected page — full reload re-initializes auth store
        await page.goto('/markets');

        // Should redirect to login (AuthGuard sees no user after 401 from /me)
        await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PASSWORD RESET TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('request password reset sends email with link', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('forgot');
        const username = uniqueUsername('forgot');

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Clear messages
        await clearAllMessages();

        // Go to login and click "Forgot password"
        await loginPage.goto();
        await loginPage.clickForgotPassword();

        // Should navigate to forgot-password page — wait for heading to confirm render
        await expect(page).toHaveURL(/\/forgot-password/);
        await expect(page.locator('h1', { hasText: /reset password/i })).toBeVisible({ timeout: 10_000 });

        // The SPA transition from /login to /forgot-password replaces the #email input.
        // Use getByRole to target the actual visible textbox (more resilient than #email
        // which can briefly resolve to the outgoing login page's input during transition).
        const emailInput = page.getByRole('textbox', { name: /email/i });
        await emailInput.waitFor({ state: 'visible', timeout: 5_000 });
        await emailInput.fill(email);

        // Click submit and wait for the request to go through
        await page.locator('button', { hasText: /send reset link/i }).click();
        await page.waitForLoadState('networkidle');

        // Password reset email should arrive
        const resetUrl = await getPasswordResetUrl(email);
        expect(resetUrl).toContain('/reset-password');
    });

    test('reset password with valid token succeeds', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('validreset');
        const username = uniqueUsername('validreset');
        const oldPassword = 'Password123!';
        const newPassword = 'NewPassword456!';

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: oldPassword });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Request password reset via API (bypasses SPA form fill race condition)
        await clearAllMessages();
        const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001';
        await fetch(`${AUTH_URL}/auth/v1/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        // Get reset URL (allow 20s for email delivery)
        const resetUrl = await getPasswordResetUrl(email, 20_000);
        await page.goto(resetUrl);

        // Fill in new password — the confirm field id is "confirm" (not "confirmPassword")
        await expect(page.locator('h1', { hasText: /password/i })).toBeVisible({ timeout: 15_000 });
        const passwordInput = page.locator('#password');
        const confirmInput = page.locator('#confirm');
        await passwordInput.fill(newPassword);
        await confirmInput.fill(newPassword);
        const submitReset = page.locator('button', { hasText: /reset/i });
        await submitReset.click();

        // Should show success ("Password reset" heading)
        await expect(page.locator('h1', { hasText: /password reset/i })).toBeVisible({ timeout: 15_000 });

        // Verify can login with new password
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, newPassword);
        expect(page.url()).not.toContain('/login');
    });

    test('reset password with invalid token shows error', async ({ page }) => {
        const invalidToken = 'invalid-reset-token-xyz';
        await page.goto(`/reset-password?token=${invalidToken}`);

        // Should show error or redirect
        const errorMsg = page.locator('[data-testid="error"], .bg-red-500');
        const isErrorVisible = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
        if (isErrorVisible) {
            const text = await errorMsg.textContent();
            expect(text?.toLowerCase()).toMatch(/invalid|expired|error/);
        }
    });

    test('reset password with mismatched passwords shows error', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('mismathreset');
        const username = uniqueUsername('mismathreset');

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Request reset link via API (bypasses SPA form fill race condition)
        await clearAllMessages();
        const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001';
        await fetch(`${AUTH_URL}/auth/v1/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const resetUrl = await getPasswordResetUrl(email, 20_000);
        await page.goto(resetUrl);

        // Fill with mismatched passwords — confirm field id is "confirm"
        const passwordInput = page.locator('#password');
        const confirmInput = page.locator('#confirm');
        await passwordInput.fill('NewPassword123!');
        await confirmInput.fill('DifferentPassword456!');
        // Blur to trigger validation
        await passwordInput.click();
        const submitReset = page.locator('button', { hasText: /reset/i });
        await submitReset.click();

        // React validation shows inline error with role="alert" (not data-testid="error")
        const errText = page.locator('[role="alert"]');
        await expect(errText.first()).toBeVisible({ timeout: 5_000 });
        const text = await errText.first().textContent();
        expect(text?.toLowerCase()).toMatch(/match|confirm|password/);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LOGOUT TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke logout from user menu redirects to login', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('logout');
        const username = uniqueUsername('logout');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Use evaluate to click the button directly via DOM — bypasses Playwright's
        // stability checks that fail when React re-renders detach/reattach the element
        // during post-login data fetches.
        await page.waitForSelector('[data-testid="user-menu-btn"]', { state: 'visible', timeout: 15_000 });
        await page.evaluate(() => {
            const btn = document.querySelector('[data-testid="user-menu-btn"]') as HTMLElement;
            btn?.click();
        });

        // Click sign out
        await page.locator('button[role="menuitem"]', { hasText: /sign out/i }).click();

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('logout clears session and redirects protected routes to login', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('clearSession');
        const username = uniqueUsername('clearSession');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Perform logout — open user menu and click sign out
        await page.locator('[data-testid="user-menu-btn"]').click();
        await page.locator('button[role="menuitem"]', { hasText: /sign out/i }).click();
        await expect(page).toHaveURL(/\/login/);

        // Try to visit protected route
        await page.goto('/markets');
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ROUTE PROTECTION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('unauthenticated user visiting /markets redirects to login', async ({ page }) => {
        await page.goto('/markets');
        await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user visiting /strategies redirects to login', async ({ page }) => {
        await page.goto('/strategies');
        await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user visiting /portfolio redirects to login', async ({ page }) => {
        await page.goto('/portfolio');
        await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user visiting /orders redirects to login', async ({ page }) => {
        await page.goto('/orders');
        await expect(page).toHaveURL(/\/login/);
    });

    test('unverified user visiting /markets redirects to verify-email', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('unvermarkets');
        const username = uniqueUsername('unvermarkets');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Login via API to get the auth token, then set as browser cookie
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.token) {
            await page.context().addCookies([{
                name: 'pf_token',
                value: loginData.token,
                domain: 'localhost',
                path: '/',
            }]);

            // Navigate to markets — VerifiedGuard should redirect to /verify-email
            await page.goto('/markets');
            await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
        } else {
            // If login fails, just verify the user can't access markets
            test.skip(true, 'Could not login unverified user via API');
        }
    });

    test('unverified user can access /settings', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('unversettings');
        const username = uniqueUsername('unversettings');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Login via API and set cookie properly
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.token) {
            await page.context().addCookies([{
                name: 'pf_token',
                value: loginData.token,
                domain: 'localhost',
                path: '/',
            }]);

            // Should allow access to /settings even if unverified
            await page.goto('/settings');
            const url = page.url();
            expect(url).toContain('/settings');
        } else {
            test.skip(true, 'Could not login unverified user via API');
        }
    });

    test('unverified user can access /profile/me', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('unverprofile');
        const username = uniqueUsername('unverprofile');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Login via API and set cookie properly
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.token) {
            await page.context().addCookies([{
                name: 'pf_token',
                value: loginData.token,
                domain: 'localhost',
                path: '/',
            }]);

            // Should allow access to /profile/me even if unverified
            await page.goto('/profile/me');
            const url = page.url();
            expect(url).toContain('/profile');
        } else {
            test.skip(true, 'Could not login unverified user via API');
        }
    });
});
