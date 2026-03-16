import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AdminAuthStore } from '../../../core/store/admin-auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth   = inject(AdminAuthStore);
  private readonly router = inject(Router);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  submit(): void {
    if (this.loading() || !this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next:  () => { this.router.navigate(['/dashboard']); },
      error: err => {
        const code = err.error?.code;
        this.error.set(
          code === 'IP_NOT_ALLOWLISTED' ? 'Your IP address is not allowlisted.' :
          code === 'INVALID_CREDENTIALS' ? 'Invalid email or password.' :
          'Login failed. Please try again.',
        );
        this.loading.set(false);
      },
    });
  }
}
