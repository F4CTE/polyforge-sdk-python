import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'GENERAL' | 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'BUG' | 'FEATURE_REQUEST';

export interface TicketMessage {
  id:         string;
  senderId:   string;
  senderName: string;
  isAdmin:    boolean;
  body:       string;
  createdAt:  string;
}

export interface TicketSummary {
  id:        string;
  subject:   string;
  category:  TicketCategory;
  status:    TicketStatus;
  priority:  TicketPriority;
  createdAt: string;
  updatedAt: string;
  messages:  { body: string; isAdmin: boolean; senderName: string; createdAt: string }[];
}

export interface TicketDetail {
  id:        string;
  userId:    string;
  subject:   string;
  category:  TicketCategory;
  status:    TicketStatus;
  priority:  TicketPriority;
  closedBy:  string | null;
  closedAt:  string | null;
  createdAt: string;
  updatedAt: string;
  messages:  TicketMessage[];
}

export interface TicketsResponse {
  data:       TicketSummary[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
}

export interface CreateTicketRequest {
  subject:   string;
  category?: string;
  body:      string;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TicketsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/tickets';

  list(query: { page?: number; limit?: number } = {}): Observable<TicketsResponse> {
    let params = new HttpParams();
    if (query.page)  params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    return this.http.get<TicketsResponse>(this.base, { params });
  }

  get(id: string): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${this.base}/${id}`);
  }

  create(dto: CreateTicketRequest): Observable<any> {
    return this.http.post(this.base, dto);
  }

  addMessage(ticketId: string, body: string): Observable<any> {
    return this.http.post(`${this.base}/${ticketId}/messages`, { body });
  }
}
