import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
export declare class WebhooksController {
    private readonly webhooks;
    constructor(webhooks: WebhooksService);
    create(user: any, dto: CreateWebhookDto): Promise<{
        id: string;
        url: string;
        events: string[];
        secret: string;
        active: boolean;
        createdAt: Date;
    }>;
    list(user: any): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        url: string;
        events: string[];
    }[]>;
    remove(id: string, user: any): Promise<void>;
    test(id: string, user: any): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
}
//# sourceMappingURL=webhooks.controller.d.ts.map