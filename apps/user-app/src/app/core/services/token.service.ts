import { Injectable } from '@angular/core';

/**
 * Utility service for JWT operations.
 * Token storage is now handled via HttpOnly cookies set by the server —
 * this service no longer reads or writes localStorage.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  /** Decode JWT payload without verification (verification is server-side). */
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
}
