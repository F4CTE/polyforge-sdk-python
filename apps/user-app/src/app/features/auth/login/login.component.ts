import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { InputOtpModule } from 'primeng/inputotp';
import { CardModule } from 'primeng/card';
import { AuthStore } from '../../../core/store/auth.store';
import { ApiError } from '../../../core/models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
    DividerModule,
    InputOtpModule,
    CardModule,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb      = inject(FormBuilder);
  private readonly auth    = inject(AuthStore);
  private readonly router  = inject(Router);

  readonly loading     = signal(false);
  readonly error       = signal('');
  readonly requireTotp = signal(false);

  readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    totp:     [''],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { email, password, totp } = this.form.value;
    const body = { email: email!, password: password!, ...(totp ? { totpCode: totp } : {}) };

    this.auth.login(body).subscribe({
      next: () => { this.router.navigate(['/markets']); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiErr = err.error as ApiError;
        if (apiErr?.code === 'TOTP_REQUIRED') {
          this.requireTotp.set(true);
          this.error.set('');
        } else {
          this.error.set(apiErr?.message ?? 'Login failed. Please try again.');
        }
      },
    });
  }
}
