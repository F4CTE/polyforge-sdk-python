import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Onboarding checklist and tooltip tour.
 *
 * Handles the onboarding checklist display, progressing through
 * tutorial steps, and dismissing the onboarding flow.
 */
export class OnboardingPage {
    readonly page: Page;

    // Checklist
    readonly checklistItems: Locator;
    readonly progressBar: Locator;
    readonly dismissButton: Locator;
    readonly tourLink: Locator;

    // Tour
    readonly tourTooltip: Locator;
    readonly tourNextButton: Locator;
    readonly tourPrevButton: Locator;
    readonly tourCloseButton: Locator;
    readonly stepCounter: Locator;

    constructor(page: Page) {
        this.page = page;

        // Checklist
        this.checklistItems = page.locator('[data-testid="checklist-item"]');
        this.progressBar = page.locator('[data-testid="checklist-progress"]');
        this.dismissButton = page.locator('[data-testid="dismiss-checklist"]');
        this.tourLink = page.locator('button', { hasText: 'Start Tour' });

        // Tour
        this.tourTooltip = page.locator('[data-testid="tour-tooltip"]');
        this.tourNextButton = page.locator('[data-testid="tour-next"]');
        this.tourPrevButton = page.locator('[data-testid="tour-prev"]');
        this.tourCloseButton = page.locator('[data-testid="tour-close"]');
        this.stepCounter = page.locator('[data-testid="tour-step-counter"]');
    }

    async isChecklistVisible(): Promise<boolean> {
        return (await this.checklistItems.first().isVisible({ timeout: 1000 }).catch(() => false));
    }

    async getProgress(): Promise<string> {
        return (await this.progressBar.textContent()) ?? '';
    }

    async completeItem(index: number): Promise<void> {
        const checkbox = this.checklistItems.nth(index).locator('input[type="checkbox"]');
        await checkbox.check();
        await this.page.waitForTimeout(300);
    }

    async dismissChecklist(): Promise<void> {
        await this.dismissButton.click();
        await this.page.waitForTimeout(300);
    }

    async startTour(): Promise<void> {
        await this.tourLink.click();
        await expect(this.tourTooltip).toBeVisible({ timeout: 10_000 });
    }

    async nextStep(): Promise<void> {
        await this.tourNextButton.click();
        await this.page.waitForTimeout(300);
    }

    async prevStep(): Promise<void> {
        await this.tourPrevButton.click();
        await this.page.waitForTimeout(300);
    }

    async closeTour(): Promise<void> {
        await this.tourCloseButton.click();
        await this.page.waitForTimeout(300);
    }

    async getCurrentStep(): Promise<string> {
        return (await this.stepCounter.textContent()) ?? '';
    }

    async getTourTooltipText(): Promise<string> {
        return (await this.tourTooltip.textContent()) ?? '';
    }

    async getChecklistItemCount(): Promise<number> {
        return await this.checklistItems.count();
    }
}
