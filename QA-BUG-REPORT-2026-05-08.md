# QA Bug Report — POLA-2732 Error Handling Audit

**Date**: 2026-05-08
**Auditor**: Daedalus (QA/Verification)
**Parent Issue**: POLA-2732
**Status**: Investigation complete; implementation delegated to subtasks

---

## 1. ORDER_FAILED shows no reason

### Root Cause (Server)
**File**: `services/api-service/src/gateway/events.service.ts:139,183`

The `reason` field is destructured from the Redis event on line 139:
```ts
const { type, strategyId, userId, orderId, tokenId, reason, ...rest } = event;
```

But omitted from the `pushOrderEvent()` call for ORDER_FAILED/ORDER_ERROR cases (line 183):
```ts
this.gateway.pushOrderEvent(userId, type, { orderId, ...rest });
// No `reason` field — only orderId and rest (which is just { ts })
```

Compare with STRATEGY_ERROR (line 171) which correctly forwards `{ reason }`.

### Root Cause (Frontend)
**File**: `apps/user-app/src/pages/markets/market-detail.tsx:645`

```tsx
if (msg.type === 'ORDER_FAILED') toast.error('Order failed');
```
Hardcoded string — never reads `msg.data?.reason` or `msg.data?.error`.

### Schema Mismatch
- `packages/shared-schemas/src/stream-events.schema.ts:43` expects field `error`
- `services/order-service/src/events/events.service.ts:66` emits field `reason`

### Fix Delegated To
[POLA-3285](POLA-3285)

---

## 2. Generic error toasts (412 found)

**Scope**: 412 generic `toast.error()` calls out of 501 total (82.6%).

### Top Patterns
| Pattern | Count |
|---|---|
| "Failed to load X" | ~150+ |
| "Failed to save/update/delete X" | ~80 |
| "Action failed" in catch blocks | ~60 |
| Bare "X failed" | ~40 |
| Copy failures | ~10 |
| Other generic | ~70 |

### Worst Files
| File | Generic Count |
|---|---|
| `settings.tsx` | 53 |
| `strategy-detail.tsx` | 30 |
| `portfolio.tsx` | 22 |
| `orders.tsx` | 19 |
| `market-detail.tsx` | 19 |
| `strategy-builder.tsx` | 15 |

### Fix Delegated To
[POLA-3287](POLA-3287)

---

## 3. Silent catch blocks (33 found)

**Scope**: 33 catch blocks with no toast, no Sentry, no rethrow, no console.error.

### Most Dangerous (7)

| # | File:Line | Operation | Severity |
|---|-----------|-----------|----------|
| 1 | `market-detail.tsx:827` | Cancel order (DELETE /orders/{id}) | CRITICAL |
| 2 | `market-detail.tsx:603` | Load user's orders | HIGH |
| 3 | `execution-panel.tsx:156` | Poll strategy live status | HIGH |
| 4 | `orders.tsx:571` | Load portfolio positions | HIGH |
| 5 | `market-detail.tsx:615` | Load portfolio balance (Kelly sizer) | HIGH |
| 6 | `strategy-detail.tsx:423` | Load strategy PnL | HIGH |
| 7 | `execution-panel.tsx:319` | Market search (backtest config) | HIGH |

### Fix Delegated To
[POLA-3286](POLA-3286)

---

## 4. WebSocket disconnect invisible

### Root Cause
**File**: `apps/user-app/src/lib/websocket.ts:112-121`

`onclose` (lines 112-119) and `onerror` (line 121) perform reconnection but never call `this.emit()` — no registered listener is notified of disconnection.

### Misleading UI Indicators
- `topbar.tsx:103-105` — Fake static "Connected" indicator, always green
- `whale-feed.tsx:174` — Sets `wsConnected=true` unconditionally on mount
- `strategy-detail.tsx:480` — Sets `wsConnected=true` on AUTH_OK only, never to false

### Fix Delegated To
[POLA-3288](POLA-3288)
