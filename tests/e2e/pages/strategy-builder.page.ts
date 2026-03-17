import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Strategy Builder (/strategies/new and /strategies/:id/edit).
 */
export class StrategyBuilderPage {
    readonly page:         Page;
    readonly nameInput:    Locator;
    readonly descInput:    Locator;
    readonly saveButton:   Locator;
    readonly cancelButton: Locator;
    readonly addBlockBtn:  Locator;
    readonly paletteGrid:  Locator;

    constructor(page: Page) {
        this.page         = page;
        this.nameInput    = page.locator('input[placeholder="My Strategy"]');
        this.descInput    = page.locator('textarea[placeholder="What does this strategy do?"]');
        this.saveButton   = page.locator('p-button').filter({ hasText: /Create Strategy|Save Changes/ }).locator('button');
        this.cancelButton = page.locator('p-button').filter({ hasText: 'Cancel' }).locator('button');
        this.addBlockBtn  = page.locator('button', { hasText: 'Add Block' });
        this.paletteGrid  = page.locator('.block-palette');
    }

    async gotoNew(): Promise<void> {
        await this.page.goto('/strategies/new');
        await expect(this.page.locator('h1', { hasText: 'New Strategy' })).toBeVisible();
    }

    async gotoEdit(strategyId: string): Promise<void> {
        await this.page.goto(`/strategies/${strategyId}/edit`);
        await expect(this.page.locator('h1', { hasText: 'Edit Strategy' })).toBeVisible();
    }

    async fillName(name: string): Promise<void> {
        await this.nameInput.fill(name);
    }

    async fillDescription(desc: string): Promise<void> {
        await this.descInput.fill(desc);
    }

    /** Click a section tab by label (e.g. 'Safety', 'Triggers', 'Conditions', 'Actions') */
    async selectSection(label: string): Promise<void> {
        await this.page.locator('button.section-tab', { hasText: label }).click();
    }

    /** Open the block palette and click the block with the given label */
    async addBlock(blockLabel: string): Promise<void> {
        await this.addBlockBtn.click();
        await expect(this.paletteGrid).toBeVisible();
        await this.paletteGrid.locator('.palette-item', { hasText: blockLabel }).click();
        await expect(this.paletteGrid).not.toBeVisible();
    }

    /** Returns all block card titles in the active section */
    blockCards(): Locator {
        return this.page.locator('.block-card-title');
    }

    async save(): Promise<void> {
        await this.saveButton.click();
    }

    /** Save and wait for redirect to /strategies */
    async saveAndRedirect(): Promise<void> {
        await this.save();
        await this.page.waitForURL(url => url.pathname === '/strategies', { timeout: 10_000 });
    }
}
