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
        await this.page.waitForLoadState('domcontentloaded');
        const blankBtn = this.page.locator('button', { hasText: 'Start from Scratch' });
        await expect(blankBtn).toBeVisible({ timeout: 20_000 });
        await blankBtn.click();
        // Wait for the BlockPalette name input to confirm the builder canvas is ready
        await expect(this.nameInput).toBeVisible({ timeout: 10_000 });
        const tutorialDismiss = this.page.locator('button[aria-label="Dismiss tutorial"]');
        if (await tutorialDismiss.isVisible({ timeout: 300 }).catch(() => false)) {
            await tutorialDismiss.click();
        }
    }

    async gotoEdit(strategyId: string): Promise<void> {
        await this.page.goto(`/strategies/${strategyId}/edit`);
        await this.page.waitForLoadState('domcontentloaded');
        await expect(this.page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
        // Ensure the block palette panel is open (may be collapsed in edit mode).
        // Short timeout: palette is either visible immediately or not at all.
        const showBtn = this.page.locator('button[title="Show blocks"]');
        if (await showBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await showBtn.click();
        }
        await expect(this.nameInput).toBeVisible({ timeout: 10_000 });
        // Dismiss builder tutorial if visible — storage-state suppresses it,
        // so this is a fast-path safety net, not a real wait.
        const tutorialDismiss = this.page.locator('button[aria-label="Dismiss tutorial"]');
        if (await tutorialDismiss.isVisible({ timeout: 300 }).catch(() => false)) {
            await tutorialDismiss.click();
        }
    }

    async fillName(name: string): Promise<void> {
        await this.nameInput.fill(name);
    }

    async fillDescription(desc: string): Promise<void> {
        await this.descInput.fill(desc);
    }

    /** Click a section tab in the floating panel by label (e.g. 'Safety', 'Triggers', 'Conditions', 'Actions') */
    async selectSection(label: string): Promise<void> {
        // Panel toggle has title "Show blocks" when collapsed, "Hide blocks" when open
        const showBtn = this.page.locator('button[title="Show blocks"]');
        if (await showBtn.isVisible()) {
            await showBtn.click();
            await expect(this.nameInput).toBeVisible({ timeout: 5_000 });
        }
        // Section tabs are inside the palette panel — scope to aria-pressed attribute
        // which is unique to palette section tab buttons, avoiding ambiguity with
        // other buttons on the page (e.g. builder tutorial dialog).
        const tab = this.page.locator('button[aria-pressed]', { hasText: label });
        // Scroll the tab into view in case the overflow-x-auto tab bar is scrolled
        await tab.scrollIntoViewIfNeeded();
        await tab.click();
    }

    /** Click a block item in the floating panel to add it to the canvas */
    async addBlock(blockLabel: string): Promise<void> {
        // Ensure the palette panel is visible — toggle it if collapsed
        const showBtn = this.page.locator('button[title="Show blocks"]');
        if (await showBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await showBtn.click();
            await expect(this.nameInput).toBeVisible({ timeout: 5_000 });
        }
        // Block items are draggable divs inside the palette with the block label text
        const block = this.page.locator('[draggable="true"]', { hasText: blockLabel });
        await expect(block).toBeVisible({ timeout: 5_000 });
        await block.click();
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
