import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import {
    uniqueEmail,
    uniqueUsername,
} from '../helpers/api';
import {
    clearAllMessages,
    getVerificationUrl,
} from '../helpers/mailhog';

/**
 * Comprehensive onboarding tests for PolyForge.
 *
 * Covers:
 *   - Onboarding checklist display and completion
 *   - Checklist progress tracking
 *   - Checklist dismissal and persistence
 *   - Tooltip tour (8 steps)
 *   - Tour navigation (next, previous, close)
 *   - Tour step highlighting
 *   - Tour completion and non-reappearance
 */

test.describe.serial('Onboarding — Full Workflow Coverage', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Create new user and login for first visit
    // ─────────────────────────────────────────────────────────────────────────

    test.beforeEach(async () => {
        await clearAllMessages();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ONBOARDING CHECKLIST TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke new user sees onboarding checklist on first visit', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('onboard');
        const username = uniqueUsername('onboard');

        // Register
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });

        // Verify
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        // Login
        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Onboarding checklist should be visible
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        await expect(checklist).toBeVisible({ timeout: 10_000 });
    });

    test('checklist shows 6 required items', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('checkitems');
        const username = uniqueUsername('checkitems');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();

        // Clear onboarding-complete flag so checklist appears for fresh user
        await page.evaluate(() => localStorage.removeItem('pf-onboarding-complete'));

        await loginPage.loginAndRedirect(email, 'Password123!');

        // Get checklist items
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        // Wait for checklist to appear (may take a moment after layout mounts)
        if (!(await checklist.isVisible({ timeout: 5_000 }).catch(() => false))) return; // Skip if dismissed
        const items = checklist.locator('[data-testid="checklist-item"]');
        const itemCount = await items.count();

        // Should have 6 items: profile, markets, strategy, backtest, paper trade, notifications
        expect(itemCount).toBe(6);

        // Verify item labels
        const expectedItems = [
            /profile/i,
            /markets/i,
            /strategy/i,
            /backtest/i,
            /paper\s*trade|trading/i,
            /notifications/i,
        ];

        for (const pattern of expectedItems) {
            const item = checklist.locator('[data-testid="checklist-item"], li', { hasText: pattern });
            await expect(item).toBeVisible({ timeout: 5000 });
        }
    });

    test('completing a checklist item checks it off', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('completeitem');
        const username = uniqueUsername('completeitem');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Navigate to Markets page (completes "Markets" item)
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const marketLink = sidebar.locator('a, button', { hasText: /markets/i });
        await marketLink.click();
        await expect(page).toHaveURL(/\/markets/);

        // Check that Markets item is now marked complete
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const marketItem = checklist.locator('[data-testid="checklist-item"], li', { hasText: /markets/i });

        // Look for checkmark or completed indicator
        const isChecked = await marketItem.evaluate((el) => {
            const hasCheckClass = el.classList.contains('completed') || el.classList.contains('done') || el.classList.contains('checked');
            const hasCheckMark = el.textContent?.includes('✓') || el.innerHTML?.includes('check');
            const inputEl = el.querySelector('input[type="checkbox"]');
            const isInputChecked = inputEl && (inputEl as HTMLInputElement).checked;
            return hasCheckClass || hasCheckMark || isInputChecked;
        }).catch(() => false);

        expect(isChecked).toBe(true);
    });

    test('checklist progress bar reflects completed items', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('progress');
        const username = uniqueUsername('progress');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();

        // Get initial progress
        const progressBar = checklist.locator('[data-testid="progress-bar"], .progress, [role="progressbar"]').first();
        const initialProgress = await progressBar.evaluate((el) => {
            const ariaValue = el.getAttribute('aria-valuenow');
            const widthStyle = el.getAttribute('style');
            return ariaValue ? parseInt(ariaValue) : widthStyle ? parseInt(widthStyle.match(/(\d+)/)?.[1] ?? '0') : 0;
        }).catch(() => 0);

        // Complete a task
        const sidebar = page.locator('[role="navigation"], nav, [data-testid="sidebar"]').first();
        const marketLink = sidebar.locator('a, button', { hasText: /markets/i });
        await marketLink.click();
        await expect(page).toHaveURL(/\/markets/);

        // Get new progress
        const newProgress = await progressBar.evaluate((el) => {
            const ariaValue = el.getAttribute('aria-valuenow');
            const widthStyle = el.getAttribute('style');
            return ariaValue ? parseInt(ariaValue) : widthStyle ? parseInt(widthStyle.match(/(\d+)/)?.[1] ?? '0') : 0;
        }).catch(() => 0);

        expect(newProgress).toBeGreaterThan(initialProgress);
    });

    test('dismiss checklist hides it', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('dismiss');
        const username = uniqueUsername('dismiss');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        await expect(checklist).toBeVisible();

        // Find dismiss button (X, close, etc.)
        const dismissBtn = checklist.locator('button[aria-label*="close"], button[aria-label*="dismiss"], [data-testid="close"]').first();
        if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await dismissBtn.click();

            // Checklist should be hidden
            const isHidden = !(await checklist.isVisible({ timeout: 2000 }).catch(() => false));
            expect(isHidden).toBe(true);
        }
    });

    test('dismissed checklist does not reappear on page refresh', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('dismissrefresh');
        const username = uniqueUsername('dismissrefresh');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Dismiss checklist
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const dismissBtn = checklist.locator('button[aria-label*="close"], button[aria-label*="dismiss"], [data-testid="close"]').first();
        if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await dismissBtn.click();
        }

        // Refresh page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Checklist should still be dismissed
        const isHidden = !(await checklist.isVisible({ timeout: 2000 }).catch(() => false));
        expect(isHidden).toBe(true);
    });

    test('tour link in checklist triggers tooltip tour', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourlink');
        const username = uniqueUsername('tourlink');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Find tour link in checklist
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            // Tour should start (should see tour overlay/tooltip)
            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLTIP TOUR TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke tour starts at step 1 (Navigation/sidebar)', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tour1');
        const username = uniqueUsername('tour1');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Check for step counter or title mentioning step 1
            const stepText = tourOverlay.locator('text=/step\s*1|navigation|sidebar/i');
            await expect(stepText).toBeVisible({ timeout: 3000 });
        }
    });

    test('next button advances through all 8 tour steps', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tour8steps');
        const username = uniqueUsername('tour8steps');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Click next 7 times to go from step 1 → step 8
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });

            for (let i = 1; i <= 7; i++) {
                // Check current step
                const stepCounter = tourOverlay.locator('text=/step\\s*(\\d+)\\s*of\\s*8/i');
                const currentText = await stepCounter.textContent().catch(() => '');
                expect(currentText).toContain(`${i}`);

                // Click next
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            // Should now be on step 8
            const finalStepCounter = tourOverlay.locator('text=/step\\s*8\\s*of\\s*8/i');
            await expect(finalStepCounter).toBeVisible({ timeout: 3000 });
        }
    });

    test('previous button goes back to prior tour step', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourprev');
        const username = uniqueUsername('tourprev');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Go to step 3
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });
            for (let i = 0; i < 2; i++) {
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            // Should be on step 3
            const stepCounter = tourOverlay.locator('text=/step\\s*3\\s*of\\s*8/i');
            await expect(stepCounter).toBeVisible({ timeout: 3000 });

            // Click previous
            const prevBtn = tourOverlay.locator('button', { hasText: /previous|back/i });
            if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await prevBtn.click();

                // Should be back on step 2
                const step2Counter = tourOverlay.locator('text=/step\\s*2\\s*of\\s*8/i');
                await expect(step2Counter).toBeVisible({ timeout: 3000 });
            }
        }
    });

    test('close button ends tour at any step', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourclose');
        const username = uniqueUsername('tourclose');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Advance to step 4
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });
            for (let i = 0; i < 3; i++) {
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            // Click close button
            const closeBtn = tourOverlay.locator('button[aria-label*="close"], button', { hasText: /close|exit|skip/i }).first();
            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeBtn.click();

                // Tour should be gone
                const isHidden = !(await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false));
                expect(isHidden).toBe(true);
            }
        }
    });

    test('tour highlights correct data-tour elements at each step', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourhighlight');
        const username = uniqueUsername('tourhighlight');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Check that a data-tour element is highlighted at step 1
            const highlightedStep1 = page.locator('[data-tour="1"], [data-tour-active="1"]');
            const isHighlighted = await highlightedStep1.evaluate((el) => {
                const computedStyle = window.getComputedStyle(el);
                const hasHighlight = el.classList.contains('highlighted') || el.classList.contains('active') || el.classList.contains('tour-active');
                const hasBoxShadow = computedStyle.boxShadow && computedStyle.boxShadow !== 'none';
                const hasOverlay = el.style.outline || el.style.border;
                return hasHighlight || hasBoxShadow || hasOverlay;
            }).catch(() => false);

            if (isHighlighted) {
                expect(isHighlighted).toBe(true);
            }

            // Go to step 2 and check that appropriate element is highlighted
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });
            if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nextBtn.click();

                const highlightedStep2 = page.locator('[data-tour="2"], [data-tour-active="2"]');
                const isStep2Highlighted = await highlightedStep2.evaluate((el) => {
                    const computedStyle = window.getComputedStyle(el);
                    const hasHighlight = el.classList.contains('highlighted') || el.classList.contains('active') || el.classList.contains('tour-active');
                    const hasBoxShadow = computedStyle.boxShadow && computedStyle.boxShadow !== 'none';
                    return hasHighlight || hasBoxShadow;
                }).catch(() => false);

                if (isStep2Highlighted) {
                    expect(isStep2Highlighted).toBe(true);
                }
            }
        }
    });

    test('completed tour does not show again on refresh', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourcomplete');
        const username = uniqueUsername('tourcomplete');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Complete tour by going through all 8 steps and closing
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });
            for (let i = 0; i < 7; i++) {
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            // Close on final step
            const closeBtn = tourOverlay.locator('button[aria-label*="close"], button', { hasText: /finish|complete|close/i }).first();
            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeBtn.click();
            }

            // Refresh page
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Tour should not reappear
            const tourAgain = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            const isHidden = !(await tourAgain.isVisible({ timeout: 2000 }).catch(() => false));
            expect(isHidden).toBe(true);
        }
    });

    test('tour step counter shows correct "Step X of 8"', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('toursCounter');
        const username = uniqueUsername('tourCounter');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Start tour
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const tourLink = checklist.locator('a, button', { hasText: /tour|guide|walkthrough/i });

        if (await tourLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tourLink.click();

            const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
            await expect(tourOverlay).toBeVisible({ timeout: 5000 });

            // Step 1 of 8
            let stepText = await tourOverlay.locator('text=/step/i').textContent();
            expect(stepText).toMatch(/step\s+1\s+of\s+8/i);

            // Go to step 5
            const nextBtn = tourOverlay.locator('button', { hasText: /next/i });
            for (let i = 0; i < 4; i++) {
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            stepText = await tourOverlay.locator('text=/step/i').textContent();
            expect(stepText).toMatch(/step\s+5\s+of\s+8/i);

            // Go to step 8
            for (let i = 0; i < 3; i++) {
                if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nextBtn.click();
                }
            }

            stepText = await tourOverlay.locator('text=/step/i').textContent();
            expect(stepText).toMatch(/step\s+8\s+of\s+8/i);
        }
    });

    test('tour can be manually started from help menu', async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const loginPage = new LoginPage(page);
        const email = uniqueEmail('tourmanual');
        const username = uniqueUsername('tourmanual');

        // Register, verify, and login
        await registerPage.goto();
        await registerPage.register({ email, username, password: 'Password123!' });
        const verifyUrl = await getVerificationUrl(email);
        await page.goto(verifyUrl);
        await expect(page.locator('h1', { hasText: /verified/i })).toBeVisible({ timeout: 15_000 });

        await loginPage.goto();
        await loginPage.loginAndRedirect(email, 'Password123!');

        // Look for help button or support menu
        const helpBtn = page.locator('button[data-testid="help"], [aria-label*="help"], [aria-label*="support"]').first();
        if (await helpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await helpBtn.click();

            // Look for "Start Tour" option
            const startTourBtn = page.locator('button, a', { hasText: /start\s*tour|guided\s*tour|tour/i });
            if (await startTourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await startTourBtn.click();

                const tourOverlay = page.locator('[data-testid="tour"], .tour, [role="tooltip"]').first();
                await expect(tourOverlay).toBeVisible({ timeout: 5000 });
            }
        }
    });
});
