# Polyforge — Performance Tuning Guide

> Database optimization, caching strategy, query tuning, and scaling guidance for Polyforge.

---

## Database Indexes

### Foreign key indexing

All foreign keys are indexed. Prisma creates indexes on relation fields automatically, but verify with:

```bash
docker exec polyforge_api-service npx prisma db execute --stdin <<< "
  SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    a.attname AS column_name
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE t.relkind = 'r' AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ORDER BY t.relname, i.relname;
"
```

### Composite indexes on frequently filtered columns

Key composite indexes for common query patterns:

```sql
-- Orders by user + status (order history page)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status);

-- Strategies by user + active state (dashboard)
CREATE INDEX IF NOT EXISTS idx_strategies_user_active ON strategies (user_id, is_active);

-- Audit logs by user + timestamp (admin audit view)
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs (user_id, created_at DESC);
```

### Slow query detection

Flag any query exceeding **100ms** for investigation:

```bash
# Enable slow query logging on RDS
aws rds modify-db-parameter-group \
  --db-parameter-group-name polyforge-pg16 \
  --parameters "ParameterName=log_min_duration_statement,ParameterValue=100,ApplyMethod=immediate"
```

Use `EXPLAIN ANALYZE` to diagnose:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT * FROM orders
  WHERE user_id = 'abc-123'
  AND status = 'FILLED'
  ORDER BY created_at DESC
  LIMIT 20;
```

Look for sequential scans on large tables, high buffer reads, and nested loop joins.

### TimescaleDB chunk sizing

The `pnl_snapshots` and `price_snapshots` tables use TimescaleDB hypertables for time-series data:

```sql
-- Check current chunk intervals
SELECT hypertable_name, chunk_sizing_func_schema, chunk_sizing_func_name
FROM timescaledb_information.hypertables;

-- Recommended chunk interval: 1 day for price_snapshots, 1 week for pnl_snapshots
SELECT set_chunk_time_interval('price_snapshots', INTERVAL '1 day');
SELECT set_chunk_time_interval('pnl_snapshots', INTERVAL '1 week');

-- View chunk sizes
SELECT hypertable_name, chunk_name, range_start, range_end,
       pg_size_pretty(total_bytes) AS size
FROM timescaledb_information.chunks
ORDER BY range_start DESC
LIMIT 20;
```

---

## Redis Caching Strategy

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `cache:price:{tokenId}` | 1s | Live price data from Polymarket |
| `cache:book:{tokenId}` | 2s | Order book snapshot |
| `cache:market:{id}` | 2min | Market metadata (title, description, outcomes) |
| `cache:leaderboard:{period}` | 5min | Leaderboard results (daily, weekly, all-time) |
| `cache:discover:{sort}` | 2min | Discover page market listings |

### Cache invalidation

- Price and book caches are short-lived (1–2s) and self-expire — no explicit invalidation needed
- Market metadata cache is invalidated on market data sync from Polymarket APIs
- Leaderboard cache is rebuilt by the scheduled leaderboard job

### Monitoring cache hit rates

```bash
docker exec polyforge_api-service sh -c "redis-cli -u \$REDIS_URL INFO stats" \
  | grep -E "keyspace_hits|keyspace_misses"
```

Target cache hit rate: **> 90%** for market and leaderboard caches.

---

## Query Optimization

### Use Prisma `select` to avoid over-fetching

```typescript
// Bad — fetches all 30+ columns
const user = await prisma.user.findUnique({ where: { id } });

// Good — fetches only what the API response needs
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, username: true, displayName: true, avatarUrl: true },
});
```

### Use `include` with caution (N+1 prevention)

```typescript
// Bad — N+1: fetches strategies, then a query per strategy for orders
const strategies = await prisma.strategy.findMany({ where: { userId } });
for (const s of strategies) {
  s.orders = await prisma.order.findMany({ where: { strategyId: s.id } });
}

// Good — single query with join
const strategies = await prisma.strategy.findMany({
  where: { userId },
  include: { orders: { take: 10, orderBy: { createdAt: 'desc' } } },
});
```

### Batch operations

```typescript
// Use createMany / updateMany for bulk operations
await prisma.notification.createMany({
  data: notifications,
  skipDuplicates: true,
});

