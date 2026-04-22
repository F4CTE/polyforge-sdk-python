import { cosineSimilarity, buildIdf } from "./text-similarity";

export interface MatchCandidate {
  polymarketId: string;
  kalshiId: string;
  confidence: number;
  matchMethod: string;
  breakdown: ConfidenceBreakdown;
}

export interface ConfidenceBreakdown {
  textSimilarity: number;
  categoryMatch: number;
  dateProximity: number;
  outcomeMatch: number;
}

interface MarketInput {
  id: string;
  title: string;
  category: string | null;
  endDate: Date | null;
  outcomes: string[];
}

const WEIGHTS = {
  text: 0.45,
  category: 0.15,
  date: 0.2,
  outcome: 0.2,
} as const;

const AUTO_MATCH_THRESHOLD = 0.75;

function normalizeOutcome(outcome: string): string {
  return outcome.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function outcomeOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const normA = a.map(normalizeOutcome);
  const normB = b.map(normalizeOutcome);
  const setA = new Set(normA);
  const intersection = normB.filter((o) => setA.has(o)).length;
  return intersection / Math.max(normA.length, normB.length);
}

function dateProximityScore(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0.5;
  const diffMs = Math.abs(a.getTime() - b.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 1;
  if (diffDays <= 1) return 0.9;
  if (diffDays <= 7) return 0.7;
  if (diffDays <= 30) return 0.4;
  return 0;
}

function categoryScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0.3;
  return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
}

export function computeConfidence(
  polymarket: MarketInput,
  kalshi: MarketInput,
  idf: Map<string, number>,
): MatchCandidate {
  const textSim = cosineSimilarity(polymarket.title, kalshi.title, idf);
  const catScore = categoryScore(polymarket.category, kalshi.category);
  const dateScore = dateProximityScore(polymarket.endDate, kalshi.endDate);
  const outcomeScore = outcomeOverlap(polymarket.outcomes, kalshi.outcomes);

  const confidence =
    textSim * WEIGHTS.text +
    catScore * WEIGHTS.category +
    dateScore * WEIGHTS.date +
    outcomeScore * WEIGHTS.outcome;

  const method =
    confidence >= AUTO_MATCH_THRESHOLD ? "auto_tfidf" : "auto_tfidf_low";

  return {
    polymarketId: polymarket.id,
    kalshiId: kalshi.id,
    confidence: Math.round(confidence * 10000) / 10000,
    matchMethod: method,
    breakdown: {
      textSimilarity: Math.round(textSim * 10000) / 10000,
      categoryMatch: catScore,
      dateProximity: Math.round(dateScore * 10000) / 10000,
      outcomeMatch: Math.round(outcomeScore * 10000) / 10000,
    },
  };
}

export { AUTO_MATCH_THRESHOLD, WEIGHTS, buildIdf };
