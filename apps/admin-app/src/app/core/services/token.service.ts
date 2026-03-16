import { Injectable } from '@angular/core';

const KEY = 'pf_admin_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  get(): string | null {
    return localStorage.getItem(KEY);
  }

  set(token: string): void {
    localStorage.setItem(KEY, token);
  }

  clear(): void {
    localStorage.removeItem(KEY);
  }

  isExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
