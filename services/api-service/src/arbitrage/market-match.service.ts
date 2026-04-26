import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import {
  computeConfidence,
  AUTO_MATCH_THRESHOLD,
  buildIdf,
  type MatchCandidate,
} from "./matching/confidence";

interface MarketRow {
  id: string;
  title: string;
  category: string | null;
  endDate: Date | null;
  tokens: { outcome: string }[];
}

@Injectable()
export class MarketMatchService {
  private readonly logger = new Logger(MarketMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron("*/5 * * * *")
  async syncMatches(): Promise<number> {
    return (
      (await runOncePerCluster({
        redis: this.redis,
        key: "lock:cron:market-match:syncMatches",
        ttlMs: 240_000,
        job: async () => {
          try {
            return await this.runMatchingPass();
          } catch (err) {
            this.logger.error(
              "Market matching pass failed",
              (err as Error).message,
            );
            return 0;
          }
        },
      })) ?? 0
    );
  }

  async runMatchingPass(): Promise<number> {
    const polymarkets = await this.fetchOpenMarkets("POLYMARKET");
    const kalshiMarkets = await this.fetchOpenMarkets("KALSHI");

    if (polymarkets.length === 0 || kalshiMarkets.length === 0) {
      this.logger.log("Skipping matching — need markets on both venues");
      return 0;
    }

    const existingMatches = await this.prisma.marketMatch.findMany({
      select: { polymarketId: true, kalshiId: true },
    });
    const existingPairs = new Set(
      existingMatches.map((m) => `${m.polymarketId}|${m.kalshiId}`),
    );
    const alreadyMatchedKalshi = new Set(
      existingMatches.map((m) => m.kalshiId),
    );
    const alreadyMatchedPoly = new Set(
      existingMatches.map((m) => m.polymarketId),
    );

    const allTitles = [
      ...polymarkets.map((m) => m.title),
      ...kalshiMarkets.map((m) => m.title),
    ];
    const idf = buildIdf(allTitles);

    const candidates: MatchCandidate[] = [];

    for (const poly of polymarkets) {
      if (alreadyMatchedPoly.has(poly.id)) continue;

      for (const kalshi of kalshiMarkets) {
        if (alreadyMatchedKalshi.has(kalshi.id)) continue;
        if (existingPairs.has(`${poly.id}|${kalshi.id}`)) continue;

        const candidate = computeConfidence(
          {
            id: poly.id,
            title: poly.title,
            category: poly.category,
            endDate: poly.endDate,
            outcomes: poly.tokens.map((t) => t.outcome),
          },
          {
            id: kalshi.id,
            title: kalshi.title,
            category: kalshi.category,
            endDate: kalshi.endDate,
            outcomes: kalshi.tokens.map((t) => t.outcome),
          },
          idf,
        );

        if (candidate.confidence >= AUTO_MATCH_THRESHOLD) {
          candidates.push(candidate);
        }
      }
    }

    if (candidates.length === 0) return 0;

    const bestByKalshi = new Map<string, MatchCandidate>();
    for (const c of candidates.sort((a, b) => b.confidence - a.confidence)) {
      if (!bestByKalshi.has(c.kalshiId)) {
        bestByKalshi.set(c.kalshiId, c);
      }
    }

    let created = 0;
    for (const match of bestByKalshi.values()) {
      try {
        await this.prisma.marketMatch.create({
          data: {
            polymarketId: match.polymarketId,
            kalshiId: match.kalshiId,
            confidence: match.confidence,
            matchMethod: match.matchMethod,
          },
        });
        created++;
      } catch (err: any) {
        if (err?.code === "P2002") continue;
        throw err;
      }
    }

    this.logger.log(
      `Matching pass complete: ${created} new matches from ${candidates.length} candidates`,
    );
    return created;
  }

  async manualMatch(
    polymarketId: string,
    kalshiId: string,
  ): Promise<{ id: string }> {
    const match = await this.prisma.marketMatch.upsert({
      where: {
        polymarketId_kalshiId: { polymarketId, kalshiId },
      },
      create: {
        polymarketId,
        kalshiId,
        confidence: 1,
        matchMethod: "manual",
        verified: true,
      },
      update: {
        confidence: 1,
        matchMethod: "manual",
        verified: true,
      },
    });
    return { id: match.id };
  }

  async manualUnmatch(matchId: string): Promise<void> {
    await this.prisma.marketMatch.delete({ where: { id: matchId } });
  }

  async verifyMatch(matchId: string): Promise<void> {
    await this.prisma.marketMatch.update({
      where: { id: matchId },
      data: { verified: true },
    });
  }

  async listMatches(opts: {
    verified?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where =
      opts.verified !== undefined ? { verified: opts.verified } : {};
    const [matches, total] = await Promise.all([
      this.prisma.marketMatch.findMany({
        where,
        orderBy: { confidence: "desc" },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.marketMatch.count({ where }),
    ]);
    return { matches, total };
  }

  async getMatchById(matchId: string) {
    return this.prisma.marketMatch.findUnique({ where: { id: matchId } });
  }

  async getMatchesByMarketId(marketId: string) {
    return this.prisma.marketMatch.findMany({
      where: {
        OR: [{ polymarketId: marketId }, { kalshiId: marketId }],
      },
    });
  }

  private async fetchOpenMarkets(
    venue: "POLYMARKET" | "KALSHI",
  ): Promise<MarketRow[]> {
    return this.prisma.market.findMany({
      where: { venue, closed: false },
      select: {
        id: true,
        title: true,
        category: true,
        endDate: true,
        tokens: { select: { outcome: true } },
      },
      orderBy: { volume24h: "desc" },
      take: 2000,
    });
  }
}
