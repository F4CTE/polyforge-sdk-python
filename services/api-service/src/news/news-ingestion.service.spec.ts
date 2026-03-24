import { describe, it, expect, beforeEach, vi } from "vitest";
import { NewsIngestionService } from "./news-ingestion.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockConfig() {
  return {
    get: vi.fn().mockReturnValue("https://example.com/rss"),
  } as any;
}

function createMockPrisma() {
  return {
    newsArticle: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as any;
}

function createMockSignalGenerator() {
  return {
    generateSignals: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("NewsIngestionService", () => {
  let service: NewsIngestionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new NewsIngestionService(
      createMockConfig(),
      prisma,
      createMockSignalGenerator(),
    );
  });

  // ── parseRss ────────────────────────────────────────────────────────────

  describe("parseRss", () => {
    it("parses RSS 2.0 items", () => {
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

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Test Article");
      expect(articles[0].url).toBe("https://example.com/article");
      expect(articles[0].source).toBe("news.example");
    });

    it("parses Atom feed entries when no RSS items found", () => {
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

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Atom Article");
      expect(articles[0].url).toBe("https://example.com/atom-article");
    });

    it("returns empty array for empty XML", () => {
      const articles = service.parseRss("<rss></rss>", "https://example.com");

      expect(articles).toEqual([]);
    });

    it("handles CDATA sections in titles", () => {
      const xml = `
        <rss><channel>
          <item>
            <title><![CDATA[Title with <b>HTML</b>]]></title>
            <link>https://example.com/cdata</link>
          </item>
        </channel></rss>
      `;

      const articles = service.parseRss(xml, "https://example.com");

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Title with HTML");
    });
  });

  // ── stripHtml ───────────────────────────────────────────────────────────

  describe("stripHtml", () => {
    it("removes HTML tags from text", () => {
      const result = service.stripHtml("<p>Hello <b>world</b></p>");

      expect(result).toBe("Hello world");
    });

    it("decodes HTML entities", () => {
      const result = service.stripHtml("A &amp; B &lt; C");

      expect(result).toBe("A & B < C");
    });

    it("collapses whitespace", () => {
      const result = service.stripHtml("hello   \n\n   world");

      expect(result).toBe("hello world");
    });
  });

  // ── extractSource ─────────────────────────────────────────────────────

  describe("extractSource", () => {
    it("extracts hostname without www prefix and TLD", () => {
      const source = service.extractSource("https://www.reuters.com/rss");

      expect(source).toBe("reuters");
    });

    it("strips feeds subdomain", () => {
      const source = service.extractSource("https://feeds.example.org/rss");

      expect(source).toBe("example");
    });

    it('returns "unknown" for invalid URLs', () => {
      const source = service.extractSource("not-a-url");

      expect(source).toBe("unknown");
    });
  });
});
