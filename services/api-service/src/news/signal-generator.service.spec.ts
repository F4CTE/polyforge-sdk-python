import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignalGeneratorService } from "./signal-generator.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    market: { findMany: vi.fn() },
    newsSignal: { create: vi.fn() },
  } as any;
}

function createMockRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("stream-id"),
  } as any;
}

function createMockLlm() {
  return {
    analyze: vi.fn(),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("SignalGeneratorService", () => {
  let service: SignalGeneratorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let llm: ReturnType<typeof createMockLlm>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    llm = createMockLlm();
    service = new SignalGeneratorService(prisma, redis, llm);
  });

  // ── buildPrompt ─────────────────────────────────────────────────────────

  describe("buildPrompt", () => {
    it("includes the article title and summary in the prompt", () => {
      const prompt = service.buildPrompt(
        { title: "Election update", summary: "Big changes ahead" },
        [
          {
            id: "m1",
            title: "Will X win?",
            slug: "x-win",
            category: "politics",
          },
        ],
      );

      expect(prompt).toContain("Election update");
      expect(prompt).toContain("Big changes ahead");
    });

    it("includes market IDs and titles in the prompt", () => {
      const prompt = service.buildPrompt({ title: "Test", summary: null }, [
        { id: "m1", title: "Market A", slug: "a", category: null },
        { id: "m2", title: "Market B", slug: "b", category: null },
      ]);

      expect(prompt).toContain("m1");
      expect(prompt).toContain("Market A");
      expect(prompt).toContain("m2");
      expect(prompt).toContain("Market B");
    });

    it('uses "No summary available." when summary is null', () => {
      const prompt = service.buildPrompt({ title: "Test", summary: null }, []);

      expect(prompt).toContain("No summary available.");
    });
  });

  // ── parseResponse ───────────────────────────────────────────────────────

  describe("parseResponse", () => {
    it("parses valid JSON array of signals", () => {
      const raw = JSON.stringify([
        {
          marketId: "m1",
          direction: "BUY",
          outcome: "YES",
          confidence: 80,
          reasoning: "test",
        },
      ]);

      const result = service.parseResponse(raw);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        marketId: "m1",
        direction: "BUY",
        outcome: "YES",
        confidence: 80,
      });
    });

    it("handles markdown code blocks wrapping JSON", () => {
      const raw =
        '```json\n[{"marketId":"m1","direction":"SELL","outcome":"NO","confidence":60,"reasoning":"r"}]\n```';

      const result = service.parseResponse(raw);

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe("SELL");
    });

    it("filters out signals with invalid direction", () => {
      const raw = JSON.stringify([
        { marketId: "m1", direction: "HOLD", outcome: "YES", confidence: 50 },
      ]);

      const result = service.parseResponse(raw);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for malformed JSON", () => {
      const result = service.parseResponse("not json at all");

      expect(result).toEqual([]);
    });

    it("filters out signals with confidence outside 1-100 range", () => {
      const raw = JSON.stringify([
        { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 0 },
        { marketId: "m2", direction: "BUY", outcome: "YES", confidence: 101 },
      ]);

      const result = service.parseResponse(raw);

      expect(result).toHaveLength(0);
    });
  });

  // ── generateSignals ─────────────────────────────────────────────────────

  describe("generateSignals", () => {
    it("skips when no active markets exist", async () => {
      prisma.market.findMany.mockResolvedValue([]);

      await service.generateSignals({ id: "a1", title: "Test", summary: null });

      expect(llm.analyze).not.toHaveBeenCalled();
    });

    it("rejects signals with confidence > 95 as suspicious", async () => {
      prisma.market.findMany.mockResolvedValue([
        { id: "m1", title: "Market", slug: "m", category: null },
      ]);
      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "m1",
            direction: "BUY",
            outcome: "YES",
            confidence: 98,
            reasoning: "r",
          },
        ]),
      );

      await service.generateSignals({ id: "a1", title: "Test", summary: null });

      expect(prisma.newsSignal.create).not.toHaveBeenCalled();
    });

    it("creates signal and emits to stream for high-confidence signals", async () => {
      prisma.market.findMany.mockResolvedValue([
        { id: "m1", title: "Market One", slug: "m1", category: null },
      ]);
      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "m1",
            direction: "BUY",
            outcome: "YES",
            confidence: 80,
            reasoning: "strong signal",
          },
        ]),
      );
      prisma.newsSignal.create.mockResolvedValue({ id: "sig1" });

      await service.generateSignals({
        id: "a1",
        title: "Test",
        summary: "Summary",
      });

      expect(prisma.newsSignal.create).toHaveBeenCalledOnce();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NEWS_SIGNAL",
          marketId: "m1",
          direction: "BUY",
        }),
      );
    });

    it("skips signals referencing non-existent markets", async () => {
      prisma.market.findMany.mockResolvedValue([
        { id: "m1", title: "Market", slug: "m", category: null },
      ]);
      llm.analyze.mockResolvedValue(
        JSON.stringify([
          {
            marketId: "m999",
            direction: "BUY",
            outcome: "YES",
            confidence: 50,
            reasoning: "r",
          },
        ]),
      );

      await service.generateSignals({ id: "a1", title: "Test", summary: null });

      expect(prisma.newsSignal.create).not.toHaveBeenCalled();
    });
  });
});
