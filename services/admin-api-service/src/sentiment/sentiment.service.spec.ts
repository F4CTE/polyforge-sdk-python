import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SentimentService } from "./sentiment.service";

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as any;
}

describe("SentimentService", () => {
  let service: SentimentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:00Z"));
    prisma = createMockPrisma();
    service = new SentimentService(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getOverview", () => {
    it("returns empty array when no rows", async () => {
      const result = await service.getOverview();
      expect(result).toEqual([]);
    });

    it("uses 1-hour window when period is 1h", async () => {
      await service.getOverview(20, "1h");

      const sinceArg = prisma.$queryRaw.mock.calls[0][1] as Date;
      const expected = new Date("2026-04-25T11:00:00Z");
      expect(sinceArg.getTime()).toBe(expected.getTime());
    });

    it("uses 24-hour window when period is 24h", async () => {
      await service.getOverview(20, "24h");

      const sinceArg = prisma.$queryRaw.mock.calls[0][1] as Date;
      const expected = new Date("2026-04-24T12:00:00Z");
      expect(sinceArg.getTime()).toBe(expected.getTime());
    });

    it("uses 7-day window when period is 7d", async () => {
      await service.getOverview(20, "7d");

      const sinceArg = prisma.$queryRaw.mock.calls[0][1] as Date;
      const expected = new Date("2026-04-18T12:00:00Z");
      expect(sinceArg.getTime()).toBe(expected.getTime());
    });

    it("defaults to 7d when no period specified", async () => {
      await service.getOverview();

      const sinceArg = prisma.$queryRaw.mock.calls[0][1] as Date;
      const expected = new Date("2026-04-18T12:00:00Z");
      expect(sinceArg.getTime()).toBe(expected.getTime());
    });

    it("computes score and assigns BULLISH label", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          marketId: "m1",
          marketTitle: "Will X happen?",
          signalCount: 10,
          bullishCount: 8,
          bearishCount: 2,
          lastUpdated: new Date("2026-04-25T10:00:00Z"),
        },
      ]);

      const result = await service.getOverview();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("BULLISH");
      expect(result[0].score).toBe(60);
    });

    it("computes score and assigns BEARISH label", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          marketId: "m2",
          marketTitle: "Will Y happen?",
          signalCount: 10,
          bullishCount: 2,
          bearishCount: 8,
          lastUpdated: new Date("2026-04-25T10:00:00Z"),
        },
      ]);

      const result = await service.getOverview();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("BEARISH");
      expect(result[0].score).toBe(-60);
    });

    it("assigns NEUTRAL label for balanced signals", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          marketId: "m3",
          marketTitle: "Will Z happen?",
          signalCount: 10,
          bullishCount: 5,
          bearishCount: 5,
          lastUpdated: new Date("2026-04-25T10:00:00Z"),
        },
      ]);

      const result = await service.getOverview();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("NEUTRAL");
      expect(result[0].score).toBe(0);
    });

    it("respects custom limit", async () => {
      await service.getOverview(5);

      const limitArg = prisma.$queryRaw.mock.calls[0][2];
      expect(limitArg).toBe(5);
    });
  });
});
