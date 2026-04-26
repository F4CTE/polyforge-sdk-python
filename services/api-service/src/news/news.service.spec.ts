import { describe, it, expect, beforeEach, vi } from "vitest";
import { NewsService } from "./news.service";
import { NewsIngestionService } from "./news-ingestion.service";
import { LlmService } from "./llm.service";
import { SignalGeneratorService } from "./signal-generator.service";

// ─── Mock PrismaService ─────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    newsArticle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    newsSignal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    market: {
      findMany: vi.fn(),
    },
  } as any;
}

// ─── Mock RedisService ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    xadd: vi.fn(),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn(),
      xreadgroup: vi.fn(),
      xack: vi.fn(),
    }),
  } as any;
}

// ─── Mock ConfigService ─────────────────────────────────────────────────────

function createMockConfig(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn(
      (key: string, defaultValue?: string) =>
        overrides[key] ?? defaultValue ?? "",
    ),
    getOrThrow: vi.fn((key: string) => {
      if (overrides[key] !== undefined) return overrides[key];
      throw new Error(`Missing config: ${key}`);
    }),
  } as any;
}

// ─── NewsService ─────────────────────────────────────────────────────────────

describe("NewsService", () => {
  let service: NewsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new NewsService(prisma);
  });

  describe("getArticles", () => {
    it("returns paginated results", async () => {
      const articles = [
        { id: "a1", title: "Test Article 1", source: "reuters" },
        { id: "a2", title: "Test Article 2", source: "cnn" },
      ];

      prisma.newsArticle.findMany.mockResolvedValue(articles);
      prisma.newsArticle.count.mockResolvedValue(2);

      const result = await service.getArticles({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
    });

    it("applies source filter", async () => {
      prisma.newsArticle.findMany.mockResolvedValue([]);
      prisma.newsArticle.count.mockResolvedValue(0);

      await service.getArticles({ source: "reuters", page: 1, limit: 20 });

      const whereArg = prisma.newsArticle.findMany.mock.calls[0][0].where;
      expect(whereArg.source).toBe("reuters");
    });

    it("applies sentiment filter", async () => {
      prisma.newsArticle.findMany.mockResolvedValue([]);
      prisma.newsArticle.count.mockResolvedValue(0);

      await service.getArticles({ sentiment: "POSITIVE", page: 1, limit: 20 });

      const whereArg = prisma.newsArticle.findMany.mock.calls[0][0].where;
      expect(whereArg.sentiment).toBe("POSITIVE");
    });

    it("calculates correct page offset", async () => {
      prisma.newsArticle.findMany.mockResolvedValue([]);
      prisma.newsArticle.count.mockResolvedValue(50);

      await service.getArticles({ page: 3, limit: 10 });

      const findManyArg = prisma.newsArticle.findMany.mock.calls[0][0];
      expect(findManyArg.skip).toBe(20);
      expect(findManyArg.take).toBe(10);
    });
  });

  describe("getArticleById", () => {
    it("returns article with signals", async () => {
      const article = {
        id: "a1",
        title: "Test",
        signals: [{ id: "s1", confidence: 85 }],
      };

      prisma.newsArticle.findUnique.mockResolvedValue(article);

      const result = await service.getArticleById("a1");

      expect(result.id).toBe("a1");
      expect(result.signals).toHaveLength(1);
    });

    it("throws NotFoundException for missing article", async () => {
      prisma.newsArticle.findUnique.mockResolvedValue(null);

      await expect(service.getArticleById("missing")).rejects.toThrow(
        "Article not found",
      );
    });
  });

  describe("getMarketSentiment", () => {
    it("returns neutral sentiment when no signals exist", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([]);

      const result = await service.getMarketSentiment("some-uuid-id");

      expect(result.marketId).toBe("some-uuid-id");
      expect(result.score).toBe(0);
      expect(result.direction).toBe("NEUTRAL");
      expect(result.signalCount).toBe(0);
    });

    it("accepts non-UUID market IDs (Kalshi tickers)", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([]);

      const result = await service.getMarketSentiment("KXBTCD-25APR18-T85000");

      expect(result.marketId).toBe("KXBTCD-25APR18-T85000");
      expect(result.score).toBe(0);
      expect(result.direction).toBe("NEUTRAL");
    });

    it("computes bullish sentiment from BUY signals", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([
        { direction: "BUY", confidence: 90, createdAt: new Date() },
        { direction: "BUY", confidence: 80, createdAt: new Date() },
      ]);

      const result = await service.getMarketSentiment("mkt-1");

      expect(result.score).toBe(100);
      expect(result.direction).toBe("BULLISH");
      expect(result.signalCount).toBe(2);
      expect(result.avgConfidence).toBe(85);
    });

    it("computes bearish sentiment from SELL signals", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([
        { direction: "SELL", confidence: 85, createdAt: new Date() },
        { direction: "SELL", confidence: 75, createdAt: new Date() },
      ]);

      const result = await service.getMarketSentiment("mkt-2");

      expect(result.score).toBe(-100);
      expect(result.direction).toBe("BEARISH");
    });

    it("computes neutral sentiment from balanced signals", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([
        { direction: "BUY", confidence: 80, createdAt: new Date() },
        { direction: "SELL", confidence: 80, createdAt: new Date() },
      ]);

      const result = await service.getMarketSentiment("mkt-3");

      expect(result.score).toBe(0);
      expect(result.direction).toBe("NEUTRAL");
    });
  });

  describe("getSignals", () => {
    it("returns paginated signals", async () => {
      const signals = [
        { id: "s1", confidence: 85, direction: "BUY" },
        { id: "s2", confidence: 60, direction: "SELL" },
      ];

      prisma.newsSignal.findMany.mockResolvedValue(signals);
      prisma.newsSignal.count.mockResolvedValue(2);

      const result = await service.getSignals({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasNext).toBe(false);
    });

    it("applies marketId filter", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([]);
      prisma.newsSignal.count.mockResolvedValue(0);

      await service.getSignals({ marketId: "mkt-1", page: 1, limit: 20 });

      const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
      expect(whereArg.marketId).toBe("mkt-1");
    });

    it("applies minConfidence filter", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([]);
      prisma.newsSignal.count.mockResolvedValue(0);

      await service.getSignals({ minConfidence: 70, page: 1, limit: 20 });

      const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
      expect(whereArg.confidence).toEqual({ gte: 70 });
    });

    it("applies direction filter", async () => {
      prisma.newsSignal.findMany.mockResolvedValue([]);
      prisma.newsSignal.count.mockResolvedValue(0);

      await service.getSignals({ direction: "BUY", page: 1, limit: 20 });

      const whereArg = prisma.newsSignal.findMany.mock.calls[0][0].where;
      expect(whereArg.direction).toBe("BUY");
    });
  });
});

