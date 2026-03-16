import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { AuthApiService } from '../../../core/services/auth-api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, CardModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <i class="pi pi-bolt logo-icon"></i>
          <span class="logo-text">Polyforge</span>
        </div>

        <p-card>
          @if (!sent()) {
            <h2>Reset password</h2>
            <p class="auth-subtitle">We'll send you a reset link.</p>

            <form [formGroup]="form" (ngSubmit)="submit()">
              <div class="form-field">
                <label class="field-label" for="email">Email</label>
                <input pInputText id="email" type="email" formControlName="email"
                       placeholder="you@example.com" class="w-full" />
                @if (form.get('email')?.invalid && form.get('email')?.touched) {
                  <small class="field-error">Enter a valid email address</small>
                }
              </div>

              <p-button type="submit" label="Send reset link" styleClass="w-full"
                        [loading]="loading()" [disabled]="loading()" />
            </form>
          } @else {
            <div style="text-align:center">
              <i class="pi pi-send" style="font-size:3rem;color:var(--p-primary-400);margin-bottom:1rem;display:block"></i>
              <h2>Check your inbox</h2>
              <p class="text-muted">
                If an account with that email exists, we've sent a reset link.
              </p>
            </div>
          }

          <div class="auth-footer" style="margin-top:1rem">
            <a [routerLink]="'/login'">Back to login</a>
          </div>
        </p-card>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb      = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);

  readonly loading = signal(false);
  readonly sent    = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.authApi.forgotPassword(this.form.value.email!).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: () => { this.loading.set(false); this.sent.set(true); }, // always 200 per spec
    });
  }
}
