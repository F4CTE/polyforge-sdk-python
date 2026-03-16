import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { Admin, AdminLoginRequest } from '../models/admin.model';
import { AdminAuthApiService } from '../services/admin-auth-api.service';
import { TokenService } from '../services/token.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthStore {
  private readonly authApi   = inject(AdminAuthApiService);
  private readonly tokenSvc  = inject(TokenService);
  private readonly router    = inject(Router);

  readonly admin   = signal<Admin | null>(null);
  readonly loading = signal(false);

  readonly isAuthenticated = computed(() => this.admin() !== null);
  readonly isSuperAdmin    = computed(() => this.admin()?.role === 'SUPER_ADMIN');

  init(): void {
    const token = this.tokenSvc.get();
    if (!token || this.tokenSvc.isExpired(token)) {
      this.tokenSvc.clear();
      return;
    }
    // Decode from JWT payload (admin has short 1h JWT — just decode, no refresh endpoint)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.admin.set({
        id:          payload.sub,
        email:       payload.email ?? '',
        role:        payload.role ?? 'VIEWER',
        displayName: payload.displayName ?? 'Admin',
      });
    } catch {
      this.tokenSvc.clear();
    }
  }

  login(body: AdminLoginRequest) {
    return this.authApi.login(body).pipe(
      tap(res => {
        this.tokenSvc.set(res.token);
        this.admin.set(res.admin);
      }),
    );
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => {} });
    this.tokenSvc.clear();
    this.admin.set(null);
    this.router.navigate(['/login']);
  }
}
