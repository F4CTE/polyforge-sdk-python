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
9. [HTTPS and Docker Compose Overlays](#9-https-and-docker-compose-overlays)
10. [React App Structure (v3.0)](#10-react-app-structure-v30)
11. [Strategy Export/Import File Format (.polyforge)](#11-strategy-exportimport-file-format-polyforge)
12. [Logic Blocks vs Regular Blocks](#12-logic-blocks-vs-regular-blocks)

---

## 1. How a Feature Flows

Trace a concrete example to understand how everything connects: **a user starts a strategy**.

```
1. User clicks "Start" in user-app (React)
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
1. User fills out support form in user-app (React)
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
  intentId: string;
  userId: string;
  strategyId: string | null;
  tokenId: string;
  side: OrderSide;
  size: string; // decimal string — NEVER float
  price: string;
  orderType: OrderType;
  timestamp: number;
}
```

### `shared-schemas`

Zod schemas for all API request/response validation. Services import these for type-safe request parsing.

```typescript
// packages/shared-schemas/src/order.schema.ts
export const PlaceOrderSchema = z.object({
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  size: z.string().regex(/^\d+\.?\d*$/), // decimal string
  price: z.string().regex(/^0\.\d+$/), // 0.xx format
  orderType: z.enum(["GTC", "GTD", "FOK", "FAK"]),
});
```

### `shared-redis`

All Redis operations go through this package. **Never instantiate `new Redis()` directly in a service.**

```typescript
// Usage in any service:
import { RedisService, StreamService } from "@polyforge/shared-redis";

// Publish to a stream:
await streamService.publish("stream:events", {
  event_type: "ORDER_FILLED",
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
  VOLUME_SPIKE = "volume_spike",
}

export interface VolumeSpikeBlock extends BaseBlock {
  type: BlockType.VOLUME_SPIKE;
  category: "trigger";
  execMode: "tick";
  config: {
    tokenId: string;
    multiplier: number; // spike must be X times average volume
    windowMins: number; // rolling average window
  };
}

// Add to the Block union type:
export type Block =
  | PriceCrossesUpBlock
  | PriceCrossesDownBlock
  | VolumeSpikeBlock;
// ... other blocks
```

**Step 2 — Add the Zod schema in `shared-schemas`:**

```typescript
// packages/shared-schemas/src/blocks.schema.ts
export const VolumeSpikeBlockSchema = z.object({
  type: z.literal(BlockType.VOLUME_SPIKE),
  category: z.literal("trigger"),
  config: z.object({
    tokenId: z.string().min(1),
    multiplier: z.number().min(1.1).max(100),
    windowMins: z.number().int().min(1).max(60),
  }),
});
```

**Step 3 — Implement the evaluator in `strategy-engine`:**

```typescript
// services/strategy-engine/src/blocks/triggers/volume-spike.block.ts
import { BlockEvaluator, EvalContext, BlockResult } from "../block.types";
import { VolumeSpikeBlock } from "@polyforge/shared-types";
import { RedisService } from "@polyforge/shared-redis";

export class VolumeSpikeEvaluator implements BlockEvaluator<VolumeSpikeBlock> {
  constructor(private redis: RedisService) {}

  async evaluate(
    block: VolumeSpikeBlock,
    ctx: EvalContext,
  ): Promise<BlockResult> {
    const { tokenId, multiplier, windowMins } = block.config;

    const bookData = await this.redis.getJson<OrderBook>(
      `cache:book:${tokenId}`,
    );
    if (!bookData) return { fired: false, reason: "no_book_data" };

    const avgVolume = await this.redis.getFloat(
      `volume:avg:${tokenId}:${windowMins}m`,
    );
    if (!avgVolume) return { fired: false, reason: "no_volume_history" };

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
import { VolumeSpikeEvaluator } from "./triggers/volume-spike.block";

export const BLOCK_REGISTRY: BlockRegistry = {
  // ... existing blocks ...
  [BlockType.VOLUME_SPIKE]: (redis, db) => new VolumeSpikeEvaluator(redis),
};
```

**Step 5 — Add the block UI in `user-app`:**

The strategy builder uses an SVG-based 2D canvas (not a tab-based list). Blocks are rendered as color-coded rectangles that can be freely dragged, with bezier connection lines between them. The canvas supports pan/zoom and auto-layout in section columns. A floating action button (FAB) opens the block picker.

To register a new block, add its definition to the appropriate section in the
React builder definitions file:

```typescript
// apps/user-app/src/components/builder/block-definitions.ts
export const BLOCK_DEFS: Record<BlockSection, BlockDef[]> = {
  // ... existing blocks ...
  triggers: [
    // ... existing trigger blocks ...
    {
      type: "volume_spike",
      label: "Volume Spike",
      description: "Fire when volume is N times above average.",
      fields: [
        {
          key: "marketSlot",
          label: "Market",
          type: "market_slot",
          placeholder: "$MARKET_A",
        },
        {
          key: "multiplier",
          label: "Spike multiplier",
          type: "number",
          placeholder: "2",
        },
        {
          key: "windowMs",
          label: "Rolling window (ms)",
          type: "number",
          placeholder: "60000",
        },
      ],
      group: "Technical Analysis",
    },
  ],
  safety: [
    // ...
  ],
  conditions: [
    // ...
  ],
  actions: [
    // ...
  ],
  logic: [
    // ...
  ],
  calc: [
    // ...
  ],
};
```

The builder palette reads `BLOCK_DEFS` directly. Section labels, colors, and
icon names live in `SECTION_META` in the same file. The canvas will
automatically render the new block with the section color and make it available
in the block picker.

### Block Wiring Interaction

Blocks have output ports (right edge) and input ports (left edge). Users drag
from an output port to an input port to create an explicit connection.
Connections are stored in React Flow edge state and rendered as Bezier curves in
the canvas.

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
import { describe, it, expect, vi } from "vitest";
import { VolumeSpikeEvaluator } from "./volume-spike.block";

describe("VolumeSpikeEvaluator", () => {
  it("fires when current volume exceeds multiplier * average", async () => {
    const redis = {
      getJson: vi.fn().mockResolvedValue({ volumeRate24h: 1000 }),
      getFloat: vi.fn().mockResolvedValue(400),
    };
    const evaluator = new VolumeSpikeEvaluator(redis as any);
    const result = await evaluator.evaluate(
      {
        type: BlockType.VOLUME_SPIKE,
        category: "trigger",
        config: { tokenId: "token1", multiplier: 2, windowMins: 15 },
      },
      {},
    );
    expect(result.fired).toBe(true); // 1000 >= 2 * 400
  });

  it("does not fire when volume is below threshold", async () => {
    const redis = {
      getJson: vi.fn().mockResolvedValue({ volumeRate24h: 500 }),
      getFloat: vi.fn().mockResolvedValue(400),
    };
    const evaluator = new VolumeSpikeEvaluator(redis as any);
    const result = await evaluator.evaluate(
      {
        type: BlockType.VOLUME_SPIKE,
        category: "trigger",
        config: { tokenId: "token1", multiplier: 2, windowMins: 15 },
      },
      {},
    );
    expect(result.fired).toBe(false); // 500 < 2 * 400
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
  time: string; // ISO timestamp
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface PriceHistoryResponse {
  tokenId: string;
  resolution: "1m" | "1h" | "1d";
  data: PriceHistoryPoint[];
  hasGaps: boolean;
}
```

**Step 2 — Add the Zod query schema in `shared-schemas`:**

```typescript
// packages/shared-schemas/src/market.schema.ts
export const PriceHistoryQuerySchema = z.object({
  resolution: z.enum(["1m", "1h", "1d"]).default("1h"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});
```

**Step 3 — Add the DTO with `@ApiProperty` decorators:**

```typescript
// services/api-service/src/markets/dto/price-history-query.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class PriceHistoryQueryDto {
  @ApiProperty({ enum: ["1m", "1h", "1d"], default: "1h" })
  resolution: "1m" | "1h" | "1d" = "1h";

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

**Step 6 — Regenerate the API client:**

```bash
pnpm generate:api
```

See `03-openapi-codegen.md` for details on the full generation pipeline.

**Step 7 — Verify TypeScript compiles in React apps:**

```bash
pnpm typecheck
```

TypeScript errors here mean the frontend was using a field that has changed. Fix them before committing.

**Step 8 — Commit the generated files:**

Always commit the updated OpenAPI JSON and `packages/api-client/src/generated/`
files alongside your backend change. CI typechecks and builds the committed
client output, but it does not currently regenerate clients or diff generated
files for you.

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
docker compose -f docker-compose.infra.yml logs -f strategy-engine

# Last 100 lines
docker compose -f docker-compose.infra.yml logs --tail=100 auth-service

# All services, last 50 lines each
docker compose -f docker-compose.infra.yml logs --tail=50
```

### Inspect Redis

```bash
docker compose -f docker-compose.infra.yml exec redis sh -lc 'redis-cli -a "$REDIS_PASSWORD"'

# Useful commands:
KEYS cache:price:*                     # list all price cache keys
GET cache:price:tokenId123             # get a specific price
KEYS strategy:*:state                  # list all strategy states
XLEN stream:orders                     # messages in orders stream
XREVRANGE stream:events + - COUNT 10   # last 10 events
```

### Query the database directly

```bash
docker compose -f docker-compose.infra.yml exec postgres \
  psql -U poly -d polyforge

# Useful queries:
\dt trading.*           -- list trading schema tables
\dt auth.*              -- list auth schema tables

SELECT * FROM trading.strategies LIMIT 5;
SELECT status, COUNT(*) FROM trading.orders GROUP BY status;
SELECT * FROM analytics.price_history ORDER BY time DESC LIMIT 10;
```

### Inspect a running strategy's state

```bash
docker compose -f docker-compose.infra.yml exec redis sh -lc \
  'redis-cli -a "$REDIS_PASSWORD" GET strategy:<strategyId>:state'
```

### Check service health manually

```bash
docker compose -f docker-compose.infra.yml exec api-service \
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
docker compose -f docker-compose.infra.yml exec postgres \
  psql -U poly -d polyforge -c "\d strategies"
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

#### TS6 ESM/CJS Interop — `resolution-mode: "import"`

TypeScript 6 with `module: node16` / `moduleResolution: node16` requires explicit resolution mode on `import type` statements that reference ESM-only modules from CJS (CommonJS) files. Without this attribute, TS6 silently degrades all imported types to `any`, eliminating type safety.

**Pattern** — add `with { "resolution-mode": "import" }` to `import type` from ESM-only packages:

```typescript
import type { SomeType, AnotherType } from "esm-only-package" with {
  "resolution-mode": "import",
};
```

**When to use this pattern:**

- Your file runs as CJS (no `"type": "module"` in the nearest `package.json`)
- The dependency is ESM-only (`"type": "module"` in its `package.json`)
- You cannot convert the file to ESM without broader work (e.g., NestJS compatibility)

**Combined with `require()`** — when you also need the runtime value from an ESM-only package, use a typed wrapper interface alongside `require()`:

```typescript
// Type imports with resolution-mode
import type { Foo } from "esm-pkg" with { "resolution-mode": "import" };

// Local interface for the subset of the API you use
export interface FooLike {
  doThing(x: string): Promise<Foo>;
}

// Typed require() with a module-shaped type assertion
/* eslint-disable @typescript-eslint/no-require-imports */
const { FooClass } = require("esm-pkg") as {
  FooClass: new (...args: any[]) => FooLike;
};
/* eslint-enable @typescript-eslint/no-require-imports */
```

**Runtime verification:** compile-time assertions in test files catch regressions:

```typescript
type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<T extends false> = T;
type _FieldIsNotAny = AssertFalse<IsAny<SomeService["sdk"]>>;
```

**Real-world usage in this codebase:**

- `services/order-service/src/clob-client/clob-client.service.ts` — `import type` from `@polymarket/clob-client` with resolution-mode, plus `ClobClientLike` interface and typed `require()`
- `services/strategy-engine/src/common/safe-evaluate.ts` — `import type` from `mathjs` with resolution-mode, plus `MathJsRequireType` wrapper

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
   └─► React API client services are regenerated

3. Check for TypeScript errors in React apps
   └─► pnpm typecheck
   └─► Errors = the frontend used a field that no longer exists

4. Fix any React code that broke
   └─► The compiler tells you exactly what changed

5. Commit swagger.json + generated client files with your backend change
   └─► CI typechecks and builds the committed generated output
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

---

## 10. React App Structure

### Apps and Packages

```
apps/
├── user-app/                 # Vite + React 19 + React Router v7 — user SPA
├── admin-app/                # Vite + React 19 + React Router v7 — admin SPA
├── landing/                  # Next.js 15 App Router — landing page (SSR/SEO)
└── gateway/                  # Nginx reverse proxy config

packages/
├── ui/                       # Shared shadcn/ui components + Tailwind theme
├── api-client/               # Shared API client (generated via @hey-api/openapi-ts)
├── logger/                   # pino + nestjs-pino
├── polyforge-crypto/         # Rust WASM crypto package
├── polyforge-crypto-native/  # NAPI-RS native crypto addon
├── polyforge-engine/         # Rust/WASM strategy engine helpers
├── shared-auth/              # JWT guards + internal service client
├── shared-db/                # Prisma client NestJS module
├── shared-posthog/           # PostHog NestJS integration
├── shared-redis/             # ioredis factory + stream helpers
├── shared-schemas/           # Zod schemas
└── shared-types/             # TypeScript interfaces and enums
```

### `packages/ui/` — Shared Component Library

Contains shadcn/ui components and the shared Tailwind theme. Both `user-app` and `admin-app` import from this package.

```
packages/ui/
├── src/
│   ├── components/           # shadcn/ui components (Button, Card, Dialog, etc.)
│   ├── theme.css             # Tailwind @theme directive with Polyforge tokens
│   └── index.ts              # Public exports
├── tailwind.config.ts
└── package.json
```

### `packages/api-client/` — Generated API Client

Shared API client generated by `@hey-api/openapi-ts` (fetch-based, `@hey-api/client-fetch` runtime; the client-fetch plugin is bundled with openapi-ts since v0.73). Used by both React apps. Returns Promises (not Observables).

```
packages/api-client/
├── src/
│   ├── generated/
│   │   ├── user/             # Generated from api-service swagger.json
│   │   └── admin/            # Generated from admin-api-service swagger-admin.json
│   └── index.ts
└── package.json
```

Usage: `import { getMarkets } from '@polyforge/api-client/user'`

### Zustand Stores

State management uses Zustand with one store per domain concern:

| Store                  | File                           | Purpose                                            |
| ---------------------- | ------------------------------ | -------------------------------------------------- |
| `useAuthStore`         | `stores/auth.store.ts`         | User session, JWT token, login/logout              |
| `useThemeStore`        | `stores/theme.store.ts`        | Dark/light mode toggle, persistence                |
| `useNotificationStore` | `stores/notification.store.ts` | Toast queue, notification bell count               |
| `useWebSocketStore`    | `stores/websocket.store.ts`    | WS connection, message dispatch                    |
| `useBuilderStore`      | `stores/builder.store.ts`      | Strategy builder canvas state, blocks, connections |

### Hooks

Custom hooks encapsulate common patterns:

| Hook                            | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `useAuth()`                     | Access auth state + login/logout actions             |
| `usePriceUpdates(tokenId)`      | Subscribe to real-time price feed via WebSocket      |
| `useStrategyEvents(strategyId)` | Subscribe to strategy execution events via WebSocket |

### Guard Components

Route protection uses React wrapper components:

```tsx
// Requires authenticated user
<AuthGuard>
  <DashboardPage />
</AuthGuard>

// Requires authenticated + email-verified user
<VerifiedGuard>
  <TradingPage />
</VerifiedGuard>
```

Guards redirect to `/login` or `/verify-email` as appropriate.

---

## 11. Strategy Export/Import File Format (.polyforge)

### File Schema

The `.polyforge` file is a JSON document used for strategy import/export. It captures the full strategy definition including canvas layout for visual reconstruction.

```json
{
  "version": "1.0",
  "name": "My Strategy",
  "description": "Description text",
  "execMode": "TICK",
  "tickMs": 1000,
  "variables": [
    {
      "name": "threshold",
      "expression": "dailyPnl * 0.1"
    }
  ],
  "blocks": [
    {
      "id": "uuid-1",
      "type": "price_crosses_up",
      "category": "trigger",
      "config": {
        "tokenId": "token123",
        "threshold": "$threshold"
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "fromBlockId": "uuid-1",
      "toBlockId": "uuid-2"
    }
  ],
  "canvasLayout": {
    "blocks": {
      "uuid-1": { "x": 100, "y": 200 }
    },
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

**Key rules:**

- The `version` field enables forward compatibility. The importer checks the version and applies migrations if the schema has changed.
- Block IDs are regenerated on import to avoid collisions with existing strategies.
- `$varName` references in block configs are preserved as strings and resolved at runtime.
- The `canvasLayout` is optional. If omitted, the builder applies auto-layout on import.

### API Endpoints

```
GET  /api/v1/strategies/:id/export   → returns .polyforge JSON (Content-Type: application/json)
POST /api/v1/strategies/import       → accepts .polyforge JSON body, creates a new strategy
```

Both endpoints require authentication. The import endpoint creates a new PRIVATE strategy owned by the authenticated user.

---

## 12. Logic Blocks vs Regular Blocks

### Regular Blocks

Standard blocks (safety, trigger, condition, action) have a single output port. They evaluate to a boolean (`fired: true/false`) or produce a side effect (action blocks). Connections flow left-to-right through the section columns: SAFETY → TRIGGERS → CONDITIONS → ACTIONS.

### Logic Blocks

Logic blocks introduce **multiple output ports** and **boolean evaluation** for control flow:

- **IF/THEN/ELSE** has two output ports: `true` and `false`. The block evaluates a condition expression and routes the signal to the corresponding output port.
- **AND/OR gates** accept multiple input connections and produce a single boolean output.
- **NOT gate** inverts a single boolean input.
- **Delay** has one input and one output but introduces a time delay before propagating.

### Evaluation Differences

```
Regular block evaluation:
  evaluate(block, ctx) → { fired: boolean, reason: string }

Logic block evaluation:
  evaluate(block, ctx) → { outputs: { true: boolean, false: boolean }, reason: string }
```

Logic blocks are evaluated **after** conditions and **before** actions in the pipeline:

1. Variables (expr-eval)
2. SAFETY blocks
3. TRIGGERS
4. CONDITIONS
5. **LOGIC blocks** (route signals through true/false paths)
6. ACTIONS (only reached via true-path connections)

### Block Type Registration

Logic blocks use the same registry pattern as regular blocks but implement a `LogicBlockEvaluator` interface instead of `BlockEvaluator`:

```typescript
// services/strategy-engine/src/blocks/logic/if-then-else.block.ts
export class IfThenElseEvaluator implements LogicBlockEvaluator<IfThenElseBlock> {
  async evaluate(block: IfThenElseBlock, ctx: EvalContext): Promise<LogicBlockResult> {
    const conditionMet = /* evaluate condition expression */;
    return {
      outputs: { true: conditionMet, false: !conditionMet },
      reason: conditionMet ? 'condition met' : 'condition not met',
    };
  }
}
```

---

## 13. MCP Server (standalone repo `polyforge-mcp`)

> **Note:** The MCP server has been extracted from `packages/mcp-server` to its own repository [`polyforge-mcp`](https://github.com/polyforge/polyforge-mcp) for independent versioning. The in-monorepo package is deprecated.

The MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io) so that AI assistants like Claude can interact with Polyforge directly via 33 tools.

### Setup

```bash
# Install and run (from the standalone repo or via npx)
npx @polyforge/mcp-server

# Required env vars
POLYFORGE_API_URL=http://localhost:3001 POLYFORGE_API_KEY=pf_xxx npx @polyforge/mcp-server
```

### Claude Desktop configuration

```json
{
  "mcpServers": {
    "polyforge": {
      "command": "npx",
      "args": ["@polyforge/mcp-server"],
      "env": {
        "POLYFORGE_API_URL": "https://api.polyforge.io",
        "POLYFORGE_API_KEY": "pf_your_api_key"
      }
    }
  }
}
```

### Architecture

The MCP server is a standalone Node.js process that communicates over stdio. It defines 20 tools that map 1:1 to Polyforge API endpoints. Each tool call translates to an authenticated HTTP request to the Polyforge API using the configured API key.

### Available tools (33 total)

`list_markets`, `get_market`, `provide_liquidity`, `list_strategies`, `get_strategy`, `create_strategy`, `create_strategy_from_description`, `start_strategy`, `stop_strategy`, `get_strategy_templates`, `export_strategy`, `get_strategy_events`, `get_portfolio`, `get_orders`, `get_score`, `place_order`, `cancel_order`, `get_accuracy`, `get_portfolio_review`, `get_whale_feed`, `get_news_signals`, `get_market_sentiment`, `list_alerts`, `list_copy_configs`, `list_webhooks`, `create_webhook`, `ai_query`

---

_Next: [OpenAPI Code Generation](./03-openapi-codegen.md) | [Database & Redis](./04-database-and-redis.md)_
