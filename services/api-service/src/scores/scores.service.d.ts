import { PrismaService } from "@polyforge/shared-db";
export declare class ScoresService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getMyScore(userId: string): Promise<{
        score: null;
        breakdown: null;
    } | {
        score: {
            id: string;
            userId: string;
            winRate: Prisma.Decimal;
            maxDrawdown: Prisma.Decimal;
            sharpeRatio: Prisma.Decimal;
            score: number;
            updatedAt: Date;
            avgReturn: Prisma.Decimal;
            totalTrades: number;
            profitFactor: Prisma.Decimal;
            consistency: Prisma.Decimal;
        };
        breakdown: {
            score: any;
            components: {
                winRate: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                sharpe: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                profitFactor: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                consistency: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                avgReturn: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                tradeVolume: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                drawdown: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
            };
            totalTrades: any;
            updatedAt: any;
        };
    }>;
    getUserScore(userId: string): Promise<{
        score: {
            id: string;
            userId: string;
            winRate: Prisma.Decimal;
            maxDrawdown: Prisma.Decimal;
            sharpeRatio: Prisma.Decimal;
            score: number;
            updatedAt: Date;
            avgReturn: Prisma.Decimal;
            totalTrades: number;
            profitFactor: Prisma.Decimal;
            consistency: Prisma.Decimal;
        };
        breakdown: {
            score: any;
            components: {
                winRate: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                sharpe: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                profitFactor: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                consistency: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                avgReturn: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                tradeVolume: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
                drawdown: {
                    value: any;
                    weight: number;
                    weighted: number;
                };
            };
            totalTrades: any;
            updatedAt: any;
        };
    }>;
    getTopTraders(): Promise<{
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        score: number;
        winRate: any;
        totalTrades: number;
    }[]>;
    getMyBadges(userId: string): Promise<{
        name: string;
        id: string;
        type: string;
        userId: string;
        earnedAt: Date;
    }[]>;
    getUserBadges(userId: string): Promise<{
        name: string;
        id: string;
        type: string;
        userId: string;
        earnedAt: Date;
    }[]>;
    private buildBreakdown;
}
//# sourceMappingURL=scores.service.d.ts.map