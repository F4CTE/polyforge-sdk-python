import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MarketMatchService } from "./market-match.service";

@Injectable()
export class MarketMatchScheduler {
  private readonly logger = new Logger(MarketMatchScheduler.name);
  private running = false;

  constructor(private readonly matchService: MarketMatchService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoMatch() {
    if (this.running) {
      this.logger.debug("Auto-match already running, skipping");
      return;
    }
    this.running = true;
    try {
      const result = await this.matchService.runAutoMatch();
      if (result.created > 0) {
        this.logger.log(
          `Auto-match: ${result.created} new matches, ${result.skipped} skipped`,
        );
      }
    } catch (err) {
      this.logger.error("Auto-match failed", err);
    } finally {
      this.running = false;
    }
  }
}
