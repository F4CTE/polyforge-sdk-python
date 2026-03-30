"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CopyEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyEngineService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const client_1 = require("@prisma/client");
const STREAM = "stream:events";
const ORDER_STREAM = "stream:orders";
const GROUP = "copy-engine";
const CONSUMER = `copy-${process.pid}`;
let CopyEngineService = CopyEngineService_1 = class CopyEngineService {
    prisma;
    redis;
    logger = new common_1.Logger(CopyEngineService_1.name);
    running = false;
    loopPromise = null;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async onModuleInit() {
        await this.ensureGroup();
        this.running = true;
        this.loopPromise = this.consumeLoop();
    }
    async onModuleDestroy() {
        this.running = false;
        await this.loopPromise;
    }
    async ensureGroup() {
        try {
            await this.redis
                .getClient()
                .xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
        }
        catch (err) {
            if (!err.message?.includes("BUSYGROUP"))
                throw err;
        }
    }
    async consumeLoop() {
        while (this.running) {
            try {
                const results = await this.redis
                    .getClient()
                    .xreadgroup("GROUP", GROUP, CONSUMER, "COUNT", "100", "BLOCK", "2000", "STREAMS", STREAM, ">");
                if (!results)
                    continue;
                for (const [, messages] of results) {
                    for (const [id, fields] of messages) {
                        const event = this.parseFields(fields);
                        if (event.type === "WHALE_TRADE") {
                            await this.handleWhaleTrade(event);
                        }
                        await this.redis.getClient().xack(STREAM, GROUP, id);
                    }
                }
            }
            catch (err) {
                if (this.running) {
                    this.logger.error("Copy engine consume error", err?.message);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }
    }
    parseFields(fields) {
        const obj = {};
        for (let i = 0; i < fields.length; i += 2) {
            obj[fields[i]] = fields[i + 1];
        }
        return obj;
    }
    // ─── Handle Whale Trade ──────────────────────────────────────────────────────
    async handleWhaleTrade(event) {
        const walletAddress = event.walletAddress;
        if (!walletAddress)
            return;
        // Find all ACTIVE copy configs targeting this wallet
        const configs = await this.prisma.copyConfig.findMany({
            where: {
                targetWallet: walletAddress,
                status: "ACTIVE",
            },
        });
        if (configs.length === 0)
            return;
        this.logger.log(`Processing whale trade from ${walletAddress} for ${configs.length} copy config(s)`);
        const sourceSize = parseFloat(event.notional ?? "0");
        const sourcePrice = parseFloat(event.price ?? "0.5");
        for (const config of configs) {
            try {
                await this.processCopyForConfig(config, event, sourceSize, sourcePrice);
            }
            catch (err) {
                this.logger.error(`Copy failed for config ${config.id}: ${err?.message}`);
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
    async processCopyForConfig(config, event, sourceSize, sourcePrice) {
        // 1. Check daily loss limit (H-02: use Redis atomic operations to prevent race condition)
        const notional = sourceSize * sourcePrice;
        const maxDailyLoss = parseFloat(config.maxDailyLoss.toString());
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
        const maxExposure = parseFloat(config.maxExposure.toString());
        if (currentExposure >= maxExposure) {
            this.logger.warn(`Config ${config.id} at max exposure (${currentExposure} >= ${maxExposure})`);
            return;
        }
        // 3. Calculate copy size based on mode
        const copiedSize = this.calculateCopySize(config.mode, parseFloat(config.sizeValue.toString()), sourceSize);
        if (copiedSize <= 0)
            return;
        // 4. Apply price offset
        const priceOffset = parseFloat(config.priceOffset.toString());
        const copiedPrice = this.applyPriceOffset(sourcePrice, priceOffset);
        // 5. Create CopyTrade record
        const trade = await this.prisma.copyTrade.create({
            data: {
                configId: config.id,
                sourceWallet: event.walletAddress,
                sourceTxHash: event.txHash ?? null,
                marketId: event.marketId ?? "",
                tokenId: event.tokenId ?? "",
                side: event.side,
                outcome: event.outcome,
                sourceSize: new client_1.Prisma.Decimal(sourceSize),
                sourcePrice: new client_1.Prisma.Decimal(sourcePrice),
                copiedSize: new client_1.Prisma.Decimal(copiedSize),
                copiedPrice: new client_1.Prisma.Decimal(copiedPrice),
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
        this.logger.log(`Copy trade created: ${trade.id} — ${copiedSize.toFixed(2)} @ ${copiedPrice.toFixed(4)} for config ${config.id}`);
    }
    // ─── Size Calculation ────────────────────────────────────────────────────────
    calculateCopySize(mode, sizeValue, sourceSize) {
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
    applyPriceOffset(sourcePrice, offsetPercent) {
        return sourcePrice * (1 + offsetPercent / 100);
    }
    // ─── Risk Checks ─────────────────────────────────────────────────────────────
    async getDailyPnl(configId) {
        const cached = await this.redis.get(`copy:${configId}:daily_pnl`);
        if (cached) {
            const parsed = parseFloat(cached);
            if (!isNaN(parsed))
                return parsed;
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
        const total = trades.reduce((acc, t) => acc + parseFloat(t.pnl.toString()), 0);
        // Cache for 5 minutes
        await this.redis.set(`copy:${configId}:daily_pnl`, total.toString(), 300);
        return total;
    }
    async getCurrentExposure(configId) {
        // Check Redis cache first (updated atomically on trade events)
        const cached = await this.redis.get(`copy:${configId}:exposure`);
        if (cached)
            return parseFloat(cached);
        // Fallback: compute from DB and cache
        const pendingTrades = await this.prisma.copyTrade.findMany({
            where: {
                configId,
                status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
            },
            select: { copiedSize: true },
        });
        const total = pendingTrades.reduce((acc, t) => acc + parseFloat(t.copiedSize.toString()), 0);
        await this.redis.set(`copy:${configId}:exposure`, total.toString(), 30);
        return total;
    }
};
exports.CopyEngineService = CopyEngineService;
exports.CopyEngineService = CopyEngineService = CopyEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], CopyEngineService);
//# sourceMappingURL=copy-engine.service.js.map