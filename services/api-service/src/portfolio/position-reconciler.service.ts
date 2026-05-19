import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
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
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:position-reconciler:reconcile",
      ttlMs: 240_000,
      job: async () => {
        // Only reconcile users who actually have unresolved positions
        const usersWithPositions = await this.prisma.position.findMany({
          where: {
            resolutionStatus: {
              in: [ResolutionStatus.UNRESOLVED, ResolutionStatus.RESOLVING],
            },
          },
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
      },
    });
  }

  async reconcileUser(userId: string, walletAddress: string): Promise<void> {
    const polyPositions = await this.clob.getPositions(walletAddress);

    const localPositions = await this.prisma.position.findMany({
      where: {
        userId,
        resolutionStatus: {
          in: [ResolutionStatus.UNRESOLVED, ResolutionStatus.RESOLVING],
        },
      },
    });

    if (polyPositions.length === 0 && localPositions.length === 0) return;

    const matchedLocalIds = new Set<string>();

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
        matchedLocalIds.add(local.id);

        if (local.resolutionStatus === ResolutionStatus.RESOLVING) {
          this.logger.warn(
            `User-closed position ${local.id} settled, marking resolved`,
          );
          await this.prisma.position.update({
            where: { id: local.id },
            data: {
              resolutionStatus: ResolutionStatus.RESOLVED,
              size: 0,
              realizedPnl: polyPos.realizedPnl ?? "0",
            },
          });
        } else {
          this.logger.warn(
            `Stale local position ${local.id}, marking resolved`,
          );
          await this.prisma.position.update({
            where: { id: local.id },
            data: { resolutionStatus: ResolutionStatus.RESOLVED, size: 0 },
          });
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
      } else if (local) {
        matchedLocalIds.add(local.id);

        // If a RESOLVING position still has CLOB size, the close failed.
        // Revert to UNRESOLVED so the user can retry.
        if (
          local.resolutionStatus === ResolutionStatus.RESOLVING &&
          parseFloat(polyPos.size) > 0
        ) {
          this.logger.warn(
            `RESOLVING position ${local.id} still has CLOB size, reverting to UNRESOLVED`,
          );
          await this.prisma.position.update({
            where: { id: local.id },
            data: { resolutionStatus: ResolutionStatus.UNRESOLVED },
          });
        }
      }
    }

    for (const local of localPositions) {
      if (matchedLocalIds.has(local.id)) continue;
      if (local.resolutionStatus !== ResolutionStatus.RESOLVING) continue;

      this.logger.warn(
        `RESOLVING position ${local.id} absent from CLOB, marking resolved`,
      );
      await this.prisma.position.update({
        where: { id: local.id },
        data: { resolutionStatus: ResolutionStatus.RESOLVED, size: 0 },
      });
    }
  }
}
