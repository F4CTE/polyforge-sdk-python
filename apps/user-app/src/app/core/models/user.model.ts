export type UserStatus = 'UNVERIFIED' | 'VERIFIED' | 'CONNECTED';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  status: UserStatus;
  polymarketConnected: boolean;
  emailVerified: boolean;
  totpEnabled: boolean;
  showPnl: boolean;
  showWinrate: boolean;
  createdAt: string;
  lastSeen: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  tosAccepted: boolean;
  inviteCode?: string;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  field?: string;
  requestId?: string;
}
