import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { PriceUpdateEvent, BookUpdateEvent } from '../market-sync/polymarket-ws.service';

const PRICE_TTL = 10;  // seconds
const BOOK_TTL  = 5;   // seconds

// Batch price snapshots to TimescaleDB — flush every 5 seconds
const SNAPSHOT_FLUSH_MS = 5_000;
const SNAPSHOT_BATCH_SIZE = 200;

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
export class PriceCacheService {
    private readonly logger = new Logger(PriceCacheService.name);

    // Buffer for batching TimescaleDB writes
    private readonly snapshotBuffer = new Map<string, PendingSnapshot>();
    private flushTimer: NodeJS.Timeout | null = null;

    // Data gap detection: tracks last update per tokenId
    private readonly lastUpdateMs = new Map<string, number>();
    private readonly GAP_THRESHOLD_MS = 30_000; // 30s without update = gap

    constructor(
        private readonly redis: RedisService,
        private readonly prisma: PrismaService,
    ) {
        this.startFlushTimer();
        this.startGapDetection();
    }

    // ─── Event handlers ───────────────────────────────────────────────────────

    @OnEvent('market-data.price')
    async handlePriceUpdate(event: PriceUpdateEvent) {
        const { tokenId, price, timestamp } = event;

        // Update Redis cache (TTL 10s)
        await this.redis.set(
            `cache:price:${tokenId}`,
            JSON.stringify({ price, timestamp }),
            PRICE_TTL,
        );

        // Update token price in DB (non-blocking)
        this.prisma.token.updateMany({
            where: { id: tokenId },
            data: { price },
        }).catch(err => this.logger.error(`Failed to update token price for ${tokenId}`, err));

        // Buffer for TimescaleDB snapshot
        this.bufferSnapshot(tokenId, price, timestamp);

        this.lastUpdateMs.set(tokenId, Date.now());
    }

    @OnEvent('market-data.book')
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
            existing.high  = Math.max(existing.high, price);
            existing.low   = Math.min(existing.low, price);
            existing.close = price;
        }
    }

    private startFlushTimer() {
        this.flushTimer = setInterval(() => this.flushSnapshots(), SNAPSHOT_FLUSH_MS);
    }

    private async flushSnapshots() {
        if (this.snapshotBuffer.size === 0) return;

        const snapshots = [...this.snapshotBuffer.values()].slice(0, SNAPSHOT_BATCH_SIZE);
        this.snapshotBuffer.clear();

        try {
            await this.prisma.$executeRaw`
                INSERT INTO price_snapshots (time, "tokenId", open, high, low, close, volume)
                VALUES ${snapshots.map(s =>
                    `('${s.time.toISOString()}', '${s.tokenId}', ${s.open}, ${s.high}, ${s.low}, ${s.close}, ${s.volume})`
                ).join(', ')}
                ON CONFLICT (time, "tokenId") DO UPDATE
                SET high = GREATEST(price_snapshots.high, EXCLUDED.high),
                    low  = LEAST(price_snapshots.low, EXCLUDED.low),
                    close = EXCLUDED.close
            `;
        } catch (err) {
            this.logger.error('Failed to flush price snapshots to TimescaleDB', err);
            // Re-buffer failed snapshots (best-effort)
        }
    }

    // ─── Data gap detection ───────────────────────────────────────────────────

    private startGapDetection() {
        setInterval(() => this.detectGaps(), 15_000);
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

    private async recordDataGap(tokenId: string, gapStart: Date, gapEnd: Date) {
        try {
            await this.prisma.dataGap.create({
                data: {
                    tokenId,
                    gapStart,
                    gapEnd,
                    reason: 'WebSocket feed interrupted',
                },
            });
            this.logger.warn(`Data gap recorded for token ${tokenId}: ${gapStart.toISOString()} → ${gapEnd.toISOString()}`);
        } catch {
            // don't crash on gap recording failure
        }
    }
}
