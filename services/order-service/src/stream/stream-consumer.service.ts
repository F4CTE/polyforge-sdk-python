import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { OrdersService, OrderIntent } from "../orders/orders.service";

const STREAM = "stream:orders";
const GROUP = "order-service";
const CONSUMER = `order-service-${process.pid}`;
const BLOCK_MS = 2_000; // block XREADGROUP for 2s
const BATCH_COUNT = 50; // read up to 50 messages per poll

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
  ) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.running = true;
    this.loopPromise = this.consumeLoop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  // ─── Consumer group setup ─────────────────────────────────────────────────

  private async ensureConsumerGroup() {
    const client = this.redis.getClient();
    try {
      await client.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
      this.logger.log(
        `Consumer group '${GROUP}' created on stream '${STREAM}'`,
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
      const intent = this.parseIntent(fields);
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
        await this.orders.processBatch(intents);

        // ACK all messages for this user after batch attempt
        const msgIds = items.map((i) => i.msgId);
        await client.xack(STREAM, GROUP, ...msgIds);
      }),
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private parseIntent(fields: string[]): OrderIntent | null {
    try {
      const obj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }

      if (!obj["intentId"] || !obj["userId"]) return null;

      return {
        intentId: obj["intentId"],
        userId: obj["userId"],
        strategyId: obj["strategyId"] ?? "",
        marketId: obj["marketId"] ?? "",
        tokenId: obj["tokenId"] ?? "",
        side: (obj["side"] as "BUY" | "SELL") ?? "BUY",
        outcome: obj["outcome"] ?? "YES",
        size: obj["size"] ?? "0",
        price: obj["price"] ?? "0",
        orderType: (obj["orderType"] as "GTC" | "FOK" | "GTD") ?? "GTC",
        expiration: obj["expiration"]
          ? parseInt(obj["expiration"], 10)
          : undefined,
      };
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
