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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const crypto_1 = require("crypto");
let OrdersService = class OrdersService {
    prisma;
    redis;
    config;
    jwtService;
    constructor(prisma, redis, config, jwtService) {
        this.prisma = prisma;
        this.redis = redis;
        this.config = config;
        this.jwtService = jwtService;
    }
    async list(userId, query) {
        const { page, limit, status, strategyId, from, to } = query;
        const skip = (page - 1) * limit;
        const where = { userId };
        if (status)
            where.status = status;
        if (strategyId)
            where.strategyId = strategyId;
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from);
            if (to)
                where.createdAt.lte = new Date(to);
        }
        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.order.count({ where }),
        ]);
        // Resolve market titles for display
        const marketIds = [...new Set(orders.map((o) => o.marketId))];
        const markets = marketIds.length > 0
            ? await this.prisma.market.findMany({
                where: { id: { in: marketIds } },
                select: { id: true, title: true },
            })
            : [];
        const titleMap = new Map(markets.map((m) => [m.id, m.title]));
        const enriched = orders.map((o) => ({
            ...o,
            marketQuestion: titleMap.get(o.marketId) ?? null,
        }));
        return (0, pagination_dto_1.paginate)(enriched, total, page, limit);
    }
    async closePosition(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { polymarketConnected: true },
        });
        if (!user?.polymarketConnected) {
            throw new common_1.UnprocessableEntityException({
                code: "NOT_CONNECTED",
                message: "Polymarket credentials required",
            });
        }
        // Find open position (unresolved)
        const position = await this.prisma.position.findFirst({
            where: {
                userId,
                tokenId: dto.tokenId,
                resolutionStatus: "UNRESOLVED",
            },
        });
        if (!position) {
            throw new common_1.NotFoundException({
                code: "POSITION_NOT_FOUND",
                message: "No open position found for this token",
            });
        }
        const intentId = (0, crypto_1.randomUUID)();
        const size = dto.size ?? String(position.size);
        // Publish close intent to stream:orders
        await this.redis.xadd("stream:orders", {
            intentId,
            userId,
            strategyId: "",
            marketId: position.marketId,
            tokenId: dto.tokenId,
            side: "SELL",
            outcome: "YES",
            size,
            price: "0.01",
            orderType: "FOK",
            expiration: "",
            ts: String(Date.now()),
        });
        // Create a pending order record
        const order = await this.prisma.order.create({
            data: {
                intentId,
                userId,
                strategyId: null,
                marketId: position.marketId,
                tokenId: dto.tokenId,
                side: "SELL",
                outcome: position.outcome,
                size: size,
                price: "0.01",
                orderType: "FOK",
                status: "PENDING",
            },
        });
        return { orderId: order.id, intentId, status: "PENDING" };
    }
    async redeemPosition(userId, dto) {
        if (!dto.positionId && !dto.marketId) {
            throw new common_1.UnprocessableEntityException({
                code: "MISSING_PARAM",
                message: "Either positionId or marketId is required",
            });
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { polymarketConnected: true },
        });
        if (!user?.polymarketConnected) {
            throw new common_1.UnprocessableEntityException({
                code: "NOT_CONNECTED",
                message: "Polymarket credentials required",
            });
        }
        // Find the resolved position
        const where = { userId };
        if (dto.positionId)
            where.id = dto.positionId;
        if (dto.marketId)
            where.marketId = dto.marketId;
        const position = await this.prisma.position.findFirst({ where });
        if (!position) {
            throw new common_1.NotFoundException({
                code: "POSITION_NOT_FOUND",
                message: "Position not found",
            });
        }
        if (position.resolutionStatus !== "RESOLVED") {
            throw new common_1.UnprocessableEntityException({
                code: "MARKET_NOT_RESOLVED",
                message: "Market has not been resolved yet",
            });
        }
        // Publish redemption intent to stream:redemptions
        const intentId = (0, crypto_1.randomUUID)();
        await this.redis.xadd("stream:redemptions", {
            intentId,
            userId,
            tokenId: position.tokenId,
            positionId: position.id,
            ts: String(Date.now()),
        });
        // Update position status to REDEEMED
        await this.prisma.position.update({
            where: { id: position.id },
            data: { resolutionStatus: "REDEEMED" },
        });
        return { positionId: position.id, intentId, status: "REDEEMED" };
    }
    /**
     * Split USDC.e into Yes + No outcome tokens via signer-service.
     */
    async splitPosition(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { polymarketConnected: true },
        });
        if (!user?.polymarketConnected) {
            throw new common_1.UnprocessableEntityException({
                code: "NOT_CONNECTED",
                message: "Polymarket credentials required",
            });
        }
        const signerUrl = this.config.get("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";
        // SECURITY: Use internal JWT auth for signer-service calls
        const internalToken = this.jwtService.sign({ sub: "api-service", jti: require("crypto").randomUUID() }, { secret: this.config.getOrThrow("INTERNAL_JWT_SECRET"), audience: "signer-service", expiresIn: "30s" });
        const res = await fetch(`${signerUrl}/internal/split-position`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${internalToken}`,
            },
            body: JSON.stringify({
                userId,
                tokenId: dto.tokenId,
                amount: dto.amount,
            }),
        });
        if (!res.ok) {
            throw new common_1.UnprocessableEntityException({
                code: "SPLIT_FAILED",
                message: `Split position failed: ${res.status}`,
            });
        }
        return res.json();
    }
    /**
     * Merge Yes + No outcome tokens back into USDC.e via signer-service.
     */
    async mergePosition(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { polymarketConnected: true },
        });
        if (!user?.polymarketConnected) {
            throw new common_1.UnprocessableEntityException({
                code: "NOT_CONNECTED",
                message: "Polymarket credentials required",
            });
        }
        const signerUrl = this.config.get("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";
        const mergeToken = this.jwtService.sign({ sub: "api-service", jti: require("crypto").randomUUID() }, { secret: this.config.getOrThrow("INTERNAL_JWT_SECRET"), audience: "signer-service", expiresIn: "30s" });
        const res = await fetch(`${signerUrl}/internal/merge-position`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mergeToken}`,
            },
            body: JSON.stringify({
                userId,
                tokenId: dto.tokenId,
                amount: dto.amount,
            }),
        });
        if (!res.ok) {
            throw new common_1.UnprocessableEntityException({
                code: "MERGE_FAILED",
                message: `Merge position failed: ${res.status}`,
            });
        }
        return res.json();
    }
    async placeOrder(userId, dto) {
        // 1. Find user and verify polymarketConnected
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.polymarketConnected) {
            throw new common_1.ForbiddenException({ code: 'WALLET_NOT_CONNECTED', message: 'Connect your Polymarket wallet first' });
        }
        // 2. Find the token and its market
        const token = await this.prisma.token.findUniqueOrThrow({
            where: { id: dto.tokenId },
            include: { market: true },
        });
        // 3. Create intent
        const intentId = (0, crypto_1.randomUUID)();
        const intent = {
            intentId,
            userId,
            strategyId: '',
            marketId: token.marketId,
            tokenId: dto.tokenId,
            side: dto.side,
            outcome: dto.outcome,
            size: String(dto.size),
            price: String(dto.price),
            orderType: dto.orderType || 'GTC',
        };
        // 4. Publish to Redis stream
        await this.redis.xadd('stream:orders', intent);
        // 5. Create order record
        const order = await this.prisma.order.create({
            data: {
                intentId,
                userId,
                strategyId: null,
                marketId: token.marketId,
                tokenId: dto.tokenId,
                side: dto.side,
                outcome: dto.outcome,
                size: String(dto.size),
                price: String(dto.price),
                orderType: (dto.orderType || 'GTC'),
                status: 'PENDING',
            },
        });
        return { orderId: order.id, intentId, status: 'PENDING' };
    }
    async cancelOrder(userId, orderId) {
        const order = await this.prisma.order.findUniqueOrThrow({
            where: { id: orderId },
        });
        if (order.userId !== userId) {
            throw new common_1.ForbiddenException('Not your order');
        }
        if (!['PENDING', 'SUBMITTED', 'LIVE'].includes(order.status)) {
            throw new common_1.BadRequestException(`Cannot cancel order in ${order.status} status`);
        }
        // Update status to CANCELLED
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED' },
        });
        // If order has a CLOB ID, publish cancel to stream
        if (order.clobOrderId) {
            await this.redis.xadd('stream:cancellations', {
                orderId,
                clobOrderId: order.clobOrderId,
                userId,
            });
        }
        return { orderId, status: 'CANCELLED' };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService,
        config_1.ConfigService,
        jwt_1.JwtService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map