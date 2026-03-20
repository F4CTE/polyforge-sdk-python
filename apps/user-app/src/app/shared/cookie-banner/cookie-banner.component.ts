import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const STORAGE_KEY = 'pf_cookie_consent';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <div class="cookie-banner">
        <span class="cookie-text">
          We use essential cookies to keep you logged in and remember your preferences.
          See our <a [routerLink]="'/privacy'" class="cookie-link">Privacy Policy</a> for details.
        </span>
        <button class="cookie-btn" (click)="accept()">Got it</button>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      background: var(--pf-surface-card, #1a1a2e);
      border-top: 1px solid var(--pf-border, rgba(255,255,255,0.08));
      font-size: 13px;
    }
    .cookie-text {
      font-size: 13px;
      color: var(--pf-text-secondary, #94a3b8);
      line-height: 1.3;
    }
    .cookie-link {
      color: var(--p-primary-400, #22d3ee);
      text-decoration: underline;
    }
    .cookie-btn {
      padding: 0.25rem 0.75rem;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      border: 1px solid var(--pf-border, rgba(255,255,255,0.12));
      background: var(--pf-surface-elevated, #242438);
      color: var(--pf-text, #f1f5f9);
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .cookie-btn:hover {
      background: var(--p-primary-400, #22d3ee);
      color: #000;
      border-color: transparent;
    }
  `],
})
export class CookieBannerComponent {
  visible = signal(typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY) !== 'accepted'
    : false);

  accept(): void {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    this.visible.set(false);
  }
}
