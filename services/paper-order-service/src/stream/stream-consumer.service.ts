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
import { FillsService, OrderIntent } from "../fills/fills.service";

const STREAM = "stream:paper_orders";
const GROUP = "paper-order-service";
const CONSUMER = `paper-${process.pid}`;
const DLQ_STREAM = "stream:paper_orders:dlq";
const MAX_RETRIES = 3;
const RETRY_KEY = (id: string) => `paper:retry:${id}`;
const RETRY_TTL = 3600;

@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamConsumerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly fills: FillsService,
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
      minIdleMs: 30_000,
      handler: async (entry) => {
        const intent = entry.fields as unknown as OrderIntent;
        try {
          await this.fills.simulate(intent);
        } catch (err: unknown) {
          const client = this.redis.getClient();
          const retries = await client.incr(RETRY_KEY(entry.id));
          await client.expire(RETRY_KEY(entry.id), RETRY_TTL);
          if (retries > MAX_RETRIES) {
            const fieldsArr = Object.entries(entry.fields).flat();
            await client.xadd(
              DLQ_STREAM,
              "*",
              ...fieldsArr,
              "error",
              String(err instanceof Error ? err.message : String(err)),
              "source",
              "pel_reclaim",
            );
            await client.xack(STREAM, GROUP, entry.id);
            await client.del(RETRY_KEY(entry.id));
            this.logger.warn(
              `DLQ'd reclaimed poison message ${entry.id} after ${retries} retries`,
            );
            return;
          }
          this.logger.error(
            `Failed reclaimed intent ${intent.intentId} (attempt ${retries}/${MAX_RETRIES}) — NOT acking for retry`,
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      },
    });
    this.running = true;
    this.loopPromise = this.consumeLoop();
    this.logger.log("Stream consumer started");
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
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message?.includes("BUSYGROUP"))
        throw err;
    }
  }

  private async consumeLoop() {
    const client = this.redis.getClient();
    while (this.running) {
      try {
        const results = (await client.xreadgroup(
          "GROUP",
          GROUP,
          CONSUMER,
          "COUNT",
          "50",
          "BLOCK",
          "2000",
          "STREAMS",
          STREAM,
          ">",
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const intent = this.parseFields(fields) as unknown as OrderIntent;
            try {
              await this.fills.simulate(intent);
              await client.xack(STREAM, GROUP, id);
              // Clear retry counter on success
              await client.del(RETRY_KEY(id));
            } catch (err: unknown) {
              const retries = await client.incr(RETRY_KEY(id));
              await client.expire(RETRY_KEY(id), RETRY_TTL);
              if (retries > MAX_RETRIES) {
                // Dead-letter: permanently bad message, isolate and ACK
                await client.xadd(
                  DLQ_STREAM,
                  "*",
                  ...fields,
                  "error",
                  String(err instanceof Error ? err.message : String(err)),
                );
                await client.xack(STREAM, GROUP, id);
                await client.del(RETRY_KEY(id));
                this.logger.warn(
                  `DLQ'd poison message ${id} after ${retries} retries`,
                );
              } else {
                this.logger.error(
                  `Failed to simulate intent ${intent.intentId} (attempt ${retries}/${MAX_RETRIES}) — NOT acking for retry`,
                  err instanceof Error ? err.message : String(err),
                );
              }
            }
          }
        }
      } catch (err: unknown) {
        if (this.running) {
          this.logger.error(
            "stream:paper_orders consume error",
            err instanceof Error ? err.message : String(err),
          );
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
