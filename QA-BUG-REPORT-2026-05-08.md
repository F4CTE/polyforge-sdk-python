# QA Bug Report — POLA-2732 Error Handling Audit

**Date**: 2026-05-08 (updated 2026-05-10)
**Auditor**: Daedalus (QA/Verification)
**Parent Issue**: POLA-2732
**Status**: Partial fix applied; remaining work delegated to subtasks

---

## 1. ORDER_FAILED shows no reason

### Root Cause (Server) ✅ FIXED
**File**: `services/api-service/src/gateway/events.service.ts:139,183`
**Fixed in**: `6fa392849` (main, May 10)

Dedicated `case "ORDER_FAILED"` now includes `reason` with sanitization:
```ts
case "ORDER_FAILED":
  if (userId) {
    const sanitizedReason = reason
      ? reason.replace(/[\r\n]+/g, " ").slice(0, 500)
      : undefined;
    this.gateway.pushOrderEvent(userId, type, {
      orderId,
      reason: sanitizedReason,
      ...rest,
    });
  }
  break;
```

### Root Cause (Frontend) ✅ FIXED
**File**: `apps/user-app/src/pages/markets/market-detail.tsx:649`
**Fixed on**: this branch (`POLA-2732`)

Was:
```tsx
if (msg.type === 'ORDER_FAILED') toast.error('Order failed');
```
Now reads `msg.data?.reason` from the WS payload:
```tsx
if (msg.type === 'ORDER_FAILED') {
  const reason = msg.data?.reason as string | undefined;
  toast.error(reason ? `Order failed: ${reason}` : 'Order failed');
}
```

### Schema Mismatch ⚠️ OPEN
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

## 4. WebSocket disconnect invisible ⚠️ PENDING

### Root Cause — Pending (in PR #1282)
**File**: `apps/user-app/src/lib/websocket.ts`
**Pending in**: `3dc93d8a8` (PR [#1282](https://github.com/F4CTE/PolyForge/pull/1282), open/unmerged)

`WebSocketManager` now tracks `ConnectionState` (`disconnected` | `connecting` | `connected` | `reconnecting`) and exposes `addConnectionListener()` / `getConnectionState()` so consumers can react to connection changes. `setConnectionState()` emits to all registered `ConnectionListener` callbacks, called from `connect()`, `onopen`, `onclose`, and `destroy()`.

### Misleading UI Indicators ⚠️ OPEN
- `topbar.tsx:103-105` — Fake static "Connected" indicator, always green
- `whale-feed.tsx:174` — Sets `wsConnected=true` unconditionally on mount
- `strategy-detail.tsx:480` — Sets `wsConnected=true` on AUTH_OK only, never to false

These UI components should be updated to use `wsManager.addConnectionListener()` instead of hardcoded values. Tracked in subtask.

### Fix Delegated To
[POLA-3288](POLA-3288)