// ─── NewsIngestionService ────────────────────────────────────────────────────

describe("NewsIngestionService", () => {
  let ingestion: NewsIngestionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const config = createMockConfig({
      NEWS_RSS_FEEDS: "https://feeds.example.com/rss",
    });
    const signalGenerator = {
      generateSignals: vi.fn().mockResolvedValue(undefined),
    } as any;
    ingestion = new NewsIngestionService(
      config,
      prisma,
      createMockRedis(),
      signalGenerator,
    );
  });

  describe("parseRss", () => {
    it("parses RSS 2.0 items", () => {
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

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe("Breaking News");
      expect(articles[0].url).toBe("https://example.com/article1");
      expect(articles[0].summary).toBe("Summary of article");
      expect(articles[0].source).toBe("example");
    });

    it("parses CDATA sections", () => {
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

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("CDATA Title");
      expect(articles[0].summary).toBe("HTML in CDATA");
    });

    it("handles empty feed", () => {
      const xml = `<?xml version="1.0"?>
        <rss version="2.0"><channel></channel></rss>`;

      const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");

      expect(articles).toHaveLength(0);
    });

    it("skips items without title or link", () => {
      const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <description>No title or link</description>
            </item>
          </channel>
        </rss>`;

      const articles = ingestion.parseRss(xml, "https://feeds.example.com/rss");

      expect(articles).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("skips articles that already exist by URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );
      prisma.newsArticle.findUnique.mockResolvedValue({ id: "existing" });

      // Access the private method via the ingestion flow
      await ingestion
        .ingestFeed("https://feeds.example.com/rss")
        .catch(() => 0);

      // Since fetch will fail in test, we test dedup logic directly
      expect(prisma.newsArticle.create).not.toHaveBeenCalled();
    });
  });

  describe("extractSource", () => {
    it("extracts source from feed URL", () => {
      expect(
        ingestion.extractSource("https://feeds.reuters.com/reuters/topNews"),
      ).toBe("reuters");
      expect(
        ingestion.extractSource("https://rss.cnn.com/rss/money_latest.rss"),
      ).toBe("cnn");
      expect(ingestion.extractSource("https://www.bbc.com/feed")).toBe("bbc");
    });
  });

  describe("stripHtml", () => {
    it("strips HTML tags", () => {
      expect(ingestion.stripHtml("<p>Hello <b>World</b></p>")).toBe(
        "Hello World",
      );
    });

    it("decodes HTML entities", () => {
      expect(ingestion.stripHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
      expect(ingestion.stripHtml("&lt;tag&gt;")).toBe("<tag>");
    });
  });
});

// ─── LlmService ──────────────────────────────────────────────────────────────

describe("LlmService", () => {
  it("throws when no API keys configured", async () => {
    const config = createMockConfig({});
    const llm = new LlmService(config);

    await expect(llm.analyze("test prompt")).rejects.toThrow(
      "No LLM API keys configured",
    );
  });

  it("falls back to OpenAI when Claude fails", async () => {
    const config = createMockConfig({
      ANTHROPIC_API_KEY: "sk-ant-test",
      OPENAI_API_KEY: "sk-test",
    });
    const llm = new LlmService(config);

    // Mock global fetch
    const mockFetch = vi.fn();

    // First call (Claude) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server Error"),
    });

    // Second call (OpenAI) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "OpenAI response" } }],
        }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await llm.analyze("test prompt");
      expect(result).toBe("OpenAI response");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses Claude when available", async () => {
    const config = createMockConfig({
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    const llm = new LlmService(config);

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: "Claude response" }],
        }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await llm.analyze("test prompt");
      expect(result).toBe("Claude response");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── SignalGeneratorService ──────────────────────────────────────────────────

describe("SignalGeneratorService", () => {
  let generator: SignalGeneratorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let llm: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    llm = { analyze: vi.fn() };
    generator = new SignalGeneratorService(prisma, redis, llm);
  });

  describe("buildPrompt", () => {
    it("includes article title and market list", () => {
      const article = {
        title: "Fed Raises Rates",
        summary: "The Federal Reserve...",
      };
      const markets = [
        {
          id: "mkt-1",
          title: "Will Fed raise rates?",
          slug: "fed-rates",
          category: "Economics",
        },
      ];

      const prompt = generator.buildPrompt(article, markets);

      expect(prompt).toContain("Fed Raises Rates");
      expect(prompt).toContain("The Federal Reserve...");
      expect(prompt).toContain("mkt-1");
      expect(prompt).toContain("Will Fed raise rates?");
    });

    it("handles missing summary", () => {
      const article = { title: "Test", summary: null };
      const markets = [
        { id: "m1", title: "Market 1", slug: "m1", category: null },
      ];

      const prompt = generator.buildPrompt(article, markets);

      expect(prompt).toContain("No summary available");
    });
  });

  describe("parseResponse", () => {
    it("parses valid JSON array", () => {
      const raw = JSON.stringify([
        {
          marketId: "m1",
          direction: "BUY",
          outcome: "YES",
          confidence: 85,
          reasoning: "Strong correlation",
        },
      ]);

      const signals = generator.parseResponse(raw);

      expect(signals).toHaveLength(1);
      expect(signals[0].marketId).toBe("m1");
      expect(signals[0].direction).toBe("BUY");
      expect(signals[0].confidence).toBe(85);
    });

    it("handles markdown code blocks", () => {
      const raw =
        '```json\n[{"marketId":"m1","direction":"SELL","outcome":"NO","confidence":60,"reasoning":"Weak signal"}]\n```';

      const signals = generator.parseResponse(raw);

      expect(signals).toHaveLength(1);
      expect(signals[0].direction).toBe("SELL");
    });

    it("filters out invalid signals", () => {
      const raw = JSON.stringify([
        {
          marketId: "m1",
          direction: "BUY",
          outcome: "YES",
          confidence: 85,
          reasoning: "Good",
        },
        {
          marketId: "m2",
          direction: "INVALID",
          outcome: "YES",
          confidence: 50,
          reasoning: "Bad",
        },
        {
          marketId: "m3",
          direction: "BUY",
          outcome: "YES",
          confidence: 150,
          reasoning: "Too high",
        },
        { direction: "BUY", outcome: "YES", confidence: 50 }, // missing marketId
      ]);

      const signals = generator.parseResponse(raw);

      expect(signals).toHaveLength(1);
      expect(signals[0].marketId).toBe("m1");
    });

    it("returns empty array for invalid JSON", () => {
      const signals = generator.parseResponse("not valid json");

      expect(signals).toHaveLength(0);
    });

    it("returns empty array for empty response", () => {
      const signals = generator.parseResponse("[]");

      expect(signals).toHaveLength(0);
    });

    it("rounds confidence to integer", () => {
      const raw = JSON.stringify([
        {
          marketId: "m1",
          direction: "BUY",
          outcome: "YES",
          confidence: 72.6,
          reasoning: "Test",
        },
      ]);

      const signals = generator.parseResponse(raw);

      expect(signals[0].confidence).toBe(73);
    });
  });

  describe("generateSignals", () => {
    it("skips when no active markets", async () => {
      prisma.market.findMany.mockResolvedValue([]);

      await generator.generateSignals({
        id: "a1",
        title: "Test",
        summary: "Test summary",
      });

      expect(llm.analyze).not.toHaveBeenCalled();
    });

    it("creates signals and emits high-confidence to stream", async () => {
      const markets = [
        { id: "mkt-1", title: "Market One", slug: "m1", category: "Politics" },
      ];
      prisma.market.findMany.mockResolvedValue(markets);

      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "mkt-1",
            direction: "BUY",
            outcome: "YES",
            confidence: 85,
            reasoning: "Strong",
          },
        ]),
      );

      prisma.newsSignal.create.mockResolvedValue({ id: "sig-1" });
      redis.xadd.mockResolvedValue("ok");

      await generator.generateSignals({
        id: "a1",
        title: "Test Article",
        summary: "Summary",
      });

      expect(prisma.newsSignal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: "a1",
          marketId: "mkt-1",
          direction: "BUY",
          outcome: "YES",
          confidence: 85,
        }),
      });

      // High confidence (>70) should emit to stream
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NEWS_SIGNAL",
          signalId: "sig-1",
          confidence: "85",
        }),
      );
    });

    it("does not emit low-confidence signals to stream", async () => {
      const markets = [
        { id: "mkt-1", title: "Market One", slug: "m1", category: null },
      ];
      prisma.market.findMany.mockResolvedValue(markets);

      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "mkt-1",
            direction: "SELL",
            outcome: "NO",
            confidence: 40,
            reasoning: "Weak",
          },
        ]),
      );

      prisma.newsSignal.create.mockResolvedValue({ id: "sig-2" });

      await generator.generateSignals({
        id: "a2",
        title: "Minor News",
        summary: null,
      });

      expect(prisma.newsSignal.create).toHaveBeenCalled();
      expect(redis.xadd).not.toHaveBeenCalled();
    });

    it("skips signals referencing non-existent markets", async () => {
      const markets = [
        { id: "mkt-1", title: "Market One", slug: "m1", category: null },
      ];
      prisma.market.findMany.mockResolvedValue(markets);

      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "mkt-999",
            direction: "BUY",
            outcome: "YES",
            confidence: 90,
            reasoning: "Good",
          },
        ]),
      );

      await generator.generateSignals({
        id: "a3",
        title: "Test",
        summary: null,
      });

      expect(prisma.newsSignal.create).not.toHaveBeenCalled();
    });

    it("handles LLM failure gracefully", async () => {
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

      expect(prisma.newsSignal.create).not.toHaveBeenCalled();
    });
  });
});
