import { OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";
import { SignalGeneratorService } from "./signal-generator.service";
interface ParsedArticle {
    source: string;
    title: string;
    summary: string | null;
    url: string;
    imageUrl: string | null;
    publishedAt: Date;
}
export declare class NewsIngestionService implements OnModuleInit {
    private readonly config;
    private readonly prisma;
    private readonly signalGenerator;
    private readonly logger;
    private readonly feeds;
    constructor(config: ConfigService, prisma: PrismaService, signalGenerator: SignalGeneratorService);
    onModuleInit(): void;
    /**
     * Poll RSS feeds every 5 minutes.
     */
    pollFeeds(): Promise<void>;
    ingestFeed(feedUrl: string): Promise<number>;
    /**
     * Parse RSS XML into article objects.
     * Handles both RSS 2.0 (<item>) and Atom (<entry>) feeds.
     */
    parseRss(xml: string, feedUrl: string): ParsedArticle[];
    private parseItem;
    private parseEntry;
    extractSource(feedUrl: string): string;
    private extractTag;
    private extractAtomLink;
    private extractMediaContent;
    private extractEnclosure;
    stripHtml(html: string): string;
    /**
     * Insert article if URL not already present. Returns true if newly created.
     */
    private upsertArticle;
}
export {};
//# sourceMappingURL=news-ingestion.service.d.ts.map