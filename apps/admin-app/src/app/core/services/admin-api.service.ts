import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  HealthResponse, CacheStats, RateLimitEntry, BuilderStats,
  AdminUserView, AdminUserDetail,
  AdminStrategyView,
  AdminOrderView, DlqEntry,
  AdminBacktestView,
  AdminReport, ReportStatus,
  AuditLog, EventLog, LoginLog,
  PaginatedResponse,
} from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health`);
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  users(q: { page?: number; limit?: number; search?: string; status?: string; suspended?: boolean } = {}): Observable<PaginatedResponse<AdminUserView>> {
    let p = new HttpParams();
    if (q.page   !== undefined) p = p.set('page',      q.page);
    if (q.limit  !== undefined) p = p.set('limit',     q.limit);
    if (q.search)               p = p.set('search',    q.search);
    if (q.status)               p = p.set('status',    q.status);
    if (q.suspended !== undefined) p = p.set('suspended', String(q.suspended));
    return this.http.get<PaginatedResponse<AdminUserView>>(`${this.base}/users`, { params: p });
  }

  user(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`${this.base}/users/${id}`);
  }

  suspendUser(id: string, reason: string): Observable<{ suspended: boolean; suspendedAt: string; reason: string }> {
    return this.http.patch<{ suspended: boolean; suspendedAt: string; reason: string }>(`${this.base}/users/${id}/suspend`, { reason });
  }

  unsuspendUser(id: string): Observable<{ suspended: boolean }> {
    return this.http.patch<{ suspended: boolean }>(`${this.base}/users/${id}/unsuspend`, {});
  }

  updateLimits(id: string, limits: Partial<AdminUserDetail['limits']>): Observable<AdminUserDetail['limits']> {
    return this.http.patch<AdminUserDetail['limits']>(`${this.base}/users/${id}/limits`, limits);
  }

  // ─── Strategies ─────────────────────────────────────────────────────────────

  strategies(q: { page?: number; limit?: number; userId?: string; status?: string; visibility?: string } = {}): Observable<PaginatedResponse<AdminStrategyView>> {
    let p = new HttpParams();
    if (q.page)       p = p.set('page',       q.page!);
    if (q.limit)      p = p.set('limit',      q.limit!);
    if (q.userId)     p = p.set('userId',     q.userId);
    if (q.status)     p = p.set('status',     q.status);
    if (q.visibility) p = p.set('visibility', q.visibility);
    return this.http.get<PaginatedResponse<AdminStrategyView>>(`${this.base}/strategies`, { params: p });
  }

  forceStop(id: string): Observable<{ status: string; stoppedBy: string }> {
    return this.http.post<{ status: string; stoppedBy: string }>(`${this.base}/strategies/${id}/force-stop`, {});
  }

  // ─── Orders ─────────────────────────────────────────────────────────────────

  orders(q: { page?: number; limit?: number; userId?: string; status?: string; from?: string; to?: string } = {}): Observable<PaginatedResponse<AdminOrderView>> {
    let p = new HttpParams();
    if (q.page)   p = p.set('page',   q.page!);
    if (q.limit)  p = p.set('limit',  q.limit!);
    if (q.userId) p = p.set('userId', q.userId);
    if (q.status) p = p.set('status', q.status);
    if (q.from)   p = p.set('from',   q.from);
    if (q.to)     p = p.set('to',     q.to);
    return this.http.get<PaginatedResponse<AdminOrderView>>(`${this.base}/orders`, { params: p });
  }

  dlq(): Observable<DlqEntry[]> {
    return this.http.get<DlqEntry[]>(`${this.base}/orders/dlq`);
  }

  dlqReplay(intentId: string): Observable<{ replayed: boolean; intentId: string }> {
    return this.http.post<{ replayed: boolean; intentId: string }>(`${this.base}/orders/dlq/${intentId}/replay`, {});
  }

  dlqDiscard(intentId: string): Observable<{ discarded: boolean }> {
    return this.http.post<{ discarded: boolean }>(`${this.base}/orders/dlq/${intentId}/discard`, {});
  }

  // ─── Backtests ──────────────────────────────────────────────────────────────

  backtests(q: { page?: number; limit?: number } = {}): Observable<PaginatedResponse<AdminBacktestView>> {
    let p = new HttpParams();
    if (q.page)  p = p.set('page',  q.page!);
    if (q.limit) p = p.set('limit', q.limit!);
    return this.http.get<PaginatedResponse<AdminBacktestView>>(`${this.base}/backtests`, { params: p });
  }

  // ─── Cache ──────────────────────────────────────────────────────────────────

  cacheStats(): Observable<CacheStats> {
    return this.http.get<CacheStats>(`${this.base}/cache/stats`);
  }

  cacheFlush(pattern: string): Observable<{ keysDeleted: number }> {
    return this.http.delete<{ keysDeleted: number }>(`${this.base}/cache/${encodeURIComponent(pattern)}`);
  }

  // ─── Rate limits ────────────────────────────────────────────────────────────

  rateLimits(): Observable<RateLimitEntry[]> {
    return this.http.get<RateLimitEntry[]>(`${this.base}/rate-limits`);
  }

  // ─── Reports ────────────────────────────────────────────────────────────────

  reports(status?: ReportStatus): Observable<PaginatedResponse<AdminReport>> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    return this.http.get<PaginatedResponse<AdminReport>>(`${this.base}/reports`, { params: p });
  }

  resolveReport(id: string, status: ReportStatus, adminNote?: string): Observable<AdminReport> {
    return this.http.patch<AdminReport>(`${this.base}/reports/${id}`, { status, adminNote });
  }

  // ─── Builder Program ────────────────────────────────────────────────────────

  builderStats(): Observable<BuilderStats> {
    return this.http.get<BuilderStats>(`${this.base}/builder/stats`);
  }

  // ─── Key rotation ───────────────────────────────────────────────────────────

  keyRotationStatus(): Observable<{ jobId: string | null; status: string; rotated: number; total: number }> {
    return this.http.get<{ jobId: string | null; status: string; rotated: number; total: number }>(`${this.base}/key-rotation/status`);
  }

  startKeyRotation(): Observable<{ jobId: string; status: string; totalUsers: number }> {
    return this.http.post<{ jobId: string; status: string; totalUsers: number }>(`${this.base}/key-rotation/start`, {});
  }

  // ─── Invites ────────────────────────────────────────────────────────────────

  generateInvites(count: number, uses: number, ttlDays?: number): Observable<{ codes: string[] }> {
    return this.http.post<{ codes: string[] }>(`${this.base}/invites`, { count, uses, ...(ttlDays ? { ttlDays } : {}) });
  }

  listInvites(): Observable<{ code: string; remainingUses: number; ttl: number }[]> {
    return this.http.get<{ code: string; remainingUses: number; ttl: number }[]>(`${this.base}/invites`);
  }

  revokeInvite(code: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/invites/${encodeURIComponent(code)}`);
  }

  // ─── Waitlist ────────────────────────────────────────────────────────────────

  listWaitlist(): Observable<{ total: number; data: { email: string; joinedAt: string }[] }> {
    return this.http.get<{ total: number; data: { email: string; joinedAt: string }[] }>(`${this.base}/waitlist`);
  }

  removeFromWaitlist(email: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/waitlist/${encodeURIComponent(email)}`);
  }

  sendWaitlistInvite(email: string): Observable<{ code: string; sentTo: string }> {
    return this.http.post<{ code: string; sentTo: string }>(`${this.base}/waitlist/${encodeURIComponent(email)}/send-invite`, {});
  }

  // ─── Logs ───────────────────────────────────────────────────────────────────

  auditLogs(q: { page?: number; limit?: number; userId?: string; adminId?: string; action?: string; from?: string; to?: string } = {}): Observable<PaginatedResponse<AuditLog>> {
    let p = new HttpParams();
    if (q.page)    p = p.set('page',    q.page!);
    if (q.limit)   p = p.set('limit',   q.limit!);
    if (q.userId)  p = p.set('userId',  q.userId);
    if (q.adminId) p = p.set('adminId', q.adminId);
    if (q.action)  p = p.set('action',  q.action);
    if (q.from)    p = p.set('from',    q.from);
    if (q.to)      p = p.set('to',      q.to);
    return this.http.get<PaginatedResponse<AuditLog>>(`${this.base}/logs/audit`, { params: p });
  }

  eventLogs(q: { page?: number; limit?: number } = {}): Observable<PaginatedResponse<EventLog>> {
    let p = new HttpParams();
    if (q.page)  p = p.set('page',  q.page!);
    if (q.limit) p = p.set('limit', q.limit!);
    return this.http.get<PaginatedResponse<EventLog>>(`${this.base}/logs/events`, { params: p });
  }

  loginLogs(q: { page?: number; limit?: number } = {}): Observable<PaginatedResponse<LoginLog>> {
    let p = new HttpParams();
    if (q.page)  p = p.set('page',  q.page!);
    if (q.limit) p = p.set('limit', q.limit!);
    return this.http.get<PaginatedResponse<LoginLog>>(`${this.base}/logs/logins`, { params: p });
  }
}
