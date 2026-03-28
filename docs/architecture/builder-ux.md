# Strategy Builder UX — Validation & Execution Animations

This document covers two related UX systems added to the strategy builder in v6.6.0:
1. **Block validation** — real-time feedback when blocks are misconfigured
2. **Execution animations** — visual feedback when a strategy is running

---

## Block Validation

### Goal

Prevent users from saving or running a strategy with blocks that are missing required field values. Errors should be visible at a glance, not only on save.

### States

A block can be in one of three states that affect its appearance:

| State | Description | Visual |
|-------|-------------|--------|
| **Inactive (not wired)** | Trigger/action with no edge connections | Amber dashed border, 45% opacity, "Not wired" badge |
| **Misconfigured** | Active block with one or more empty required fields | Red glow, red border, "Setup needed" badge |
| **Valid** | Wired and all fields filled | Normal border, no badge |

Safety and condition blocks are always active (global when unwired), so they can also be misconfigured — indicated by a small `AlertTriangle` icon in the header rather than the badge (to avoid stacking with the "Global" badge).

### Implementation

**`block-node.tsx`** computes `emptyFieldKeys` on every render:

```tsx
const emptyFieldKeys = new Set(
  d.fields.filter((f) => !(d.config[f.key] ?? '')).map((f) => f.key),
);
const isMisconfigured = emptyFieldKeys.size > 0;
const showSetupBadge = isMisconfigured && !isInactive && !isGlobal;
```

**Badge suppression rules** prevent visual clutter from stacking badges:
- `isInactive` → "Not wired" badge only; `AlertTriangle` appears in header if also misconfigured
- `isGlobal` → "Global" badge only; `AlertTriangle` in header if also misconfigured
- Neither → "Setup needed" badge shown above the card

**Field-level highlights** always appear regardless of wiring state:
- Empty field input/select: red border (`border-red-500/40`), red-tinted background (`bg-red-500/5`)
- Field label: red text + `— required` suffix

**Canvas issue banner** (`strategy-builder.tsx`) counts both issue types in a single pill:
- Amber when only wiring issues exist
- Red when any setup (empty-field) issue exists
- Format: `"2 blocks not wired · 1 block needs setup"`

---

## Execution Animations

### Goal

Give users real-time visual feedback about which blocks are evaluating and firing while a strategy runs, making the execution flow through the graph legible at a glance.

### Animation types

#### 1. Continuous pulse — while executing

All active blocks breathe with a subtle glow during execution. Speed is tuned to each section's conceptual role:

| Section | Keyframe | Duration | Rationale |
|---------|----------|----------|-----------|
| Triggers | `blockPulse` | 1.4 s | Rapid scanning — checking conditions every tick |
| Actions | `blockPulse` | 1.8 s | Active but waits for trigger signal |
| Conditions | `blockPulse` | 2.4 s | Slower evaluation — logical gate |
| Logic / Calc | `blockPulse` | 2.0 s | Computation in progress |
| Safety | `safetyPulse` | 3.6 s | Steady heartbeat — always-on guardian (red glow) |

Inactive (unwired) blocks do not pulse — they remain dimmed as they are not part of the execution path.

#### 2. Fired flash — when a block executes

When `firedBlockIds.has(id)` is true, the `blockFired` keyframe overrides the pulse:
- 0%: full bright cyan burst + `scale(1.025)` pop
- 55%: medium glow fading back
- 100%: returns to resting pulse state

The ID is removed from `firedBlockIds` after 1.5 s (managed by `execution-store.ts`), so the animation plays once per fire event.

#### 3. Edge brightening

While executing, all canvas edges switch to vivid cyan (`rgba(6,182,212,0.75)`) with a `drop-shadow` filter via `displayEdges` computed in `strategy-canvas.tsx`. This makes the data-flow paths visually obvious — edges look "alive" when they are carrying signal.

### Wiring events to animations

`fireBlock(id)` is called from `execution-panel.tsx` in response to real WebSocket events:

| Event | Blocks fired |
|-------|-------------|
| `BACKTEST_PROGRESS` | All trigger block IDs |
| `ORDER_PLACED` | All action block IDs |
| `ORDER_FILLED` | All action block IDs |

This gives a live representation of the strategy's evaluation cycle: triggers light up as each backtest tick is processed; actions light up when orders flow through.

### CSS keyframes

Injected once into the DOM via an inline `<style>` in `strategy-canvas.tsx`:

```css
@keyframes blockPulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.18), 0 0 8px rgba(6,182,212,0.10); }
  50%       { box-shadow: 0 0 0 2px rgba(6,182,212,0.42), 0 0 22px rgba(6,182,212,0.22); }
}

@keyframes blockFired {
  0%   { box-shadow: 0 0 0 3px rgba(6,182,212,0.9), 0 0 40px rgba(6,182,212,0.55);
         transform: scale(1.025); }
  55%  { box-shadow: 0 0 0 2px rgba(6,182,212,0.5), 0 0 18px rgba(6,182,212,0.28);
         transform: scale(1.005); }
  100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.18), 0 0 8px rgba(6,182,212,0.10);
         transform: scale(1); }
}

@keyframes safetyPulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.15), 0 0 6px rgba(239,68,68,0.08); }
  50%       { box-shadow: 0 0 0 2px rgba(239,68,68,0.35), 0 0 16px rgba(239,68,68,0.18); }
}
```

### State source

All execution state lives in `execution-store.ts` (Zustand):

```ts
interface ExecutionState {
  backtestRunning: boolean;
  liveRunning: boolean;
  firedBlockIds: Set<string>;  // cleared after 1.5 s per block

  setBacktestRunning(running: boolean): void;
  setLiveRunning(running: boolean): void;
  fireBlock(blockId: string): void;     // adds ID, auto-removes after 1.5 s
}
```

`execution-panel.tsx` drives the store; `block-node.tsx` and `strategy-canvas.tsx` read from it.

---

## External Execution Watching (SSE)

### Goal

Allow external SDK clients (TypeScript, Python, Rust) and the MCP server to observe live strategy execution events without requiring WebSocket auth, which uses JWT and is not suited for API-key-authenticated tooling.

### Architecture

```
Redis stream:events
       │
       ▼
  EventsService.dispatch()
       │  (if strategyId present)
       ▼
  StrategyEventsService          ← in-process Node.js EventEmitter
       │  emitter keyed by `s:<strategyId>`
       ├──▶  SSE subscriber A  (SDK client 1)
       ├──▶  SSE subscriber B  (SDK client 2)
       └──▶  SSE subscriber C  (MCP poll)
```

### Endpoint

`GET /api/v1/strategies/:id/events`

- **Auth:** API key Bearer token, `READ` scope
- **Protocol:** `text/event-stream`, `data: <JSON>\n\n` frames
- **Heartbeat:** `: heartbeat\n\n` comment every 15 s
- **First event:** always `{ type: "CONNECTED", strategyId, timestamp }`

### Event schema

```json
{
  "type": "ORDER_FILLED",
  "strategyId": "uuid",
  "data": { "orderId": "...", "price": 0.62 },
  "timestamp": 1711720000000
}
```

### SDK interfaces

| SDK | Interface |
|-----|-----------|
| TypeScript | `client.watchStrategy(id, signal?): AsyncGenerator<StrategyEvent>` |
| Python | `client.watch_strategy(id): Iterator/AsyncIterator[StrategyEvent]` |
| Rust | `client.watch_strategy(id).await? → StrategyEventStream` (poll `.next().await`) |
| MCP | `get_strategy_events` tool — cursor-based batch polling |
