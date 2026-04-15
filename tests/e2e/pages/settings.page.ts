import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Settings page (/settings).
 *
 * Handles all 6 settings tabs:
 * - Profile: display name, bio, avatar URL
 * - Notifications: checkboxes for various notification types
 * - Password: current and new password change
 * - 2FA: TOTP setup with QR code and backup codes
 * - API Keys: creation, listing, and revocation
 * - Gas: usage tracking and daily limits
 * - Account Deletion
 */
export class SettingsPage {
    readonly page: Page;

    // Tab selectors
    readonly profileTab: Locator;
    readonly notificationsTab: Locator;
    readonly passwordTab: Locator;
    readonly twoFactorTab: Locator;
    readonly apiKeysTab: Locator;
    readonly gasTab: Locator;

    // Profile tab
    readonly displayNameInput: Locator;
    readonly bioInput: Locator;
    readonly avatarUrlInput: Locator;
    readonly saveProfileButton: Locator;

    // Notifications tab
    readonly notificationCheckboxes: Record<string, Locator>;
    readonly saveNotificationsButton: Locator;

    // Password tab
    readonly currentPasswordInput: Locator;
    readonly newPasswordInput: Locator;
    readonly confirmPasswordInput: Locator;
    readonly changePasswordButton: Locator;

    // 2FA tab
    readonly startSetup2FAButton: Locator; // "Enable Two-Factor Authentication" — transitions to setup view
    readonly qrCode: Locator;
    readonly totpCodeInput: Locator;
    readonly enable2faButton: Locator;     // "Enable 2FA" — confirms TOTP code in setup view
    readonly disable2faButton: Locator;
    readonly backupCodes: Locator;

    // API Keys tab
    readonly keyNameInput: Locator;
    readonly scopeCheckboxes: Record<string, Locator>;
    readonly expirationInput: Locator;
    readonly createKeyButton: Locator;
    readonly keysTable: Locator;
    readonly createdKeyDisplay: Locator;

    // Gas tab
    readonly usageBar: Locator;
    readonly dailyLimit: Locator;
    readonly remaining: Locator;

    // Delete account
    readonly deleteAccountButton: Locator;
    readonly deleteConfirmDialog: Locator;
    readonly deletePasswordInput: Locator;
    readonly deleteConfirmButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Tab selectors
        this.profileTab = page.locator('[role="tab"]', { hasText: 'Profile' });
        this.notificationsTab = page.locator('[role="tab"]', { hasText: 'Notifications' });
        this.passwordTab = page.locator('[role="tab"]', { hasText: 'Password' });
        this.twoFactorTab = page.locator('[role="tab"]', { hasText: '2FA' });
        this.apiKeysTab = page.locator('[role="tab"]', { hasText: 'API Keys' });
        this.gasTab = page.locator('[role="tab"]', { hasText: 'Gas' });

        // Profile
        // Use stable id attributes (the actual placeholders are "Your display name",
        // "Tell others about yourself...", and "https://..." — not matching the
        // old case-sensitive placeholder*="..." selectors).
        this.displayNameInput = page.locator('input#settings-display-name');
        this.bioInput = page.locator('textarea#settings-bio');
        this.avatarUrlInput = page.locator('input#settings-avatar-url');
        this.saveProfileButton = page.locator('button', { hasText: 'Save Profile' });

        // Notifications — the UI uses <Button role="switch"> toggles (not checkboxes).
        // Each event has 3 toggles (inApp, email, push); .first() selects the inApp one.
        // aria-label pattern: "${eventLabel} ${field} notification"
        this.notificationCheckboxes = {
            orderFilled:     page.locator('[role="switch"][aria-label*="Order Filled"]').first(),
            strategyError:   page.locator('[role="switch"][aria-label*="Strategy Error"]').first(),
            backtestComplete: page.locator('[role="switch"][aria-label*="Backtest Complete"]').first(),
            priceAlert:      page.locator('[role="switch"][aria-label*="Price Alert"]').first(),
            dailyLossLimit:  page.locator('[role="switch"][aria-label*="Daily Loss Limit"]').first(),
            marketResolved:  page.locator('[role="switch"][aria-label*="Market Resolved"]').first(),
            newFollower:     page.locator('[role="switch"][aria-label*="New Follower"]').first(),
        };
        // Button text is "Save Preferences" (not "Save Notifications")
        this.saveNotificationsButton = page.locator('button', { hasText: 'Save Preferences' });

