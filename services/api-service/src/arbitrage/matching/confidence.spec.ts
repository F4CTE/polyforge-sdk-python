import { describe, it, expect } from "vitest";
import { computeConfidence, AUTO_MATCH_THRESHOLD, buildIdf } from "./confidence";

function makeMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "poly-1",
    title: "Will Bitcoin hit $100k by December 2026?",
    category: "Crypto",
    endDate: new Date("2026-12-31"),
    outcomes: ["Yes", "No"],
    ...overrides,
  };
}

const CORPUS = [
  "Will Bitcoin hit $100k by December 2026?",
  "Bitcoin price above 100000 end of 2026",
  "Will the Lakers win the NBA Finals 2026?",
  "Trump presidential election 2028",
];
const idf = buildIdf(CORPUS);

describe("confidence scoring", () => {
  it("gives high confidence for near-identical markets", () => {
    const poly = makeMarket({ id: "poly-1" });
    const kalshi = makeMarket({
      id: "kalshi-1",
      title: "Will Bitcoin hit $100k by December 2026?",
    });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
    expect(result.matchMethod).toBe("auto_tfidf");
    expect(result.polymarketId).toBe("poly-1");
    expect(result.kalshiId).toBe("kalshi-1");
  });

  it("gives low confidence for unrelated markets", () => {
    const poly = makeMarket({ id: "poly-1" });
    const kalshi = makeMarket({
      id: "kalshi-2",
      title: "Will the Lakers win the NBA Finals 2026?",
      category: "Sports",
      endDate: new Date("2026-06-15"),
      outcomes: ["Yes", "No"],
    });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
    expect(result.matchMethod).toBe("auto_tfidf_low");
  });

  it("boosts confidence when categories match", () => {
    const poly = makeMarket({ id: "p1", category: "Crypto" });
    const kalshi = makeMarket({
      id: "k1",
      title: "BTC above 100k in 2026",
      category: "Crypto",
    });
    const kalshiDiffCat = makeMarket({
      id: "k2",
      title: "BTC above 100k in 2026",
      category: "Finance",
    });

    const sameCat = computeConfidence(poly, kalshi, idf);
    const diffCat = computeConfidence(poly, kalshiDiffCat, idf);

    expect(sameCat.confidence).toBeGreaterThan(diffCat.confidence);
  });

  it("boosts confidence when end dates are close", () => {
    const poly = makeMarket({ id: "p1", endDate: new Date("2026-12-31") });
    const kalshiClose = makeMarket({
      id: "k1",
      title: "Bitcoin above 100000 by Dec 2026",
      endDate: new Date("2026-12-30"),
    });
    const kalshiFar = makeMarket({
      id: "k2",
      title: "Bitcoin above 100000 by Dec 2026",
      endDate: new Date("2026-06-01"),
    });

    const closeDate = computeConfidence(poly, kalshiClose, idf);
    const farDate = computeConfidence(poly, kalshiFar, idf);

    expect(closeDate.confidence).toBeGreaterThan(farDate.confidence);
  });

  it("handles null categories gracefully", () => {
    const poly = makeMarket({ id: "p1", category: null });
    const kalshi = makeMarket({ id: "k1", category: null });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.breakdown.categoryMatch).toBe(0.3);
  });

  it("handles null end dates gracefully", () => {
    const poly = makeMarket({ id: "p1", endDate: null });
    const kalshi = makeMarket({ id: "k1", endDate: null });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.breakdown.dateProximity).toBe(0.5);
  });

  it("handles empty outcomes", () => {
    const poly = makeMarket({ id: "p1", outcomes: [] });
    const kalshi = makeMarket({ id: "k1", outcomes: [] });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.breakdown.outcomeMatch).toBe(0);
  });

  it("returns correct breakdown fields", () => {
    const poly = makeMarket({ id: "p1" });
    const kalshi = makeMarket({ id: "k1" });

    const result = computeConfidence(poly, kalshi, idf);

    expect(result.breakdown).toHaveProperty("textSimilarity");
    expect(result.breakdown).toHaveProperty("categoryMatch");
    expect(result.breakdown).toHaveProperty("dateProximity");
    expect(result.breakdown).toHaveProperty("outcomeMatch");
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
