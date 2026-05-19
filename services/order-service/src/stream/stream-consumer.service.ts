import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PelReclaimService,
  reclaimPendingEntries,
  RedisService,
  StreamMonitorService,
} from "@polyforge/shared-redis";
import { StreamOrderIntentSchema } from "@polyforge/shared-schemas";
import {
  CancellationIntent,
  OrdersService,
  OrderIntent,
} from "../orders/orders.service";

const STREAM = "stream:orders";
const CANCELLATION_STREAM = "stream:cancellations";
const GROUP = "order-service";
const CONSUMER = `order-service-${process.pid}`;
const BLOCK_MS = 2_000; // block XREADGROUP for 2s
const BATCH_COUNT = 50; // read up to 50 messages per poll
const PEL_MIN_IDLE_MS = 30_000;
const DEFAULT_PEL_MIN_IDLE_MS = 5 * 60_000;
const DECIMAL_6_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

function decimalToUnits(value: string): bigint | null {
  if (!DECIMAL_6_RE.test(value)) return null;

  const [integer, fractional = ""] = value.split(".");
  return BigInt(integer) * 1_000_000n + BigInt(fractional.padEnd(6, "0"));
}

function isPositiveDecimal(value: string): boolean {
  const units = decimalToUnits(value);
  return units !== null && units > 0n;
}

function isPriceInRange(value: string): boolean {
  const units = decimalToUnits(value);
  return units !== null && units > 0n && units <= 1_000_000n;
}

/**
 * Reads OrderIntents from `stream:orders` using Redis Consumer Groups.
 * Ensures at-least-once delivery with manual ACK after successful processing.
 *
 * Consumer group is created if it doesn't exist (MKSTREAM = create stream too).
 */
