import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { User, LoginRequest, RegisterRequest } from '../models/user.model';
import { AuthApiService } from '../services/auth-api.service';
import { TokenService } from '../services/token.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  // ─── State ────────────────────────────────────────────────────────────────

  readonly user = signal<User | null>(null);
  readonly loading = signal(false);

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isVerified      = computed(() => this.user()?.emailVerified === true);
  readonly isConnected     = computed(() => this.user()?.polymarketConnected === true);

  // ─── Init (called on app bootstrap) ──────────────────────────────────────

  init(): void {
    const token = this.tokenService.getToken();
    if (!token || this.tokenService.isExpired(token)) {
      this.tokenService.clearToken();
      return;
    }
    // Restore user from server to get fresh data
    this.loading.set(true);
    this.authApi.getMe().subscribe({
      next: user => { this.user.set(user); this.loading.set(false); },
      error: () => { this.tokenService.clearToken(); this.loading.set(false); },
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  login(body: LoginRequest) {
    return this.authApi.login(body).pipe(
      tap(res => {
        this.tokenService.setToken(res.token);
        this.user.set(res.user);
      }),
    );
  }

  register(body: RegisterRequest) {
    return this.authApi.register(body).pipe(
      tap(res => {
        this.tokenService.setToken(res.token);
        this.user.set(res.user);
      }),
    );
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => {} });
    this.tokenService.clearToken();
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  patchUser(partial: Partial<User>): void {
    const current = this.user();
    if (current) this.user.set({ ...current, ...partial });
  }
}
