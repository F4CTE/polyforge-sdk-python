// ─────────────────────────────────────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string; // admin id
  email: string;
  role: AdminRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface InternalJwtPayload {
  service: string; // e.g. 'auth-service', 'order-service'
  jti: string; // unique token id for replay protection
  iat?: number;
  exp?: number;
}

export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  SUPPORT = "SUPPORT",
  VIEWER = "VIEWER",
}

export enum UserStatus {
  UNVERIFIED = "UNVERIFIED",
  VERIFIED = "VERIFIED",
  CONNECTED = "CONNECTED",
}
