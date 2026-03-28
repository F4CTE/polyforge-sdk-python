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
    readonly qrCode: Locator;
    readonly totpCodeInput: Locator;
    readonly enable2faButton: Locator;
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
        this.displayNameInput = page.locator('input[placeholder*="Display Name"]');
        this.bioInput = page.locator('textarea[placeholder*="Bio"]');
        this.avatarUrlInput = page.locator('input[placeholder*="Avatar"]');
        this.saveProfileButton = page.locator('button', { hasText: 'Save Profile' });

        // Notifications
        this.notificationCheckboxes = {
            orderFilled: page.locator('input[type="checkbox"][id*="orderFilled"]'),
            strategyError: page.locator('input[type="checkbox"][id*="strategyError"]'),
            backtestComplete: page.locator('input[type="checkbox"][id*="backtestComplete"]'),
            priceAlert: page.locator('input[type="checkbox"][id*="priceAlert"]'),
            dailyLossLimit: page.locator('input[type="checkbox"][id*="dailyLossLimit"]'),
            marketResolved: page.locator('input[type="checkbox"][id*="marketResolved"]'),
            newFollower: page.locator('input[type="checkbox"][id*="newFollower"]'),
        };
        this.saveNotificationsButton = page.locator('button', { hasText: 'Save Notifications' });

        // Password
        this.currentPasswordInput = page.locator('input[placeholder*="Current Password"]');
        this.newPasswordInput = page.locator('input[placeholder*="New Password"]').first();
        this.confirmPasswordInput = page.locator('input[placeholder*="Confirm Password"]');
        this.changePasswordButton = page.locator('button', { hasText: 'Change Password' });

        // 2FA
        this.qrCode = page.locator('[data-testid="2fa-qrcode"]');
        this.totpCodeInput = page.locator('input[placeholder*="6-digit"]');
        this.enable2faButton = page.locator('button', { hasText: 'Enable 2FA' });
        this.disable2faButton = page.locator('button', { hasText: 'Disable 2FA' });
        this.backupCodes = page.locator('[data-testid="backup-codes"]');

        // API Keys
        this.keyNameInput = page.locator('input[placeholder*="Key Name"]');
        this.scopeCheckboxes = {
            READ: page.locator('input[type="checkbox"][value="READ"]'),
            WRITE: page.locator('input[type="checkbox"][value="WRITE"]'),
            TRADE: page.locator('input[type="checkbox"][value="TRADE"]'),
        };
        this.expirationInput = page.locator('input[placeholder*="Expiration"]');
        this.createKeyButton = page.locator('button', { hasText: 'Create API Key' });
        this.keysTable = page.locator('[data-testid="api-keys-table"]');
        this.createdKeyDisplay = page.locator('[data-testid="created-key"]');

        // Gas
        this.usageBar = page.locator('[data-testid="gas-usage-bar"]');
        this.dailyLimit = page.locator('[data-testid="gas-daily-limit"]');
        this.remaining = page.locator('[data-testid="gas-remaining"]');

        // Delete account
        this.deleteAccountButton = page.locator('button', { hasText: 'Delete Account' });
        this.deleteConfirmDialog = page.locator('[role="dialog"]', { hasText: 'Delete Account' });
        this.deletePasswordInput = page.locator('[role="dialog"] input[type="password"]');
        this.deleteConfirmButton = page.locator('[role="dialog"] button', { hasText: 'Delete' });
    }

    async goto(): Promise<void> {
        await this.page.goto('/settings');
        await expect(this.page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 15_000 });
    }

    async goToProfileTab(): Promise<void> {
        await this.profileTab.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToNotificationsTab(): Promise<void> {
        await this.notificationsTab.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToPasswordTab(): Promise<void> {
        await this.passwordTab.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goTo2FATab(): Promise<void> {
        await this.twoFactorTab.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToAPIKeysTab(): Promise<void> {
        await this.apiKeysTab.click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToGasTab(): Promise<void> {
        await this.gasTab.click();
        await this.page.waitForLoadState('networkidle');
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
        await this.page.waitForLoadState('networkidle');
    }

    async toggleNotification(name: keyof typeof this.notificationCheckboxes): Promise<void> {
        await this.notificationCheckboxes[name].click();
    }

    async saveNotifications(): Promise<void> {
        await this.saveNotificationsButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await this.currentPasswordInput.fill(currentPassword);
        await this.newPasswordInput.fill(newPassword);
        await this.confirmPasswordInput.fill(newPassword);
        await this.changePasswordButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async setup2FA(totpCode: string): Promise<void> {
        await expect(this.qrCode).toBeVisible();
        await this.totpCodeInput.fill(totpCode);
        await this.enable2faButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async disable2FA(): Promise<void> {
        await this.disable2faButton.click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();
        await this.page.locator('[role="dialog"] button', { hasText: 'Confirm' }).click();
        await this.page.waitForLoadState('networkidle');
    }

    async getBackupCodes(): Promise<string> {
        return (await this.backupCodes.textContent()) ?? '';
    }

    async createApiKey(params: {
        name: string;
        scopes: Array<'READ' | 'WRITE' | 'TRADE'>;
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
        await this.page.waitForLoadState('networkidle');
    }

    async getCreatedApiKey(): Promise<string> {
        return (await this.createdKeyDisplay.textContent()) ?? '';
    }

    getRevokeButton(keyId: string): Locator {
        return this.page.locator(`[data-testid="revoke-key-${keyId}"]`);
    }

    async revokeApiKey(id: string): Promise<void> {
        await this.getRevokeButton(id).click();
        await expect(this.page.locator('[role="dialog"]')).toBeVisible();
        await this.page.locator('[role="dialog"] button', { hasText: 'Confirm' }).click();
        await this.page.waitForLoadState('networkidle');
    }

    async deleteAccount(password: string): Promise<void> {
        await this.deleteAccountButton.click();
        await expect(this.deleteConfirmDialog).toBeVisible();
        await this.deletePasswordInput.fill(password);
        await this.deleteConfirmButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async getGasUsage(): Promise<{ daily: string; remaining: string }> {
        return {
            daily: (await this.dailyLimit.textContent()) ?? '',
            remaining: (await this.remaining.textContent()) ?? '',
        };
    }
}
