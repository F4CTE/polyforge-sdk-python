import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class BuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    // Aggregate live strategy volume (CONFIRMED orders from live strategies)
    const result = await this.prisma.order.aggregate({
      where: {
        status: "CONFIRMED",
        strategyId: { not: null },
      },
      _sum: { size: true },
      _count: { id: true },
    });

    // Active strategies (RUNNING)
    const activeStrategies = await this.prisma.strategy.count({
      where: { status: "RUNNING" },
    });

    // Connected users (have Polymarket credentials)
    const connectedUsers = await this.prisma.user.count({
      where: { polymarketConnected: true, suspended: false, deleted: false },
    });

    return {
      attributedVolumeUsdc: result._sum.size ?? 0,
      totalOrders: result._count.id,
      activeStrategies,
      connectedUsers,
      // Tier/rewards would come from Polymarket Builder API — placeholder for now
      currentTier: null,
      weeklyRewardUsdc: null,
    };
  }
}
