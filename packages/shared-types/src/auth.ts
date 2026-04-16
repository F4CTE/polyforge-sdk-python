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

// ─────────────────────────────────────────────────────────────────────────────
// API Key types
// ─────────────────────────────────────────────────────────────────────────────

export enum ApiKeyScopeEnum {
  READ = "READ",
  WRITE = "WRITE",
  TRADE = "TRADE",
  STRATEGY = "STRATEGY",
  WEBHOOK = "WEBHOOK",
}

export interface ApiKeyMeta {
  keyId: string;
  scopes: string[];
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  key: string; // plaintext — returned once
}
