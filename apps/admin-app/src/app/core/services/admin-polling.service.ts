import { Injectable, inject, signal, DestroyRef, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, switchMap, catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AdminApiService } from './admin-api.service';

@Injectable({ providedIn: 'root' })
export class AdminPollingService implements OnDestroy {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Number of open tickets — updated every 30s */
  readonly openTickets = signal(0);

  private lastKnownCount = -1;
  private toastService: MessageService | null = null;

  /** Call once from shell component to start polling */
  start(toast?: MessageService): void {
    this.toastService = toast ?? null;

    // Initial fetch
    this.fetchCount();

    // Poll every 30s
    interval(30_000).pipe(
      switchMap(() => this.api.tickets({ status: 'OPEN', limit: 1 })),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(res => {
      if (!res) return;
      const count = res.total ?? 0;
      if (this.lastKnownCount >= 0 && count > this.lastKnownCount && this.toastService) {
        this.toastService.add({
          severity: 'info',
          summary: 'New ticket',
          detail: `${count - this.lastKnownCount} new support ticket(s) received.`,
          life: 5000,
        });
      }
      this.lastKnownCount = count;
      this.openTickets.set(count);
    });
  }

  private fetchCount(): void {
    this.api.tickets({ status: 'OPEN', limit: 1 }).pipe(
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(res => {
      if (!res) return;
      const count = res.total ?? 0;
      this.lastKnownCount = count;
      this.openTickets.set(count);
    });
  }

  ngOnDestroy(): void {
    // cleanup handled by takeUntilDestroyed
  }
}
