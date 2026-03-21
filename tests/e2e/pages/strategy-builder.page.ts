import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Strategy Builder (/strategies/new and /strategies/:id/edit).
 * Supports the full-screen SVG canvas with floating side panel.
 */
export class StrategyBuilderPage {
    readonly page:         Page;
    readonly nameInput:    Locator;
    readonly descInput:    Locator;
    readonly saveButton:   Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page         = page;
        this.nameInput    = page.locator('input[placeholder="My Strategy"]');
        this.descInput    = page.locator('textarea[placeholder="What does this strategy do?"]');
        this.saveButton   = page.locator('p-button').filter({ hasText: /Create Strategy|Save Changes/ }).locator('button');
        this.cancelButton = page.locator('p-button').filter({ hasText: 'Cancel' }).locator('button');
    }

    async gotoNew(): Promise<void> {
        await this.page.goto('/strategies/new');
        await expect(this.page.locator('h1', { hasText: 'New Strategy' })).toBeVisible({ timeout: 15_000 });
    }

    async gotoEdit(strategyId: string): Promise<void> {
        await this.page.goto(`/strategies/${strategyId}/edit`);
        await expect(this.page.locator('h1', { hasText: 'Edit Strategy' })).toBeVisible({ timeout: 15_000 });
    }

    async fillName(name: string): Promise<void> {
        await this.nameInput.fill(name);
    }

    async fillDescription(desc: string): Promise<void> {
        await this.descInput.fill(desc);
    }

    /** Click a section tab in the floating panel by label (e.g. 'Safety', 'Triggers', 'Conditions', 'Actions') */
    async selectSection(label: string): Promise<void> {
        // Ensure the panel is open
        const panel = this.page.locator('.builder-floating-panel');
        if (!(await panel.isVisible())) {
            await this.page.locator('.panel-toggle-btn').click();
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
        await this.page.locator('.panel-tab-btn', { hasText: label }).click();
    }

    /** Click a block item in the floating panel to add it to the canvas */
    async addBlock(blockLabel: string): Promise<void> {
        // Ensure the panel is open
        const panel = this.page.locator('.builder-floating-panel');
        if (!(await panel.isVisible())) {
            await this.page.locator('.panel-toggle-btn').click();
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
        await this.page.locator('.panel-block-item', { hasText: blockLabel }).click();
    }

    /** Returns all block elements on the canvas */
    blockCards(): Locator {
        return this.page.locator('.canvas-block');
    }

    async save(): Promise<void> {
        await this.saveButton.click();
    }

    /** Save and wait for redirect away from builder (to list or detail) */
    async saveAndRedirect(): Promise<void> {
        await this.save();
        await this.page.waitForURL(
            url => url.pathname.startsWith('/strategies') && !url.pathname.includes('/new') && !url.pathname.includes('/edit'),
            { timeout: 20_000 },
        );
    }
}
