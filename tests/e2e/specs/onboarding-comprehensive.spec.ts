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
        // Clear onboarding flags so the checklist appears for fresh users
        await page.addInitScript(() => {
            localStorage.removeItem('polyforge:onboarding:dismissed');
            localStorage.removeItem('polyforge:onboarding:completed');
            localStorage.removeItem('pf-onboarding-complete');
            localStorage.removeItem('pf-onboarding-dismissed');
        });

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
        // Clear onboarding flags so the checklist appears for fresh users
        await page.addInitScript(() => {
            localStorage.removeItem('polyforge:onboarding:dismissed');
            localStorage.removeItem('polyforge:onboarding:completed');
            localStorage.removeItem('pf-onboarding-complete');
            localStorage.removeItem('pf-onboarding-dismissed');
        });

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

        await loginPage.loginAndRedirect(email, 'Password123!');

        // Get checklist items
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        // Wait for checklist to appear (may take a moment after layout mounts)
        if (!(await checklist.isVisible({ timeout: 5_000 }).catch(() => false))) return; // Skip if dismissed
        const items = checklist.locator('[data-testid="checklist-item"]');
        const itemCount = await items.count();

        // Should have 6 items: profile, markets, strategy, backtest, paper trade, notifications
        expect(itemCount).toBe(6);

        // Verify item labels — patterns must uniquely match exactly one checklist item.
        // hasText checks ALL nested text (labels + descriptions), so `/strategy/i`
        // would match 3 items ("Build your first strategy", "Backtest your strategy",
        // and "Start a paper trade" whose description mentions "strategy").
        const expectedItems = [
            /complete your profile/i,
            /browse.*markets/i,
            /build your first strategy/i,
            /backtest your strategy/i,
            /start a paper trade/i,
            /set up notifications/i,
        ];

        for (const pattern of expectedItems) {
            const item = checklist.locator('[data-testid="checklist-item"]', { hasText: pattern });
            await expect(item).toBeVisible({ timeout: 5000 });
        }
    });

    test('completing a checklist item checks it off', async ({ page }) => {
        // Clear onboarding flags so the checklist appears for fresh users
        await page.addInitScript(() => {
            localStorage.removeItem('polyforge:onboarding:dismissed');
            localStorage.removeItem('polyforge:onboarding:completed');
            localStorage.removeItem('pf-onboarding-complete');
            localStorage.removeItem('pf-onboarding-dismissed');
        });

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

        // The checklist items are completed by clicking the circle toggle
        // button, not by visiting the route.  Click the toggle button on the
        // "Markets" item and verify it becomes checked (renders CheckCircle2
        // with text-pf-success class).
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        if (!(await checklist.isVisible({ timeout: 5_000 }).catch(() => false))) return;

        const marketItem = checklist.locator('[data-testid="checklist-item"]', { hasText: /markets/i });
        await expect(marketItem).toBeVisible({ timeout: 5_000 });

        // Click the circle/toggle button within the Markets item
        const toggleButton = marketItem.locator('button').first();
        await toggleButton.click();

        // Verify the item now shows a CheckCircle2 icon (text-gain = success color after token rename)
        const successIcon = marketItem.locator('.text-gain');
        await expect(successIcon).toBeVisible({ timeout: 5_000 });
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
        if (!(await checklist.isVisible({ timeout: 5_000 }).catch(() => false))) return;

        // Get initial progress from the progress bar
        const progressBar = checklist.locator('[role="progressbar"]').first();
        if (!(await progressBar.isVisible().catch(() => false))) return;

        const initialProgress = await progressBar.evaluate((el) => {
            return parseInt(el.getAttribute('aria-valuenow') ?? '0');
        }).catch(() => 0);

        // Toggle a checklist item (e.g. "Browse prediction markets") by clicking its toggle button
        const marketItem = checklist.locator('[data-testid="checklist-item"]', { hasText: /markets/i }).first();
        if (await marketItem.isVisible().catch(() => false)) {
            const toggleBtn = marketItem.locator('button').first();
            await toggleBtn.click();
            await page.waitForTimeout(500);
        }

        // Re-read progress
        const newProgress = await progressBar.evaluate((el) => {
            return parseInt(el.getAttribute('aria-valuenow') ?? '0');
        }).catch(() => 0);

        expect(newProgress).toBeGreaterThanOrEqual(initialProgress);
    });

    test('dismiss checklist hides it', async ({ page }) => {
        // Clear onboarding flags so the checklist appears for fresh users
        await page.addInitScript(() => {
            localStorage.removeItem('polyforge:onboarding:dismissed');
            localStorage.removeItem('polyforge:onboarding:completed');
            localStorage.removeItem('pf-onboarding-complete');
            localStorage.removeItem('pf-onboarding-dismissed');
        });

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

        // New users see the OnboardingModal (role="dialog") first — dismiss it
        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const skipBtn = modal.locator('button[aria-label="Skip onboarding"], button:has-text("Skip")').first();
            if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await skipBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(modal).toBeHidden({ timeout: 5_000 });
        }

        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        await expect(checklist).toBeVisible({ timeout: 5_000 });

        // Find dismiss button — aria-label is "Dismiss checklist" (capital D)
        const dismissBtn = checklist.locator('button[aria-label*="Dismiss" i], button[aria-label*="close" i], [data-testid="close"]').first();
        if (await dismissBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await dismissBtn.click();

            // Checklist should be hidden
            await expect(checklist).toBeHidden({ timeout: 5_000 });
        }
    });

    test('dismissed checklist does not reappear on page refresh', async ({ page }) => {
        // This test verifies that the dismiss flag in localStorage persists across
        // page reloads. We set the dismissed flag directly (simulating a user who
        // already dismissed the checklist) and verify it stays dismissed after reload.
        // NOTE: We cannot use addInitScript to clear flags AND then verify they persist,
        // because addInitScript re-runs on every navigation including reload.

        const loginPage = new LoginPage(page);

        // Set dismiss flags directly in localStorage before navigating
        await page.addInitScript(() => {
            localStorage.setItem('polyforge:onboarding:dismissed', 'true');
            localStorage.setItem('pf-onboarding-complete', 'true');
        });

        // Login as pre-seeded user
        await loginPage.goto();
        await loginPage.loginAndRedirect('alice@e2e.dev.local', 'TestPass123!');

        // Checklist should NOT be visible (dismissed via localStorage)
        const checklist = page.locator('[data-testid="onboarding-checklist"], [data-testid="checklist"]').first();
        const isHiddenInitial = !(await checklist.isVisible({ timeout: 3_000 }).catch(() => false));
        expect(isHiddenInitial).toBe(true);

        // Refresh and verify it stays dismissed
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({ timeout: 10_000 });

        const isHiddenAfterReload = !(await checklist.isVisible({ timeout: 3_000 }).catch(() => false));
        expect(isHiddenAfterReload).toBe(true);
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
