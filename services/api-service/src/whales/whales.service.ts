import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
import { paginate } from "../common/dto/pagination.dto";
import { WhaleFeedQueryDto, WhaleTopQueryDto } from "./dto/whale-query.dto";

@Injectable()
export class WhalesService {
  private readonly logger = new Logger(WhalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Feed ──────────────────────────────────────────────────────────────────

  async getFeed(query: WhaleFeedQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WhaleAlertWhereInput = {};

    if (query.minSize) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      where.notional = { gte: new Prisma.Decimal(query.minSize) };
    }
    if (query.marketId) {
      where.marketId = query.marketId;
    }
    if (query.walletAddress) {
      where.walletAddress = query.walletAddress;
    }

    const [data, total] = await Promise.all([
      this.prisma.whaleAlert.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip,
        take: limit,
        include: {
          market: {
            select: { id: true, title: true, slug: true, image: true },
          },
        },
      }),
      this.prisma.whaleAlert.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // ─── Top Whales ────────────────────────────────────────────────────────────

  async getTopWhales(query: WhaleTopQueryDto) {
    const limit = query.limit ?? 20;

    const sortFieldMap: Record<string, string> = {
      volume: "totalVolume",
      pnl: "totalPnl",
      winRate: "winRate",
      tradeCount: "tradeCount",
    };

    const orderByField =
      sortFieldMap[query.sortBy ?? "volume"] ?? "totalVolume";

    const profiles = await this.prisma.whaleProfile.findMany({
      orderBy: { [orderByField]: "desc" },
      take: limit,
    });

    return profiles;
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async getProfile(address: string, userId?: string) {
    const [profile, alerts, followRecord] = await Promise.all([
      this.prisma.whaleProfile.findUnique({
        where: { walletAddress: address },
      }),
      this.prisma.whaleAlert.findMany({
        where: { walletAddress: address },
        orderBy: { detectedAt: "desc" },
        take: 20,
        include: {
          market: {
            select: { id: true, title: true, slug: true, image: true },
          },
        },
      }),
      userId
        ? this.prisma.whaleFollow.findUnique({
            where: { userId_walletAddress: { userId, walletAddress: address } },
          })
        : Promise.resolve(null),
    ]);

    const stats = profile
      ? {
          totalVolume:
            profile.totalVolume != null ? String(profile.totalVolume) : "0",
          totalPnl: profile.totalPnl != null ? String(profile.totalPnl) : "0",
          tradeCount: profile.tradeCount ?? 0,
          winRate: profile.winRate != null ? String(profile.winRate) : "0",
        }
      : null;

    const recentTrades = alerts.map((a) => ({
      id: a.id,
      marketName: a.market?.title ?? "Unknown Market",
      side: a.side,
      outcome: a.outcome,
      size: a.size != null ? String(a.size) : "0",
      price: a.price != null ? String(a.price) : "0",
      timestamp: a.detectedAt.toISOString(),
    }));

    // Build sparkline: count alerts per day for last 30 days
    const now = Date.now();
    const dayCounts = new Array(30).fill(0);
    for (const a of alerts) {
      const daysAgo = Math.floor((now - a.detectedAt.getTime()) / 86400_000);
      if (daysAgo >= 0 && daysAgo < 30) {
        dayCounts[29 - daysAgo]++;
      }
    }

    return {
      walletAddress: address,
      stats,
      recentTrades,
      sparkline: dayCounts,
      isFollowing: !!followRecord,
    };
  }

  // ─── Follow / Unfollow ─────────────────────────────────────────────────────

  async toggleFollow(userId: string, walletAddress: string) {
    const existing = await this.prisma.whaleFollow.findUnique({
      where: { userId_walletAddress: { userId, walletAddress } },
    });

    if (existing) {
      await this.prisma.whaleFollow.delete({ where: { id: existing.id } });
      return { followed: false };
    }

    await this.prisma.whaleFollow.create({
      data: { userId, walletAddress },
    });
    return { followed: true };
  }

  // ─── Following ─────────────────────────────────────────────────────────────

  async getFollowing(userId: string) {
    const follows = await this.prisma.whaleFollow.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with whale profile data
    const addresses = follows.map((f) => f.walletAddress);
    const profiles = await this.prisma.whaleProfile.findMany({
      where: { walletAddress: { in: addresses } },
    });

    const profileMap = new Map(profiles.map((p) => [p.walletAddress, p]));

    return follows.map((f) => ({
      ...f,
      profile: profileMap.get(f.walletAddress) ?? null,
    }));
  }
}