        // Password — inputs have no placeholder; use stable IDs.
        this.currentPasswordInput = page.locator('input#settings-current-password');
        this.newPasswordInput = page.locator('input#settings-new-password');
        this.confirmPasswordInput = page.locator('input#settings-confirm-password');
        this.changePasswordButton = page.locator('button', { hasText: 'Change Password' });

        // 2FA
        // "Enable Two-Factor Authentication" starts the setup flow (disabled view).
        this.startSetup2FAButton = page.locator('button', { hasText: 'Enable Two-Factor Authentication' });
        // QR code <img> is rendered in the setup view — no data-testid, use alt.
        this.qrCode = page.locator('img[alt="TOTP QR Code"]');
        // The verify TOTP input: id="2fa-verify-token", placeholder="000000"
        this.totpCodeInput = page.locator('input#2fa-verify-token');
        // "Enable 2FA" confirms the 6-digit TOTP code (setup view only).
        this.enable2faButton = page.locator('button', { hasText: 'Enable 2FA' });
        this.disable2faButton = page.locator('button', { hasText: 'Disable 2FA' });
        this.backupCodes = page.locator('[data-testid="backup-codes"]');

        // API Keys
        // id="settings-key-name", placeholder="My Integration"
        this.keyNameInput = page.locator('input#settings-key-name');
        // Scopes: READ, TRADE, STRATEGY, WEBHOOK — no WRITE scope.
        // Checkboxes are implicit-label inputs (input inside <label>); use getByRole
        // with accessible-name matching (Playwright derives the name from the wrapping label).
        this.scopeCheckboxes = {
            READ:     page.getByRole('checkbox', { name: /\bRead\b/ }),
            TRADE:    page.getByRole('checkbox', { name: /\bTrade\b/ }),
            STRATEGY: page.getByRole('checkbox', { name: /\bStrategy\b/ }),
            WEBHOOK:  page.getByRole('checkbox', { name: /\bWebhook\b/ }),
        };
        // id="settings-key-expiration", type="date" (no placeholder)
        this.expirationInput = page.locator('input#settings-key-expiration');
        // Button text is "Generate API Key" (not "Create API Key")
        this.createKeyButton = page.locator('button', { hasText: 'Generate API Key' });
        // Table has no data-testid; identified by aria-label
        this.keysTable = page.locator('table[aria-label="API keys"]');
        // One-time secret display: <code class="...text-warning..."> in the warning banner
        // (token renamed from text-pf-warning → text-warning in the Linear design system migration)
        this.createdKeyDisplay = page.locator('code.text-warning, code.text-pf-warning');

        // Gas — panel container is always present when the tab is active.
        // Individual stat cards (Today's Usage / Daily Limit / Remaining) only render
        // when the GET /api/v1/settings/gas call succeeds (gasUsage != null).
        // When the call fails the panel shows "Unable to load gas usage data." instead.
        this.usageBar  = page.locator('[data-testid="gas-panel"]');
        this.dailyLimit = page.locator('[data-testid="gas-panel"] span', { hasText: "Daily Limit" }).first();
        this.remaining  = page.locator('[data-testid="gas-panel"] span', { hasText: "Remaining"   }).first();

