# ADR-004: Venue Plugin Architecture

## Status
Accepted

## Context
Adding a new prediction market venue (e.g., Opinion) requires touching 10+ files, modifying closed enums, and writing duplicated WebSocket lifecycle code. The system had no shared abstractions for venue configuration, capabilities, or connection management.

## Decision

### 1. VenueConfig Registry (shared-types/venue-config.ts)
Central registry where each venue declares its config (URLs, auth type, capabilities, enabled flag). Replaces hardcoded if-chains in module factories.

### 2. BaseVenueWsService (packages/venue-ws)
Abstract base class providing connection lifecycle, reconnect with exponential backoff, ping/pong, and subscription management. Venue WS services extend this and only implement `handleMessage()` and `sendSubscriptions()`. This class lives in `@polyforge/venue-ws` (not shared-types) to avoid leaking NestJS framework concerns into the shared types package.

### 3. Typed Auth Context
Discriminated union `VenueAuthContext` with `venue` field as discriminant. Replaces `Record<string, unknown>` casts.

### 4. Extensible VenueId
`VenueId = KnownVenueId | (string & {})` — preserves IDE autocomplete for known venues while accepting new ones without modifying shared-types.

### 5. Database Venue Enum Strategy
PostgreSQL enums require `ALTER TYPE ... ADD VALUE` for new entries. Prisma doesn't support this natively. Strategy:
1. Keep Prisma `enum Venue { ... }` as documentation
2. When adding a venue, add the value to the Prisma enum AND create a migration with `ALTER TYPE "Venue" ADD VALUE IF NOT EXISTS '<NAME>'`
3. This is a one-line migration, not a full schema rewrite

## Adding a New Venue — Checklist

1. **shared-types**: Create `venue-configs/<venue>.config.ts` with `registerVenue(...)`, add to index
2. **shared-types/venues.ts**: Add to `KnownVenueId` union (optional — extensible type allows skipping)
3. **Prisma schema**: Add to `enum Venue { ... }`
4. **Migration**: `ALTER TYPE "Venue" ADD VALUE IF NOT EXISTS '<VENUE_NAME>'`
5. **Adapter**: Implement `VenueAdapter` interface in service
6. **WS Service**: Extend `BaseVenueWsService` (from `@polyforge/venue-ws`) — implement `handleMessage()` + `sendSubscriptions()`
7. **Price Feed**: Implement `VenuePriceFeed` interface
8. **Module**: Import adapter + WS service — they auto-register via venue config
9. **Tests**: Unit tests for adapter + WS message handling

## Consequences
- Adding a venue touches ~5 files instead of ~12
- WS services share ~200 LOC of lifecycle code instead of duplicating it
- Module factories iterate the registry instead of checking flags
- Auth context is type-safe at use sites
- Capability queries are data-driven (e.g., "does this venue support 5m candles?")
