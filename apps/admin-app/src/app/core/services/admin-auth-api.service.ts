import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminAuthResponse, AdminLoginRequest } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/auth/v1';

  login(body: AdminLoginRequest): Observable<AdminAuthResponse> {
    return this.http.post<AdminAuthResponse>(`${this.base}/login`, body);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {});
  }
}
