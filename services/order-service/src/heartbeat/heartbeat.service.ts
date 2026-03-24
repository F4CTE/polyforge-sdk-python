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
    this.interval = setInterval(() => this.sendHeartbeat(), 30_000);
    this.logger.log("Heartbeat service started (30s interval)");
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async sendHeartbeat(): Promise<void> {
    const liveOrders = await this.prisma.order.findMany({
      where: { status: "LIVE", orderType: "GTC" },
      select: { clobOrderId: true, userId: true },
    });

    if (liveOrders.length === 0) return;

    const clobUrl =
      this.config.get<string>("CLOB_API_URL") ?? "http://mock-polymarket:3099";

    const orderIds = liveOrders
      .map((o) => o.clobOrderId)
      .filter(Boolean) as string[];

    if (orderIds.length === 0) return;

    try {
      const res = await fetch(`${clobUrl}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        this.logger.debug(`Heartbeat sent for ${orderIds.length} orders`);
      } else {
        this.logger.warn(`Heartbeat failed: ${res.status}`);
      }
    } catch (err: unknown) {
      this.logger.error(`Heartbeat error: ${(err as Error).message}`);
    }
  }
}
