import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SocialApiService, PublicProfile } from '../../../core/services/social-api.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonModule, SkeletonModule, AvatarModule, ToastModule],
  providers: [MessageService],
  templateUrl: './public-profile.component.html',
})
export class PublicProfileComponent implements OnInit {
  private readonly api        = inject(SocialApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly auth       = inject(AuthStore);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  profile        = signal<PublicProfile | null>(null);
  loading        = signal(true);
  followLoading  = signal(false);

  ngOnInit(): void {
    const username = this.route.snapshot.paramMap.get('username')!;
    this.api.profile(username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  p  => { this.profile.set(p); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  get isOwn(): boolean {
    const me = this.auth.user();
    const p  = this.profile();
    return !!me && !!p && me.username === p.username;
  }

  toggleFollow(): void {
    const p = this.profile();
    if (!p || this.followLoading()) return;
    this.followLoading.set(true);
    this.api.follow(p.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.profile.update(prev => prev ? {
            ...prev,
            isFollowing:    res.following,
            followersCount: res.followersCount,
          } : prev);
          this.followLoading.set(false);
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Error', detail: 'Could not update follow status' });
          this.followLoading.set(false);
        },
      });
  }

  get initials(): string {
    const p = this.profile();
    if (!p) return '?';
    return (p.displayName ?? p.username).slice(0, 2).toUpperCase();
  }
}
