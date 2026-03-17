import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AdminAuthStore } from '../../core/store/admin-auth.store';

interface NavItem {
  label: string;
  icon:  string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, AvatarModule, MenuModule],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  readonly auth = inject(AdminAuthStore);
  collapsed     = signal(false);

  readonly nav: { title: string; items: NavItem[] }[] = [
    {
      title: 'Monitor',
      items: [
        { label: 'Dashboard',  icon: 'pi pi-home',       route: '/dashboard' },
        { label: 'Builder',    icon: 'pi pi-chart-bar',  route: '/builder' },
        { label: 'Cache',      icon: 'pi pi-database',   route: '/cache' },
      ],
    },
    {
      title: 'Manage',
      items: [
        { label: 'Users',      icon: 'pi pi-users',      route: '/users' },
        { label: 'Strategies', icon: 'pi pi-code',       route: '/strategies' },
        { label: 'Orders',     icon: 'pi pi-list',       route: '/orders' },
        { label: 'Backtests',  icon: 'pi pi-history',    route: '/backtests' },
        { label: 'Invites',    icon: 'pi pi-ticket',     route: '/invites' },
      ],
    },
    {
      title: 'Moderation',
      items: [
        { label: 'Reports',    icon: 'pi pi-flag',       route: '/reports' },
        { label: 'Logs',       icon: 'pi pi-book',       route: '/logs' },
      ],
    },
  ];

  readonly userMenu: MenuItem[] = [
    { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  get initials(): string {
    const a = this.auth.admin();
    if (!a) return '?';
    return (a.displayName ?? a.email).slice(0, 2).toUpperCase();
  }

  get roleLabel(): string {
    return this.auth.admin()?.role?.replace('_', ' ') ?? '';
  }
}
