import crypto from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { MailService } from "./mail.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { TemplatesService } from "./templates.service";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";

// Map from stream:events type → NotificationEventType field on NotificationPreference
const EVENT_TO_PREF_FIELD: Record<string, keyof DispatchOptions | null> = {
  ORDER_FILLED: "onOrderFilled",
  STRATEGY_ERROR: "onStrategyError",
  BACKTEST_COMPLETE: "onBacktestComplete",
  PRICE_ALERT: null, // price alerts are always dispatched (user created them explicitly)
  DAILY_LOSS_LIMIT: "onDailyLossLimit",
  CIRCUIT_BREAKER_TRIGGERED: "onDailyLossLimit", // uses same opt-in as daily loss
  MARKET_RESOLVED: "onMarketResolved",
  SOMEONE_FORKED: "onSomeoneForked",
  SOMEONE_FOLLOWED: "onSomeoneFollowed",
  SOMEONE_LIKED: "onSomeoneLiked",
  SOMEONE_COMMENTED: "onSomeoneCommented",
  TICKET_REPLY: "onTicketReply",
  TICKET_CLOSED: "onTicketReply",
  WHALE_TRADE: null, // always dispatched to followers
  NEWS_SIGNAL: null, // always dispatched for high-confidence signals
  ARBITRAGE_OPPORTUNITY: null, // always dispatched — user opted into alerts
  ARBITRAGE_CROSS_VENUE: null, // always dispatched for cross-venue opportunities
};

interface DispatchOptions {
  onOrderFilled: boolean;
  onStrategyError: boolean;
  onBacktestComplete: boolean;
  onDailyLossLimit: boolean;
  onMarketResolved: boolean;
  onSomeoneForked: boolean;
  onSomeoneFollowed: boolean;
  onSomeoneLiked: boolean;
  onSomeoneCommented: boolean;
  onTicketReply: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  discordEnabled: boolean;
  minFillNotifyUsdc: string;
  notificationFreq: string;
}

// Redis cache key — prefs change rarely, 5min TTL is fine
const PREFS_CACHE_KEY = (userId: string) => `cache:notif-prefs:${userId}`;
const PREFS_TTL = 300;

// Self-amplification guard: prevent the same notification content from looping
// back through the stream consumer.  Dedup window is configurable via env.
const IN_APP_DEDUP_MS = parsePositiveInt(
  process.env.NOTIF_IN_APP_DEDUP_MS,
  5000,
);
const DEDUP_KEY = (
  eventType: string,
  userId: string,
  data: Record<string, string>,
  streamMsgId?: string,
) => {
  const uniquePart = streamMsgId ?? hashEventData(data);
  return `notif:inapp:${eventType}:${userId}:${uniquePart}`;
};

// PEL reclaim idempotency guard: use an atomic SET NX with a unique
// owner token (UUID) to claim the message before delivery.  Two workers
// reclaiming the same PEL entry concurrently will race on SET NX — only
// one wins.
//
// Short TTL (5 min) bounds the crash-before-delivery window: if the
// process crashes after claiming but before delivery finishes, the key
// expires and the next reclaim cycle safely re-attempts.  After successful
// delivery a Lua script atomically checks the owner token before writing
// "delivered" so that a stale worker whose lock expired cannot overwrite
// another worker's in-flight claim.
//
// Different values distinguish in-flight (UUID) from completed delivery
// ("delivered") so that a reclaimed PEL entry whose marker already shows
// "delivered" (successful delivery + failed XACK) is silently acknowledged
// instead of stuck in PEL for the full 7-day TTL.
const EXT_DELIVERED_KEY = (streamMsgId: string) =>
  `notif:delivered:${streamMsgId}`;
const EXT_DELIVERED_VAL_DELIVERED = "delivered";
const EXT_DELIVERED_TTL_SHORT = 300; // 5 min — covers delivery window
const EXT_DELIVERED_TTL_LONG = 604800; // 7 days — past reclaim window

