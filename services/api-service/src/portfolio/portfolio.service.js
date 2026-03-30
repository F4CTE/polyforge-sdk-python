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
exports.PortfolioService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
let PortfolioService = class PortfolioService {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async getPortfolio(userId) {
        // Positions: no `closed` field — use resolutionStatus
        const positions = await this.prisma.position.findMany({
            where: { userId, resolutionStatus: "UNRESOLVED" },
        });
        let totalUnrealizedPnl = 0;
        let totalRealizedPnl = 0;
        // Fetch market titles for all positions in one query
        const marketIds = [...new Set(positions.map((p) => p.marketId))];
        const markets = marketIds.length
            ? await this.prisma.market.findMany({
                where: { id: { in: marketIds } },
                select: { id: true, title: true },
            })
            : [];
        const marketTitleMap = new Map(markets.map((m) => [m.id, m.title]));
        // Batch fetch all prices in one Redis MGET instead of sequential GETs
        const priceKeys = positions.map((p) => `cache:price:${p.tokenId}`);
        const priceValues = priceKeys.length > 0
            ? await this.redis.getClient().mget(...priceKeys)
            : [];
        const priceMap = new Map();
        positions.forEach((pos, i) => {
            const raw = priceValues[i];
            priceMap.set(pos.tokenId, raw ? parseFloat(JSON.parse(raw).price ?? "0") : 0);
        });
        const enriched = positions.map((pos) => {
            const currentPrice = priceMap.get(pos.tokenId) ?? 0;
            const avgEntry = parseFloat(String(pos.avgPrice ?? "0"));
            const size = parseFloat(String(pos.size ?? "0"));
            const unrealizedPnl = (currentPrice - avgEntry) * size;
            totalUnrealizedPnl += unrealizedPnl;
            totalRealizedPnl += parseFloat(String(pos.realizedPnl ?? "0"));
            return {
                id: pos.id,
                marketId: pos.marketId,
                tokenId: pos.tokenId,
                marketTitle: marketTitleMap.get(pos.marketId) ?? "",
                side: pos.outcome,
                size: String(pos.size),
                avgEntryPrice: String(pos.avgPrice),
                currentPrice: currentPrice.toFixed(6),
                unrealizedPnl: unrealizedPnl.toFixed(6),
                resolutionStatus: pos.resolutionStatus,
            };
        });
        return {
            positions: enriched,
            totalUnrealizedPnl: totalUnrealizedPnl.toFixed(6),
            totalRealizedPnl: totalRealizedPnl.toFixed(6),
        };
    }
    async getPnl(userId, period, strategyId) {
        const emptyResult = { snapshots: [], totalPnl: "0.00", winRate: "0" };
        try {
            const since = period === "7d"
                ? new Date(Date.now() - 7 * 86400_000)
                : period === "90d"
                    ? new Date(Date.now() - 90 * 86400_000)
                    : period === "allTime"
                        ? new Date(0)
                        : new Date(Date.now() - 30 * 86400_000);
            // Use DATE_TRUNC as fallback when TimescaleDB time_bucket is unavailable
            const snapshots = strategyId
                ? await this.prisma.$queryRaw `
                  SELECT
                      DATE_TRUNC('day', time) AS time,
                      pnl
                  FROM pnl_snapshots
                  WHERE "userId" = ${userId}
                    AND "strategyId" = ${strategyId}
                    AND time >= ${since}
                  ORDER BY time ASC
                `
                : await this.prisma.$queryRaw `
                  SELECT
                      DATE_TRUNC('day', time) AS time,
                      pnl
                  FROM pnl_snapshots
                  WHERE "userId" = ${userId}
                    AND "strategyId" IS NULL
                    AND time >= ${since}
                  ORDER BY time ASC
                `;
            if (!snapshots || snapshots.length === 0)
                return emptyResult;
            const totalPnl = snapshots.reduce((acc, s) => acc + parseFloat(String(s.pnl ?? 0)), 0);
            return {
                snapshots: snapshots.map((s) => ({
                    time: s.time,
                    pnl: String(s.pnl ?? "0"),
                })),
                totalPnl: totalPnl.toFixed(2),
                winRate: "0",
            };
        }
        catch {
            // Table missing, TimescaleDB not available, or no data — return zeros
            return emptyResult;
        }
    }
};
exports.PortfolioService = PortfolioService;
exports.PortfolioService = PortfolioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService,
        shared_redis_1.RedisService])
], PortfolioService);
//# sourceMappingURL=portfolio.service.js.map