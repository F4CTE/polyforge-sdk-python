import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import {
  PelReclaimService,
  RedisService,
  StreamMonitorService,
} from "@polyforge/shared-redis";
import { WebhooksService } from "../webhooks/webhooks.service";
import { EventsGateway } from "./events.gateway";
import { StrategyEventsService } from "./strategy-events.service";

const STREAM = "stream:events";
const GROUP = "api-service";
const CONSUMER = `api-${process.pid}`;
const PEL_MIN_IDLE_MS = 30_000;

/**
 * Consumes stream:events from Redis and dispatches to connected WebSocket clients.
 *
 * Also reads cache:price:* to forward price updates to PRICE subscriptions.
 * Note: price updates come from stream:events type == PRICE_UPDATE or from a
 * separate market-data sub-channel. For now, we relay any events in stream:events
 * that match the WebSocket protocol.
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
    private readonly strategyEvents: StrategyEventsService,
    private readonly webhooks: WebhooksService,
    private readonly streamMonitor?: StreamMonitorService,
    private readonly pelReclaim?: PelReclaimService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.streamMonitor?.register({ stream: STREAM, group: GROUP });
    this.pelReclaim?.register({
      stream: STREAM,
      group: GROUP,
      consumer: CONSUMER,
      minIdleMs: PEL_MIN_IDLE_MS,
      handler: (entry) => {
        this.dispatch(entry.fields);
      },
    });
    this.running = true;
    this.loopPromise = this.consumeLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loopPromise;
  }

  private async ensureGroup() {
    try {
      await this.redis
        .getClient()
        .xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message.includes("BUSYGROUP"))
        throw err;
    }
  }

  private async consumeLoop() {
    while (this.running) {
      try {
        const results = await this.redis
          .getClient()
          .xreadgroup(
            "GROUP",
            GROUP,
            CONSUMER,
            "COUNT",
            "100",
            "BLOCK",
            "2000",
            "STREAMS",
            STREAM,
            ">",
          );

        if (!results) continue;

        for (const [, messages] of results as [
          string,
          [string, string[]][],
        ][]) {
          for (const [id, fields] of messages) {
            const event = this.parseFields(fields);
            this.dispatch(event);
            await this.redis.getClient().xack(STREAM, GROUP, id);
          }
        }
      } catch (err: unknown) {
        if (this.running) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.error("stream:events consume error", errMsg);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private parseFields(fields: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }

  private dispatchWhaleWebhooks(
    walletAddress: string,
    data: Record<string, string>,
  ) {
    if (!walletAddress) return;
    this.prisma.whaleFollow
      .findMany({
        where: { walletAddress },
        select: { userId: true },
      })
      .then((followers) => {
        for (const { userId } of followers) {
          this.webhooks
            .dispatch(userId, "WHALE_TRADE", {
              walletAddress,
              ...data,
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.warn(`Whale webhook dispatch failed: ${msg}`);
            });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to fetch whale followers: ${msg}`);
      });
  }

  private dispatch(event: Record<string, string>) {
    const { type, strategyId, userId, orderId, tokenId, reason, ...rest } =
      event;
    if (!type) return;

    // Fan-out to SSE strategy-event subscribers for any event that carries a strategyId
    if (strategyId) {
      this.strategyEvents.emit(strategyId, type, {
        userId,
        orderId,
        tokenId,
        reason,
        ...rest,
      });
    }

    switch (type) {
      case "PRICE_UPDATE":
        if (tokenId) {
          this.gateway.pushPriceUpdate(
            tokenId,
            parseFloat(rest.price ?? "0"),
            parseInt(rest.ts ?? "0", 10),
          );
        }
        break;

      case "STRATEGY_STARTED":
      case "STRATEGY_STOPPED":
      case "STRATEGY_PAUSED":
      case "STRATEGY_RESUMED":
      case "STRATEGY_ERROR":
        if (strategyId && userId) {
          this.gateway.pushStrategyEvent(strategyId, userId, type, { reason });
        }
        break;

      case "ORDER_PLACED":
      case "ORDER_SUBMITTED":
      case "ORDER_FILLED":
      case "ORDER_PARTIAL":
      case "ORDER_CANCELLED":
      case "ORDER_FAILED":
      case "ORDER_ERROR":
        if (userId) {
          this.gateway.pushOrderEvent(userId, type, { orderId, ...rest });
        }
        break;

      case "BACKTEST_PROGRESS":
      case "BACKTEST_COMPLETED":
      case "BACKTEST_FAILED":
        if (userId) {
          this.gateway.pushOrderEvent(userId, type, rest);
        }
        break;

      case "PRICE_ALERT_TRIGGERED":
        if (userId) {
          this.gateway.pushOrderEvent(userId, type, { tokenId, ...rest });
        }
        break;

      case "WHALE_TRADE":
        this.gateway.pushWhaleTrade({
          ...rest,
          walletAddress: rest.walletAddress,
        });
        this.dispatchWhaleWebhooks(rest.walletAddress ?? "", rest);
        break;

      case "NEWS_SIGNAL":
        this.gateway.pushNewsSignal(rest);
        break;

      case "NOTIFICATION":
        if (userId) {
          this.gateway.pushNotification(userId, rest);
        }
        break;

      default:
        // Unknown event types are silently ignored
        break;
    }
  }
}
