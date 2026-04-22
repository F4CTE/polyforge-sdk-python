import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Venue, type Market, type MarketMatch } from "@prisma/client";
import { tokenize, buildCorpus, tfidfVector, cosineSimilarity } from "./tfidf";

// Weight factors for multi-signal confidence scoring
const W_TITLE = 0.5;
const W_CATEGORY = 0.2;
const W_END_DATE = 0.15;
const W_OUTCOME = 0.15;

const AUTO_MATCH_THRESHOLD = 0.75;

// Maximum days apart for end dates to contribute positively
const END_DATE_PROXIMITY_DAYS = 7;

type MarketWithTokens = Market & { tokens: { outcome: string }[] };

export interface MatchCandidate {
  polymarketId: string;
  kalshiId: string;
  confidence: number;
  matchMethod: string;
  signals: {
    titleSimilarity: number;
    categoryMatch: number;
    endDateProximity: number;
    outcomeMatch: number;
  };
}

@Injectable()
export class MarketMatchService {
  private readonly logger = new Logger(MarketMatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runAutoMatch(): Promise<{ created: number; skipped: number }> {
    const polymarkets = await this.prisma.market.findMany({
      where: { venue: Venue.POLYMARKET, closed: false },
      include: { tokens: { select: { outcome: true } } },
    });
    const kalshiMarkets = await this.prisma.market.findMany({
      where: { venue: Venue.KALSHI, closed: false },
      include: { tokens: { select: { outcome: true } } },
    });

    if (polymarkets.length === 0 || kalshiMarkets.length === 0) {
      this.logger.debug(
        `Skipping auto-match: polymarket=${polymarkets.length}, kalshi=${kalshiMarkets.length}`,
      );
      return { created: 0, skipped: 0 };
    }

    const existingMatches = await this.prisma.marketMatch.findMany({
      select: { polymarketId: true, kalshiId: true },
    });
    const existingSet = new Set(
      existingMatches.map((m) => `${m.polymarketId}::${m.kalshiId}`),
    );

    // Build TF-IDF corpus from all market titles
    const allTokenized = [
      ...polymarkets.map((m) => tokenize(m.title)),
      ...kalshiMarkets.map((m) => tokenize(m.title)),
    ];
    const df = buildCorpus(allTokenized);
    const totalDocs = allTokenized.length;

    const polyVectors = polymarkets.map((m) => ({
      market: m,
      tokens: tokenize(m.title),
      vec: tfidfVector(tokenize(m.title), df, totalDocs),
    }));

    const kalshiVectors = kalshiMarkets.map((m) => ({
      market: m,
      tokens: tokenize(m.title),
      vec: tfidfVector(tokenize(m.title), df, totalDocs),
    }));

    const candidates: MatchCandidate[] = [];

    for (const poly of polyVectors) {
      for (const kalshi of kalshiVectors) {
        const key = `${poly.market.id}::${kalshi.market.id}`;
        if (existingSet.has(key)) continue;

        const titleSim = cosineSimilarity(poly.vec, kalshi.vec);
        if (titleSim < 0.3) continue; // early exit for obviously unrelated

        const candidate = this.scoreCandidate(
          poly.market,
          kalshi.market,
          titleSim,
        );
        if (candidate.confidence >= AUTO_MATCH_THRESHOLD) {
          candidates.push(candidate);
        }
      }
    }

    // Greedy 1:1 assignment — best confidence first
    candidates.sort((a, b) => b.confidence - a.confidence);
    const usedPoly = new Set<string>();
    const usedKalshi = new Set<string>();
    let created = 0;
    let skipped = 0;

    for (const c of candidates) {
      if (usedPoly.has(c.polymarketId) || usedKalshi.has(c.kalshiId)) {
        skipped++;
        continue;
      }

      await this.prisma.marketMatch.create({
        data: {
          polymarketId: c.polymarketId,
          kalshiId: c.kalshiId,
          confidence: c.confidence,
          matchMethod: c.matchMethod,
        },
      });

      usedPoly.add(c.polymarketId);
      usedKalshi.add(c.kalshiId);
      created++;
    }

    this.logger.log(
      `Auto-match complete: ${created} created, ${skipped} skipped (duplicate assignments)`,
    );
    return { created, skipped };
  }

  scoreCandidate(
    poly: MarketWithTokens,
    kalshi: MarketWithTokens,
    titleSimilarity: number,
  ): MatchCandidate {
    const categoryMatch = this.categoryScore(poly.category, kalshi.category);
    const endDateProximity = this.endDateScore(poly.endDate, kalshi.endDate);
    const outcomeMatch = this.outcomeScore(poly.tokens, kalshi.tokens);

    const confidence =
      W_TITLE * titleSimilarity +
      W_CATEGORY * categoryMatch +
      W_END_DATE * endDateProximity +
      W_OUTCOME * outcomeMatch;

    const signals = [
      titleSimilarity > 0.6 ? "title_similarity" : null,
      categoryMatch > 0 ? "category_match" : null,
      endDateProximity > 0.5 ? "end_date_proximity" : null,
      outcomeMatch > 0.5 ? "outcome_match" : null,
    ].filter(Boolean);

    return {
      polymarketId: poly.id,
      kalshiId: kalshi.id,
      confidence: Math.min(confidence, 1),
      matchMethod: signals.join("+") || "low_confidence",
      signals: {
        titleSimilarity,
        categoryMatch,
        endDateProximity,
        outcomeMatch,
      },
    };
  }

  private categoryScore(
    a: string | null | undefined,
    b: string | null | undefined,
  ): number {
    if (!a || !b) return 0;
    return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
  }

  private endDateScore(a: Date | null, b: Date | null): number {
    if (!a || !b) return 0;
    const diffDays =
      Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 1;
    if (diffDays > END_DATE_PROXIMITY_DAYS) return 0;
    return 1 - diffDays / END_DATE_PROXIMITY_DAYS;
  }

  private outcomeScore(
    polyTokens: { outcome: string }[],
    kalshiTokens: { outcome: string }[],
  ): number {
    const polyOutcomes = new Set(
      polyTokens.map((t) => this.normalizeOutcome(t.outcome)),
    );
    const kalshiOutcomes = new Set(
      kalshiTokens.map((t) => this.normalizeOutcome(t.outcome)),
    );
    if (polyOutcomes.size === 0 || kalshiOutcomes.size === 0) return 0;
    let overlap = 0;
    for (const o of polyOutcomes) {
      if (kalshiOutcomes.has(o)) overlap++;
    }
    const union = new Set([...polyOutcomes, ...kalshiOutcomes]).size;
    return overlap / union; // Jaccard similarity
  }

  private normalizeOutcome(outcome: string): string {
    return outcome
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  // ─── Manual curation ─────────────────────────────────────────────────────

  async createManualMatch(
    polymarketId: string,
    kalshiId: string,
  ): Promise<MarketMatch> {
    const [poly, kalshi] = await Promise.all([
      this.prisma.market.findUnique({ where: { id: polymarketId } }),
      this.prisma.market.findUnique({ where: { id: kalshiId } }),
    ]);
    if (!poly) throw new Error(`Polymarket market ${polymarketId} not found`);
    if (!kalshi) throw new Error(`Kalshi market ${kalshiId} not found`);

    return this.prisma.marketMatch.upsert({
      where: {
        polymarketId_kalshiId: { polymarketId, kalshiId },
      },
      update: { verified: true, confidence: 1 },
      create: {
        polymarketId,
        kalshiId,
        confidence: 1,
        matchMethod: "manual",
        verified: true,
      },
    });
  }

  async deleteMatch(matchId: string): Promise<void> {
    await this.prisma.marketMatch.delete({ where: { id: matchId } });
  }

  async verifyMatch(matchId: string): Promise<MarketMatch> {
    return this.prisma.marketMatch.update({
      where: { id: matchId },
      data: { verified: true },
    });
  }

  async listMatches(opts?: {
    verifiedOnly?: boolean;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: MarketMatch[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (opts?.verifiedOnly) where.verified = true;
    if (opts?.minConfidence) where.confidence = { gte: opts.minConfidence };

    const [data, total] = await Promise.all([
      this.prisma.marketMatch.findMany({
        where,
        orderBy: { confidence: "desc" },
        take: opts?.limit ?? 50,
        skip: opts?.offset ?? 0,
      }),
      this.prisma.marketMatch.count({ where }),
    ]);
    return { data, total };
  }

  async getMatchesForMarket(marketId: string): Promise<MarketMatch[]> {
    return this.prisma.marketMatch.findMany({
      where: {
        OR: [{ polymarketId: marketId }, { kalshiId: marketId }],
      },
    });
  }
}