@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamConsumerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    private readonly streamMonitor: StreamMonitorService,
    private readonly pelReclaim: PelReclaimService,
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup(STREAM);
    await this.ensureConsumerGroup(CANCELLATION_STREAM);
    this.streamMonitor.register({ stream: STREAM, group: GROUP });
    this.streamMonitor.register({ stream: CANCELLATION_STREAM, group: GROUP });
    this.pelReclaim.register({
      stream: STREAM,
      group: GROUP,
      consumer: CONSUMER,
      minIdleMs: PEL_MIN_IDLE_MS,
      handler: async (entry) => {
        await this.processReclaimedEntry(entry.id, entry.fields);
        return false;
      },
    });
    this.pelReclaim.register({
      stream: CANCELLATION_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      handler: async (entry) => {
        const intent = this.parseCancellation(this.fieldsToArray(entry.fields));
        if (!intent) {
          await this.redis
            .getClient()
            .xack(CANCELLATION_STREAM, GROUP, entry.id);
          return false;
        }

        await this.orders.processCancellation(intent);
        await this.redis.getClient().xack(CANCELLATION_STREAM, GROUP, entry.id);
        return false;
      },
    });
    try {
      await this.reclaimPendingOnStartup();
    } catch (err) {
      this.logger.error(
        "Startup PEL reclaim failed, continuing boot — periodic reclaim will retry",
        err,
      );
    }
    this.running = true;
    this.loopPromise = this.consumeLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loopPromise;
  }

  // ─── Consumer group setup ─────────────────────────────────────────────────

  private async ensureConsumerGroup(stream: string) {
    const client = this.redis.getClient();
    try {
      await client.xgroup("CREATE", stream, GROUP, "$", "MKSTREAM");
      this.logger.log(
        `Consumer group '${GROUP}' created on stream '${stream}'`,
      );
    } catch (err: any) {
      if (err?.message?.includes("BUSYGROUP")) {
        // Group already exists — that's fine
      } else {
        throw err;
      }
    }
  }

  // ─── Main loop ───────────────────────────────────────────────────────────

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        this.logger.error("Stream consumer error", err);
        await this.sleep(1_000); // brief pause on unexpected errors
      }
    }
  }

  private async pollOnce(): Promise<void> {
    await this.pollOrderIntentsOnce();
    await this.pollCancellationsOnce();
  }

  private async pollOrderIntentsOnce(): Promise<void> {
    const client = this.redis.getClient();

    // '>' means "only new messages not yet delivered to this consumer"
    const results = (await client.xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "COUNT",
      BATCH_COUNT,
      "BLOCK",
      BLOCK_MS,
      "STREAMS",
      STREAM,
      ">",
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!results) return; // timeout or empty

    const [, entries] = results[0];
    if (!entries?.length) return;

    // Group intents by userId for batching
    const byUser = new Map<
      string,
      Array<{ msgId: string; intent: OrderIntent }>
    >();

    for (const [msgId, fields] of entries) {
      const intent = this.parseIntent(fields, msgId);
      if (!intent) {
        await client.xack(STREAM, GROUP, msgId);
        continue;
      }

      if (!byUser.has(intent.userId)) {
        byUser.set(intent.userId, []);
      }
      byUser.get(intent.userId)!.push({ msgId, intent });
    }

    // Process each user's batch concurrently (different users are independent)
    await Promise.allSettled(
      [...byUser.entries()].map(async ([, items]) => {
        const intents = items.map((i) => i.intent);
        const result = await this.orders.processBatch(intents);
        const failedIntents = new Set(result.failed.map((i) => i.intent));
        if (failedIntents.size > 0) {
          this.logger.error(
            `Leaving ${failedIntents.size} order stream message(s) unacked after processing failure`,
          );
        }

        // ACK only messages whose processing completed. DLQ write failures stay
        // pending so Redis can redeliver/reclaim the original stream entry.
        const msgIds = items
          .filter((i) => !failedIntents.has(i.intent))
          .map((i) => i.msgId);
        if (msgIds.length > 0) {
          await client.xack(STREAM, GROUP, ...msgIds);
        }
      }),
    );
  }

  private async pollCancellationsOnce(): Promise<void> {
    const client = this.redis.getClient();

    const results = (await client.xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "COUNT",
      BATCH_COUNT,
      "BLOCK",
      BLOCK_MS,
      "STREAMS",
      CANCELLATION_STREAM,
      ">",
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!results) return;

    const [, entries] = results[0];
    if (!entries?.length) return;

    for (const [msgId, fields] of entries) {
      const intent = this.parseCancellation(fields);
      if (!intent) {
        await client.xack(CANCELLATION_STREAM, GROUP, msgId);
        continue;
      }

      await this.orders.processCancellation(intent);
      await client.xack(CANCELLATION_STREAM, GROUP, msgId);
    }
  }

  private async reclaimPendingOnStartup(): Promise<void> {
    const minIdleMs =
      this.config.get<number>("ORDER_STREAM_PEL_MIN_IDLE_MS") ??
      DEFAULT_PEL_MIN_IDLE_MS;

    let cursor = "0-0";
    while (true) {
      const result = await reclaimPendingEntries(
        this.redis.getClient(),
        STREAM,
        GROUP,
        CONSUMER,
        minIdleMs,
        BATCH_COUNT,
        cursor,
      );

      for (const entry of result.entries) {
        try {
          await this.processReclaimedEntry(entry.id, entry.fields);
        } catch (err) {
          this.logger.error(
            `Startup PEL reclaim failed for entry ${entry.id}, leaving in PEL for periodic retry`,
            err,
          );
        }
      }

      cursor = result.nextCursor;
      if (cursor === "0-0") break;
    }
  }

  private async processReclaimedEntry(
    msgId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    const client = this.redis.getClient();
    const intent = this.parseIntent(this.fieldsToArray(fields), msgId);
    if (!intent) {
      await client.xack(STREAM, GROUP, msgId);
      return;
    }

    const result = await this.orders.processBatch([intent], {
      reclaimed: true,
    });
    if (result.failed.length > 0) {
      const errors = result.failed.map((f) => String(f.error)).join("; ");
      throw new Error(
        `Reclaimed order stream message ${msgId} processing failed: ${errors}`,
      );
    }

    await client.xack(STREAM, GROUP, msgId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private parseIntent(fields: string[], msgId = "unknown"): OrderIntent | null {
    const obj: Record<string, string> = {};
    try {
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }

      const schemaResult = StreamOrderIntentSchema.safeParse(obj);
      if (!schemaResult.success) {
        this.logger.warn(
          {
            event: "ORDER_INTENT_SCHEMA_MISMATCH",
            stream: STREAM,
            msgId,
            issues: schemaResult.error.issues,
            fields: obj,
          },
          "Order intent failed shared-schema validation",
        );
      }

      if (!obj["intentId"] || !obj["userId"]) {
        this.logDroppedIntent(msgId, "missing_required_fields", obj);
        return null;
      }
      const expiration = this.parseExpiration(obj["expiration"]);
      if (expiration === null) {
        this.logDroppedIntent(msgId, "invalid_expiration", obj);
        return null;
      }
      const size = obj["size"] ?? "0";
      const price = obj["price"] ?? "0";
      if (!isPositiveDecimal(size)) {
        this.logDroppedIntent(msgId, "invalid_size", obj);
        return null;
      }
      if (!isPriceInRange(price)) {
        this.logDroppedIntent(msgId, "invalid_price", obj);
        return null;
      }

      return {
        intentId: obj["intentId"],
        ...(obj["orderId"] ? { orderId: obj["orderId"] } : {}),
        userId: obj["userId"],
        ...(obj["strategyId"]?.trim()
          ? { strategyId: obj["strategyId"].trim() }
          : {}),
        ...(obj["copyTradeId"] ? { copyTradeId: obj["copyTradeId"] } : {}),
        marketId: obj["marketId"] ?? "",
        tokenId: obj["tokenId"] ?? "",
        side: (obj["side"] as "BUY" | "SELL") ?? "BUY",
        outcome: obj["outcome"] ?? "YES",
        size,
        price,
        orderType:
          (obj["orderType"] as OrderIntent["orderType"] | undefined) ?? "GTC",
        expiration,
        ...(obj["venue"]
          ? { venue: obj["venue"] as OrderIntent["venue"] }
          : {}),
        ...(obj["kalshiSubaccount"]
          ? { kalshiSubaccount: parseInt(obj["kalshiSubaccount"], 10) }
          : {}),
      };
    } catch (err) {
      this.logDroppedIntent(msgId, "parse_error", obj, err);
      return null;
    }
  }

  private logDroppedIntent(
    msgId: string,
    reason: string,
    fields: Record<string, string>,
    err?: unknown,
  ): void {
    this.logger.warn(
      {
        event: "ORDER_INTENT_DROPPED",
        stream: STREAM,
        group: GROUP,
        consumer: CONSUMER,
        msgId,
        reason,
        fields,
      },
      "Dropped invalid order intent from Redis stream",
    );
    if (err) {
      this.logger.error(
        {
          event: "ORDER_INTENT_PARSE_ERROR",
          stream: STREAM,
          msgId,
          err,
        },
        "Failed to parse order intent from Redis stream",
      );
    }
  }

  private parseCancellation(fields: string[]): CancellationIntent | null {
    try {
      const obj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }

      if (!obj["orderId"] || !obj["userId"]) return null;

      return {
        orderId: obj["orderId"],
        userId: obj["userId"],
        ...(obj["clobOrderId"] ? { clobOrderId: obj["clobOrderId"] } : {}),
        ...(obj["venueOrderId"] ? { venueOrderId: obj["venueOrderId"] } : {}),
      };
    } catch {
      return null;
    }
  }

  private parseExpiration(
    value: string | undefined,
  ): number | undefined | null {
    if (value === undefined || value === "" || value === "0") return undefined;
    const expiration = Number(value);
    if (!Number.isFinite(expiration) || expiration < 0) return null;
    return expiration;
  }

  private fieldsToArray(fields: Record<string, string>): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(fields)) {
      out.push(k, v);
    }
    return out;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
