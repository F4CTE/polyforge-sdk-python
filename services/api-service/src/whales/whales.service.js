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
var WhalesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhalesService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const client_1 = require("@prisma/client");
let WhalesService = WhalesService_1 = class WhalesService {
    prisma;
    logger = new common_1.Logger(WhalesService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ─── Feed ──────────────────────────────────────────────────────────────────
    async getFeed(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.minSize) {
            where.notional = { gte: new client_1.Prisma.Decimal(query.minSize) };
        }
        if (query.marketId) {
            where.marketId = query.marketId;
        }
        if (query.walletAddress) {
            where.walletAddress = query.walletAddress;
        }
        const [data, total] = await Promise.all([
            this.prisma.whaleAlert.findMany({
                where,
                orderBy: { detectedAt: "desc" },
                skip,
                take: limit,
                include: {
                    market: {
                        select: { id: true, title: true, slug: true, image: true },
                    },
                },
            }),
            this.prisma.whaleAlert.count({ where }),
        ]);
        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // ─── Top Whales ────────────────────────────────────────────────────────────
    async getTopWhales(query) {
        const limit = query.limit ?? 20;
        const sortFieldMap = {
            volume: "totalVolume",
            pnl: "totalPnl",
            winRate: "winRate",
            tradeCount: "tradeCount",
        };
        const orderByField = sortFieldMap[query.sortBy ?? "volume"] ?? "totalVolume";
        const profiles = await this.prisma.whaleProfile.findMany({
            orderBy: { [orderByField]: "desc" },
            take: limit,
        });
        return profiles;
    }
    // ─── Profile ───────────────────────────────────────────────────────────────
    async getProfile(address) {
        const [profile, recentTrades] = await Promise.all([
            this.prisma.whaleProfile.findUnique({
                where: { walletAddress: address },
            }),
            this.prisma.whaleAlert.findMany({
                where: { walletAddress: address },
                orderBy: { detectedAt: "desc" },
                take: 20,
                include: {
                    market: {
                        select: { id: true, title: true, slug: true, image: true },
                    },
                },
            }),
        ]);
        return {
            profile: profile ?? {
                walletAddress: address,
                totalVolume: "0",
                totalPnl: "0",
                tradeCount: 0,
                winRate: "0",
                lastTradeAt: null,
            },
            recentTrades,
        };
    }
    // ─── Follow / Unfollow ─────────────────────────────────────────────────────
    async toggleFollow(userId, walletAddress) {
        const existing = await this.prisma.whaleFollow.findUnique({
            where: { userId_walletAddress: { userId, walletAddress } },
        });
        if (existing) {
            await this.prisma.whaleFollow.delete({ where: { id: existing.id } });
            return { followed: false };
        }
        await this.prisma.whaleFollow.create({
            data: { userId, walletAddress },
        });
        return { followed: true };
    }
    // ─── Following ─────────────────────────────────────────────────────────────
    async getFollowing(userId) {
        const follows = await this.prisma.whaleFollow.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        // Enrich with whale profile data
        const addresses = follows.map((f) => f.walletAddress);
        const profiles = await this.prisma.whaleProfile.findMany({
            where: { walletAddress: { in: addresses } },
        });
        const profileMap = new Map(profiles.map((p) => [p.walletAddress, p]));
        return follows.map((f) => ({
            ...f,
            profile: profileMap.get(f.walletAddress) ?? null,
        }));
    }
};
exports.WhalesService = WhalesService;
exports.WhalesService = WhalesService = WhalesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], WhalesService);
//# sourceMappingURL=whales.service.js.map