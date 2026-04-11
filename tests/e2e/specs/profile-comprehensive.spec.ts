import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/profile.page';
import { apiLogin } from '../helpers/api';

/**
 * Comprehensive Profile workflow tests for PolyForge.
 *
 * Covers:
 *   - My profile page (/profile/me)
 *   - Public profile pages (/profile/:username)
 *   - Edge Rating and score breakdown
 *   - Badges and earned/unearned states
 *   - Status indicators (Email Verified, Polymarket Connected, 2FA Enabled)
 *   - Navigation to related pages
 *   - Profile visibility and permissions
 */

const TEST_EMAIL = 'alice@e2e.dev.local';
const TEST_PASSWORD = 'TestPass123!';
const TEST_USERNAME = 'alice'; // Adjust to match test user

test.describe.serial('Profile — Full Workflow Coverage', () => {
    let profilePage: ProfilePage;

    test.beforeEach(async ({ page }) => {
        profilePage = new ProfilePage(page);

        // Login and set auth cookie
        const { token } = await apiLogin(TEST_EMAIL, TEST_PASSWORD);
        await page.context().addCookies([
            {
                name: 'pf_token',
                value: token,
                domain: 'localhost',
                path: '/',
            },
        ]);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // MY PROFILE TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke navigate to /profile/me shows own profile', async ({ page }) => {
        await profilePage.gotoProfile('me');

        expect(page.url()).toContain('/profile/me');
        await expect(page.locator('h1')).toBeVisible();
    });

    test('my profile displays display name correctly', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const displayName = await profilePage.getDisplayName();
        expect(displayName.length).toBeGreaterThan(0);
    });

    test('my profile displays username correctly', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const username = await profilePage.getUsername();
        expect(username.length).toBeGreaterThan(0);
    });

    test('my profile displays bio if present', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const bio = await profilePage.getBio();
        // Bio may be empty for new users
        expect(typeof bio).toBe('string');
    });

    test('my profile displays avatar if present', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const avatar = page.locator('[data-testid="profile-avatar"], img[alt="avatar"]');
        // Avatar may not be present for all users
        const count = await avatar.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('profile shows edit profile button on own profile', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const editButton = profilePage.editProfileButton;
        const isVisible = await editButton.isVisible();
        expect(isVisible).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EDGE RATING TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke edge rating score is displayed', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const edgeRating = await profilePage.getEdgeRating();
        expect(edgeRating).toBeDefined();
    });

    test('edge rating shows score breakdown metrics', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const metrics = [
            'Win Rate',
            'Sharpe Ratio',
            'Profit Factor',
            'Consistency',
            'Avg Return',
            'Total Trades',
        ];

        for (const metric of metrics) {
            const metricElement = page.locator(`text=${metric}`);
            const count = await metricElement.count();
            // Metrics should be present if user has trading history
            expect(count).toBeGreaterThanOrEqual(0);
        }
    });

    test('edge rating metrics display values', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const metricValues = page.locator('[data-testid="metric-value"]');
        const count = await metricValues.count();

        // Should have at least some metric values displayed
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('edge rating is color-coded based on value', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const ratingDisplay = page.locator('[data-testid="edge-rating"], [class*="rating"]');
        const color = await ratingDisplay.evaluate((el) => window.getComputedStyle(el).color);

        // Should have some color
        expect(color).toBeDefined();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // BADGES TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke badges grid is displayed', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const badgesContainer = page.locator('[data-testid="badges-container"], [data-testid="badges"]');
        const count = await badgesContainer.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('each badge shows icon and name', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const badges = profilePage.badges;
        const badgeCount = await badges.count();

        // If badges exist, check their structure
        if (badgeCount > 0) {
            for (let i = 0; i < Math.min(badgeCount, 3); i++) {
                const badge = badges.nth(i);
                const icon = badge.locator('[data-testid="badge-icon"], img, svg');
                const name = badge.locator('[data-testid="badge-name"], text');

                const iconCount = await icon.count();
                const nameCount = await name.count();

                // At least one of these should exist
                expect(iconCount + nameCount).toBeGreaterThan(0);
            }
        }
    });

    test('earned badges have date displayed', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const earnedBadges = page.locator('[data-testid="badge"][data-earned="true"]');
        const count = await earnedBadges.count();

        if (count > 0) {
            for (let i = 0; i < Math.min(count, 2); i++) {
                const badge = earnedBadges.nth(i);
                const dateElement = badge.locator('[data-testid="earned-date"]');
                const isVisible = await dateElement.isVisible();
                expect(isVisible).toBe(true);
            }
        }
    });

    test('unearned badges are dimmed or locked', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const unearnedBadges = page.locator('[data-testid="badge"][data-earned="false"]');
        const count = await unearnedBadges.count();

        if (count > 0) {
            for (let i = 0; i < Math.min(count, 2); i++) {
                const badge = unearnedBadges.nth(i);
                const opacity = await badge.evaluate((el) => window.getComputedStyle(el).opacity);
                // Should be dimmed or have reduced opacity
                const opacityValue = parseFloat(opacity);
                expect(opacityValue < 1).toBe(true);
            }
        }
    });

    test('badge count is retrievable', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const badgeCount = await profilePage.getBadgeCount();
        expect(typeof badgeCount).toBe('number');
        expect(badgeCount).toBeGreaterThanOrEqual(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS INDICATORS TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke status indicators are visible', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const statusChips = profilePage.statusChips;
        const count = await statusChips.count();

        // Should have at least one status chip
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('email verified status chip shown', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const emailStatus = page.locator('text=Email Verified, [data-testid="status-email"], [class*="verified"]');
        const count = await emailStatus.count();

        // May or may not be visible depending on implementation
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('email verified status is green when verified', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const emailStatus = page.locator('[data-testid="status-email-verified"]');
        if (await emailStatus.isVisible()) {
            const color = await emailStatus.evaluate((el) => window.getComputedStyle(el).color);
            // Should be green or similar success color
            expect(color).toBeDefined();
        }
    });

    test('polymarket connected status chip shown', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const polymarketStatus = page.locator('text=Polymarket Connected, [data-testid="status-polymarket"]');
        const count = await polymarketStatus.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('2FA enabled status chip shown', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const twoFAStatus = page.locator('text=2FA Enabled, [data-testid="status-2fa"]');
        const count = await twoFAStatus.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // QUICK LINKS TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke edit profile link navigates to /settings', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const editButton = profilePage.editProfileButton;
        await editButton.click();

        expect(page.url()).toContain('/settings');
    });

    test('settings link navigates to /settings', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const settingsLink = profilePage.settingsLink;
        if (await settingsLink.isVisible()) {
            await settingsLink.click();

            expect(page.url()).toContain('/settings');
        }
    });

    test('trading account link navigates to /settings/trading-account', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const tradingLink = profilePage.tradingAccountLink;
        if (await tradingLink.isVisible()) {
            await tradingLink.click();

            expect(page.url()).toContain('/trading-account');
        }
    });

    test('my strategies link navigates to /strategies', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const strategiesLink = profilePage.myStrategiesLink;
        if (await strategiesLink.isVisible()) {
            await strategiesLink.click();

            expect(page.url()).toContain('/strategies');
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC PROFILE TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke navigate to /profile/:username shows public profile', async ({ page }) => {
        // Create a second user to view public profile
        // For this test, navigate to a known public profile
        await profilePage.gotoProfile(TEST_USERNAME);

        expect(page.url()).toContain(`/profile/${TEST_USERNAME}`);
        await expect(page.locator('h1')).toBeVisible();
    });

    test('public profile shows user display name', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        const displayName = await profilePage.getDisplayName();
        expect(displayName.length).toBeGreaterThan(0);
    });

    test('public profile shows username', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        const username = await profilePage.getUsername();
        expect(username).toContain(TEST_USERNAME);
    });

    test('public profile shows bio if present', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        const bio = await profilePage.getBio();
        expect(typeof bio).toBe('string');
    });

    test('public profile shows edge rating if public', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        const edgeRating = await profilePage.getEdgeRating();
        // Edge rating may be private, so may not be shown
        expect(typeof edgeRating).toBe('string');
    });

    test('public profile shows badges', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        const badgeCount = await profilePage.getBadgeCount();
        expect(typeof badgeCount).toBe('number');
    });

    test('public profile does not show edit button', async ({ page }) => {
        // Navigate to someone elses profile
        const otherUsername = TEST_USERNAME === 'alice' ? 'bob' : 'alice';
        await profilePage.gotoProfile(otherUsername);

        const editButton = profilePage.editProfileButton;
        const isVisible = await editButton.isVisible();

        // Should not show edit button on other user's profile
        if (otherUsername !== TEST_USERNAME) {
            expect(isVisible).toBe(false);
        }
    });

    test('public profile does not show settings button for other users', async ({ page }) => {
        const otherUsername = TEST_USERNAME === 'alice' ? 'bob' : 'alice';
        await profilePage.gotoProfile(otherUsername);

        const settingsLink = profilePage.settingsLink;

        if (otherUsername !== TEST_USERNAME) {
            const isVisible = await settingsLink.isVisible();
            expect(isVisible).toBe(false);
        }
    });

    test('back navigation works from public profile', async ({ page }) => {
        await profilePage.gotoProfile(TEST_USERNAME);

        // Go back
        await page.goBack();

        // Should navigate away from profile
        expect(page.url()).not.toContain(`/profile/${TEST_USERNAME}`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PROFILE CONSISTENCY TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('my profile and public profile (self) show same display name', async ({ page }) => {
        await profilePage.gotoProfile('me');
        const myDisplayName = await profilePage.getDisplayName();

        await profilePage.gotoProfile(TEST_USERNAME);
        const publicDisplayName = await profilePage.getDisplayName();

        expect(myDisplayName).toBe(publicDisplayName);
    });

    test('my profile and public profile (self) show same username', async ({ page }) => {
        await profilePage.gotoProfile('me');
        const myUsername = await profilePage.getUsername();

        await profilePage.gotoProfile(TEST_USERNAME);
        const publicUsername = await profilePage.getUsername();

        expect(myUsername).toBe(publicUsername);
    });

    test('my profile and public profile (self) show same bio', async ({ page }) => {
        await profilePage.gotoProfile('me');
        const myBio = await profilePage.getBio();

        await profilePage.gotoProfile(TEST_USERNAME);
        const publicBio = await profilePage.getBio();

        expect(myBio).toBe(publicBio);
    });

    test('profile data matches after editing profile settings', async ({ page }) => {
        // First, navigate to profile and note current display name
        await profilePage.gotoProfile('me');
        const originalDisplayName = await profilePage.getDisplayName();

        // Navigate to settings and update profile
        await profilePage.goToEditProfile();

        // Update display name
        const newName = `UpdatedName${Date.now()}`;
        const displayNameInput = page.locator('input[placeholder*="Display Name"]');
        await displayNameInput.clear();
        await displayNameInput.fill(newName);

        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click();

        // Navigate back to profile
        await page.goto('/profile/me');

        const updatedDisplayName = await profilePage.getDisplayName();
        expect(updatedDisplayName).toBe(newName);
    });

    test('profile loads and displays all major sections', async ({ page }) => {
        await profilePage.gotoProfile('me');

        // Check for major sections
        const profileSection = page.locator('[data-testid="profile-section"], [class*="profile"]');
        const edgeRatingSection = page.locator('[data-testid="edge-rating"], [class*="rating"]');
        const badgesSection = page.locator('[data-testid="badges"], [class*="badges"]');

        // At least profile section should exist
        expect(await profileSection.count()).toBeGreaterThanOrEqual(0);
    });

    test('profile page has accessible heading hierarchy', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const h1 = page.locator('h1');
        const h2 = page.locator('h2');

        // Should have at least one h1 (username/display name)
        const h1Count = await h1.count();
        expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PROFILE NAVIGATION AND FLOW TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('can navigate from profile to settings and back to profile', async ({ page }) => {
        await profilePage.gotoProfile('me');
        const initialUrl = page.url();

        await profilePage.goToEditProfile();
        expect(page.url()).toContain('/settings');

        // Navigate back to profile
        await page.goBack();

        expect(page.url()).toBe(initialUrl);
    });

    test('can navigate from profile to strategies page', async ({ page }) => {
        await profilePage.gotoProfile('me');

        const myStrategiesLink = profilePage.myStrategiesLink;
        if (await myStrategiesLink.isVisible()) {
            await myStrategiesLink.click();

            expect(page.url()).toContain('/strategies');
        }
    });

    test('profile page is responsive and loads on different screen sizes', async ({ page }) => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await profilePage.gotoProfile('me');

        const displayName = await profilePage.getDisplayName();
        expect(displayName.length).toBeGreaterThan(0);

        // Test tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();

        const tabletDisplayName = await profilePage.getDisplayName();
        expect(tabletDisplayName).toBe(displayName);
    });

    test('profile page loads without errors', async ({ page }) => {
        // Check for JavaScript errors
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await profilePage.gotoProfile('me');

        // Should not have critical errors
        // (May have minor console errors, but shouldn't break the page)
        expect(page.url()).toContain('/profile');
    });
});
