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
const IN_APP_DEDUP_KEY = (
  eventType: string,
  userId: string,
  data: Record<string, string>,
) => `notif:inapp:${eventType}:${userId}:${hashEventData(data)}`;

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

// Delivery deduplication — prevents duplicate sends on stream replays / PEL reclaim.
// Lock TTL is short (2 min) so a crash during fanout does not permanently burn the key.
// After successful fanout, the TTL is extended to the full dedup window.
//
// Lock vs delivered marker: each handler generates a unique owner token (UUID) and
// acquires the lock with SET NX.  The renewal EVAL script checks ownership before
// extending TTL.  The finalizer conditionally transitions the key to "delivered"
// only if the owner token still matches — preventing a stale handler from
// overwriting a lock acquired by another reclaim handler.
//
// When a PEL reclaim handler sees a non-null, non-"delivered" value it throws
// so the reclaim service does NOT ACK the entry — the original handler may still
// succeed.  When it sees the delivered marker it returns normally — the entry can
// be safely ACKed because delivery was already completed.
const DEDUP_KEY_PREFIX = "notif-dedup";
const DEDUP_DELIVERED_VALUE = "delivered";
const DEDUP_LOCK_TTL = 120; // 2 minutes — generous enough for fanout, short enough for crash recovery
const DEDUP_TTL = 86400; // 24 hours — covers any replay window

/**
 * Build a stable idempotency key from event type, user, and payload identity.
 * Uses SHA-256 of canonical JSON with sorted keys so replayed stream entries
 * produce the same key.  JSON.stringify delimits values with quotes, preventing
 * ambiguity when field values contain `=` or `&`.
 *
 * The caller is expected to include `_streamEntryId` (the Redis stream entry
 * ID) in `data` so that identical payloads from distinct stream entries
 * produce different keys, preventing false-positive dedup under bursty traffic.
 */
