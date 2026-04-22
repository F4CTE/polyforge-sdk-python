import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ArbitrageService } from "./arbitrage.service";

@Injectable()
export class ArbitrageScheduler {
  private readonly logger = new Logger(ArbitrageScheduler.name);
  private running = false;

  constructor(
    private readonly arbitrageService: ArbitrageService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleArbitrageScan() {
    if (this.running) return;
    this.running = true;
    try {
      const threshold = parseFloat(
        this.config.get<string>("ARBITRAGE_THRESHOLD_PCT") ?? "3",
      );
      const alertCount = await this.arbitrageService.scanAndAlert(threshold);
      if (alertCount > 0) {
        this.logger.log(`Arbitrage scan: ${alertCount} alerts emitted`);
      }
    } catch (err) {
      this.logger.error("Arbitrage scan failed", err);
    } finally {
      this.running = false;
    }
  }
}
