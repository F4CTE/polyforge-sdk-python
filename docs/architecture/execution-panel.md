# Execution Panel — Feature Documentation

This document describes the architecture and behaviour of the Execution Panel: the bottom panel in the PolyForge strategy builder that provides backtest and live trading controls.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [State Model](#3-state-model)
4. [WebSocket Events](#4-websocket-events)
5. [API Endpoints](#5-api-endpoints)
6. [Market Slot Auto-Detection](#6-market-slot-auto-detection)
7. [Backtest Tab](#7-backtest-tab)
8. [Live Tab](#8-live-tab)
9. [Block Highlighting](#9-block-highlighting)
10. [Integration with `strategy-builder.tsx`](#10-integration-with-strategy-buildertsx)

---

## 1. Overview

The Execution Panel is a collapsible bottom panel that appears inside the strategy builder page. It has two tabs:

- **Backtest** — submit a historical backtest run, track real-time progress, and view performance results.
- **Live** — start a strategy in paper or live trading mode, monitor its status, and view live metrics and recent trades.

The panel was designed as a single self-contained component with local React state for transient UI data (progress percentages, displayed results) and a lean global Zustand store (`execution-store.ts`) for the single piece of cross-component state: whether execution is currently active, which the canvas block nodes read to adjust their visual appearance.

---

## 2. Architecture

```
strategy-builder.tsx
├── StrategyCanvas           ← React Flow canvas
│   └── BlockNode(s)         ← reads execution-store for highlight state
├── BlockPalette             ← left sidebar
└── ExecutionPanel           ← bottom panel (this component)
    ├── local useState        ← BacktestState, LiveState, market bindings
    ├── useBuilderStore       ← reads nodes (for market slot scanning)
    └── useExecutionStore     ← writes backtestRunning / liveRunning flags
```

### Files

| File | Role |
|---|---|
| `apps/user-app/src/components/builder/execution-panel.tsx` | Main component — all UI, local state, WebSocket listener, API calls |
| `apps/user-app/src/stores/execution-store.ts` | Zustand store — cross-component execution state |
| `apps/user-app/src/pages/strategies/strategy-builder.tsx` | Host page — owns panel open/collapsed state and passes `strategyId` |

### Component Props

```typescript
interface ExecutionPanelProps {
  strategyId: string | null;  // null when strategy has not been saved yet
  expanded: boolean;          // controls panel height (collapsed / expanded)
  onToggle: () => void;       // callback to toggle expanded state
  activeTab: 'backtest' | 'live';
  onTabChange: (tab: 'backtest' | 'live') => void;
}
```

The parent (`strategy-builder.tsx`) owns the `expanded` and `activeTab` state and passes them down. This keeps the builder page in control of layout while the panel owns all execution logic internally.

---

## 3. State Model

### 3.1 Local State — Backtest

```typescript
interface BacktestState {
  runId: string | null;
  status: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;           // 0–100
  totalPnl: string | null;
  winRate: string | null;
  maxDrawdown: string | null;
  sharpeRatio: string | null;
  totalOrders: number | null;
  filledOrders: number | null;
  hasDataGaps: boolean;
  error: string | null;
  equityCurve: { tick: number; equity: number }[];
  trades: { time: string; side: string; price: string; amount: string; pnl: string }[];
}
```

`status` drives all conditional rendering in the Backtest tab. The transition graph is:

```
IDLE → QUEUED → RUNNING → COMPLETED
                       ↘ FAILED
```

`QUEUED` is set immediately when the user submits the backtest form, before any WebSocket event arrives. This provides instant feedback that the request was accepted.

### 3.2 Local State — Live

```typescript
interface LiveState {
  status: 'IDLE' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'ERROR';
  mode: 'PAPER' | 'LIVE';
  positions: { tokenId: string; market: string; side: string; size: string; avgPrice: string; pnl: string }[];
  recentTrades: { time: string; side: string; market: string; price: string; amount: string; pnl: string }[];
  totalPnl: string;
  sessionPnl: string;
  ordersPlaced: number;
  ordersFilled: number;
  lastTick: number | null;
  error: string | null;
}
```

`status` is initialised to `'IDLE'` on mount. When the user switches to the Live tab on a strategy that is already running (e.g. after a page refresh), the component fetches the current strategy status from `GET /api/v1/strategies/:id` and reconciles the local state.

### 3.3 Global Store — `execution-store.ts`

```typescript
interface ExecutionState {
  backtestRunning: boolean;
  liveRunning: boolean;
  firedBlockIds: Set<string>;   // for pulse animation on recently fired blocks

  setBacktestRunning: (running: boolean) => void;
  setLiveRunning: (running: boolean) => void;
  fireBlock: (blockId: string) => void;
}
```

`backtestRunning` and `liveRunning` are the only values that need to be shared with the canvas. Every `BlockNode` subscribes to these flags via `useExecutionStore` to apply the cyan glow effect during execution.

`firedBlockIds` tracks block IDs that have recently emitted an order intent (received via the `ORDER_FILLED` event). Each ID is automatically removed from the set after 1,500 ms, which corresponds to the duration of the pulse animation applied in `block-node.tsx`.

---

## 4. WebSocket Events

The panel subscribes to the shared `wsManager` singleton on mount and unsubscribes on unmount. The strategy-specific subscription (`wsManager.subscribeStrategy(strategyId)`) ensures that multi-strategy environments only route relevant events to this panel.

### 4.1 Backtest Events

| Event Type | Action |
|---|---|
| `BACKTEST_PROGRESS` | Updates `bt.status` to `'RUNNING'` and sets `bt.progress` from `data.progress`. Skipped if `data.runId` does not match the current `bt.runId`. |
| `BACKTEST_COMPLETED` | Sets `bt.status = 'COMPLETED'`, `bt.progress = 100`, and populates all result fields (`totalPnl`, `winRate`, `maxDrawdown`, `sharpeRatio`, `totalOrders`, `filledOrders`, `hasDataGaps`). Shows a success toast. |
| `BACKTEST_FAILED` | Sets `bt.status = 'FAILED'` and `bt.error` from `data.error ?? data.reason`. Shows an error toast. |

### 4.2 Strategy Lifecycle Events

| Event Type | Condition | Action |
|---|---|---|
| `STRATEGY_STARTED` | `data.strategyId === strategyId` | Sets `live.status = 'RUNNING'`, clears `live.error` |
| `STRATEGY_STOPPED` | `data.strategyId === strategyId` | Sets `live.status = 'IDLE'` |
| `STRATEGY_PAUSED` | `data.strategyId === strategyId` | Sets `live.status = 'PAUSED'` |
| `STRATEGY_RESUMED` | `data.strategyId === strategyId` | Sets `live.status = 'RUNNING'` |
| `STRATEGY_ERROR` | `data.strategyId === strategyId` | Sets `live.status = 'ERROR'`, populates `live.error` |

### 4.3 Order Events

| Event Type | Action |
|---|---|
| `ORDER_FILLED` | Increments `live.ordersFilled`, prepends a trade record to `live.recentTrades` (capped at 50 entries), updates `live.totalPnl` |
| `ORDER_PLACED` | Increments `live.ordersPlaced` |

---

## 5. API Endpoints

### 5.1 Backtests

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/backtests` | Submit a new backtest run. Returns `{ runId: string }`. |
| `GET` | `/api/v1/backtests/:id` | Poll for backtest status and results. Used as WebSocket fallback. |

**Submit backtest request body:**

```json
{
  "strategyId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "marketBindings": {
    "$MARKET_A": "token-id-1",
    "$MARKET_B": "token-id-2"
  }
}
```

**Polling response shape** (same fields as `BACKTEST_COMPLETED` WebSocket event):

```json
{
  "data": {
    "status": "COMPLETED",
    "progress": 100,
    "totalPnl": "142.50",
    "winRate": "0.62",
    "maxDrawdown": "0.08",
    "sharpeRatio": "1.74",
    "totalOrders": 48,
    "filledOrders": 41,
    "hasDataGaps": false
  }
}
```

### 5.2 Live Strategy Controls

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/strategies/:id/start` | Start or resume the strategy. Body: `{ mode: 'PAPER' \| 'LIVE', marketBindings: {...} }` |
| `POST` | `/api/v1/strategies/:id/stop` | Stop the strategy. |
| `POST` | `/api/v1/strategies/:id/pause` | Pause the strategy (runner continues ticking but skips order placement). |
| `POST` | `/api/v1/strategies/:id/resume` | Resume a paused strategy. |

### 5.3 Strategy Status (Initial Hydration)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/strategies/:id` | Fetched on tab change to `'live'` to reconcile local state with server state. |

---

## 6. Market Slot Auto-Detection

The Execution Panel scans the current strategy canvas to determine which market slots are referenced, then builds a binding UI that lets the user map each abstract slot to a real market.

### How It Works

```typescript
useEffect(() => {
  const slots = new Set<string>();
  for (const node of nodes) {
    const cfg = (node.data as any)?.config;
    if (!cfg) continue;
    Object.values(cfg).forEach((v: any) => {
      if (typeof v === 'string' && v.startsWith('$MARKET_')) slots.add(v);
    });
  }
  if (slots.size === 0) slots.add('$MARKET_A');  // default slot
  const sorted = Array.from(slots).sort().map(s => ({
    slot: s,
    label: s.replace('$', '').replace(/_/g, ' '),
  }));
  setMarketSlots(sorted);
}, [nodes]);
```

The effect runs whenever the `nodes` array changes (i.e. whenever blocks are added, removed, or reconfigured). It iterates every node's `config` object — a flat `Record<string, string>` — and collects any value that matches the pattern `$MARKET_X`. The resulting set is sorted alphabetically and rendered as the binding form.

### Binding UI

For each detected slot, the panel renders:

1. A label showing the slot name (e.g. "MARKET A").
2. A search input that queries `GET /api/v1/markets/search?q=<query>` for real market titles.
3. A results dropdown where the user selects the market to bind.

The selected binding is stored in `marketBindings: Record<string, string>` — a mapping from slot name (e.g. `$MARKET_A`) to token ID (e.g. `tok_abc123`). This mapping is sent as `marketBindings` in both the backtest and live start request bodies.

### Default Slot

If the canvas has no blocks with `market_slot` fields (e.g. a strategy using legacy `tokenId` text fields), the auto-detection defaults to inserting `$MARKET_A` as the only slot. This prevents the binding UI from being empty.

---

## 7. Backtest Tab

### 7.1 Form Fields

| Field | Type | Description |
|---|---|---|
| Start date | `<input type="date">` | The earliest date for historical data replay |
| End date | `<input type="date">` | The latest date for historical data replay |
| Market bindings | Auto-detected dropdowns | One row per `$MARKET_X` slot detected in the canvas |

### 7.2 Progress Tracking

When the backtest moves to `QUEUED` or `RUNNING` status, a real-time progress bar is rendered. Progress comes from two sources in priority order:

1. **WebSocket** (`BACKTEST_PROGRESS` events): The backtest service emits progress updates via the real-time channel. These are the primary source and update the bar with low latency.
2. **Polling fallback**: If the WebSocket connection is unavailable or events are missed, a `setInterval` polls `GET /api/v1/backtests/:runId` every 3 seconds. The polling interval is started when `bt.status` is `QUEUED` or `RUNNING` and cleared on any terminal state or component unmount.

### 7.3 Results Display

On `COMPLETED`, the panel renders the following metrics in a grid:

| Metric | Field | Description |
|---|---|---|
| Total P&L | `totalPnl` | Net profit/loss over the backtest period, in USDC |
| Win Rate | `winRate` | Fraction of closed trades that were profitable (0–1) |
| Max Drawdown | `maxDrawdown` | Largest peak-to-trough decline as a fraction (0–1) |
| Sharpe Ratio | `sharpeRatio` | Risk-adjusted return (annualised) |
| Total Orders | `totalOrders` | Number of order intents emitted |
| Filled Orders | `filledOrders` | Number of orders that received a fill in the simulation |

A `hasDataGaps: true` flag triggers an amber warning banner informing the user that historical data coverage was incomplete for part of the selected range.

---

## 8. Live Tab

### 8.1 Mode Selection

Before starting, the user selects one of two execution modes:

| Mode | Description |
|---|---|
| **Paper Trade** | Strategy runs with real market data but orders are simulated. No real funds are used. Order intents are published to `stream:paper_orders` and handled by the paper order service. |
| **Live Trade** | Strategy runs with real market data and places real orders on Polymarket via the signer service. Order intents are published to `stream:orders`. |

The selected mode is stored in `live.mode` and sent as `mode: 'PAPER' | 'LIVE'` in the start request.

### 8.2 Controls

The available control buttons depend on `live.status`:

| Status | Available Controls |
|---|---|
| `IDLE` | Start (Paper), Start (Live) |
| `STARTING` | — (spinner shown) |
| `RUNNING` | Pause, Stop |
| `PAUSED` | Resume, Stop |
| `STOPPING` | — (spinner shown) |
| `ERROR` | Restart |

Each button makes a `POST` request to the appropriate lifecycle endpoint and sets the local `live.status` to an intermediate state (`STARTING`, `STOPPING`) immediately, providing responsive feedback before the WebSocket confirmation arrives.

### 8.3 Live Metrics

While the strategy is `RUNNING` or `PAUSED`, the panel displays:

| Metric | Description |
|---|---|
| Total P&L | Cumulative P&L since strategy creation, updated via `ORDER_FILLED` events |
| Session P&L | P&L since the current start call (not yet implemented server-side; reserved field) |
| Orders Placed | Incremented on each `ORDER_PLACED` event |
| Orders Filled | Incremented on each `ORDER_FILLED` event |
| Last Tick | Timestamp of the most recent tick evaluation |

### 8.4 Recent Trades Table

The panel maintains a rolling list of the 50 most recent filled orders. Each row contains:

| Column | Source |
|---|---|
| Time | Client-side `new Date().toISOString()` at time of `ORDER_FILLED` event |
| Side | `data.side` from event (e.g. `BUY`, `SELL`) |
| Market | `data.tokenId` from event |
| Price | `data.price` |
| Amount | `data.amount` |
| P&L | `data.pnl` |

The list is prepended (most recent first) and truncated to 50 entries on each update.

---

## 9. Block Highlighting

While a strategy is executing (either backtest or live), every `BlockNode` on the canvas renders with a cyan glow effect. This provides a clear visual signal that the strategy is active and that the canvas is in a "read-only observation" context.

### How It Works

The `ExecutionPanel` writes to `execution-store.ts` whenever execution state changes:

```typescript
// Sync backtest running state
useEffect(() => {
  setExecBtRunning(bt.status === 'RUNNING' || bt.status === 'QUEUED');
}, [bt.status, setExecBtRunning]);

// Sync live running state
useEffect(() => {
  setExecLiveRunning(live.status === 'RUNNING' || live.status === 'PAUSED');
}, [live.status, setExecLiveRunning]);
```

In `block-node.tsx`, each node reads the store:

```typescript
const isLive = useExecutionStore((s) => s.liveRunning);
const isBtRunning = useExecutionStore((s) => s.backtestRunning);
const isExecuting = isLive || isBtRunning;
```

When `isExecuting` is `true`, the block node applies:

```typescript
className={`... ${isExecuting ? 'ring-1 ring-pf-cyan-500/40 shadow-[0_0_8px_rgba(0,200,255,0.15)]' : ''}`}
style={{
  borderWidth: isExecuting ? '1.5px' : '1px',
  borderColor: isExecuting ? d.color + '60' : 'var(--color-pf-border)',
}}
```

The result is a subtle cyan ring and soft glowing shadow on every active block, created entirely with CSS — no additional DOM elements are required.

### Cleanup

On unmount, the `ExecutionPanel` resets both flags to prevent stale highlighting when the user navigates away from the builder:

```typescript
useEffect(() => () => {
  setExecBtRunning(false);
  setExecLiveRunning(false);
}, [setExecBtRunning, setExecLiveRunning]);
```

---

## 10. Integration with `strategy-builder.tsx`

The builder page manages the layout-level state for the panel and passes it down as props.

```typescript
// In strategy-builder.tsx
const [execPanelExpanded, setExecPanelExpanded] = useState(false);
const [execTab, setExecTab] = useState<'backtest' | 'live'>('backtest');

// In JSX
<ExecutionPanel
  strategyId={strategyId}
  expanded={execPanelExpanded}
  onToggle={() => setExecPanelExpanded((v) => !v)}
  activeTab={execTab}
  onTabChange={setExecTab}
/>
```

The panel starts collapsed (`expanded: false`). The user can expand it by clicking the panel handle or the tab bar. The builder page's main layout uses CSS Flexbox with `flex-shrink-0` on the panel to ensure it pushes the canvas up as it expands, rather than overlapping it.

The `strategyId` prop is `null` when the strategy has not yet been saved. In this case, the panel's submit buttons are disabled and display a tooltip instructing the user to save first. This prevents backtest or live start calls against a non-existent strategy ID.
