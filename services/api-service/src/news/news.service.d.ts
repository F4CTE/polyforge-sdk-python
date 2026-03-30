import { PrismaService } from "@polyforge/shared-db";
import { NewsArticleQueryDto, NewsSignalQueryDto } from "./dto/news-query.dto";
export declare class NewsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getArticles(query: NewsArticleQueryDto): Promise<{
        data: ({
            signals: ({
                market: {
                    title: string;
                    id: string;
                    slug: string;
                };
            } & {
                id: string;
                direction: string;
                createdAt: Date;
                marketId: string;
                outcome: string;
                confidence: number;
                reasoning: string | null;
                articleId: string;
            })[];
        } & {
            source: string;
            summary: string | null;
            title: string;
            id: string;
            url: string;
            sentiment: import(".prisma/client").$Enums.NewsSentiment;
            imageUrl: string | null;
            publishedAt: Date;
            ingestedAt: Date;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getArticleById(id: string): Promise<{
        signals: ({
            market: {
                title: string;
                image: string | null;
                id: string;
                slug: string;
            };
        } & {
            id: string;
            direction: string;
            createdAt: Date;
            marketId: string;
            outcome: string;
            confidence: number;
            reasoning: string | null;
            articleId: string;
        })[];
    } & {
        source: string;
        summary: string | null;
        title: string;
        id: string;
        url: string;
        sentiment: import(".prisma/client").$Enums.NewsSentiment;
        imageUrl: string | null;
        publishedAt: Date;
        ingestedAt: Date;
    }>;
    getSignals(query: NewsSignalQueryDto): Promise<{
        data: ({
            article: {
                source: string;
                title: string;
                id: string;
                url: string;
                sentiment: import(".prisma/client").$Enums.NewsSentiment;
                imageUrl: string | null;
                publishedAt: Date;
            };
            market: {
                title: string;
                image: string | null;
                id: string;
                slug: string;
            };
        } & {
            id: string;
            direction: string;
            createdAt: Date;
            marketId: string;
            outcome: string;
            confidence: number;
            reasoning: string | null;
            articleId: string;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=news.service.d.ts.map