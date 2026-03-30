import { ApiKeysService } from "./api-keys.service";
export declare class ApiKeysController {
    private readonly keys;
    constructor(keys: ApiKeysService);
    list(user: any): Promise<{
        name: string;
        id: string;
        prefix: string;
        createdAt: Date;
        scopes: import(".prisma/client").$Enums.ApiKeyScope[];
        expiresAt: Date | null;
        lastUsedAt: Date | null;
    }[]>;
    create(user: any, dto: {
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
    revoke(user: any, id: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=api-keys.controller.d.ts.map