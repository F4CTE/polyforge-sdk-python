import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(true);

  constructor() {
    const saved = localStorage.getItem('pf-theme');
    if (saved === 'light') {
      this.isDark.set(false);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pf-theme', theme);
  }
}
