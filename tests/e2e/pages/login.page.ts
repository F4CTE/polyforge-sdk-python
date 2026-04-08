import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Login page (/login).
 *
 * Updated for React + shadcn frontend (replaces Angular + PrimeNG).
 * Uses semantic selectors (id, type, role, text) where possible.
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
        // React renders a plain <input type="password"> with id="password"
        this.password = page.locator('#password');
        this.submit   = page.locator('button', { hasText: 'Sign in' });
        // Error alert: a div with AlertCircle icon and error text
        this.error    = page.locator('.bg-pf-danger\\/10');
        // TOTP input: plain <input id="totp"> shown conditionally
        this.totpInput = page.locator('#totp');
    }

    async goto(): Promise<void> {
        await this.page.goto('/login');
        await expect(this.page.locator('h1', { hasText: 'Welcome back' })).toBeVisible({ timeout: 15_000 });
        // Dismiss cookie banner if present
        const cookieBtn = this.page.locator('button', { hasText: 'Got it' });
        if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cookieBtn.click();
        }
        // The email input has autoFocus. Blurring it now pre-triggers the
        // "Email is required" validation layout shift so that any subsequent
        // link clicks are not disrupted by the card growing taller mid-click.
        await this.email.blur();
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
