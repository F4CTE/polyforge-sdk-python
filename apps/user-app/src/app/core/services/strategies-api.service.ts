import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type StrategyStatus     = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'PAPER' | 'ARCHIVED';
export type StrategyVisibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
export type ExecMode           = 'TICK' | 'EVENT' | 'HYBRID';

export interface BlockConfig {
  type: string;
  config: Record<string, string | number>;
}

export interface Strategy {
  id:           string;
  name:         string;
  description:  string;
  visibility:   StrategyVisibility;
  execMode:     ExecMode;
  tickMs:       number;
  triggers:     BlockConfig[];
  conditions:   BlockConfig[];
  actions:      BlockConfig[];
  safety:       BlockConfig[];
  status:       StrategyStatus;
  version:      number;
  template:     boolean;
  forkedFromId: string | null;
  forkCount:    number;
  likeCount:    number;
  tags:         string[];
  canvas?:      any;
  createdAt:    string;
  updatedAt:    string;
}

export interface StrategiesResponse {
  data:       Strategy[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
}

export interface CreateStrategyDto {
  name:        string;
  description: string;
  visibility:  StrategyVisibility;
  execMode:    ExecMode;
  tickMs:      number;
  triggers:    BlockConfig[];
  conditions:  BlockConfig[];
  actions:     BlockConfig[];
  safety:      BlockConfig[];
  tags:        string[];
  canvas?:     any;
}

@Injectable({ providedIn: 'root' })
export class StrategiesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/strategies';

  list(query: { page?: number; limit?: number; status?: string; sort?: string } = {}): Observable<StrategiesResponse> {
    let params = new HttpParams();
    if (query.page)   params = params.set('page', query.page);
    if (query.limit)  params = params.set('limit', query.limit);
    if (query.status) params = params.set('status', query.status);
    if (query.sort)   params = params.set('sort', query.sort);
    return this.http.get<StrategiesResponse>(this.base, { params });
  }

  get(id: string): Observable<Strategy> {
    return this.http.get<Strategy>(`${this.base}/${id}`);
  }

  create(dto: CreateStrategyDto): Observable<Strategy> {
    return this.http.post<Strategy>(this.base, dto);
  }

  update(id: string, dto: Partial<CreateStrategyDto>): Observable<Strategy> {
    return this.http.patch<Strategy>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  start(id: string, mode: 'live' | 'paper'): Observable<{ status: StrategyStatus; startedAt: string }> {
    return this.http.post<{ status: StrategyStatus; startedAt: string }>(`${this.base}/${id}/start`, { mode });
  }

  stop(id: string): Observable<{ status: StrategyStatus; stoppedAt: string }> {
    return this.http.post<{ status: StrategyStatus; stoppedAt: string }>(`${this.base}/${id}/stop`, {});
  }

  pause(id: string): Observable<{ status: StrategyStatus }> {
    return this.http.post<{ status: StrategyStatus }>(`${this.base}/${id}/pause`, {});
  }

  resume(id: string): Observable<{ status: StrategyStatus }> {
    return this.http.post<{ status: StrategyStatus }>(`${this.base}/${id}/resume`, {});
  }

  fork(id: string): Observable<Strategy> {
    return this.http.post<Strategy>(`${this.base}/${id}/fork`, {});
  }
}
