import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Register page (/register).
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
        // p-password: target the inner <input> inside the p-password host
        this.password        = page.locator('#password input').or(page.locator('input[formcontrolname="password"]'));
        this.confirmPassword = page.locator('#confirmPassword input').or(page.locator('input[formcontrolname="confirmPassword"]'));
        // PrimeNG p-checkbox: target the visible checkbox wrapper (clicking the hidden input won't work)
        this.tosCheckbox     = page.locator('p-checkbox[formcontrolname="tosAccepted"]').first();
        this.submit          = page.locator('p-button[type="submit"] button').or(page.locator('button', { hasText: 'Create account' }));
        this.error           = page.locator('p-message[severity="error"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/register');
        await expect(this.page.locator('h2', { hasText: 'Create account' })).toBeVisible({ timeout: 15_000 });
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
        // Click elsewhere to dismiss PrimeNG password strength popup
        await this.email.click();
        await this.page.waitForTimeout(300);
        await this.confirmPassword.fill(params.password);
        // Click elsewhere to dismiss any popup
        await this.email.click();
        await this.page.waitForTimeout(300);
        // PrimeNG checkbox needs a click on the visual element
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