        // Delete account
        this.deleteAccountButton = page.locator('button', { hasText: 'Delete Account' });
        this.deleteConfirmDialog = page.locator('[role="dialog"]', { hasText: 'Delete Account' });
        this.deletePasswordInput = page.locator('[role="dialog"] input[type="password"]');
        this.deleteConfirmButton = page.locator('[role="dialog"] button', { hasText: 'Delete' });
    }

    async goto(): Promise<void> {
        // Prevent the onboarding modal from intercepting clicks.
        await this.page.addInitScript(() => {
            localStorage.setItem('pf-onboarding-complete', 'true'); localStorage.setItem('polyforge:onboarding:dismissed', 'true');
        });
        await this.page.goto('/settings');
        await expect(this.page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 15_000 });
    }

    async goToProfileTab(): Promise<void> {
        await this.profileTab.click();
    }

    async goToNotificationsTab(): Promise<void> {
        await this.notificationsTab.click();
        // Wait for the notification preferences to load.
        // The panel shows a skeleton loader while notifLoading=true; the actual
        // [role="switch"] toggle buttons only appear after the API fetch completes.
        // 15s covers Docker cold-start overhead.
        await this.page.locator('[role="switch"]').first().waitFor({ state: 'visible', timeout: 15_000 });
    }

    async goToPasswordTab(): Promise<void> {
        await this.passwordTab.click();
    }

    async goTo2FATab(): Promise<void> {
        await this.twoFactorTab.click();
    }

    async goToAPIKeysTab(): Promise<void> {
        await this.apiKeysTab.click();
    }

    async goToGasTab(): Promise<void> {
        await this.gasTab.click();
    }

    async updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<void> {
        if (data.displayName) {
            await this.displayNameInput.fill(data.displayName);
        }
        if (data.bio) {
            await this.bioInput.fill(data.bio);
        }
        if (data.avatarUrl) {
            await this.avatarUrlInput.fill(data.avatarUrl);
        }
        await this.saveProfileButton.click();
    }

    async toggleNotification(name: keyof typeof this.notificationCheckboxes): Promise<void> {
        await this.notificationCheckboxes[name].click();
    }

    async saveNotifications(): Promise<void> {
        await this.saveNotificationsButton.click();
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await this.currentPasswordInput.fill(currentPassword);
        await this.newPasswordInput.fill(newPassword);
        await this.confirmPasswordInput.fill(newPassword);
        // Wait for React to process all fills and enable the button
        await expect(this.changePasswordButton).toBeEnabled({ timeout: 5_000 });
        await this.changePasswordButton.click();
    }

    /** Enter 2FA setup flow from the disabled view, then submit the TOTP code. */
    async setup2FA(totpCode: string): Promise<void> {
        // If still in disabled view, click through to setup view first.
        if (await this.startSetup2FAButton.isVisible()) {
            await this.startSetup2FAButton.click();
        }
        await expect(this.qrCode).toBeVisible({ timeout: 10_000 });
        await this.totpCodeInput.fill(totpCode);
        await this.enable2faButton.click();
    }

    async disable2FA(): Promise<void> {
        await this.disable2faButton.click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();
        await this.page.locator('[role="dialog"] button', { hasText: 'Confirm' }).click();
    }

    async getBackupCodes(): Promise<string> {
        return (await this.backupCodes.textContent({ timeout: 2_000 }).catch(() => '')) ?? '';
    }

    async createApiKey(params: {
        name: string;
        scopes: Array<'READ' | 'TRADE' | 'STRATEGY' | 'WEBHOOK'>;
        expirationDays?: string;
    }): Promise<void> {
        await this.keyNameInput.fill(params.name);

        for (const scope of params.scopes) {
            await this.scopeCheckboxes[scope].check();
        }

        if (params.expirationDays) {
            await this.expirationInput.fill(params.expirationDays);
        }

        await this.createKeyButton.click();
    }

    async getCreatedApiKey(): Promise<string> {
        return (await this.createdKeyDisplay.textContent()) ?? '';
    }

    /** Returns the revoke button for a key identified by its NAME (used in aria-label). */
    getRevokeButton(keyName: string): Locator {
        return this.page.locator(`button[aria-label="Revoke API key ${keyName}"]`);
    }

    /** Revoke an API key by name. Accepts the native window.confirm() dialog. */
    async revokeApiKey(keyName: string): Promise<void> {
        // revokeApiKey() in the component uses window.confirm() — handle with Playwright dialog event
        this.page.once('dialog', async dialog => { await dialog.accept(); });
        await this.getRevokeButton(keyName).click();
        await expect(this.getRevokeButton(keyName)).toBeHidden({ timeout: 5_000 }).catch(() => {});
    }

    async deleteAccount(password: string): Promise<void> {
        await this.deleteAccountButton.click();
        await expect(this.deleteConfirmDialog).toBeVisible();
        await this.deletePasswordInput.fill(password);
        await this.deleteConfirmButton.click();
    }

    async getGasUsage(): Promise<{ daily: string; remaining: string }> {
        return {
            daily:     (await this.dailyLimit.textContent({ timeout: 3_000 }).catch(() => '')) ?? '',
            remaining: (await this.remaining .textContent({ timeout: 3_000 }).catch(() => '')) ?? '',
        };
    }
}
