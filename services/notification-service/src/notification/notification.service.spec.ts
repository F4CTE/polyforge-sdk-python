import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mockDeep, MockProxy } from "vitest-mock-extended";
import { NotificationService } from "./notification.service";
import { TemplatesService, NotificationContent } from "./templates.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { MailService } from "./mail.service";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePrefs(overrides: Partial<FullPrefs> = {}): FullPrefs {
  return {
    userId: "user-1",
    onOrderFilled: true,
    onStrategyError: true,
    onBacktestComplete: true,
    onDailyLossLimit: true,
    onMarketResolved: true,
    onSomeoneForked: true,
    onSomeoneFollowed: true,
    onSomeoneLiked: true,
    onSomeoneCommented: true,
    onTicketReply: true,
    emailEnabled: false,
    telegramEnabled: false,
    discordEnabled: false,
    minFillNotifyUsdc: "0",
    notificationFreq: "IMMEDIATE",
    ...overrides,
  };
}

interface FullPrefs {
  userId: string;
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

const STUB_CONTENT: NotificationContent = {
  title: "Test Title",
  body: "Test body.",
  severity: "info",
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildMockRedisClient() {
  return {
    rpush: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(["0", []]),
    lrange: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(1),
    incrbyfloat: vi.fn().mockResolvedValue("0"),
    xadd: vi.fn().mockResolvedValue("1-0"),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    eval: vi.fn().mockResolvedValue(1),
  };
}

describe("NotificationService", () => {
  let service: NotificationService;
  let prisma: MockProxy<PrismaService>;
  let redis: MockProxy<RedisService>;
  let mail: MockProxy<MailService>;
  let telegram: MockProxy<TelegramService>;
  let discord: MockProxy<DiscordService>;
  let templates: MockProxy<TemplatesService>;
  let webhookDispatcher: MockProxy<WebhookDispatcherService>;
  let redisClient: ReturnType<typeof buildMockRedisClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    redis = mockDeep<RedisService>();
    mail = mockDeep<MailService>();
    telegram = mockDeep<TelegramService>();
    discord = mockDeep<DiscordService>();
    templates = mockDeep<TemplatesService>();
    webhookDispatcher = mockDeep<WebhookDispatcherService>();
    webhookDispatcher.dispatch.mockResolvedValue(undefined);

    redisClient = buildMockRedisClient();
    redis.getClient.mockReturnValue(redisClient as any);
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(undefined);
    redis.xadd.mockResolvedValue("1-0");

    templates.build.mockReturnValue(STUB_CONTENT);
    templates.toHtml.mockReturnValue("<html>stub</html>");
    mail.send.mockResolvedValue(undefined);
    telegram.send.mockResolvedValue(undefined);
    discord.send.mockResolvedValue(undefined);

    // Default: no notification history write failure
    (prisma.notificationHistory.create as any).mockResolvedValue({});

    service = new NotificationService(
      prisma,
      redis,
      mail,
      telegram,
      discord,
      templates,
      webhookDispatcher,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── handle() ─────────────────────────────────────────────────────────────

  describe("handle", () => {
    it("returns early when userId is absent", async () => {
      await service.handle("ORDER_FILLED", {});
      expect(redis.get).not.toHaveBeenCalled();
    });

    it("returns early for an event type that is not in the map", async () => {
      await service.handle("UNKNOWN_EVENT_XYZ", { userId: "user-1" });
      expect(redis.get).not.toHaveBeenCalled();
    });

    it("returns early when prefs are not found", async () => {
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);
      await service.handle("ORDER_FILLED", { userId: "user-1" });
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("returns early when the per-event opt-in flag is false", async () => {
      const prefs = makePrefs({ onOrderFilled: false });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("dispatches immediately when notificationFreq is IMMEDIATE", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("enqueues digest when notificationFreq is HOURLY", async () => {
      const prefs = makePrefs({ notificationFreq: "HOURLY" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const enqueueSpy = vi
        .spyOn(service, "enqueueDigest")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(enqueueSpy).toHaveBeenCalledOnce();
      expect(enqueueSpy).toHaveBeenCalledWith(
        "user-1",
        "HOURLY",
        "ORDER_FILLED",
        expect.any(Object),
        STUB_CONTENT,
      );
    });

    it("enqueues digest when notificationFreq is DAILY", async () => {
      const prefs = makePrefs({ notificationFreq: "DAILY" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const enqueueSpy = vi
        .spyOn(service, "enqueueDigest")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(enqueueSpy).toHaveBeenCalledOnce();
      expect(enqueueSpy).toHaveBeenCalledWith(
        "user-1",
        "DAILY",
        "ORDER_FILLED",
        expect.any(Object),
        STUB_CONTENT,
      );
    });

    it("always pushes an in-app notification regardless of frequency", async () => {
      const prefs = makePrefs({ notificationFreq: "DAILY" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "enqueueDigest").mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NOTIFICATION",
          userId: "user-1",
        }),
      );
    });

    it("skips ORDER_FILLED when fillUsdc is below minFillNotifyUsdc threshold", async () => {
      const prefs = makePrefs({
        minFillNotifyUsdc: "100",
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // fillPrice 0.50 * size 10 = 5 USDC — below threshold of 100
      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.50",
        size: "10",
      });

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it("dispatches ORDER_FILLED when fillUsdc meets or exceeds threshold", async () => {
      const prefs = makePrefs({
        minFillNotifyUsdc: "10",
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // fillPrice 0.50 * size 100 = 50 USDC — above threshold of 10
      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.50",
        size: "100",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("dispatches ORDER_FILLED when minFillNotifyUsdc threshold is 0 regardless of fill amount", async () => {
      const prefs = makePrefs({
        minFillNotifyUsdc: "0",
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.01",
        size: "1",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("dispatches PRICE_ALERT even though it maps to null pref field (always send)", async () => {
      // PRICE_ALERT maps to null — always dispatched
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("PRICE_ALERT", {
        userId: "user-1",
        tokenId: "tok-1",
        threshold: "0.9",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("uses cached prefs from Redis when available", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      // Return a valid JSON string from cache
      redis.get.mockImplementation(async (key: string) => {
        if (key.startsWith("cache:notif-prefs:")) return JSON.stringify(prefs);
        return null;
      });

      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "50",
      });

      // Should NOT have queried the database
      expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
    });

    it("writes prefs to Redis cache after loading from DB", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "50",
      });

      expect(redis.set).toHaveBeenCalledWith(
        "cache:notif-prefs:user-1",
        JSON.stringify(prefs),
        300,
      );
    });
  });

  // ─── dispatch() ──────────────────────────────────────────────────────────

  describe("dispatch", () => {
    const baseData = { userId: "user-1" };

    it("does not send email when emailEnabled is false", async () => {
      const prefs = makePrefs({ emailEnabled: false });
      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );
      expect(mail.send).not.toHaveBeenCalled();
    });

    it("does not send telegram when telegramEnabled is false", async () => {
      const prefs = makePrefs({ telegramEnabled: false });
      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );
      expect(telegram.send).not.toHaveBeenCalled();
    });

    it("does not send discord when discordEnabled is false", async () => {
      const prefs = makePrefs({ discordEnabled: false });
      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );
      expect(discord.send).not.toHaveBeenCalled();
    });

    it("sends email when emailEnabled is true and user email exists", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "user@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(mail.send).toHaveBeenCalledWith(
        "user@example.com",
        STUB_CONTENT.title,
        STUB_CONTENT.body,
        "<html>stub</html>",
      );
    });

    it("does not send email when user email is not found", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      (prisma.user.findUnique as any).mockResolvedValue({ email: null });

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(mail.send).not.toHaveBeenCalled();
    });

    it("sends telegram when telegramEnabled is true and chatId exists", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "tg-chat-1",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(telegram.send).toHaveBeenCalledWith(
        "tg-chat-1",
        expect.stringContaining(STUB_CONTENT.title),
      );
    });

    it("does not send telegram when no botConnection is found", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue(null);

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(telegram.send).not.toHaveBeenCalled();
    });

    it("sends discord when discordEnabled is true and channelId exists", async () => {
      const prefs = makePrefs({ discordEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "dc-chan-1",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(discord.send).toHaveBeenCalledWith(
        "dc-chan-1",
        expect.stringContaining(STUB_CONTENT.title),
      );
    });

    it("does not send discord when no botConnection is found", async () => {
      const prefs = makePrefs({ discordEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue(null);

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(discord.send).not.toHaveBeenCalled();
    });

    it("sends to all enabled channels when all are enabled", async () => {
      const prefs = makePrefs({
        emailEnabled: true,
        telegramEnabled: true,
        discordEnabled: true,
      });
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "some-id",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(mail.send).toHaveBeenCalledOnce();
      expect(telegram.send).toHaveBeenCalledOnce();
      expect(discord.send).toHaveBeenCalledOnce();
    });

    it("writes notification history for a successful send", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "tg-chat-1",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.dispatch(
        "user-1",
        prefs,
        "ORDER_FILLED",
        baseData,
        STUB_CONTENT,
      );

      expect(prisma.notificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channel: "TELEGRAM", success: true }),
        }),
      );
    });

    it("writes notification history with success=false when telegram.send throws", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "tg-chat-1",
      });
      telegram.send.mockRejectedValueOnce(new Error("Telegram down"));
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      // Should NOT throw — errors are swallowed and recorded in history
      await expect(
        service.dispatch(
          "user-1",
          prefs,
          "ORDER_FILLED",
          baseData,
          STUB_CONTENT,
        ),
      ).resolves.toBeUndefined();

      expect(prisma.notificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: "TELEGRAM",
            success: false,
          }),
        }),
      );
    });
  });

  // ─── enqueueDigest() ─────────────────────────────────────────────────────

  describe("enqueueDigest", () => {
    it("rpushes a JSON item to the correct hourly key", async () => {
      await service.enqueueDigest(
        "user-42",
        "HOURLY",
        "ORDER_FILLED",
        {},
        STUB_CONTENT,
      );

      expect(redisClient.rpush).toHaveBeenCalledWith(
        "digest:hourly:user-42",
        expect.stringContaining('"eventType":"ORDER_FILLED"'),
      );
    });

    it("rpushes a JSON item to the correct daily key", async () => {
      await service.enqueueDigest(
        "user-42",
        "DAILY",
        "BACKTEST_COMPLETE",
        {},
        STUB_CONTENT,
      );

      expect(redisClient.rpush).toHaveBeenCalledWith(
        "digest:daily:user-42",
        expect.stringContaining('"eventType":"BACKTEST_COMPLETE"'),
      );
    });

    it("sets a TTL on the digest key", async () => {
      await service.enqueueDigest(
        "user-42",
        "HOURLY",
        "ORDER_FILLED",
        {},
        STUB_CONTENT,
      );

      expect(redisClient.expire).toHaveBeenCalledWith(
        "digest:hourly:user-42",
        90000,
      );
    });

    it("serialises title and body into the queued item", async () => {
      await service.enqueueDigest(
        "user-42",
        "DAILY",
        "ORDER_FILLED",
        {},
        STUB_CONTENT,
      );

      const [, jsonStr] = redisClient.rpush.mock.calls[0] as [string, string];
      const item = JSON.parse(jsonStr);
      expect(item.title).toBe(STUB_CONTENT.title);
      expect(item.body).toBe(STUB_CONTENT.body);
    });

    it("includes a ts timestamp in the queued item", async () => {
      const before = Date.now();
      await service.enqueueDigest(
        "user-42",
        "HOURLY",
        "ORDER_FILLED",
        {},
        STUB_CONTENT,
      );
      const after = Date.now();

      const [, jsonStr] = redisClient.rpush.mock.calls[0] as [string, string];
      const item = JSON.parse(jsonStr);
      expect(item.ts).toBeGreaterThanOrEqual(before);
      expect(item.ts).toBeLessThanOrEqual(after);
    });
  });

  // ─── flushDigest() ───────────────────────────────────────────────────────

  describe("flushDigest", () => {
    function makeDigestItem(overrides: Record<string, unknown> = {}) {
      return JSON.stringify({
        eventType: "ORDER_FILLED",
        title: "Order Filled",
        body: "Your order was filled.",
        ts: Date.now(),
        ...overrides,
      });
    }

    it("does nothing when no digest keys exist", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", []]);

      await service.flushDigest("HOURLY");

      expect(redisClient.lrange).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it("does nothing for a key whose lrange is empty", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        makePrefs(),
      );

      await service.flushDigest("HOURLY");

      expect(mail.send).not.toHaveBeenCalled();
    });

    it("scans with correct pattern for HOURLY", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", []]);

      await service.flushDigest("HOURLY");

      expect(redisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "digest:hourly:*",
        "COUNT",
        "100",
      );
    });

    it("scans with correct pattern for DAILY", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", []]);

      await service.flushDigest("DAILY");

      expect(redisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "digest:daily:*",
        "COUNT",
        "100",
      );
    });

    it("deletes the digest key after processing", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        makePrefs(),
      );

      await service.flushDigest("HOURLY");

      expect(redisClient.del).toHaveBeenCalledWith("digest:hourly:user-1");
    });

    it("sends email when emailEnabled and prefs exist", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.flushDigest("HOURLY");

      expect(mail.send).toHaveBeenCalledOnce();
    });

    it("sends telegram when telegramEnabled and prefs exist", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "tg-chat-1",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.flushDigest("HOURLY");

      expect(telegram.send).toHaveBeenCalledOnce();
    });

    it("sends discord when discordEnabled and prefs exist", async () => {
      const prefs = makePrefs({ discordEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "dc-chan-1",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.flushDigest("HOURLY");

      expect(discord.send).toHaveBeenCalledOnce();
    });

    it("uses hourly digest subject format for HOURLY frequency", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([
        makeDigestItem(),
        makeDigestItem(),
      ]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.flushDigest("HOURLY");

      const [, subject] = (mail.send as any).mock.calls[0] as [
        string,
        string,
        ...unknown[],
      ];
      expect(subject).toContain("hourly digest");
      expect(subject).toContain("2 notifications");
    });

    it("uses daily digest subject format for DAILY frequency", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:daily:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await service.flushDigest("DAILY");

      const [, subject] = (mail.send as any).mock.calls[0] as [
        string,
        string,
        ...unknown[],
      ];
      expect(subject).toContain("Daily digest");
      expect(subject).toContain("1 notification");
    });

    it("skips a user when their prefs are not found", async () => {
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-99"]]);
      redisClient.lrange.mockResolvedValueOnce([makeDigestItem()]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);

      await service.flushDigest("HOURLY");

      expect(mail.send).not.toHaveBeenCalled();
      expect(telegram.send).not.toHaveBeenCalled();
      expect(discord.send).not.toHaveBeenCalled();
    });

    it('handles multiple scan pages (cursor != "0")', async () => {
      redisClient.scan
        .mockResolvedValueOnce(["cursor-next", ["digest:hourly:user-1"]])
        .mockResolvedValueOnce(["0", ["digest:hourly:user-2"]]);
      redisClient.lrange.mockResolvedValue([]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        makePrefs(),
      );

      await service.flushDigest("HOURLY");

      expect(redisClient.scan).toHaveBeenCalledTimes(2);
    });

    it("silently skips malformed JSON items in the queue", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([
        "not-valid-json",
        makeDigestItem({ title: "Good item" }),
      ]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      // Should not throw; just processes the valid item
      await expect(service.flushDigest("HOURLY")).resolves.toBeUndefined();
      expect(mail.send).toHaveBeenCalledOnce();
    });

    it("escapes stored digest title and body before building email HTML", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);
      redisClient.lrange.mockResolvedValueOnce([
        makeDigestItem({
          title: '<img src=x onerror="alert(1)">',
          body: '<script>alert("x")</script>',
        }),
      ]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });

      await service.flushDigest("HOURLY");

      expect(templates.toHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("&lt;img"),
        }),
      );
      const digestHtmlInput = templates.toHtml.mock.calls[0][0].body;
      expect(digestHtmlInput).not.toContain("<img");
      expect(digestHtmlInput).not.toContain("<script>");
      expect(digestHtmlInput).toContain("&lt;script&gt;");
    });
  });

  // ─── Email send failure handling ──────────────────────────────────────────

  describe("dispatch — email send failure", () => {
    it("records failure in history when mail.send throws", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });
      mail.send.mockRejectedValueOnce(new Error("SMTP connection refused"));
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await expect(
        service.dispatch("user-1", prefs, "ORDER_FILLED", {}, STUB_CONTENT),
      ).resolves.toBeUndefined();

      expect(prisma.notificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: "EMAIL",
            success: false,
            error: expect.stringContaining("SMTP connection refused"),
          }),
        }),
      );
    });

    it("returns early when user lookup throws", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      (prisma.user.findUnique as any).mockRejectedValue(new Error("DB error"));

      await expect(
        service.dispatch("user-1", prefs, "ORDER_FILLED", {}, STUB_CONTENT),
      ).resolves.toBeUndefined();

      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  // ─── Discord send failure handling ────────────────────────────────────────

  describe("dispatch — discord send failure", () => {
    it("records failure in history when discord.send throws", async () => {
      const prefs = makePrefs({ discordEnabled: true });
      (prisma.botConnection.findFirst as any).mockResolvedValue({
        chatId: "dc-chan-1",
      });
      discord.send.mockRejectedValueOnce(new Error("Discord API error"));
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      await expect(
        service.dispatch("user-1", prefs, "ORDER_FILLED", {}, STUB_CONTENT),
      ).resolves.toBeUndefined();

      expect(prisma.notificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: "DISCORD",
            success: false,
          }),
        }),
      );
    });

    it("returns early when botConnection lookup throws for discord", async () => {
      const prefs = makePrefs({ discordEnabled: true });
      (prisma.botConnection.findFirst as any).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(
        service.dispatch("user-1", prefs, "ORDER_FILLED", {}, STUB_CONTENT),
      ).resolves.toBeUndefined();

      expect(discord.send).not.toHaveBeenCalled();
    });
  });

  // ─── Telegram send failure handling ───────────────────────────────────────

  describe("dispatch — telegram lookup failure", () => {
    it("returns early when botConnection lookup throws for telegram", async () => {
      const prefs = makePrefs({ telegramEnabled: true });
      (prisma.botConnection.findFirst as any).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(
        service.dispatch("user-1", prefs, "ORDER_FILLED", {}, STUB_CONTENT),
      ).resolves.toBeUndefined();

      expect(telegram.send).not.toHaveBeenCalled();
    });
  });

  // ─── New event types: WHALE_TRADE, NEWS_SIGNAL ────────────────────────────

  describe("handle — new event types", () => {
    it("dispatches WHALE_TRADE event (always dispatched, null pref field)", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("WHALE_TRADE", {
        userId: "user-1",
        wallet: "0xabc",
        size: "50000",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("dispatches NEWS_SIGNAL event (always dispatched, null pref field)", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("NEWS_SIGNAL", {
        userId: "user-1",
        signal: "BUY",
        confidence: "0.9",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("dispatches TICKET_REPLY when onTicketReply is enabled", async () => {
      const prefs = makePrefs({
        onTicketReply: true,
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("TICKET_REPLY", {
        userId: "user-1",
        ticketId: "ticket-1",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("dispatches TICKET_CLOSED using onTicketReply pref", async () => {
      const prefs = makePrefs({
        onTicketReply: true,
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("TICKET_CLOSED", {
        userId: "user-1",
        ticketId: "ticket-1",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("skips TICKET_REPLY when onTicketReply is false", async () => {
      const prefs = makePrefs({
        onTicketReply: false,
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      await service.handle("TICKET_REPLY", {
        userId: "user-1",
        ticketId: "ticket-1",
      });

      expect(templates.build).not.toHaveBeenCalled();
    });
  });

  // ─── In-app notification failure handling ────────────────────────────────

  describe("handle — in-app notification failure", () => {
    it("continues processing when in-app notification push fails", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      redis.xadd.mockRejectedValueOnce(new Error("Redis unavailable"));
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await expect(
        service.handle("ORDER_FILLED", {
          userId: "user-1",
          fillPrice: "0.80",
          size: "100",
        }),
      ).resolves.toBeUndefined();

      // dispatch should still be called
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });
  });

  // ─── In-app notification dedup (self-amplification guard) ────────────────

  describe("handle — in-app notification dedup", () => {
    it("skips duplicate in-app notification with identical content within dedup window", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // First handle: delivery dedup SET NX → OK, in-app dedup SET → OK,
      // TTL extend SET → OK (default)
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(redis.xadd).toHaveBeenCalledTimes(1);
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NOTIFICATION",
          userId: "user-1",
        }),
      );

      // Second call with same content — delivery dedup SET NX returns null,
      // GET returns "delivered" → early return (dedup)
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");
      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      // Still only 1 xadd call total
      expect(redis.xadd).toHaveBeenCalledTimes(1);
    });

    it("allows in-app notification with different content for same eventType+userId", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // Change template output per call so content differs
      templates.build
        .mockReturnValueOnce({
          ...STUB_CONTENT,
          body: "Fill 100 at $0.80",
        })
        .mockReturnValueOnce({
          ...STUB_CONTENT,
          body: "Fill 200 at $1.50",
        });

      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(redis.xadd).toHaveBeenCalledTimes(1);

      // Different content → different dedup key → both pass through
      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "1.50",
        size: "200",
      });

      expect(redis.xadd).toHaveBeenCalledTimes(2);
    });

    it("dedups by content hash in the Redis key", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      templates.build.mockReturnValue({
        ...STUB_CONTENT,
        title: "Order Filled",
        body: "Your order was filled.",
      });

      redisClient.set
        .mockResolvedValueOnce("OK") // in-app dedup
        .mockResolvedValueOnce("OK"); // delivery dedup marker

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^notif:inapp:ORDER_FILLED:user-1:/),
        expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        "PX",
        expect.any(Number),
        "NX",
      );

      // In-app dedup key is the second SET call (call 1, after delivery NX)
      const dedupKey: string = redisClient.set.mock.calls[1][0];
      const parts = dedupKey.split(":");
      expect(parts.length).toBeGreaterThanOrEqual(5);
      // Last part is the content hash (alphanumeric)
      expect(parts[parts.length - 1]).toMatch(/^[a-z0-9]+$/);
    });

    it("proceeds with in-app push when in-app dedup SET fails with a Redis error", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // Delivery dedup NX OK, in-app dedup SET throws (Redis error) → caught → xadd proceeds
      redisClient.set
        .mockResolvedValueOnce("OK")
        .mockRejectedValueOnce(new Error("Redis connection lost"));

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      // xadd should still be called despite SET failure
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NOTIFICATION",
          userId: "user-1",
        }),
      );
    });

    it("releases dedup key when xadd fails after successful SET", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // Delivery dedup NX succeeds, in-app dedup succeeds, then xadd fails
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
      // But xadd fails
      redis.xadd.mockRejectedValueOnce(new Error("Stream write failed"));

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      // Should have released the dedup key via Lua script (compare-and-delete)
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("GET"),
        1,
        expect.stringMatching(/^notif:inapp:ORDER_FILLED:user-1:/),
        expect.any(String),
      );
    });

    it("still dispatches external channels (email/telegram/discord) when in-app is deduped", async () => {
      const prefs = makePrefs({
        notificationFreq: "IMMEDIATE",
        emailEnabled: true,
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "user@example.com",
      });
      (prisma.notificationHistory.create as any).mockResolvedValue({});

      // Delivery dedup NX → OK, in-app dedup SET NX → null → skip in-app
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce(null); // in-app dedup SET NX → skip in-app

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      // In-app should NOT be pushed
      expect(redis.xadd).not.toHaveBeenCalled();

      // External dispatch should still be called
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("does NOT dedup distinct events with identical rendered text", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // Template produces identical title+body for both events
      templates.build.mockReturnValue({
        ...STUB_CONTENT,
        title: "Order Filled",
        body: "Your order was filled at $0.80.",
      });

      // Two events with different data but same rendered output.
      // Each handle() call: delivery NX → OK, in-app NX → OK
      redisClient.set
        .mockResolvedValueOnce("OK")
        .mockResolvedValueOnce("OK")
        .mockResolvedValueOnce("OK")
        .mockResolvedValueOnce("OK");

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
        orderId: "order-AAA",
      });

      expect(redis.xadd).toHaveBeenCalledTimes(1);

      // Different data (different orderId) — should NOT be deduped
      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
        orderId: "order-BBB",
      });

      // Both should pass through because event data differs
      expect(redis.xadd).toHaveBeenCalledTimes(2);
    });

    it("generates collision-resistant notifId with random component", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      // notifId should contain a UUID (random suffix)
      const xaddCall = redis.xadd.mock.calls[0][1];
      expect(xaddCall.id).toMatch(
        /^ORDER_FILLED:user-1:\d+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  // ─── Delivery deduplication ─────────────────────────────────────────────

  describe("handle — delivery dedup", () => {
    const ORDER_DATA = {
      userId: "user-1",
      fillPrice: "0.80",
      size: "100",
      tokenId: "tok-a",
      _streamEntryId: "1715706456789-0",
    };

    beforeEach(() => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
    });

    it("skips delivery when the same event is replayed (SET NX finds existing marker)", async () => {
      // First handle: delivery NX OK, in-app NX OK, TTL extend OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(dispatchSpy).toHaveBeenCalledOnce();
      const buildCalls = templates.build.mock.calls.length;
      const xaddCalls = redis.xadd.mock.calls.length;

      // Second handle: delivery NX returns null → GET returns "delivered" → skip
      dispatchSpy.mockRestore();
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(templates.build).toHaveBeenCalledTimes(buildCalls);
      expect(redis.xadd).toHaveBeenCalledTimes(xaddCalls);
    });

    it("processes delivery when the same event type has different payload data", async () => {
      // First order: delivery NX OK, in-app NX OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(dispatchSpy).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Different tokenId → different dedup key → delivery NX OK → proceed
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      await service.handle("ORDER_FILLED", {
        ...ORDER_DATA,
        tokenId: "tok-b",
        fillPrice: "1.20",
      });
      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(templates.build).toHaveBeenCalled();
    });

    it("processes delivery for the same payload on a different user", async () => {
      // user-1: delivery NX OK, in-app NX OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(dispatchSpy).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // user-2: different user → different dedup key → delivery NX OK → proceed
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      await service.handle("ORDER_FILLED", {
        ...ORDER_DATA,
        userId: "user-2",
      });
      expect(dispatchSpy).toHaveBeenCalledOnce();
    });

    it("does not reach the dedup check for events filtered out by opt-in", async () => {
      const prefs = makePrefs({
        onOrderFilled: false,
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Should have returned early on the opt-in check, never reaching SET
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it("does not reach the dedup check when minFillNotifyUsdc threshold filters the event", async () => {
      const prefs = makePrefs({
        minFillNotifyUsdc: "10000",
        notificationFreq: "IMMEDIATE",
      });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      await service.handle("ORDER_FILLED", {
        ...ORDER_DATA,
        fillPrice: "0.01",
        size: "1",
      });

      // Should have returned early on the threshold check
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it("deduplicates events with null pref field (always send)", async () => {
      // First handle: delivery NX OK, in-app NX OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("WHALE_TRADE", {
        userId: "user-1",
        wallet: "0xabc",
        size: "50000",
      });
      expect(dispatchSpy).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Second handle — delivery NX returns null, GET returns "delivered" → deduped
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle("WHALE_TRADE", {
        userId: "user-1",
        wallet: "0xabc",
        size: "50000",
      });
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it("sets the dedup marker after fanout with correct key format and TTL", async () => {
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX (owner token, EX 120, NX)
        .mockResolvedValueOnce("OK") // in-app dedup SET NX (PX, NX)
        .mockResolvedValueOnce(1); // TTL extend Lua script (finalize, returns 1)
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Lock acquisition SET (call 0): verify owner token UUID and NX
      const [lockKey, lockValue, ...lockOpts] = redisClient.set.mock
        .calls[0] as [string, string, ...string[]];
      expect(lockKey).toMatch(/^notif-dedup:ORDER_FILLED:user-1:[a-f0-9]{16}$/);
      expect(lockValue).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(lockOpts).toContain("EX");
      expect(lockOpts).toContain("NX");

      // Finalize via Lua script (call 0): verify conditional "delivered" write
      const FINALIZE_SCRIPT =
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3]) else return 0 end';
      expect(redisClient.eval).toHaveBeenCalledWith(
        FINALIZE_SCRIPT,
        1,
        expect.stringMatching(/^notif-dedup:ORDER_FILLED:user-1:[a-f0-9]{16}$/),
        expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        "delivered",
        "86400",
      );
    });

    it("does not enqueue digest items for deduped events", async () => {
      const prefs = makePrefs({ notificationFreq: "DAILY" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      // First handle: delivery NX OK, in-app NX OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const enqueueSpy = vi
        .spyOn(service, "enqueueDigest")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(enqueueSpy).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // Second handle — delivery NX returns null, GET returns "delivered" → deduped
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it("does not set the dedup marker when templates.build() throws", async () => {
      // Delivery dedup NX succeeds, then templates.build throws — lock expires in DEDUP_LOCK_TTL
      redisClient.set.mockResolvedValueOnce("OK");
      const buildError = new Error("Missing template");
      templates.build.mockImplementationOnce(() => {
        throw buildError;
      });

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(buildError);

      // Only the delivery NX SET was called (before templates.build).
      // In-app dedup and TTL extend were never reached.
      expect(redisClient.set).toHaveBeenCalledTimes(1);
    });

    it("does not set the dedup marker when enqueueDigest throws", async () => {
      const prefs = makePrefs({ notificationFreq: "DAILY" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );

      // Delivery dedup NX OK, in-app dedup SET NX OK
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
      // But rpush (used by enqueueDigest) fails
      const redisError = new Error("Redis rpush failed");
      redisClient.rpush.mockRejectedValueOnce(redisError);

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(redisError);

      // Delivery NX + in-app NX were called. The TTL extend was never reached
      // because enqueueDigest threw.
      expect(redisClient.set).toHaveBeenCalledTimes(2);
    });

    it("does not set the dedup marker when dispatch throws", async () => {
      // Delivery dedup NX OK, in-app dedup SET NX OK
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
      // But toHtml (used by dispatch) fails
      const dispatchError = new Error("toHtml failed");
      templates.toHtml.mockImplementationOnce(() => {
        throw dispatchError;
      });

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(dispatchError);

      // Delivery NX + in-app NX were called. The TTL extend was never reached
      // because dispatch threw.
      expect(redisClient.set).toHaveBeenCalledTimes(2);
    });

    it("sets the dedup marker on success and blocks replay", async () => {
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(dispatchSpy).toHaveBeenCalledOnce();

      // Finalize eval call exists (conditional lock→delivered transition), not a release
      const deliveryEvalCalls = redisClient.eval.mock.calls.filter(
        ([_script, _keyCount, key]) =>
          typeof key === "string" && key.startsWith("notif-dedup:"),
      );
      expect(deliveryEvalCalls).toHaveLength(1);

      const buildCalls = templates.build.mock.calls.length;
      const xaddCalls = redis.xadd.mock.calls.length;

      // Second handle — delivery NX returns null, GET returns "delivered" → deduped
      dispatchSpy.mockRestore();
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });
      expect(templates.build).toHaveBeenCalledTimes(buildCalls);
      expect(redis.xadd).toHaveBeenCalledTimes(xaddCalls);
    });

    it("retries successfully on replay after a prior failure did not set the marker", async () => {
      // First attempt: delivery NX OK, then templates.build throws.
      // The lock expires after DEDUP_LOCK_TTL (120s); in tests clearAllMocks
      // resets the mock so the retry sees a fresh "OK" from the default mock.
      redisClient.set.mockResolvedValueOnce("OK");
      const buildError = new Error("Missing template");
      templates.build.mockImplementationOnce(() => {
        throw buildError;
      });

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(buildError);

      // Delivery NX was acquired before templates.build threw
      expect(redisClient.set).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Second attempt (replay): delivery NX OK, in-app OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      templates.build.mockReturnValue(STUB_CONTENT);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(templates.build).toHaveBeenCalled();
    });

    it("skips delivery when SET NX finds an existing dedup marker", async () => {
      // Delivery dedup SET NX returns null — marker already exists from prior delivery.
      // GET returns "delivered" → safe to skip.
      redisClient.set.mockResolvedValueOnce(null);
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // SET NX was called once; GET was called to check the value; no retry
      expect(redisClient.set).toHaveBeenCalledTimes(1);
      expect(redisClient.get).toHaveBeenCalledTimes(1);
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("does not throw when the final dedup marker finalization fails after successful fanout", async () => {
      // Delivery dedup NX succeeds, in-app dedup SET succeeds, finalize eval throws
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup
      redisClient.eval.mockRejectedValueOnce(
        new Error("Redis EVAL failed after fanout"),
      );

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // handle() must NOT throw — the notification was already delivered
      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).resolves.toBeUndefined();

      // Fanout completed successfully (dispatch was called)
      expect(dispatchSpy).toHaveBeenCalledOnce();
      // In-app notification was pushed (dedup SET succeeded)
      expect(redis.xadd).toHaveBeenCalledOnce();
      // Delivery NX + in-app NX (2 set calls); finalize eval was called
      expect(redisClient.set).toHaveBeenCalledTimes(2);
      expect(redisClient.eval).toHaveBeenCalled();
    });

    it("throws when SET NX finds an in-flight lock (prevents reclaim from ACKing a lost entry)", async () => {
      // Another handler (e.g. normal consumer) acquired the lock first
      // with its own owner token UUID.
      // The reclaim handler must NOT return success — the original handler
      // may still crash, and ACKing would lose the notification.
      redisClient.set.mockResolvedValueOnce(null); // NX → key exists
      redisClient.get.mockResolvedValueOnce(
        "e1a2b3c4-d5e6-7890-abcd-ef1234567890",
      ); // owner token UUID → in-flight

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(/In-flight delivery lock/);

      // SET NX was called (attempted lock) and GET was called (checked value)
      expect(redisClient.set).toHaveBeenCalledTimes(1);
      expect(redisClient.get).toHaveBeenCalledTimes(1);
      // No fanout — templates.build was never called
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("returns normally when SET NX finds a delivered marker (dedup, safe to ACK)", async () => {
      // A prior handler already delivered this event.
      // The reclaim handler should return normally so PEL can be cleaned up.
      redisClient.set.mockResolvedValueOnce(null); // NX → key exists
      redisClient.get.mockResolvedValueOnce("delivered"); // value is "delivered"

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Only SET NX was called; GET was called to check the value
      expect(redisClient.set).toHaveBeenCalledTimes(1);
      expect(redisClient.get).toHaveBeenCalledTimes(1);
      // No fanout — delivery was already completed
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("retries acquisition when the dedup key expired and retry succeeds", async () => {
      // The original handler acquired the lock, then crashed.  The lock
      // expired (120s TTL), so GET returns null.  Retry SET NX re-acquires
      // the lock and processing proceeds normally.
      redisClient.set
        .mockResolvedValueOnce(null) // first SET NX → key exists (but about to expire)
        .mockResolvedValueOnce("OK") // retry SET NX → acquired
        .mockResolvedValueOnce("OK"); // in-app dedup SET

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Two SET NX calls (first + retry) plus in-app = 3 total
      expect(redisClient.set).toHaveBeenCalledTimes(3);
      // Fanout proceeded after retry
      expect(dispatchSpy).toHaveBeenCalledOnce();
      expect(templates.build).toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledOnce();
    });

    it("throws when the dedup key expired and retry also fails", async () => {
      // First SET NX finds the key exists.  GET returns null (expired).
      // Retry SET NX also returns null (another handler grabbed the lock
      // in the micro-window).  Must throw so reclaim does NOT ACK.
      redisClient.set
        .mockResolvedValueOnce(null) // first SET NX → key exists
        .mockResolvedValueOnce(null); // retry SET NX → still locked

      await expect(
        service.handle("ORDER_FILLED", { ...ORDER_DATA }),
      ).rejects.toThrow(
        /Delivery lock held for ORDER_FILLED user=user-1 after retry/,
      );

      expect(redisClient.set).toHaveBeenCalledTimes(2);
      expect(templates.build).not.toHaveBeenCalled();
    });

    it("renews the delivery lock TTL via value-checked EVAL during fanout", async () => {
      vi.useFakeTimers();

      // Lock NX OK, in-app dedup OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup

      // Hold dispatch open so we can advance timers while the lock is held
      let finishDispatch: () => void;
      const barrier = new Promise<void>((r) => {
        finishDispatch = r;
      });
      vi.spyOn(service, "dispatch").mockReturnValue(barrier);

      const done = service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Flush microtasks: lock acquired, renewal started, pushInApp done, dispatch waiting
      await vi.advanceTimersByTimeAsync(0);

      const RENEW_LOCK_SCRIPT =
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("EXPIRE", KEYS[1], ARGV[2]) else return 0 end';

      // Advance past one renewal tick (DEDUP_LOCK_TTL / 3 ≈ 40s, tick at 40000 ms)
      await vi.advanceTimersByTimeAsync(41000);

      expect(redisClient.eval).toHaveBeenCalledWith(
        RENEW_LOCK_SCRIPT,
        1,
        expect.stringMatching(/^notif-dedup:ORDER_FILLED:user-1:[a-f0-9]{16}$/),
        expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        "120",
      );

      // Advance past a second renewal tick to confirm periodic renewal
      vi.clearAllMocks();
      await vi.advanceTimersByTimeAsync(41000);

      expect(redisClient.eval).toHaveBeenCalledWith(
        RENEW_LOCK_SCRIPT,
        1,
        expect.stringMatching(/^notif-dedup:ORDER_FILLED:user-1:[a-f0-9]{16}$/),
        expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        "120",
      );

      // Unblock dispatch and let handle() finish
      finishDispatch!();
      await done;

      vi.useRealTimers();
    });

    it("dispatches webhooks fire-and-forget — delivered marker written without waiting", async () => {
      // Lock NX OK, in-app dedup OK
      redisClient.set
        .mockResolvedValueOnce("OK") // delivery dedup NX
        .mockResolvedValueOnce("OK"); // in-app dedup
      // Finalize eval returns 1 (delivered marker written)
      redisClient.eval.mockResolvedValue(1);

      // Hold webhook dispatch open so we can verify it is NOT awaited
      let finishWebhook: () => void;
      const webhookBarrier = new Promise<void>((r) => {
        finishWebhook = r;
      });
      webhookDispatcher.dispatch.mockReturnValue(webhookBarrier);

      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // Start handle() — should NOT block on webhook barrier
      const handlePromise = service.handle("ORDER_FILLED", { ...ORDER_DATA });

      // Wait for microtasks to flush and handle() to complete
      await handlePromise;

      // handle() completed without waiting for webhooks — the delivered marker
      // was written (eval called with "delivered" as ARGV[2])
      const deliveredEvalCalls = redisClient.eval.mock.calls.filter(
        ([_script, _keyCount, key, _arg1, arg2]) =>
          typeof key === "string" &&
          key.startsWith("notif-dedup:") &&
          arg2 === "delivered",
      );
      expect(deliveredEvalCalls).toHaveLength(1);

      // Cleanup: unblock the webhook barrier so the promise settles
      finishWebhook!();
      await webhookBarrier;
    });

    it("does NOT dedup identical payloads with different _streamEntryId (cross-entry uniqueness)", async () => {
      // Two stream entries with identical business payload but different IDs
      // must produce different dedup keys so the second is not suppressed.
      redisClient.set
        .mockResolvedValueOnce("OK") // entry-1: delivery NX → acquired
        .mockResolvedValueOnce("OK") // in-app dedup
        .mockResolvedValueOnce("OK") // entry-2: delivery NX → acquired (different key)
        .mockResolvedValueOnce("OK"); // in-app dedup

      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      await service.handle("ORDER_FILLED", {
        ...ORDER_DATA,
        _streamEntryId: "1715706456789-0",
      });
      expect(dispatchSpy).toHaveBeenCalledOnce();

      // Same payload, different stream entry ID — must NOT be deduped
      await service.handle("ORDER_FILLED", {
        ...ORDER_DATA,
        _streamEntryId: "1715706456789-1",
      });
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
