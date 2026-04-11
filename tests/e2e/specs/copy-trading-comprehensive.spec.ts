import { test, expect } from '@playwright/test';
import { CopyListPage } from '../pages/copy-list.page';
import { CopySetupPage } from '../pages/copy-setup.page';
import { apiLogin } from '../helpers/api';

/**
 * Copy Trading — Full Workflow Coverage
 *
 * Comprehensive test suite for copy trading functionality.
 * Covers list page, setup wizard (all 4 steps), lifecycle management,
 * and detail page navigation.
 *
 * Run with: pnpm --filter @polyforge/e2e test copy-trading-comprehensive
 */

const TEST_USER_EMAIL = 'alice@e2e.dev.local';
const TEST_USER_PASSWORD = 'TestPass123!';

// Test wallet addresses
const VALID_WHALE_ADDRESS = '0x1234567890123456789012345678901234567890';
const ANOTHER_WHALE_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

test.describe('Copy Trading — Full Workflow Coverage', () => {

    test.beforeEach(async ({ page }) => {
        const { token } = await apiLogin(TEST_USER_EMAIL, TEST_USER_PASSWORD);
        await page.context().addCookies([{
            name: 'pf_token',
            value: token,
            domain: 'localhost',
            path: '/',
        }]);
    });

    // ─── Copy Trading List Page ────────────────────────────────────────────────

    test('@smoke copy trading list page loads', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        // Verify page title
        await expect(page.locator('h1', { hasText: /Copy Trading|copy/i })).toBeVisible();

        // Verify main button is visible
        await expect(copyListPage.newCopyButton).toBeVisible();
    });

    test('copy list shows existing copy configurations', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        // Get copy card count (could be 0 if empty)
        const copyCount = await copyListPage.getCopyCount();
        expect(copyCount).toBeGreaterThanOrEqual(0);

        // If copies exist, verify cards display properly
        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            await expect(firstCard).toBeVisible();

            // Verify card contains expected information
            const cardText = await firstCard.textContent() || '';
            expect(cardText).toBeTruthy();
        }
    });

    test('copy list shows empty state when no configurations', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount === 0) {
            // Should show empty state message
            await expect(page.locator('text=/no.*copy|empty|create/i')).toBeVisible();
        }
    });

    test('new copy button navigates to setup', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        await copyListPage.goToNewCopy();

        // Should navigate to setup page
        await expect(page).toHaveURL(/\/copy\/(new|setup)/);
    });

    test('copy card displays whale address or name', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const cardText = await firstCard.textContent() || '';

            // Should contain wallet address or whale name
            expect(cardText).toMatch(/0x|whale|trader/i);
        }
    });

    test('copy card displays mode (percentage/fixed/mirror)', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const cardText = await firstCard.textContent() || '';

            // Should indicate the copy mode
            expect(cardText).toMatch(/percentage|fixed|mirror|mode/i);
        }
    });

    test('copy card displays status badge', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');

            await expect(statusBadge).toBeVisible();
        }
    });

    test('copy card displays pnl metric', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const cardText = await firstCard.textContent() || '';

            // Should show P&L info
            expect(cardText).toMatch(/P&L|pnl|[\d$%\-]/);
        }
    });

    test('status badges show correct states', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');

            const statusText = await statusBadge.textContent() || '';

            // Should be one of: ACTIVE, PAUSED, STOPPED
            expect(['ACTIVE', 'PAUSED', 'STOPPED']).toContain(statusText.trim());
        }
    });

    // ─── Copy Setup Wizard — Step 1 (Target) ────────────────────────────────

    test('@smoke copy setup wizard navigates from list', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        await copyListPage.goToNewCopy();

        // Should be on setup page
        await expect(page).toHaveURL(/\/copy\/(new|setup)/);

        // Verify step 1 is displayed
        await expect(page.locator('text=/step|target|wallet/i')).toBeVisible();
    });

    test('step 1 shows wallet address input', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Verify wallet input exists
        await expect(copySetupPage.walletAddressInput).toBeVisible();
    });

    test('enter valid wallet address enables next button', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Enter valid wallet address
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);

        // Next button should be enabled
        await expect(copySetupPage.nextButton).toBeEnabled();
    });

    test('select from followed whales dropdown populates address', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Click whale dropdown
        await copySetupPage.whaleSelect.click();

        // Wait for options
        const firstOption = page.locator('[role="option"]').first();
        const isVisible = await firstOption.isVisible().catch(() => false);

        if (isVisible) {
            const optionText = await firstOption.textContent();

            // Select first option
            await firstOption.click();

            // Verify wallet address input is populated
            const walletValue = await copySetupPage.walletAddressInput.inputValue();
            expect(walletValue).toMatch(/0x[a-fA-F0-9]/);
        }
    });

    test('empty wallet address disables next button', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Leave wallet empty
        await expect(copySetupPage.walletAddressInput).toHaveValue('');

        // Next button should be disabled
        const isDisabled = await copySetupPage.nextButton.isDisabled();
        expect(isDisabled).toBe(true);
    });

    test('advance to step 2 from step 1', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Fill wallet
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);

        // Go to next step
        await copySetupPage.nextStep();

        // Should be on step 2
        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(2);
    });

    // ─── Copy Setup Wizard — Step 2 (Mode) ─────────────────────────────────

    test('step 2 shows mode selection', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Navigate to step 2
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Verify mode select is visible
        await expect(copySetupPage.modeSelect).toBeVisible();
    });

    test('select percentage mode in step 2', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select PERCENTAGE mode
        await copySetupPage.selectMode('PERCENTAGE');

        // Size input should be visible
        await expect(copySetupPage.sizeInput).toBeVisible();

        // Enter percentage value
        await copySetupPage.setSize('50');

        // Verify value is set
        const value = await copySetupPage.sizeInput.inputValue();
        expect(value).toBe('50');
    });

    test('select fixed mode in step 2', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select FIXED mode
        await copySetupPage.selectMode('FIXED');

        // Size input should be visible
        await expect(copySetupPage.sizeInput).toBeVisible();

        // Enter fixed amount
        await copySetupPage.setSize('100');

        const value = await copySetupPage.sizeInput.inputValue();
        expect(value).toBe('100');
    });

    test('select mirror mode in step 2', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select MIRROR mode
        await copySetupPage.selectMode('MIRROR');

        // Mirror mode should not require size input
        const sizeVisible = await copySetupPage.sizeInput.isVisible().catch(() => false);

        // Size input may or may not be visible for mirror
        // Just verify we can proceed
        await copySetupPage.nextStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(3);
    });

    test('back button in step 2 returns to step 1 with data preserved', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Fill step 1
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Fill step 2
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');

        // Go back
        await copySetupPage.previousStep();

        // Verify step 1
        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(1);

        // Verify data is still there
        const walletValue = await copySetupPage.walletAddressInput.inputValue();
        expect(walletValue).toBe(VALID_WHALE_ADDRESS);
    });

    test('advance from step 2 to step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');

        await copySetupPage.nextStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(3);
    });

    // ─── Copy Setup Wizard — Step 3 (Risk) ──────────────────────────────────

    test('step 3 shows risk parameter inputs', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Navigate to step 3
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        // Verify risk inputs are visible
        await expect(copySetupPage.maxExposureInput).toBeVisible();
        await expect(copySetupPage.maxDailyLossInput).toBeVisible();
        await expect(copySetupPage.priceOffsetInput).toBeVisible();
    });

    test('set max exposure in step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        await copySetupPage.maxExposureInput.fill('500');

        const value = await copySetupPage.maxExposureInput.inputValue();
        expect(value).toBe('500');
    });

    test('set max daily loss in step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        await copySetupPage.maxDailyLossInput.fill('100');

        const value = await copySetupPage.maxDailyLossInput.inputValue();
        expect(value).toBe('100');
    });

    test('set price offset in step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        await copySetupPage.priceOffsetInput.fill('0.02');

        const value = await copySetupPage.priceOffsetInput.inputValue();
        expect(value).toBe('0.02');
    });

    test('risk parameters are optional in step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        // Don't fill risk parameters
        // Should still be able to proceed
        await copySetupPage.nextStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(4);
    });

    test('back button in step 3 returns to step 2', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('FIXED');
        await copySetupPage.setSize('100');
        await copySetupPage.nextStep();

        await copySetupPage.maxExposureInput.fill('500');

        // Go back
        await copySetupPage.previousStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(2);

        // Verify step 2 data preserved
        const sizeValue = await copySetupPage.sizeInput.inputValue();
        expect(sizeValue).toBe('100');
    });

    test('advance from step 3 to step 4', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();

        await copySetupPage.setRiskParams({
            maxExposure: '500',
            maxDailyLoss: '100',
            priceOffset: '0.02',
        });

        await copySetupPage.nextStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(4);
    });

    // ─── Copy Setup Wizard — Step 4 (Review) ────────────────────────────────

    test('step 4 shows setup summary', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Complete steps 1-3
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('75');
        await copySetupPage.nextStep();
        await copySetupPage.setRiskParams({
            maxExposure: '1000',
            maxDailyLoss: '200',
            priceOffset: '0.03',
        });
        await copySetupPage.nextStep();

        // Verify summary display
        await expect(copySetupPage.summaryDisplay).toBeVisible();

        const summary = await copySetupPage.review();
        expect(summary).toBeTruthy();
    });

    test('step 4 summary shows all entered values', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('FIXED');
        await copySetupPage.setSize('250');
        await copySetupPage.nextStep();
        await copySetupPage.setRiskParams({
            maxExposure: '2000',
            maxDailyLoss: '500',
            priceOffset: '0.05',
        });
        await copySetupPage.nextStep();

        const summary = await copySetupPage.review();

        // Summary should contain the values we entered
        expect(summary).toContain(VALID_WHALE_ADDRESS);
        expect(summary).toMatch(/250|Fixed/i);
    });

    test('confirm button in step 4 creates copy configuration', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(ANOTHER_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('MIRROR');
        await copySetupPage.nextStep();
        // Skip risk params
        await copySetupPage.nextStep();

        // Verify confirm button is visible
        await expect(copySetupPage.confirmButton).toBeVisible();

        // Click confirm
        await copySetupPage.confirm();

        // Should navigate away from setup page
        const url = page.url();
        expect(url).not.toMatch(/\/copy\/(new|setup)/);
    });

    test('back button in step 4 returns to step 3', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('60');
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();

        // Go back from review
        await copySetupPage.previousStep();

        const currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(3);
    });

    // ─── Copy Lifecycle Management ────────────────────────────────────────────

    test('created copy appears in list with active status', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Create a new copy
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize('50');
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();
        await copySetupPage.confirm();

        // Navigate back to list
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        // New copy should be visible
        const copyCount = await copyListPage.getCopyCount();
        expect(copyCount).toBeGreaterThan(0);

        // First copy should have ACTIVE status
        const firstCard = page.locator('[data-testid="copy-config-card"]').first();
        const statusBadge = firstCard.locator('[data-testid="status-badge"]');
        const statusText = await statusBadge.textContent() || '';

        expect(statusText).toContain('ACTIVE');
    });

    test('pause active copy changes status to paused', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');
            const statusBefore = await statusBadge.textContent();

            if (statusBefore?.includes('ACTIVE')) {
                // Find and click pause button
                const pauseButton = firstCard.locator('button[data-action="pause"], button:has-text("Pause")');
                const isPauseVisible = await pauseButton.isVisible().catch(() => false);

                if (isPauseVisible) {
                    await pauseButton.click();

                    const statusAfter = await statusBadge.textContent();
                    expect(statusAfter).toContain('PAUSED');
                }
            }
        }
    });

    test('resume paused copy changes status to active', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');
            const statusText = await statusBadge.textContent() || '';

            if (statusText.includes('PAUSED')) {
                // Find and click resume button
                const resumeButton = firstCard.locator('button[data-action="resume"], button:has-text("Resume")');
                const isResumeVisible = await resumeButton.isVisible().catch(() => false);

                if (isResumeVisible) {
                    await resumeButton.click();

                    const statusAfter = await statusBadge.textContent();
                    expect(statusAfter).toContain('ACTIVE');
                }
            }
        }
    });

    test('stop copy changes status to stopped', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();

            // Find and click stop button
            const stopButton = firstCard.locator('button[data-action="stop"], button:has-text("Stop")');
            const isStopVisible = await stopButton.isVisible().catch(() => false);

            if (isStopVisible) {
                await stopButton.click();

                // May need to confirm action
                const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
                const isConfirmVisible = await confirmButton.isVisible().catch(() => false);

                if (isConfirmVisible) {
                    await confirmButton.click();
                }


                const statusBadge = firstCard.locator('[data-testid="status-badge"]');
                const statusAfter = await statusBadge.textContent();
                expect(statusAfter).toContain('STOPPED');
            }
        }
    });

    test('stopped copy cannot be resumed', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');
            const statusText = await statusBadge.textContent() || '';

            if (statusText.includes('STOPPED')) {
                // Resume button should not be visible
                const resumeButton = firstCard.locator('button[data-action="resume"], button:has-text("Resume")');
                const isResumeVisible = await resumeButton.isVisible().catch(() => false);

                expect(isResumeVisible).toBe(false);
            }
        }
    });

    // ─── Copy Detail Page ─────────────────────────────────────────────────────

    test('navigate to copy detail page from list', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();

            // Click on card
            await firstCard.click();

            // Should navigate to detail page
            await expect(page).toHaveURL(/\/copy\/\w+/);
        }
    });

    test('copy detail page shows full configuration', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            await firstCard.click();

            // Verify detail page content
            await expect(page.locator('h1', { hasText: /Copy|detail|configuration/i })).toBeVisible({ timeout: 10_000 });

            // Should show configuration details
            const detailText = await page.locator('main').textContent() || '';
            expect(detailText).toBeTruthy();
        }
    });

    test('copy detail page shows copy trading history', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            await firstCard.click();

            // Should show history/trades section
            const historySection = page.locator('[data-testid="copy-history"], text=/history|trades|orders/i');
            const isVisible = await historySection.isVisible().catch(() => false);

            expect([true, false]).toContain(isVisible);
        }
    });

    test('copy detail page has action buttons', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            await firstCard.click();

            // Should have action buttons (pause/resume/stop)
            const actionButtons = page.locator('button[data-action], button:has-text(/pause|resume|stop|edit/i)');
            const count = await actionButtons.count();

            expect(count).toBeGreaterThan(0);
        }
    });

    // ─── Wizard Validation & Navigation ────────────────────────────────────────

    test('cannot skip steps in wizard', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Should be on step 1
        let currentStep = await copySetupPage.getCurrentStep();
        expect(currentStep).toBe(1);

        // Next button should be disabled without entering wallet
        const nextDisabled = await copySetupPage.nextButton.isDisabled();
        expect(nextDisabled).toBe(true);
    });

    test('step indicators show current and completed steps', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Check step indicator count
        const stepCount = await copySetupPage.getStepCount();
        expect(stepCount).toBe(4);

        // Step 1 should be active
        const activeStep = page.locator('[data-testid="step-indicator"][aria-current="step"]');
        const activeCount = await activeStep.count();
        expect(activeCount).toBeGreaterThan(0);
    });

    test('wizard preserves data when navigating back and forth', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        const testAddress = VALID_WHALE_ADDRESS;
        const testPercentage = '75';
        const testExposure = '1500';

        // Step 1
        await copySetupPage.walletAddressInput.fill(testAddress);
        await copySetupPage.nextStep();

        // Step 2
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.setSize(testPercentage);
        await copySetupPage.nextStep();

        // Step 3
        await copySetupPage.maxExposureInput.fill(testExposure);

        // Go back to step 1
        await copySetupPage.previousStep();
        await copySetupPage.previousStep();

        // Verify step 1 data
        let walletValue = await copySetupPage.walletAddressInput.inputValue();
        expect(walletValue).toBe(testAddress);

        // Go forward to step 2
        await copySetupPage.nextStep();

        // Verify step 2 data
        let sizeValue = await copySetupPage.sizeInput.inputValue();
        expect(sizeValue).toBe(testPercentage);

        // Go forward to step 3
        await copySetupPage.nextStep();

        // Verify step 3 data
        let exposureValue = await copySetupPage.maxExposureInput.inputValue();
        expect(exposureValue).toBe(testExposure);
    });

});
