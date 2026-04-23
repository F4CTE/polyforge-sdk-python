import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import {
  type CopyConfig,
  Prisma,
  OrderSide,
  OrderOutcome,
} from "@prisma/client";

const STREAM = "stream:events";
const ORDER_STREAM = "stream:orders";
const GROUP = "copy-engine";
const CONSUMER = `copy-${process.pid}`;

@Injectable()
export class CopyEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyEngineService.name);
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
            if (event.type === "WHALE_TRADE") {
              await this.handleWhaleTrade(event);
            } else if (event.type === "ORDER_FILLED" && event.copyTradeId) {
              await this.reconcileCopyTrade(event);
            } else if (event.type === "ORDER_CANCELLED" && event.copyTradeId) {
              await this.handleCopyTradeCancelled(event);
            }
            await this.redis.getClient().xack(STREAM, GROUP, id);
          }
        }
      } catch (err: unknown) {
        if (this.running) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error("Copy engine consume error", msg);
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

  // ─── Handle Whale Trade ──────────────────────────────────────────────────────

  async handleWhaleTrade(event: Record<string, string>) {
    const walletAddress = event.walletAddress;
    if (!walletAddress) return;

    // Find all ACTIVE copy configs targeting this wallet
    const configs = await this.prisma.copyConfig.findMany({
      where: {
        targetWallet: walletAddress,
        status: "ACTIVE",
      },
    });

    if (configs.length === 0) return;

    this.logger.log(
      `Processing whale trade from ${walletAddress} for ${configs.length} copy config(s)`,
    );

    const sourceSize = parseFloat(event.notional ?? "0");
    const sourcePrice = parseFloat(event.price ?? "0.5");

    for (const config of configs) {
      try {
        await this.processCopyForConfig(config, event, sourceSize, sourcePrice);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Copy failed for config ${config.id}: ${msg}`);

        // Emit failure notification (H-03: don't expose internal error messages)
        await this.redis.xadd(STREAM, {
          type: "COPY_TRADE_FAILED",
          userId: config.userId,
          configId: config.id,
          targetWallet: walletAddress,
          error: "Copy trade failed",
          ts: String(Date.now()),
        });
      }
    }
  }

  async processCopyForConfig(
    config: CopyConfig,
    event: Record<string, string>,
    sourceSize: number,
    sourcePrice: number,
  ) {
    // 1. Check daily loss limit (H-02: use Redis atomic operations to prevent race condition)
    const notional = sourceSize * sourcePrice;
    const maxDailyLoss = parseFloat(String(config.maxDailyLoss));
    const dailyKey = `copy:${config.id}:daily_loss`;
    const client = this.redis.getClient();
    const newLoss = await client.incrbyfloat(dailyKey, notional);
    // Set TTL to expire at end of day (24h) — ensures counter resets daily
    await client.expire(dailyKey, 86400);
    if (parseFloat(String(newLoss)) > maxDailyLoss) {
      // Rollback the increment
      await client.incrbyfloat(dailyKey, -notional);
      this.logger.warn(`Config ${config.id} exceeded daily loss limit`);
      return;
    }

    // 2. Check max exposure
    const currentExposure = await this.getCurrentExposure(config.id);
    const maxExposure = parseFloat(String(config.maxExposure));
    if (currentExposure >= maxExposure) {
      this.logger.warn(
        `Config ${config.id} at max exposure (${currentExposure} >= ${maxExposure})`,
      );
      return;
    }

    // 3. Calculate copy size based on mode
    const copiedSize = this.calculateCopySize(
      config.mode,
      parseFloat(String(config.sizeValue)),
      sourceSize,
    );

    if (copiedSize <= 0) return;

    // 4. Apply price offset
    const priceOffset = parseFloat(String(config.priceOffset));
    const copiedPrice = this.applyPriceOffset(sourcePrice, priceOffset);

    // 5. Create CopyTrade record
    const trade = await this.prisma.copyTrade.create({
      data: {
        configId: config.id,
        sourceWallet: event.walletAddress,
        sourceTxHash: event.txHash ?? null,
        marketId: event.marketId ?? "",
        tokenId: event.tokenId ?? "",
        side: event.side as OrderSide,
        outcome: event.outcome as OrderOutcome,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        sourceSize: new Prisma.Decimal(sourceSize),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        sourcePrice: new Prisma.Decimal(sourcePrice),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        copiedSize: new Prisma.Decimal(copiedSize),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        copiedPrice: new Prisma.Decimal(copiedPrice),
        status: "PENDING",
      },
    });

    // 6. Publish OrderIntent to stream:orders
    await this.redis.xadd(ORDER_STREAM, {
      type: "ORDER_INTENT",
      userId: config.userId,
      source: "copy-engine",
      copyTradeId: trade.id,
      marketId: event.marketId ?? "",
      tokenId: event.tokenId ?? "",
      side: event.side ?? "",
      outcome: event.outcome ?? "",
      size: copiedSize.toFixed(6),
      price: copiedPrice.toFixed(6),
      orderType: "GTC",
      ts: String(Date.now()),
    });

    // 7. Update config stats
    await this.prisma.copyConfig.update({
      where: { id: config.id },
      data: { totalCopied: { increment: 1 } },
    });

    // 8. Emit success notification
    await this.redis.xadd(STREAM, {
      type: "COPY_TRADE_EXECUTED",
      userId: config.userId,
      configId: config.id,
      tradeId: trade.id,
      targetWallet: event.walletAddress,
      marketId: event.marketId ?? "",
      side: event.side ?? "",
      copiedSize: copiedSize.toFixed(6),
      ts: String(Date.now()),
    });

    this.logger.log(
      `Copy trade created: ${trade.id} — ${copiedSize.toFixed(2)} @ ${copiedPrice.toFixed(4)} for config ${config.id}`,
    );
  }

  // ─── Size Calculation ────────────────────────────────────────────────────────

  calculateCopySize(
    mode: string,
    sizeValue: number,
    sourceSize: number,
  ): number {
    switch (mode) {
      case "PERCENTAGE":
        return (sizeValue / 100) * sourceSize;
      case "FIXED":
        return sizeValue;
      case "MIRROR":
        return sourceSize;
      default:
        return 0;
    }
  }

  // ─── Price Offset ────────────────────────────────────────────────────────────

  applyPriceOffset(sourcePrice: number, offsetPercent: number): number {
    return sourcePrice * (1 + offsetPercent / 100);
  }

  // ─── Risk Checks ─────────────────────────────────────────────────────────────

  private async getDailyPnl(configId: string): Promise<number> {
    const cached = await this.redis.get(`copy:${configId}:daily_pnl`);
    if (cached) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed)) return parsed;
    }

    // Fallback: calculate from today's trades
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const trades = await this.prisma.copyTrade.findMany({
      where: {
        configId,
        createdAt: { gte: todayStart },
        pnl: { not: null },
      },
      select: { pnl: true },
    });

    const total = trades.reduce((acc, t) => acc + parseFloat(String(t.pnl)), 0);

    // Cache for 5 minutes
    await this.redis.set(`copy:${configId}:daily_pnl`, total.toString(), 300);

    return total;
  }

  private async getCurrentExposure(configId: string): Promise<number> {
    // Check Redis cache first (updated atomically on trade events)
    const cached = await this.redis.get(`copy:${configId}:exposure`);
    if (cached) return parseFloat(cached);

    // Fallback: compute from DB and cache
    const pendingTrades = await this.prisma.copyTrade.findMany({
      where: {
        configId,
        status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
      },
      select: { copiedSize: true },
    });

    const total = pendingTrades.reduce(
      (acc, t) => acc + parseFloat(String(t.copiedSize)),
      0,
    );

    await this.redis.set(`copy:${configId}:exposure`, total.toString(), 30);
    return total;
  }

  // ─── Order Reconciliation ───────────────────────────────────────────────────

  async reconcileCopyTrade(event: Record<string, string>) {
    const copyTradeId = event.copyTradeId;
    if (!copyTradeId) return;

    const fillPrice = parseFloat(event.fillPrice ?? event.price ?? "0");
    const orderId = event.orderId ?? null;

    try {
      const trade = await this.prisma.copyTrade.findUnique({
        where: { id: copyTradeId },
        include: { config: { select: { userId: true } } },
      });

      if (!trade) return;

      const entryPrice = parseFloat(
        String(trade.copiedPrice ?? trade.sourcePrice),
      );
      const size = parseFloat(String(trade.copiedSize));

      const pnl =
        trade.side === "BUY"
          ? (fillPrice - entryPrice) * size
          : (entryPrice - fillPrice) * size;

      await this.prisma.copyTrade.update({
        where: { id: copyTradeId },
        data: {
          status: "CONFIRMED",
          orderId,
          copiedPrice: new Prisma.Decimal(fillPrice),
          pnl: new Prisma.Decimal(pnl.toFixed(6)),
        },
      });

      // Update config total PnL
      await this.prisma.copyConfig.update({
        where: { id: trade.configId },
        data: { totalPnl: { increment: pnl } },
      });

      // Update exposure cache
      await this.redis.del(`copy:${trade.configId}:exposure`);

      this.logger.log(
        `Reconciled copy trade ${copyTradeId}: PnL=${pnl.toFixed(2)}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to reconcile copy trade ${copyTradeId}: ${msg}`,
      );
    }
  }

  async handleCopyTradeCancelled(event: Record<string, string>) {
    const copyTradeId = event.copyTradeId;
    if (!copyTradeId) return;

    try {
      const trade = await this.prisma.copyTrade.findUnique({
        where: { id: copyTradeId },
      });

      if (!trade || trade.status === "CONFIRMED") return;

      await this.prisma.copyTrade.update({
        where: { id: copyTradeId },
        data: { status: "CANCELLED" },
      });

      await this.redis.del(`copy:${trade.configId}:exposure`);

      this.logger.log(`Copy trade ${copyTradeId} cancelled`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to cancel copy trade ${copyTradeId}: ${msg}`);
    }
  }
}
