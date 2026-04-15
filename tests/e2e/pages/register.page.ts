import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Register page (/register).
 *
 * Updated for React + shadcn frontend (replaces Angular + PrimeNG).
 */
export class RegisterPage {
    readonly page:            Page;
    readonly email:           Locator;
    readonly username:        Locator;
    readonly password:        Locator;
    readonly confirmPassword: Locator;
    readonly tosCheckbox:     Locator;
    readonly submit:          Locator;
    readonly error:           Locator;

    constructor(page: Page) {
        this.page            = page;
        this.email           = page.locator('#email');
        this.username        = page.locator('#username');
        // React renders plain <input type="password"> with id attributes
        this.password        = page.locator('#password');
        this.confirmPassword = page.locator('#confirmPassword');
        // Standard HTML checkbox with id="tos"
        this.tosCheckbox     = page.locator('#tos');
        this.submit          = page.locator('button', { hasText: 'Create account' });
        // Error alert: styled div with AlertCircle icon (token migration: bg-pf-danger → bg-loss)
        this.error           = page.locator('div[role="alert"].bg-loss\\/10');
    }

    async goto(): Promise<void> {
        await this.page.goto('/register');
        await expect(this.page.locator('h1', { hasText: /create.*account/i })).toBeVisible({ timeout: 15_000 });
        // Dismiss cookie banner if present
        const cookieBtn = this.page.locator('button', { hasText: 'Got it' });
        if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cookieBtn.click();
        }
    }

    async register(params: {
        email:    string;
        username: string;
        password: string;
    }): Promise<void> {
        await this.email.fill(params.email);
        await this.username.fill(params.username);
        await this.password.fill(params.password);
        // Blur the password field to trigger validation and dismiss any popups
        await this.email.click();
        await this.confirmPassword.fill(params.password);
        // Blur confirm password field
        await this.email.click();
        // Use click() instead of check() — controlled React checkboxes
        // can reset DOM state before Playwright verifies the post-click state
        await this.tosCheckbox.click();
        await this.submit.click();
    }

    /** Register and wait for navigation away from /register */
    async registerAndRedirect(params: {
        email:    string;
        username: string;
        password: string;
    }): Promise<void> {
        await this.register(params);
        await this.page.waitForURL(url => !url.pathname.startsWith('/register'), { timeout: 10_000 });
    }

    async errorText(): Promise<string> {
        await expect(this.error).toBeVisible();
        return (await this.error.textContent()) ?? '';
    }
}
