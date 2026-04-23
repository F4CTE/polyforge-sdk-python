import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { Prisma, OrderSide, OrderOutcome } from "@prisma/client";

const STREAM = "stream:events";
const GROUP = "whale-detector";
const CONSUMER = `whale-${process.pid}`;
const DEFAULT_THRESHOLD = 5000;

@Injectable()
export class WhaleDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhaleDetectorService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    this.loopPromise = this.consumeLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loopPromise;
  }

  private async ensureGroup() {
    try {
      await this.redis
        .getClient()
        .xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("BUSYGROUP")) throw err;
    }
  }

  private async getThreshold(): Promise<number> {
    const cached = await this.redis.get("config:whale_threshold");
    if (cached) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_THRESHOLD;
  }

  private async consumeLoop() {
    while (this.running) {
      try {
        const results = await this.redis
          .getClient()
          .xreadgroup(
            "GROUP",
            GROUP,
            CONSUMER,
            "COUNT",
            "100",
            "BLOCK",
            "2000",
            "STREAMS",
            STREAM,
            ">",
          );

        if (!results) continue;

        for (const [, messages] of results as [
          string,
          [string, string[]][],
        ][]) {
          for (const [id, fields] of messages) {
            const event = this.parseFields(fields);
            await this.processEvent(event);
            await this.redis.getClient().xack(STREAM, GROUP, id);
          }
        }
      } catch (err: unknown) {
        if (this.running) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error("Whale detector consume error", msg);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private parseFields(fields: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }

  private async processEvent(event: Record<string, string>) {
    if (event.type !== "ORDER_FILLED") return;

    const size = parseFloat(event.size ?? "0");
    const price = parseFloat(event.price ?? event.fillPrice ?? "0");
    const notional = size * price;

    const threshold = await this.getThreshold();
    if (notional < threshold) return;

    const walletAddress = event.walletAddress;
    if (!walletAddress) return;

    this.logger.log(
      `Whale detected: ${walletAddress} — $${notional.toFixed(2)} on ${event.marketId ?? "unknown"}`,
    );

    // Create WhaleAlert record
    const alert = await this.prisma.whaleAlert.create({
      data: {
        walletAddress,
        marketId: event.marketId ?? "",
        tokenId: event.tokenId ?? "",
        side: event.side as OrderSide,
        outcome: event.outcome as OrderOutcome,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        size: new Prisma.Decimal(size),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        price: new Prisma.Decimal(price),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        notional: new Prisma.Decimal(notional),
        txHash: event.txHash ?? null,
      },
    });

    // Update WhaleProfile (upsert)
    await this.prisma.whaleProfile.upsert({
      where: { walletAddress },
      create: {
        walletAddress,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        totalVolume: new Prisma.Decimal(notional),
        tradeCount: 1,
        lastTradeAt: new Date(),
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        totalVolume: { increment: new Prisma.Decimal(notional) },
        tradeCount: { increment: 1 },
        lastTradeAt: new Date(),
      },
    });

    // Fetch market title and whale classification for notification context
    let marketTitle: string | undefined;
    let classification = "UNKNOWN";
    let label: string | undefined;
    try {
      const [market, profile] = await Promise.all([
        this.prisma.market.findUnique({
          where: { id: event.marketId },
          select: { title: true },
        }),
        this.prisma.whaleProfile.findUnique({
          where: { walletAddress },
          select: { classification: true, label: true },
        }),
      ]);
      marketTitle = market?.title ?? undefined;
      classification = profile?.classification ?? "UNKNOWN";
      label = profile?.label ?? undefined;
    } catch {
      // non-critical
    }

    // Emit WHALE_TRADE event to stream:events
    await this.redis.xadd(STREAM, {
      type: "WHALE_TRADE",
      walletAddress,
      marketId: event.marketId ?? "",
      tokenId: event.tokenId ?? "",
      side: event.side ?? "",
      outcome: event.outcome ?? "",
      notional: notional.toFixed(6),
      marketTitle: marketTitle ?? "",
      classification,
      label: label ?? "",
      alertId: alert.id,
      ts: String(Date.now()),
    });
  }

  // ─── Hourly profile aggregation ────────────────────────────────────────────

  @Cron("0 * * * *")
  async aggregateProfiles() {
    this.logger.log("Running hourly whale profile aggregation");

    try {
      // Single aggregation query: group alerts by wallet
      const aggregations = await this.prisma.whaleAlert.groupBy({
        by: ["walletAddress"],
        _sum: { notional: true },
        _count: true,
      });

      if (aggregations.length === 0) return;

      // Batch fetch all closed markets for win rate calculation
      const closedMarkets = await this.prisma.market.findMany({
        where: { closed: true },
        select: { id: true },
      });
      const _closedMarketIds = new Set(closedMarkets.map((m) => m.id));

      // Batch update all profiles in a transaction
      await this.prisma.$transaction(
        aggregations.map((agg) =>
          this.prisma.whaleProfile.update({
            where: { walletAddress: agg.walletAddress },
            data: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              totalVolume: agg._sum.notional ?? 0,
              tradeCount: agg._count,
            },
          }),
        ),
      );

      this.logger.log(`Aggregated ${aggregations.length} whale profiles`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error("Whale profile aggregation failed", msg);
    }
  }
}
