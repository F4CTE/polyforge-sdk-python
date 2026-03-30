import { PrismaService } from "@polyforge/shared-db";
export interface QueryResult {
    query: string;
    intent: string;
    filters: Record<string, unknown>;
    data: unknown;
    summary: string;
}
export declare class AiService {
    private readonly prisma;
    private readonly logger;
    private readonly patterns;
    constructor(prisma: PrismaService);
    query(userId: string, queryText: string): Promise<QueryResult>;
}
//# sourceMappingURL=ai.service.d.ts.map