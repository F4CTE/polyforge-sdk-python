import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ─── Discover ────────────────────────────────────────────────────────────────

export interface StrategyAuthor {
  id:          string;
  username:    string;
  displayName: string | null;
  avatarUrl:   string | null;
}

export interface PublicStrategy {
  id:          string;
  name:        string;
  description: string;
  visibility:  'PUBLIC' | 'UNLISTED';
  execMode:    string;
  status:      string;
  forkCount:   number;
  likeCount:   number;
  tags:        string[];
  author:      StrategyAuthor;
  createdAt:   string;
}

export interface DiscoverResponse {
  data:       PublicStrategy[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:        number;
  userId:      string;
  username:    string;
  displayName: string | null;
  avatarUrl:   string | null;
  pnl:         string;
  winRate:     string;
  tradeCount:  number;
}

export interface LeaderboardResponse {
  data:       LeaderboardEntry[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface PublicProfile {
  id:                  string;
  username:            string;
  displayName:         string | null;
  bio:                 string | null;
  avatarUrl:           string | null;
  followersCount:      number;
  followingCount:      number;
  isFollowing:         boolean;
  publicStrategyCount: number;
  joinedAt:            string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface ProfileUpdateDto {
  displayName?:   string;
  bio?:           string;
  avatarUrl?:     string;
  twitterHandle?: string;
}

export interface NotificationPrefs {
  orderFilled?:      boolean;
  strategyError?:    boolean;
  backtestComplete?: boolean;
  priceAlert?:       boolean;
  dailyLossLimit?:   boolean;
  marketResolved?:   boolean;
  follow?:           boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SocialApiService {
  private readonly http = inject(HttpClient);

  // Discover
  discover(query: { sort?: string; category?: string; page?: number; limit?: number } = {}): Observable<DiscoverResponse> {
    let params = new HttpParams();
    if (query.sort)     params = params.set('sort', query.sort);
    if (query.category) params = params.set('category', query.category);
    if (query.page)     params = params.set('page', query.page);
    if (query.limit)    params = params.set('limit', query.limit);
    return this.http.get<DiscoverResponse>('/api/v1/discover', { params });
  }

  // Leaderboard
  leaderboard(period: '7d' | '30d' | 'allTime' = '7d', page = 1): Observable<LeaderboardResponse> {
    const params = new HttpParams().set('period', period).set('page', page).set('limit', 25);
    return this.http.get<LeaderboardResponse>('/api/v1/leaderboard', { params });
  }

  // Profile
  profile(username: string): Observable<PublicProfile> {
    return this.http.get<PublicProfile>(`/api/v1/profile/${username}`);
  }

  follow(username: string): Observable<{ following: boolean; followersCount: number }> {
    return this.http.post<{ following: boolean; followersCount: number }>(`/api/v1/profile/${username}/follow`, {});
  }

  // Settings
  updateProfile(dto: ProfileUpdateDto): Observable<unknown> {
    return this.http.patch('/api/v1/settings/profile', dto);
  }

  updateNotifications(prefs: NotificationPrefs): Observable<unknown> {
    return this.http.patch('/api/v1/settings/notifications', prefs);
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>('/api/v1/settings/password', { currentPassword, newPassword });
  }
}
