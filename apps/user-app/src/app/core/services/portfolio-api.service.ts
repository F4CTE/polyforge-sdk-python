import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ─── Portfolio ──────────────────────────────────────────────────────────────

export interface Position {
  id:               string;
  marketId:         string;
  tokenId:          string;
  marketTitle:      string;
  side:             'YES' | 'NO';
  size:             string;
  avgEntryPrice:    string;
  currentPrice:     string;
  unrealizedPnl:    string;
  resolutionStatus: 'UNRESOLVED' | 'RESOLVED' | 'CANCELLED';
}

export interface PortfolioResponse {
  positions:          Position[];
  totalUnrealizedPnl: string;
  totalRealizedPnl:   string;
}

export interface PnlSnapshot { time: string; pnl: string; }

export interface PnlResponse {
  snapshots: PnlSnapshot[];
  totalPnl:  string;
  winRate:   string;
}

export interface PaperPosition {
  tokenId:       string;
  side:          'YES' | 'NO';
  size:          string;
  unrealizedPnl: string;
}

export interface PaperSummary {
  pnl:        string;
  positions:  PaperPosition[];
  orderCount: number;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export interface Order {
  id:           string;
  intentId:     string;
  strategyId:   string | null;
  marketId:     string;
  tokenId:      string;
  side:         'BUY' | 'SELL';
  outcome:      'YES' | 'NO';
  size:         string;
  price:        string;
  orderType:    string;
  status:       OrderStatus;
  clobOrderId:  string | null;
  filledSize:   string;
  avgFillPrice: string | null;
  makerFee:     string;
  takerFee:     string;
  submittedAt:  string | null;
  filledAt:     string | null;
  createdAt:    string;
}

export interface OrdersResponse {
  data:       Order[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
}

export interface ClosePositionRequest  { tokenId: string; size?: string; }
export interface ClosePositionResponse { orderId: string; intentId: string; status: string; }

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly http = inject(HttpClient);

  // Portfolio
  portfolio(): Observable<PortfolioResponse> {
    return this.http.get<PortfolioResponse>('/api/v1/portfolio');
  }

  pnl(period: '7d' | '30d' | '90d' | 'allTime' = '7d', strategyId?: string): Observable<PnlResponse> {
    let params = new HttpParams().set('period', period);
    if (strategyId) params = params.set('strategyId', strategyId);
    return this.http.get<PnlResponse>('/api/v1/portfolio/pnl', { params });
  }

  // Paper
  paperSummary(): Observable<PaperSummary> {
    return this.http.get<PaperSummary>('/api/v1/paper/summary');
  }

  paperReset(): Observable<{ reset: boolean }> {
    return this.http.post<{ reset: boolean }>('/api/v1/paper/reset', {});
  }

  // Orders
  orders(query: { page?: number; limit?: number; status?: string; strategyId?: string } = {}): Observable<OrdersResponse> {
    let params = new HttpParams();
    if (query.page)       params = params.set('page', query.page);
    if (query.limit)      params = params.set('limit', query.limit);
    if (query.status)     params = params.set('status', query.status);
    if (query.strategyId) params = params.set('strategyId', query.strategyId);
    return this.http.get<OrdersResponse>('/api/v1/orders', { params });
  }

  closePosition(req: ClosePositionRequest): Observable<ClosePositionResponse> {
    return this.http.post<ClosePositionResponse>('/api/v1/orders/close-position', req);
  }
}
