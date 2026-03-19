import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Trading Account settings page (/settings/trading-account).
 */
export class TradingAccountPage {
    readonly page:              Page;
    readonly privateKeyInput:   Locator;
    readonly apiKeyInput:       Locator;
    readonly apiSecretInput:    Locator;
    readonly apiPassphraseInput: Locator;
    readonly safeAddressInput:  Locator;
    readonly connectButton:     Locator;
    readonly disconnectButton:  Locator;
    readonly statusBadge:       Locator;

    constructor(page: Page) {
        this.page               = page;
        // p-password wraps <input> — target inner input
        this.privateKeyInput    = page.locator('p-password').filter({ has: page.locator('input[placeholder="0x…"]') }).locator('input');
        this.apiKeyInput        = page.locator('input[placeholder="API Key"]');
        this.apiSecretInput     = page.locator('p-password').filter({ has: page.locator('input[placeholder="API Secret"]') }).locator('input');
        this.apiPassphraseInput = page.locator('p-password').filter({ has: page.locator('input[placeholder="Passphrase"]') }).locator('input');
        this.safeAddressInput   = page.locator('input[placeholder="0x…"]').last(); // plain input, not p-password
        this.connectButton      = page.locator('button', { hasText: 'Connect Account' });
        this.disconnectButton   = page.locator('button', { hasText: 'Disconnect Account' });
        this.statusBadge        = page.locator('.trading-status-badge');
    }

    async goto(): Promise<void> {
        await this.page.goto('/settings/trading-account');
        await expect(this.page.locator('h1', { hasText: 'Trading Account' })).toBeVisible({ timeout: 15_000 });
        // Wait for status badge to appear (indicates auth state resolved)
        await expect(this.statusBadge).toBeVisible({ timeout: 10_000 });
    }

    async isConnected(): Promise<boolean> {
        return this.statusBadge.locator('.pi-check-circle').isVisible();
    }

    async connect(params: {
        privateKey:    string;
        apiKey:        string;
        apiSecret:     string;
        apiPassphrase: string;
        safeAddress?:  string;
    }): Promise<void> {
        await this.privateKeyInput.fill(params.privateKey);
        await this.apiKeyInput.fill(params.apiKey);
        await this.apiSecretInput.fill(params.apiSecret);
        await this.apiPassphraseInput.fill(params.apiPassphrase);
        if (params.safeAddress) {
            await this.safeAddressInput.fill(params.safeAddress);
        }
        await this.connectButton.click();
    }

    async disconnect(): Promise<void> {
        await this.disconnectButton.click();
    }
}
