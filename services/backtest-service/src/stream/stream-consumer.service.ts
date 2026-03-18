import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { BacktestService } from "../backtest/backtest.service";

const STREAM = "stream:backtests";
const GROUP = "backtest-service";
const CONSUMER = `backtest-${process.pid}`;

@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamConsumerService.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly backtest: BacktestService,
  ) {}

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    this.loopPromise = this.consumeLoop();
    this.logger.log("Backtest stream consumer started");
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
          "1",
          "BLOCK",
          "2000",
          "STREAMS",
          STREAM,
          ">",
        );

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const parsed = this.parseFields(fields);
            const { runId } = parsed;

            if (!runId) {
              this.logger.warn(
                `stream:backtests message ${id} missing runId — skipping`,
              );
              await client.xack(STREAM, GROUP, id);
              continue;
            }

            // ACK first so a crash mid-run doesn't replay infinitely.
            // Status is tracked in DB; FAILED runs can be re-queued by an admin.
            await client.xack(STREAM, GROUP, id);

            try {
              await this.backtest.run(runId);
            } catch (err) {
              this.logger.error(
                `Backtest run ${runId} threw unexpectedly`,
                err,
              );
            }
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error("stream:backtests consume error", err?.message);
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
