import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import {
  PriceUpdateEvent,
  BookUpdateEvent,
} from "../market-sync/polymarket-ws.service";

const PRICE_TTL = 10; // seconds
const BOOK_TTL = 5; // seconds
const TA_PRICE_TTL = 86_400; // 24h
const TA_MAX_WINDOW = 250;

// Batch price snapshots to TimescaleDB at production tick volume.
const SNAPSHOT_FLUSH_MS = 1_000;
const SNAPSHOT_BATCH_SIZE = 5_000;

interface PendingSnapshot {
  tokenId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: Date;
}

@Injectable()
export class PriceCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(PriceCacheService.name);

  // Buffer for batching TimescaleDB writes
  private readonly snapshotBuffer = new Map<string, PendingSnapshot>();
  private flushTimer: NodeJS.Timeout | null = null;

  // Buffer for batching token price DB updates (instead of one write per tick)
  private readonly priceUpdateBuffer = new Map<string, number>();
  private priceFlushTimer: NodeJS.Timeout | null = null;

  // Per-venue disconnect epoch — incremented on disconnect and reconnect
  // so in-flight batch deletes can detect reconnects and abort early.
  private readonly disconnectEpoch = new Map<string, number>();

  // Data gap detection: tracks last update per tokenId
  private readonly lastUpdateMs = new Map<string, number>();
  private readonly GAP_THRESHOLD_MS = 30_000; // 30s without update = gap
  private gapDetectionTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.startFlushTimer();
    this.startPriceFlushTimer();
    this.startGapDetection();
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  @OnEvent("market-data.price")
  async handlePriceUpdate(event: PriceUpdateEvent) {
    const { tokenId, price, timestamp } = event;

    // Update Redis cache (TTL 10s)
    await this.redis.set(
      `cache:price:${tokenId}`,
      JSON.stringify({ price, timestamp }),
      PRICE_TTL,
    );

    // Push into TA price window sorted set (ta:prices:{tokenId})
    await this.writeTaPricePoint(tokenId, price, timestamp);

    // Buffer token price for batched DB write (every 5s instead of per-tick)
    this.priceUpdateBuffer.set(tokenId, price);

    // Buffer for TimescaleDB snapshot
    this.bufferSnapshot(tokenId, price, timestamp);

    this.lastUpdateMs.set(tokenId, Date.now());
  }

  // Cache keys are NOT venue-prefixed because token IDs are venue-isolated
  // by construction: Polymarket uses UUID asset_ids, Kalshi uses market
  // ticker strings, and the disconnect event's tokenIds come from the
  // per-venue subscription set, so there is no cross-venue key collision.

  @OnEvent("market-data.ws.disconnected")
  async handleFeedDisconnected(event: { venueId: string; tokenIds: string[] }) {
    const { venueId, tokenIds } = event;
    if (tokenIds.length === 0) return;

    // Bump the disconnect epoch so any prior in-flight cleanup sees it
    // and aborts. A subsequent reconnect bumps again (see handleFeedConnected).
    const epoch = (this.disconnectEpoch.get(venueId) ?? 0) + 1;
    this.disconnectEpoch.set(venueId, epoch);

    this.logger.warn(
      `${venueId} WS disconnected — expiring cached prices for ${tokenIds.length} tokens`,
    );

    const client = this.redis.getClient();
    const priceKeys = tokenIds.map((id) => `cache:price:${id}`);
    const bookKeys = tokenIds.map((id) => `cache:book:${id}`);

    try {
      const allKeys = [...priceKeys, ...bookKeys];
      const BATCH = 200;
      for (let i = 0; i < allKeys.length; i += BATCH) {
        // If the venue reconnected while we were deleting, abort the
        // remaining batches to avoid deleting freshly repopulated keys.
        if (this.disconnectEpoch.get(venueId) !== epoch) {
          this.logger.log(
            `${venueId} WS reconnected during cache expiry — aborting remaining deletes (${allKeys.length - i} keys skipped)`,
          );
          return;
        }
        await client.del(...allKeys.slice(i, i + BATCH));
      }
      this.logger.log(
        `Expired ${allKeys.length} cache keys for disconnected ${venueId} feed`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to expire cached prices on ${venueId} WS disconnect`,
        err,
      );
    }
  }

  @OnEvent("market-data.ws.connected")
  handleFeedConnected(event: { venueId: string }) {
    // Increment the epoch to abort any in-flight disconnect cleanup
    // that may still be deleting cache keys from the prior disconnect.
    const epoch = (this.disconnectEpoch.get(event.venueId) ?? 0) + 1;
    this.disconnectEpoch.set(event.venueId, epoch);

    this.logger.log(
      `${event.venueId} WS reconnected — fresh prices will begin flowing`,
    );
  }

  @OnEvent("market-data.book")
  async handleBookUpdate(event: BookUpdateEvent) {
    const { tokenId, bids, asks, midpoint, spread, timestamp } = event;

    // Update Redis cache (TTL 5s)
    await this.redis.set(
      `cache:book:${tokenId}`,
      JSON.stringify({ bids, asks, midpoint, spread, timestamp }),
      BOOK_TTL,
    );
  }

  // ─── Snapshot buffering ───────────────────────────────────────────────────

  private bufferSnapshot(tokenId: string, price: number, _timestamp: number) {
    const existing = this.snapshotBuffer.get(tokenId);

    if (!existing) {
      this.snapshotBuffer.set(tokenId, {
        tokenId,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        time: new Date(),
      });
    } else {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(
      () => void this.flushSnapshots(),
      SNAPSHOT_FLUSH_MS,
    );
  }

  private startPriceFlushTimer() {
    this.priceFlushTimer = setInterval(
      () => void this.flushPriceUpdates(),
      SNAPSHOT_FLUSH_MS,
    );
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.priceFlushTimer) {
      clearInterval(this.priceFlushTimer);
      this.priceFlushTimer = null;
    }
    if (this.gapDetectionTimer) {
      clearInterval(this.gapDetectionTimer);
      this.gapDetectionTimer = null;
    }
  }

  /** Batch-flush buffered token prices to DB every 5s instead of per-tick */
  private async flushPriceUpdates() {
    if (this.priceUpdateBuffer.size === 0) return;
    const entries = [...this.priceUpdateBuffer.entries()];
    this.priceUpdateBuffer.clear();
    try {
      await this.prisma.$transaction(
        entries.map(([id, price]) =>
          this.prisma.token.updateMany({ where: { id }, data: { price } }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to flush ${entries.length} token price updates`,
        err,
      );
    }
  }

  private async flushSnapshots() {
    if (this.snapshotBuffer.size === 0) return;

    // Fix: only delete flushed entries, not the entire buffer
    const entries = [...this.snapshotBuffer.entries()].slice(
      0,
      SNAPSHOT_BATCH_SIZE,
    );
    const snapshots = entries.map(([, v]) => v);
    for (const [key] of entries) {
      this.snapshotBuffer.delete(key);
    }

    try {
      await this.prisma.priceSnapshot.createMany({
        data: snapshots.map((s) => ({
          time: s.time,
          tokenId: s.tokenId,
          open: s.open,
          high: s.high,
          low: s.low,
          close: s.close,
          volume: s.volume,
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.error("Failed to flush price snapshots to TimescaleDB", err);
      // Re-buffer failed snapshots (best-effort)
    }
  }

  // ─── Data gap detection ───────────────────────────────────────────────────

  private startGapDetection() {
    this.gapDetectionTimer = setInterval(() => void this.detectGaps(), 15_000);
  }

  private async detectGaps() {
    const now = Date.now();

    for (const [tokenId, lastMs] of this.lastUpdateMs) {
      const ageMs = now - lastMs;

      if (ageMs > this.GAP_THRESHOLD_MS) {
        await this.recordDataGap(tokenId, new Date(lastMs), new Date());
        this.lastUpdateMs.delete(tokenId);
      }
    }
  }

  // ─── TA price window ──────────────────────────────────────────────────────

  private async writeTaPricePoint(
    tokenId: string,
    price: number,
    timestamp: number,
  ) {
    const client = this.redis.getClient();
    const k = `ta:prices:${tokenId}`;
    const pipeline = client.pipeline();
    pipeline.zadd(k, timestamp, `${timestamp}:${price}`);
    pipeline.zremrangebyrank(k, 0, -(TA_MAX_WINDOW + 1));
    pipeline.expire(k, TA_PRICE_TTL);
    const results = await pipeline.exec();
    if (results) {
      const cmdErr = results.find(([err]) => err !== null);
      if (cmdErr) {
        this.logger.warn(
          `Redis pipeline error in writeTaPricePoint for ${tokenId}: ${cmdErr[0]?.message}`,
        );
      }
    }
  }

  private async recordDataGap(tokenId: string, gapStart: Date, gapEnd: Date) {
    try {
      await this.prisma.dataGap.create({
        data: {
          tokenId,
          gapStart,
          gapEnd,
          reason: "WebSocket feed interrupted",
        },
      });
      this.logger.warn(
        `Data gap recorded for token ${tokenId}: ${gapStart.toISOString()} → ${gapEnd.toISOString()}`,
      );
    } catch {
      // don't crash on gap recording failure
    }
  }
}
