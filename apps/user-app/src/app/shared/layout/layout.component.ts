import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { AuthStore } from '../../core/store/auth.store';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass, ButtonModule, AvatarModule, MenuModule],
  providers: [MessageService],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  readonly auth = inject(AuthStore);

  collapsed = signal(false);

  readonly navSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Trade',
      items: [
        { label: 'Markets',    icon: 'pi pi-chart-bar',  route: '/markets' },
        { label: 'Strategies', icon: 'pi pi-cog',        route: '/strategies' },
        { label: 'Portfolio',  icon: 'pi pi-wallet',     route: '/portfolio' },
        { label: 'Orders',     icon: 'pi pi-list',       route: '/orders' },
        { label: 'Backtest',   icon: 'pi pi-history',    route: '/backtest' },
      ],
    },
    {
      title: 'Social',
      items: [
        { label: 'Discover',     icon: 'pi pi-compass',  route: '/discover' },
        { label: 'Leaderboard',  icon: 'pi pi-trophy',   route: '/leaderboard' },
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

  get initials(): string {
    const u = this.auth.user();
    if (!u) return '?';
    return (u.displayName ?? u.username).slice(0, 2).toUpperCase();
  }
}
