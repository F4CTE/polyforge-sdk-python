import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { AdminApiService } from '../../core/services/admin-api.service';
import { BuilderStats } from '../../core/models/admin.model';

@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [DecimalPipe, ButtonModule, SkeletonModule, ChartModule],
  templateUrl: './builder.component.html',
})
export class BuilderComponent implements OnInit {
  private readonly api        = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  stats     = signal<BuilderStats | null>(null);
  loading   = signal(true);
  chartData = signal<{ labels: string[]; datasets: { label: string; data: number[]; backgroundColor: string; borderColor: string; }[] } | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.builderStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => {
          this.stats.set(s);
          this.buildChart(s);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  buildChart(s: BuilderStats): void {
    this.chartData.set({
      labels: s.weekly.map(w => w.week),
      datasets: [
        {
          label: 'Attributed Volume (USDC)',
          data: s.weekly.map(w => parseFloat(w.volume)),
          backgroundColor: 'rgba(6,182,212,0.15)',
          borderColor: '#06B6D4',
        },
      ],
    });
  }

  get chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#B0C0D4', font: { family: 'Outfit' } } },
      },
      scales: {
        x: { ticks: { color: '#7A94B4', font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: 'rgba(42,61,82,0.4)' } },
        y: { ticks: { color: '#7A94B4', font: { family: 'JetBrains Mono', size: 11 } }, grid: { color: 'rgba(42,61,82,0.4)' } },
      },
    };
  }

  pnlColor(val: string): string {
    return parseFloat(val) >= 0 ? 'var(--pf-success)' : 'var(--pf-danger)';
  }
}
