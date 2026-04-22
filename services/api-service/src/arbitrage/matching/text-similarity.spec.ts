import { describe, it, expect } from "vitest";
import { buildIdf, cosineSimilarity } from "./text-similarity";

describe("text-similarity", () => {
  describe("buildIdf", () => {
    it("assigns higher IDF to rare terms", () => {
      const docs = [
        "bitcoin price prediction",
        "bitcoin ethereum market",
        "weather forecast tomorrow",
      ];
      const idf = buildIdf(docs);

      expect(idf.get("bitcoin")!).toBeLessThan(idf.get("weather")!);
    });

    it("returns empty map for empty corpus", () => {
      expect(buildIdf([]).size).toBe(0);
    });
  });

  describe("cosineSimilarity", () => {
    const corpus = [
      "Will Bitcoin reach 100k by December 2026",
      "Will BTC hit 100000 before end of 2026",
      "Who will win the 2026 World Cup",
      "Will Trump win the 2028 presidential election",
    ];
    const idf = buildIdf(corpus);

    it("returns positive similarity for questions sharing key terms", () => {
      const sim = cosineSimilarity(
        "Will Bitcoin reach 100k by December 2026",
        "Will Bitcoin reach 100k before end of 2026",
        idf,
      );
      expect(sim).toBeGreaterThan(0.5);
    });

    it("returns low similarity for abbreviation-only overlap (BTC vs Bitcoin)", () => {
      const sim = cosineSimilarity(
        "Will Bitcoin reach 100k by December 2026",
        "Will BTC hit 100000 before end of 2026",
        idf,
      );
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThan(0.5);
    });

    it("returns low similarity for unrelated questions", () => {
      const sim = cosineSimilarity(
        "Will Bitcoin reach 100k by December 2026",
        "Who will win the 2026 World Cup",
        idf,
      );
      expect(sim).toBeLessThan(0.3);
    });

    it("returns 1 for identical strings", () => {
      const sim = cosineSimilarity(
        "Will Trump win the 2028 election",
        "Will Trump win the 2028 election",
        idf,
      );
      expect(sim).toBeCloseTo(1, 2);
    });

    it("returns 0 for empty strings", () => {
      const sim = cosineSimilarity("", "", idf);
      expect(sim).toBe(0);
    });

    it("handles single-word inputs", () => {
      const sim = cosineSimilarity("bitcoin", "bitcoin", idf);
      expect(sim).toBeCloseTo(1, 2);
    });
  });
});
