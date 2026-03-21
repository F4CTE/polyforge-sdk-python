import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MarketToken {
  tokenId: string;
  outcome: string;
  price: string;
  liquidity: string;
}

export interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  seriesSlug: string;
  tokens: MarketToken[];
  volume24h: string;
  endDate: string;
  closed: boolean;
}

export interface MarketsResponse {
  data: Market[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface PriceCandle {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface PriceHistory {
  tokenId: string;
  resolution: string;
  hasGaps: boolean;
  data: PriceCandle[];
}

export interface OrderBook {
  tokenId: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
  spread: string;
  midpoint: string;
  timestamp: number;
}

export interface MarketsQuery {
  page?: number;
  limit?: number;
  series?: string;
  search?: string;
  sort?: 'volume' | 'liquidity' | 'closing_soon' | 'newest';
}

@Injectable({ providedIn: 'root' })
export class MarketsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/markets';

  list(query: MarketsQuery = {}): Observable<MarketsResponse> {
    let params = new HttpParams();
    if (query.page)   params = params.set('page', query.page);
    if (query.limit)  params = params.set('limit', query.limit);
    if (query.series) params = params.set('series', query.series);
    if (query.search) params = params.set('search', query.search);
    if (query.sort)   params = params.set('sort', query.sort);
    return this.http.get<MarketsResponse>(this.base, { params });
  }

  get(marketId: string): Observable<Market> {
    return this.http.get<Market>(`${this.base}/${marketId}`);
  }

  priceHistory(
    tokenId: string,
    resolution: '1m' | '1h' | '1d' = '1h',
    from?: string,
    to?: string,
    limit = 200,
  ): Observable<PriceHistory> {
    let params = new HttpParams()
      .set('resolution', resolution)
      .set('limit', limit);
    if (from) params = params.set('from', from);
    if (to)   params = params.set('to', to);
    return this.http.get<PriceHistory>(`${this.base}/${tokenId}/price-history`, { params });
  }

  orderBook(tokenId: string): Observable<OrderBook> {
    return this.http.get<OrderBook>(`${this.base}/${tokenId}/book`);
  }
}
