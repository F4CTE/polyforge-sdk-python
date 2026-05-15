import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  RedisService,
  runOncePerCluster,
  BetaLimitsConfigService,
} from "@polyforge/shared-redis";
import { PrismaService } from "@polyforge/shared-db";

const SERVICES = [
  {
    name: "auth-service",
    url: process.env.AUTH_SERVICE_URL ?? "http://auth-service:3001",
  },
  {
    name: "api-service",
    url: process.env.API_SERVICE_URL ?? "http://api-service:3002",
  },
  {
    name: "admin-auth-service",
    url: process.env.ADMIN_AUTH_SERVICE_URL ?? "http://admin-auth-service:3003",
  },
  {
    name: "market-data-service",
    url:
      process.env.MARKET_DATA_SERVICE_URL ?? "http://market-data-service:3005",
  },
  {
    name: "strategy-engine",
    url: process.env.STRATEGY_ENGINE_URL ?? "http://strategy-engine:3006",
  },
  {
    name: "order-service",
    url: process.env.ORDER_SERVICE_URL ?? "http://order-service:3007",
  },
  {
    name: "paper-order-service",
    url:
      process.env.PAPER_ORDER_SERVICE_URL ?? "http://paper-order-service:3008",
  },
  {
    name: "backtest-service",
    url: process.env.BACKTEST_SERVICE_URL ?? "http://backtest-service:3009",
  },
  {
    name: "notification-service",
    url:
      process.env.NOTIFICATION_SERVICE_URL ??
      "http://notification-service:3010",
  },
  {
    name: "bot-service",
    url: process.env.BOT_SERVICE_URL ?? "http://bot-service:3011",
  },
  {
    name: "signer-service",
    url: process.env.SIGNER_SERVICE_URL ?? "http://signer-service:3012",
  },
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly betaLimits: BetaLimitsConfigService,
  ) {}

  @Cron("*/10 * * * * *") // every 10 seconds
  async pollHealthChecks() {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:dashboard:pollHealthChecks",
      ttlMs: 8000,
      job: async () => {
        await Promise.allSettled(SERVICES.map((svc) => this.checkService(svc)));
      },
    });
  }

  private async checkService(svc: { name: string; url: string }) {
    const start = Date.now();
    try {
      const res = await fetch(`${svc.url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      const status = res.ok ? "healthy" : "degraded";
      await this.redis.getClient().set(
        `health:${svc.name}`,
        JSON.stringify({
          status,
          latencyMs,
          checkedAt: new Date().toISOString(),
        }),
        "EX",
        15,
      );
    } catch {
      await this.redis.getClient().set(
        `health:${svc.name}`,
        JSON.stringify({
          status: "down",
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        }),
        "EX",
        15,
      );
    }
  }

  async getHealth() {
    const services: Record<string, any> = {};

    for (const svc of SERVICES) {
      const raw = await this.redis.getClient().get(`health:${svc.name}`);
      services[svc.name] = raw ? JSON.parse(raw) : { status: "unknown" };
    }

    // DB connectivity
    let dbStatus = "healthy";
    let dbConnections = 0;
    try {
      const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
            `;
      dbConnections = Number(result[0]?.count ?? 0);
    } catch {
      dbStatus = "down";
    }

    // Redis connectivity
    let redisStatus = "healthy";
    let redisMemoryMb = 0;
    try {
      const info = await this.redis.getClient().info("memory");
      const match = info.match(/used_memory:(\d+)/);
      if (match) redisMemoryMb = Math.round(Number(match[1]) / 1024 / 1024);
    } catch {
      redisStatus = "down";
    }

    const allHealthy = Object.values(services).every(
      (s: any) => s.status === "healthy",
    );

    return {
      status: allHealthy ? "healthy" : "degraded",
      services,
      db: { status: dbStatus, connections: dbConnections },
      redis: { status: redisStatus, memoryUsageMb: redisMemoryMb },
    };
  }

  async getPlatformStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);

    const [
      totalNewsSignals,
      marketsWithSentimentRaw,
      totalLpOrders,
      resolvedPositions,
    ] = await Promise.all([
      this.prisma.newsSignal.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT "marketId")::bigint AS count
          FROM news_signals
          WHERE "createdAt" >= ${sevenDaysAgo}
        `,
      this.prisma.order.count({
        where: {
          strategyId: null,
          orderType: "FOK",
          status: { not: "CANCELLED" },
        },
      }),
      this.prisma.position.count({
        where: {
          resolutionStatus: "RESOLVED" as any,
        },
      }),
    ]);

    return {
      totalNewsSignals,
      marketsWithSentiment: Number(marketsWithSentimentRaw[0]?.count ?? 0),
      totalLpOrders,
      resolvedPositions,
      avgBrierScore: null,
    };
  }

  async getRateLimits() {
    const client = this.redis.getClient();

    // Scan for throttler keys (NestJS throttler uses pattern: <prefix>:<identifier>)
    const throttlerKeys = await new Promise<string[]>((resolve, reject) => {
      const found: string[] = [];
      const stream = client.scanStream({ match: "throttler:*", count: 200 });
      stream.on("data", (batch: string[]) => found.push(...batch));
      stream.on("end", () => resolve(found));

      stream.on("error", (err: unknown) =>
        reject(err instanceof Error ? err : new Error(String(err))),
      );
    });

    // Get TTLs and values for each key
    const entries: { key: string; hits: number; ttl: number }[] = [];
    for (const key of throttlerKeys.slice(0, 50)) {
      try {
        const [hits, ttl] = await Promise.all([
          client.get(key),
          client.ttl(key),
        ]);
        entries.push({
          key: key.replace("throttler:", ""),
          hits: parseInt(hits ?? "0", 10),
          ttl,
        });
      } catch {
        // skip unreadable keys
      }
    }

    // Sort by hits descending to show top offenders
    entries.sort((a, b) => b.hits - a.hits);

    // Count recent 429 responses (stored as counter by API services)
    let recent429Count = 0;
    try {
      const count = await client.get("stats:429_count");
      recent429Count = parseInt(count ?? "0", 10);
    } catch {
      // non-critical
    }

    return {
      totalTrackedKeys: throttlerKeys.length,
      recent429Count,
      topOffenders: entries.slice(0, 20),
      limits: {
        register: { limit: 5, windowMs: 3600000 },
        login: { limit: 10, windowMs: 900000 },
        forgotPassword: { limit: 3, windowMs: 3600000 },
        resendVerification: { limit: 3, windowMs: 3600000 },
        general: { limit: 100, windowMs: 60000 },
      },
    };
  }

  async getMarketplaceStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

    const [
      totalListings,
      activeListings,
      totalPurchases,
      totalRevenue,
      topListings,
      recentPurchases,
    ] = await Promise.all([
      this.prisma.marketplaceListing.count(),
      this.prisma.marketplaceListing.count({ where: { status: "ACTIVE" } }),
      this.prisma.marketplacePurchase.count(),
      this.prisma.marketplacePurchase.aggregate({ _sum: { priceUsdc: true } }),
      this.prisma.marketplaceListing.findMany({
        where: { status: "ACTIVE" },
        orderBy: { totalRevenue: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          priceUsdc: true,
          purchaseCount: true,
          forkCount: true,
          avgRating: true,
          ratingCount: true,
          totalRevenue: true,
          seller: { select: { username: true, displayName: true } },
        },
      }),
      this.prisma.marketplacePurchase.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          priceUsdc: true,
          platformFee: true,
          sellerNet: true,
          createdAt: true,
          listing: { select: { title: true } },
        },
      }),
    ]);

    const platformFeeTotal = await this.prisma.marketplacePurchase.aggregate({
      _sum: { platformFee: true },
    });

    return {
      totalListings,
      activeListings,
      totalPurchases,
      totalRevenue: Number(totalRevenue._sum.priceUsdc ?? 0),
      platformFeeTotal: Number(platformFeeTotal._sum.platformFee ?? 0),
      topListings,
      recentPurchases,
    };
  }

  async getBetaUsage() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const warningThreshold = 0.8; // flag users at ≥80% of any limit

    // Strategy slot usage: users with ≥1 active strategy, ranked by count
    const strategyCountsRaw = await this.prisma.strategy.groupBy({
      by: ["userId"],
      where: { status: { not: "ARCHIVED" } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 50,
    });

    // Monthly volume by user
    const volumeRaw = await this.prisma.order.groupBy({
      by: ["userId"],
      where: {
        status: "CONFIRMED",
        createdAt: { gte: monthStart },
      },
      _sum: { size: true },
      orderBy: { _sum: { size: "desc" } },
      take: 50,
    });

    // Active backtests (RUNNING or QUEUED) by user
    const backtestRaw = await this.prisma.backtestRun.groupBy({
      by: ["userId"],
      where: { status: { in: ["RUNNING", "QUEUED"] } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    // Marketplace listings (non-delisted) by user
    const listingRaw = await this.prisma.marketplaceListing.groupBy({
      by: ["sellerId"],
      where: { status: { not: "DELISTED" } },
      _count: { id: true },
    });

    // Resolve usernames for display
    const allUserIds = [
      ...new Set([
        ...strategyCountsRaw.map((r) => r.userId),
        ...volumeRaw.map((r) => r.userId),
        ...backtestRaw.map((r) => r.userId),
        ...listingRaw.map((r) => r.sellerId),
      ]),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, username: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const [maxActive, maxMonthly, maxListings] = await Promise.all([
      this.betaLimits.getLimit("maxActiveStrategies"),
      this.betaLimits.getLimit("maxMonthlyVolumeUsdc"),
      this.betaLimits.getLimit("maxMarketplaceListings"),
    ]);

    const strategyUsers = strategyCountsRaw.map((r) => ({
      userId: r.userId,
      username: userMap.get(r.userId)?.username ?? null,
      email: userMap.get(r.userId)?.email ?? null,
      activeStrategies: r._count.id,
      limit: maxActive,
      pct: r._count.id / maxActive,
      atLimit: r._count.id >= maxActive,
    }));

    const volumeUsers = volumeRaw.map((r) => {
      const vol = Number(r._sum.size ?? 0);
      return {
        userId: r.userId,
        username: userMap.get(r.userId)?.username ?? null,
        email: userMap.get(r.userId)?.email ?? null,
        monthlyVolumeUsdc: vol,
        limit: maxMonthly,
        pct: vol / maxMonthly,
        atLimit: vol >= maxMonthly,
      };
    });

    const backtestUsers = backtestRaw.map((r) => ({
      userId: r.userId,
      username: userMap.get(r.userId)?.username ?? null,
      pendingBacktests: r._count.id,
    }));

    const listingUsers = listingRaw.map((r) => ({
      userId: r.sellerId,
      username: userMap.get(r.sellerId)?.username ?? null,
      listings: r._count.id,
      limit: maxListings,
      atLimit: r._count.id >= maxListings,
    }));

    // Summary counts
    const usersApproachingStrategyCap = strategyUsers.filter(
      (u) => u.pct >= warningThreshold,
    ).length;
    const usersApproachingVolumeCap = volumeUsers.filter(
      (u) => u.pct >= warningThreshold,
    ).length;

    const limits = await this.betaLimits.getAllLimits();

    return {
      asOf: now.toISOString(),
      limits,
      summary: {
        usersApproachingStrategyCap,
        usersApproachingVolumeCap,
        usersAtStrategyCap: strategyUsers.filter((u) => u.atLimit).length,
        usersAtVolumeCap: volumeUsers.filter((u) => u.atLimit).length,
        usersAtMarketplaceCap: listingUsers.filter((u) => u.atLimit).length,
      },
      strategyUsage: strategyUsers.filter((u) => u.pct >= warningThreshold),
      volumeUsage: volumeUsers.filter((u) => u.pct >= warningThreshold),
      backtestBacklog: backtestUsers,
      marketplaceUsage: listingUsers.filter((u) => u.atLimit),
    };
  }
}
