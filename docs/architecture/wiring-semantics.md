# Strategy Wiring Semantics

This document is the authoritative technical reference for how block wiring affects strategy execution in PolyForge. It covers the backend enforcement model, the frontend visual feedback system, the design rationale behind each rule, and a worked example.

---

## Table of Contents

1. [Background and Motivation](#1-background-and-motivation)
2. [Execution Pipeline Overview](#2-execution-pipeline-overview)
3. [The Wiring Contract](#3-the-wiring-contract)
4. [Backend Enforcement: `filterByConnections()`](#4-backend-enforcement-filterbyconnections)
5. [Frontend Feedback Loop](#5-frontend-feedback-loop)
6. [Design Rationale](#6-design-rationale)
7. [Example Walkthrough: Cross-Market Strategy](#7-example-walkthrough-cross-market-strategy)
8. [Edge Cases and Legacy Strategies](#8-edge-cases-and-legacy-strategies)

---

## 1. Background and Motivation

The PolyForge strategy builder uses React Flow as its canvas. Users construct strategies by dragging blocks from the palette onto the canvas and connecting them with directed edges. Each edge represents a logical dependency: the block at the tail of the arrow must evaluate to "pass" before the block at the tip is given the opportunity to act.

Before wiring semantics were introduced, the strategy runner received the full list of blocks from the canvas regardless of their connection state. This created a class of silent errors:

- An **action** block placed on the canvas without a trigger would fire on every tick as soon as market data was available.
- A **condition** block placed as a dead end (no outgoing edge) would evaluate to true or false, but its result would never route to an action — effectively blocking execution with no warning to the user.
- An isolated **trigger** block with no outgoing edge had no downstream consumer, so the signal it generated was discarded.

None of these scenarios produced an error. The strategy ran, the blocks evaluated, and nothing happened or something unexpected happened. The user had no feedback that their strategy graph was semantically incomplete.

Wiring semantics address this by defining a formal contract: a block must satisfy its connectivity requirement to participate in execution. The same contract is enforced independently on the backend (which runs the actual strategy) and surfaced visually on the frontend (to provide immediate feedback during construction).

---

## 2. Execution Pipeline Overview

The strategy runner (`services/strategy-engine/src/strategy/strategy-runner.ts`) evaluates a strategy on every clock tick. Each tick proceeds through six ordered phases:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tick N                                                          │
│                                                                 │
│  Phase 1: Safety Evaluation                                     │
│           All safety blocks evaluated first, unconditionally.   │
│           Any block that fires halts the entire tick.           │
│                                                                 │
│  Phase 2: Stale Data Check                                      │
│           If market data timestamp is older than the staleness  │
│           threshold, the tick is skipped with a warning log.    │
│                                                                 │
│  Phase 3: Trigger Evaluation (OR logic)                         │
│           Each wired trigger is evaluated. If ANY trigger fires,│
│           execution proceeds to Phase 4. If none fire, tick     │
│           ends here.                                            │
│                                                                 │
│  Phase 4: Condition Evaluation (AND logic)                      │
│           Each wired condition is evaluated. ALL conditions must│
│           pass for execution to proceed to Phase 5.             │
│                                                                 │
│  Phase 5: Logic Graph Traversal                                 │
│           IF/THEN/ELSE, AND_GATE, OR_GATE, NOT_GATE, and DELAY  │
│           nodes are evaluated according to the connection graph. │
│           Variable nodes are resolved first as named references.│
│                                                                 │
│  Phase 6: Action Execution                                      │
│           Each wired action fires an order intent. The runner   │
│           publishes the intent to the appropriate Redis stream   │
│           (stream:orders for live, stream:paper_orders for       │
│           paper mode).                                          │
└─────────────────────────────────────────────────────────────────┘
```

The key insight is that phases 3, 4, and 6 only operate on **wired** blocks. The `filterByConnections()` function runs once at runner instantiation, before the tick loop begins, to partition the block list into active and inactive sets.

---

## 3. The Wiring Contract

Each block section has a specific connectivity requirement for the block to be considered "active" (i.e. eligible to participate in tick evaluation).

### 3.1 Safety Blocks — Always Active

```
Requirement: None (unconditional)
```

Safety blocks are global risk guards. They are evaluated on every tick before any other processing occurs. Their purpose is to protect the user's capital and enforce their stated risk limits regardless of what is happening in the strategy logic graph. Because they must always run, they bypass wiring entirely.

Examples: `stop_if_daily_loss`, `stop_if_drawdown`, `max_daily_bets`, `time_window`.

### 3.2 Trigger Blocks — Requires ≥1 Outgoing Edge

```
Requirement: sources.has(block.id)
```

A trigger detects a market condition and signals to downstream blocks that something noteworthy has occurred. Without at least one outgoing edge, the trigger's signal has nowhere to go. The block can still evaluate — it can still detect the condition — but the result is silently discarded.

The wiring contract makes this explicit: a trigger with no outgoing edges is inactive and is excluded from the evaluation pipeline.

Examples: `price_crosses_above`, `volume_spike`, `price_crosses_below`.

### 3.3 Condition Blocks — Requires ≥1 Incoming AND ≥1 Outgoing Edge

```
Requirement: targets.has(block.id) AND sources.has(block.id)
```

A condition acts as a gate in the middle of the execution path. It receives signal from upstream (the trigger or logic graph) and passes it on downstream (to actions or further logic). A condition needs both connections to be semantically meaningful:

- **Without an incoming edge:** the condition would evaluate against no upstream signal. Even if it passes, it cannot have been triggered by anything in the graph.
- **Without an outgoing edge:** the condition evaluates, but its pass/fail result cannot reach any action. This is the same problem as a terminal trigger — signal is generated and immediately discarded.

Examples: `min_liquidity_check`, `max_spread_check`, `cooldown_period`.

### 3.4 Action Blocks — Requires ≥1 Incoming Edge

```
Requirement: targets.has(block.id)
```

An action places or manages a position. Without an incoming edge, the action has no upstream trigger or condition to act on. An action that fires with no causal context could place orders on every tick unconditionally, which is almost certainly not the user's intent.

Examples: `buy_yes_at_price`, `sell_no_at_price`, `place_limit_order`, `cancel_all_orders`.

### Summary Table

| Block Section | Incoming Edge Required | Outgoing Edge Required | Always Runs |
|---|:---:|:---:|:---:|
| Safety | No | No | Yes |
| Trigger | No | Yes | No |
| Condition | Yes | Yes | No |
| Action | Yes | No | No |

---

## 4. Backend Enforcement: `filterByConnections()`

### 4.1 Location

```
services/strategy-engine/src/strategy/strategy-registry.service.ts
```

### 4.2 When It Runs

`filterByConnections()` is called once per strategy at runner instantiation — either when `startStrategy()` is called via the API, or during the startup reconciliation pass that resumes strategies that were running when the service last restarted. It does not run on every tick; its output is stored as the runner's immutable block list for the lifetime of that run.

### 4.3 Implementation

```typescript
function filterByConnections(
  triggers: any[],
  conditions: any[],
  actions: any[],
  connections: any[],
): { triggers: any[]; conditions: any[]; actions: any[] } {
  if (!connections || connections.length === 0) {
    return { triggers, conditions, actions };
  }

  const sources = new Set<string>(connections.map((c: any) => c.source));
  const targets = new Set<string>(connections.map((c: any) => c.target));

  return {
    triggers:   triggers.filter((b: any) => sources.has(b.id)),
    conditions: conditions.filter((b: any) => targets.has(b.id) && sources.has(b.id)),
    actions:    actions.filter((b: any) => targets.has(b.id)),
  };
}
```

### 4.4 The `sources` and `targets` Sets

The function builds two `Set<string>` objects from the connections array. Each connection is a React Flow edge object serialised into the strategy's `canvas.connections` JSON field. A connection has the shape `{ source: string, target: string, ... }` where `source` and `target` are block node IDs.

- `sources` contains every node ID that appears as the source (tail) of at least one edge — i.e. every node that has at least one outgoing connection.
- `targets` contains every node ID that appears as the target (head) of at least one edge — i.e. every node that has at least one incoming connection.

Applying the filter rules:

| Block | Filter expression | Plain English |
|---|---|---|
| Trigger | `sources.has(b.id)` | The block's ID appears as the source of some edge |
| Condition | `targets.has(b.id) && sources.has(b.id)` | The block's ID appears as both a target and a source |
| Action | `targets.has(b.id)` | The block's ID appears as the target of some edge |

Safety blocks are not passed to `filterByConnections()` at all — they are added to the runner's active block list directly before this function is called.

### 4.5 Backwards Compatibility

The first line of the function handles the legacy case:

```typescript
if (!connections || connections.length === 0) {
  return { triggers, conditions, actions };
}
```

Strategies created before wiring semantics were introduced have an empty `connections` array in their canvas JSON (or no `connections` key at all, which is coerced to `null`). For these strategies, `filterByConnections()` is a no-op and returns all blocks unchanged. This ensures that existing strategies continue to behave exactly as they did before.

---

## 5. Frontend Feedback Loop

The frontend provides two complementary visual signals to communicate wiring state to the user while they build their strategy.

### 5.1 Orphaned Block Visual (`block-node.tsx`)

**File:** `apps/user-app/src/components/builder/nodes/block-node.tsx`

A block is considered "wired" if it has at least one edge connected to it (as either source or target), **or** if it is a safety block.

```typescript
const isSafety = d.section === 'safety';
const isWired = isSafety || edges.some((e) => e.source === id || e.target === id);
```

When `isWired` is `false`, three visual changes are applied to the block's rendered node:

| Change | Implementation |
|---|---|
| **Opacity reduced to 45%** | `className` includes `opacity-45` when `!isWired` |
| **Dashed amber border** | `borderStyle: isWired ? 'solid' : 'dashed'`, `borderColor: '#f59e0b44'` |
| **"Not wired" badge** | An absolutely positioned `<div>` above the block header, with amber background, an `Unlink` icon, and the text "Not wired" |

The badge text reads: `"This block is not connected — it won't execute until wired into the strategy flow"` (visible as a `title` tooltip on hover).

These visual changes update reactively. When the user draws an edge to or from the block, the `edges` array in the Zustand store updates, the `isWired` derived value flips to `true`, and React re-renders the block in its normal appearance immediately.

### 5.2 Canvas Warning Banner (`strategy-builder.tsx`)

**File:** `apps/user-app/src/pages/strategies/strategy-builder.tsx`

The strategy builder page computes `orphanedCount` as a derived selector on the Zustand store:

```typescript
const orphanedCount = useBuilderStore((s) => {
  const connectedIds = new Set<string>([
    ...s.edges.map((e) => e.source),
    ...s.edges.map((e) => e.target),
  ]);
  return s.nodes.filter(
    (n) =>
      n.type === 'blockNode' &&
      (n.data as BlockNodeData).section !== 'safety' &&
      !connectedIds.has(n.id),
  ).length;
});
```

When `orphanedCount > 0`, an amber pill banner is rendered at the top-centre of the canvas:

```
⚠  3 blocks not wired — they won't execute
```

The count updates live as edges are added and removed. The banner disappears entirely (no empty space) when `orphanedCount === 0`.

---

## 6. Design Rationale

### 6.1 Why Safety Blocks Bypass Wiring

Safety blocks are not part of the strategy's logical flow — they are constraints on it. A `stop_if_daily_loss` block does not respond to triggers; it monitors a global account metric (daily P&L) and halts everything if a threshold is breached. Requiring the user to "wire" safety blocks into the graph would create a confusing expectation that they need to be connected to something specific. More importantly, it would allow a user to accidentally leave a safety block disconnected and lose its protection.

The design principle is: **a safety block on the canvas is always enforced**. Its presence alone is the statement of intent.

### 6.2 Why Conditions Need Both Incoming and Outgoing Edges

A condition with only an incoming edge is a dead end. It receives signal, evaluates, and returns a boolean — but nothing downstream can act on that boolean. The strategy would pass the trigger phase, reach the condition, evaluate it, and then have nowhere to go. This would silently block all execution. The user would see a strategy that triggers but never places an order, with no explanation.

A condition with only an outgoing edge is equally problematic from the opposite direction. It has a downstream consumer but no upstream source. The condition would be evaluated on every tick unconditionally, not as a gate in a flow but as a standalone check. This degrades it to trigger semantics and is probably not what the user intended.

By requiring both connections, the condition is forced into its intended role: an inline gate that sits within a causal chain.

### 6.3 Why Isolated Actions Are Excluded

An action block represents a financial operation — placing a buy or sell order. An action with no incoming edge has no upstream trigger providing context for why it should fire. If it were included in execution, it would fire on every tick that passes the condition phase, which means it would place orders continuously.

The wiring contract makes the semantic expectation explicit: an action must be the downstream consequence of something. This is not a technical restriction — the runner is fully capable of executing an unwired action — it is a deliberate design choice to prevent accidental runaway order placement.

---

## 7. Example Walkthrough: Cross-Market Strategy

This example illustrates which blocks are active in a realistic cross-market strategy and why.

### Strategy Description

> "When the YES price for `$MARKET_A` crosses above 0.55, check that `$MARKET_B` has at least 5,000 USDC in liquidity, then buy `$MARKET_B` YES at 0.25 USDC with a 10% stop-loss guard."

### Canvas Layout

```
[Stop on Daily Loss: 200 USDC]          ← Safety block (no edges)

[$MARKET_A YES crosses 0.55]            ← Trigger
      |
      ▼ (edge 1)
[Min Liquidity: $MARKET_B ≥ 5000 USDC]  ← Condition
      |
      ▼ (edge 2)
[Buy $MARKET_B YES at 0.25 USDC]         ← Action

[Market Cap Check: $MARKET_A > 100k]     ← Condition (orphaned — no edges)
```

### Wiring Analysis

| Block | ID | In `sources`? | In `targets`? | Active? | Reason |
|---|---|:---:|:---:|:---:|---|
| Stop on Daily Loss | `b-001` | — | — | **Yes** | Safety: always active |
| $MARKET_A YES crosses 0.55 | `b-002` | Yes (edge 1) | No | **Yes** | Trigger with ≥1 outgoing edge |
| Min Liquidity Check | `b-003` | Yes (edge 2) | Yes (edge 1) | **Yes** | Condition with ≥1 in and ≥1 out |
| Buy $MARKET_B YES | `b-004` | No | Yes (edge 2) | **Yes** | Action with ≥1 incoming edge |
| Market Cap Check | `b-005` | No | No | **No** | Condition with zero edges — orphaned |

### Execution Flow at Runtime

On each tick, the runner:

1. Evaluates `Stop on Daily Loss`. If daily P&L has dropped below -200 USDC, halts the tick.
2. Checks that market data is fresh.
3. Evaluates `$MARKET_A YES crosses 0.55`. If the price has not crossed, the tick ends.
4. Evaluates `Min Liquidity Check` on `$MARKET_B`. If liquidity is below 5,000 USDC, the tick ends.
5. Executes `Buy $MARKET_B YES at 0.25 USDC` — publishes an order intent to `stream:orders`.

The `Market Cap Check` block on the canvas is never evaluated. The user sees it at 45% opacity with a dashed amber border and the "Not wired" badge. The canvas banner shows "1 block not wired — it won't execute".

---

## 8. Edge Cases and Legacy Strategies

### 8.1 Empty Canvas

A strategy with zero nodes and zero edges passes through `filterByConnections()` with all empty arrays. The runner starts but produces no actions. The safety phase is a no-op (no safety blocks). This is a valid state — it represents a strategy template that has not yet been built out.

### 8.2 Trigger with Multiple Outgoing Edges

A trigger block that fans out to multiple conditions (edges to `b-003` and `b-007`) is fully supported. `sources.has(b-002)` is `true` as long as any outgoing edge exists. All downstream conditions that receive a connection from `b-002` are subject to their own `targets.has()` check independently.

### 8.3 Legacy Strategies

Any strategy whose `canvas.connections` field is `null`, `undefined`, or an empty array is treated as a pre-wiring-semantics strategy. `filterByConnections()` returns all blocks unchanged, preserving the original behaviour. These strategies will appear in the frontend builder with all non-safety blocks rendered at full opacity (no "Not wired" badge) because the edges array is empty and the `isWired` check falls back to `isSafety`, which is `false` for non-safety blocks.

If a user opens a legacy strategy in the builder and saves it without adding any edges, it continues to behave as before. If they add edges, the new wiring semantics apply from that save onward.

### 8.4 Logic and Calc Blocks

`filterByConnections()` only filters triggers, conditions, and actions. Logic blocks (`IF_THEN_ELSE`, `AND_GATE`, `OR_GATE`, `NOT_GATE`, `DELAY`) and calc blocks are part of the logic graph phase (Phase 5) and are traversed by the graph walker starting from the set of active blocks. An isolated logic block that has no path from an active trigger will simply never be visited during traversal — there is no explicit filtering needed.
