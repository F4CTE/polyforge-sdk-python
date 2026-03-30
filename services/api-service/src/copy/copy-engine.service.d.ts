import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
export declare class CopyEngineService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private running;
    private loopPromise;
    constructor(prisma: PrismaService, redis: RedisService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private ensureGroup;
    private consumeLoop;
    private parseFields;
    handleWhaleTrade(event: Record<string, string>): Promise<void>;
    processCopyForConfig(config: any, event: Record<string, string>, sourceSize: number, sourcePrice: number): Promise<void>;
    calculateCopySize(mode: string, sizeValue: number, sourceSize: number): number;
    applyPriceOffset(sourcePrice: number, offsetPercent: number): number;
    private getDailyPnl;
    private getCurrentExposure;
}
//# sourceMappingURL=copy-engine.service.d.ts.map