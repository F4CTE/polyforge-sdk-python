import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { MarketMatchService } from "./market-match.service";

@Injectable()
export class MarketMatchScheduler {
  private readonly logger = new Logger(MarketMatchScheduler.name);
  private running = false;

  constructor(
    private readonly matchService: MarketMatchService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoMatch() {
    if (this.running) {
      this.logger.debug("Auto-match already running, skipping");
      return;
    }
    this.running = true;
    try {
      await runOncePerCluster({
        redis: this.redis,
        key: "lock:cron:market-match-scheduler:handleAutoMatch",
        ttlMs: 3_000_000,
        job: async () => {
          const result = await this.matchService.runAutoMatch();
          if (result.created > 0) {
            this.logger.log(
              `Auto-match: ${result.created} new matches, ${result.skipped} skipped`,
            );
          }
        },
      });
    } catch (err) {
      this.logger.error("Auto-match failed", err);
    } finally {
      this.running = false;
    }
  }
}
