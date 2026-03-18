import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { NotificationService } from "../notification/notification.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Runs two timers to flush digest queues:
 *  - HOURLY: flushes every 60 minutes
 *  - DAILY:  flushes every 24 hours (at the start of the next UTC midnight)
 */
@Injectable()
export class DigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private hourlyTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly notification: NotificationService) {}

  onModuleInit() {
    this.scheduleHourly();
    this.scheduleDaily();
    this.logger.log("Digest flush timers started");
  }

  onModuleDestroy() {
    if (this.hourlyTimer) clearTimeout(this.hourlyTimer);
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
  }

  private scheduleHourly() {
    this.hourlyTimer = setTimeout(
      () =>
        void (async () => {
          try {
            await this.notification.flushDigest("HOURLY");
          } catch (err: any) {
            this.logger.error("Hourly digest flush error", err?.message);
          }
          this.scheduleHourly(); // reschedule
        })(),
      HOUR_MS,
    );
  }

  private scheduleDaily() {
    // Schedule for next UTC midnight
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const msUntilMidnight = next.getTime() - Date.now();

    this.dailyTimer = setTimeout(
      () =>
        void (async () => {
          try {
            await this.notification.flushDigest("DAILY");
          } catch (err: any) {
            this.logger.error("Daily digest flush error", err?.message);
          }
          this.scheduleDaily(); // reschedule for next midnight
        })(),
      msUntilMidnight,
    );

    this.logger.log(
      `Daily digest scheduled in ${Math.round(msUntilMidnight / 60000)} min`,
    );
  }
}
