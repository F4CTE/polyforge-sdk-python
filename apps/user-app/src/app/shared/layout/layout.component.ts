import { Component, inject, signal, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { AuthStore } from '../../core/store/auth.store';
import { NotificationUiService } from '../../core/services/notification-ui.service';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SlicePipe, ButtonModule, AvatarModule, MenuModule],
  providers: [MessageService],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  host: {
    '[class.sidebar-collapsed]': 'collapsed()',
  },
})
export class LayoutComponent {
  readonly auth = inject(AuthStore);
  readonly notifService = inject(NotificationUiService);
  readonly theme = inject(ThemeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  collapsed = signal(false);
  notifOpen = signal(false);

  readonly navSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Trade',
      items: [
        { label: 'Markets',    icon: 'pi pi-th-large',  route: '/markets' },
        { label: 'Strategies', icon: 'pi pi-code',      route: '/strategies' },
        { label: 'Portfolio',  icon: 'pi pi-chart-line', route: '/portfolio' },
        { label: 'Orders',     icon: 'pi pi-list',       route: '/orders' },
        { label: 'Backtest',   icon: 'pi pi-history',    route: '/backtest' },
      ],
    },
    {
      title: 'Social',
      items: [
        { label: 'Discover',    icon: 'pi pi-compass', route: '/discover' },
        { label: 'Leaderboard', icon: 'pi pi-trophy',  route: '/leaderboard' },
      ],
    },
    {
      title: 'Help',
      items: [
        { label: 'Support', icon: 'pi pi-question-circle', route: '/support' },
      ],
    },
  ];

  readonly userMenu: MenuItem[] = [
    { label: 'Profile',  icon: 'pi pi-user',   routerLink: '/profile/me' },
    { label: 'Settings', icon: 'pi pi-wrench',  routerLink: '/settings' },
    { separator: true },
    { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  sidebarCollapsed = false;

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleNotif(): void {
    this.notifOpen.update(v => !v);
  }

  get initials(): string {
    const u = this.auth.user();
    if (!u) return '?';
    return (u.displayName ?? u.username).slice(0, 2).toUpperCase();
  }
}
