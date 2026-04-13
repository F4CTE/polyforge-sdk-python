import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Copy Trading setup wizard (/copy/new).
 *
 * Handles the 5-step wizard for setting up copy trades:
 * Step 0 (Target): wallet address + followed whale quick-select
 * Step 1 (Mode): PERCENTAGE, FIXED, or MIRROR radio cards
 * Step 2 (Size): trade size slider/input + max per trade cap
 * Step 3 (Risk): max exposure, max daily loss, price offset sliders
 * Step 4 (Review): summary + submit ("Start Copying")
 *
 * Key implementation details:
 * - Steps are 0-indexed internally (STEPS array: Target, Mode, Size, Risk, Review)
 * - Mode selection uses clickable card buttons, not a <select>
 * - Risk inputs use id="copy-max-exposure", id="copy-max-daily-loss", id="copy-price-offset"
 * - Submit button says "Start Copying" (not "Confirm")
 * - Step indicators are <Button> elements with conditional styling, no data-testid
 */
export class CopySetupPage {
    readonly page: Page;

    // Step 0 - Target
    readonly walletAddressInput: Locator;

    // Step 2 - Size (shown for non-MIRROR modes)
    readonly sizeInput: Locator;

    // Step 3 - Risk
    readonly maxExposureInput: Locator;
    readonly maxDailyLossInput: Locator;
    readonly priceOffsetInput: Locator;

    // Navigation
    readonly nextButton: Locator;
    readonly backButton: Locator;
    readonly submitButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Step 0 - Target wallet
        this.walletAddressInput = page.locator('#target-wallet');

        // Step 2 - Size (number input for fixed/percentage)
        this.sizeInput = page.locator('input[type="number"]').first();

        // Step 3 - Risk controls (id-based)
        this.maxExposureInput = page.locator('#copy-max-exposure');
        this.maxDailyLossInput = page.locator('#copy-max-daily-loss');
        this.priceOffsetInput = page.locator('#copy-price-offset');

        // Navigation buttons
        this.nextButton = page.locator('button', { hasText: 'Next' });
        this.backButton = page.locator('button', { hasText: 'Back' });
        this.submitButton = page.locator('button', { hasText: 'Start Copying' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/copy/new');
        await expect(this.page.locator('h1', { hasText: 'New Copy Config' })).toBeVisible({ timeout: 30_000 });
    }

    /**
     * Select a copy mode by clicking the mode card button.
     * Mode labels: "Percentage", "Fixed Amount", "Mirror (1:1)"
     */
    async selectMode(mode: 'PERCENTAGE' | 'FIXED' | 'MIRROR'): Promise<void> {
        const labelMap: Record<string, string> = {
            PERCENTAGE: 'Percentage',
            FIXED: 'Fixed Amount',
            MIRROR: 'Mirror (1:1)',
        };
        await this.page.locator('button', { hasText: labelMap[mode] }).click();
    }

    /**
     * Set the trade size value in the number input (step 2).
     * Only available for PERCENTAGE and FIXED modes.
     */
    async setSize(amount: string): Promise<void> {
        const numberInput = this.page.locator('input[type="number"]').first();
        await numberInput.fill(amount);
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
    }

    async previousStep(): Promise<void> {
        await this.backButton.click();
    }

    /**
     * Get the current step number (1-indexed for test readability).
     * Detects step by checking which step indicator button has the active styling.
     */
    async getCurrentStep(): Promise<number> {
        // Step indicators are buttons with conditional bg-pf-cyan-500/10 class for active step
        const stepButtons = this.page.locator('.flex.items-center.gap-2 > div > button');
        const count = await stepButtons.count();
        for (let i = 0; i < count; i++) {
            const classes = await stepButtons.nth(i).getAttribute('class') ?? '';
            if (classes.includes('bg-pf-cyan-500/10')) {
                return i + 1; // 1-indexed
            }
        }
        return 1;
    }

    /**
     * Get the total number of steps in the wizard.
     */
    async getStepCount(): Promise<number> {
        // Count the step indicator buttons (5 steps: Target, Mode, Size, Risk, Review)
        const stepButtons = this.page.locator('.flex.items-center.gap-2 > div > button');
        return await stepButtons.count();
    }

    /**
     * Get the review summary text content from step 4.
     */
    async review(): Promise<string> {
        // Review step renders key-value pairs in a div with border-b separators
        const reviewSection = this.page.locator('.bg-pf-elevated .space-y-3');
        return (await reviewSection.textContent()) ?? '';
    }

    /**
     * Submit the copy config (step 4 "Start Copying" button).
     */
    async confirm(): Promise<void> {
        await this.submitButton.click();
        // Wait for either navigation away from setup (success) or an error
        // toast/notification (API rejection).  In test environments the API may
        // reject the config (no real wallet), so both outcomes are valid.
        await Promise.race([
            this.page.waitForURL((url) => !url.pathname.includes('/copy/new'), { timeout: 15_000 }),
            this.page.locator('[data-sonner-toast], [role="status"], [role="alert"]').first().waitFor({ state: 'visible', timeout: 15_000 }),
        ]);
    }
}
