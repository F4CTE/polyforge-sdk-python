import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
export declare class WhaleDetectorService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private running;
    private loopPromise;
    constructor(prisma: PrismaService, redis: RedisService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private ensureGroup;
    private getThreshold;
    private consumeLoop;
    private parseFields;
    private processEvent;
    aggregateProfiles(): Promise<void>;
}
//# sourceMappingURL=whale-detector.service.d.ts.map