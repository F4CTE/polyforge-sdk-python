import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { AuthStore } from '../../../core/store/auth.store';
import { ApiError } from '../../../core/models/user.model';

function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  if (!v) return null;
  if (!/[A-Z]/.test(v)) return { password: 'Must contain at least one uppercase letter' };
  if (!/[a-z]/.test(v)) return { password: 'Must contain at least one lowercase letter' };
  if (!/[0-9]/.test(v)) return { password: 'Must contain at least one number' };
  return null;
}

function usernameValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  if (!v) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return { username: 'Only letters, numbers, and underscores' };
  if (/^_/.test(v) || /_$/.test(v)) return { username: 'Cannot start or end with underscore' };
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CheckboxModule,
    MessageModule,
    CardModule,
    DividerModule,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly loading    = signal(false);
  readonly error      = signal('');
  readonly inviteOnly = signal(false);

  readonly form = this.fb.group({
    email:       ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    username:    ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), usernameValidator]],
    password:    ['', [Validators.required, Validators.minLength(8), passwordValidator]],
    tosAccepted: [false, Validators.requiredTrue],
    inviteCode:  ['', [Validators.maxLength(20)]],
  });

  constructor() {
    // Pre-fill invite code from ?invite= query param and show the field
    const code = this.route.snapshot.queryParamMap.get('invite');
    if (code) {
      this.form.patchValue({ inviteCode: code });
      this.inviteOnly.set(true);
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { email, username, password, tosAccepted, inviteCode } = this.form.value;
    const body: Parameters<typeof this.auth.register>[0] = {
      email: email!, username: username!, password: password!, tosAccepted: tosAccepted!,
    };
    if (inviteCode) body.inviteCode = inviteCode;

    this.auth.register(body).subscribe({
      next: () => { this.router.navigate(['/verify-email']); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiErr = err.error as ApiError;
        if (apiErr?.code === 'INVITE_REQUIRED' || apiErr?.code === 'INVITE_INVALID') {
          this.inviteOnly.set(true);
        }
        this.error.set(apiErr?.message ?? 'Registration failed. Please try again.');
      },
    });
  }

  fieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl?.touched || !ctrl.errors) return '';
    if (ctrl.errors['required']) return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    if (ctrl.errors['email']) return 'Enter a valid email address';
    if (ctrl.errors['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} characters`;
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters`;
    if (ctrl.errors['password']) return ctrl.errors['password'];
    if (ctrl.errors['username']) return ctrl.errors['username'];
    return '';
  }
}
