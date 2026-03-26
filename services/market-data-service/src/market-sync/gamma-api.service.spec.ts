import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GammaApiService } from "./gamma-api.service";

// ── Factories ──────────────────────────────────────────────────────────────────

function makeGammaToken(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "token-1",
    outcome: "YES",
    price: "0.65",
    liquidity: "10000",
    ...overrides,
  };
}

function makeGammaMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "market-1",
    slug: "will-it-rain",
    title: "Will it rain tomorrow?",
    description: "Weather prediction market",
    category: "Weather",
    image: "https://example.com/rain.jpg",
    seriesSlug: "weather",
    endDate: "2026-12-31T00:00:00Z",
    closed: false,
    negRisk: false,
    volume24h: "5000.50",
    tokens: [
      makeGammaToken(),
      makeGammaToken({ tokenId: "token-2", outcome: "NO", price: "0.35" }),
    ],
    ...overrides,
  };
}

function makeMocks() {
  const prisma = {
    market: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    token: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    event: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  } as any;

  const ws = {
    subscribeTokens: vi.fn(),
  } as any;

  return { prisma, ws };
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("GammaApiService", () => {
  let svc: GammaApiService;
  let prisma: ReturnType<typeof makeMocks>["prisma"];
  let ws: ReturnType<typeof makeMocks>["ws"];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const m = makeMocks();
    ({ prisma, ws } = m);
    svc = new GammaApiService(prisma, ws);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── syncAllMarkets — pagination ──────────────────────────────────────────

  describe("syncAllMarkets() — pagination", () => {
    it("paginates through all markets until fewer than limit returned", async () => {
      // First page: 100 markets (full page), second page: 50 markets (partial)
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makeGammaMarket({ id: `market-${i}`, slug: `m-${i}` }),
      );
      const partialPage = Array.from({ length: 50 }, (_, i) =>
        makeGammaMarket({ id: `market-${100 + i}`, slug: `m-${100 + i}` }),
      );

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? fullPage : partialPage;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data }),
        });
      });

      await svc.syncAllMarkets();

      // Should have called fetch twice (page 1 + page 2)
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
      // Should have upserted all 150 markets
      expect(prisma.market.upsert).toHaveBeenCalledTimes(150);
    });

    it("stops when response has fewer than limit items", async () => {
      const smallPage = [makeGammaMarket()];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: smallPage }),
      });

      await svc.syncAllMarkets();

      // Only one fetch call since first page had fewer than 100
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
      expect(prisma.market.upsert).toHaveBeenCalledTimes(1);
    });

    it("handles empty first page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await svc.syncAllMarkets();

      expect(prisma.market.upsert).not.toHaveBeenCalled();
    });
  });

  // ── syncMarkets — happy path ───────────────────────────────────────────────

  describe("syncMarkets() — happy path", () => {
    it("upserts each non-negRisk market from the API", async () => {
      const markets = [
        makeGammaMarket(),
        makeGammaMarket({ id: "market-2", slug: "market-two" }),
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: markets }),
      });

      await svc.syncAllMarkets();

      expect(prisma.market.upsert).toHaveBeenCalledTimes(2);
    });

    it("upserts market with correct create payload", async () => {
      const market = makeGammaMarket();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ id: "market-1" });
      expect(call.create.id).toBe("market-1");
      expect(call.create.slug).toBe("will-it-rain");
      expect(call.create.title).toBe("Will it rain tomorrow?");
      expect(call.create.closed).toBe(false);
      expect(call.create.volume24h).toBe(5000.5);
    });

    it("upserts tokens for each market", async () => {
      const market = makeGammaMarket();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      expect(prisma.token.upsert).toHaveBeenCalledTimes(2);
    });

    it("upserts token with correct create payload", async () => {
      const market = makeGammaMarket();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      const firstTokenCall = prisma.token.upsert.mock.calls[0][0];
      expect(firstTokenCall.where).toEqual({ id: "token-1" });
      expect(firstTokenCall.create.marketId).toBe("market-1");
      expect(firstTokenCall.create.outcome).toBe("YES");
      expect(firstTokenCall.create.price).toBe(0.65);
      expect(firstTokenCall.create.liquidity).toBe(10000);
    });

    it("subscribes token IDs to WebSocket after upserting", async () => {
      const market = makeGammaMarket();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      expect(ws.subscribeTokens).toHaveBeenCalledWith(["token-1", "token-2"]);
    });

    it("handles market with no image", async () => {
      const market = makeGammaMarket({ image: undefined });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.create.image).toBeNull();
    });

    it("handles market with no volume24h", async () => {
      const market = makeGammaMarket({ volume24h: undefined });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.create.volume24h).toBe(0);
    });

    it("parses endDate as Date object", async () => {
      const market = makeGammaMarket({ endDate: "2026-06-15T12:00:00Z" });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [market] }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.create.endDate).toEqual(new Date("2026-06-15T12:00:00Z"));
    });
  });

  // ── syncMarkets — negRisk filtering ────────────────────────────────────────

  describe("syncMarkets() — negRisk filtering", () => {
    it("skips neg-risk markets entirely", async () => {
      const markets = [
        makeGammaMarket({ id: "m-neg", negRisk: true }),
        makeGammaMarket({ id: "m-ok", negRisk: false }),
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: markets }),
      });

      await svc.syncAllMarkets();

      expect(prisma.market.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.market.upsert.mock.calls[0][0].where).toEqual({
        id: "m-ok",
      });
    });

    it("does not subscribe tokens for negRisk markets", async () => {
      const markets = [makeGammaMarket({ negRisk: true })];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: markets }),
      });

      await svc.syncAllMarkets();

      expect(ws.subscribeTokens).not.toHaveBeenCalled();
    });
  });

  // ── syncMarkets — API failure ──────────────────────────────────────────────

  describe("syncMarkets() — API failure", () => {
    it("does not throw when fetch fails (error is logged)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

      await expect(svc.syncMarkets()).resolves.toBeUndefined();
    });

    it("does not throw when API returns non-ok status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(svc.syncMarkets()).resolves.toBeUndefined();
    });

    it("does not upsert anything when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout"));

      await svc.syncMarkets();

      expect(prisma.market.upsert).not.toHaveBeenCalled();
      expect(prisma.token.upsert).not.toHaveBeenCalled();
    });
  });

  // ── syncMarkets — empty response ──────────────────────────────────────────

  describe("syncMarkets() — empty response", () => {
    it("handles an empty markets array gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await expect(svc.syncMarkets()).resolves.toBeUndefined();
      expect(prisma.market.upsert).not.toHaveBeenCalled();
    });
  });

  // ── syncMarkets — DB error resilience ──────────────────────────────────────

  describe("syncMarkets() — DB error during upsert", () => {
    it("does not throw when market upsert fails (error is caught at top level)", async () => {
      prisma.market.upsert.mockRejectedValue(new Error("PG error"));
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [makeGammaMarket()] }),
      });

      await expect(svc.syncMarkets()).resolves.toBeUndefined();
    });
  });

  // ── update payload ─────────────────────────────────────────────────────────

  describe("syncAllMarkets() — update payload", () => {
    it("sets lastUpdatedAt in the update payload", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [makeGammaMarket()] }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.update.lastUpdatedAt).toBeInstanceOf(Date);
    });

    it("includes closed and volume24h in the update payload", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [makeGammaMarket({ closed: true, volume24h: "100" })],
          }),
      });

      await svc.syncAllMarkets();

      const call = prisma.market.upsert.mock.calls[0][0];
      expect(call.update.closed).toBe(true);
      expect(call.update.volume24h).toBe(100);
    });

    it("updates token price and liquidity", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [makeGammaMarket()] }),
      });

      await svc.syncAllMarkets();

      const tokenCall = prisma.token.upsert.mock.calls[0][0];
      expect(tokenCall.update.price).toBe(0.65);
      expect(tokenCall.update.liquidity).toBe(10000);
    });
  });
});
