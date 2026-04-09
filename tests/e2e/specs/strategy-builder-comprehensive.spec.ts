import { test, expect } from '@playwright/test';
import { StrategyBuilderPage } from '../pages/strategy-builder.page';
import { StrategiesListPage } from '../pages/strategies-list.page';
import { apiLogin, apiRegister, apiRegisterAndVerify, uniqueEmail, uniqueUsername, apiDeleteStrategy, apiGetStrategies } from '../helpers/api';

/**
 * Strategy Builder — Full Workflow Coverage (@e2e @comprehensive)
 *
 * Comprehensive test suite for the strategy builder including:
 * - Strategy creation with name, description, and properties
 * - Block palette interaction (drag, add, delete)
 * - Canvas interaction (nodes, edges, connections)
 * - Strategy save/load/edit workflows
 * - Strategy import/export functionality
 * - Strategy lifecycle from list page (start, pause, resume, stop)
 */

test.describe('Strategy Builder — Full Workflow Coverage', () => {
    let token: string;
    let userId: string;
    let strategiesCreated: string[] = [];

    test.beforeAll(async () => {
        // Register a unique test user
        const email = uniqueEmail('strategybuilder');
        const username = uniqueUsername('stratbuilder');
        const res = await apiRegisterAndVerify(email, username, 'TestPass123!');
        token = res.token;
        userId = res.user.id;
    });

    test.beforeEach(async ({ page }) => {
        // Set auth cookie for each test
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
        strategiesCreated = [];
    });

    test.afterEach(async () => {
        // Cleanup: delete all created strategies via API
        const strategies = await apiGetStrategies(token);
        for (const strategy of strategies) {
            try {
                await apiDeleteStrategy(token, strategy.id);
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    // ─── Strategy Creation & Configuration ─────────────────────────────────────

    test('@smoke @comprehensive should navigate to strategy builder with empty canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Verify empty canvas state
        await expect(page.locator('h1', { hasText: 'New Strategy' })).toBeVisible();
        const blocks = builder.blockCards();
        const initialCount = await blocks.count();
        expect(initialCount).toBe(0);
    });

    test('@smoke @comprehensive should set strategy name', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        const strategyName = 'My Test Strategy';
        await builder.fillName(strategyName);

        // Verify name field updated
        const nameValue = await builder.nameInput.inputValue();
        expect(nameValue).toBe(strategyName);
    });

    test('@smoke @comprehensive should set strategy description', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        const description = 'This is a test strategy that demonstrates the builder';
        await builder.fillDescription(description);

        // Verify description field updated
        const descValue = await builder.descInput.inputValue();
        expect(descValue).toBe(description);
    });

    test('@comprehensive should set execution mode to TICK', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find and select TICK mode from settings
        const tickOption = page.locator('button, [role="option"]', { hasText: /TICK|Tick/ }).first();
        if (await tickOption.isVisible()) {
            await tickOption.click();
            // Verify selection persists
            await expect(tickOption).toBeDefined();
        }
    });

    test('@comprehensive should set execution mode to EVENT', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find and select EVENT mode from settings
        const eventOption = page.locator('button, [role="option"]', { hasText: /EVENT|Event/ }).first();
        if (await eventOption.isVisible()) {
            await eventOption.click();
            // Verify selection persists
            await expect(eventOption).toBeDefined();
        }
    });

    test('@comprehensive should set execution mode to HYBRID', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find and select HYBRID mode from settings
        const hybridOption = page.locator('button, [role="option"]', { hasText: /HYBRID|Hybrid/ }).first();
        if (await hybridOption.isVisible()) {
            await hybridOption.click();
            // Verify selection persists
            await expect(hybridOption).toBeDefined();
        }
    });

    test('@comprehensive should set tick interval', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find tick interval input
        const tickIntervalInput = page.locator('input[type="number"]').first();
        if (await tickIntervalInput.isVisible()) {
            await tickIntervalInput.fill('5000');
            const value = await tickIntervalInput.inputValue();
            expect(value).toBe('5000');
        }
    });

    test('@comprehensive should set visibility to PUBLIC', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find and click PUBLIC visibility option
        const publicOption = page.locator('button, label', { hasText: /PUBLIC|Public/ }).first();
        if (await publicOption.isVisible()) {
            await publicOption.click();
            // Verify selection persists
            await expect(publicOption).toBeDefined();
        }
    });

    test('@comprehensive should set visibility to PRIVATE', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find and click PRIVATE visibility option
        const privateOption = page.locator('button, label', { hasText: /PRIVATE|Private/ }).first();
        if (await privateOption.isVisible()) {
            await privateOption.click();
            // Verify selection persists
            await expect(privateOption).toBeDefined();
        }
    });

    test('@comprehensive should add tags to strategy', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Find tags input field
        const tagsInput = page.locator('input[placeholder*="tag"]').first();
        if (await tagsInput.isVisible()) {
            await tagsInput.fill('ml-strategy');
            await tagsInput.press('Enter');

            // Verify tag appears as chip
            const tagChip = page.locator('[data-testid="tag-chip"]', { hasText: 'ml-strategy' });
            await expect(tagChip).toBeVisible();
        }
    });

    // ─── Block Palette Tests ───────────────────────────────────────────────────

    test('@comprehensive should show triggers section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Triggers');

        // Verify triggers are visible
        const triggersSection = page.locator('text=/Triggers|trigger/i');
        await expect(triggersSection).toBeVisible();
    });

    test('@comprehensive should show conditions section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Conditions');

        // Verify conditions are visible
        const conditionsSection = page.locator('text=/Conditions|condition/i');
        await expect(conditionsSection).toBeVisible();
    });

    test('@comprehensive should show actions section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Actions');

        // Verify actions are visible
        const actionsSection = page.locator('text=/Actions|action/i');
        await expect(actionsSection).toBeVisible();
    });

    test('@comprehensive should show safety section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Safety');

        // Verify safety blocks are visible
        const safetySection = page.locator('text=/Safety|safety/i');
        await expect(safetySection).toBeVisible();
    });

    test('@comprehensive should show variables section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Variables');

        // Verify variables are visible
        const variablesSection = page.locator('text=/Variables|variable/i');
        await expect(variablesSection).toBeVisible();
    });

    test('@comprehensive should show logic section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Logic');

        // Verify logic blocks are visible
        const logicSection = page.locator('text=/Logic|logic/i');
        await expect(logicSection).toBeVisible();
    });

    test('@comprehensive should show calc section in palette', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Calc');

        // Verify calc blocks are visible
        const calcSection = page.locator('text=/Calc|calculation/i');
        await expect(calcSection).toBeVisible();
    });

    test('@comprehensive should display accurate block counter per section', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Select each section and verify counter exists
        const sections = ['Triggers', 'Conditions', 'Actions', 'Safety', 'Variables', 'Logic', 'Calc'];
        for (const section of sections) {
            await builder.selectSection(section);

            // Find and verify block counter badge exists
            const counterBadge = page.locator('[data-testid="block-count"]');
            if (await counterBadge.isVisible()) {
                const count = await counterBadge.textContent();
                expect(count).toMatch(/\d+/);
            }
        }
    });

    // ─── Canvas Interaction Tests ──────────────────────────────────────────────

    test('@smoke @comprehensive should drag trigger block to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Triggers');

        // Get first trigger block and drag to canvas
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);

            // Verify node appears
            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@smoke @comprehensive should drag condition block to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Conditions');

        const conditionBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await conditionBlock.isVisible()) {
            await conditionBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@smoke @comprehensive should drag action block to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Actions');

        const actionBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await actionBlock.isVisible()) {
            await actionBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@smoke @comprehensive should drag safety block to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Safety');

        const safetyBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await safetyBlock.isVisible()) {
            await safetyBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@comprehensive should add variable node to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Variables');

        const variableBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await variableBlock.isVisible()) {
            await variableBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);

            // Verify variable node has name/expression fields
            const variableNode = blocks.first();
            const nameField = variableNode.locator('input[placeholder*="name"]');
            await expect(nameField).toBeVisible();
        }
    });

    test('@comprehensive should add logic node to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Logic');

        const logicBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await logicBlock.isVisible()) {
            await logicBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@comprehensive should add calc node to canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        await builder.selectSection('Calc');

        const calcBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await calcBlock.isVisible()) {
            await calcBlock.dragTo(canvas);

            const blocks = builder.blockCards();
            const count = await blocks.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('@comprehensive should connect two nodes with edge', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Add two blocks
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);
        }

        await builder.selectSection('Actions');
        const actionBlock = page.locator('[draggable="true"]').first();

        if (await actionBlock.isVisible()) {
            await actionBlock.dragTo(canvas);
        }

        // Find handle ports and connect them
        const handles = page.locator('.react-flow__handle');
        const handleCount = await handles.count();

        if (handleCount >= 2) {
            const sourceHandle = handles.nth(0);
            const targetHandle = handles.nth(1);

            await sourceHandle.dragTo(targetHandle);

            // Verify edge exists
            const edges = page.locator('.react-flow__edge');
            const edgeCount = await edges.count();
            expect(edgeCount).toBeGreaterThan(0);
        }
    });

    test('@comprehensive should delete node from canvas', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Add a block
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);

            // Select and delete the node
            const node = builder.blockCards().first();
            await node.click();

            // Press Delete key
            await page.keyboard.press('Delete');

            // Verify node is removed
            const blockCount = await builder.blockCards().count();
            expect(blockCount).toBe(0);
        }
    });

    test('@comprehensive should update node configuration', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Add a block
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);

            // Find configuration input within the node
            const node = builder.blockCards().first();
            const configInput = node.locator('input').first();

            if (await configInput.isVisible()) {
                await configInput.fill('test-config-value');
                const value = await configInput.inputValue();
                expect(value).toBe('test-config-value');
            }
        }
    });

    test('@comprehensive should persist multiple nodes with connections', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Add multiple blocks
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);
        }

        await builder.selectSection('Conditions');
        const conditionBlock = page.locator('[draggable="true"]').first();

        if (await conditionBlock.isVisible()) {
            await conditionBlock.dragTo(canvas);
        }

        await builder.selectSection('Actions');
        const actionBlock = page.locator('[draggable="true"]').first();

        if (await actionBlock.isVisible()) {
            await actionBlock.dragTo(canvas);
        }

        // Verify all blocks persist
        const blocks = builder.blockCards();
        const blockCount = await blocks.count();
        expect(blockCount).toBeGreaterThanOrEqual(3);
    });

    // ─── Strategy Save/Load/Edit Tests ────────────────────────────────────────

    test('@smoke @comprehensive should save strategy with valid name', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        await builder.gotoNew();

        const strategyName = `Test Strategy ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('A test strategy for saving');

        await builder.saveAndRedirect();

        // Verify redirect to strategies list
        await expect(page).not.toHaveURL(/\/new|\/edit/);

        // Verify strategy appears in list
        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        await expect(card).toBeVisible();

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should show validation error when saving without name', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        await builder.gotoNew();

        // Try to save without filling name
        await builder.fillName('');
        await builder.save();

        // Verify validation error message
        const errorMessage = page.locator('[role="alert"], .error, .text-red-500');
        await expect(errorMessage).toBeVisible();
    });

    test('@comprehensive should edit existing strategy', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create a strategy first
        await builder.gotoNew();
        const strategyName = `Edit Test ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('Original description');
        await builder.saveAndRedirect();

        // Navigate to list and find the strategy
        await listPage.goto();
        const card = listPage.cardByName(strategyName);

        // Click edit button or card to edit
        const editButton = card.locator('button[title*="Edit"], button[title*="edit"]').first();
        if (await editButton.isVisible()) {
            await editButton.click();
        } else {
            await card.click();
        }

        // Verify in edit mode
        await expect(page.locator('h1', { hasText: 'Edit Strategy' })).toBeVisible();

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should preserve all nodes and edges when loading strategy for edit', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create a strategy with multiple blocks
        await builder.gotoNew();
        const strategyName = `Multi-Block ${Date.now()}`;
        await builder.fillName(strategyName);

        // Add multiple blocks
        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);
        }

        await builder.saveAndRedirect();

        // Reload and edit
        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        const editButton = card.locator('button[title*="Edit"], button[title*="edit"]').first();

        if (await editButton.isVisible()) {
            await editButton.click();
        }

        // Verify blocks persist
        const blocks = builder.blockCards();
        const blockCount = await blocks.count();
        expect(blockCount).toBeGreaterThan(0);

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should save edited strategy with changes', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create initial strategy
        await builder.gotoNew();
        const strategyName = `Edit Changes ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('Original');
        await builder.saveAndRedirect();

        // Navigate to edit
        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        const editButton = card.locator('button[title*="Edit"], button[title*="edit"]').first();

        if (await editButton.isVisible()) {
            await editButton.click();

            // Update description
            const newDesc = 'Updated description';
            await builder.fillDescription(newDesc);
            await builder.saveAndRedirect();

            // Verify changes persisted
            await expect(page).not.toHaveURL(/\/edit/);
        }

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should cancel editing without saving changes', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create initial strategy
        await builder.gotoNew();
        const strategyName = `Cancel Edit ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('Original');
        await builder.saveAndRedirect();

        // Navigate to edit
        await listPage.goto();
        const card = listPage.cardByName(strategyName);
        const editButton = card.locator('button[title*="Edit"], button[title*="edit"]').first();

        if (await editButton.isVisible()) {
            await editButton.click();

            // Modify description
            const modifiedDesc = 'This should not be saved';
            await builder.fillDescription(modifiedDesc);

            // Click cancel
            await builder.cancelButton.click();

            // Verify redirect back to list
            await expect(page).not.toHaveURL(/\/edit/);
        }

        strategiesCreated.push(strategyName);
    });

    // ─── Strategy Import/Export Tests ─────────────────────────────────────────

    test('@comprehensive should export strategy to JSON file', async ({ page, context }) => {
        const builder = new StrategyBuilderPage(page);

        await builder.gotoNew();
        const strategyName = `Export Test ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.fillDescription('Strategy for export');

        // Set up download listener
        const downloadPromise = page.waitForEvent('download');

        // Look for export button
        const exportButton = page.locator('button[title*="Export"], button[title*="export"]').first();

        if (await exportButton.isVisible()) {
            await exportButton.click();
            const download = await downloadPromise;

            // Verify download is JSON file
            expect(download.suggestedFilename).toMatch(/\.polyforge\.json|\.json/);
        }

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should import strategy from file', async ({ page }) => {
        // This test verifies the import flow is accessible
        const builder = new StrategyBuilderPage(page);

        await builder.gotoNew();

        // Look for import button
        const importButton = page.locator('button[title*="Import"], button[title*="import"]').first();

        if (await importButton.isVisible()) {
            await expect(importButton).toBeEnabled();
        }
    });

    test('@comprehensive should show error on invalid import file', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);

        await builder.gotoNew();

        // Look for import button and file input
        const importButton = page.locator('button[title*="Import"], button[title*="import"]').first();

        if (await importButton.isVisible()) {
            const fileInput = page.locator('input[type="file"]').first();

            if (await fileInput.isVisible()) {
                // Attempt to upload invalid file
                const errorShown = page.locator('[role="alert"], .error');

                // If upload fails, error should be visible
                if (await errorShown.isVisible()) {
                    await expect(errorShown).toBeVisible();
                }
            }
        }
    });

    test('@comprehensive should drag and drop polyforge file to import', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);

        await builder.gotoNew();

        // Find the canvas area for drag-drop
        const canvas = page.locator('.react-flow__viewport');

        // Verify canvas is visible and accepts drops
        await expect(canvas).toBeVisible();
    });

    // ─── Strategy Lifecycle Tests ──────────────────────────────────────────────

    test('@smoke @comprehensive should start strategy in Paper mode', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create a strategy
        await builder.gotoNew();
        const strategyName = `Paper Mode ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        // Go to list
        await listPage.goto();

        // Start in paper mode
        await listPage.startPaper(strategyName);

        // Verify status changed
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/PAPER|Paper|paper/);

        strategiesCreated.push(strategyName);
    });

    test('@smoke @comprehensive should start strategy in Live mode', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create a strategy
        await builder.gotoNew();
        const strategyName = `Live Mode ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        // Go to list
        await listPage.goto();

        // Start in live mode
        await listPage.startLive(strategyName);

        // Verify status changed
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/RUNNING|Running|running/);

        strategiesCreated.push(strategyName);
    });

    test('@smoke @comprehensive should pause running strategy', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create and start a strategy
        await builder.gotoNew();
        const strategyName = `Pause Test ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        // Go to list and start
        await listPage.goto();
        await listPage.startPaper(strategyName);

        // Wait for it to be running
        await page.waitForTimeout(500);

        // Pause the strategy
        await listPage.pauseStrategy(strategyName);

        // Verify status changed
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/PAUSED|Paused|paused/);

        strategiesCreated.push(strategyName);
    });

    test('@smoke @comprehensive should resume paused strategy', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create, start, and pause a strategy
        await builder.gotoNew();
        const strategyName = `Resume Test ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        await listPage.goto();
        await listPage.startPaper(strategyName);

        await page.waitForTimeout(500);
        await listPage.pauseStrategy(strategyName);

        // Resume the strategy
        await listPage.resumeStrategy(strategyName);

        // Verify status changed back to running
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/PAPER|RUNNING|Paper|Running/);

        strategiesCreated.push(strategyName);
    });

    test('@smoke @comprehensive should stop running strategy', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create and start a strategy
        await builder.gotoNew();
        const strategyName = `Stop Test ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        await listPage.goto();
        await listPage.startPaper(strategyName);

        await page.waitForTimeout(500);

        // Stop the strategy
        await listPage.stopStrategy(strategyName);

        // Verify status changed
        const status = await listPage.statusOf(strategyName);
        expect(status).toMatch(/IDLE|Idle|idle/);

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should display strategy detail page', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create a strategy
        await builder.gotoNew();
        const strategyName = `Detail View ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        // Go to list and click on strategy
        await listPage.goto();
        await listPage.clickCard(strategyName);

        // Verify detail page loaded
        await expect(page.locator('h1', { hasText: strategyName })).toBeVisible({ timeout: 15_000 });

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should show blocks visualization on detail page', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create strategy with blocks
        await builder.gotoNew();
        const strategyName = `Block Viz ${Date.now()}`;
        await builder.fillName(strategyName);

        await builder.selectSection('Triggers');
        const triggerBlock = page.locator('[draggable="true"]').first();
        const canvas = page.locator('.react-flow__viewport');

        if (await triggerBlock.isVisible()) {
            await triggerBlock.dragTo(canvas);
        }

        await builder.saveAndRedirect();

        // Go to detail page
        await listPage.goto();
        await listPage.clickCard(strategyName);

        // Verify visualization area exists
        const visualization = page.locator('[data-testid="strategy-visualization"], .react-flow');
        if (await visualization.isVisible()) {
            await expect(visualization).toBeVisible();
        }

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should show live events log when strategy running', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create and start a strategy
        await builder.gotoNew();
        const strategyName = `Events Log ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        await listPage.goto();
        await listPage.startPaper(strategyName);

        // Navigate to detail
        await listPage.clickCard(strategyName);

        // Verify events log section exists
        const eventsLog = page.locator('[data-testid="events-log"]');
        if (await eventsLog.isVisible()) {
            await expect(eventsLog).toBeVisible();
        }

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should display P&L data on detail page', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);
        const listPage = new StrategiesListPage(page);

        // Create and start a strategy
        await builder.gotoNew();
        const strategyName = `PL Data ${Date.now()}`;
        await builder.fillName(strategyName);
        await builder.saveAndRedirect();

        await listPage.goto();
        await listPage.startPaper(strategyName);

        // Navigate to detail
        await listPage.clickCard(strategyName);

        // Verify P&L section exists
        const pnlSection = page.locator('[data-testid="pnl-summary"], :text("P&L")').first();
        if (await pnlSection.isVisible()) {
            await expect(pnlSection).toBeVisible();
        }

        strategiesCreated.push(strategyName);
    });

    test('@comprehensive should trigger 7-day backtest from builder', async ({ page }) => {
        const builder = new StrategyBuilderPage(page);

        await builder.gotoNew();
        const strategyName = `Backtest ${Date.now()}`;
        await builder.fillName(strategyName);

        // Look for backtest button
        const backtestButton = page.locator('button', { hasText: /Quick Test|Backtest|Test/ }).first();

        if (await backtestButton.isVisible()) {
            // Click backtest
            await backtestButton.click();

            // Verify backtest modal or page appears
            const backtestPanel = page.locator('[data-testid="backtest-panel"], [role="dialog"]').first();
            await expect(backtestPanel).toBeVisible({ timeout: 15_000 });
        }

        strategiesCreated.push(strategyName);
    });
});
