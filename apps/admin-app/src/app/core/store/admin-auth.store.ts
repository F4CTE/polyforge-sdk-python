import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { Admin, AdminLoginRequest } from '../models/admin.model';
import { AdminAuthApiService } from '../services/admin-auth-api.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthStore {
  private readonly authApi = inject(AdminAuthApiService);
  private readonly router  = inject(Router);

  readonly admin   = signal<Admin | null>(null);
  readonly loading = signal(false);

  readonly isAuthenticated = computed(() => this.admin() !== null);
  readonly isSuperAdmin    = computed(() => this.admin()?.role === 'SUPER_ADMIN');

  init(): void {
    // Cookie auth: probe the server to restore session — 401 means not logged in.
    this.loading.set(true);
    this.authApi.getMe().subscribe({
      next:  admin => { this.admin.set(admin); this.loading.set(false); },
      error: ()    => { this.loading.set(false); },
    });
  }

  login(body: AdminLoginRequest) {
    return this.authApi.login(body).pipe(
      tap(admin => this.admin.set(admin)),
    );
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => {} });
    this.admin.set(null);
    this.router.navigate(['/login']);
  }
}
