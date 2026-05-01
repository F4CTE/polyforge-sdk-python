import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { getStreamLag, type StreamLagSnapshot } from "./streams";

export interface StreamMonitorTarget {
  stream: string;
  group: string;
  /** Lag threshold (XLEN value) above which a warning is logged. */
  lengthWarn?: number;
  /** Pending count threshold above which a warning is logged. */
  pendingWarn?: number;
  /** Oldest pending age threshold (ms) above which a warning is logged. */
  oldestPendingMsWarn?: number;
}

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_LENGTH_WARN = 10_000;
const DEFAULT_PENDING_WARN = 500;
const DEFAULT_OLDEST_PENDING_MS_WARN = 5 * 60_000;

/**
 * Periodically polls Redis Stream lag for a set of (stream, group) targets
 * and emits structured logs. Per-target thresholds escalate informational
 * snapshots into warnings so dashboards/alerts can latch on a known shape.
 *
 * Sentry breadcrumbs are attached opportunistically — if @sentry/nestjs
 * has been initialised in the host process via instrument.ts, breadcrumbs
 * land on the next captured event. If not, the helper is a silent no-op.
 *
 * Use via `register()` from a consumer module's onModuleInit so monitoring
 * starts only after the consumer group has been ensured.
 */
@Injectable()
export class StreamMonitorService implements OnModuleDestroy {
  private readonly logger = new Logger(StreamMonitorService.name);
  private readonly targets: StreamMonitorTarget[] = [];
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = DEFAULT_INTERVAL_MS;
  private running = false;

  constructor(private readonly redis: RedisService) {}

  register(target: StreamMonitorTarget): void {
    this.targets.push(target);
    this.ensureRunning();
  }

  setIntervalMs(ms: number): void {
    if (Number.isFinite(ms) && ms >= 1_000) {
      this.intervalMs = ms;
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        this.ensureRunning();
      }
    }
  }

  onModuleDestroy(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureRunning(): void {
    if (this.timer || this.targets.length === 0) return;
    this.running = true;
    // Fire once shortly after registration so dashboards populate quickly,
    // then on a steady interval afterwards.
    setTimeout(() => {
      if (this.running) void this.tick();
    }, 1_000).unref?.();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const client = this.redis.getClient();
    for (const target of this.targets) {
      try {
        const snapshot = await getStreamLag(
          client,
          target.stream,
          target.group,
        );
        this.report(target, snapshot);
      } catch (err: unknown) {
        this.logger.error(
          `stream-monitor: lag probe failed for ${target.stream}/${target.group}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private report(
    target: StreamMonitorTarget,
    snapshot: StreamLagSnapshot,
  ): void {
    const lengthWarn = target.lengthWarn ?? DEFAULT_LENGTH_WARN;
    const pendingWarn = target.pendingWarn ?? DEFAULT_PENDING_WARN;
    const oldestWarn =
      target.oldestPendingMsWarn ?? DEFAULT_OLDEST_PENDING_MS_WARN;

    const breached =
      snapshot.length > lengthWarn ||
      snapshot.pending > pendingWarn ||
      snapshot.oldestPendingMs > oldestWarn;

    const payload = {
      stream: snapshot.stream,
      group: snapshot.group,
      length: snapshot.length,
      pending: snapshot.pending,
      oldestPendingMs: snapshot.oldestPendingMs,
      consumers: snapshot.consumers,
    };

    if (breached) {
      this.logger.warn(`stream-monitor: lag breach ${JSON.stringify(payload)}`);
    } else {
      this.logger.debug(`stream-monitor: ${JSON.stringify(payload)}`);
    }

    addSentryBreadcrumb({
      category: "redis-stream",
      level: breached ? "warning" : "info",
      message: `lag ${snapshot.stream}/${snapshot.group}`,
      data: payload,
    });
  }
}

interface SentryBreadcrumb {
  category: string;
  level: "info" | "warning" | "error";
  message: string;
  data: Record<string, unknown>;
}

function addSentryBreadcrumb(crumb: SentryBreadcrumb): void {
  try {
    // Use a runtime require so shared-redis stays free of a hard
    // @sentry/nestjs dependency. If the host service has not loaded
    // Sentry, the require fails and we silently no-op.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require("@sentry/nestjs") as {
      addBreadcrumb?: (b: SentryBreadcrumb) => void;
    };
    sentry?.addBreadcrumb?.(crumb);
  } catch {
    // Sentry not installed in this process — ignore.
  }
}
