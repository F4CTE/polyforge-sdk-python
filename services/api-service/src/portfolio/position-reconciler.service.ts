import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

@Injectable()
export class PositionReconcilerService {
  private readonly logger = new Logger(PositionReconcilerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Cron("*/5 * * * *")
  async reconcile(): Promise<void> {
    const connectedUsers = await this.prisma.user.findMany({
      where: { polymarketConnected: true, suspended: false, deleted: false },
      select: { id: true, polymarketAddress: true },
    });

    for (const user of connectedUsers) {
      if (!user.polymarketAddress) continue;
      try {
        await this.reconcileUser(user.id, user.polymarketAddress);
      } catch (err: unknown) {
        this.logger.warn(
          `Reconciliation failed for ${user.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async reconcileUser(userId: string, walletAddress: string): Promise<void> {
    const clobUrl =
      this.config.get<string>("CLOB_API_URL") ?? "http://mock-polymarket:3099";

    const res = await fetch(`${clobUrl}/positions?user=${walletAddress}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return;

    const polyPositions = (await res.json()) as Array<{
      asset: string;
      size: string;
      avgPrice: string;
      realizedPnl: string;
    }>;

    const localPositions = await this.prisma.position.findMany({
      where: { userId, resolutionStatus: "UNRESOLVED" as any },
    });

    for (const polyPos of polyPositions) {
      const local = localPositions.find((lp) => lp.tokenId === polyPos.asset);

      if (!local && parseFloat(polyPos.size) > 0) {
        this.logger.warn(
          `Missing local position for ${polyPos.asset}, creating`,
        );
        await this.prisma.position.create({
          data: {
            userId,
            tokenId: polyPos.asset,
            marketId: "",
            outcome: "YES",
            size: polyPos.size,
            avgPrice: polyPos.avgPrice,
            currentPrice: "0",
            unrealizedPnl: "0",
            realizedPnl: polyPos.realizedPnl ?? "0",
            resolutionStatus: "UNRESOLVED" as any,
          },
        });
      } else if (local && parseFloat(polyPos.size) === 0) {
        this.logger.warn(`Stale local position ${local.id}, marking resolved`);
        await this.prisma.position.update({
          where: { id: local.id },
          data: { resolutionStatus: "RESOLVED" as any, size: 0 },
        });
      }
    }
  }
}
