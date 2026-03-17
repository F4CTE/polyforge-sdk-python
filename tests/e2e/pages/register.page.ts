import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Register page (/register).
 */
export class RegisterPage {
    readonly page:     Page;
    readonly email:    Locator;
    readonly username: Locator;
    readonly password: Locator;
    readonly tosCheckbox: Locator;
    readonly submit:   Locator;
    readonly error:    Locator;

    constructor(page: Page) {
        this.page        = page;
        this.email       = page.locator('#email');
        this.username    = page.locator('#username');
        // p-password: target the inner <input> inside the p-password host
        this.password    = page.locator('#password input').or(page.locator('input[formcontrolname="password"]'));
        this.tosCheckbox = page.locator('#tos');
        this.submit      = page.locator('button', { hasText: 'Create account' });
        this.error       = page.locator('p-message[severity="error"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/register');
        await expect(this.page.locator('h2', { hasText: 'Create account' })).toBeVisible();
    }

    async register(params: {
        email:    string;
        username: string;
        password: string;
    }): Promise<void> {
        await this.email.fill(params.email);
        await this.username.fill(params.username);
        await this.password.fill(params.password);
        await this.tosCheckbox.check();
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
