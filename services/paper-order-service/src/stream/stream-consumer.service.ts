import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { FillsService, OrderIntent } from "../fills/fills.service";

const STREAM = "stream:paper_orders";
const GROUP = "paper-order-service";
const CONSUMER = `paper-${process.pid}`;

@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamConsumerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly fills: FillsService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
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
          "50",
          "BLOCK",
          "2000",
          "STREAMS",
          STREAM,
          ">",
        );

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const intent = this.parseFields(fields) as unknown as OrderIntent;
            try {
              await this.fills.simulate(intent);
            } catch (err) {
              this.logger.error(
                `Failed to simulate intent ${intent.intentId}`,
                err,
              );
            }
            // Always ACK — fill simulation is idempotent on PaperOrder creation
            await client.xack(STREAM, GROUP, id);
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error("stream:paper_orders consume error", err?.message);
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
