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
var PositionReconcilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionReconcilerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
let PositionReconcilerService = PositionReconcilerService_1 = class PositionReconcilerService {
    prisma;
    redis;
    config;
    logger = new common_1.Logger(PositionReconcilerService_1.name);
    constructor(prisma, redis, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.config = config;
    }
    async reconcile() {
        // Only reconcile users who actually have unresolved positions
        const usersWithPositions = await this.prisma.position.findMany({
            where: { resolutionStatus: "UNRESOLVED" },
            select: { userId: true },
            distinct: ["userId"],
        });
        if (usersWithPositions.length === 0)
            return;
        const userIds = usersWithPositions.map((u) => u.userId);
        const connectedUsers = await this.prisma.user.findMany({
            where: {
                id: { in: userIds },
                polymarketConnected: true,
                suspended: false,
                deleted: false,
            },
            select: { id: true, polymarketAddress: true },
        });
        // Parallel with concurrency limit of 10
        const CONCURRENCY = 10;
        for (let i = 0; i < connectedUsers.length; i += CONCURRENCY) {
            const batch = connectedUsers.slice(i, i + CONCURRENCY);
            await Promise.allSettled(batch
                .filter((u) => u.polymarketAddress)
                .map((u) => this.reconcileUser(u.id, u.polymarketAddress).catch((err) => this.logger.warn(`Reconciliation failed for ${u.id}: ${err.message}`))));
        }
    }
    async reconcileUser(userId, walletAddress) {
        const clobUrl = this.config.get("CLOB_API_URL") ?? "http://mock-polymarket:3099";
        const res = await fetch(`${clobUrl}/positions?user=${walletAddress}`, {
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok)
            return;
        const polyPositions = (await res.json());
        const localPositions = await this.prisma.position.findMany({
            where: { userId, resolutionStatus: "UNRESOLVED" },
        });
        for (const polyPos of polyPositions) {
            const local = localPositions.find((lp) => lp.tokenId === polyPos.asset);
            if (!local && parseFloat(polyPos.size) > 0) {
                this.logger.warn(`Missing local position for ${polyPos.asset}, creating`);
                await this.prisma.position.create({
                    data: {
                        userId,
                        tokenId: polyPos.asset,
                        marketId: "",
                        outcome: "YES",
                        size: polyPos.size,
                        avgPrice: polyPos.avgPrice,
                        currentPrice: "0",
                        unrealizedPnl: "0",
                        realizedPnl: polyPos.realizedPnl ?? "0",
                        resolutionStatus: "UNRESOLVED",
                    },
                });
            }
            else if (local && parseFloat(polyPos.size) === 0) {
                this.logger.warn(`Stale local position ${local.id}, marking resolved`);
                await this.prisma.position.update({
                    where: { id: local.id },
                    data: { resolutionStatus: "RESOLVED", size: 0 },
                });
            }
        }
    }
};
exports.PositionReconcilerService = PositionReconcilerService;
__decorate([
    (0, schedule_1.Cron)("*/5 * * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PositionReconcilerService.prototype, "reconcile", null);
exports.PositionReconcilerService = PositionReconcilerService = PositionReconcilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService,
        config_1.ConfigService])
], PositionReconcilerService);
//# sourceMappingURL=position-reconciler.service.js.map