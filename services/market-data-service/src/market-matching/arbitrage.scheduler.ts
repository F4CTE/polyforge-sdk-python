import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { ArbitrageService } from "./arbitrage.service";

@Injectable()
export class ArbitrageScheduler {
  private readonly logger = new Logger(ArbitrageScheduler.name);
  private running = false;

  constructor(
    private readonly arbitrageService: ArbitrageService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleArbitrageScan() {
    if (this.running) return;
    this.running = true;
    try {
      await runOncePerCluster({
        redis: this.redis,
        key: "lock:cron:arbitrage-scheduler:handleArbitrageScan",
        ttlMs: 240_000,
        job: async () => {
          const threshold = parseFloat(
            this.config.get<string>("ARBITRAGE_THRESHOLD_PCT") ?? "3",
          );
          const alertCount =
            await this.arbitrageService.scanAndAlert(threshold);
          if (alertCount > 0) {
            this.logger.log(`Arbitrage scan: ${alertCount} alerts emitted`);
          }
        },
      });
    } catch (err) {
      this.logger.error("Arbitrage scan failed", err);
    } finally {
      this.running = false;
    }
  }
}