// Lua: atomically verify ownership before promoting to delivered.
// Guards against stale-writer corruption: if the owner token was replaced
// by another worker's claim (TTL expiry + re-acquire race), the SET is
// skipped so the new owner's in-flight work is not falsely suppressed.
const FINALIZE_DELIVERED_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
end
return nil
`;

// Lua: atomically verify ownership before clearing the processing lock
// on failure.  Guards against stale-writer deletion: if the owner token
// was replaced by another worker's claim (TTL expiry + re-acquire race),
// the DEL is skipped so the new owner's in-flight work is preserved.
const DELETE_IF_OWNER_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

function hashEventData(data: Record<string, string>): string {
  // Use a sorted, stable serialization so identical events produce the same hash
  const canonical = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("|");
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  return hash.slice(0, 16);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Thrown by NotificationService.handle() when the idempotency guard
 * (SET NX) fails — another worker already holds the delivery lock.
 * Consumers must NOT XACK, increment retries, or move to DLQ when
 * this error is thrown; the message should stay in PEL until the
 * lock-holding worker completes or the short TTL expires.
 */
export class LockContentionError extends Error {
  constructor(streamMsgId: string) {
    super(
      `Delivery lock held for ${streamMsgId} — another worker is processing`,
    );
    this.name = "LockContentionError";
  }
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly discord: DiscordService,
    private readonly templates: TemplatesService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  // ─── Called by EventsConsumerService for each relevant stream:events message ─

  async handle(
    eventType: string,
    data: Record<string, string>,
    streamMsgId?: string,
  ): Promise<void> {
    const userId = data.userId;
    if (!userId) return;

    // ── PEL reclaim idempotency guard ───────────────────────────────────
    // Atomically claim this stream entry with a unique owner token and
    // short TTL so that two concurrent reclaimers cannot both pass the
    // check-and-act barrier.  Ownership is verified before finalizing
    // (promoting to "delivered" with long TTL) to prevent stale-writer
    // corruption when the short TTL expires and another worker claims.
    if (streamMsgId) {
      const client = this.redis.getClient();
      const idempotencyKey = EXT_DELIVERED_KEY(streamMsgId);
      const ownerToken = crypto.randomUUID();

      const acquired = await client.set(
        idempotencyKey,
        ownerToken,
        "EX",
        EXT_DELIVERED_TTL_SHORT,
        "NX",
      );
      if (acquired !== "OK") {
        // Key already exists.  Check whether a previous delivery already
        // completed (marker value is "delivered") — if so, the notification
        // was successfully delivered but XACK failed; return silently so
        // PelReclaimService XACKs the stale PEL entry.
        const existing = await client.get(idempotencyKey);
        if (existing === EXT_DELIVERED_VAL_DELIVERED) {
          return;
        }
        // Key exists with another worker's owner token: another worker
        // holds the delivery lock.  Throw so callers (handleWithRetry,
        // PelReclaim) do NOT XACK — the lock-holding worker will complete
        // or the short TTL will expire and reclaim retries.
        throw new LockContentionError(streamMsgId);
      }

      // Periodically refresh the short TTL while handleImpl runs so that
      // long channel retries (e.g. Telegram retry_after) do not let the
      // idempotency guard expire before delivery finishes.
      const refreshMs = Math.max(
        10_000,
        Math.floor(EXT_DELIVERED_TTL_SHORT * 1000 * 0.6),
      );
      const refreshTimer = setInterval(() => {
        client
          .expire(idempotencyKey, EXT_DELIVERED_TTL_SHORT)
          .catch(() => {});
      }, refreshMs);

      try {
        await this.handleImpl(userId, eventType, data, streamMsgId);
      } catch (err) {
        // handleImpl failed — clear the processing lock if we still own
        // it so reclaim retries are not blocked for the full 300s TTL.
        // Compare-and-delete: only DELETE if the key still holds this
        // worker's owner token.  A stale worker whose TTL expired and was
        // replaced by a newer reclaim worker MUST NOT delete the new owner.
        client
          .eval(DELETE_IF_OWNER_LUA, 1, idempotencyKey, ownerToken)
          .catch(() => {});
        throw err;
      } finally {
        clearInterval(refreshTimer);
      }

      // Atomically verify ownership and extend TTL to long with
      // "delivered" marker.  If the owner token was replaced (TTL
      // expiry + concurrent re-acquire), the Lua script skips the
      // SET so the new owner's in-flight work is not suppressed.
      await client
        .eval(
          FINALIZE_DELIVERED_LUA,
          1,
          idempotencyKey,
          ownerToken,
          EXT_DELIVERED_VAL_DELIVERED,
          String(EXT_DELIVERED_TTL_LONG),
        )
        .catch(() => {});
      return;
    }

    await this.handleImpl(userId, eventType, data, streamMsgId);
  }

  private async handleImpl(
    userId: string,
    eventType: string,
    data: Record<string, string>,
    streamMsgId?: string,
  ): Promise<void> {
    const prefField = EVENT_TO_PREF_FIELD[eventType];
    if (prefField === undefined) return; // event not notification-relevant

    const prefs = await this.loadPrefs(userId);
    if (!prefs) return; // user has no prefs record — they opted out of everything

    // Per-event-type opt-in check
    if (prefField !== null && !prefs[prefField]) return;

    // For ORDER_FILLED: check minFillNotifyUsdc threshold
    if (eventType === "ORDER_FILLED") {
      const fillUsdc =
        parseFloat(data.fillUsdc ?? data.fillPrice ?? "0") *
        parseFloat(data.size ?? "1");
      const threshold = parseFloat(String(prefs.minFillNotifyUsdc ?? "0"));
      if (threshold > 0 && fillUsdc < threshold) return;
    }

    // Build notification content
    const content = this.templates.build(eventType, data);

    // In-app notification: always push to stream:events (no frequency gating)
    await this.pushInApp(userId, eventType, data, content, streamMsgId);

    // Webhook dispatch: fire-and-forget to all matching webhooks
    this.webhookDispatcher.dispatch(userId, eventType, data).catch((err) => {
      this.logger.warn(
        `Webhook dispatch failed for ${eventType}: ${err?.message}`,
      );
    });

    // Determine delivery mode
    const freq = String(prefs.notificationFreq ?? "IMMEDIATE");

    if (freq === "IMMEDIATE") {
      await this.dispatch(userId, prefs, eventType, data, content);
    } else {
      // HOURLY / DAILY: push to digest queue in Redis
      await this.enqueueDigest(userId, freq, eventType, data, content);
    }
  }

  // ─── Send to all enabled external channels ────────────────────────────────

  async dispatch(
    userId: string,
    prefs: DispatchOptions,
    eventType: string,
    data: Record<string, string>,
    content: ReturnType<TemplatesService["build"]>,
  ): Promise<void> {
    const html = this.templates.toHtml(content);

    // Dispatch to all enabled channels in parallel
    await Promise.allSettled(
      [
        prefs.emailEnabled
          ? this.sendEmail(userId, content.title, content.body, html, eventType)
          : null,
        prefs.telegramEnabled
          ? this.sendTelegram(userId, content.title, content.body, eventType)
          : null,
        prefs.discordEnabled
          ? this.sendDiscord(userId, content.title, content.body, eventType)
          : null,
      ].filter(Boolean) as Promise<void>[],
    );
  }

  // ─── Digest (HOURLY / DAILY) ──────────────────────────────────────────────

  async enqueueDigest(
    userId: string,
    freq: string,
    eventType: string,
    data: Record<string, string>,
    _content: ReturnType<TemplatesService["build"]>,
  ): Promise<void> {
    const key = `digest:${freq.toLowerCase()}:${userId}`;
    const item = JSON.stringify({
      eventType,
      data,
      ts: Date.now(),
    });
    await this.redis.getClient().rpush(key, item);
    // TTL is set when flushing; extend to 25h so daily digests don't expire before flush
    await this.redis.getClient().expire(key, 90000);
    this.logger.debug(
      `Queued ${freq} digest item for user ${userId}: ${eventType}`,
    );
  }

  async flushDigest(freq: "HOURLY" | "DAILY"): Promise<void> {
    // Scan for all digest keys of this frequency
    const pattern = `digest:${freq.toLowerCase()}:*`;
    const client = this.redis.getClient();
    let cursor = "0";
    const userIds = new Set<string>();

    do {
      const [next, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        "100",
      );
      cursor = next;
      for (const key of keys) {
        const userId = key.split(":")[2];
        if (userId) userIds.add(userId);
      }
    } while (cursor !== "0");

    for (const userId of userIds) {
      const key = `digest:${freq.toLowerCase()}:${userId}`;
      const items = await client.lrange(key, 0, -1);
      if (items.length === 0) continue;

      await client.del(key);

      const prefs = await this.loadPrefs(userId);
      if (!prefs) continue;

      const parsed = items
        .map((i: string) => {
          try {
            return JSON.parse(i);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const subject =
        freq === "HOURLY"
          ? `Polyforge — ${parsed.length} notification${parsed.length > 1 ? "s" : ""} (hourly digest)`
          : `Polyforge — Daily digest (${parsed.length} notification${parsed.length > 1 ? "s" : ""})`;

      const rendered = parsed.map((p: any) => {
        // Backward-compatible: legacy entries stored {title, body} before
        // the switch to storing raw {data}.  Use stored title/body when
        // data is absent so in-flight digest items don't degrade during rollout.
        if (p.data) {
          const content = this.templates.build(
            p.eventType ?? "unknown",
            p.data,
          );
          return { title: content.title, body: content.body };
        }
        // Legacy fallback: build() is not possible without raw data.
        // These values pre-date the escaping change and may contain
        // attacker-controlled HTML — escape before HTML interpolation.
        return {
          title: String(p.title ?? ""),
          body: String(p.body ?? ""),
          legacy: true,
        };
      });

      const lines = rendered.map((r: any) => `• ${r.title}: ${r.body}`);
      const htmlLines = rendered.map(
        (r: any) =>
          `<p>&bull; ${r.legacy ? escapeHtml(r.title) : r.title}: ${r.legacy ? escapeHtml(r.body) : r.body}</p>`,
      );
      const bodyText = lines.join("\n");
      const html = this.templates.toHtml({
        title: subject,
        body: htmlLines.join(""),
        severity: "info",
      });

      const fakeContent = {
        title: subject,
        body: bodyText,
        severity: "info" as const,
      };

      if (prefs.emailEnabled) {
        await this.sendEmail(userId, subject, bodyText, html, `DIGEST_${freq}`);
      }
      if (prefs.telegramEnabled) {
        await this.sendTelegram(userId, subject, bodyText, `DIGEST_${freq}`);
      }
      if (prefs.discordEnabled) {
        await this.sendDiscord(userId, subject, bodyText, `DIGEST_${freq}`);
      }

      this.logger.log(
        `Flushed ${freq} digest for user ${userId}: ${parsed.length} items`,
      );
    }
  }

  // ─── Internal send helpers ────────────────────────────────────────────────

  private async sendEmail(
    userId: string,
    subject: string,
    text: string,
    html: string,
    eventType: string,
  ): Promise<void> {
    let email: string | null;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      email = user?.email ?? null;
    } catch {
      return;
    }
    if (!email) return;

    let success = true;
    let error: string | undefined;
    try {
      await this.mail.send(email, subject, text, html);
    } catch (err: any) {
      success = false;
      error = String(err?.message ?? err);
      this.logger.error(`Email send failed for user ${userId}`, err);
    }

    await this.writeHistory(
      userId,
      "EMAIL",
      eventType,
      { subject, text },
      success,
      error,
    );
  }

  private async sendTelegram(
    userId: string,
    title: string,
    body: string,
    eventType: string,
  ): Promise<void> {
    let chatId: string | null;
    try {
      const conn = await this.prisma.botConnection.findFirst({
        where: { userId, channel: "TELEGRAM" as any, active: true },
        select: { chatId: true },
      });
      chatId = conn?.chatId ?? null;
    } catch {
      return;
    }
    if (!chatId) return;

    let success = true;
    let error: string | undefined;
    try {
      // Escape HTML entities for Telegram's HTML parse mode
      const safeTitle = title
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const safeBody = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      await this.telegram.send(chatId, `<b>${safeTitle}</b>\n\n${safeBody}`);
    } catch (err: any) {
      success = false;
      error = String(err?.message ?? err);
      this.logger.error(`Telegram send failed for user ${userId}`, err);
    }

    await this.writeHistory(
      userId,
      "TELEGRAM",
      eventType,
      { chatId, title, body },
      success,
      error,
    );
  }

  private async sendDiscord(
    userId: string,
    title: string,
    body: string,
    eventType: string,
  ): Promise<void> {
    let channelId: string | null;
    try {
      const conn = await this.prisma.botConnection.findFirst({
        where: { userId, channel: "DISCORD" as any, active: true },
        select: { chatId: true },
      });
      channelId = conn?.chatId ?? null;
    } catch {
      return;
    }
    if (!channelId) return;

    let success = true;
    let error: string | undefined;
    try {
      await this.discord.send(channelId, `**${title}**\n\n${body}`);
    } catch (err: any) {
      success = false;
      error = String(err?.message ?? err);
      this.logger.error(`Discord send failed for user ${userId}`, err);
    }

    await this.writeHistory(
      userId,
      "DISCORD",
      eventType,
      { channelId, title, body },
      success,
      error,
    );
  }

  private async pushInApp(
    userId: string,
    eventType: string,
    data: Record<string, string>,
    content: ReturnType<TemplatesService["build"]>,
    streamMsgId?: string,
  ): Promise<void> {
    // Dedup: prevent self-amplification — only one in-app notification per
    // (eventType, userId, event-data, streamMsgId) within the dedup window.
    // Including streamMsgId distinguishes distinct events with identical payload.
    const dedupKey = DEDUP_KEY(eventType, userId, data, streamMsgId);
    // Use a unique lock value so we can verify ownership before deleting
    const lockValue = crypto.randomUUID();
    let dedupAcquired = false;

    try {
      const setResult = await this.redis
        .getClient()
        .set(dedupKey, lockValue, "PX", IN_APP_DEDUP_MS, "NX");
      if (setResult !== "OK") {
        this.logger.debug(
          `Skipping in-app notification (dedup): ${eventType} user=${userId}`,
        );
        return;
      }
      dedupAcquired = true;
    } catch (err: any) {
      // SET failed (Redis connectivity issue) — do not block notification
      this.logger.warn(
        `Dedup SET failed for ${eventType} user=${userId}: ${err?.message}`,
      );
    }

    const notifId = `${eventType}:${userId}:${Date.now()}:${crypto.randomUUID()}`;
    try {
      await this.redis.xadd("stream:events", {
        type: "NOTIFICATION",
        userId,
        id: notifId,
        title: content.title,
        body: content.body,
        severity: content.severity,
        ts: String(Date.now()),
      });
    } catch (err: any) {
      // Release dedup key so subsequent attempts are not suppressed
      if (dedupAcquired) {
        this.releaseDedupKey(dedupKey, lockValue);
      }
      this.logger.error("Failed to push in-app notification", err?.message);
    }
  }

  private releaseDedupKey(key: string, expectedValue: string): void {
    // Use a Lua script to only delete if the value still matches, avoiding
    // race conditions where the key expired and another request re-acquired it.
    const script = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;
    this.redis
      .getClient()
      .eval(script, 1, key, expectedValue)
      .catch(() => {});
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async loadPrefs(userId: string): Promise<DispatchOptions | null> {
    const cacheKey = PREFS_CACHE_KEY(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as DispatchOptions;
      } catch {
        /* fall through */
      }
    }

    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs) return null;

    await this.redis.set(cacheKey, JSON.stringify(prefs), PREFS_TTL);
    return prefs;
  }

  private async writeHistory(
    userId: string,
    channel: string,
    eventType: string,
    payload: Record<string, unknown>,
    success: boolean,
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.notificationHistory.create({
        data: {
          userId,
          channel,
          eventType,
          payload: payload as any,
          success,
          error,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to write notification_history: ${err?.message}`);
    }
  }
}
