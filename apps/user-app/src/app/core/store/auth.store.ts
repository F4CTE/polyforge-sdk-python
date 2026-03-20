import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, timeout } from 'rxjs';
import { User, LoginRequest, RegisterRequest } from '../models/user.model';
import { AuthApiService } from '../services/auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);
  private readonly router  = inject(Router);

  // ─── State ────────────────────────────────────────────────────────────────

  readonly user    = signal<User | null>(null);
  readonly loading = signal(false);

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isVerified      = computed(() => this.user()?.emailVerified === true);
  readonly isConnected     = computed(() => this.user()?.polymarketConnected === true);

  // ─── Init (called on app bootstrap) ──────────────────────────────────────

  init(): Observable<unknown> {
    // Cookie auth: we can't read the HttpOnly cookie from JS, so we probe the
    // server. A 401 simply means the user is not logged in — that's fine.
    this.loading.set(true);
    return this.authApi.getMe().pipe(
      timeout(3000),
      tap(user => { this.user.set(user); this.loading.set(false); }),
      catchError(() => { this.loading.set(false); return of(null); }),
    );
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  login(body: LoginRequest) {
    return this.authApi.login(body).pipe(
      tap(user => this.user.set(user)),
    );
  }

  register(body: RegisterRequest) {
    return this.authApi.register(body).pipe(
      tap(user => this.user.set(user)),
    );
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => {} });
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  patchUser(partial: Partial<User>): void {
    const current = this.user();
    if (current) this.user.set({ ...current, ...partial });
  }
}
