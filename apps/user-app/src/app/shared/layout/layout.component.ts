import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { AuthStore } from '../../core/store/auth.store';
import { NotificationUiService } from '../../core/services/notification-ui.service';

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
  styles: [`
    .notif-bell-wrapper { position: relative; }
    .notif-bell-btn {
      background: none; border: none; cursor: pointer; position: relative;
      color: var(--pf-text-secondary); font-size: 18px; padding: 8px;
      border-radius: 6px; transition: color 0.15s, background 0.15s;
    }
    .notif-bell-btn:hover { color: var(--pf-text-primary); background: var(--pf-bg-overlay); }
    .notif-badge {
      position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px;
      background: var(--pf-cyan-500); color: #080C14; font-size: 10px; font-weight: 700;
      border-radius: 99px; display: flex; align-items: center; justify-content: center;
      padding: 0 4px; line-height: 1;
    }
    .notif-dropdown {
      position: absolute; top: 100%; right: 0; margin-top: 8px; width: 360px;
      background: var(--pf-bg-elevated); border: 1px solid var(--pf-border-default);
      border-radius: 10px; box-shadow: var(--pf-shadow-lg); z-index: 1000;
      max-height: 400px; overflow-y: auto;
    }
    .notif-dropdown-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid var(--pf-border-subtle);
      font-weight: 600; font-size: 14px; color: var(--pf-text-primary);
    }
    .notif-mark-all {
      background: none; border: none; cursor: pointer; font-size: 12px;
      color: var(--pf-cyan-500); font-weight: 500;
    }
    .notif-mark-all:hover { text-decoration: underline; }
    .notif-empty {
      padding: 32px 16px; text-align: center; color: var(--pf-text-muted); font-size: 13px;
    }
    .notif-item {
      display: flex; gap: 10px; padding: 12px 16px; cursor: pointer;
      transition: background 0.15s; border-bottom: 1px solid var(--pf-border-subtle);
    }
    .notif-item:hover { background: var(--pf-bg-overlay); }
    .notif-item.unread { background: rgba(6, 182, 212, 0.04); }
    .notif-item-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
    }
    .notif-item-body { flex: 1; min-width: 0; }
    .notif-item-title { font-size: 13px; font-weight: 600; color: var(--pf-text-primary); margin-bottom: 2px; }
    .notif-item-text { font-size: 12px; color: var(--pf-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `],
})
export class LayoutComponent {
  readonly auth = inject(AuthStore);
  readonly notifService = inject(NotificationUiService);

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

  toggleSidebar(): void {
    this.collapsed.update(v => !v);
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
