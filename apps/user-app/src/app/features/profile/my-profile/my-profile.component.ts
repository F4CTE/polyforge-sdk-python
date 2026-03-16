import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonModule, AvatarModule],
  templateUrl: './my-profile.component.html',
})
export class MyProfileComponent {
  readonly auth = inject(AuthStore);

  get user() { return this.auth.user(); }

  get initials(): string {
    const u = this.user;
    if (!u) return '?';
    return (u.displayName ?? u.username).slice(0, 2).toUpperCase();
  }
}
