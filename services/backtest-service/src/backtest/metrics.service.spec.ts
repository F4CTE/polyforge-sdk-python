import { describe, it, expect } from "vitest";
import { MetricsService, FillRecord } from "./metrics.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFill(
  overrides: Partial<FillRecord> &
    Pick<FillRecord, "side" | "pnl" | "equityCurve">,
): FillRecord {
  return {
    simulatedAt: new Date("2024-01-01T12:00:00Z"),
    ...overrides,
  };
}

/** Build a sequence of fills on distinct calendar days for Sharpe calculations */
function makeDailyFills(equities: number[]): FillRecord[] {
  return equities.map((eq, i) => ({
    side: i % 2 === 0 ? "BUY" : "SELL",
    pnl: i % 2 === 0 ? 0 : eq - (equities[i - 1] ?? 0),
    equityCurve: eq,
    simulatedAt: new Date(
      `2024-01-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    ),
  }));
}

// ─── MetricsService.compute() ────────────────────────────────────────────────

describe("MetricsService.compute()", () => {
  const svc = new MetricsService();

  it("returns zero metrics for an empty fill list", () => {
    const result = svc.compute([]);
    expect(result.totalPnl).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.maxDrawdown).toBe(0);
    expect(result.sharpeRatio).toBe(0);
  });

  it("computes correct totalPnl from SELL fills only", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
      makeFill({ side: "SELL", pnl: 10, equityCurve: 10 }),
      makeFill({ side: "BUY", pnl: 0, equityCurve: 10 }),
      makeFill({ side: "SELL", pnl: -5, equityCurve: 5 }),
      makeFill({ side: "SELL", pnl: 8, equityCurve: 13 }),
    ];
    const result = svc.compute(fills);
    expect(result.totalPnl).toBeCloseTo(13, 6); // 10 + (-5) + 8
  });

  it("computes correct winRate: wins / total sells", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 5, equityCurve: 5 }),
      makeFill({ side: "SELL", pnl: -3, equityCurve: 2 }),
      makeFill({ side: "SELL", pnl: 0, equityCurve: 2 }), // pnl=0 is NOT a win
      makeFill({ side: "SELL", pnl: 7, equityCurve: 9 }),
    ];
    const result = svc.compute(fills);
    // 2 wins (pnl>0) out of 4 sells
    expect(result.winRate).toBeCloseTo(0.5, 5);
  });

  it("winRate is 0 when there are no SELL fills", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
    ];
    const result = svc.compute(fills);
    expect(result.winRate).toBe(0);
  });

  it("winRate is 1 when all SELL fills are profitable", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 10, equityCurve: 10 }),
      makeFill({ side: "SELL", pnl: 5, equityCurve: 15 }),
    ];
    const result = svc.compute(fills);
    expect(result.winRate).toBe(1);
  });

  it("computes maxDrawdown from equity curve", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
      makeFill({ side: "SELL", pnl: 20, equityCurve: 20 }),
      makeFill({ side: "SELL", pnl: -15, equityCurve: 5 }), // drawdown of 15
      makeFill({ side: "SELL", pnl: 25, equityCurve: 30 }),
      makeFill({ side: "SELL", pnl: -20, equityCurve: 10 }), // drawdown of 20
    ];
    const result = svc.compute(fills);
    expect(result.maxDrawdown).toBe(20);
  });

  it("maxDrawdown is 0 when equity curve is monotonically increasing", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 5, equityCurve: 5 }),
      makeFill({ side: "SELL", pnl: 5, equityCurve: 10 }),
      makeFill({ side: "SELL", pnl: 10, equityCurve: 20 }),
    ];
    const result = svc.compute(fills);
    expect(result.maxDrawdown).toBe(0);
  });

  it("sharpeRatio is 0 for a single fill", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 10, equityCurve: 10 }),
    ];
    const result = svc.compute(fills);
    expect(result.sharpeRatio).toBe(0);
  });

  it("sharpeRatio is positive for all-positive (non-uniform) daily returns", () => {
    // Non-uniform returns so std > 0 but mean > 0 → Sharpe > 0
    const fills = makeDailyFills([2, 7, 14, 18, 30]);
    const result = svc.compute(fills);
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it("sharpeRatio is 0 when all daily returns are flat (zero std)", () => {
    // Same equity every day → std = 0 → sharpe = 0
    const fills = makeDailyFills([10, 10, 10, 10, 10]);
    const result = svc.compute(fills);
    expect(result.sharpeRatio).toBe(0);
  });

  it("returns all four metrics as numbers", () => {
    const fills = makeDailyFills([0, 5, 3, 8, 6]);
    const result = svc.compute(fills);
    expect(typeof result.totalPnl).toBe("number");
    expect(typeof result.winRate).toBe("number");
    expect(typeof result.maxDrawdown).toBe("number");
    expect(typeof result.sharpeRatio).toBe("number");
  });
});

// ─── computeMaxDrawdown (via compute()) ──────────────────────────────────────

describe("MetricsService — max drawdown calculation", () => {
  const svc = new MetricsService();

  it("peak-to-trough: single dip then recovery", () => {
    // equity: 0 → 100 → 60 → 120 → maxDrawdown = 100-60 = 40
    const fills: FillRecord[] = [
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
      makeFill({ side: "SELL", pnl: 100, equityCurve: 100 }),
      makeFill({ side: "SELL", pnl: -40, equityCurve: 60 }),
      makeFill({ side: "SELL", pnl: 60, equityCurve: 120 }),
    ];
    expect(svc.compute(fills).maxDrawdown).toBe(40);
  });

  it("peak-to-trough: multiple dips, largest wins", () => {
    // peak=50 drawdown=30, then peak=80 drawdown=50 → maxDrawdown=50
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 50, equityCurve: 50 }),
      makeFill({ side: "SELL", pnl: -30, equityCurve: 20 }),
      makeFill({ side: "SELL", pnl: 60, equityCurve: 80 }),
      makeFill({ side: "SELL", pnl: -50, equityCurve: 30 }),
    ];
    expect(svc.compute(fills).maxDrawdown).toBe(50);
  });

  it("drawdown starts from equity 0 (no initial peak)", () => {
    // equity never exceeds 0 → maxDrawdown should stay 0
    const fills: FillRecord[] = [
      makeFill({ side: "BUY", pnl: 0, equityCurve: 0 }),
    ];
    expect(svc.compute(fills).maxDrawdown).toBe(0);
  });
});

// ─── computeSharpe (via compute()) ───────────────────────────────────────────

describe("MetricsService — Sharpe ratio calculation", () => {
  const svc = new MetricsService();

  it("returns 0 for fewer than 2 fills", () => {
    const fills: FillRecord[] = [
      makeFill({ side: "SELL", pnl: 5, equityCurve: 5 }),
    ];
    expect(svc.compute(fills).sharpeRatio).toBe(0);
  });

  it("returns 0 when all fills fall on the same calendar day (fewer than 2 daily data points)", () => {
    // All on 2024-01-01 → only 1 unique day → equities.length < 2 → 0
    const day = new Date("2024-01-01T12:00:00Z");
    const fills: FillRecord[] = [
      { side: "SELL", pnl: 5, equityCurve: 5, simulatedAt: day },
      { side: "SELL", pnl: 10, equityCurve: 15, simulatedAt: day },
      { side: "SELL", pnl: 3, equityCurve: 18, simulatedAt: day },
    ];
    expect(svc.compute(fills).sharpeRatio).toBe(0);
  });

  it("returns positive Sharpe for consistently positive (non-uniform) daily returns", () => {
    // Non-uniform positive returns so std > 0 → Sharpe > 0
    const fills = makeDailyFills([1, 5, 12, 14, 25, 28, 38, 41, 50, 60]);
    expect(svc.compute(fills).sharpeRatio).toBeGreaterThan(0);
  });

  it("scales by sqrt(252) annualisation factor", () => {
    // Two-day scenario: equity goes 0→10 on day 1, 10→20 on day 2
    // daily returns = [10, 10], mean=10, std=0 → sharpe=0 (all same)
    // Use asymmetric returns to produce a non-zero std
    const fills: FillRecord[] = [
      {
        side: "SELL",
        pnl: 10,
        equityCurve: 10,
        simulatedAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        side: "SELL",
        pnl: 30,
        equityCurve: 40,
        simulatedAt: new Date("2024-01-02T00:00:00Z"),
      },
      {
        side: "SELL",
        pnl: 10,
        equityCurve: 50,
        simulatedAt: new Date("2024-01-03T00:00:00Z"),
      },
    ];
    // returns = [30, 10]: mean=20, std=10, raw sharpe=2, annualised = 2*sqrt(252)
    const result = svc.compute(fills);
    const expected = 2 * Math.sqrt(252);
    expect(result.sharpeRatio).toBeCloseTo(expected, 4);
  });
});
