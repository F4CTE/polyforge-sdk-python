import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
export declare class PositionReconcilerService {
    private readonly prisma;
    private readonly redis;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, config: ConfigService);
    reconcile(): Promise<void>;
    reconcileUser(userId: string, walletAddress: string): Promise<void>;
}
//# sourceMappingURL=position-reconciler.service.d.ts.map