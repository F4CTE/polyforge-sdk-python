import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string; // plaintext, shown once
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private readonly http = inject(HttpClient);

  list(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>('/auth/v1/api-keys');
  }

  create(body: CreateApiKeyRequest): Observable<ApiKeyCreated> {
    return this.http.post<ApiKeyCreated>('/auth/v1/api-keys', body);
  }

  revoke(id: string): Observable<void> {
    return this.http.delete<void>(`/auth/v1/api-keys/${id}`);
  }
}
