import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { TokenService } from './token.service';

export interface PriceUpdate {
  type: 'PRICE_UPDATE';
  tokenId: string;
  price: string;
  timestamp: number;
}

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly tokenSvc = inject(TokenService);

  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private readonly subscribedTokens = new Set<string>();

  private readonly messages$ = new Subject<WsMessage>();

  readonly priceUpdates$: Observable<PriceUpdate> = this.messages$.pipe(
    filter(m => m['type'] === 'PRICE_UPDATE'),
    map(m => m as unknown as PriceUpdate),
  );

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      const token = this.tokenSvc.get();
      if (token) this.send({ type: 'AUTH', token: `Bearer ${token}` });
      this.startPing();
      if (this.subscribedTokens.size > 0) {
        this.send({ type: 'SUBSCRIBE_PRICES', tokenIds: [...this.subscribedTokens] });
      }
    };

    this.ws.onmessage = ({ data }) => {
      try { this.messages$.next(JSON.parse(data)); } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.destroyed) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  subscribePrices(tokenIds: string[]): void {
    tokenIds.forEach(id => this.subscribedTokens.add(id));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'SUBSCRIBE_PRICES', tokenIds });
    }
  }

  unsubscribePrices(tokenIds: string[]): void {
    tokenIds.forEach(id => this.subscribedTokens.delete(id));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'UNSUBSCRIBE_PRICES', tokenIds });
    }
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => this.send({ type: 'PING' }), 30_000);
  }

  private stopPing(): void {
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPing();
    this.ws?.close();
  }
}
