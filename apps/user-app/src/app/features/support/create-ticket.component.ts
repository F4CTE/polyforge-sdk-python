import { Component, inject, signal, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { TicketsApiService, TicketCategory } from '../../core/services/tickets-api.service';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, TextareaModule, SelectModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="pf-page">

      <div class="page-header">
        <h1>New Support Ticket</h1>
      </div>

      <div class="portfolio-table-panel" style="padding:24px">

        <div class="form-group">
          <label class="pf-col-label">Subject</label>
          <input type="text" pInputText [(ngModel)]="subject" placeholder="Brief description of your issue"
                 style="width:100%" maxlength="255" />
        </div>

        <div class="form-group" style="margin-top:16px">
          <label class="pf-col-label">Category</label>
          <p-select [options]="categories" [(ngModel)]="category" optionLabel="label" optionValue="value"
                    placeholder="Select category" style="width:100%" />
        </div>

        <div class="form-group" style="margin-top:16px">
          <label class="pf-col-label">Description</label>
          <textarea pTextarea [(ngModel)]="body" rows="6" placeholder="Describe your issue in detail..."
                    style="width:100%;resize:vertical" maxlength="5000"></textarea>
        </div>

        <div style="margin-top:24px;display:flex;gap:12px">
          <p-button label="Submit Ticket" icon="pi pi-send" [loading]="saving()"
                    (onClick)="submit()" [disabled]="!subject.trim() || !body.trim()" />
          <p-button label="Cancel" severity="secondary" [text]="true" routerLink="/support" />
        </div>

      </div>
    </div>
  `,
})
export class CreateTicketComponent {
  private readonly api = inject(TicketsApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  subject = '';
  category: TicketCategory = 'GENERAL';
  body = '';
  saving = signal(false);

  readonly categories = [
    { label: 'General',         value: 'GENERAL' },
    { label: 'Billing',         value: 'BILLING' },
    { label: 'Technical',       value: 'TECHNICAL' },
    { label: 'Account',         value: 'ACCOUNT' },
    { label: 'Bug Report',      value: 'BUG' },
    { label: 'Feature Request', value: 'FEATURE_REQUEST' },
  ];

  submit(): void {
    if (this.saving() || !this.subject.trim() || !this.body.trim()) return;
    this.saving.set(true);
    this.api.create({ subject: this.subject.trim(), category: this.category, body: this.body.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket: any) => {
          this.toast.add({ severity: 'success', summary: 'Ticket created', detail: 'We\'ll get back to you soon.' });
          this.saving.set(false);
          this.router.navigate(['/support', ticket.id]);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to create ticket. Please try again.' });
          this.saving.set(false);
        },
      });
  }
}
