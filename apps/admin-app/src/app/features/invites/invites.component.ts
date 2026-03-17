import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AdminApiService } from '../../core/services/admin-api.service';

interface InviteRow {
  code: string;
  remainingUses: number;
  ttl: number; // -1 = no expiry
}

interface WaitlistRow {
  email: string;
  joinedAt: string;
}

@Component({
  selector: 'app-invites',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    ButtonModule, InputTextModule, InputNumberModule, TooltipModule,
    ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './invites.component.html',
})
export class InvitesComponent implements OnInit {
  private readonly api          = inject(AdminApiService);
  private readonly toast        = inject(MessageService);
  private readonly confirm      = inject(ConfirmationService);
  private readonly destroyRef   = inject(DestroyRef);

  activeTab   = signal<'invites' | 'waitlist'>('invites');

  invites     = signal<InviteRow[]>([]);
  loading     = signal(true);
  generating  = signal(false);
  copiedCode  = signal('');

  waitlist        = signal<WaitlistRow[]>([]);
  waitlistLoading = signal(false);

  // Generate form state
  genCount   = 10;
  genUses    = 1;
  genTtlDays: number | null = 7;

  // Generated batch (shown until next load)
  lastBatch = signal<string[]>([]);

  ngOnInit(): void { this.load(); this.loadWaitlist(); }

  setTab(tab: 'invites' | 'waitlist'): void { this.activeTab.set(tab); }

  loadWaitlist(): void {
    this.waitlistLoading.set(true);
    this.api.listWaitlist()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => { this.waitlist.set(res.data); this.waitlistLoading.set(false); },
        error: () => this.waitlistLoading.set(false),
      });
  }

  removeWaitlist(email: string): void {
    this.confirm.confirm({
      message: `Remove <strong>${email}</strong> from the waitlist?`,
      header: 'Remove from waitlist',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.removeFromWaitlist(email)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.add({ severity: 'success', summary: 'Removed', detail: `${email} removed` });
              this.loadWaitlist();
            },
            error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove' }),
          });
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.listInvites()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => { this.invites.set(rows); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.lastBatch.set([]);
    this.api.generateInvites(this.genCount, this.genUses, this.genTtlDays ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.lastBatch.set(res.codes);
          this.toast.add({ severity: 'success', summary: 'Generated', detail: `${res.codes.length} invite codes created` });
          this.generating.set(false);
          this.load();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate codes' });
          this.generating.set(false);
        },
      });
  }

  copy(code: string): void {
    navigator.clipboard.writeText(code).then(() => this.onCopy(code));
  }

  copyAll(): void {
    const text = this.lastBatch().join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.toast.add({ severity: 'success', summary: 'Copied', detail: 'All codes copied to clipboard' });
    });
  }

  revoke(code: string): void {
    this.confirm.confirm({
      message: `Revoke invite code <strong>${code}</strong>? It will no longer be usable.`,
      header: 'Revoke invite',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.revokeInvite(code)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.add({ severity: 'success', summary: 'Revoked', detail: `${code} revoked` });
              this.load();
            },
            error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to revoke code' }),
          });
      },
    });
  }

  ttlLabel(ttl: number): string {
    if (ttl === -1) return '∞ No expiry';
    const h = Math.round(ttl / 3600);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  }

  onCopy(code: string): void {
    this.copiedCode.set(code);
    setTimeout(() => this.copiedCode.set(''), 1500);
  }
}
