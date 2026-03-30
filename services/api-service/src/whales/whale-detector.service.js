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
var WhaleDetectorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhaleDetectorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const client_1 = require("@prisma/client");
const STREAM = "stream:events";
const GROUP = "whale-detector";
const CONSUMER = `whale-${process.pid}`;
const DEFAULT_THRESHOLD = 5000;
let WhaleDetectorService = WhaleDetectorService_1 = class WhaleDetectorService {
    prisma;
    redis;
    logger = new common_1.Logger(WhaleDetectorService_1.name);
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
    async getThreshold() {
        const cached = await this.redis.get("config:whale_threshold");
        if (cached) {
            const parsed = parseFloat(cached);
            if (!isNaN(parsed) && parsed > 0)
                return parsed;
        }
        return DEFAULT_THRESHOLD;
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
                        await this.processEvent(event);
                        await this.redis.getClient().xack(STREAM, GROUP, id);
                    }
                }
            }
            catch (err) {
                if (this.running) {
                    this.logger.error("Whale detector consume error", err?.message);
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
    async processEvent(event) {
        if (event.type !== "ORDER_FILLED")
            return;
        const size = parseFloat(event.size ?? "0");
        const price = parseFloat(event.price ?? event.fillPrice ?? "0");
        const notional = size * price;
        const threshold = await this.getThreshold();
        if (notional < threshold)
            return;
        const walletAddress = event.walletAddress;
        if (!walletAddress)
            return;
        this.logger.log(`Whale detected: ${walletAddress} — $${notional.toFixed(2)} on ${event.marketId ?? "unknown"}`);
        // Create WhaleAlert record
        const alert = await this.prisma.whaleAlert.create({
            data: {
                walletAddress,
                marketId: event.marketId ?? "",
                tokenId: event.tokenId ?? "",
                side: event.side,
                outcome: event.outcome,
                size: new client_1.Prisma.Decimal(size),
                price: new client_1.Prisma.Decimal(price),
                notional: new client_1.Prisma.Decimal(notional),
                txHash: event.txHash ?? null,
            },
        });
        // Update WhaleProfile (upsert)
        await this.prisma.whaleProfile.upsert({
            where: { walletAddress },
            create: {
                walletAddress,
                totalVolume: new client_1.Prisma.Decimal(notional),
                tradeCount: 1,
                lastTradeAt: new Date(),
            },
            update: {
                totalVolume: { increment: new client_1.Prisma.Decimal(notional) },
                tradeCount: { increment: 1 },
                lastTradeAt: new Date(),
            },
        });
        // Fetch market title for notification context
        let marketTitle;
        try {
            const market = await this.prisma.market.findUnique({
                where: { id: event.marketId },
                select: { title: true },
            });
            marketTitle = market?.title ?? undefined;
        }
        catch {
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
    async aggregateProfiles() {
        this.logger.log("Running hourly whale profile aggregation");
        try {
            // Single aggregation query: group alerts by wallet
            const aggregations = await this.prisma.whaleAlert.groupBy({
                by: ["walletAddress"],
                _sum: { notional: true },
                _count: true,
            });
            if (aggregations.length === 0)
                return;
            // Batch fetch all closed markets for win rate calculation
            const closedMarkets = await this.prisma.market.findMany({
                where: { closed: true },
                select: { id: true },
            });
            const closedMarketIds = new Set(closedMarkets.map((m) => m.id));
            // Batch update all profiles in a transaction
            await this.prisma.$transaction(aggregations.map((agg) => this.prisma.whaleProfile.update({
                where: { walletAddress: agg.walletAddress },
                data: {
                    totalVolume: agg._sum.notional ?? 0,
                    tradeCount: agg._count,
                },
            })));
            this.logger.log(`Aggregated ${aggregations.length} whale profiles`);
        }
        catch (err) {
            this.logger.error("Whale profile aggregation failed", err?.message);
        }
    }
};
exports.WhaleDetectorService = WhaleDetectorService;
__decorate([
    (0, schedule_1.Cron)("0 * * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhaleDetectorService.prototype, "aggregateProfiles", null);
exports.WhaleDetectorService = WhaleDetectorService = WhaleDetectorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], WhaleDetectorService);
//# sourceMappingURL=whale-detector.service.js.map