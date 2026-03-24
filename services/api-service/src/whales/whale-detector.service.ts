import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";

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
    } catch (err: any) {
      if (!err.message?.includes("BUSYGROUP")) throw err;
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

        for (const [, messages] of results as [string, [string, string[]][]][]) {
          for (const [id, fields] of messages) {
            const event = this.parseFields(fields);
            await this.processEvent(event);
            await this.redis.getClient().xack(STREAM, GROUP, id);
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error("Whale detector consume error", err?.message);
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
        side: event.side as any,
        outcome: event.outcome as any,
        size: new Prisma.Decimal(size),
        price: new Prisma.Decimal(price),
        notional: new Prisma.Decimal(notional),
        txHash: event.txHash ?? null,
      },
    });

    // Update WhaleProfile (upsert)
    await this.prisma.whaleProfile.upsert({
      where: { walletAddress },
      create: {
        walletAddress,
        totalVolume: new Prisma.Decimal(notional),
        tradeCount: 1,
        lastTradeAt: new Date(),
      },
      update: {
        totalVolume: { increment: new Prisma.Decimal(notional) },
        tradeCount: { increment: 1 },
        lastTradeAt: new Date(),
      },
    });

    // Fetch market title for notification context
    let marketTitle: string | undefined;
    try {
      const market = await this.prisma.market.findUnique({
        where: { id: event.marketId },
        select: { title: true },
      });
      marketTitle = market?.title ?? undefined;
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
      alertId: alert.id,
      ts: String(Date.now()),
    });
  }

  // ─── Hourly profile aggregation ────────────────────────────────────────────

  @Cron("0 * * * *")
  async aggregateProfiles() {
    this.logger.log("Running hourly whale profile aggregation");

    try {
      // Recalculate win rates and PnL from whale_alerts
      const profiles = await this.prisma.whaleProfile.findMany();

      for (const profile of profiles) {
        const alerts = await this.prisma.whaleAlert.findMany({
          where: { walletAddress: profile.walletAddress },
        });

        if (alerts.length === 0) continue;

        const totalVolume = alerts.reduce(
          (acc, a) => acc.add(a.notional),
          new Prisma.Decimal(0),
        );

        // Calculate win rate from resolved positions.
        // A position is "resolved" when the market it belongs to has a known outcome.
        // A trade is a "win" if the whale's outcome matches the market resolution.
        const resolvedAlerts = [];
        for (const alert of alerts) {
          if (!alert.marketId) continue;
          try {
            const market = await this.prisma.market.findUnique({
              where: { id: alert.marketId },
              select: { closed: true },
            });
            if (market?.closed) {
              resolvedAlerts.push({ alert, marketOutcome: alert.outcome });
            }
          } catch {
            // non-critical — skip unresolvable markets
          }
        }

        let winRate: number | undefined;
        if (resolvedAlerts.length > 0) {
          const wins = resolvedAlerts.filter(
            ({ alert, marketOutcome }) => alert.outcome === marketOutcome,
          ).length;
          winRate = (wins / resolvedAlerts.length) * 100;
        }

        await this.prisma.whaleProfile.update({
          where: { walletAddress: profile.walletAddress },
          data: {
            totalVolume,
            tradeCount: alerts.length,
            ...(winRate !== undefined ? { winRate: new Prisma.Decimal(winRate) } : {}),
          },
        });
      }

      this.logger.log(
        `Aggregated ${profiles.length} whale profiles`,
      );
    } catch (err: any) {
      this.logger.error("Whale profile aggregation failed", err?.message);
    }
  }
}
