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
    service = new AiService(db as unknown as PrismaService, {} as any);
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

  // ── Portfolio review ───────────────────────────────────────────────────────

  describe("portfolioReview", () => {
    let mockLlm: { analyze: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockLlm = { analyze: vi.fn() };
      service = new AiService(db as unknown as PrismaService, mockLlm as any);
    });

    it("returns review, keyInsights, riskFactors, opportunities, generatedAt", async () => {
      db.position.findMany.mockResolvedValue([]);
      db.order.findMany.mockResolvedValue([]);
      mockLlm.analyze.mockResolvedValue(
        JSON.stringify({
          review: "Portfolio looks balanced.",
          keyInsights: ["Diversified across 5 markets"],
          riskFactors: ["High exposure to crypto"],
          opportunities: ["Arbitrage on market X"],
        }),
      );

      const result = await service.portfolioReview("user-1");

      expect(result).toHaveProperty("review");
      expect(result).toHaveProperty("keyInsights");
      expect(result).toHaveProperty("riskFactors");
      expect(result).toHaveProperty("opportunities");
      expect(result).toHaveProperty("generatedAt");
      expect(result.review).toBe("Portfolio looks balanced.");
      expect(result.keyInsights).toEqual(["Diversified across 5 markets"]);
      expect(result.riskFactors).toEqual(["High exposure to crypto"]);
      expect(result.opportunities).toEqual(["Arbitrage on market X"]);
      expect(result).not.toHaveProperty("summary");
      expect(result).not.toHaveProperty("riskLevel");
      expect(result).not.toHaveProperty("suggestions");
    });

    it("returns fallback arrays when LLM fails", async () => {
      db.position.findMany.mockResolvedValue([
        {
          marketId: "m1",
          outcome: "YES",
          size: 10,
          avgPrice: 0.6,
          unrealizedPnl: 5.0,
          realizedPnl: 0,
          userId: "user-1",
          resolutionStatus: "UNRESOLVED",
        },
      ] as any);
      db.order.findMany.mockResolvedValue([]);
      mockLlm.analyze.mockRejectedValue(new Error("LLM down"));

      const result = await service.portfolioReview("user-1");

      expect(result.review).toContain("1 open position");
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(Array.isArray(result.opportunities)).toBe(true);
      expect(result.generatedAt).toBeDefined();
    });

    it("returns empty arrays for missing optional LLM fields", async () => {
      db.position.findMany.mockResolvedValue([]);
      db.order.findMany.mockResolvedValue([]);
      mockLlm.analyze.mockResolvedValue(
        JSON.stringify({ review: "All good." }),
      );

      const result = await service.portfolioReview("user-1");

      expect(result.review).toBe("All good.");
      expect(result.keyInsights).toEqual([]);
      expect(result.riskFactors).toEqual([]);
      expect(result.opportunities).toEqual([]);
    });

    it("handles malformed LLM JSON gracefully", async () => {
      db.position.findMany.mockResolvedValue([]);
      db.order.findMany.mockResolvedValue([]);
      mockLlm.analyze.mockResolvedValue("not valid json at all");

      const result = await service.portfolioReview("user-1");

      expect(result.review).toBeDefined();
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(Array.isArray(result.opportunities)).toBe(true);
    });
  });
});
