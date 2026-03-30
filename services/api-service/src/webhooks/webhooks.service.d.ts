import { PrismaService } from "@polyforge/shared-db";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
export declare class WebhooksService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateWebhookDto): Promise<{
        id: string;
        url: string;
        events: string[];
        secret: string;
        active: boolean;
        createdAt: Date;
    }>;
    list(userId: string): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        url: string;
        events: string[];
    }[]>;
    remove(id: string, userId: string): Promise<void>;
    test(id: string, userId: string): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    /**
     * Dispatch event to all matching webhooks for a user.
     * Fire-and-forget — errors are logged, not thrown.
     */
    dispatch(userId: string, eventType: string, data: Record<string, unknown>): Promise<void>;
    private deliver;
}
//# sourceMappingURL=webhooks.service.d.ts.map