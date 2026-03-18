import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { MailService } from "./mail.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { TemplatesService } from "./templates.service";

// Map from stream:events type → NotificationEventType field on NotificationPreference
const EVENT_TO_PREF_FIELD: Record<string, keyof DispatchOptions | null> = {
  ORDER_FILLED: "onOrderFilled",
  STRATEGY_ERROR: "onStrategyError",
  BACKTEST_COMPLETE: "onBacktestComplete",
  PRICE_ALERT: null, // price alerts are always dispatched (user created them explicitly)
  DAILY_LOSS_LIMIT: "onDailyLossLimit",
  MARKET_RESOLVED: "onMarketResolved",
  SOMEONE_FORKED: "onSomeoneFelked",
  SOMEONE_FOLLOWED: "onSomeoneFollowed",
  SOMEONE_LIKED: "onSomeoneLiked",
  SOMEONE_COMMENTED: "onSomeoneCommented",
};

interface DispatchOptions {
  onOrderFilled: boolean;
  onStrategyError: boolean;
  onBacktestComplete: boolean;
  onDailyLossLimit: boolean;
  onMarketResolved: boolean;
  onSomeoneFelked: boolean;
  onSomeoneFollowed: boolean;
  onSomeoneLiked: boolean;
  onSomeoneCommented: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  discordEnabled: boolean;
  minFillNotifyUsdc: string;
  notificationFreq: string;
}

// Redis cache key — prefs change rarely, 5min TTL is fine
const PREFS_CACHE_KEY = (userId: string) => `cache:notif-prefs:${userId}`;
const PREFS_TTL = 300;

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

    // Build notification content
    const content = this.templates.build(eventType, data);

    // In-app notification: always push to stream:events (no frequency gating)
    await this.pushInApp(userId, content);

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

    if (prefs.emailEnabled) {
      await this.sendEmail(
        userId,
        content.title,
        content.body,
        html,
        eventType,
      );
    }
    if (prefs.telegramEnabled) {
      await this.sendTelegram(userId, content.title, content.body, eventType);
    }
    if (prefs.discordEnabled) {
      await this.sendDiscord(userId, content.title, content.body, eventType);
    }
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
        .map((i) => {
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
      const bodyText = lines.join("\n");
      const html = this.templates.toHtml({
        title: subject,
        body: lines.map((l: string) => `<p>${l}</p>`).join(""),
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
      await this.telegram.send(chatId, `<b>${title}</b>\n\n${body}`);
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
    content: ReturnType<TemplatesService["build"]>,
  ): Promise<void> {
    try {
      await this.redis.xadd("stream:events", {
        type: "NOTIFICATION",
        userId,
        title: content.title,
        body: content.body,
        severity: content.severity,
        ts: String(Date.now()),
      });
    } catch (err: any) {
      this.logger.error("Failed to push in-app notification", err?.message);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async loadPrefs(userId: string): Promise<unknown> {
    const cacheKey = PREFS_CACHE_KEY(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
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
