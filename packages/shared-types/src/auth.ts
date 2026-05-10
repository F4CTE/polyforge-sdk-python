// ─────────────────────────────────────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────────────────────────────────────

// JWT payloads MUST NOT contain PII (email, real name, address, etc.).
// JWTs are routinely logged by reverse proxies, APMs, browser devtools, and
// third-party SDKs, so any PII placed here leaks broadly and creates a
// GDPR exposure risk. Look up PII server-side from `sub` when needed.
export interface JwtPayload {
  sub: string; // user id
  username: string;
  kalshiConnected?: boolean;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string; // admin id
  role: AdminRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
  displayName: string;
  totpEnabled: boolean;
}

export interface InternalJwtPayload {
  sub?: string;
  iss?: string;
  aud?: string;
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
