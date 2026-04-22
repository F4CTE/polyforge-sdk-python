import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { NotificationService } from "../notification/notification.service";

const STREAM = "stream:events";
const GROUP = "notification-service";
const CONSUMER = `notif-${process.pid}`;

/**
 * Maps stream:events types to the canonical event type used by NotificationService.
 * Returns null for events that don't produce notifications.
 */
function toNotifType(
  streamType: string,
  data: Record<string, string>,
): string | null {
  switch (streamType) {
    case "ORDER_FILLED":
      return "ORDER_FILLED";
    case "STRATEGY_ERROR":
      return "STRATEGY_ERROR";
    case "BACKTEST_PROGRESS":
      // Only notify when progress reaches 100 (i.e. backtest complete)
      return data.progress === "100" ? "BACKTEST_COMPLETE" : null;
    case "PRICE_ALERT_TRIGGERED":
      return "PRICE_ALERT";
    case "DAILY_LOSS_TRIGGERED":
      return "DAILY_LOSS_LIMIT";
    case "MARKET_RESOLVED":
      return "MARKET_RESOLVED";
    case "STRATEGY_FORKED":
      return "SOMEONE_FORKED";
    case "USER_FOLLOWED":
      return "SOMEONE_FOLLOWED";
    case "STRATEGY_LIKED":
      return "SOMEONE_LIKED";
    case "STRATEGY_COMMENTED":
      return "SOMEONE_COMMENTED";
    case "NEWS_SIGNAL":
      return "NEWS_SIGNAL";
    case "ARBITRAGE_OPPORTUNITY":
      return "ARBITRAGE_OPPORTUNITY";
    case "ARBITRAGE_CROSS_VENUE":
      return "ARBITRAGE_CROSS_VENUE";
    default:
      return null;
  }
}

@Injectable()
export class EventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly notification: NotificationService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    this.loopPromise = this.consumeLoop();
    this.logger.log("Events consumer started");
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
      this.logger.log(`Consumer group '${GROUP}' created on ${STREAM}`);
    } catch (err: any) {
      if (!err.message?.includes("BUSYGROUP")) throw err;
    }
  }

  private async consumeLoop() {
    const client = this.redis.getClient();
    while (this.running) {
      try {
        const results: any = await client.xreadgroup(
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

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const event = this.parseFields(fields);
            const notifType = toNotifType(event.type ?? "", event);

            if (notifType) {
              try {
                await this.notification.handle(notifType, event);
              } catch (err) {
                this.logger.error(
                  `Failed to handle notification ${notifType} for user ${event.userId}`,
                  err,
                );
              }
            }

            await client.xack(STREAM, GROUP, id);
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error("stream:events consume error", err?.message);
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
}
