import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { ApiError } from '../../../core/models/user.model';

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('password')?.value;
  const pw2 = group.get('confirm')?.value;
  return pw && pw2 && pw !== pw2 ? { mismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, PasswordModule, MessageModule, CardModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <i class="pi pi-bolt logo-icon"></i>
          <span class="logo-text">Polyforge</span>
        </div>

        <p-card>
          @if (!done()) {
            <h2>Set new password</h2>
            <p class="auth-subtitle">Choose a strong password.</p>

            @if (error()) {
              <p-message severity="error" [text]="error()" styleClass="w-full mb-3" />
            }

            <form [formGroup]="form" (ngSubmit)="submit()">
              <div class="form-field">
                <label class="field-label">New password</label>
                <p-password formControlName="password" placeholder="At least 8 characters"
                            [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
                @if (form.get('password')?.invalid && form.get('password')?.touched) {
                  <small class="field-error">Minimum 8 characters, uppercase, lowercase, and number</small>
                }
              </div>

              <div class="form-field">
                <label class="field-label">Confirm password</label>
                <p-password formControlName="confirm" placeholder="Repeat password"
                            [feedback]="false" [toggleMask]="true"
                            styleClass="w-full" inputStyleClass="w-full" />
              </div>

              @if (form.errors?.['mismatch'] && form.get('confirm')?.touched) {
                <small class="field-error">Passwords do not match</small>
              }

              <p-button type="submit" label="Reset password" styleClass="w-full mt-2"
                        [loading]="loading()" [disabled]="loading() || !token()" />
            </form>
          } @else {
            <div style="text-align:center">
              <i class="pi pi-check-circle" style="font-size:3rem;color:var(--p-green-400);margin-bottom:1rem;display:block"></i>
              <h2>Password reset</h2>
              <p class="text-muted" style="margin-bottom:1.5rem">You can now sign in with your new password.</p>
              <p-button label="Sign in" routerLink="/login" />
            </div>
          }
        </p-card>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb      = inject(FormBuilder);
  private readonly route   = inject(ActivatedRoute);
  private readonly router  = inject(Router);
  private readonly authApi = inject(AuthApiService);

  readonly loading = signal(false);
  readonly error   = signal('');
  readonly done    = signal(false);
  readonly token   = signal('');

  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm:  ['', Validators.required],
  }, { validators: matchPasswords });

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token') ?? '');
    if (!this.token()) this.error.set('Missing reset token. Please request a new link.');
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.authApi.resetPassword(this.token(), this.form.value.password!).subscribe({
      next: () => { this.loading.set(false); this.done.set(true); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiErr = err.error as ApiError;
        this.error.set(apiErr?.message ?? 'Reset failed. Please request a new link.');
      },
    });
  }
}
