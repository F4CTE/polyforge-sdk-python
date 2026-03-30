import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
export declare class PortfolioService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    getPortfolio(userId: string): Promise<any>;
    getPnl(userId: string, period: string, strategyId?: string): Promise<any>;
}
//# sourceMappingURL=portfolio.service.d.ts.map