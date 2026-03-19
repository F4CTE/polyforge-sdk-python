import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Login page (/login).
 *
 * PrimeNG p-password wraps the actual <input> inside a component host;
 * we target the inner input via the parent id or placeholder.
 */
export class LoginPage {
    readonly page:     Page;
    readonly email:    Locator;
    readonly password: Locator;
    readonly submit:   Locator;
    readonly error:    Locator;
    readonly totpInput: Locator;

    constructor(page: Page) {
        this.page     = page;
        this.email    = page.locator('#email');
        // p-password renders an <input> inside the component; target via id
        this.password = page.locator('#password input').or(page.locator('input[formcontrolname="password"]'));
        this.submit   = page.locator('button', { hasText: 'Sign in' });
        this.error    = page.locator('p-message[severity="error"]');
        this.totpInput = page.locator('p-inputotp input').first();
    }

    async goto(): Promise<void> {
        await this.page.goto('/login');
        await expect(this.page.locator('h2', { hasText: 'Welcome back' })).toBeVisible({ timeout: 15_000 });
        // Dismiss cookie banner if present
        const cookieBtn = this.page.locator('button', { hasText: 'Got it' });
        if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cookieBtn.click();
        }
    }

    async login(email: string, password: string): Promise<void> {
        await this.email.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }

    /** Login and wait for navigation away from /login */
    async loginAndRedirect(email: string, password: string): Promise<void> {
        await this.login(email, password);
        await this.page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    }

    async errorText(): Promise<string> {
        await expect(this.error).toBeVisible();
        return (await this.error.textContent()) ?? '';
    }

    /** Navigate to register page via the link */
    async clickCreateAccount(): Promise<void> {
        await this.page.locator('a', { hasText: 'Create one' }).click();
    }

    async clickForgotPassword(): Promise<void> {
        await this.page.locator('a', { hasText: 'Forgot password?' }).click();
    }
}
