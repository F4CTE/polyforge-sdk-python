import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => this.sendHeartbeats(), 30_000);
    this.logger.log("Heartbeat service started (30s interval)");
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  /**
   * Sends per-user heartbeats to the Polymarket CLOB API.
   *
   * Each user needs their own L2 HMAC auth headers, so we:
   * 1. Find distinct userIds with LIVE GTC or GTD orders
   * 2. For each user, fetch their CLOB credentials
   * 3. Send heartbeat with that user's L2 auth headers
   */
  async sendHeartbeats(): Promise<void> {
    const liveOrders = await this.prisma.order.findMany({
      where: {
        status: "LIVE",
        orderType: { in: ["GTC", "GTD"] },
      },
      select: { clobOrderId: true, userId: true },
    });

    if (liveOrders.length === 0) return;

    // Group orders by userId for per-user heartbeats
    const ordersByUser = new Map<string, string[]>();
    for (const o of liveOrders) {
      if (!o.clobOrderId) continue;
      const existing = ordersByUser.get(o.userId) ?? [];
      existing.push(o.clobOrderId);
      ordersByUser.set(o.userId, existing);
    }

    if (ordersByUser.size === 0) return;

    const clobUrl =
      this.config.get<string>("CLOB_API_URL") ?? "http://mock-polymarket:3099";
    const signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";

    // Parallel with concurrency limit of 5
    const entries = [...ordersByUser.entries()];
    const CONCURRENCY = 5;
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      await Promise.allSettled(
        entries.slice(i, i + CONCURRENCY).map(async ([userId, orderIds]) => {
          try {
            const l2Headers = await this.fetchUserL2Headers(signerUrl, userId);
            const res = await fetch(`${clobUrl}/heartbeats`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...l2Headers },
              body: JSON.stringify({ orderIds }),
              signal: AbortSignal.timeout(10_000),
            });
            if (res.ok) {
              this.logger.debug(`Heartbeat sent for user=${userId} orders=${orderIds.length}`);
            } else {
              this.logger.warn(`Heartbeat failed for user=${userId}: ${res.status}`);
            }
          } catch (err: unknown) {
            this.logger.error(`Heartbeat error for user=${userId}: ${(err as Error).message}`);
          }
        }),
      );
    }
  }

  /**
   * Fetch L2 HMAC authentication headers for a specific user.
   * These headers are required by the Polymarket CLOB API for heartbeats.
   */
  private async fetchUserL2Headers(
    signerUrl: string,
    userId: string,
  ): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${signerUrl}/internal/l2-headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(5_000),
      });

      if (res.ok) {
        return (await res.json()) as Record<string, string>;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to fetch L2 headers for user=${userId}: ${(err as Error).message}`,
      );
    }

    // Return empty headers as fallback (heartbeat will likely fail auth but won't crash)
    return {};
  }
}
