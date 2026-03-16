import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { SocialApiService, NotificationPrefs } from '../../core/services/social-api.service';
import { AuthApiService } from '../../core/services/auth-api.service';
import { AuthStore } from '../../core/store/auth.store';

type Tab = 'profile' | 'security' | 'notifications';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, TextareaModule, ToggleSwitchModule, PasswordModule, ToastModule],
  providers: [MessageService],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private readonly social     = inject(SocialApiService);
  private readonly authApi    = inject(AuthApiService);
  readonly auth               = inject(AuthStore);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<Tab>('profile');

  // ─── Profile form ─────────────────────────────────────────────────────────

  displayName   = '';
  bio           = '';
  avatarUrl     = '';
  twitterHandle = '';
  profileSaving = signal(false);

  // ─── Security form ────────────────────────────────────────────────────────

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  pwSaving        = signal(false);

  totpSetupData = signal<{ secret: string; qrCodeUri: string; backupCodes: string[] } | null>(null);
  totpCode      = '';
  totpSaving    = signal(false);

  // ─── Notifications form ───────────────────────────────────────────────────

  notifPrefs: Required<NotificationPrefs> = {
    orderFilled:      true,
    strategyError:    true,
    backtestComplete: true,
    priceAlert:       false,
    dailyLossLimit:   true,
    marketResolved:   false,
    follow:           true,
  };
  notifSaving = signal(false);

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) {
      this.displayName   = u.displayName ?? '';
      this.bio           = u.bio ?? '';
      this.avatarUrl     = u.avatarUrl ?? '';
    }
  }

  setTab(t: Tab): void { this.activeTab.set(t); }

  // ─── Profile save ─────────────────────────────────────────────────────────

  saveProfile(): void {
    if (this.profileSaving()) return;
    this.profileSaving.set(true);
    this.social.updateProfile({
      displayName:   this.displayName || undefined,
      bio:           this.bio || undefined,
      avatarUrl:     this.avatarUrl || undefined,
      twitterHandle: this.twitterHandle || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.auth.patchUser({ displayName: this.displayName, bio: this.bio, avatarUrl: this.avatarUrl });
          this.toast.add({ severity: 'success', summary: 'Saved', detail: 'Profile updated.' });
          this.profileSaving.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update profile.' });
          this.profileSaving.set(false);
        },
      });
  }

  // ─── Password change ──────────────────────────────────────────────────────

  savePassword(): void {
    if (this.pwSaving()) return;
    if (this.newPassword !== this.confirmPassword) {
      this.toast.add({ severity: 'warn', summary: 'Mismatch', detail: 'Passwords do not match.' });
      return;
    }
    this.pwSaving.set(true);
    this.social.updatePassword(this.currentPassword, this.newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Done', detail: 'Password changed.' });
          this.currentPassword = '';
          this.newPassword     = '';
          this.confirmPassword = '';
          this.pwSaving.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Incorrect current password.' });
          this.pwSaving.set(false);
        },
      });
  }

  // ─── TOTP ─────────────────────────────────────────────────────────────────

  get totpEnabled(): boolean { return this.auth.user()?.totpEnabled === true; }

  startTotpSetup(): void {
    this.authApi.totpSetup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: data => this.totpSetupData.set(data) });
  }

  confirmTotp(): void {
    if (this.totpSaving() || !this.totpCode) return;
    this.totpSaving.set(true);
    this.authApi.totpConfirm(this.totpCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.auth.patchUser({ totpEnabled: true });
          this.totpSetupData.set(null);
          this.totpCode = '';
          this.toast.add({ severity: 'success', summary: '2FA enabled', detail: 'Two-factor authentication is now active.' });
          this.totpSaving.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Invalid TOTP code.' });
          this.totpSaving.set(false);
        },
      });
  }

  disableTotp(): void {
    if (this.totpSaving() || !this.totpCode) return;
    this.totpSaving.set(true);
    this.authApi.totpDisable(this.totpCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.auth.patchUser({ totpEnabled: false });
          this.totpCode = '';
          this.toast.add({ severity: 'success', summary: '2FA disabled', detail: 'Two-factor authentication removed.' });
          this.totpSaving.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Invalid TOTP code.' });
          this.totpSaving.set(false);
        },
      });
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  saveNotifications(): void {
    if (this.notifSaving()) return;
    this.notifSaving.set(true);
    this.social.updateNotifications(this.notifPrefs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Saved', detail: 'Notification preferences updated.' });
          this.notifSaving.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to save preferences.' });
          this.notifSaving.set(false);
        },
      });
  }
}
