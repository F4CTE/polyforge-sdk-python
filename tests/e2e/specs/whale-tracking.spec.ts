import { test, expect } from '@playwright/test';
import { LoginPage }    from '../pages/login.page';

const ALICE_EMAIL    = 'alice@dev.local';
const ALICE_PASSWORD = 'TestPass123!';

test.describe('Whale Tracking', () => {

    test('@smoke whale tracking page loads without errors', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginAndRedirect(ALICE_EMAIL, ALICE_PASSWORD);
        await page.goto('/whales');

        // Verify the page renders without a fatal error
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    });

});
