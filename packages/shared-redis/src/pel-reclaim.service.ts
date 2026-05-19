import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { reclaimPendingEntries, type ReclaimedEntry } from "./streams";

export interface PelReclaimTarget {
  stream: string;
  group: string;
  /** Consumer name that will own reclaimed entries. */
  consumer: string;
  /** Minimum idle time (ms) before an entry is considered stale. */
  minIdleMs?: number;
  /** Max entries to scan per cycle. */
  count?: number;
  /**
   * Optional handler invoked once per reclaimed entry.
   * Return `false` to keep the entry pending, or `true` / `undefined`
   * (void) to ACK (drain) it. Returns without a value (void) are
   * treated as ACK for backward compatibility with handlers that
   * predate the selective-ACK contract.
   *
   * Throws are caught and logged — the entry stays in PEL for the next
   * cycle so transient errors do not lose data.
   */
  handler?: (entry: ReclaimedEntry) => Promise<boolean | void> | boolean | void;
  /** Optional callback for metrics: fired with the count reclaimed per cycle. */
  onReclaim?: (reclaimedCount: number) => void;
}

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MIN_IDLE_MS = 5 * 60_000; // 5 minutes
const DEFAULT_COUNT = 100;

/**
 * Periodically reclaims abandoned pending entries from Redis consumer
 * groups. Without this worker, entries left in PEL by a crashed pod
 * stay invisible to live consumers forever — XPENDING reports them but
 * neither XLEN nor XREADGROUP ">" will surface them.
 *
 * When a target supplies a `handler`, the worker reprocesses each
 * reclaimed entry and XACKs it on success. Without a handler, the
 * worker only reassigns ownership — useful for visibility-only setups
 * where another loop will drain the consumer's PEL via XREADGROUP "0".
 */
@Injectable()
export class PelReclaimService implements OnModuleDestroy {
  private readonly logger = new Logger(PelReclaimService.name);
  private readonly targets: Array<PelReclaimTarget & { cursor: string }> = [];
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = DEFAULT_INTERVAL_MS;
  private running = false;

  constructor(private readonly redis: RedisService) {}

  register(target: PelReclaimTarget): void {
    this.targets.push({ ...target, cursor: "0-0" });
    this.ensureRunning();
  }

  setIntervalMs(ms: number): void {
    if (Number.isFinite(ms) && ms >= 5_000) {
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
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const client = this.redis.getClient();
    for (const target of this.targets) {
      try {
        const result = await reclaimPendingEntries(
          client,
          target.stream,
          target.group,
          target.consumer,
          target.minIdleMs ?? DEFAULT_MIN_IDLE_MS,
          target.count ?? DEFAULT_COUNT,
          target.cursor,
        );
        target.cursor = result.nextCursor;

        if (result.reclaimedCount === 0) continue;

        this.logger.warn(
          `pel-reclaim: ${result.reclaimedCount} entries reclaimed for ` +
            `${target.stream}/${target.group} -> ${target.consumer}`,
        );
        target.onReclaim?.(result.reclaimedCount);

        if (target.handler) {
          for (const entry of result.entries) {
            try {
              const shouldAck = await target.handler(entry);
              if (shouldAck !== false) {
                await client.xack(target.stream, target.group, entry.id);
              }
            } catch (err: unknown) {
              this.logger.error(
                `pel-reclaim: handler failed for ${target.stream}/${target.group} entry ${entry.id}`,
                err instanceof Error ? err.message : String(err),
              );
            }
          }
        }
      } catch (err: unknown) {
        this.logger.error(
          `pel-reclaim: cycle failed for ${target.stream}/${target.group}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
}
