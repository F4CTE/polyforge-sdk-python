# Polyforge — Codebase Guide

> How to work with the codebase: adding features, running tests, debugging.

---

## Table of Contents

1. [How a Feature Flows](#1-how-a-feature-flows)
2. [Shared Packages — The Foundation](#2-shared-packages--the-foundation)
3. [Adding a New Strategy Block](#3-adding-a-new-strategy-block)
4. [Adding a New API Endpoint](#4-adding-a-new-api-endpoint)
5. [Running Tests](#5-running-tests)
6. [Debugging](#6-debugging)
7. [Database Schema Changes (Prisma)](#7-database-schema-changes-prisma)
8. [Code Style & Conventions](#8-code-style--conventions)

---

## 1. How a Feature Flows

Trace a concrete example to understand how everything connects: **a user starts a strategy**.

```
1. User clicks "Start" in user-app (Angular)
   └─► POST /api/v1/strategies/:id/start  (api-service)

2. api-service validates JWT, calls strategy-engine
   └─► POST http://strategy-engine:3006/internal/strategies/:id/start
       (with internal service JWT)

3. strategy-engine loads strategy from DB
   └─► Fetches strategy blocks from Postgres via Prisma
   └─► Loads or creates strategy state from Redis

4. strategy-engine starts tick loop (if TICK/HYBRID mode)
   └─► Every tickMs: evaluate SAFETY → TRIGGERS → CONDITIONS → ACTIONS
   └─► On action: publish OrderIntent to stream:orders

5. order-service consumes stream:orders
   └─► Calls signer-service to sign the order
   └─► Submits to Polymarket CLOB API
   └─► Emits ORDER_PLACED to stream:events

6. api-service consumes stream:events
   └─► Finds connected WebSocket clients for this userId
   └─► Pushes ORDER_PLACED message to their browser

7. user-app receives WebSocket message
   └─► Updates the portfolio/orders UI in real-time
```

### Example 2: A user creates a support ticket

```
1. User fills out support form in user-app (Angular)
   └─► POST /api/v1/tickets  (api-service)

2. api-service validates JWT, creates ticket + first message in a transaction
   └─► INSERT into tickets + ticket_messages (Prisma $transaction)
   └─► Publish TICKET_CREATED to stream:events

3. notification-service consumes TICKET_CREATED
   └─► Sends confirmation email to user (if onTicketReply enabled)
   └─► Pushes in-app NOTIFICATION to stream:events

4. Admin opens ticket in admin-app, replies
   └─► POST /api/v1/tickets/:id/messages  (admin-api-service)
   └─► Auto-assigns ticket to replying admin if unassigned
   └─► Sets ticket status to AWAITING_USER
   └─► Publishes TICKET_REPLY to stream:events
   └─► Audit logged

5. api-service relays TICKET_REPLY via WebSocket to user
   └─► user-app shows notification bell update

6. If user doesn't reply within 48h:
   └─► admin-api-service reminder cron detects stale ticket
   └─► Sends branded reminder email with "View your ticket" CTA
   └─► Sets reminderSentAt to prevent repeat reminders
```

---

## 2. Shared Packages — The Foundation

Everything starts in `packages/`. Before touching any service, understand these packages. **Never bypass them.**

### `shared-types`

Every TypeScript interface in the system lives here. Never define a type in a service if it crosses a service boundary.

```typescript
// packages/shared-types/src/index.ts
export interface OrderIntent {
  intentId:   string;
  userId:     string;
  strategyId: string | null;
  tokenId:    string;
  side:       OrderSide;
  size:       string;      // decimal string — NEVER float
  price:      string;
  orderType:  OrderType;
  timestamp:  number;
}
```

### `shared-schemas`

Zod schemas for all API request/response validation. Services import these for type-safe request parsing.

```typescript
// packages/shared-schemas/src/order.schema.ts
export const PlaceOrderSchema = z.object({
  tokenId:   z.string().min(1),
  side:      z.enum(['BUY', 'SELL']),
  size:      z.string().regex(/^\d+\.?\d*$/),  // decimal string
  price:     z.string().regex(/^0\.\d+$/),      // 0.xx format
  orderType: z.enum(['GTC', 'GTD', 'FOK', 'FAK']),
});
```

### `shared-redis`

All Redis operations go through this package. **Never instantiate `new Redis()` directly in a service.**

```typescript
// Usage in any service:
import { RedisService, StreamService } from '@polyforge/shared-redis';

// Publish to a stream:
await streamService.publish('stream:events', {
  event_type: 'ORDER_FILLED',
  userId,
  orderId,
  fillPrice,
});

// Read from cache:
const price = await redisService.getJson<PriceData>(`cache:price:${tokenId}`);
```

### `shared-auth`

JWT guards and internal service client. Use `@UseGuards(JwtAuthGuard)` and `InternalServiceClient` from here — never reimplement JWT validation.

#### API Key Authentication Flow

1. User generates a key in **Settings → API Keys** tab
2. External tool sends `Authorization: Bearer pf_...` header
3. `JwtAuthGuard` detects the `pf_` prefix, SHA256 hashes the token, and looks up the hash in the database
4. Sets `request.user` (the key's owner) + `request.apiKeyMeta` (key id, scopes, expiry)
5. `ApiKeyScopeGuard` checks required scopes via the `@RequireScopes()` decorator on the controller method

### `shared-db`

Prisma client as a NestJS module. Use `@InjectDb()` from this package — never instantiate Prisma directly.

### `logger`

pino + nestjs-pino. Use `@InjectPinoLogger()` from this package — **never `console.log`**.

---

## 3. Adding a New Strategy Block

This is the most common extension point. Follow every step in order.

### Example: Adding a `volume_spike` trigger block

**Step 1 — Define the block type in `shared-types`:**

```typescript
// packages/shared-types/src/blocks.ts

export enum BlockType {
  // ... existing blocks ...
  VOLUME_SPIKE = 'volume_spike',
}

export interface VolumeSpikeBlock extends BaseBlock {
  type:        BlockType.VOLUME_SPIKE;
  category:    'trigger';
  execMode:    'tick';
  config: {
    tokenId:     string;
    multiplier:  number;   // spike must be X times average volume
    windowMins:  number;   // rolling average window
  };
}

// Add to the Block union type:
export type Block =
  | PriceCrossesUpBlock
  | PriceCrossesDownBlock
  | VolumeSpikeBlock
  // ... other blocks
```

**Step 2 — Add the Zod schema in `shared-schemas`:**

```typescript
// packages/shared-schemas/src/blocks.schema.ts
export const VolumeSpikeBlockSchema = z.object({
  type:     z.literal(BlockType.VOLUME_SPIKE),
  category: z.literal('trigger'),
  config: z.object({
    tokenId:    z.string().min(1),
    multiplier: z.number().min(1.1).max(100),
    windowMins: z.number().int().min(1).max(60),
  }),
});
```

**Step 3 — Implement the evaluator in `strategy-engine`:**

```typescript
// services/strategy-engine/src/blocks/triggers/volume-spike.block.ts
import { BlockEvaluator, EvalContext, BlockResult } from '../block.types';
import { VolumeSpikeBlock } from '@polyforge/shared-types';
import { RedisService } from '@polyforge/shared-redis';

export class VolumeSpikeEvaluator implements BlockEvaluator<VolumeSpikeBlock> {
  constructor(private redis: RedisService) {}

  async evaluate(block: VolumeSpikeBlock, ctx: EvalContext): Promise<BlockResult> {
    const { tokenId, multiplier, windowMins } = block.config;

    const bookData = await this.redis.getJson<OrderBook>(`cache:book:${tokenId}`);
    if (!bookData) return { fired: false, reason: 'no_book_data' };

    const avgVolume = await this.redis.getFloat(`volume:avg:${tokenId}:${windowMins}m`);
    if (!avgVolume) return { fired: false, reason: 'no_volume_history' };

    const currentVolume = bookData.volumeRate24h;
    const fired = currentVolume >= avgVolume * multiplier;

    return {
      fired,
      reason: fired
        ? `volume ${currentVolume} >= ${multiplier}x avg ${avgVolume}`
        : `volume ${currentVolume} < ${multiplier}x avg ${avgVolume}`,
      metadata: { currentVolume, avgVolume, ratio: currentVolume / avgVolume },
    };
  }
}
```

**Step 4 — Register in the block registry:**

```typescript
// services/strategy-engine/src/blocks/registry.ts
import { VolumeSpikeEvaluator } from './triggers/volume-spike.block';

export const BLOCK_REGISTRY: BlockRegistry = {
  // ... existing blocks ...
  [BlockType.VOLUME_SPIKE]: (redis, db) => new VolumeSpikeEvaluator(redis),
};
```

**Step 5 — Add the block UI in `user-app`:**

The strategy builder uses an SVG-based 2D canvas (not a tab-based list). Blocks are rendered as color-coded rectangles that can be freely dragged, with bezier connection lines between them. The canvas supports pan/zoom and auto-layout in section columns. A floating action button (FAB) opens the block picker.

To register a new block, add its definition to the appropriate category file:

```typescript
// apps/user-app/src/app/strategy-builder/blocks/trigger-blocks.ts
export const TRIGGER_BLOCKS: BlockDefinition[] = [
  // ... existing blocks ...
  {
    type:        BlockType.VOLUME_SPIKE,
    label:       'Volume Spike',
    description: 'Fire when volume is N times above average',
    icon:        'pi pi-chart-bar',
    category:    'trigger',
    configFields: [
      { key: 'tokenId',    label: 'Market Token',         type: 'market-picker' },
      { key: 'multiplier', label: 'Spike multiplier',     type: 'number', min: 1.1, max: 100, step: 0.1 },
      { key: 'windowMins', label: 'Rolling window (min)', type: 'number', min: 1, max: 60 },
    ],
  },
];
```

The canvas will automatically render the new block with the correct category color (Safety=red, Triggers=amber, Conditions=blue, Actions=green) and make it available in the FAB block picker.

### Block Wiring Interaction

Blocks have output ports (right edge) and input ports (left edge). Users drag from an output port to an input port to create an explicit connection. Connections are stored in the component's `connections` signal as `{ id, fromBlockId, toBlockId }` objects and rendered as dashed Bezier curves in the SVG canvas.

When no explicit connections exist, the canvas falls back to auto-wiring: all blocks in adjacent section columns (safety -> triggers -> conditions -> actions) are connected automatically for backward compatibility.

Selected connections display a cyan glow effect. Pressing Delete removes the selected connection.

### Variable Evaluation Order

Calculation variables are evaluated **before** safety blocks in the strategy runner's `evaluate()` pipeline:

1. Load strategy state from Redis
2. Evaluate calculation variables (expr-eval parser with state scope)
3. Check stale data
4. SAFETY blocks (with `$varName` params resolved)
5. TRIGGERS
6. CONDITIONS
7. ACTIONS

Variables can reference previously-defined variables. Invalid expressions are caught and logged as warnings without crashing the evaluation.

### Canvas Position Persistence

Block positions and connections are persisted via a `canvasJson` column (Prisma `Json?` type) on the strategy table. The `canvasJson` payload contains block coordinates and connection metadata. Block IDs are stable UUIDs generated at creation time, so positions survive save/reload cycles.

**Step 6 — Write tests:**

```typescript
// services/strategy-engine/src/blocks/triggers/volume-spike.block.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { VolumeSpikeEvaluator } from './volume-spike.block';

describe('VolumeSpikeEvaluator', () => {
  it('fires when current volume exceeds multiplier * average', async () => {
    const redis = {
      getJson:  vi.fn().mockResolvedValue({ volumeRate24h: 1000 }),
      getFloat: vi.fn().mockResolvedValue(400),
    };
    const evaluator = new VolumeSpikeEvaluator(redis as any);
    const result = await evaluator.evaluate({
      type: BlockType.VOLUME_SPIKE,
      category: 'trigger',
      config: { tokenId: 'token1', multiplier: 2, windowMins: 15 },
    }, {});
    expect(result.fired).toBe(true);   // 1000 >= 2 * 400
  });

  it('does not fire when volume is below threshold', async () => {
    const redis = {
      getJson:  vi.fn().mockResolvedValue({ volumeRate24h: 500 }),
      getFloat: vi.fn().mockResolvedValue(400),
    };
    const evaluator = new VolumeSpikeEvaluator(redis as any);
    const result = await evaluator.evaluate({
      type: BlockType.VOLUME_SPIKE,
      category: 'trigger',
      config: { tokenId: 'token1', multiplier: 2, windowMins: 15 },
    }, {});
    expect(result.fired).toBe(false);  // 500 < 2 * 400
  });
});
```

**Step 7 — Run the tests:**

```bash
cd services/strategy-engine
pnpm test -- --reporter=verbose volume-spike
```

---

## 4. Adding a New API Endpoint

Example: `GET /api/v1/markets/:id/price-history`

**Step 1 — Add the response type to `shared-types`:**

```typescript
// packages/shared-types/src/market.types.ts
export interface PriceHistoryPoint {
  time:   string;  // ISO timestamp
  open:   string;
  high:   string;
  low:    string;
  close:  string;
  volume: string;
}

export interface PriceHistoryResponse {
  tokenId:    string;
  resolution: '1m' | '1h' | '1d';
  data:       PriceHistoryPoint[];
  hasGaps:    boolean;
}
```

**Step 2 — Add the Zod query schema in `shared-schemas`:**

```typescript
// packages/shared-schemas/src/market.schema.ts
export const PriceHistoryQuerySchema = z.object({
  resolution: z.enum(['1m', '1h', '1d']).default('1h'),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  limit:      z.coerce.number().int().min(1).max(1000).default(100),
});
```

**Step 3 — Add the DTO with `@ApiProperty` decorators:**

```typescript
// services/api-service/src/markets/dto/price-history-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryQueryDto {
  @ApiProperty({ enum: ['1m', '1h', '1d'], default: '1h' })
  resolution: '1m' | '1h' | '1d' = '1h';

  @ApiProperty({ required: false })
  from?: string;

  @ApiProperty({ required: false })
  to?: string;

  @ApiProperty({ default: 100 })
  limit: number = 100;
}
```

**Step 4 — Add the controller method with `@ApiResponse`:**

```typescript
// services/api-service/src/markets/markets.controller.ts
@Get(':id/price-history')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Get OHLCV price history for a market token' })
@ApiResponse({ status: 200, type: PriceHistoryResponseDto })
@ApiResponse({ status: 404, description: 'Market not found' })
async getPriceHistory(
  @Param('id') tokenId: string,
  @Query() query: PriceHistoryQueryDto,
): Promise<PriceHistoryResponseDto> {
  return this.marketsService.getPriceHistory(tokenId, query);
}
```

**Step 5 — Implement the service method:**

```typescript
// services/api-service/src/markets/markets.service.ts
async getPriceHistory(
  tokenId: string,
  query: PriceHistoryQueryDto,
): Promise<PriceHistoryResponseDto> {
  const data = await this.db.priceHistory.findMany({
    where: {
      tokenId,
      time: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to   ? new Date(query.to)   : undefined,
      },
    },
    orderBy: { time: 'asc' },
    take: query.limit,
  });

  if (!data.length) throw new NotFoundException('Market not found');

  const hasGaps = await this.db.dataGaps.count({ where: { tokenId } }) > 0;

  return {
    tokenId,
    resolution: query.resolution,
    data: data.map(d => ({
      time:   d.time.toISOString(),
      open:   d.open.toString(),
      high:   d.high.toString(),
      low:    d.low.toString(),
      close:  d.close.toString(),
      volume: d.volume.toString(),
    })),
    hasGaps,
  };
}
```

**Step 6 — Regenerate the Angular client:**

```bash
pnpm generate:api
```

See `03-openapi-codegen.md` for details on the full generation pipeline.

**Step 7 — Verify TypeScript compiles in Angular apps:**

```bash
pnpm typecheck
```

TypeScript errors here mean the frontend was using a field that has changed. Fix them before committing.

**Step 8 — Commit the generated files:**

Always commit `swagger.json` and the generated `api/` files alongside your backend change. CI will regenerate and diff — a stale generated file will fail the build.

---

## 5. Running Tests

### All tests across the monorepo

```bash
pnpm test
```

### Single service

```bash
cd services/auth-service
pnpm test

# With watch mode:
pnpm test -- --watch

# With coverage:
pnpm test -- --coverage
```

### Single test file

```bash
cd services/strategy-engine
pnpm test -- src/blocks/triggers/volume-spike.block.spec.ts
```

### Integration tests (requires Docker)

```bash
# Start infrastructure containers
docker compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration

# Teardown
docker compose -f docker-compose.test.yml down
```

---

## 6. Debugging

### View service logs

```bash
# Follow logs in real-time
docker compose -f docker-compose.dev.yml logs -f strategy-engine

# Last 100 lines
docker compose -f docker-compose.dev.yml logs --tail=100 auth-service

# All services, last 50 lines each
docker compose -f docker-compose.dev.yml logs --tail=50
```

### Inspect Redis

```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli

# Useful commands:
KEYS cache:price:*                     # list all price cache keys
GET cache:price:tokenId123             # get a specific price
KEYS strategy:*:state                  # list all strategy states
XLEN stream:orders                     # messages in orders stream
XREVRANGE stream:events + - COUNT 10   # last 10 events
```

### Query the database directly

```bash
docker compose -f docker-compose.dev.yml exec postgres \
  psql -U poly -d polymarket

# Useful queries:
\dt trading.*           -- list trading schema tables
\dt auth.*              -- list auth schema tables

SELECT * FROM trading.strategies LIMIT 5;
SELECT status, COUNT(*) FROM trading.orders GROUP BY status;
SELECT * FROM analytics.price_history ORDER BY time DESC LIMIT 10;
```

### Inspect a running strategy's state

```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli \
  GET strategy:<strategyId>:state
```

### Check service health manually

```bash
docker compose -f docker-compose.dev.yml exec api-service \
  curl -s localhost:3002/health | jq
```

---

## 7. Database Schema Changes (Prisma)

**Step 1 — Edit the schema:**

```bash
nano prisma/schema.prisma
```

**Step 2 — Create a migration:**

```bash
DATABASE_URL=$DIRECT_DATABASE_URL npx prisma migrate dev --name add_volume_spike_config
```

**Step 3 — Verify:**

```bash
docker compose -f docker-compose.dev.yml exec postgres \
  psql -U poly -d polymarket -c "\d trading.strategies"
```

**Step 4 — Regenerate the Prisma client:**

```bash
npx prisma generate
```

> **Rule:** Never edit migration files after they've been committed. If a migration was wrong, create a new one that corrects it.

---

## 8. Code Style & Conventions

### TypeScript Rules

- **Strict mode everywhere** — no `any`, no `as unknown as X`
- **All monetary values are `string`** (decimal), never `number` — floating-point precision matters for financial data
- **All IDs are `string`** (UUID format), never `number`
- Use `readonly` on config objects and injected services
- Prefer `interface` over `type` for object shapes

### NestJS Rules

- All controllers have a corresponding service — **no business logic in controllers**
- All service methods have corresponding unit tests
- Use `@InjectRedis()` and `@InjectDb()` from shared packages — **never import directly**
- Log with `PinoLogger` from `@polyforge/logger` — **never `console.log`**

### Naming Conventions

```typescript
// Files: kebab-case
// auth-service.ts, volume-spike.block.ts

// Classes: PascalCase
// AuthService, VolumeSpikeEvaluator

// Interfaces: PascalCase (no I prefix)
// OrderIntent  (not IOrderIntent)

// Enums: PascalCase name, UPPER_SNAKE values
// enum BlockType { VOLUME_SPIKE = 'volume_spike' }

// Constants: UPPER_SNAKE_CASE
// const MAX_BATCH_SIZE = 15;

// Functions/methods: camelCase
// async getPriceHistory(), evaluateBlock()
```

### When You Add or Change an Endpoint

This is the most critical workflow to internalize:

```
1. Update the NestJS DTO / controller
   └─► Add/modify @ApiProperty and @ApiResponse decorators

2. Run pnpm generate:api
   └─► swagger.json is regenerated
   └─► Angular services are regenerated

3. Check for TypeScript errors in Angular apps
   └─► pnpm typecheck
   └─► Errors = the frontend used a field that no longer exists

4. Fix any Angular code that broke
   └─► The compiler tells you exactly what changed

5. Commit swagger.json + generated api/ files with your backend change
   └─► CI enforces this — it regenerates and diffs
```

This flow makes API changes safe: you cannot silently break the frontend because the TypeScript compiler catches mismatches.

---

---

## 9. HTTPS and Docker Compose Overlays

The project uses **Docker Compose overlay files** to layer optional configuration on top of the base stack.

### Pattern

The base file `docker-compose.infra.yml` defines all services with HTTP-only networking. Optional features are added via overlay files that Docker Compose merges at startup:

- **`docker-compose.ssl.yml`** — Adds nginx SSL termination (ports 443 and 8443), mounts self-signed certificates, and configures HTTP-to-HTTPS redirect.
- **`docker-compose.override.yml`** — Mounts local `dist/` directories for dev volume-mount mode (auto-applied by Docker Compose when present).

### Usage

```bash
# HTTP only (default)
docker compose -f docker-compose.infra.yml up -d

# HTTP + HTTPS
docker compose -f docker-compose.infra.yml -f docker-compose.ssl.yml up -d
```

When adding new infrastructure features, prefer creating a new overlay file rather than modifying the base compose file. This keeps the base stack simple and allows features to be toggled independently.

See [`docs/09-dev-setup.md`](./09-dev-setup.md) for full HTTPS setup instructions including certificate generation.

---

*Next: [OpenAPI Code Generation](./03-openapi-codegen.md) | [Database & Redis](./04-database-and-redis.md)*
