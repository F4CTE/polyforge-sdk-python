import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { ClobClientService } from "../clob-client/clob-client.service";

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
    private readonly clob: ClobClientService,
  ) {}

  /**
   * Every 2 minutes, reconcile local order statuses against Polymarket CLOB trades.
   * Finds orders with LIVE status whose fills were missed locally and updates them.
   */
  @Cron("*/2 * * * *")
  async reconcile(): Promise<void> {
    try {
      const users = await this.getConnectedUsersWithLiveOrders();

      for (const user of users) {
        if (!user.walletAddress) continue;
        await this.reconcileUserTrades(user.id, user.walletAddress);
      }
    } catch (err) {
      this.logger.error("Trade reconciliation failed", err);
    }
  }

  async reconcileUserTrades(
    userId: string,
    walletAddress: string,
  ): Promise<number> {
    let updatedCount = 0;

    try {
      const trades = await this.clob.fetchTrades(walletAddress);

      // Get all LIVE orders for this user
      const liveOrders = await this.prisma.order.findMany({
        where: { userId, status: "LIVE" },
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
            data: { status: "CONFIRMED", clobStatus: trade.status },
          });
          updatedCount++;
          this.logger.warn(
            `Reconciled missed fill: order=${order.id} clobOrder=${order.clobOrderId} status=LIVE->CONFIRMED`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to reconcile trades for user ${userId}`,
        err,
      );
    }

    return updatedCount;
  }

  private async getConnectedUsersWithLiveOrders() {
    // Find users who have LIVE orders and are connected to Polymarket
    const usersWithLiveOrders = await this.prisma.order.findMany({
      where: { status: "LIVE" },
      select: { userId: true },
      distinct: ["userId"],
    });

    if (usersWithLiveOrders.length === 0) return [];

    const userIds = usersWithLiveOrders.map((o) => o.userId);

    return this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        polymarketConnected: true,
        suspended: false,
        deleted: false,
      },
      select: { id: true, walletAddress: true },
    });
  }
}
