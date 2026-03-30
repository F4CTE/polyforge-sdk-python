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
var ConditionalEvaluatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionalEvaluatorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const crypto_1 = require("crypto");
const STREAM_ORDERS = "stream:orders";
const STREAM_EVENTS = "stream:events";
let ConditionalEvaluatorService = ConditionalEvaluatorService_1 = class ConditionalEvaluatorService {
    prisma;
    redis;
    logger = new common_1.Logger(ConditionalEvaluatorService_1.name);
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async evaluate() {
        try {
            await this.processOrders();
        }
        catch (err) {
            this.logger.error("Conditional evaluator tick failed", err);
        }
    }
    async processOrders() {
        const pendingOrders = await this.prisma.conditionalOrder.findMany({
            where: { status: "PENDING" },
            take: 100,
        });
        if (pendingOrders.length === 0)
            return;
        // Batch fetch all prices in one MGET instead of N sequential GETs
        const tokenIds = [...new Set(pendingOrders.map((o) => o.tokenId))];
        const priceKeys = tokenIds.map((id) => `cache:price:${id}`);
        const priceValues = await this.redis.getClient().mget(...priceKeys);
        const priceMap = new Map();
        tokenIds.forEach((id, i) => {
            if (priceValues[i])
                priceMap.set(id, parseFloat(priceValues[i]));
        });
        for (const order of pendingOrders) {
            const currentPrice = priceMap.get(order.tokenId);
            if (currentPrice === undefined)
                continue;
            const triggerPrice = parseFloat(String(order.triggerPrice));
            // PEGGED orders: re-price on every tick without triggering
            if (order.type === "PEGGED") {
                await this.handlePegged(order, currentPrice);
                continue;
            }
            // TRAILING_STOP: track peak and check drop
            if (order.type === "TRAILING_STOP") {
                await this.handleTrailingStop(order, currentPrice);
                continue;
            }
            // Evaluate trigger condition
            const shouldTrigger = this.shouldTrigger(order.type, order.side, currentPrice, triggerPrice);
            if (shouldTrigger) {
                await this.triggerOrder(order);
            }
        }
    }
    shouldTrigger(type, side, currentPrice, triggerPrice) {
        const isBuyYes = side === "BUY";
        switch (type) {
            case "TAKE_PROFIT":
                return isBuyYes
                    ? currentPrice >= triggerPrice
                    : currentPrice <= triggerPrice;
            case "STOP_LOSS":
                return isBuyYes
                    ? currentPrice <= triggerPrice
                    : currentPrice >= triggerPrice;
            case "LIMIT":
                return isBuyYes
                    ? currentPrice <= triggerPrice
                    : currentPrice >= triggerPrice;
            default:
                return false;
        }
    }
    async handleTrailingStop(order, currentPrice) {
        const trailingPct = parseFloat(String(order.trailingPct));
        const currentPeak = order.peakPrice
            ? parseFloat(String(order.peakPrice))
            : currentPrice;
        const isBuyYes = order.side === "BUY";
        // For BUY YES positions, track the highest price
        // For BUY NO positions, track the lowest price
        let newPeak = currentPeak;
        if (isBuyYes) {
            newPeak = Math.max(currentPeak, currentPrice);
        }
        else {
            newPeak = Math.min(currentPeak, currentPrice);
        }
        // Update peak if changed
        if (newPeak !== currentPeak) {
            await this.prisma.conditionalOrder.update({
                where: { id: order.id },
                data: { peakPrice: newPeak },
            });
        }
        // Check if price has dropped (or risen for NO) by trailingPct from peak
        let triggered = false;
        if (isBuyYes) {
            const dropPct = ((newPeak - currentPrice) / newPeak) * 100;
            triggered = dropPct >= trailingPct;
        }
        else {
            const risePct = ((currentPrice - newPeak) / newPeak) * 100;
            triggered = risePct >= trailingPct;
        }
        if (triggered) {
            await this.triggerOrder(order);
        }
    }
    async handlePegged(order, currentPrice) {
        const offset = parseFloat(String(order.triggerPrice));
        const newLimitPrice = Math.max(0.01, Math.min(0.99, currentPrice + offset));
        // Skip DB write if price hasn't changed materially (avoids write on every tick)
        const existingLimit = order.limitPrice ? parseFloat(String(order.limitPrice)) : null;
        if (existingLimit !== null && Math.abs(newLimitPrice - existingLimit) < 0.0001)
            return;
        await this.prisma.conditionalOrder.update({
            where: { id: order.id },
            data: { limitPrice: newLimitPrice },
        });
    }
    async triggerOrder(order) {
        const intentId = (0, crypto_1.randomUUID)();
        // Publish OrderIntent to stream:orders
        await this.redis.xadd(STREAM_ORDERS, {
            intentId,
            userId: order.userId,
            strategyId: "",
            marketId: order.marketId,
            tokenId: order.tokenId,
            side: order.side,
            outcome: order.outcome,
            size: String(order.size),
            price: order.limitPrice ? String(order.limitPrice) : String(order.triggerPrice),
            orderType: "GTC",
            expiration: "",
            ts: String(Date.now()),
        });
        // Update status to TRIGGERED
        await this.prisma.conditionalOrder.update({
            where: { id: order.id },
            data: {
                status: "TRIGGERED",
                triggeredAt: new Date(),
                orderId: intentId,
            },
        });
        // Emit notification
        await this.redis.xadd(STREAM_EVENTS, {
            type: "ORDER_CONDITIONAL_TRIGGERED",
            userId: order.userId,
            conditionalOrderId: order.id,
            conditionalType: order.type,
            tokenId: order.tokenId,
            triggerPrice: String(order.triggerPrice),
            size: String(order.size),
            side: order.side,
            ts: String(Date.now()),
        });
        this.logger.log(`Conditional order ${order.id} (${order.type}) triggered — intent ${intentId}`);
    }
    // L-03: Separate expiration check on its own schedule (every 30 seconds)
    async checkExpiredOrders() {
        try {
            // Single updateMany instead of sequential updates per order
            const { count } = await this.prisma.conditionalOrder.updateMany({
                where: {
                    status: "PENDING",
                    expiresAt: { not: null, lte: new Date() },
                },
                data: { status: "CANCELLED" },
            });
            if (count > 0)
                this.logger.log(`Cancelled ${count} expired conditional order(s)`);
        }
        catch (err) {
            this.logger.error("Expiration check failed", err);
        }
    }
};
exports.ConditionalEvaluatorService = ConditionalEvaluatorService;
__decorate([
    (0, schedule_1.Interval)(5000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConditionalEvaluatorService.prototype, "evaluate", null);
__decorate([
    (0, schedule_1.Cron)("*/30 * * * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConditionalEvaluatorService.prototype, "checkExpiredOrders", null);
exports.ConditionalEvaluatorService = ConditionalEvaluatorService = ConditionalEvaluatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], ConditionalEvaluatorService);
//# sourceMappingURL=conditional-evaluator.service.js.map