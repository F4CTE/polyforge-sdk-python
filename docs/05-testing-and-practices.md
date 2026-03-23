# Polyforge — Testing & Good Practices

> Standards, patterns, and guardrails for building Polyforge correctly.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Structure & Organisation](#2-test-structure--organisation)
3. [Unit Testing Patterns](#3-unit-testing-patterns)
4. [Integration Testing](#4-integration-testing)
5. [Testing Stream Consumers](#5-testing-stream-consumers)
6. [Testing WebSocket Handlers](#6-testing-websocket-handlers)
7. [Test Data Factories](#7-test-data-factories)
8. [Coverage Requirements](#8-coverage-requirements)
9. [Error Handling](#9-error-handling)
10. [Logging Practices](#10-logging-practices)
11. [Security Practices](#11-security-practices)
12. [Money & Decimal Arithmetic](#12-money--decimal-arithmetic)
13. [Redis Practices](#13-redis-practices)
14. [Database Practices](#14-database-practices)
15. [Order Idempotency](#15-order-idempotency)
16. [Strategy Engine Practices](#16-strategy-engine-practices)
17. [API Design Practices](#17-api-design-practices)
18. [Performance Practices](#18-performance-practices)
19. [Deployment Practices](#19-deployment-practices)
20. [Code Review Checklist](#20-code-review-checklist)

---

## 1. Testing Philosophy

### The Three Rules

**Rule 1 — Test behaviour, not implementation.**

```typescript
// ❌ BAD — tests internal implementation
it('calls _buildOrderPayload before submitting', ...)

// ✅ GOOD — tests observable behaviour
it('places a buy order with the correct size and price', ...)
```

**Rule 2 — Tests must be deterministic.**

```typescript
// ❌ BAD — depends on real time
it('expires after 60 seconds', async () => {
  await new Promise(r => setTimeout(r, 61000));
  ...
})

// ✅ GOOD — use vitest fake timers
it('expires after 60 seconds', async () => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(61000);
  ...
})
```

**Rule 3 — A failing test must point to exactly one problem.**  
If a test fails and you can't tell where to look, the test is too big. Break it down.

### Test Pyramid

```
         ┌─────────────────────┐
         │    E2E / Smoke      │  ← Few, slow, catch regressions
         │     (5–10 tests)    │
         ├─────────────────────┤
         │    Integration      │  ← Moderate, test service boundaries
         │    (50–100 tests)   │
         ├─────────────────────┤
         │      Unit           │  ← Many, fast, test logic
         │   (500+ tests)      │
         └─────────────────────┘
```

- **Unit tests** — pure logic: block evaluators, schema validation, encryption helpers, P&L calculations. No DB, no Redis, no network.
- **Integration tests** — service boundaries: controller → service → DB → response. Uses real Postgres + Redis in test containers.
- **E2E / Smoke tests** — happy path through the full stack: register → build strategy → start → place order → fill. Runs against the dev Docker environment via `BASE_URL=http://localhost pnpm --filter @polyforge/e2e test`. Requires `docker compose -f docker-compose.infra.yml up -d` running. Global setup clears `config:invite_only` Redis flag. PrimeNG locators use icon classes (`.pi-pencil`, `.pi-pause`, etc.) since `pTooltip` directives don't render as DOM attributes in AOT builds. CI runs E2E after build (Chromium-only for stability; Firefox skipped). Rate-limit bypass via `X-E2E-Bypass` header in test environments. CI includes a free-disk-space step before Docker builds.

---

## 2. Test Structure & Organisation

### File placement

```
services/strategy-engine/
├── src/
│   ├── blocks/
│   │   ├── triggers/
│   │   │   ├── price-crosses-up.block.ts
│   │   │   └── price-crosses-up.block.spec.ts   ← unit test alongside source
│   │   └── conditions/
│   │       ├── min-liquidity.block.ts
│   │       └── min-liquidity.block.spec.ts
│   └── engine/
│       ├── tick-runner.ts
│       └── tick-runner.spec.ts
└── test/
    └── engine.integration.spec.ts               ← integration tests in /test
```

### Test file naming

| Type | Suffix | Example |
|---|---|---|
| Unit | `.spec.ts` | `price-crosses-up.block.spec.ts` |
| Integration | `.integration.spec.ts` | `engine.integration.spec.ts` |
| E2E | `.e2e.spec.ts` | `trading-flow.e2e.spec.ts` |

### Standard test file structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PriceCrossesUpEvaluator', () => {
  // ── Setup ──────────────────────────────────────────────────────────────
  let evaluator: PriceCrossesUpEvaluator;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = createMockRedis();
    evaluator = new PriceCrossesUpEvaluator(mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────
  describe('when price crosses above threshold', () => {
    it('fires when previous price was below and current is above', async () => {
      mockRedis.getPreviousPrice.mockResolvedValue('0.40');
      mockRedis.getCurrentPrice.mockResolvedValue('0.55');

      const result = await evaluator.evaluate(
        { type: BlockType.PRICE_CROSSES_UP, config: { tokenId: 'tok1', threshold: '0.50' }},
        mockContext()
      );

      expect(result.fired).toBe(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────
  describe('when price is exactly at threshold', () => {
    it('does not fire on exact match (requires strict crossing)', async () => { ... });
  });

  // ── Failure paths ──────────────────────────────────────────────────────
  describe('when data is unavailable', () => {
    it('returns fired=false when price cache is empty', async () => {
      mockRedis.getCurrentPrice.mockResolvedValue(null);
      const result = await evaluator.evaluate(...);
      expect(result.fired).toBe(false);
      expect(result.reason).toBe('no_price_data');
    });
  });
});
```

### Testing Angular components with the generated API client

Angular component tests must mock the generated API services — never mock `HttpClient` directly.

```typescript
// apps/user-app/src/app/strategies/strategy-list.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { StrategiesService } from '../api/services/strategies.service';
import { StrategyListComponent } from './strategy-list.component';
import { of } from 'rxjs';

describe('StrategyListComponent', () => {
  let mockStrategiesApi: Partial<StrategiesService>;

  beforeEach(() => {
    mockStrategiesApi = {
      listStrategies: vi.fn().mockReturnValue(of({
        data: [strategyFactory(), strategyFactory()],
        total: 2, page: 1, limit: 20, totalPages: 1, hasNext: false,
      })),
    };

    TestBed.configureTestingModule({
      declarations: [StrategyListComponent],
      providers: [
        { provide: StrategiesService, useValue: mockStrategiesApi },
      ],
    });
  });

  it('renders the strategy list on init', () => {
    const fixture = TestBed.createComponent(StrategyListComponent);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.strategy-card');
    expect(items.length).toBe(2);
    expect(mockStrategiesApi.listStrategies).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
```

> **Rule:** Provide the generated service as a mock in `providers` — never spy on `HttpClient`. The generated service is the contract; testing against it ensures tests break when the contract changes.

---

## 3. Unit Testing Patterns

### Mocking Redis

Never use a real Redis connection in unit tests. Create a mock factory:

```typescript
// test/helpers/mock-redis.ts
export function createMockRedis(): MockRedisService {
  return {
    getJson:  vi.fn().mockResolvedValue(null),
    setJson:  vi.fn().mockResolvedValue('OK'),
    get:      vi.fn().mockResolvedValue(null),
    set:      vi.fn().mockResolvedValue('OK'),
    del:      vi.fn().mockResolvedValue(1),
    getFloat: vi.fn().mockResolvedValue(null),
    setFloat: vi.fn().mockResolvedValue('OK'),
    publish:  vi.fn().mockResolvedValue(undefined),
    expire:   vi.fn().mockResolvedValue(1),
  } as unknown as MockRedisService;
}
```

### Mocking Prisma

```typescript
// test/helpers/mock-db.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

export type MockDb = DeepMockProxy<PrismaClient>;
export function createMockDb(): MockDb { return mockDeep<PrismaClient>(); }
```

### Required test cases for every block evaluator

```typescript
describe('MinLiquidityBlock', () => {
  it('passes when book liquidity exceeds minimum');          // fires correctly
  it('fails when book liquidity is below minimum');          // does not fire
  it('passes when liquidity exactly equals minimum');        // boundary
  it('fails gracefully when order book cache is empty');     // missing data
  it('includes liquidity values in failure reason');         // debugging info
});
```

### Testing P&L calculations

P&L logic must be tested with exact decimal precision — floating-point errors are real:

```typescript
describe('PnlCalculator', () => {
  it('calculates realized P&L correctly on full close', () => {
    const result = calculateRealizedPnl({
      entryPrice: '0.42', exitPrice: '0.78', size: '100', fee: '0.50',
    });
    expect(result).toBe('35.50');  // (0.78 - 0.42) * 100 - 0.50
  });

  it('never produces floating-point imprecision', () => {
    // Classic JS float trap: 0.1 + 0.2 = 0.30000000000000004
    const result = calculateRealizedPnl({
      entryPrice: '0.10', exitPrice: '0.20', size: '100', fee: '0',
    });
    expect(result).toBe('10.00');  // not '9.999999999999998'
  });
});
```

### Testing AES-256-GCM encryption

```typescript
describe('EncryptionService', () => {
  const masterKey = Buffer.from('0'.repeat(64), 'hex');

  it('encrypts and decrypts round-trip correctly');
  it('generates a unique IV on every encryption');
  it('throws when ciphertext is tampered with');
  it('throws when auth tag is tampered with');
  it('wipes key material from memory after use');
});
```

---

## 4. Integration Testing

Integration tests run against a real (test) Postgres + Redis. They test the full stack within a service: HTTP request → controller → service → DB → HTTP response.

### Setup pattern

```typescript
// test/setup.ts
export async function setupTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  await app.init();
  const prisma = module.get(PrismaService);

  return { app, prisma };
}

// Clean DB between tests — TRUNCATE, not DROP
export async function cleanDb(prisma: PrismaService) {
  await prisma.$executeRaw`TRUNCATE TABLE
    auth.users, trading.strategies, trading.orders
    RESTART IDENTITY CASCADE`;
}
```

### Integration test example — auth-service

```typescript
describe('POST /auth/v1/register', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/v1/register')
      .send({ email: 'test@example.com', password: 'Test1234!', username: 'testuser', tosAccepted: true })
      .expect(201);

    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();  // never return password hash
  });

  it('hashes the password before storing', async () => {
    await request(app.getHttpServer())
      .post('/auth/v1/register')
      .send({ email: 'test@example.com', password: 'Test1234!', username: 'testuser', tosAccepted: true });

    const user = await prisma.user.findUnique({ where: { email: 'test@example.com' }});
    expect(user.passwordHash).toMatch(/^\$2b\$/);  // bcrypt prefix
  });

  it('rejects duplicate email with 409');
  it('rejects when tosAccepted is false with 400');
  it('rejects weak passwords with 400');
});
```

---

## 5. Testing Stream Consumers

Stream consumers run as background loops. Expose a `processMessage()` method and test it directly:

```typescript
// services/order-service/src/consumers/order.consumer.ts
@Injectable()
export class OrderConsumer {
  // Public for testing — the Redis subscription calls this internally
  async processMessage(message: StreamMessage): Promise<void> {
    const intent = OrderIntentSchema.parse(JSON.parse(message.data));
    await this.submitOrder(intent);
  }
}
```

```typescript
// order.consumer.spec.ts
describe('OrderConsumer', () => {
  it('submits the order to signer-service', async () => {
    const message = { id: '1-0', data: JSON.stringify(orderIntentFactory()) };
    await consumer.processMessage(message);
    expect(mockSigner.signOrder).toHaveBeenCalledTimes(1);
  });

  it('moves to DLQ after 3 failed attempts', async () => {
    mockSigner.signOrder.mockRejectedValue(new Error('signer unavailable'));
    const message = { ...baseMessage, attempts: 3 };
    await consumer.processMessage(message);
    expect(mockDlq.push).toHaveBeenCalledTimes(1);
  });

  it('does NOT ack the message when processing fails', async () => {
    mockSigner.signOrder.mockRejectedValue(new Error());
    await consumer.processMessage(baseMessage);
    expect(mockRedis.xack).not.toHaveBeenCalled();
  });
});
```

---

## 6. Testing WebSocket Handlers

```typescript
// test/ws.integration.spec.ts
describe('WebSocket Gateway', () => {
  it('accepts connection with valid JWT', (done) => {
    const socket = io(`ws://localhost:3002`, {
      transports: ['websocket'],
      auth: { token: `Bearer ${validJwt}` },
    });
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
  });

  it('sends AUTH_ERROR and closes if JWT is invalid', (done) => {
    const badSocket = io('ws://localhost:3002', {
      transports: ['websocket'],
      auth: { token: 'Bearer totally-invalid-token' },
    });
    badSocket.on('AUTH_ERROR', () => done());
  });
});
```

---

## 7. Test Data Factories

Never hardcode test data inline. Use factory functions with sane defaults and easy overrides.

```typescript
// test/factories/index.ts
export function userFactory(overrides: Partial<User> = {}): User {
  return {
    id:                  faker.string.uuid(),
    email:               faker.internet.email(),
    username:            faker.internet.username().toLowerCase().slice(0, 20),
    emailVerified:       true,
    polymarketConnected: false,
    tosAcceptedAt:       new Date(),
    suspended:           false,
    deleted:             false,
    createdAt:           new Date(),
    ...overrides,
  };
}

export function strategyFactory(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id:          faker.string.uuid(),
    userId:      faker.string.uuid(),
    name:        `Test Strategy ${faker.number.int(999)}`,
    visibility:  Visibility.PRIVATE,
    execMode:    ExecMode.TICK,
    tickMs:      1000,
    triggers:    [priceCrossesUpBlockFactory()],
    conditions:  [minLiquidityBlockFactory()],
    actions:     [buyYesBlockFactory()],
    safety:      [stopIfDailyLossBlockFactory()],
    status:      StrategyStatus.IDLE,
    version:     1,
    forkCount:   0,
    likeCount:   0,
    template:    false,
    createdAt:   new Date(),
    updatedAt:   new Date(),
    ...overrides,
  };
}

export function orderIntentFactory(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId:   faker.string.uuid(),
    userId:     faker.string.uuid(),
    strategyId: faker.string.uuid(),
    tokenId:    faker.string.alphanumeric(64),
    side:       OrderSide.BUY,
    size:       '100',
    price:      '0.55',
    orderType:  OrderType.GTC,
    timestamp:  Date.now(),
    ...overrides,
  };
}
```

**Usage — override only what matters for the test:**

```typescript
it('rejects orders for suspended users', async () => {
  const user = userFactory({ suspended: true });  // only this matters
  const intent = orderIntentFactory({ userId: user.id });
  ...
});
```

---

## 8. Coverage Requirements

```typescript
// vitest.config.ts (each service) — standard template
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',       // NestJS boilerplate
        'src/main.ts',
        'src/**/*.dto.ts',          // data classes (no logic)
        'src/**/*.controller.ts',   // thin HTTP adapters — service logic is fully tested
        'test/**',
      ],
      thresholds: {
        lines: 80, functions: 80, branches: 75, statements: 80,
      },
    },
  },
});
```

### Enforced thresholds per service

| Service | Lines | Functions | Branches | Rationale |
|---|---|---|---|---|
| auth-service | 85% | 85% | 75% | Security-critical — auth flows |
| admin-auth-service | 85% | 85% | 75% | Security-critical — admin auth |
| signer-service | 85% | 85% | 65% | Security-critical; some EIP-712 paths need CLOB client |
| order-service | 85% | 85% | 75% | Financial operations — order lifecycle |
| api-service | 80% | 80% | 75% | Standard — controllers excluded |
| admin-api-service | 80% | 80% | 80% | Standard — controllers excluded |
| notification-service | 75% | 75% | 70% | Integration-heavy (SMTP, external) |
| paper-order-service | 75% | 75% | 70% | Standard |
| strategy-engine | 45% | 38% | 44% | `evaluator.ts` and block registry need dedicated tests (tracked) |
| backtest-service | 38% | 65% | 55% | `evaluator.ts` (382 lines) not yet unit-tested (tracked) |
| bot-service | — | — | — | No spec files yet (`passWithNoTests: true`) |

> **Note:** strategy-engine and backtest-service thresholds are intentionally low while dedicated evaluator tests are pending. These are tracked as improvement items. Target is 80% once evaluator tests are written.

CI pipeline fails if coverage drops below thresholds.

### Ticket system test patterns

The support ticket system follows the same testing approach as other modules, with some specific patterns:

```typescript
// api-service: tickets.service.spec.ts — 16 tests
describe('TicketsService', () => {
  // Transaction testing — ticket + first message created atomically
  it('creates ticket and first message in a transaction');
  it('emits TICKET_CREATED event to stream:events');
  it('defaults category to GENERAL when not specified');

  // Ownership — users can only see their own tickets
  it('lists only tickets belonging to the requesting user');
  it('returns 403 when accessing another user ticket');

  // Status transitions
  it('sets status to AWAITING_ADMIN when user replies');
  it('rejects reply on CLOSED ticket with 403');
  it('clears reminderSentAt when user replies');
});

// admin-api-service: tickets.service.spec.ts — 25 tests
describe('AdminTicketsService', () => {
  // Cross-DB name resolution
  it('resolves admin UUIDs to display names from admin DB');
  it('handles null assignedTo gracefully');

  // Auto-assignment
  it('auto-assigns ticket to replying admin if unassigned');
  it('keeps existing assignment when admin replies');

  // Closing
  it('sets closedBy and closedAt when status changes to CLOSED');
  it('emits TICKET_CLOSED event only on close');
});

// admin-api-service: ticket-reminder.service.spec.ts — 7 tests
describe('TicketReminderService', () => {
  it('no-op when no stale tickets exist');
  it('sends reminder email for stale AWAITING_USER tickets');
  it('updates reminderSentAt after sending');
  it('reads configurable hours from Redis');
  it('defaults to 48h when Redis key is unset');
  it('continues processing if one email fails');
  it('processes multiple stale tickets in batch');
});
```

**E2E ticket tests** follow the same Playwright patterns as other features. The ticket E2E tests verify the full flow: create ticket as user, reply as admin, verify status transitions and notification delivery.

### OnPush change detection

Key Angular components use `ChangeDetectionStrategy.OnPush` to reduce unnecessary re-renders. When testing OnPush components:

```typescript
// Trigger change detection explicitly after async operations
fixture.detectChanges();

// For signal-based state, update the signal and then detect changes
component.someSignal.set(newValue);
fixture.detectChanges();

// For observable-driven components, ensure the mock emits before detectChanges
mockService.getData.mockReturnValue(of(testData));
fixture.detectChanges();
```

OnPush components only re-render when their `@Input()` references change, a signal updates, or an observable emits through the `async` pipe. Tests must account for this by explicitly triggering change detection after state changes.

### Recent test file additions

The following test files were added as part of the design polish and interactivity work:

- `rankMedal` — leaderboard medal icon logic (gold/silver/bronze for top 3)
- `categoryColor` — market category badge color mapping (6 categories)
- `pnlColor` — P&L color-coding logic (green positive, red negative)
- `breadcrumb routing` — topbar title extraction from route config
- `statusBadge` — user status badge styling (color by status)

These 28 test cases cover pure utility functions and follow the standard pattern: test the happy path, boundary values, and edge cases (unknown/null inputs).

### Security audit test additions (27 tests)

The security audit (rounds 4-7) added 27 targeted tests covering security-critical behaviors:

| Area | Tests | What they verify |
|---|---|---|
| Password reset token revocation | 3 | Tokens invalidated after password change |
| Logout cookie cleanup | 5 | Session cookies cleared on logout, cross-browser coverage |
| Admin `RolesGuard` | 7 | Role-based access control on admin endpoints |
| Self-follow prevention | 3 | Users cannot follow themselves |
| Login history | 3 | `UserLoginHistory` populated on success and failure |
| Encryption key validation | 6 | AES-256-GCM key format, length, and error handling |

These tests complement the existing security hardening from v3.1.0 (SQL injection, JWT, TOTP, Redis auth, WebSocket origin validation) and bring the total security-focused test count to 36+.

### E2E testing with React (v3.0+)

After the Angular-to-React migration, E2E tests use Playwright against the React SPAs. Key differences from the Angular E2E setup:

- **No PrimeNG locators** — React apps use shadcn/ui components; selectors target `data-testid`, `role`, and semantic HTML instead of `.pi-*` icon classes
- **StrictMode considerations** — React 19 StrictMode causes double-mounting in development; E2E tests run against production builds where this does not apply
- **React Router navigation** — `waitForURL` patterns account for client-side routing via React Router v7 instead of Angular Router
- **Sonner toasts** — Toast assertions target Sonner's DOM structure instead of PrimeNG Toast

The CI pipeline structure remains the same: Lint -> Typecheck -> Test -> Build -> E2E (Chromium-only).

---

## 9. Error Handling

### Never swallow errors silently

```typescript
// ❌ BAD — error disappears
try {
  await submitOrder(intent);
} catch (e) {}

// ✅ GOOD — handle explicitly
try {
  await submitOrder(intent);
} catch (e) {
  this.logger.error({ intentId: intent.intentId, error: e.message }, 'Order submission failed');
  await this.moveToDeadLetterQueue(intent, e.message);
  throw e;
}
```

### Use the correct NestJS exception class

```typescript
import {
  BadRequestException,             // 400 — invalid input
  UnauthorizedException,           // 401 — not authenticated
  ForbiddenException,              // 403 — authenticated but not allowed
  NotFoundException,               // 404 — resource doesn't exist
  ConflictException,               // 409 — duplicate / state conflict
  UnprocessableEntityException,    // 422 — valid format, rejected by business rules
  TooManyRequestsException,        // 429 — rate limited
  InternalServerErrorException,    // 500 — unexpected, never throw intentionally
} from '@nestjs/common';
```

### Standard error response shape

```typescript
// shared-types
export interface ApiError {
  statusCode: number;
  code:       string;   // machine-readable — e.g. 'ORDER_EXCEEDS_LIMIT'
  message:    string;   // human-readable
  field?:     string;   // for validation errors
  requestId?: string;
}
```

### Classify external service errors

```typescript
async submitToClob(order: SignedOrder): Promise<ClobResponse> {
  try {
    return await this.clobClient.post('/order', order);
  } catch (e) {
    if (e.status === 429) throw new ClobRateLimitError(e.message);   // retry with backoff
    if (e.status === 503) throw new ClobUnavailableError(e.message); // retry with backoff
    if (e.status === 400) throw new ClobRejectionError(e.message);   // permanent — go to DLQ
    throw new ClobUnknownError(e.message);
  }
}
```

---

## 10. Logging Practices

### What to log — and what not to

```typescript
// ✅ LOG — operational events
this.logger.info({ strategyId, userId, status: 'started' }, 'Strategy started');
this.logger.warn({ intentId, attempts }, 'Order retry attempt');
this.logger.error({ requestId, error: e.message }, 'CLOB submission failed');

// ❌ NEVER LOG — sensitive data
this.logger.info({ privateKey });    // NEVER
this.logger.info({ apiSecret });     // NEVER
this.logger.info({ password });      // NEVER
this.logger.info({ totp_secret });   // NEVER
this.logger.debug({ user });         // DANGER — may contain password hash
this.logger.info(request.body);      // DANGER — may contain credentials
```

### Log levels

| Level | When to use |
|---|---|
| `error` | Unhandled exceptions, service failures, DLQ events |
| `warn` | Retries, rate limit warnings, stale cache, validation failures |
| `info` | Service lifecycle, significant state changes (strategy started, order filled) |
| `debug` | Per-tick evaluations, cache hits/misses — **dev only** |

### Structured logging — always objects, never string interpolation

```typescript
// ❌ BAD — hard to query in CloudWatch
this.logger.info(`Strategy ${strategyId} for user ${userId} stopped because ${reason}`);

// ✅ GOOD — every field is searchable
this.logger.info({ strategyId, userId, reason, stoppedAt: new Date().toISOString() }, 'Strategy stopped');
```

---

## 11. Security Practices

### Validate at the boundary, trust inside

```typescript
@Post('orders')
@UseGuards(UserJwtGuard)
async placeOrder(@Body() rawBody: unknown, @CurrentUser() user: JwtPayload) {
  const body = PlaceOrderSchema.parse(rawBody);  // throws 400 if invalid
  return this.ordersService.placeOrder(user.sub, body);
}
```

### Never trust `userId` from the request body

```typescript
// ❌ BAD — user can submit any userId
async placeOrder(@Body() body: { userId: string; ... }) {
  await this.ordersService.placeOrder(body.userId, body);
}

// ✅ GOOD — userId comes from the verified JWT
async placeOrder(@Body() rawBody: unknown, @CurrentUser() user: JwtPayload) {
  const body = PlaceOrderSchema.parse(rawBody);
  await this.ordersService.placeOrder(user.sub, body);
}
```

### Always verify resource ownership

```typescript
async getStrategy(userId: string, strategyId: string) {
  const strategy = await this.db.strategy.findUnique({ where: { id: strategyId }});
  if (!strategy) throw new NotFoundException('Strategy not found');
  if (strategy.userId !== userId) throw new ForbiddenException();  // CRITICAL
  return strategy;
}
```

### Rate limiting on every public endpoint

```typescript
@UseGuards(UserJwtGuard, RateLimitGuard)
@RateLimit({ windowMs: 60_000, max: 30 })   // writes
@RateLimit({ windowMs: 60_000, max: 200 })  // reads
@RateLimit({ windowMs: 3_600_000, max: 3 }) // credential import
```

### Fetch secrets from AWS Secrets Manager at boot

```typescript
@Injectable()
export class SecretsService implements OnApplicationBootstrap {
  private masterKey: Buffer;

  async onApplicationBootstrap() {
    const secret = await this.secretsManager.getSecretValue({
      SecretId: 'polyforge/MASTER_ENCRYPTION_KEY'
    });
    this.masterKey = Buffer.from(secret.SecretString, 'hex');
    this.logger.info('Master encryption key loaded');
    // DO NOT log the key value
  }
}
```

### Testing timing-safe comparison (TOTP)

TOTP verification must use constant-time comparison to prevent timing attacks. Tests should verify that the comparison function does not short-circuit on the first mismatched character.

```typescript
describe('TOTP verification', () => {
  it('uses timing-safe comparison for token validation', () => {
    // Verify crypto.timingSafeEqual is used, not === or localeCompare
    const validToken = generateTOTP(secret);
    const result = verifyTOTP(secret, validToken);
    expect(result).toBe(true);
  });

  it('rejects expired TOTP tokens', () => {
    vi.useFakeTimers();
    const token = generateTOTP(secret);
    vi.advanceTimersByTime(31_000); // past 30s window
    expect(verifyTOTP(secret, token)).toBe(false);
  });
});
```

### Testing Redis authentication

Integration tests must verify that Redis connections require authentication. Unauthenticated connections should be rejected.

```typescript
describe('Redis authentication', () => {
  it('rejects connections without a password', async () => {
    const unauthClient = new Redis({ host: 'localhost', port: 6379 });
    await expect(unauthClient.ping()).rejects.toThrow(/NOAUTH/);
    unauthClient.disconnect();
  });

  it('accepts connections with valid password', async () => {
    const authClient = new Redis({ host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD });
    const result = await authClient.ping();
    expect(result).toBe('PONG');
    authClient.disconnect();
  });
});
```

### Testing DTO validation on notification inputs

Notification service inputs must be validated with strict DTOs. Tests should verify that malformed payloads are rejected before processing.

```typescript
describe('Notification DTO validation', () => {
  it('rejects notification with missing required fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications')
      .send({ /* missing title, userId, type */ })
      .expect(400);

    expect(response.body.message).toContain('validation');
  });

  it('rejects notification with invalid severity value', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications')
      .send({ userId: 'user1', title: 'Test', type: 'ALERT', severity: 'INVALID' })
      .expect(400);
  });
});
```

---

## 12. Money & Decimal Arithmetic

**This is the single most important technical rule in the codebase.** JavaScript floating-point cannot represent most decimal fractions exactly.

```javascript
0.1 + 0.2 === 0.30000000000000004   // TRUE in JavaScript
```

### The rule: all monetary values are strings; all arithmetic uses decimal.js

```typescript
import Decimal from 'decimal.js';

// ❌ NEVER — float arithmetic
const pnl = (exitPrice - entryPrice) * size - fee;

// ❌ NEVER — parseFloat in financial calculations
const price = parseFloat(priceString);

// ✅ ALWAYS — decimal.js for all monetary arithmetic
const pnl = new Decimal(exitPrice)
  .minus(entryPrice)
  .times(size)
  .minus(fee)
  .toFixed(2);  // returns string '35.50'
```

### Global decimal.js configuration

```typescript
// packages/shared-types/src/decimal.config.ts
import Decimal from 'decimal.js';

Decimal.set({
  precision: 28,
  rounding:  Decimal.ROUND_HALF_UP,
  toExpNeg:  -9,
  toExpPos:  28,
});
```

### P&L helpers in `shared-types`

```typescript
export function calculatePnl(entry: string, exit: string, size: string, fee: string): string {
  return new Decimal(exit).minus(entry).times(size).minus(fee).toFixed(6);
}

export function calculateUnrealizedPnl(avgEntry: string, currentPrice: string, size: string): string {
  return new Decimal(currentPrice).minus(avgEntry).times(size).toFixed(6);
}
```

---

## 13. Redis Practices

### Every cache key must have a TTL

```typescript
// ❌ BAD — key lives forever, Redis fills up
await redis.set('cache:price:tok1', JSON.stringify(data));

// ✅ GOOD
await redis.set('cache:price:tok1', JSON.stringify(data), 'EX', 1);
```

### Cache-aside pattern

```typescript
async getMarket(marketId: string): Promise<Market> {
  const cached = await this.redis.getJson<Market>(`cache:market:${marketId}`);
  if (cached) return cached;

  const market = await this.db.market.findUnique({ where: { id: marketId }});
  if (!market) throw new NotFoundException();

  await this.redis.setJson(`cache:market:${marketId}`, market, 120);
  return market;
}
```

### Never store sensitive data in Redis

```typescript
// ❌ NEVER — visible to anyone with Redis access
await redis.set(`user:${userId}:privateKey`, privateKey);
```

### Consumer groups — ACK only on success

```typescript
for (const message of messages) {
  try {
    await this.processMessage(message);
    await redis.xack('stream:orders', 'order-service', message.id); // ✅ ACK after success
  } catch (e) {
    // ❌ Do NOT ack on failure — message will be retried
    this.logger.error({ messageId: message.id, error: e.message }, 'Message processing failed');
  }
}
```

---

## 14. Database Practices

### Avoid N+1 queries

```typescript
// ❌ BAD
const strategies = await prisma.strategy.findMany();
for (const s of strategies) {
  s.user = await prisma.user.findUnique({ where: { id: s.userId }});
}

// ✅ GOOD
const strategies = await prisma.strategy.findMany({
  include: { user: { select: { username: true, displayName: true }}}
});
```

### Use `select` — never return full rows to the API

```typescript
// ❌ BAD — returns passwordHash, totpSecret, etc.
const user = await prisma.user.findUnique({ where: { id: userId }});
return user;

// ✅ GOOD
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, username: true, displayName: true, polymarketConnected: true }
});
```

### Use transactions for multi-step operations

```typescript
async forkStrategy(userId: string, sourceId: string) {
  return await prisma.$transaction(async (tx) => {
    await tx.strategy.update({ where: { id: sourceId }, data: { forkCount: { increment: 1 }}});
    const fork = await tx.strategy.create({ data: { ...sourceStrategy, userId, forkCount: 0 }});
    await tx.strategyFork.create({ data: { originalId: sourceId, forkId: fork.id, forkedBy: userId }});
    return fork;
  });
}
```

### Soft deletes — never hard-delete user data

```typescript
// ❌ BAD — unrecoverable
await prisma.strategy.delete({ where: { id: strategyId }});

// ✅ GOOD
await prisma.strategy.update({
  where: { id: strategyId },
  data: { status: StrategyStatus.ARCHIVED, deletedAt: new Date() }
});
```

---

## 15. Order Idempotency

Every order submission must be idempotent. The `intent_id` is the idempotency key.

```typescript
async submitOrder(intent: OrderIntent): Promise<Order> {
  // Check if already processed
  const existing = await this.db.order.findUnique({
    where: { intentId: intent.intentId }
  });
  if (existing) {
    this.logger.warn({ intentId: intent.intentId }, 'Duplicate order intent — skipping');
    return existing;
  }

  // Create with PENDING status first
  const order = await this.db.order.create({
    data: { intentId: intent.intentId, status: OrderStatus.PENDING, ...orderData }
  });

  try {
    const signed = await this.signer.signOrder(order);
    const result = await this.clob.submitOrder(signed);
    return await this.db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SUBMITTED, clobOrderId: result.orderId }
    });
  } catch (e) {
    await this.db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.ERROR, errorMessage: e.message }
    });
    throw e;
  }
}
```

---

## 16. Strategy Engine Practices

### Tick interval floor — enforce 200ms minimum

```typescript
const tickMs = Math.max(strategy.tickMs, MIN_TICK_MS);  // MIN_TICK_MS = 200
if (strategy.tickMs < MIN_TICK_MS) {
  this.logger.warn({ strategyId, requestedTickMs: strategy.tickMs }, 'Enforcing tick floor');
}
```

### Safety blocks are always evaluated first — this is not optional

```typescript
async evaluateTick(strategy: Strategy, ctx: EvalContext): Promise<TickResult> {
  // 1. Safety — first, always
  for (const block of strategy.safety) {
    const result = await this.evaluate(block, ctx);
    if (!result.passed) {
      await this.stopStrategy(strategy.id, `Safety block: ${result.reason}`);
      return { action: 'stopped' };
    }
  }

  // 2. Triggers
  const anyTriggerFired = await this.evaluateTriggers(strategy.triggers, ctx);
  if (!anyTriggerFired) return { action: 'skipped', reason: 'no_trigger' };

  // 3. Conditions
  const allConditionsPassed = await this.evaluateConditions(strategy.conditions, ctx);
  if (!allConditionsPassed) return { action: 'skipped', reason: 'condition_failed' };

  // 4. Actions
  return await this.evaluateActions(strategy.actions, ctx);
}
```

---

## 17. API Design Practices

### All list endpoints are paginated

```typescript
export interface PaginatedResponse<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
}

// Enforce max page size
const safeLimit = Math.min(limit, 100);
```

### Never return bare arrays from list endpoints

```typescript
// ❌ BAD
return strategies;

// ✅ GOOD
return { data: strategies, total: count, page, limit, totalPages: Math.ceil(count / limit), hasNext: page * limit < count };
```

---

## 18. Performance Practices

### Indexes on every FK and common filter

```typescript
// Prisma schema
model Order {
  @@index([userId])
  @@index([strategyId])
  @@index([status])
  @@index([userId, createdAt])
  @@index([intentId], { unique: true })
}
```

### Stream price history for backtest — never load all rows into memory

```typescript
async *streamPriceHistory(tokenId: string, from: Date, to: Date) {
  let cursor: string | undefined;

  while (true) {
    const chunk = await prisma.$queryRaw<PriceRow[]>`
      SELECT time, price FROM analytics.price_history
      WHERE token_id = ${tokenId}
        AND time >= ${from} AND time <= ${to}
        ${cursor ? Prisma.sql`AND time > ${cursor}` : Prisma.empty}
      ORDER BY time ASC LIMIT ${CHUNK_SIZE}
    `;
    if (chunk.length === 0) break;
    yield chunk;
    cursor = chunk[chunk.length - 1].time;
  }
}
```

---

## 19. Deployment Practices

### Health check before accepting traffic

```typescript
@Controller('health')
export class HealthController {
  private ready = false;

  async onApplicationBootstrap() {
    await this.waitForDb();
    await this.waitForRedis();
    await this.loadSecretsFromAws();  // signer-service only
    this.ready = true;
  }

  @Get()
  check() {
    if (!this.ready) throw new ServiceUnavailableException('Service initialising');
    return { status: 'healthy' };
  }
}
```

### Database migrations must be backward-compatible

Migrations run before new code deploys. The old code is still running during the window between migration and deployment.

Rules:
1. **Never rename a column directly** — add new column → backfill → update code → remove old in a later migration
2. **Never remove a column** without first making it optional in the ORM and removing all code references
3. **Never add a NOT NULL column without a default**

```sql
-- ❌ BAD — breaks old service immediately
ALTER TABLE orders ADD COLUMN priority INT NOT NULL;

-- ✅ GOOD — backward compatible
ALTER TABLE orders ADD COLUMN priority INT DEFAULT 0;
```

---

## 20. Code Review Checklist

### Security
- [ ] No credentials, secrets, or API keys in code or logs
- [ ] All new endpoints have JWT guard
- [ ] All new endpoints validate request body with Zod
- [ ] Resource ownership checked before returning data
- [ ] No raw SQL string concatenation
- [ ] `userId` always comes from JWT, never from request body

### Data integrity
- [ ] All monetary values are strings, using decimal.js for arithmetic
- [ ] Multi-step DB operations use `prisma.$transaction`
- [ ] New list endpoints are paginated
- [ ] New DB operations use `select` to avoid over-fetching

### Redis
- [ ] All new cache keys have explicit TTL
- [ ] Consumer group processing ACKs only on success
- [ ] No sensitive data stored in Redis

### Testing
- [ ] New block evaluators have unit tests: fires correctly, does not fire, handles missing data
- [ ] New API endpoints have integration tests: happy path, auth required, ownership check, validation errors
- [ ] Coverage does not drop below thresholds

### Observability
- [ ] New service operations emit the correct `stream:events` event type
- [ ] Errors logged with structured fields, not string interpolation
- [ ] No `console.log` — uses `PinoLogger`

### Database
- [ ] New columns have appropriate indexes
- [ ] Migration is backward-compatible
- [ ] No N+1 queries
- [ ] Soft delete used instead of hard delete for user data

### OpenAPI / Code generation
- [ ] New endpoints / DTOs have `@ApiProperty` and `@ApiResponse` decorators
- [ ] `npm run generate:api` was run and generated files are committed
- [ ] `npm run typecheck` passes in both Angular apps

---

*Previous: [Database & Redis](./04-database-and-redis.md) | Next: [API Catalog](./06-api-catalog.md)*
