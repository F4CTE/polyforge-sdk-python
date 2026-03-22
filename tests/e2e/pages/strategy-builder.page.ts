import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Strategy Builder (/strategies/new and /strategies/:id/edit).
 *
 * Updated for React + React Flow frontend (replaces Angular SVG canvas).
 * The builder uses a top bar with save/cancel buttons and a floating
 * BlockPalette side panel with section tabs and draggable block items.
 */
export class StrategyBuilderPage {
    readonly page:         Page;
    readonly nameInput:    Locator;
    readonly descInput:    Locator;
    readonly saveButton:   Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page         = page;
        // Name and description inputs are inside the floating BlockPalette panel
        this.nameInput    = page.locator('input[placeholder="My Strategy"]');
        this.descInput    = page.locator('textarea[placeholder="What does this strategy do?"]');
        // Save button is in the top bar with text "Create Strategy" or "Save Changes"
        this.saveButton   = page.locator('button', { hasText: /Create Strategy|Save Changes/ });
        // Cancel is a Link styled as a button in the top bar
        this.cancelButton = page.locator('a', { hasText: 'Cancel' });
    }

    async gotoNew(): Promise<void> {
        await this.page.goto('/strategies/new');
        // The h1 shows "New Strategy" (from the name state) or a dynamic name
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
        // Ensure the panel is visible (controlled by Settings2 toggle button in top bar)
        const panel = this.page.locator('.absolute.top-3.right-3');
        if (!(await panel.isVisible())) {
            await this.page.locator('button[title="Open panel"]').click();
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
        // Section tabs are buttons inside the "Blocks" section of the palette
        await this.page.locator('button', { hasText: label }).click();
    }

    /** Click a block item in the floating panel to add it to the canvas */
    async addBlock(blockLabel: string): Promise<void> {
        // Ensure the panel is visible
        const panel = this.page.locator('.absolute.top-3.right-3');
        if (!(await panel.isVisible())) {
            await this.page.locator('button[title="Open panel"]').click();
            await expect(panel).toBeVisible({ timeout: 5_000 });
        }
        // Block items are draggable divs inside the palette with the block label text
        await this.page.locator('[draggable="true"]', { hasText: blockLabel }).click();
    }

    /** Returns all block node elements on the React Flow canvas */
    blockCards(): Locator {
        return this.page.locator('.react-flow__node');
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
