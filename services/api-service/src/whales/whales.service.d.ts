import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
import { WhaleFeedQueryDto, WhaleTopQueryDto } from "./dto/whale-query.dto";
export declare class WhalesService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getFeed(query: WhaleFeedQueryDto): Promise<{
        data: ({
            market: {
                title: string;
                image: string | null;
                id: string;
                slug: string;
            };
        } & {
            id: string;
            size: Prisma.Decimal;
            side: import(".prisma/client").$Enums.OrderSide;
            price: Prisma.Decimal;
            tokenId: string;
            marketId: string;
            outcome: import(".prisma/client").$Enums.OrderOutcome;
            walletAddress: string;
            notional: Prisma.Decimal;
            txHash: string | null;
            detectedAt: Date;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getTopWhales(query: WhaleTopQueryDto): Promise<{
        totalPnl: Prisma.Decimal;
        winRate: Prisma.Decimal;
        walletAddress: string;
        updatedAt: Date;
        totalVolume: Prisma.Decimal;
        tradeCount: number;
        lastTradeAt: Date | null;
    }[]>;
    getProfile(address: string): Promise<{
        profile: {
            totalPnl: Prisma.Decimal;
            winRate: Prisma.Decimal;
            walletAddress: string;
            updatedAt: Date;
            totalVolume: Prisma.Decimal;
            tradeCount: number;
            lastTradeAt: Date | null;
        } | {
            walletAddress: string;
            totalVolume: string;
            totalPnl: string;
            tradeCount: number;
            winRate: string;
            lastTradeAt: null;
        };
        recentTrades: ({
            market: {
                title: string;
                image: string | null;
                id: string;
                slug: string;
            };
        } & {
            id: string;
            size: Prisma.Decimal;
            side: import(".prisma/client").$Enums.OrderSide;
            price: Prisma.Decimal;
            tokenId: string;
            marketId: string;
            outcome: import(".prisma/client").$Enums.OrderOutcome;
            walletAddress: string;
            notional: Prisma.Decimal;
            txHash: string | null;
            detectedAt: Date;
        })[];
    }>;
    toggleFollow(userId: string, walletAddress: string): Promise<{
        followed: boolean;
    }>;
    getFollowing(userId: string): Promise<{
        profile: {
            totalPnl: Prisma.Decimal;
            winRate: Prisma.Decimal;
            walletAddress: string;
            updatedAt: Date;
            totalVolume: Prisma.Decimal;
            tradeCount: number;
            lastTradeAt: Date | null;
        } | null;
        id: string;
        userId: string;
        createdAt: Date;
        walletAddress: string;
    }[]>;
}
//# sourceMappingURL=whales.service.d.ts.map