function makeIdempotencyKey(
  eventType: string,
  userId: string,
  data: Record<string, string>,
): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = data[k];
      return acc;
    }, {});
  const stablePayload = JSON.stringify(sorted);
  const hash = crypto
    .createHash("sha256")
    .update(stablePayload)
    .digest("hex")
    .slice(0, 16);
  return `${DEDUP_KEY_PREFIX}:${eventType}:${userId}:${hash}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  async handle(eventType: string, data: Record<string, string>): Promise<void> {
    const userId = data.userId;
    if (!userId) return;

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

    // Dedup: atomically acquire a delivery lock so concurrent handlers
    // (normal XREADGROUP + PEL reclaim) cannot both fan out the same event.
    // SET NX EX is atomic — only one caller ever sees "OK".
    //
    // Each handler generates a unique owner token (UUID) so lock renewal and
    // finalization can verify true ownership.  A reclaim handler treats any
    // non-null, non-"delivered" value as an in-flight lock and throws to
    // prevent premature PEL ACK.
    const dedupKey = makeIdempotencyKey(eventType, userId, data);
    const ownerToken = crypto.randomUUID();
    let acquired = await this.redis
      .getClient()
      .set(dedupKey, ownerToken, "EX", DEDUP_LOCK_TTL, "NX");
    if (acquired !== "OK") {
      // The key exists — check whether it is in-flight lock, completed
      // delivery, or expired.  Only an explicit "delivered" marker means
      // the notification was already sent and it is safe to return success
      // (allowing the caller to ACK the stream entry).  A missing/expired
      // key means the lock from a crashed handler expired; retry acquisition
      // instead of silently returning and losing the notification.
      // Any non-null, non-"delivered" value (including a UUID owner token)
      // means another handler holds the lock — throw so reclaim does not ACK.
      const currentValue = await this.redis.getClient().get(dedupKey);
      if (currentValue === DEDUP_DELIVERED_VALUE) {
        this.logger.debug(
          `Duplicate notification skipped: ${eventType} for user ${userId}`,
        );
        return;
      }
      if (currentValue !== null) {
        throw new Error(
          `In-flight delivery lock held for ${eventType} user=${userId}`,
        );
      }
      // Key expired — retry acquisition
      acquired = await this.redis
        .getClient()
        .set(dedupKey, ownerToken, "EX", DEDUP_LOCK_TTL, "NX");
      if (acquired !== "OK") {
        throw new Error(
          `Delivery lock held for ${eventType} user=${userId} after retry`,
        );
      }
      // Re-acquired — fall through to fanout
    }

    // Periodically renew the lock TTL while fanout is in progress.
    // Downstream channels (email, telegram) include retry loops that
    // can extend delivery beyond DEDUP_LOCK_TTL when providers are slow.
    //
    // Renewal uses a Lua script that only extends the TTL when the key
    // value still matches the owner token, preventing a stale handler
    // from renewing a lock acquired by another reclaim handler.
    const lockRenewalMs = Math.ceil((DEDUP_LOCK_TTL / 3) * 1000);
    const RENEW_LOCK_SCRIPT =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("EXPIRE", KEYS[1], ARGV[2]) else return 0 end';
    const lockRenewal = setInterval(() => {
      this.redis
        .getClient()
        .eval(
          RENEW_LOCK_SCRIPT,
          1,
          dedupKey,
          ownerToken,
          String(DEDUP_LOCK_TTL),
        )
        .catch(() => {});
    }, lockRenewalMs);

    try {
      // Build notification content
      const content = this.templates.build(eventType, data);

      // In-app notification: always push to stream:events (no frequency gating)
      await this.pushInApp(userId, eventType, data, content);

      // Webhook dispatch: fire-and-forget so the stream consumer does
      // NOT block on external HTTP calls.  Each webhook carries a 5s
      // timeout with single retry; dispatch resolves even on failure.
      // Webhooks are best-effort — if this handler crashes before they
      // complete, the dedup marker prevents replay and the webhooks are
      // lost.  This tradeoff keeps stream ACK bounded while ensuring
      // primary channels (email/telegram/discord) are guaranteed.
      this.webhookDispatcher
        .dispatch(userId, eventType, data)
        .catch((err: unknown) => {
          this.logger.warn(
            `Webhook dispatch background task failed for ${eventType} user=${userId}: ${String((err as Error)?.message ?? err)}`,
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
    } finally {
      clearInterval(lockRenewal);
    }

    // Transition the dedup marker from owner token to "delivered" so
    // subsequent handlers (incl. PEL reclaim) can distinguish a completed
    // delivery from an in-flight lock.
    //
    // Use a Lua script that only sets "delivered" if the key still holds
    // the owner token.  If the lock was taken over by another handler
    // (e.g. after this process stalled past DEDUP_LOCK_TTL), the script
    // returns 0 and we skip the write — the notification was already
    // delivered and the other handler owns the dedup lifecycle.
    //
    // Catch Redis errors: the notification was already sent; throwing would
    // cause the stream consumer to retry without the marker and deliver a
    // guaranteed duplicate.  The lock expires in DEDUP_LOCK_TTL seconds as
    // an acceptable fallback.
    const FINALIZE_SCRIPT =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3]) else return 0 end';
    try {
      const finalized = await this.redis
        .getClient()
        .eval(
          FINALIZE_SCRIPT,
          1,
          dedupKey,
          ownerToken,
          DEDUP_DELIVERED_VALUE,
          String(DEDUP_TTL),
        );
      if (finalized === 0) {
        this.logger.warn(
          `Dedup marker not finalized for ${eventType} user=${userId}: lock overwritten`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Dedup marker finalization failed for ${eventType} user=${userId}: ${err?.message}`,
      );
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
    _data: Record<string, string>,
    content: ReturnType<TemplatesService["build"]>,
  ): Promise<void> {
    const key = `digest:${freq.toLowerCase()}:${userId}`;
    const item = JSON.stringify({
      eventType,
      title: content.title,
      body: content.body,
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

      const lines = parsed.map((p: any) => `• ${p.title}: ${p.body}`);
      const htmlLines = parsed.map(
        (p: any) => `<p>&bull; ${escapeHtml(`${p.title}: ${p.body}`)}</p>`,
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
  ): Promise<void> {
    // Dedup: prevent self-amplification — only one in-app notification per
    // (eventType, userId, event-data) within the dedup window.
    const dedupKey = IN_APP_DEDUP_KEY(eventType, userId, data);
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
