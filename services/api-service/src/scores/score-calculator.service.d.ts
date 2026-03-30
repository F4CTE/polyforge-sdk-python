import { PrismaService } from "@polyforge/shared-db";
export declare class ScoreCalculatorService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /** Run daily at 3:00 AM */
    recalculateAll(): Promise<void>;
    /** Calculate and upsert the score for a single user. */
    calculateForUser(userId: string): Promise<void>;
    /** Weighted average of normalized metric scores → 0-100 */
    computeScore(metrics: {
        winRate: number;
        sharpeRatio: number;
        profitFactor: number;
        consistency: number;
        avgReturn: number;
        totalTrades: number;
        maxDrawdown: number;
    }): number;
}
//# sourceMappingURL=score-calculator.service.d.ts.map