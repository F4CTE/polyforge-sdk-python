import type { BlockEvaluator, BlockResult, EvalContext } from "./block.types";
import type { RedisService } from "@polyforge/shared-redis";
import type { PrismaService } from "@polyforge/shared-db";

type VenuePreference = "minimize_fees" | "polymarket" | "kalshi" | "best";

interface FeeRow {
  feeBps: number;
  category: string | null;
  minPrice: { toNumber(): number } | null;
  maxPrice: { toNumber(): number } | null;
}

export const VenueSelectBlock: BlockEvaluator = {
  async evaluate(
    block: Record<string, unknown>,
    ctx: EvalContext,
    _redis: RedisService,
    prisma: PrismaService,
  ): Promise<BlockResult> {
    const params = (block["params"] as Record<string, unknown>) ?? {};
    const preference = String(params.preference ?? "best") as VenuePreference;

    if (preference === "polymarket" || preference === "kalshi") {
      ctx.venue = preference;
      return { fired: true, reason: `venue set to ${preference}` };
    }

    if (preference === "best") {
      ctx.venue = "best";
      return { fired: true, reason: "venue set to best (lowest ask)" };
    }

    if (preference === "minimize_fees") {
      const tokenId = String(params.tokenId ?? "");
      if (!tokenId) {
        ctx.venue = "best";
        return {
          fired: true,
          reason: "minimize_fees: no tokenId, falling back to best",
        };
      }

      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: { market: { select: { category: true } } },
      });
      if (!token) {
        ctx.venue = "best";
        return {
          fired: true,
          reason: "minimize_fees: token not found, falling back to best",
        };
      }

      const price = Number(params.price ?? token.price ?? 0.5);
      const category = token.market?.category ?? null;

      const polyFee = await lookupFeeBps(
        prisma,
        "POLYMARKET",
        "taker",
        price,
        category,
      );
      const kalshiFee = await lookupFeeBps(
        prisma,
        "KALSHI",
        "taker",
        price,
        null,
      );

      if (kalshiFee < polyFee) {
        ctx.venue = "kalshi";
        return {
          fired: true,
          reason: `minimize_fees: kalshi ${kalshiFee}bps < polymarket ${polyFee}bps`,
          metadata: { polyFee, kalshiFee },
        };
      }

      ctx.venue = "polymarket";
      return {
        fired: true,
        reason: `minimize_fees: polymarket ${polyFee}bps <= kalshi ${kalshiFee}bps`,
        metadata: { polyFee, kalshiFee },
      };
    }

    return { fired: false, reason: `unknown preference: ${preference}` };
  },
};

async function lookupFeeBps(
  prisma: PrismaService,
  venue: string,
  role: string,
  price: number,
  category: string | null,
): Promise<number> {
  const now = new Date();
  const schedules = await prisma.venueFeeSchedule.findMany({
    where: {
      venue: venue as any,
      role,
      effectiveAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { feeBps: true, category: true, minPrice: true, maxPrice: true },
    orderBy: { effectiveAt: "desc" },
  });

  if (schedules.length === 0) return 200;

  const rows: FeeRow[] = schedules as FeeRow[];

  if (venue === "KALSHI") {
    const band = rows.find((s: FeeRow) => {
      const min = s.minPrice?.toNumber() ?? 0;
      const max = s.maxPrice?.toNumber() ?? 1;
      return price >= min && price < max;
    });
    return band?.feeBps ?? 200;
  }

  if (category) {
    const match = rows.find(
      (s: FeeRow) => s.category?.toLowerCase() === category.toLowerCase(),
    );
    if (match) return match.feeBps;
  }
  const def = rows.find((s: FeeRow) => s.category === null);
  return def?.feeBps ?? 200;
}
