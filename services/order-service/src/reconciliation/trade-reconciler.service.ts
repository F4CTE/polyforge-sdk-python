import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { ClobClientService } from "../clob-client/clob-client.service";
import { EventsService } from "../events/events.service";

export interface ClobTrade {
  id: string;
  order_id: string;
  market: string;
  asset_id: string;
  side: string;
  size: string;
  price: string;
  status: string;
  match_time: string;
}

@Injectable()
export class TradeReconcilerService {
  private readonly logger = new Logger(TradeReconcilerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clob: ClobClientService,
    private readonly events: EventsService,
  ) {}

  /**
   * Every 2 minutes, reconcile local order statuses against Polymarket CLOB trades.
   * Finds orders with active statuses (PENDING, SUBMITTED, MATCHED, LIVE,
   * DELAYED, MINED) whose fills were missed locally and updates them.
   */
  @Cron("*/2 * * * *")
  async reconcile(): Promise<void> {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:trade-reconciler:reconcile",
      ttlMs: 100_000,
      job: async () => {
        try {
          const users = await this.getConnectedUsersWithActiveOrders();
          const eligible = users.filter(
            (u): u is typeof u & { polymarketAddress: string } =>
              u.polymarketAddress != null,
          );

          // Parallel with concurrency limit of 5
          const CONCURRENCY = 5;
          for (let i = 0; i < eligible.length; i += CONCURRENCY) {
            await Promise.allSettled(
              eligible
                .slice(i, i + CONCURRENCY)
                .map((u) =>
                  this.reconcileUserTrades(u.id, u.polymarketAddress),
                ),
            );
          }
        } catch (err) {
          this.logger.error("Trade reconciliation failed", err);
        }
      },
    });
  }

  async reconcileUserTrades(
    userId: string,
    walletAddress: string,
  ): Promise<number> {
    let updatedCount = 0;

    try {
      const rawTrades = await this.clob.fetchTrades(walletAddress);
      const trades = rawTrades as unknown as ClobTrade[];

      // Get all active orders for this user
      const liveOrders = await this.prisma.order.findMany({
        where: {
          userId,
          status: { in: ["PENDING", "SUBMITTED", "MATCHED", "LIVE", "DELAYED", "MINED"] },
        },
      });

      if (liveOrders.length === 0) return 0;

      // Build a map of clobOrderId -> trade for quick lookup
      const tradeByOrderId = new Map<string, ClobTrade>();
      for (const trade of trades) {
        tradeByOrderId.set(trade.order_id, trade);
      }

      for (const order of liveOrders) {
        if (!order.clobOrderId) continue;

        const trade = tradeByOrderId.get(order.clobOrderId);
        if (!trade) continue;

        // If the CLOB shows the order was filled but we still have it as LIVE
        const clobStatus = trade.status?.toUpperCase();
        if (clobStatus === "MATCHED" || clobStatus === "FILLED") {
          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              status: "CONFIRMED",
              clobStatus: trade.status,
              fillPrice: trade.price,
              fillSize: trade.size,
              filledAt: new Date(trade.match_time),
            },
          });
          const copyTrade = await this.prisma.copyTrade.findFirst({
            where: { orderId: order.id },
            select: { id: true },
          });
          await this.events.emitOrderFilled(
            order.userId,
            order.id,
            trade.price,
            trade.size,
            "0",
            copyTrade?.id,
          );
          updatedCount++;
          this.logger.warn(
            `Reconciled missed fill: order=${order.id} clobOrder=${order.clobOrderId} status=LIVE->CONFIRMED`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Failed to reconcile trades for user ${userId}`, err);
    }

    return updatedCount;
  }

  private async getConnectedUsersWithActiveOrders() {
    // Find users who have active orders (PENDING, SUBMITTED, MATCHED, LIVE, DELAYED, MINED)
    const usersWithActiveOrders = await this.prisma.order.findMany({
      where: { status: { in: ["PENDING", "SUBMITTED", "MATCHED", "LIVE", "DELAYED", "MINED"] } },
      select: { userId: true },
      distinct: ["userId"],
    });

    if (usersWithActiveOrders.length === 0) return [];

    const userIds = usersWithActiveOrders.map((o) => o.userId);

    return this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        polymarketConnected: true,
        suspended: false,
        deleted: false,
      },
      select: { id: true, polymarketAddress: true },
    });
  }
}
