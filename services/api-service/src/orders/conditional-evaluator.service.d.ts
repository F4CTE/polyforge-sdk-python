import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
export declare class ConditionalEvaluatorService {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService);
    evaluate(): Promise<void>;
    processOrders(): Promise<void>;
    shouldTrigger(type: string, side: string, currentPrice: number, triggerPrice: number): boolean;
    handleTrailingStop(order: any, currentPrice: number): Promise<void>;
    handlePegged(order: any, currentPrice: number): Promise<void>;
    triggerOrder(order: any): Promise<void>;
    checkExpiredOrders(): Promise<void>;
}
//# sourceMappingURL=conditional-evaluator.service.d.ts.map