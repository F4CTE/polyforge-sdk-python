import { PrismaService } from "@polyforge/shared-db";
export declare class BadgeService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /** Run daily at 4:00 AM (after score recalculation at 3 AM) */
    evaluateAll(): Promise<void>;
    /** Evaluate all badge criteria for a user. Returns number of newly awarded badges. */
    evaluateForUser(userId: string, userCreatedAt: Date): Promise<number>;
    private award;
}
//# sourceMappingURL=badge.service.d.ts.map