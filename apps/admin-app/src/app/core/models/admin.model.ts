export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';

export interface AdminView {
  id:          string;
  email:       string;
  displayName: string;
  role:        AdminRole;
  active:      boolean;
  createdAt:   string;
  lastSeen:    string;
}

export interface Admin {
  id:          string;
  email:       string;
  role:        AdminRole;
  displayName: string;
}

export interface AdminLoginRequest {
  email:    string;
  password: string;
}

// ─── User views ───────────────────────────────────────────────────────────────

export type UserStatus = 'UNVERIFIED' | 'VERIFIED' | 'CONNECTED';

export interface AdminUserView {
  id:                 string;
  email:              string;
  username:           string;
  displayName:        string | null;
  status:             UserStatus;
  suspended:          boolean;
  suspendedAt:        string | null;
  suspendReason:      string | null;
  polymarketConnected: boolean;
  emailVerified:      boolean;
  totpEnabled:        boolean;
  strategyCount:      number;
  orderCount:         number;
  createdAt:          string;
  lastSeen:           string;
}

export interface AdminUserDetail extends AdminUserView {
  bio:            string | null;
  avatarUrl:      string | null;
  twitterHandle:  string | null;
  limits: {
    maxStrategies:      number;
    maxOrdersPerMinute: number;
    maxPositionSizeUsdc: number;
    maxDailyLossUsdc:   number;
  };
}

// ─── Strategy views ───────────────────────────────────────────────────────────

export type StrategyStatus     = 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAPER' | 'ERROR' | 'ARCHIVED';
export type StrategyVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

export interface AdminStrategyView {
  id:          string;
  name:        string;
  userId:      string;
  username:    string;
  status:      StrategyStatus;
  visibility:  StrategyVisibility;
  execMode:    string;
  forkCount:   number;
  likeCount:   number;
  createdAt:   string;
  updatedAt:   string;
}

// ─── Order views ──────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export interface AdminOrderView {
  id:           string;
  userId:       string;
  username:     string;
  strategyId:   string | null;
  strategyName: string | null;
  side:         'BUY' | 'SELL';
  outcome:      string;
  size:         string;
  price:        string;
  filledSize:   string;
  avgFillPrice: string | null;
  orderType:    string;
  status:       OrderStatus;
  createdAt:    string;
}

export interface DlqEntry {
  intentId:    string;
  userId:      string;
  username:    string;
  strategyId:  string | null;
  attempts:    number;
  lastError:   string;
  payload:     Record<string, unknown>;
  enqueuedAt:  string;
}

// ─── Backtest views ───────────────────────────────────────────────────────────

export type BacktestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AdminBacktestView {
  id:             string;
  userId:         string;
  username:       string;
  strategyId:     string | null;
  strategyName:   string | null;
  status:         BacktestStatus;
  progress:       number;
  totalPnl:       string | null;
  winRate:        string | null;
  dateRangeStart: string;
  dateRangeEnd:   string;
  createdAt:      string;
  completedAt:    string | null;
}

// ─── Report views ─────────────────────────────────────────────────────────────

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED';

export interface AdminReport {
  id:              string;
  reporterId:      string;
  reporterUsername: string;
  targetType:      'STRATEGY' | 'COMMENT';
  targetId:        string;
  targetName:      string | null;
  reason:          string;
  status:          ReportStatus;
  adminNote:       string | null;
  createdAt:       string;
  resolvedAt:      string | null;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type ServiceHealth = 'healthy' | 'degraded' | 'down';

export interface ServiceStatus {
  status:    ServiceHealth;
  latencyMs: number;
}

export interface HealthResponse {
  status:   ServiceHealth;
  services: Record<string, ServiceStatus>;
  db:       { status: ServiceHealth; connections: number };
  redis:    { status: ServiceHealth; memoryUsageMb: number };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheStats {
  hitRate:       number;
  keyCount:      number;
  memoryUsageMb: number;
  patterns:      { pattern: string; keyCount: number; hitRate: number }[];
}

// ─── Rate limits ──────────────────────────────────────────────────────────────

export interface RateLimitEntry {
  endpoint:    string;
  limit:       number;
  used:        number;
  resetAt:     string;
  percentUsed: number;
}

// ─── Builder program ──────────────────────────────────────────────────────────

export interface BuilderStats {
  tier:             string;
  weeklyRewardUsdc: string;
  attributedVolume: string;
  weekly: { week: string; volume: string; reward: string }[];
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:        string;
  adminId:   string | null;
  userId:    string | null;
  action:    string;
  target:    string | null;
  targetId:  string | null;
  metadata:  Record<string, unknown> | null;
  ip:        string | null;
  createdAt: string;
}

export interface EventLog {
  id:        string;
  type:      string;
  userId:    string | null;
  payload:   Record<string, unknown>;
  createdAt: string;
}

export interface LoginLog {
  id:        string;
  userId:    string;
  username:  string;
  ip:        string;
  userAgent: string;
  success:   boolean;
  failReason: string | null;
  createdAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:       T[];
  total:      number;
  page:       number;
  totalPages: number;
}
