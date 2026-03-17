import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  readonly lastUpdated = 'March 17, 2026';
}
