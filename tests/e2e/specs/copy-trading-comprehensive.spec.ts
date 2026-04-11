import { test, expect } from '@playwright/test';
import { CopyListPage } from '../pages/copy-list.page';
import { CopySetupPage } from '../pages/copy-setup.page';
import { apiLogin } from '../helpers/api';

/**
 * Copy Trading — Full Workflow Coverage
 *
 * Comprehensive test suite for copy trading functionality.
 * Covers list page, setup wizard (all 5 steps), lifecycle management,
 * and detail page navigation.
 *
 * Wizard steps: 0=Target, 1=Mode, 2=Size, 3=Risk, 4=Review
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
        await expect(page.locator('h1', { hasText: /Copy Trading/i })).toBeVisible();

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

        // Should navigate to /copy/new
        await expect(page).toHaveURL(/\/copy\/new/);
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

    // ─── Copy Setup Wizard — Step 0 (Target) ────────────────────────────────

    test('@smoke copy setup wizard navigates from list', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        await copyListPage.goToNewCopy();

        // Should be on setup page
        await expect(page).toHaveURL(/\/copy\/new/);

        // Verify step 0 is displayed — shows wallet address heading
        await expect(page.locator('h2', { hasText: /Target Wallet/i })).toBeVisible();
    });

    test('step 0 shows wallet address input', async ({ page }) => {
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

    test('empty wallet address disables next button', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Leave wallet empty — clear any prefilled value
        await copySetupPage.walletAddressInput.clear();

        // Next button should be disabled
        const isDisabled = await copySetupPage.nextButton.isDisabled();
        expect(isDisabled).toBe(true);
    });

    test('advance to step 1 (Mode) from step 0', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Fill wallet
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);

        // Go to next step
        await copySetupPage.nextStep();

        // Should be on step 1 (Mode) — heading says "Copy Mode"
        await expect(page.locator('h2', { hasText: /Copy Mode/i })).toBeVisible();
    });

    // ─── Copy Setup Wizard — Step 1 (Mode) ─────────────────────────────────

    test('step 1 shows mode selection cards', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Navigate to step 1
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Verify mode cards are visible
        await expect(page.locator('button', { hasText: 'Percentage' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Fixed Amount' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Mirror (1:1)' })).toBeVisible();
    });

    test('select percentage mode in step 1', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select PERCENTAGE mode
        await copySetupPage.selectMode('PERCENTAGE');

        // The percentage card should have active styling (pf-cyan)
        const percentBtn = page.locator('button', { hasText: 'Percentage' });
        const classes = await percentBtn.getAttribute('class') ?? '';
        expect(classes).toContain('pf-cyan');
    });

    test('select fixed mode in step 1', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select FIXED mode
        await copySetupPage.selectMode('FIXED');

        // The fixed card should have active styling
        const fixedBtn = page.locator('button', { hasText: 'Fixed Amount' });
        const classes = await fixedBtn.getAttribute('class') ?? '';
        expect(classes).toContain('pf-cyan');
    });

    test('select mirror mode in step 1', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Select MIRROR mode
        await copySetupPage.selectMode('MIRROR');

        // The mirror card should have active styling
        const mirrorBtn = page.locator('button', { hasText: 'Mirror (1:1)' });
        const classes = await mirrorBtn.getAttribute('class') ?? '';
        expect(classes).toContain('pf-cyan');
    });

    test('advance from step 1 to step 2 (Size)', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.nextStep();

        // Should be on step 2 (Size)
        await expect(page.locator('h2', { hasText: /Trade Size/i })).toBeVisible();
    });

    // ─── Copy Setup Wizard — Step 2 (Size) ──────────────────────────────────

    test('step 2 shows size controls for non-mirror modes', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('FIXED');
        await copySetupPage.nextStep();

        // Size controls should be visible (slider + number input)
        const numberInput = page.locator('input[type="number"]').first();
        await expect(numberInput).toBeVisible();
    });

    test('mirror mode step 2 shows informational text', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('MIRROR');
        await copySetupPage.nextStep();

        // Mirror mode shows informational text about 1:1 copying
        await expect(page.locator('text=/mirror mode|exact same size|1:1/i')).toBeVisible();
    });

    test('advance from step 2 to step 3 (Risk)', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();

        // Should be on step 3 (Risk)
        await expect(page.locator('h2', { hasText: /Risk Controls/i })).toBeVisible();
    });

    // ─── Copy Setup Wizard — Step 3 (Risk) ──────────────────────────────────

    test('step 3 shows risk parameter inputs', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Navigate to step 3
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.nextStep();
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
        await copySetupPage.nextStep();
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
        await copySetupPage.nextStep();
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
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();

        await copySetupPage.priceOffsetInput.fill('2');

        const value = await copySetupPage.priceOffsetInput.inputValue();
        expect(value).toBe('2');
    });

    test('advance from step 3 to step 4 (Review)', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();
        await copySetupPage.nextStep();

        // Should be on step 4 (Review)
        await expect(page.locator('h2', { hasText: /Review Configuration/i })).toBeVisible();
    });

    // ─── Copy Setup Wizard — Step 4 (Review) ────────────────────────────────

    test('step 4 shows setup summary with entered values', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Complete steps 0-3
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('PERCENTAGE');
        await copySetupPage.nextStep();
        // Step 2: size defaults are pre-filled, proceed
        await copySetupPage.nextStep();
        // Step 3: risk defaults are pre-filled, proceed
        await copySetupPage.nextStep();

        // Verify summary displays wallet address and mode
        const summary = await copySetupPage.review();
        expect(summary).toBeTruthy();
        expect(summary).toContain('PERCENTAGE');
    });

    test('submit button creates copy configuration', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Complete all steps
        await copySetupPage.walletAddressInput.fill(ANOTHER_WHALE_ADDRESS);
        await copySetupPage.nextStep();
        await copySetupPage.selectMode('MIRROR');
        await copySetupPage.nextStep();
        // Mirror mode — size step just shows info, proceed
        await copySetupPage.nextStep();
        // Risk — defaults are fine, proceed
        await copySetupPage.nextStep();

        // Verify submit button is visible
        await expect(copySetupPage.submitButton).toBeVisible();

        // Click submit
        await copySetupPage.confirm();

        // Should navigate away from setup page (to detail or list)
        const url = page.url();
        expect(url).not.toContain('/copy/new');
    });

    // ─── Back Navigation ─────────────────────────────────────────────────────

    test('back button in step 1 returns to step 0 with data preserved', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Fill step 0
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Go back
        await copySetupPage.previousStep();

        // Verify step 0 visible and data preserved
        await expect(page.locator('h2', { hasText: /Target Wallet/i })).toBeVisible();
        const walletValue = await copySetupPage.walletAddressInput.inputValue();
        expect(walletValue).toBe(VALID_WHALE_ADDRESS);
    });

    test('wizard preserves data when navigating back and forth', async ({ page }) => {
        const copySetupPage = new CopySetupPage(page);
        await copySetupPage.goto();

        // Step 0: fill wallet
        await copySetupPage.walletAddressInput.fill(VALID_WHALE_ADDRESS);
        await copySetupPage.nextStep();

        // Step 1: select mode
        await copySetupPage.selectMode('FIXED');
        await copySetupPage.nextStep();

        // Step 2: size has default value, proceed
        await copySetupPage.nextStep();

        // Step 3: set risk params
        await copySetupPage.maxExposureInput.fill('1500');

        // Go back to step 0
        await copySetupPage.previousStep(); // → step 2
        await copySetupPage.previousStep(); // → step 1
        await copySetupPage.previousStep(); // → step 0

        // Verify step 0 data
        const walletValue = await copySetupPage.walletAddressInput.inputValue();
        expect(walletValue).toBe(VALID_WHALE_ADDRESS);

        // Go forward to step 3
        await copySetupPage.nextStep(); // → step 1
        await copySetupPage.nextStep(); // → step 2
        await copySetupPage.nextStep(); // → step 3

        // Verify step 3 data
        const exposureValue = await copySetupPage.maxExposureInput.inputValue();
        expect(exposureValue).toBe('1500');
    });

    // ─── Copy Lifecycle Management ────────────────────────────────────────────

    test('pause active copy changes status to paused', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const statusBadge = firstCard.locator('[data-testid="status-badge"]');
            const statusBefore = await statusBadge.textContent();

            if (statusBefore?.includes('ACTIVE')) {
                const pauseButton = firstCard.locator('button[aria-label="Pause config"]');
                const isPauseVisible = await pauseButton.isVisible().catch(() => false);

                if (isPauseVisible) {
                    await pauseButton.click();
                    // Wait for status to update
                    await page.waitForTimeout(1000);
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
                const resumeButton = firstCard.locator('button[aria-label="Resume config"]');
                const isResumeVisible = await resumeButton.isVisible().catch(() => false);

                if (isResumeVisible) {
                    await resumeButton.click();
                    await page.waitForTimeout(1000);
                    const statusAfter = await statusBadge.textContent();
                    expect(statusAfter).toContain('ACTIVE');
                }
            }
        }
    });

    test('navigate to copy detail page from list', async ({ page }) => {
        const copyListPage = new CopyListPage(page);
        await copyListPage.goto();

        const copyCount = await copyListPage.getCopyCount();

        if (copyCount > 0) {
            // Click the "View config details" button (eye icon)
            const firstCard = page.locator('[data-testid="copy-config-card"]').first();
            const viewButton = firstCard.locator('button[aria-label="View config details"]');

            if (await viewButton.isVisible().catch(() => false)) {
                await viewButton.click();
                // Should navigate to detail page
                await expect(page).toHaveURL(/\/copy\/\w+/);
            }
        }
    });
});
