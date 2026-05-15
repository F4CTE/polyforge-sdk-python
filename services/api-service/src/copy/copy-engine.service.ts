import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import {
  PelReclaimService,
  RedisService,
  StreamMonitorService,
} from "@polyforge/shared-redis";
import { randomUUID } from "node:crypto";
import {
  type CopyConfig,
  Prisma,
  OrderSide,
  OrderOutcome,
} from "@prisma/client";
import { isFiniteDecimal, safeDecimalToNumber } from "@polyforge/shared-types";
import { tryChecksumEthereumAddress } from "./wallet-address";

const STREAM = "stream:events";
const ORDER_STREAM = "stream:orders";
const GROUP = "copy-engine";
const CONSUMER = `copy-${process.pid}`;
const PEL_MIN_IDLE_MS = 30_000;
const DAILY_LOSS_TTL_SECONDS = 86_400;
const DAILY_LOSS_RESERVE_SCRIPT = `
local value = redis.call("INCRBYFLOAT", KEYS[1], ARGV[1])
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return value
`;

@Injectable()
export class CopyEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyEngineService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly streamMonitor?: StreamMonitorService,
    private readonly pelReclaim?: PelReclaimService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.streamMonitor?.register({ stream: STREAM, group: GROUP });
    this.pelReclaim?.register({
      stream: STREAM,
      group: GROUP,
      consumer: CONSUMER,
      minIdleMs: PEL_MIN_IDLE_MS,
      handler: async (entry) => {
        await this.processStreamEvent(entry.fields);
      },
    });
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
            await this.processStreamEvent(event);
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

  private async processStreamEvent(event: Record<string, string>) {
    if (event.type === "WHALE_TRADE") {
      await this.handleWhaleTrade(event);
    } else if (event.type === "ORDER_FILLED" && event.copyTradeId) {
      await this.reconcileCopyTrade(event);
    } else if (event.type === "ORDER_CANCELLED" && event.copyTradeId) {
      await this.handleCopyTradeCancelled(event);
    }
  }

  // ─── Handle Whale Trade ──────────────────────────────────────────────────────

  async handleWhaleTrade(event: Record<string, string>) {
    const walletAddress = event.walletAddress
      ? await tryChecksumEthereumAddress(event.walletAddress)
      : null;
    if (!walletAddress) return;

    // Find all ACTIVE copy configs targeting this wallet
    // Use case-insensitive match to support legacy non-checksummed rows as well
    // as checksummed writes. The functional index CopyConfig_targetWallet_lower_idx
    // on lower(targetWallet) supports this query efficiently.
    const configs = await this.prisma.copyConfig.findMany({
      where: {
        targetWallet: { equals: walletAddress, mode: "insensitive" },
        status: "ACTIVE",
      },
    });

    if (configs.length === 0) return;

    this.logger.log(
      `Processing whale trade from ${walletAddress} for ${configs.length} copy config(s)`,
    );

    if (!isFiniteDecimal(event.notional) || !isFiniteDecimal(event.price)) {
      this.logger.warn(
        `Skipping whale trade from ${walletAddress}: invalid numeric input`,
      );
      return;
    }

    const sourceSize = safeDecimalToNumber(event.notional);
    const sourcePrice = safeDecimalToNumber(event.price);
    if (sourceSize <= 0 || sourcePrice < 0) return;

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
    // Normalize the wallet address to a consistent canonical form so that
    // sourceWallet and stream-published targetWallet fields are always
    // EIP-55 checksummed (or at least lowercase on failure).
    const walletAddress =
      (await tryChecksumEthereumAddress(event.walletAddress)) ?? event.walletAddress;

    // 1. Check daily loss limit (H-02: use Redis atomic operations to prevent race condition)
    const notional = sourceSize * sourcePrice;
    if (!Number.isFinite(notional) || notional <= 0) return;

    const maxDailyLoss = safeDecimalToNumber(config.maxDailyLoss, Number.NaN);
    if (!Number.isFinite(maxDailyLoss) || maxDailyLoss < 0) {
      this.logger.warn(`Config ${config.id} has invalid daily loss limit`);
      return;
    }

    const dailyKey = `copy:${config.id}:daily_loss`;
    const client = this.redis.getClient();
    const reserveDailyLoss = async (amount: number) =>
      client.eval(
        DAILY_LOSS_RESERVE_SCRIPT,
        1,
        dailyKey,
        String(amount),
        String(DAILY_LOSS_TTL_SECONDS),
      );

    const newLoss = await reserveDailyLoss(notional);
    const newLossAmount = safeDecimalToNumber(
      newLoss,
      Number.POSITIVE_INFINITY,
    );
    if (newLossAmount > maxDailyLoss) {
      // Rollback the increment
      await reserveDailyLoss(-notional);
      this.logger.warn(`Config ${config.id} exceeded daily loss limit`);
      return;
    }

    // 2. Check max exposure
    const currentExposure = await this.getCurrentExposure(config.id);
    const maxExposure = safeDecimalToNumber(config.maxExposure, Number.NaN);
    if (!Number.isFinite(maxExposure) || maxExposure < 0) {
      await reserveDailyLoss(-notional);
      this.logger.warn(`Config ${config.id} has invalid max exposure`);
      return;
    }
    if (currentExposure >= maxExposure) {
      await reserveDailyLoss(-notional);
      this.logger.warn(
        `Config ${config.id} at max exposure (${currentExposure} >= ${maxExposure})`,
      );
      return;
    }

    // 3. Calculate copy size based on mode
    const copiedSize = this.calculateCopySize(
      config.mode,
      safeDecimalToNumber(config.sizeValue, Number.NaN),
      sourceSize,
    );

    if (!Number.isFinite(copiedSize) || copiedSize <= 0) {
      await reserveDailyLoss(-notional);
      return;
    }

    // 4. Apply price offset
    const priceOffset = safeDecimalToNumber(config.priceOffset, 0);
    const copiedPrice = this.applyPriceOffset(sourcePrice, priceOffset);
    if (!Number.isFinite(copiedPrice) || copiedPrice < 0) {
      await reserveDailyLoss(-notional);
      return;
    }

    // 5. Create CopyTrade record
    const trade = await this.prisma.copyTrade.create({
      data: {
        configId: config.id,
        sourceWallet: walletAddress,
        sourceTxHash: event.txHash ?? null,
        marketId: event.marketId ?? "",
        tokenId: event.tokenId ?? "",
        side: event.side as OrderSide,
        outcome: event.outcome as OrderOutcome,

        sourceSize: new Prisma.Decimal(sourceSize),

        sourcePrice: new Prisma.Decimal(sourcePrice),

        copiedSize: new Prisma.Decimal(copiedSize),

        copiedPrice: new Prisma.Decimal(copiedPrice),
        status: "PENDING",
      },
    });

    const intentId = randomUUID();
    try {
      // 6. Publish OrderIntent to stream:orders
      await this.redis.xadd(ORDER_STREAM, {
        type: "ORDER_INTENT",
        intentId,
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
    } catch (err) {
      await Promise.allSettled([
        this.prisma.copyTrade.update({
          where: { id: trade.id },
          data: { status: "FAILED" },
        }),
        reserveDailyLoss(-notional),
        this.redis.del(`copy:${config.id}:exposure`),
      ]);
      throw err;
    }

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
      targetWallet: walletAddress,
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
    if (!Number.isFinite(sizeValue) || !Number.isFinite(sourceSize)) return 0;

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
    if (!Number.isFinite(sourcePrice) || !Number.isFinite(offsetPercent)) {
      return Number.NaN;
    }
    return sourcePrice * (1 + offsetPercent / 100);
  }

  // ─── Risk Checks ─────────────────────────────────────────────────────────────

  private async getDailyPnl(configId: string): Promise<number> {
    const cached = await this.redis.get(`copy:${configId}:daily_pnl`);
    if (cached) {
      const parsed = safeDecimalToNumber(cached, Number.NaN);
      if (Number.isFinite(parsed)) return parsed;
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

    const total = trades.reduce(
      (acc, t) => acc + safeDecimalToNumber(t.pnl, 0),
      0,
    );

    // Cache for 5 minutes
    await this.redis.set(`copy:${configId}:daily_pnl`, total.toString(), 300);

    return total;
  }

  private async getCurrentExposure(configId: string): Promise<number> {
    // Check Redis cache first (updated atomically on trade events)
    const cached = await this.redis.get(`copy:${configId}:exposure`);
    if (cached) return safeDecimalToNumber(cached, 0);

    // Fallback: compute from DB and cache
    const pendingTrades = await this.prisma.copyTrade.findMany({
      where: {
        configId,
        status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
      },
      select: { copiedSize: true },
    });

    const total = pendingTrades.reduce(
      (acc, t) => acc + safeDecimalToNumber(t.copiedSize, 0),
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
