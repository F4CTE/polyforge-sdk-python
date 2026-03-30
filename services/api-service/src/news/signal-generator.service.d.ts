import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { LlmService } from "./llm.service";
interface LlmSignal {
    marketId: string;
    direction: "BUY" | "SELL";
    outcome: "YES" | "NO";
    confidence: number;
    reasoning: string;
}
export declare class SignalGeneratorService {
    private readonly prisma;
    private readonly redis;
    private readonly llm;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, llm: LlmService);
    /**
     * Strip HTML tags from a string.
     */
    private stripHtml;
    /**
     * Sanitize article content to prevent prompt injection.
     */
    private sanitizeArticle;
    /**
     * Given a news article, match it against active markets and generate signals.
     */
    generateSignals(article: {
        id: string;
        title: string;
        summary: string | null;
    }): Promise<void>;
    buildPrompt(article: {
        title: string;
        summary: string | null;
    }, markets: {
        id: string;
        title: string;
        slug: string;
        category: string | null;
    }[]): string;
    parseResponse(raw: string): LlmSignal[];
}
export {};
//# sourceMappingURL=signal-generator.service.d.ts.map