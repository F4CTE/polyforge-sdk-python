import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Copy Trading setup wizard (/copy/setup).
 *
 * Handles the multi-step wizard for setting up copy trades:
 * Step 1 (Target): wallet address + whale selection
 * Step 2 (Mode): PERCENTAGE, FIXED, or MIRROR + size
 * Step 3 (Risk): max exposure, max daily loss, price offset
 * Step 4 (Review): summary + confirmation
 */
export class CopySetupPage {
    readonly page: Page;

    // Step 1 - Target
    readonly walletAddressInput: Locator;
    readonly whaleSelect: Locator;

    // Step 2 - Mode
    readonly modeSelect: Locator;
    readonly sizeInput: Locator;

    // Step 3 - Risk
    readonly maxExposureInput: Locator;
    readonly maxDailyLossInput: Locator;
    readonly priceOffsetInput: Locator;

    // Step 4 - Review
    readonly summaryDisplay: Locator;
    readonly confirmButton: Locator;

    // Navigation
    readonly nextButton: Locator;
    readonly backButton: Locator;
    readonly stepIndicators: Locator;

    constructor(page: Page) {
        this.page = page;

        // Step 1
        this.walletAddressInput = page.locator('input[placeholder*="wallet"]').first();
        this.whaleSelect = page.locator('[data-testid="whale-select"]');

        // Step 2
        this.modeSelect = page.locator('[data-testid="mode-select"]');
        this.sizeInput = page.locator('input[placeholder*="Size"]');

        // Step 3
        this.maxExposureInput = page.locator('input[placeholder*="Max Exposure"]');
        this.maxDailyLossInput = page.locator('input[placeholder*="Max Daily Loss"]');
        this.priceOffsetInput = page.locator('input[placeholder*="Price Offset"]');

        // Step 4
        this.summaryDisplay = page.locator('[data-testid="setup-summary"]');
        this.confirmButton = page.locator('button', { hasText: 'Confirm' }).last();

        // Navigation
        this.nextButton = page.locator('button', { hasText: 'Next' });
        this.backButton = page.locator('button', { hasText: 'Back' });
        this.stepIndicators = page.locator('[data-testid="step-indicator"]');
    }

    async goto(): Promise<void> {
        await this.page.goto('/copy/setup');
        await expect(this.page.locator('h1', { hasText: 'Setup Copy Trade' })).toBeVisible({ timeout: 15_000 });
    }

    async setTarget(address: string, whale?: string): Promise<void> {
        await this.walletAddressInput.fill(address);
        if (whale) {
            await this.whaleSelect.click();
            await this.page.locator('text=' + whale).click();
        }
    }

    async selectMode(mode: 'PERCENTAGE' | 'FIXED' | 'MIRROR'): Promise<void> {
        await this.modeSelect.click();
        const modeMap: Record<string, string> = {
            PERCENTAGE: 'Percentage',
            FIXED: 'Fixed',
            MIRROR: 'Mirror',
        };
        await this.page.locator('text=' + modeMap[mode]).click();
    }

    async setSize(amount: string): Promise<void> {
        await this.sizeInput.fill(amount);
    }

    async setRiskParams(params: {
        maxExposure: string;
        maxDailyLoss: string;
        priceOffset: string;
    }): Promise<void> {
        await this.maxExposureInput.fill(params.maxExposure);
        await this.maxDailyLossInput.fill(params.maxDailyLoss);
        await this.priceOffsetInput.fill(params.priceOffset);
    }

    async nextStep(): Promise<void> {
        await this.nextButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async previousStep(): Promise<void> {
        await this.backButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async review(): Promise<string> {
        return (await this.summaryDisplay.textContent()) ?? '';
    }

    async confirm(): Promise<void> {
        await this.confirmButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async getCurrentStep(): Promise<number> {
        const active = await this.page.locator('[data-testid="step-indicator"][aria-current="step"]').count();
        return active > 0 ? active : 1;
    }

    async getStepCount(): Promise<number> {
        return await this.stepIndicators.count();
    }
}
