import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { LoginRequest, RegisterRequest, User } from '../models/user.model';

const BASE = `${environment.authApiUrl}/auth/v1`;

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  register(body: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${BASE}/register`, body);
  }

  login(body: LoginRequest): Observable<User> {
    return this.http.post<User>(`${BASE}/login`, body);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {});
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${BASE}/me`);
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/verify-email`, { token });
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/reset-password`, { token, newPassword });
  }

  totpSetup(): Observable<{ secret: string; qrCodeUri: string; backupCodes: string[] }> {
    return this.http.post<{ secret: string; qrCodeUri: string; backupCodes: string[] }>(`${BASE}/totp/setup`, {});
  }

  totpConfirm(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/totp/confirm`, { code });
  }

  totpDisable(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/totp/disable`, { code });
  }

  importCredentials(body: {
    privateKey: string;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    safeAddress?: string;
  }): Observable<{ connected: boolean }> {
    return this.http.post<{ connected: boolean }>(`${BASE}/credentials`, body);
  }

  deleteCredentials(): Observable<{ connected: boolean }> {
    return this.http.delete<{ connected: boolean }>(`${BASE}/credentials`);
  }

  generateBotCode(): Observable<{ code: string; expiresAt: string }> {
    return this.http.post<{ code: string; expiresAt: string }>(`${BASE}/bot-link`, {});
  }
}
