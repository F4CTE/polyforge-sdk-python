import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { EventsGateway } from "../gateway/events.gateway";
import { CreateAlertDto } from "./dto/create-alert.dto";

const MAX_ALERTS = 50;

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: EventsGateway,
  ) {}

  onModuleInit() {
    // Check alerts every 15 seconds
    this.checkInterval = setInterval(() => {
      this.checkAndFireAlerts().catch((err: unknown) => {
        this.logger.error("checkAndFireAlerts error", err);
      });
    }, 15_000);
  }

  /** Check all untriggered alerts against current Redis prices */
  async checkAndFireAlerts(): Promise<void> {
    try {
      const alerts = await this.prisma.priceAlert.findMany({
        where: { triggered: false },
      });
      if (!alerts.length) return;

      // Batch-fetch prices from Redis
      const tokenIds = [...new Set(alerts.map((a) => a.tokenId))];

      const priceKeys = tokenIds.map((id) => `cache:price:${id}`);
      const priceValues = await this.redis.getClient().mget(...priceKeys);
      const priceMap = new Map<string, number>();
      tokenIds.forEach((id, i) => {
        const raw = priceValues[i];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const price = parseFloat(parsed.price ?? parsed ?? "0");
            if (!isNaN(price)) priceMap.set(id, price);
          } catch {
            // no-op
          }
        }
      });

      const toTrigger: string[] = [];

      for (const alert of alerts) {
        const currentPrice = priceMap.get(alert.tokenId);
        if (currentPrice === undefined) continue;

        const threshold = parseFloat(String(alert.price));
        const fired =
          alert.direction === "above"
            ? currentPrice >= threshold
            : currentPrice <= threshold;

        if (!fired) continue;

        toTrigger.push(alert.id);

        // Push WebSocket notification to the alert owner
        this.gateway.pushNotification(alert.userId, {
          type: "PRICE_ALERT",
          alertId: alert.id,
          tokenId: alert.tokenId,
          direction: alert.direction,
          threshold: String(alert.price),
          currentPrice: currentPrice.toFixed(4),
          message: `Price alert: token is ${alert.direction} ${threshold.toFixed(4)} (now ${currentPrice.toFixed(4)})`,
        });
      }

      if (toTrigger.length > 0) {
        await this.prisma.priceAlert.updateMany({
          where: { id: { in: toTrigger } },
          data: { triggered: true },
        });
        await this.prisma.priceAlert.deleteMany({
          where: { id: { in: toTrigger }, persistent: false },
        });
        this.logger.log(`Fired ${toTrigger.length} price alert(s)`);
      }
    } catch (err) {
      this.logger.warn(`Alert check failed: ${(err as Error).message}`);
    }
  }

  async list(userId: string): Promise<any[]> {
    return this.prisma.priceAlert.findMany({
      where: { userId, triggered: false },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateAlertDto): Promise<any> {
    const count = await this.prisma.priceAlert.count({
      where: { userId, triggered: false },
    });
    if (count >= MAX_ALERTS) {
      throw new UnprocessableEntityException({
        code: "ALERT_LIMIT_REACHED",
        message: "Maximum 50 alerts allowed",
      });
    }

    return this.prisma.priceAlert.create({
      data: {
        userId,
        tokenId: dto.tokenId,
        direction: dto.direction as any,
        price: dto.price,
        persistent: dto.persistent ?? false,
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Alert not found",
      });
    if (alert.userId !== userId)
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    await this.prisma.priceAlert.delete({ where: { id } });
  }
}
