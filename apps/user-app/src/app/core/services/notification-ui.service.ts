import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from './websocket.service';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationUiService {
  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<NotificationItem[]>([]);
  readonly unreadCount = computed(() => this.items().filter(n => !n.read).length);

  constructor() {
    this.ws.notifications$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(n => {
      this.items.update(list => [{ ...n, read: false }, ...list].slice(0, 50));
    });
  }

  markAllRead(): void {
    this.items.update(list => list.map(n => ({ ...n, read: true })));
  }

  markRead(id: string): void {
    this.items.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
  }
}
