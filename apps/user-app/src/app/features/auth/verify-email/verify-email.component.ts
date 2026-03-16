import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { ApiError } from '../../../core/models/user.model';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule, MessageModule, ProgressSpinnerModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <i class="pi pi-bolt logo-icon"></i>
          <span class="logo-text">Polyforge</span>
        </div>

        <p-card>
          @switch (state()) {
            @case ('pending') {
              <div style="text-align:center;padding:1rem 0">
                <p-progressSpinner strokeWidth="4" style="width:48px;height:48px" />
              </div>
            }
            @case ('verified') {
              <div style="text-align:center">
                <i class="pi pi-check-circle" style="font-size:3rem;color:var(--p-green-400);margin-bottom:1rem;display:block"></i>
                <h2 style="margin-bottom:0.5rem">Email verified!</h2>
                <p class="text-muted" style="margin-bottom:1.5rem">Your account is now active.</p>
                <p-button label="Go to Markets" routerLink="/markets" />
              </div>
            }
            @case ('error') {
              <div style="text-align:center">
                <i class="pi pi-times-circle" style="font-size:3rem;color:var(--p-red-400);margin-bottom:1rem;display:block"></i>
                <h2 style="margin-bottom:0.5rem">Verification failed</h2>
                <p-message severity="error" [text]="error()" styleClass="w-full mb-3" />
                <p-button label="Resend email" [outlined]="true" (onClick)="resend()" [loading]="resending()" />
              </div>
            }
            @case ('waiting') {
              <div style="text-align:center">
                <i class="pi pi-envelope" style="font-size:3rem;color:var(--p-primary-400);margin-bottom:1rem;display:block"></i>
                <h2 style="margin-bottom:0.5rem">Check your email</h2>
                <p class="text-muted" style="margin-bottom:0.75rem">
                  We sent a verification link to <strong>{{ auth.user()?.email }}</strong>.
                  Click the link to activate your account.
                </p>
                @if (resent()) {
                  <p-message severity="success" text="Verification email resent!" styleClass="w-full mb-3" />
                }
                <p-button label="Resend email" [outlined]="true" (onClick)="resend()"
                          [loading]="resending()" styleClass="w-full" />
                <div class="auth-footer" style="margin-top:1rem">
                  <a [routerLink]="'/login'">Back to login</a>
                </div>
              </div>
            }
          }
        </p-card>
      </div>
    </div>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private readonly route   = inject(ActivatedRoute);
  private readonly authApi = inject(AuthApiService);
  readonly auth            = inject(AuthStore);

  readonly state    = signal<'pending' | 'waiting' | 'verified' | 'error'>('waiting');
  readonly error    = signal('');
  readonly resending = signal(false);
  readonly resent    = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.state.set('pending');
      this.authApi.verifyEmail(token).subscribe({
        next: () => {
          this.state.set('verified');
          this.auth.patchUser({ emailVerified: true });
        },
        error: (err: HttpErrorResponse) => {
          this.state.set('error');
          const apiErr = err.error as ApiError;
          this.error.set(apiErr?.message ?? 'Verification link is invalid or expired.');
        },
      });
    }
  }

  resend(): void {
    this.resending.set(true);
    this.authApi.forgotPassword(this.auth.user()?.email ?? '').subscribe({
      next: () => { this.resending.set(false); this.resent.set(true); },
      error: () => { this.resending.set(false); },
    });
  }
}
