import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { MenuItem, MessageService } from 'primeng/api';
import { AdminAuthStore } from '../../core/store/admin-auth.store';
import { AdminPollingService } from '../../core/services/admin-polling.service';

interface NavItem {
  label: string;
  icon:  string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, AvatarModule, MenuModule, ToastModule],
  providers: [MessageService],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit {
  readonly auth = inject(AdminAuthStore);
  readonly polling = inject(AdminPollingService);
  private readonly toast = inject(MessageService);
  collapsed     = signal(false);

  ngOnInit(): void {
    this.polling.start(this.toast);
  }

  readonly nav: { title: string; superAdminOnly?: boolean; items: NavItem[] }[] = [
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
        { label: 'Tickets',    icon: 'pi pi-comments',   route: '/tickets' },
      ],
    },
    {
      title: 'Moderation',
      items: [
        { label: 'Reports',    icon: 'pi pi-flag',       route: '/reports' },
        { label: 'Logs',       icon: 'pi pi-book',       route: '/logs' },
      ],
    },
    {
      title: 'System',
      superAdminOnly: true,
      items: [
        { label: 'Admins',     icon: 'pi pi-shield',     route: '/admins' },
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
