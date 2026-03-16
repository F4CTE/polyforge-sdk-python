import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BacktestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BacktestRun {
  id:              string;
  strategyId:      string | null;
  strategyName:    string | null;
  status:          BacktestStatus;
  dateRangeStart:  string;
  dateRangeEnd:    string;
  quickMode:       boolean;
  progress:        number;
  totalOrders:     number | null;
  filledOrders:    number | null;
  totalPnl:        string | null;
  winRate:         string | null;
  hasDataGaps:     boolean;
  error:           string | null;
  createdAt:       string;
  completedAt:     string | null;
}

export interface BacktestListResponse {
  data:       BacktestRun[];
  total:      number;
  page:       number;
  totalPages: number;
}

export interface RunBacktestDto {
  strategyId:     string | null;
  dateRangeStart: string;
  dateRangeEnd:   string;
  quickMode?:     boolean;
}

export interface QuickModeResult {
  totalOrders:  number;
  filledOrders: number;
  totalPnl:     string;
  winRate:      string;
  hasDataGaps:  boolean;
}

@Injectable({ providedIn: 'root' })
export class BacktestApiService {
  private readonly http = inject(HttpClient);

  list(query: { page?: number; limit?: number; strategyId?: string; status?: BacktestStatus } = {}): Observable<BacktestListResponse> {
    let params = new HttpParams();
    if (query.page)       params = params.set('page',       query.page);
    if (query.limit)      params = params.set('limit',      query.limit);
    if (query.strategyId) params = params.set('strategyId', query.strategyId);
    if (query.status)     params = params.set('status',     query.status);
    return this.http.get<BacktestListResponse>('/api/v1/backtests', { params });
  }

  run(dto: RunBacktestDto): Observable<{ runId: string; status: BacktestStatus }> {
    return this.http.post<{ runId: string; status: BacktestStatus }>('/api/v1/backtests', dto);
  }

  get(id: string): Observable<BacktestRun> {
    return this.http.get<BacktestRun>(`/api/v1/backtests/${id}`);
  }
}
