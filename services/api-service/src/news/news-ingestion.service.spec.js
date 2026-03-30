"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const news_ingestion_service_1 = require("./news-ingestion.service");
// ─── Mocks ──────────────────────────────────────────────────────────────────
function createMockConfig() {
    return {
        get: vitest_1.vi.fn().mockReturnValue("https://example.com/rss"),
    };
}
function createMockPrisma() {
    return {
        newsArticle: {
            findUnique: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
        },
    };
}
function createMockSignalGenerator() {
    return {
        generateSignals: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
}
// ─── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("NewsIngestionService", () => {
    let service;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        service = new news_ingestion_service_1.NewsIngestionService(createMockConfig(), prisma, createMockSignalGenerator());
    });
    // ── parseRss ────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("parseRss", () => {
        (0, vitest_1.it)("parses RSS 2.0 items", () => {
            const xml = `
        <rss><channel>
          <item>
            <title>Test Article</title>
            <link>https://example.com/article</link>
            <description>A test article</description>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          </item>
        </channel></rss>
      `;
            const articles = service.parseRss(xml, "https://news.example.com/rss");
            (0, vitest_1.expect)(articles).toHaveLength(1);
            (0, vitest_1.expect)(articles[0].title).toBe("Test Article");
            (0, vitest_1.expect)(articles[0].url).toBe("https://example.com/article");
            (0, vitest_1.expect)(articles[0].source).toBe("news.example");
        });
        (0, vitest_1.it)("parses Atom feed entries when no RSS items found", () => {
            const xml = `
        <feed>
          <entry>
            <title>Atom Article</title>
            <link href="https://example.com/atom-article" />
            <summary>An atom article</summary>
            <published>2024-01-01T00:00:00Z</published>
          </entry>
        </feed>
      `;
            const articles = service.parseRss(xml, "https://feeds.example.org/atom");
            (0, vitest_1.expect)(articles).toHaveLength(1);
            (0, vitest_1.expect)(articles[0].title).toBe("Atom Article");
            (0, vitest_1.expect)(articles[0].url).toBe("https://example.com/atom-article");
        });
        (0, vitest_1.it)("returns empty array for empty XML", () => {
            const articles = service.parseRss("<rss></rss>", "https://example.com");
            (0, vitest_1.expect)(articles).toEqual([]);
        });
        (0, vitest_1.it)("handles CDATA sections in titles", () => {
            const xml = `
        <rss><channel>
          <item>
            <title><![CDATA[Title with <b>HTML</b>]]></title>
            <link>https://example.com/cdata</link>
          </item>
        </channel></rss>
      `;
            const articles = service.parseRss(xml, "https://example.com");
            (0, vitest_1.expect)(articles).toHaveLength(1);
            (0, vitest_1.expect)(articles[0].title).toBe("Title with HTML");
        });
    });
    // ── stripHtml ───────────────────────────────────────────────────────────
    (0, vitest_1.describe)("stripHtml", () => {
        (0, vitest_1.it)("removes HTML tags from text", () => {
            const result = service.stripHtml("<p>Hello <b>world</b></p>");
            (0, vitest_1.expect)(result).toBe("Hello world");
        });
        (0, vitest_1.it)("decodes HTML entities", () => {
            const result = service.stripHtml("A &amp; B &lt; C");
            (0, vitest_1.expect)(result).toBe("A & B < C");
        });
        (0, vitest_1.it)("collapses whitespace", () => {
            const result = service.stripHtml("hello   \n\n   world");
            (0, vitest_1.expect)(result).toBe("hello world");
        });
    });
    // ── extractSource ─────────────────────────────────────────────────────
    (0, vitest_1.describe)("extractSource", () => {
        (0, vitest_1.it)("extracts hostname without www prefix and TLD", () => {
            const source = service.extractSource("https://www.reuters.com/rss");
            (0, vitest_1.expect)(source).toBe("reuters");
        });
        (0, vitest_1.it)("strips feeds subdomain", () => {
            const source = service.extractSource("https://feeds.example.org/rss");
            (0, vitest_1.expect)(source).toBe("example");
        });
        (0, vitest_1.it)('returns "unknown" for invalid URLs', () => {
            const source = service.extractSource("not-a-url");
            (0, vitest_1.expect)(source).toBe("unknown");
        });
    });
});
//# sourceMappingURL=news-ingestion.service.spec.js.map