import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import {
  PelReclaimService,
  RedisService,
  StreamMonitorService,
} from "@polyforge/shared-redis";
import { NotificationService, LockContentionError } from "../notification/notification.service";

const STREAM = "stream:events";
const DLQ_STREAM = "stream:events:dlq";
const GROUP = "notification-service";
const CONSUMER = `notif-${process.pid}`;
const PEL_MIN_IDLE_MS = 30_000;

/** Maximum processing attempts before moving to DLQ. */
const MAX_RETRIES = 3;

/** TTL (seconds) for retry counters — long enough to span reclaim cycles. */
const RETRY_TTL = 86_400; // 24h

const RETRY_KEY = (msgId: string) => `notif:retry:${STREAM}:${msgId}`;

/**
 * Lua script for atomic DLQ transfer: XADD to DLQ first to preserve the
 * message, then XACK from the main stream.  XACK is gated on the entry
 * still being in the PEL — returning 0 when already acknowledged prevents
 * dead-lettering an already-processed message under reclaim/concurrency races.
 *
 * Order matters: writing to DLQ before XACK ensures the message is never
 * lost.  When XACK returns 0 (already processed elsewhere), the just-written
 * DLQ entry is cleaned up via XDEL to avoid false DLQ failures.
 */
const DLQ_MOVE_LUA = `
local dlqId = redis.call('XADD', KEYS[1], '*', unpack(ARGV, 2))
local ackCount = redis.call('XACK', KEYS[2], KEYS[3], ARGV[1])
if ackCount == 0 then
  redis.call('XDEL', KEYS[1], dlqId)
  redis.call('DEL', KEYS[4])
  return 0
end
redis.call('DEL', KEYS[4])
return 1
`;

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
    case "TICKET_REPLY":
      return "TICKET_REPLY";
    case "TICKET_CLOSED":
      return "TICKET_CLOSED";
    case "NEWS_SIGNAL":
      return "NEWS_SIGNAL";
    case "ARBITRAGE_OPPORTUNITY":
      return "ARBITRAGE_OPPORTUNITY";
    case "ARBITRAGE_CROSS_VENUE":
      return "ARBITRAGE_CROSS_VENUE";
    case "NOTIFICATION":
      return null; // prevent self-amplification: do not re-process in-app notifications
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
    private readonly streamMonitor: StreamMonitorService,
    private readonly pelReclaim: PelReclaimService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.streamMonitor.register({ stream: STREAM, group: GROUP });
    this.pelReclaim.register({
      stream: STREAM,
      group: GROUP,
      consumer: CONSUMER,
      minIdleMs: PEL_MIN_IDLE_MS,
      handler: async (entry) => {
        const event = entry.fields;
        const notifType = toNotifType(event.type ?? "", event);
        if (notifType) {
          const consumed = await this.handleWithRetry(
            entry.id,
            notifType,
            event,
          );
          if (!consumed) {
            // Message needs further retries — prevent PelReclaimService
            // from ACKing so it remains in PEL for the next reclaim cycle.
            throw new Error(
              `Notification ${notifType} msg=${entry.id} pending retry in PEL`,
            );
          }
        }
      },
    });
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
      const wasRunning = this.running;
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

            if (!notifType) {
              await client.xack(STREAM, GROUP, id);
              continue;
            }

            await this.handleWithRetry(id, notifType, event);
          }
        }
      } catch (err) {
        if (wasRunning) {
          this.logger.error(
            {
              event: "STREAM_CONSUME_ERROR",
              stream: STREAM,
              group: GROUP,
              consumer: CONSUMER,
              err,
            },
            "stream:events consume error",
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  /**
   * Process a notification event with retry tracking. Returns true when the
   * message has been fully consumed (XACKed or moved to DLQ). Returns false
   * when processing failed but further retries remain — callers that rely on
   * automatic ACK (e.g. PelReclaimService) must NOT ack when false is returned.
   *
   * Handler delivery failures (e.g. template render, SMTP timeout) increment
   * the per-message retry counter and may trigger DLQ after MAX_RETRIES.
   * Post-delivery XACK failures are logged and return true — the notification
   * was delivered, so a failed XACK must not create a spurious DLQ entry or
   * inflate the retry counter.
   */
  private async handleWithRetry(
    msgId: string,
    notifType: string,
    event: Record<string, string>,
  ): Promise<boolean> {
    const client = this.redis.getClient();

    // ── Phase 1: Handler delivery ──────────────────────────────────────
    try {
      await this.notification.handle(notifType, event, msgId);
    } catch (err) {
      // Lock contention: another worker holds the delivery lock.
      // Do NOT XACK, increment retries, or move to DLQ.  Return false
      // so the message stays in PEL until the lock-holder finishes or
      // the short TTL expires and reclaim retries the entry.
      if (err instanceof LockContentionError) {
        this.logger.debug(
          `Lock contention for ${msgId} (${notifType}) — ` +
            `leaving in PEL for lock holder or next reclaim cycle`,
        );
        return false;
      }

      this.logger.error(
        {
          event: "NOTIFICATION_HANDLE_FAILED",
          notifType,
          userId: event.userId,
          stream: STREAM,
          msgId,
          err,
        },
        "Failed to handle stream notification",
      );

      // Increment retry counter
      const retryKey = RETRY_KEY(msgId);
      let retries: number;
      try {
        retries = await client.incr(retryKey);
        await client.expire(retryKey, RETRY_TTL);
      } catch (redisErr: any) {
        this.logger.error(
          `Failed to track retry for ${msgId}: ${redisErr?.message}`,
        );
        // Without retry tracking we cannot decide — leave in PEL for safety
        return false;
      }

      this.logger.warn(
        `Notification ${notifType} msg=${msgId} retry ${retries}/${MAX_RETRIES}`,
      );

      if (retries >= MAX_RETRIES) {
        const moved = await this.moveToDlq(msgId, notifType, event, retries);
        return moved;
      }
      // else: leave un-XACKed in PEL for PelReclaimService to retry
      return false;
    }

    // ── Phase 2: XACK (post-delivery) ──────────────────────────────────
    try {
      await client.xack(STREAM, GROUP, msgId);
    } catch (xackErr: any) {
      this.logger.warn(
        `XACK failed for ${msgId} (${notifType}) after successful delivery — ` +
          `message may be reclaimed; idempotency guard prevents double-send`,
      );
      // Return true: notification was delivered.  A failed XACK must NOT
      // increment the retry counter or create a spurious DLQ entry.
      return true;
    }

    return true;
  }

  /**
   * Atomically XACK the message from the main stream and write it to the DLQ
   * stream using a Lua script so that partial failures (e.g. DLQ write succeeds
   * but XACK fails) do not leave the message in PEL with a duplicate DLQ entry.
   * Returns true when the atomic move succeeded.
   */
  private async moveToDlq(
    msgId: string,
    notifType: string,
    event: Record<string, string>,
    retries: number,
  ): Promise<boolean> {
    const client = this.redis.getClient();

    try {
      const fields: Record<string, string> = {
        originalId: msgId,
        type: event.type ?? notifType,
        notifType,
        userId: event.userId ?? "",
        ...event,
        dlqReason: `Exceeded ${retries} retries`,
        dlqTs: String(Date.now()),
      };

      const fieldArgs: string[] = [];
      for (const [key, value] of Object.entries(fields)) {
        fieldArgs.push(key, value);
      }

      // Atomic: XACK main stream (verified in Lua) + XADD DLQ + DEL retry key
      const moved = (await client.eval(
        DLQ_MOVE_LUA,
        4,
        DLQ_STREAM,
        STREAM,
        GROUP,
        RETRY_KEY(msgId),
        msgId,
        ...fieldArgs,
      )) as number;

      if (moved === 0) {
        this.logger.warn(
          {
            event: "DLQ_MOVE_DISCARDED",
            notifType,
            userId: event.userId,
            stream: STREAM,
            msgId,
            reason:
              "XACK returned 0 — entry no longer in PEL (already acknowledged)",
          },
          "DLQ move skipped: message already acknowledged elsewhere",
        );
        return true; // message was already processed — treat as consumed
      }

      this.logger.warn(
        {
          event: "NOTIFICATION_MOVED_TO_DLQ",
          notifType,
          userId: event.userId,
          stream: STREAM,
          dlqStream: DLQ_STREAM,
          msgId,
          retries,
        },
        `Notification moved to DLQ after ${retries} failed attempts`,
      );
      return true;
    } catch (dlqErr: any) {
      this.logger.error(
        {
          event: "DLQ_WRITE_FAILED",
          stream: STREAM,
          dlqStream: DLQ_STREAM,
          msgId,
          err: dlqErr,
        },
        "Failed to move notification to DLQ — message stays in PEL",
      );
      return false;
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