await prisma.order.updateMany({
  where: { strategyId, status: 'PENDING' },
  data: { status: 'CANCELLED' },
});
```

### Cursor-based pagination for large datasets

```typescript
// Offset-based pagination degrades on large tables — avoid for > 10K rows
// Use cursor-based pagination instead
const orders = await prisma.order.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastOrderId },
  where: { userId },
  orderBy: { createdAt: 'desc' },
});
```

---

## Strategy Engine Performance

### Tick interval

- Minimum tick interval: **1000ms**
- Default tick interval: **5000ms**
- Configurable per strategy via the UI

### Max concurrent strategies

Concurrent active strategies per user are configurable. Default limits:

| Resource | Limit |
|----------|-------|
| Max active strategies per user | Configurable via admin |
| Max blocks per strategy | 50 |
| Expression character limit | 200 chars |
| Expression evaluation timeout | Built-in (200 char cap prevents runaway expressions) |

### Block evaluation order

Each tick evaluates blocks in a deterministic, safe order:

1. **Safety blocks** — stop-loss, max-position checks
2. **Trigger blocks** — price thresholds, time-based triggers
3. **Condition blocks** — boolean logic, comparisons
4. **Logic blocks** — if/then/else, switch
5. **Calc blocks** — arithmetic, rolling averages
6. **Action blocks** — place order, cancel order, notify

Safety blocks always execute first so risk limits are enforced before any trading logic runs.

---

## Frontend Performance

### Route-based code splitting

```typescript
// React.lazy for route-level code splitting
const StrategyBuilder = React.lazy(() => import('./pages/StrategyBuilder'));
const Backtest = React.lazy(() => import('./pages/Backtest'));
const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
```

### Chart lazy loading

Recharts components are lazy-loaded to reduce initial bundle size. Charts only load when the user navigates to a page that uses them.

### Image optimization

- WebP format for all static images
- Lazy loading via `loading="lazy"` on below-the-fold images
- Responsive image sizing with `srcset`

### Debounced search

Search inputs use **300ms debounce** to prevent excessive API calls during typing:

```typescript
const debouncedSearch = useDebouncedCallback((query: string) => {
  searchMarkets(query);
}, 300);
```

### Virtual scrolling (future)

For lists exceeding 100 items (e.g., market discover, order history), virtual scrolling is planned to render only visible rows.

---

## Monitoring Metrics

### Target latencies

| Metric | Target | Alert threshold |
|--------|--------|-----------------|
| API p95 latency | < 500ms | > 800ms |
| API p99 latency | < 1000ms | > 2000ms |
| WebSocket message latency | < 100ms | > 500ms |
| Strategy tick evaluation | < 50ms | > 200ms |
| Database query p95 | < 100ms | > 300ms |

### CloudWatch dashboards

Key metrics to monitor:

```bash
# API latency (from CloudWatch custom metrics)
aws cloudwatch get-metric-statistics \
  --namespace Polyforge \
  --metric-name APILatency \
  --statistics p95 p99 Average \
  --period 300 \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)"

# RDS performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=polyforge-db \
  --metric-name ReadLatency \
  --statistics Average p95 \
  --period 300 \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)"
```

### RDS Performance Insights

Performance Insights is enabled on the RDS instance (`--enable-performance-insights`). Use it to identify:

- Top SQL queries by wait time
- Lock contention
- I/O bottlenecks

Access via AWS Console → RDS → Performance Insights, or:

```bash
aws pi get-resource-metrics \
  --service-type RDS \
  --identifier "db-<instance-resource-id>" \
  --metric-queries '[{"Metric":"db.load.avg"}]' \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --period-in-seconds 300
```

---

## Scaling Checklist

Use this checklist when scaling becomes necessary (sustained high load, latency targets exceeded):

```
Database
  ☐ RDS read replicas for read-heavy queries (leaderboard, discover, market data)
  ☐ PgBouncer pool size tuning (default: 20 connections per service)
  ☐ TimescaleDB compression on old chunks (> 7 days)
  ☐ Partition large tables if row count exceeds 100M

Redis
  ☐ Redis cluster mode for > 10K concurrent connections
  ☐ Increase ElastiCache node size (cache.t3.micro → cache.t3.medium)
  ☐ Separate Redis instances for cache vs. pub/sub

Compute
  ☐ EC2 auto-scaling group (horizontal) behind ALB
  ☐ Move background workers to separate EC2 instance
  ☐ Strategy engine horizontal scaling (partition by user)

Network
  ☐ CDN for frontend assets (CloudFront)
  ☐ WebSocket sticky sessions with ALB
  ☐ API rate limiting tuning (per-user, per-endpoint)

Monitoring
  ☐ Set up latency-based alerts for all targets above
  ☐ Enable RDS Enhanced Monitoring (1-second granularity)
  ☐ Add custom metrics for strategy engine tick duration
```

---

*Previous: [Incident Response](./15-incident-response.md)*
