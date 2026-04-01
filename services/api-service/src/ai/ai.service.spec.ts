import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PrismaService } from "@polyforge/shared-db";
import { AiService } from "./ai.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Suite ──────────────────────────────────────────────────────────────────────

describe("AiService", () => {
  let service: AiService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new AiService(db as unknown as PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Intent matching ─────────────────────────────────────────────────────────

  describe("intent matching", () => {
    it('matches "my strategies" to list_strategies intent', async () => {
      db.strategy.findMany.mockResolvedValue([]);

      const result = await service.query("user-1", "show me my strategies");

      expect(result.intent).toBe("list_strategies");
    });

    it('matches "portfolio" to get_portfolio intent', async () => {
      db.position.findMany.mockResolvedValue([]);

      const result = await service.query("user-1", "what is my portfolio?");

      expect(result.intent).toBe("get_portfolio");
    });

    it('matches "whale" to get_whale_feed intent', async () => {
      db.whaleAlert.findMany.mockResolvedValue([]);

      const result = await service.query("user-1", "show me whale activity");

      expect(result.intent).toBe("get_whale_feed");
    });

    it('matches "news signals" to get_news_signals intent', async () => {
      db.newsSignal.findMany.mockResolvedValue([]);

      const result = await service.query(
        "user-1",
        "what are the latest news signals?",
      );

      expect(result.intent).toBe("get_news_signals");
    });
  });

  // ── Summary generation ──────────────────────────────────────────────────────

  describe("summary generation", () => {
    it("returns a summary string with data count", async () => {
      db.strategy.findMany.mockResolvedValue([
        { id: "1", name: "Momentum", status: "RUNNING", createdAt: new Date() },
        { id: "2", name: "Mean Rev", status: "IDLE", createdAt: new Date() },
      ] as any);

      const result = await service.query("user-1", "my strategies");

      expect(result.summary).toContain("2");
      expect(result.summary).toContain("strategies");
      expect(result.data).toHaveLength(2);
    });
  });

  // ── Unknown intent ──────────────────────────────────────────────────────────

  describe("unknown intent", () => {
    it('returns "unknown" intent for unmatched queries', async () => {
      const result = await service.query("user-1", "xyzzy foobar gibberish");

      expect(result.intent).toBe("unknown");
      expect(result.data).toBeNull();
      expect(result.summary).toContain("didn't understand");
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("returns an error summary when a handler throws", async () => {
      db.strategy.findMany.mockRejectedValue(new Error("DB unavailable"));

      const result = await service.query("user-1", "my strategies");

      expect(result.intent).toBe("list_strategies");
      expect(result.summary).toContain("error");
    });
  });
});
