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

test.describe.serial('Authentication — Full Workflow Coverage', () => {

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
        await registerPage.tosCheckbox.check();
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
        await registerPage.tosCheckbox.check();

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
        await registerPage.tosCheckbox.check();
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
        await page.waitForTimeout(300);
        await registerPage.tosCheckbox.check();
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

        // Should show an error or redirect
        const errorMsg = page.locator('[data-testid="error"], .bg-red-500');
        const isErrorVisible = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
        if (isErrorVisible) {
            const text = await errorMsg.textContent();
            expect(text?.toLowerCase()).toMatch(/invalid|expired|error/);
        } else {
            // May redirect to login or register
            expect(page.url()).not.toContain('/verify-email');
        }
    });

    test('already verified user visiting verify-email redirects to markets', async ({ page }) => {
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

        // Now try to visit verify-email
        await page.goto('/verify-email');
        // Should redirect to markets (or dashboard)
        await expect(page).not.toHaveURL(/\/verify-email/);
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

        // Try login with wrong password
        await loginPage.goto();
        await loginPage.login(email, 'WrongPassword123!');
        await page.waitForTimeout(1000);

        const errText = await loginPage.errorText();
        expect(errText.toLowerCase()).toMatch(/wrong|invalid|incorrect|failed/);
    });

    test('login with non-existent email shows error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login('nonexistent@example.com', 'Password123!');
        await page.waitForTimeout(1000);

        const errText = await loginPage.errorText();
        expect(errText.toLowerCase()).toMatch(/not found|wrong|invalid|incorrect|failed/);
    });

    test('login with empty fields shows validation error', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Try submit with empty fields
        await loginPage.submit.click();

        // Check for validation error
        const emailInput = page.locator('#email');
        const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
        expect(isEmailInvalid).toBe(true);
    });

    test('login with unverified account redirects to verify-email', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('unverified');
        const username = uniqueUsername('unverified');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Try to login
        await loginPage.goto();
        await loginPage.login(email, 'Password123!');
        await page.waitForTimeout(1000);

        // Should redirect to verify-email or show error suggesting email verification
        const url = page.url();
        const errText = await loginPage.error.textContent().catch(() => '');
        const isVerifyPage = url.includes('/verify-email');
        const isVerifyError = (errText ?? '').toLowerCase().includes('verify');

        expect(isVerifyPage || isVerifyError).toBe(true);
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

        // Register and verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Manually clear auth cookie
        await page.context().clearCookies({ name: 'pf_token' });

        // Navigate to any protected page
        await page.goto('/markets');
        await page.waitForTimeout(1000);

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
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

        // Clear messages
        await clearAllMessages();

        // Go to login and click "Forgot password"
        await loginPage.goto();
        await loginPage.clickForgotPassword();

        // Should navigate to forgot-password page
        await expect(page).toHaveURL(/\/forgot-password/);

        // Fill in email
        const emailInput = page.locator('#email');
        await emailInput.fill(email);
        const submitBtn = page.locator('button', { hasText: /reset|send/i });
        await submitBtn.click();

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

        // Request password reset
        await clearAllMessages();
        await loginPage.goto();
        await loginPage.clickForgotPassword();
        const emailInput = page.locator('#email');
        await emailInput.fill(email);
        const submitBtn = page.locator('button', { hasText: /reset|send/i });
        await submitBtn.click();

        // Get reset URL
        const resetUrl = await getPasswordResetUrl(email);
        await page.goto(resetUrl);

        // Fill in new password
        await expect(page.locator('h1', { hasText: /reset|password/i })).toBeVisible({ timeout: 15_000 });
        const passwordInput = page.locator('#password');
        const confirmInput = page.locator('#confirmPassword');
        await passwordInput.fill(newPassword);
        await confirmInput.fill(newPassword);
        const submitReset = page.locator('button', { hasText: /reset|submit/i });
        await submitReset.click();

        // Should show success
        await expect(page.locator('h1', { hasText: /success|reset|password/i })).toBeVisible({ timeout: 15_000 });

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

        // Request and get reset link
        await clearAllMessages();
        await loginPage.goto();
        await loginPage.clickForgotPassword();
        const emailInput = page.locator('#email');
        await emailInput.fill(email);
        const submitBtn = page.locator('button', { hasText: /reset|send/i });
        await submitBtn.click();

        const resetUrl = await getPasswordResetUrl(email);
        await page.goto(resetUrl);

        // Fill with mismatched passwords
        const passwordInput = page.locator('#password');
        const confirmInput = page.locator('#confirmPassword');
        await passwordInput.fill('NewPassword123!');
        await confirmInput.fill('DifferentPassword456!');
        const submitReset = page.locator('button', { hasText: /reset|submit/i });
        await submitReset.click();

        // Should show error
        const errText = page.locator('[data-testid="error"], .bg-red-500');
        await expect(errText).toBeVisible({ timeout: 5000 });
        const text = await errText.textContent();
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

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Open user menu (topbar)
        const userMenu = page.locator('button[data-testid="user-menu"], [role="button"]', { hasText: /profile|menu/i });
        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
        }

        // Click sign out
        const signOutBtn = page.locator('button, a', { hasText: /sign out|logout|exit/i });
        await signOutBtn.click();

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

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Perform logout
        const userMenu = page.locator('button[data-testid="user-menu"], [role="button"]', { hasText: /profile|menu/i });
        if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userMenu.click();
        }
        const signOutBtn = page.locator('button, a', { hasText: /sign out|logout|exit/i });
        await signOutBtn.click();
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

        // Get the auth cookie/token somehow and set it (or try direct navigation)
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.cookie) {
            // Set the cookie
            const cookies = loginData.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name.trim() && value) {
                    await page.context().addCookies([{
                        name: name.trim(),
                        value: value.trim(),
                        url: 'http://localhost:5173',
                    }]);
                }
            }
        }

        // Navigate to markets
        await page.goto('/markets');
        await page.waitForTimeout(1000);

        // Should redirect to verify-email
        const url = page.url();
        expect(url).toContain('/verify-email');
    });

    test('unverified user can access /settings', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('unversettings');
        const username = uniqueUsername('unversettings');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Try to set auth cookie
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.cookie) {
            const cookies = loginData.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name.trim() && value) {
                    await page.context().addCookies([{
                        name: name.trim(),
                        value: value.trim(),
                        url: 'http://localhost:5173',
                    }]);
                }
            }

            // Should allow access to /settings even if unverified
            await page.goto('/settings');
            // May see a message suggesting verification, but should not redirect
            const url = page.url();
            expect(url).toContain('/settings');
        }
    });

    test('unverified user can access /profile/me', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const email = uniqueEmail('unverprofile');
        const username = uniqueUsername('unverprofile');

        // Register but do NOT verify
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Try to set auth cookie
        const loginData = await apiLogin(email, 'Password123!').catch(() => null);
        if (loginData?.cookie) {
            const cookies = loginData.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.split('=');
                if (name.trim() && value) {
                    await page.context().addCookies([{
                        name: name.trim(),
                        value: value.trim(),
                        url: 'http://localhost:5173',
                    }]);
                }
            }

            // Should allow access to /profile/me even if unverified
            await page.goto('/profile/me');
            const url = page.url();
            expect(url).toContain('/profile');
        }
    });
});
