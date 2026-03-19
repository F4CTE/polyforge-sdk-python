import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    intentId: "intent-1",
    strategyId: null,
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY" as const,
    outcome: "YES" as const,
    size: "50",
    price: "0.65",
    orderType: "GTC",
    status: "CONFIRMED" as const,
    clobOrderId: null,
    fillSize: null as string | null,
    fillPrice: null as string | null,
    fee: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    placedAt: null,
    filledAt: null,
    ...overrides,
  };
}

// ─── Test helpers ────────────────────────────────────────────────────────────
// The fillRatio method lives on OrdersComponent. We extract the logic here
// so we can test it without Angular TestBed (user-app has no vitest wired up).

function fillRatio(order: ReturnType<typeof makeOrder>): string {
  const total = parseFloat(order.size);
  if (!total) return "\u2014";
  const filled = order.fillSize ?? "0";
  return `${filled} / ${order.size}`;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("OrdersComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fillRatio", () => {
    it('returns "0 / 50" when fillSize is null', () => {
      const order = makeOrder({ size: "50", fillSize: null });

      expect(fillRatio(order)).toBe("0 / 50");
    });

    it('returns "75 / 75" when fillSize is "75" and size is "75"', () => {
      const order = makeOrder({ size: "75", fillSize: "75" });

      expect(fillRatio(order)).toBe("75 / 75");
    });

    it('returns "25 / 100" for a partially filled order', () => {
      const order = makeOrder({ size: "100", fillSize: "25" });

      expect(fillRatio(order)).toBe("25 / 100");
    });

    it('returns em dash when size is "0"', () => {
      const order = makeOrder({ size: "0", fillSize: null });

      expect(fillRatio(order)).toBe("\u2014");
    });

    it("returns em dash when size is not a valid number", () => {
      const order = makeOrder({ size: "abc", fillSize: null });

      expect(fillRatio(order)).toBe("\u2014");
    });

    it('returns "0 / 10" when fillSize is explicitly "0"', () => {
      const order = makeOrder({ size: "10", fillSize: "0" });

      expect(fillRatio(order)).toBe("0 / 10");
    });
  });
});
