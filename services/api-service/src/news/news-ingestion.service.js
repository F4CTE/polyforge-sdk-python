"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NewsIngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsIngestionService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const shared_db_1 = require("@polyforge/shared-db");
const signal_generator_service_1 = require("./signal-generator.service");
let NewsIngestionService = NewsIngestionService_1 = class NewsIngestionService {
    config;
    prisma;
    signalGenerator;
    logger = new common_1.Logger(NewsIngestionService_1.name);
    feeds;
    constructor(config, prisma, signalGenerator) {
        this.config = config;
        this.prisma = prisma;
        this.signalGenerator = signalGenerator;
        const feedsEnv = this.config.get("NEWS_RSS_FEEDS", "");
        this.feeds = feedsEnv
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);
    }
    onModuleInit() {
        if (this.feeds.length === 0) {
            this.logger.warn("NEWS_RSS_FEEDS not configured — news ingestion disabled");
        }
        else {
            this.logger.log(`News ingestion configured with ${this.feeds.length} RSS feed(s)`);
        }
    }
    /**
     * Poll RSS feeds every 5 minutes.
     */
    async pollFeeds() {
        if (this.feeds.length === 0)
            return;
        this.logger.debug(`Polling ${this.feeds.length} RSS feed(s)...`);
        for (const feedUrl of this.feeds) {
            try {
                await this.ingestFeed(feedUrl);
            }
            catch (err) {
                this.logger.error(`Failed to ingest feed ${feedUrl}: ${err?.message}`);
            }
        }
    }
    async ingestFeed(feedUrl) {
        const res = await fetch(feedUrl, {
            headers: { "User-Agent": "Polyforge-NewsBot/1.0" },
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} from ${feedUrl}`);
        }
        // H-04: Limit RSS response body to 1MB max
        const xml = await res.text();
        if (xml.length > 1_048_576) {
            throw new Error(`RSS response too large (${xml.length} bytes) from ${feedUrl}`);
        }
        // H-04: Strip null bytes and control characters before parsing
        const sanitizedXml = xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
        const articles = this.parseRss(sanitizedXml, feedUrl);
        // Batch insert — skipDuplicates avoids N+1 findUnique+create pattern
        const result = await this.prisma.newsArticle.createMany({
            data: articles.map((a) => ({
                source: a.source,
                title: a.title,
                summary: a.summary,
                url: a.url,
                imageUrl: a.imageUrl,
                publishedAt: a.publishedAt,
            })),
            skipDuplicates: true,
        });
        const newCount = result.count;
        if (newCount > 0) {
            this.logger.log(`Ingested ${newCount} new article(s) from ${feedUrl}`);
            // Trigger signal generation for newly inserted articles
            try {
                const recentArticles = await this.prisma.newsArticle.findMany({
                    where: { source: feedUrl.includes('reuters') ? 'reuters' : feedUrl.includes('coindesk') ? 'coindesk' : 'rss' },
                    orderBy: { ingestedAt: "desc" },
                    take: newCount,
                    select: { id: true, title: true, summary: true },
                });
                for (const article of recentArticles) {
                    this.signalGenerator?.generateSignals?.(article)?.catch((err) => {
                        this.logger.error(`Signal generation failed for article ${article.id}: ${err?.message}`);
                    });
                }
            }
            catch {
                // Signal generation is non-critical
            }
        }
        return newCount;
    }
    /**
     * Parse RSS XML into article objects.
     * Handles both RSS 2.0 (<item>) and Atom (<entry>) feeds.
     */
    parseRss(xml, feedUrl) {
        const articles = [];
        // Extract source name from feed URL
        const source = this.extractSource(feedUrl);
        // RSS 2.0: <item> elements
        const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            try {
                const itemXml = match[1];
                const article = this.parseItem(itemXml, source);
                if (article) {
                    articles.push(article);
                }
            }
            catch (err) {
                this.logger.warn(`Failed to parse RSS item: ${err?.message}`);
            }
        }
        // Atom: <entry> elements (if no items found)
        if (articles.length === 0) {
            const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
            while ((match = entryRegex.exec(xml)) !== null) {
                try {
                    const entryXml = match[1];
                    const article = this.parseEntry(entryXml, source);
                    if (article) {
                        articles.push(article);
                    }
                }
                catch (err) {
                    this.logger.warn(`Failed to parse Atom entry: ${err?.message}`);
                }
            }
        }
        return articles;
    }
    parseItem(itemXml, source) {
        const title = this.extractTag(itemXml, "title");
        const link = this.extractTag(itemXml, "link");
        if (!title || !link)
            return null;
        const description = this.extractTag(itemXml, "description");
        const pubDate = this.extractTag(itemXml, "pubDate");
        const imageUrl = this.extractMediaContent(itemXml) ??
            this.extractEnclosure(itemXml);
        return {
            source,
            title: this.stripHtml(title).slice(0, 500),
            summary: description ? this.stripHtml(description).slice(0, 2000) : null,
            url: link,
            imageUrl,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
        };
    }
    parseEntry(entryXml, source) {
        const title = this.extractTag(entryXml, "title");
        const link = this.extractAtomLink(entryXml) ??
            this.extractTag(entryXml, "link");
        if (!title || !link)
            return null;
        const summary = this.extractTag(entryXml, "summary") ??
            this.extractTag(entryXml, "content");
        const updated = this.extractTag(entryXml, "published") ??
            this.extractTag(entryXml, "updated");
        return {
            source,
            title: this.stripHtml(title).slice(0, 500),
            summary: summary ? this.stripHtml(summary).slice(0, 2000) : null,
            url: link,
            imageUrl: null,
            publishedAt: updated ? new Date(updated) : new Date(),
        };
    }
    extractSource(feedUrl) {
        try {
            const hostname = new URL(feedUrl).hostname;
            // Strip www. and .com/.org etc
            return hostname
                .replace(/^(www|feeds|rss)\./, "")
                .replace(/\.(com|org|net|io)$/, "");
        }
        catch {
            return "unknown";
        }
    }
    extractTag(xml, tag) {
        // Handle CDATA sections
        const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
        const cdataMatch = cdataRegex.exec(xml);
        if (cdataMatch)
            return cdataMatch[1].trim();
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
        const match = regex.exec(xml);
        return match ? match[1].trim() : null;
    }
    extractAtomLink(xml) {
        const regex = /<link[^>]+href="([^"]+)"[^>]*\/?>/i;
        const match = regex.exec(xml);
        return match ? match[1] : null;
    }
    extractMediaContent(xml) {
        const regex = /<media:content[^>]+url="([^"]+)"[^>]*\/?>/i;
        const match = regex.exec(xml);
        return match ? match[1] : null;
    }
    extractEnclosure(xml) {
        const regex = /<enclosure[^>]+url="([^"]+)"[^>]*type="image[^"]*"[^>]*\/?>/i;
        const match = regex.exec(xml);
        return match ? match[1] : null;
    }
    stripHtml(html) {
        return html
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    /**
     * Insert article if URL not already present. Returns true if newly created.
     */
    async upsertArticle(article) {
        const existing = await this.prisma.newsArticle.findUnique({
            where: { url: article.url },
        });
        if (existing)
            return false;
        const created = await this.prisma.newsArticle.create({
            data: {
                source: article.source,
                title: article.title,
                summary: article.summary,
                url: article.url,
                imageUrl: article.imageUrl,
                publishedAt: article.publishedAt,
            },
        });
        // Queue for signal generation (fire-and-forget)
        this.signalGenerator.generateSignals(created).catch((err) => {
            this.logger.error(`Signal generation failed for article ${created.id}: ${err?.message}`);
        });
        return true;
    }
};
exports.NewsIngestionService = NewsIngestionService;
__decorate([
    (0, schedule_1.Cron)("*/5 * * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NewsIngestionService.prototype, "pollFeeds", null);
exports.NewsIngestionService = NewsIngestionService = NewsIngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        shared_db_1.PrismaService,
        signal_generator_service_1.SignalGeneratorService])
], NewsIngestionService);
//# sourceMappingURL=news-ingestion.service.js.map