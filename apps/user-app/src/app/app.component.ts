import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { CookieBannerComponent } from './shared/cookie-banner/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, CookieBannerComponent],
  template: `
    <p-toast position="top-right" [life]="5000" />
    <router-outlet />
    <app-cookie-banner />
  `,
})
export class AppComponent {}
