import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
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

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

    const orderByField = sortFieldMap[query.sortBy ?? "volume"] ?? "totalVolume";

    const profiles = await this.prisma.whaleProfile.findMany({
      orderBy: { [orderByField]: "desc" },
      take: limit,
    });

    return profiles;
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async getProfile(address: string) {
    const [profile, recentTrades] = await Promise.all([
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
    ]);

    return {
      profile: profile ?? {
        walletAddress: address,
        totalVolume: "0",
        totalPnl: "0",
        tradeCount: 0,
        winRate: "0",
        lastTradeAt: null,
      },
      recentTrades,
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

    const profileMap = new Map(
      profiles.map((p) => [p.walletAddress, p]),
    );

    return follows.map((f) => ({
      ...f,
      profile: profileMap.get(f.walletAddress) ?? null,
    }));
  }
}
