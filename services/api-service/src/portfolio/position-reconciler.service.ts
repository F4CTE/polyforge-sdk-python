import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { EventsGateway } from "../gateway/events.gateway";
import { ClobReadService } from "../common/services/clob-read.service";
import { ResolutionStatus } from "@prisma/client";

@Injectable()
export class PositionReconcilerService {
  private readonly logger = new Logger(PositionReconcilerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clob: ClobReadService,
    private readonly gateway: EventsGateway,
  ) {}

  @Cron("*/5 * * * *")
  async reconcile(): Promise<void> {
    // Only reconcile users who actually have unresolved positions
    const usersWithPositions = await this.prisma.position.findMany({
      where: { resolutionStatus: ResolutionStatus.UNRESOLVED },
      select: { userId: true },
      distinct: ["userId"],
    });

    if (usersWithPositions.length === 0) return;

    const userIds = usersWithPositions.map((u) => u.userId);
    const connectedUsers = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        polymarketConnected: true,
        suspended: false,
        deleted: false,
      },
      select: { id: true, polymarketAddress: true },
    });

    // Parallel with concurrency limit of 10
    const CONCURRENCY = 10;
    for (let i = 0; i < connectedUsers.length; i += CONCURRENCY) {
      const batch = connectedUsers.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch
          .filter(
            (u): u is typeof u & { polymarketAddress: string } =>
              u.polymarketAddress != null,
          )
          .map((u) =>
            this.reconcileUser(u.id, u.polymarketAddress).catch(
              (err: unknown) =>
                this.logger.warn(
                  `Reconciliation failed for ${u.id}: ${(err as Error).message}`,
                ),
            ),
          ),
      );
    }
  }

  async reconcileUser(userId: string, walletAddress: string): Promise<void> {
    const polyPositions = await this.clob.getPositions(walletAddress);
    if (polyPositions.length === 0) return;

    const localPositions = await this.prisma.position.findMany({
      where: { userId, resolutionStatus: ResolutionStatus.UNRESOLVED },
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
            resolutionStatus: ResolutionStatus.UNRESOLVED,
          },
        });
      } else if (local && parseFloat(polyPos.size) === 0) {
        this.logger.warn(`Stale local position ${local.id}, marking resolved`);
        await this.prisma.position.update({
          where: { id: local.id },
          data: { resolutionStatus: ResolutionStatus.RESOLVED, size: 0 },
        });
        // Notify user via WebSocket
        this.gateway.pushNotification(userId, {
          type: "MARKET_RESOLVED",
          positionId: local.id,
          tokenId: local.tokenId,
          marketId: local.marketId,
          outcome: local.outcome,
          realizedPnl: polyPos.realizedPnl ?? "0",
          message: `Market resolved — your ${local.outcome} position has settled. P&L: ${polyPos.realizedPnl ?? "0"} USDC`,
        });
      }
    }
  }
}
