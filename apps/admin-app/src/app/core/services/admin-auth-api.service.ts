import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Admin, AdminLoginRequest } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/auth/v1';

  login(body: AdminLoginRequest): Observable<Admin> {
    return this.http.post<Admin>(`${this.base}/login`, body);
  }

  getMe(): Observable<Admin> {
    return this.http.get<Admin>(`${this.base}/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {});
  }
}
