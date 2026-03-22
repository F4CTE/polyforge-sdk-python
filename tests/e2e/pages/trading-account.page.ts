import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Trading Account settings page (/settings/trading-account).
 *
 * Updated for React + shadcn frontend (replaces Angular + PrimeNG).
 * The page uses plain HTML inputs with show/hide toggle buttons for
 * sensitive fields, and a status badge in the header area.
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
        // React renders plain <input> elements with placeholder text
        // Private key is an input (type toggles text/password) with placeholder "0x..."
        // It is the first "0x..." placeholder input (the second is Safe Address which is always type="text")
        this.privateKeyInput    = page.locator('input[placeholder="0x..."]').first();
        this.apiKeyInput        = page.locator('input[placeholder="API Key"]');
        this.apiSecretInput     = page.locator('input[placeholder="API Secret"]');
        this.apiPassphraseInput = page.locator('input[placeholder="Passphrase"]');
        this.safeAddressInput   = page.locator('input[placeholder="0x..."]').last();
        this.connectButton      = page.locator('button', { hasText: 'Connect Account' });
        this.disconnectButton   = page.locator('button', { hasText: 'Disconnect Account' });
        // Status badge is a span with rounded-full containing "Connected" or "Not Connected"
        this.statusBadge        = page.locator('span.rounded-full').filter({ hasText: /Connected|Not Connected/ });
    }

    async goto(): Promise<void> {
        await this.page.goto('/settings/trading-account');
        await expect(this.page.locator('h1', { hasText: 'Trading Account' })).toBeVisible({ timeout: 15_000 });
        // Wait for status badge to appear (indicates auth state resolved)
        await expect(this.statusBadge).toBeVisible({ timeout: 10_000 });
    }

    async isConnected(): Promise<boolean> {
        const text = (await this.statusBadge.textContent()) ?? '';
        return text.includes('Connected') && !text.includes('Not Connected');
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
