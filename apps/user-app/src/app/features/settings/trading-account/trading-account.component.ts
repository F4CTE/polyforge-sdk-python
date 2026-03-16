import { Component, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-trading-account',
  standalone: true,
  imports: [RouterLink, FormsModule, ButtonModule, InputTextModule, PasswordModule, ToastModule],
  providers: [MessageService],
  templateUrl: './trading-account.component.html',
})
export class TradingAccountComponent {
  private readonly authApi    = inject(AuthApiService);
  readonly auth               = inject(AuthStore);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ─── Credentials form ─────────────────────────────────────────────────────
  privateKey     = '';
  apiKey         = '';
  apiSecret      = '';
  apiPassphrase  = '';
  safeAddress    = '';
  importing      = signal(false);
  deleting       = signal(false);

  // ─── Bot link code ────────────────────────────────────────────────────────
  botCode        = signal<string | null>(null);
  botCodeExpiry  = signal<string | null>(null);
  botCodeLoading = signal(false);

  get isConnected(): boolean { return this.auth.user()?.polymarketConnected === true; }

  importCredentials(): void {
    if (this.importing()) return;
    this.importing.set(true);
    this.authApi.importCredentials({
      privateKey:    this.privateKey,
      apiKey:        this.apiKey,
      apiSecret:     this.apiSecret,
      apiPassphrase: this.apiPassphrase,
      safeAddress:   this.safeAddress || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.auth.patchUser({ polymarketConnected: res.connected });
          this.toast.add({ severity: 'success', summary: 'Connected', detail: 'Polymarket credentials imported.' });
          this.privateKey    = '';
          this.apiKey        = '';
          this.apiSecret     = '';
          this.apiPassphrase = '';
          this.safeAddress   = '';
          this.importing.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to import credentials.' });
          this.importing.set(false);
        },
      });
  }

  deleteCredentials(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.authApi.deleteCredentials()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.auth.patchUser({ polymarketConnected: false });
          this.toast.add({ severity: 'info', summary: 'Disconnected', detail: 'Credentials removed.' });
          this.deleting.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove credentials.' });
          this.deleting.set(false);
        },
      });
  }

  generateBotCode(): void {
    if (this.botCodeLoading()) return;
    this.botCodeLoading.set(true);
    this.authApi.generateBotCode()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.botCode.set(res.code);
          this.botCodeExpiry.set(res.expiresAt);
          this.botCodeLoading.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate code.' });
          this.botCodeLoading.set(false);
        },
      });
  }

  copyBotCode(): void {
    const code = this.botCode();
    if (code) navigator.clipboard.writeText(code).then(() =>
      this.toast.add({ severity: 'success', summary: 'Copied', detail: 'Code copied to clipboard.' }),
    );
  }
}
