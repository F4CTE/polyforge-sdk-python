import { PrismaService } from "@polyforge/shared-db";
export declare class ApiKeysService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(userId: string): Promise<{
        name: string;
        id: string;
        prefix: string;
        createdAt: Date;
        scopes: import(".prisma/client").$Enums.ApiKeyScope[];
        expiresAt: Date | null;
        lastUsedAt: Date | null;
    }[]>;
    create(userId: string, dto: {
        name: string;
        scopes?: string[];
    }): Promise<{
        token: string;
        name: string;
        id: string;
        prefix: string;
        createdAt: Date;
        scopes: import(".prisma/client").$Enums.ApiKeyScope[];
    }>;
    revoke(userId: string, id: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=api-keys.service.d.ts.map