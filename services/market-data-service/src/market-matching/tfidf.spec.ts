import { describe, it, expect } from "vitest";
import { tokenize, buildCorpus, tfidfVector, cosineSimilarity } from "./tfidf";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric", () => {
    expect(tokenize("Will Bitcoin reach $100k?")).toEqual([
      "bitcoin",
      "reach",
      "$100k",
    ]);
  });

  it("removes stop words", () => {
    const tokens = tokenize("Will the price of gold be above 2000");
    expect(tokens).not.toContain("will");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("of");
    expect(tokens).not.toContain("be");
    expect(tokens).toContain("price");
    expect(tokens).toContain("gold");
    expect(tokens).toContain("2000");
  });

  it("keeps tokens with 2+ chars and drops single chars", () => {
    expect(tokenize("I am a fan")).toEqual(["am", "fan"]);
  });

  it("preserves $ and % symbols inside terms", () => {
    expect(tokenize("50% chance of $100")).toContain("50%");
    expect(tokenize("50% chance of $100")).toContain("$100");
  });
});

describe("buildCorpus", () => {
  it("counts document frequency per term", () => {
    const docs = [
      ["bitcoin", "price"],
      ["bitcoin", "market"],
      ["gold", "price"],
    ];
    const df = buildCorpus(docs);
    expect(df.get("bitcoin")).toBe(2);
    expect(df.get("price")).toBe(2);
    expect(df.get("gold")).toBe(1);
    expect(df.get("market")).toBe(1);
  });

  it("counts each term at most once per document", () => {
    const docs = [["bitcoin", "bitcoin", "bitcoin"]];
    const df = buildCorpus(docs);
    expect(df.get("bitcoin")).toBe(1);
  });
});

describe("tfidfVector", () => {
  it("produces non-zero weights for terms in the document", () => {
    const df = new Map([
      ["bitcoin", 2],
      ["price", 3],
    ]);
    const vec = tfidfVector(["bitcoin", "price"], df, 5);
    expect(vec.get("bitcoin")).toBeGreaterThan(0);
    expect(vec.get("price")).toBeGreaterThan(0);
  });

  it("gives higher weight to rarer terms", () => {
    const df = new Map([
      ["bitcoin", 1],
      ["price", 5],
    ]);
    const vec = tfidfVector(["bitcoin", "price"], df, 10);
    expect(vec.get("bitcoin")!).toBeGreaterThan(vec.get("price")!);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const vec = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Map([["a", 1]]);
    const b = new Map([["b", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 when either vector is empty", () => {
    const a = new Map<string, number>();
    const b = new Map([["a", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(b, a)).toBe(0);
  });

  it("produces similarity between 0 and 1 for partially overlapping vectors", () => {
    const a = new Map([
      ["bitcoin", 2],
      ["price", 1],
    ]);
    const b = new Map([
      ["bitcoin", 1],
      ["gold", 3],
    ]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("returns high similarity for near-identical market titles", () => {
    const df = buildCorpus([
      tokenize("Will Bitcoin reach 100k by 2026"),
      tokenize("Bitcoin to reach 100k by end of 2026"),
    ]);
    const a = tfidfVector(tokenize("Will Bitcoin reach 100k by 2026"), df, 2);
    const b = tfidfVector(
      tokenize("Bitcoin to reach 100k by end of 2026"),
      df,
      2,
    );
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.7);
  });

  it("returns low similarity for unrelated market titles", () => {
    const df = buildCorpus([
      tokenize("Will Bitcoin reach 100k"),
      tokenize("Lakers win NBA championship 2026"),
    ]);
    const a = tfidfVector(tokenize("Will Bitcoin reach 100k"), df, 2);
    const b = tfidfVector(tokenize("Lakers win NBA championship 2026"), df, 2);
    expect(cosineSimilarity(a, b)).toBeLessThan(0.2);
  });
});
