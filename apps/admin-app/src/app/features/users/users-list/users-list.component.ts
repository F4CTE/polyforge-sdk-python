import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminUserView } from '../../../core/models/admin.model';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, ButtonModule, InputTextModule, SelectModule, SkeletonModule, TagModule],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  users      = signal<AdminUserView[]>([]);
  loading    = signal(true);
  total      = signal(0);
  totalPages = signal(0);
  page       = signal(1);

  search    = '';
  status    = '';
  suspended = '';

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Unverified',   value: 'UNVERIFIED' },
    { label: 'Verified',     value: 'VERIFIED' },
    { label: 'Connected',    value: 'CONNECTED' },
  ];

  readonly suspendedOptions = [
    { label: 'All',       value: '' },
    { label: 'Active',    value: 'false' },
    { label: 'Suspended', value: 'true' },
  ];

  readonly skeletons = Array(10);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.users({
      page:      this.page(),
      limit:     20,
      search:    this.search || undefined,
      status:    this.status || undefined,
      suspended: this.suspended ? this.suspended === 'true' : undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.users.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => { this.page.set(1); this.load(); }, 300);
  }

  onFilter(): void { this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  statusSeverity(status: string): 'success' | 'warn' | 'info' | 'secondary' {
    if (status === 'CONNECTED') return 'success';
    if (status === 'VERIFIED')  return 'info';
    return 'secondary';
  }

  statusBadge(status: string): { label: string; bg: string; color: string } {
    switch (status) {
      case 'CONNECTED':
        return { label: 'ACTIVE',     bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' };
      case 'VERIFIED':
        return { label: 'ACTIVE',     bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' };
      case 'UNVERIFIED':
        return { label: 'UNVERIFIED', bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' };
      default:
        return { label: status || 'UNKNOWN', bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' };
    }
  }
}
