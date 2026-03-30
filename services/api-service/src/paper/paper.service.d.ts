import { PrismaService } from "@polyforge/shared-db";
export declare class PaperService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(userId: string): Promise<any>;
    reset(userId: string): Promise<any>;
}
//# sourceMappingURL=paper.service.d.ts.map