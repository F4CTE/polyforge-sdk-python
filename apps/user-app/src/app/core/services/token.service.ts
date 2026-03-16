import { Injectable } from '@angular/core';

const TOKEN_KEY = 'pf_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /** Decode JWT payload without verification (verification is done server-side). */
  decodePayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  isExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload || typeof payload['exp'] !== 'number') return true;
    return Date.now() / 1000 > payload['exp'];
  }
}
