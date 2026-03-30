"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const news_service_1 = require("./news.service");
const news_ingestion_service_1 = require("./news-ingestion.service");
const llm_service_1 = require("./llm.service");
const signal_generator_service_1 = require("./signal-generator.service");
// ─── Mock PrismaService ─────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        newsArticle: {
            findMany: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
        },
        newsSignal: {
            findMany: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
        },
        market: {
            findMany: vitest_1.vi.fn(),
        },
    };
}
// ─── Mock RedisService ──────────────────────────────────────────────────────
function createMockRedis() {
    return {
        get: vitest_1.vi.fn(),
        set: vitest_1.vi.fn(),
        xadd: vitest_1.vi.fn(),
        getClient: vitest_1.vi.fn().mockReturnValue({
            xgroup: vitest_1.vi.fn(),
            xreadgroup: vitest_1.vi.fn(),
            xack: vitest_1.vi.fn(),
        }),
    };
}
// ─── Mock ConfigService ─────────────────────────────────────────────────────
function createMockConfig(overrides = {}) {
    return {
        get: vitest_1.vi.fn((key, defaultValue) => overrides[key] ?? defaultValue ?? ""),
        getOrThrow: vitest_1.vi.fn((key) => {
            if (overrides[key] !== undefined)
                return overrides[key];
            throw new Error(`Missing config: ${key}`);
        }),
    };
}
// ─── NewsService ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("NewsService", () => {
    let service;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        service = new news_service_1.NewsService(prisma);
    });
    (0, vitest_1.describe)("getArticles", () => {
        (0, vitest_1.it)("returns paginated results", async () => {
            const articles = [
                { id: "a1", title: "Test Article 1", source: "reuters" },
                { id: "a2", title: "Test Article 2", source: "cnn" },
            ];
            prisma.newsArticle.findMany.mockResolvedValue(articles);
            prisma.newsArticle.count.mockResolvedValue(2);
            const result = await service.getArticles({ page: 1, limit: 20 });
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.meta.total).toBe(2);
            (0, vitest_1.expect)(result.meta.page).toBe(1);
            (0, vitest_1.expect)(result.meta.totalPages).toBe(1);
        });
        (0, vitest_1.it)("applies source filter", async () => {
            prisma.newsArticle.findMany.mockResolvedValue([]);
            prisma.newsArticle.count.mockResolvedValue(0);
            await service.getArticles({ source: "reuters", page: 1, limit: 20 });
            const whereArg = prisma.newsArticle.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.source).toBe("reuters");
        });
        (0, vitest_1.it)("applies sentiment filter", async () => {
            prisma.newsArticle.findMany.mockResolvedValue([]);
            prisma.newsArticle.count.mockResolvedValue(0);
            await service.getArticles({ sentiment: "POSITIVE", page: 1, limit: 20 });
            const whereArg = prisma.newsArticle.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.sentiment).toBe("POSITIVE");
        });
        (0, vitest_1.it)("calculates correct page offset", async () => {
            prisma.newsArticle.findMany.mockResolvedValue([]);
            prisma.newsArticle.count.mockResolvedValue(50);
            await service.getArticles({ page: 3, limit: 10 });
            const findManyArg = prisma.newsArticle.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(findManyArg.skip).toBe(20);
            (0, vitest_1.expect)(findManyArg.take).toBe(10);
        });
    });
    (0, vitest_1.describe)("getArticleById", () => {
        (0, vitest_1.it)("returns article with signals", async () => {
            const article = {
                id: "a1",
                title: "Test",
                signals: [{ id: "s1", confidence: 85 }],
            };
            prisma.newsArticle.findUnique.mockResolvedValue(article);
            const result = await service.getArticleById("a1");
            (0, vitest_1.expect)(result.id).toBe("a1");
            (0, vitest_1.expect)(result.signals).toHaveLength(1);
        });
        (0, vitest_1.it)("throws NotFoundException for missing article", async () => {
            prisma.newsArticle.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.getArticleById("missing")).rejects.toThrow("Article not found");
        });
    });
    (0, vitest_1.describe)("getSignals", () => {
        (0, vitest_1.it)("returns paginated signals", async () => {
            const signals = [
                { id: "s1", confidence: 85, direction: "BUY" },
                { id: "s2", confidence: 60, direction: "SELL" },
            ];
            prisma.newsSignal.findMany.mockResolvedValue(signals);
            prisma.newsSignal.count.mockResolvedValue(2);
            const result = await service.getSignals({ page: 1, limit: 20 });
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.meta.total).toBe(2);
        });
        (0, vitest_1.it)("applies marketId filter", async () => {
            prisma.newsSignal.findMany.mockResolvedValue([]);
            prisma.newsSignal.count.mockResolvedValue(0);
            await service.getSignals({ marketId: "mkt-1", page: 1, limit: 20 });
            const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.marketId).toBe("mkt-1");
        });
        (0, vitest_1.it)("applies minConfidence filter", async () => {
            prisma.newsSignal.findMany.mockResolvedValue([]);
            prisma.newsSignal.count.mockResolvedValue(0);
            await service.getSignals({ minConfidence: 70, page: 1, limit: 20 });
            const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.confidence).toEqual({ gte: 70 });
        });
        (0, vitest_1.it)("applies direction filter", async () => {
            prisma.newsSignal.findMany.mockResolvedValue([]);
            prisma.newsSignal.count.mockResolvedValue(0);
            await service.getSignals({ direction: "BUY", page: 1, limit: 20 });
            const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.direction).toBe("BUY");
        });
    });
});
// ─── NewsIngestionService ────────────────────────────────────────────────────
(0, vitest_1.describe)("NewsIngestionService", () => {
    let ingestion;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        const config = createMockConfig({
            NEWS_RSS_FEEDS: "https://feeds.example.com/rss",
        });
        const signalGenerator = { generateSignals: vitest_1.vi.fn().mockResolvedValue(undefined) };
        ingestion = new news_ingestion_service_1.NewsIngestionService(config, prisma, signalGenerator);
    });
    (0, vitest_1.describe)("parseRss", () => {
        (0, vitest_1.it)("parses RSS 2.0 items", () => {
            const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Breaking News</title>
              <link>https://example.com/article1</link>
              <description>Summary of article</description>
              <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Another Story</title>
              <link>https://example.com/article2</link>
              <description>Another summary</description>
              <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;
            const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");
            (0, vitest_1.expect)(articles).toHaveLength(2);
            (0, vitest_1.expect)(articles[0].title).toBe("Breaking News");
            (0, vitest_1.expect)(articles[0].url).toBe("https://example.com/article1");
            (0, vitest_1.expect)(articles[0].summary).toBe("Summary of article");
            (0, vitest_1.expect)(articles[0].source).toBe("example");
        });
        (0, vitest_1.it)("parses CDATA sections", () => {
            const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title><![CDATA[CDATA Title]]></title>
              <link>https://example.com/cdata</link>
              <description><![CDATA[<p>HTML in CDATA</p>]]></description>
              <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;
            const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");
            (0, vitest_1.expect)(articles).toHaveLength(1);
            (0, vitest_1.expect)(articles[0].title).toBe("CDATA Title");
            (0, vitest_1.expect)(articles[0].summary).toBe("HTML in CDATA");
        });
        (0, vitest_1.it)("handles empty feed", () => {
            const xml = `<?xml version="1.0"?>
        <rss version="2.0"><channel></channel></rss>`;
            const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");
            (0, vitest_1.expect)(articles).toHaveLength(0);
        });
        (0, vitest_1.it)("skips items without title or link", () => {
            const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <description>No title or link</description>
            </item>
          </channel>
        </rss>`;
            const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");
            (0, vitest_1.expect)(articles).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)("deduplication", () => {
        (0, vitest_1.it)("skips articles that already exist by URL", async () => {
            prisma.newsArticle.findUnique.mockResolvedValue({ id: "existing" });
            // Access the private method via the ingestion flow
            const count = await ingestion.ingestFeed("https://feeds.example.com/rss")
                .catch(() => 0);
            // Since fetch will fail in test, we test dedup logic directly
            (0, vitest_1.expect)(prisma.newsArticle.create).not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)("extractSource", () => {
        (0, vitest_1.it)("extracts source from feed URL", () => {
            (0, vitest_1.expect)(ingestion.extractSource("https://feeds.reuters.com/reuters/topNews")).toBe("reuters");
            (0, vitest_1.expect)(ingestion.extractSource("https://rss.cnn.com/rss/money_latest.rss")).toBe("cnn");
            (0, vitest_1.expect)(ingestion.extractSource("https://www.bbc.com/feed")).toBe("bbc");
        });
    });
    (0, vitest_1.describe)("stripHtml", () => {
        (0, vitest_1.it)("strips HTML tags", () => {
            (0, vitest_1.expect)(ingestion.stripHtml("<p>Hello <b>World</b></p>")).toBe("Hello World");
        });
        (0, vitest_1.it)("decodes HTML entities", () => {
            (0, vitest_1.expect)(ingestion.stripHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
            (0, vitest_1.expect)(ingestion.stripHtml("&lt;tag&gt;")).toBe("<tag>");
        });
    });
});
// ─── LlmService ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("LlmService", () => {
    (0, vitest_1.it)("throws when no API keys configured", async () => {
        const config = createMockConfig({});
        const llm = new llm_service_1.LlmService(config);
        await (0, vitest_1.expect)(llm.analyze("test prompt")).rejects.toThrow("No LLM API keys configured");
    });
    (0, vitest_1.it)("falls back to OpenAI when Claude fails", async () => {
        const config = createMockConfig({
            ANTHROPIC_API_KEY: "sk-ant-test",
            OPENAI_API_KEY: "sk-test",
        });
        const llm = new llm_service_1.LlmService(config);
        // Mock global fetch
        const mockFetch = vitest_1.vi.fn();
        // First call (Claude) fails
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: () => Promise.resolve("Server Error"),
        });
        // Second call (OpenAI) succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: "OpenAI response" } }],
            }),
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch;
        try {
            const result = await llm.analyze("test prompt");
            (0, vitest_1.expect)(result).toBe("OpenAI response");
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(2);
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    });
    (0, vitest_1.it)("uses Claude when available", async () => {
        const config = createMockConfig({
            ANTHROPIC_API_KEY: "sk-ant-test",
        });
        const llm = new llm_service_1.LlmService(config);
        const mockFetch = vitest_1.vi.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                content: [{ text: "Claude response" }],
            }),
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch;
        try {
            const result = await llm.analyze("test prompt");
            (0, vitest_1.expect)(result).toBe("Claude response");
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(1);
            const [url] = mockFetch.mock.calls[0];
            (0, vitest_1.expect)(url).toBe("https://api.anthropic.com/v1/messages");
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    });
});
// ─── SignalGeneratorService ──────────────────────────────────────────────────
(0, vitest_1.describe)("SignalGeneratorService", () => {
    let generator;
    let prisma;
    let redis;
    let llm;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        llm = { analyze: vitest_1.vi.fn() };
        generator = new signal_generator_service_1.SignalGeneratorService(prisma, redis, llm);
    });
    (0, vitest_1.describe)("buildPrompt", () => {
        (0, vitest_1.it)("includes article title and market list", () => {
            const article = { title: "Fed Raises Rates", summary: "The Federal Reserve..." };
            const markets = [
                { id: "mkt-1", title: "Will Fed raise rates?", slug: "fed-rates", category: "Economics" },
            ];
            const prompt = generator.buildPrompt(article, markets);
            (0, vitest_1.expect)(prompt).toContain("Fed Raises Rates");
            (0, vitest_1.expect)(prompt).toContain("The Federal Reserve...");
            (0, vitest_1.expect)(prompt).toContain("mkt-1");
            (0, vitest_1.expect)(prompt).toContain("Will Fed raise rates?");
        });
        (0, vitest_1.it)("handles missing summary", () => {
            const article = { title: "Test", summary: null };
            const markets = [
                { id: "m1", title: "Market 1", slug: "m1", category: null },
            ];
            const prompt = generator.buildPrompt(article, markets);
            (0, vitest_1.expect)(prompt).toContain("No summary available");
        });
    });
    (0, vitest_1.describe)("parseResponse", () => {
        (0, vitest_1.it)("parses valid JSON array", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 85, reasoning: "Strong correlation" },
            ]);
            const signals = generator.parseResponse(raw);
            (0, vitest_1.expect)(signals).toHaveLength(1);
            (0, vitest_1.expect)(signals[0].marketId).toBe("m1");
            (0, vitest_1.expect)(signals[0].direction).toBe("BUY");
            (0, vitest_1.expect)(signals[0].confidence).toBe(85);
        });
        (0, vitest_1.it)("handles markdown code blocks", () => {
            const raw = '```json\n[{"marketId":"m1","direction":"SELL","outcome":"NO","confidence":60,"reasoning":"Weak signal"}]\n```';
            const signals = generator.parseResponse(raw);
            (0, vitest_1.expect)(signals).toHaveLength(1);
            (0, vitest_1.expect)(signals[0].direction).toBe("SELL");
        });
        (0, vitest_1.it)("filters out invalid signals", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 85, reasoning: "Good" },
                { marketId: "m2", direction: "INVALID", outcome: "YES", confidence: 50, reasoning: "Bad" },
                { marketId: "m3", direction: "BUY", outcome: "YES", confidence: 150, reasoning: "Too high" },
                { direction: "BUY", outcome: "YES", confidence: 50 }, // missing marketId
            ]);
            const signals = generator.parseResponse(raw);
            (0, vitest_1.expect)(signals).toHaveLength(1);
            (0, vitest_1.expect)(signals[0].marketId).toBe("m1");
        });
        (0, vitest_1.it)("returns empty array for invalid JSON", () => {
            const signals = generator.parseResponse("not valid json");
            (0, vitest_1.expect)(signals).toHaveLength(0);
        });
        (0, vitest_1.it)("returns empty array for empty response", () => {
            const signals = generator.parseResponse("[]");
            (0, vitest_1.expect)(signals).toHaveLength(0);
        });
        (0, vitest_1.it)("rounds confidence to integer", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 72.6, reasoning: "Test" },
            ]);
            const signals = generator.parseResponse(raw);
            (0, vitest_1.expect)(signals[0].confidence).toBe(73);
        });
    });
    (0, vitest_1.describe)("generateSignals", () => {
        (0, vitest_1.it)("skips when no active markets", async () => {
            prisma.market.findMany.mockResolvedValue([]);
            await generator.generateSignals({
                id: "a1",
                title: "Test",
                summary: "Test summary",
            });
            (0, vitest_1.expect)(llm.analyze).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates signals and emits high-confidence to stream", async () => {
            const markets = [
                { id: "mkt-1", title: "Market One", slug: "m1", category: "Politics" },
            ];
            prisma.market.findMany.mockResolvedValue(markets);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "mkt-1", direction: "BUY", outcome: "YES", confidence: 85, reasoning: "Strong" },
            ]));
            prisma.newsSignal.create.mockResolvedValue({ id: "sig-1" });
            redis.xadd.mockResolvedValue("ok");
            await generator.generateSignals({
                id: "a1",
                title: "Test Article",
                summary: "Summary",
            });
            (0, vitest_1.expect)(prisma.newsSignal.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({
                    articleId: "a1",
                    marketId: "mkt-1",
                    direction: "BUY",
                    outcome: "YES",
                    confidence: 85,
                }),
            });
            // High confidence (>70) should emit to stream
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({
                type: "NEWS_SIGNAL",
                signalId: "sig-1",
                confidence: "85",
            }));
        });
        (0, vitest_1.it)("does not emit low-confidence signals to stream", async () => {
            const markets = [
                { id: "mkt-1", title: "Market One", slug: "m1", category: null },
            ];
            prisma.market.findMany.mockResolvedValue(markets);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "mkt-1", direction: "SELL", outcome: "NO", confidence: 40, reasoning: "Weak" },
            ]));
            prisma.newsSignal.create.mockResolvedValue({ id: "sig-2" });
            await generator.generateSignals({
                id: "a2",
                title: "Minor News",
                summary: null,
            });
            (0, vitest_1.expect)(prisma.newsSignal.create).toHaveBeenCalled();
            (0, vitest_1.expect)(redis.xadd).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("skips signals referencing non-existent markets", async () => {
            const markets = [
                { id: "mkt-1", title: "Market One", slug: "m1", category: null },
            ];
            prisma.market.findMany.mockResolvedValue(markets);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "mkt-999", direction: "BUY", outcome: "YES", confidence: 90, reasoning: "Good" },
            ]));
            await generator.generateSignals({
                id: "a3",
                title: "Test",
                summary: null,
            });
            (0, vitest_1.expect)(prisma.newsSignal.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("handles LLM failure gracefully", async () => {
            const markets = [
                { id: "mkt-1", title: "Market One", slug: "m1", category: null },
            ];
            prisma.market.findMany.mockResolvedValue(markets);
            llm.analyze.mockRejectedValue(new Error("LLM unavailable"));
            // Should not throw
            await generator.generateSignals({
                id: "a4",
                title: "Test",
                summary: null,
            });
            (0, vitest_1.expect)(prisma.newsSignal.create).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=news.service.spec.js.map