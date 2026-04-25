import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Venue } from "@prisma/client";
import type { VenueFeeEstimate } from "./dto/order-preview.dto";

export interface FeeInput {
  venue: Venue;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  category?: string | null;
  isMaker?: boolean;
}

interface FeeScheduleRow {
  feeBps: number;
  category: string | null;
  minPrice: { toNumber(): number } | null;
  maxPrice: { toNumber(): number } | null;
}

@Injectable()
export class FeeCalculatorService {
  private readonly logger = new Logger(FeeCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async estimateFee(input: FeeInput): Promise<VenueFeeEstimate> {
    const role = input.isMaker ? "maker" : "taker";
    const feeBps = await this.lookupFeeBps(
      input.venue,
      role,
      input.price,
      input.category,
    );
    const feeRate = feeBps / 10000;
    const orderValue = input.price * input.size;
    const feeUsd = orderValue * feeRate;
    const totalCostUsd =
      input.side === "BUY" ? orderValue + feeUsd : orderValue - feeUsd;

    return {
      venue: input.venue,
      feeBps,
      feeUsd: Math.round(feeUsd * 1e6) / 1e6,
      totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
      isMaker: !!input.isMaker,
    };
  }

  async compareFees(params: {
    price: number;
    size: number;
    side: "BUY" | "SELL";
    category?: string | null;
    isMaker?: boolean;
    kalshiAvailable: boolean;
  }): Promise<{
    polymarket: VenueFeeEstimate;
    kalshi: VenueFeeEstimate | null;
    savings: number;
    recommendedVenue: string;
  }> {
    const polyEst = await this.estimateFee({
      venue: Venue.POLYMARKET,
      side: params.side,
      price: params.price,
      size: params.size,
      category: params.category,
      isMaker: params.isMaker,
    });

    if (!params.kalshiAvailable) {
      return {
        polymarket: polyEst,
        kalshi: null,
        savings: 0,
        recommendedVenue: "POLYMARKET",
      };
    }

    const kalshiEst = await this.estimateFee({
      venue: Venue.KALSHI,
      side: params.side,
      price: params.price,
      size: params.size,
      isMaker: params.isMaker,
    });

    const savings = Math.abs(polyEst.feeUsd - kalshiEst.feeUsd);
    const recommendedVenue =
      polyEst.totalCostUsd <= kalshiEst.totalCostUsd ? "POLYMARKET" : "KALSHI";

    return {
      polymarket: polyEst,
      kalshi: kalshiEst,
      savings: Math.round(savings * 1e6) / 1e6,
      recommendedVenue,
    };
  }

  async lookupFeeBps(
    venue: Venue,
    role: string,
    price: number,
    category?: string | null,
  ): Promise<number> {
    const now = new Date();

    const schedules = (await this.prisma.venueFeeSchedule.findMany({
      where: {
        venue,
        role,
        effectiveAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        feeBps: true,
        category: true,
        minPrice: true,
        maxPrice: true,
      },
      orderBy: { effectiveAt: "desc" },
    })) as FeeScheduleRow[];

    if (schedules.length === 0) {
      this.logger.warn(
        `No fee schedule found for ${venue}/${role} — defaulting to 200 bps`,
      );
      return 200;
    }

    if (venue === Venue.KALSHI) {
      return this.resolveKalshiFee(schedules, price);
    }
    return this.resolvePolymarketFee(schedules, category);
  }

  private resolvePolymarketFee(
    schedules: FeeScheduleRow[],
    category?: string | null,
  ): number {
    if (category) {
      const catMatch = schedules.find(
        (s) => s.category?.toLowerCase() === category.toLowerCase(),
      );
      if (catMatch) return catMatch.feeBps;
    }
    const defaultMatch = schedules.find((s) => s.category === null);
    return defaultMatch?.feeBps ?? 200;
  }

  private resolveKalshiFee(schedules: FeeScheduleRow[], price: number): number {
    const bandMatch = schedules.find((s) => {
      const min = s.minPrice?.toNumber() ?? 0;
      const max = s.maxPrice?.toNumber() ?? 1;
      return price >= min && price < max;
    });
    if (bandMatch) return bandMatch.feeBps;

    const fallback = schedules.find(
      (s) => s.minPrice === null && s.maxPrice === null,
    );
    return fallback?.feeBps ?? 200;
  }
}
