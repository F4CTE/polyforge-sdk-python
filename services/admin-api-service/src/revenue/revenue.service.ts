import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@polyforge/shared-db";

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface RevenueSource {
  source: string;
  label: string;
  revenue: number;
  pct: number;
  change: number;
  transactionCount: number;
}

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyRevenue(months: number) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      { month: string; revenue: number; fees: number; purchases: number }[]
    >(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${cutoff}::timestamp),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        )::date AS m
      ),
      monthly_purchases AS (
        SELECT
          date_trunc('month', mp."createdAt")::date AS m,
          COALESCE(SUM(mp."priceUsdc"), 0)::float AS revenue,
          COALESCE(SUM(mp."platformFee"), 0)::float AS fees,
          COUNT(*)::int AS purchases
        FROM marketplace_purchases mp
        WHERE mp."createdAt" >= ${cutoff}
        GROUP BY 1
      )
      SELECT
        to_char(mo.m, 'YYYY-MM') AS month,
        COALESCE(p.revenue, 0)::float AS revenue,
        COALESCE(p.fees, 0)::float AS fees,
        COALESCE(p.purchases, 0)::int AS purchases
      FROM months mo
      LEFT JOIN monthly_purchases p ON mo.m = p.m
      ORDER BY mo.m
    `);

    return {
      data: rows.map((r) => ({
        month: r.month,
        revenue: Number(r.revenue),
        fees: Number(r.fees),
        purchases: Number(r.purchases),
      })),
    };
  }

  async getBreakdown(period: string) {
    const days = PERIOD_DAYS[period] ?? 30;
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400_000);
    const previousStart = new Date(currentStart.getTime() - days * 86400_000);

    const [
      currentMarketplace,
      previousMarketplace,
      currentOrders,
      previousOrders,
    ] = await Promise.all([
      this.prisma.marketplacePurchase.aggregate({
        where: { createdAt: { gte: currentStart } },
        _sum: { platformFee: true, priceUsdc: true },
        _count: true,
      }),
      this.prisma.marketplacePurchase.aggregate({
        where: { createdAt: { gte: previousStart, lt: currentStart } },
        _sum: { platformFee: true, priceUsdc: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          status: "CONFIRMED",
          createdAt: { gte: currentStart },
          fee: { not: null },
        },
        _sum: { fee: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          status: "CONFIRMED",
          createdAt: { gte: previousStart, lt: currentStart },
          fee: { not: null },
        },
        _sum: { fee: true },
        _count: true,
      }),
    ]);

    const marketplaceRevenue = Number(currentMarketplace._sum.platformFee ?? 0);
    const prevMarketplaceRevenue = Number(
      previousMarketplace._sum.platformFee ?? 0,
    );
    const orderFees = Number(currentOrders._sum.fee ?? 0);
    const prevOrderFees = Number(previousOrders._sum.fee ?? 0);

    const sources: RevenueSource[] = [
      {
        source: "marketplace_listings",
        label: "Marketplace Listings",
        revenue: marketplaceRevenue,
        pct: 0,
        change: this.pctChange(marketplaceRevenue, prevMarketplaceRevenue),
        transactionCount: currentMarketplace._count,
      },
      {
        source: "copy_fees",
        label: "Copy Trading Fees",
        revenue: orderFees * 0.4,
        pct: 0,
        change: this.pctChange(orderFees * 0.4, prevOrderFees * 0.4),
        transactionCount: Math.round(currentOrders._count * 0.4),
      },
      {
        source: "strategy_sales",
        label: "Strategy Sales",
        revenue:
          Number(currentMarketplace._sum.priceUsdc ?? 0) - marketplaceRevenue,
        pct: 0,
        change: this.pctChange(
          Number(currentMarketplace._sum.priceUsdc ?? 0) - marketplaceRevenue,
          Number(previousMarketplace._sum.priceUsdc ?? 0) -
            prevMarketplaceRevenue,
        ),
        transactionCount: currentMarketplace._count,
      },
      {
        source: "subscription",
        label: "Subscriptions",
        revenue: 0,
        pct: 0,
        change: 0,
        transactionCount: 0,
      },
      {
        source: "other",
        label: "Other",
        revenue: orderFees * 0.6,
        pct: 0,
        change: this.pctChange(orderFees * 0.6, prevOrderFees * 0.6),
        transactionCount: Math.round(currentOrders._count * 0.6),
      },
    ];

    const totalRevenue = sources.reduce((sum, s) => sum + s.revenue, 0);
    for (const s of sources) {
      s.pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
    }

    const prevTotal = sources.reduce(
      (sum, s) =>
        sum +
        (s.change !== 0 && s.change !== -100
          ? s.revenue / (1 + s.change / 100)
          : s.revenue),
      0,
    );

    return {
      totalRevenue,
      totalChange: this.pctChange(totalRevenue, prevTotal),
      period,
      sources,
    };
  }

  async getTopUsers(period: string, limit: number) {
    const days = PERIOD_DAYS[period] ?? 30;
    const cutoff = new Date(Date.now() - days * 86400_000);

    const rows = await this.prisma.$queryRaw<
      {
        userId: string;
        username: string;
        revenueGenerated: number;
        tradeVolume: string;
        primarySource: string;
      }[]
    >(Prisma.sql`
      WITH user_marketplace AS (
        SELECT
          mp."buyerId" AS "userId",
          SUM(mp."platformFee")::float AS marketplace_rev,
          SUM(mp."priceUsdc")::text AS marketplace_vol
        FROM marketplace_purchases mp
        WHERE mp."createdAt" >= ${cutoff}
        GROUP BY mp."buyerId"
      ),
      user_orders AS (
        SELECT
          o."userId",
          SUM(o.fee)::float AS order_fees,
          SUM(o.size * o.price)::text AS trade_vol
        FROM orders o
        WHERE o.status = 'CONFIRMED'
          AND o."createdAt" >= ${cutoff}
          AND o.fee IS NOT NULL
        GROUP BY o."userId"
      ),
      combined AS (
        SELECT
          COALESCE(um."userId", uo."userId") AS "userId",
          COALESCE(um.marketplace_rev, 0) + COALESCE(uo.order_fees, 0) AS "revenueGenerated",
          COALESCE(uo.trade_vol, um.marketplace_vol, '0') AS "tradeVolume",
          CASE
            WHEN COALESCE(um.marketplace_rev, 0) >= COALESCE(uo.order_fees, 0)
            THEN 'marketplace_listings'
            ELSE 'copy_fees'
          END AS "primarySource"
        FROM user_marketplace um
        FULL OUTER JOIN user_orders uo ON um."userId" = uo."userId"
      )
      SELECT
        c."userId",
        u.username,
        c."revenueGenerated"::float,
        c."tradeVolume",
        c."primarySource"
      FROM combined c
      JOIN users u ON u.id = c."userId"
      WHERE c."revenueGenerated" > 0
      ORDER BY c."revenueGenerated" DESC
      LIMIT ${limit}
    `);

    return {
      data: rows.map((r) => ({
        userId: r.userId,
        username: r.username,
        revenueGenerated: Number(r.revenueGenerated),
        tradeVolume: String(r.tradeVolume),
        primarySource: r.primarySource,
      })),
    };
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
