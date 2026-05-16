import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mockDeep, MockProxy } from "vitest-mock-extended";
import { NotificationService, LockContentionError } from "./notification.service";
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
    exists: vi.fn().mockResolvedValue(0),
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

    it("serialises eventType and raw data into the queued item", async () => {
      const data = { fillPrice: "0.80", size: "100" };
      await service.enqueueDigest(
        "user-42",
        "DAILY",
        "ORDER_FILLED",
        data,
        STUB_CONTENT,
      );

      const [, jsonStr] = redisClient.rpush.mock.calls[0] as [string, string];
      const item = JSON.parse(jsonStr);
      expect(item.eventType).toBe("ORDER_FILLED");
      expect(item.data).toEqual(data);
      expect(item.title).toBeUndefined();
      expect(item.body).toBeUndefined();
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
        data: { fillPrice: "0.80", size: "100" },
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
        makeDigestItem({ data: { fillPrice: "0.80" } }),
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

    it("escapes digest content via templates.build before building email HTML", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);

      // Store raw XSS data in the digest queue (simulating an attacker injecting into Redis)
      const xssData = { fillPrice: '<img src=x onerror="alert(1)">' };
      redisClient.lrange.mockResolvedValueOnce([
        makeDigestItem({
          data: xssData,
          eventType: "ORDER_FILLED",
        }),
      ]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });

      // build() escapes the raw data in its returned content
      templates.build.mockReturnValueOnce({
        title: "Order Filled",
        body: `Your order was filled at &lt;img src=x onerror=&quot;alert(1)&quot;&gt;.`,
        severity: "info",
      });

      await service.flushDigest("HOURLY");

      // build() was called with the raw data from the queue
      expect(templates.build).toHaveBeenCalledWith(
        "ORDER_FILLED",
        xssData,
      );

      // The HTML body should contain the escaped content from build()
      expect(templates.toHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("&lt;img"),
        }),
      );
      const digestHtmlInput = templates.toHtml.mock.calls[0][0].body;
      expect(digestHtmlInput).not.toContain("<img src=x onerror");
      expect(digestHtmlInput).toContain("&lt;img src=x onerror=");
    });

    it("escapes legacy digest entries (title/body without data) in HTML output", async () => {
      const prefs = makePrefs({ emailEnabled: true });
      redisClient.scan.mockResolvedValueOnce(["0", ["digest:hourly:user-1"]]);

      // Legacy entry: stored as {title, body} without a data field before the escaping change.
      // These entries may contain attacker-controlled HTML that must be escaped.
      const legacyItem = JSON.stringify({
        eventType: "LEGACY_EVENT",
        title: "<script>alert(\"xss\")</script>",
        body: "<img src=x onerror=\"alert('xss')\">",
        ts: Date.now(),
      });
      redisClient.lrange.mockResolvedValueOnce([legacyItem]);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      (prisma.user.findUnique as any).mockResolvedValue({
        email: "u@example.com",
      });

      await service.flushDigest("HOURLY");

      // The HTML body must escape both legacy title and body
      expect(templates.toHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("&lt;script&gt;"),
        }),
      );
      const digestHtmlInput = templates.toHtml.mock.calls[0][0].body;
      expect(digestHtmlInput).not.toContain("<script>alert");
      expect(digestHtmlInput).not.toContain('<img src=x onerror');
      expect(digestHtmlInput).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(digestHtmlInput).toContain("&lt;img src=x onerror=&quot;alert");

      // Plaintext body for email/Telegram/Discord keeps the raw values intact
      // mail.send(email, subject, text, html) — text is the 3rd positional arg
      const emailText = mail.send.mock.calls[0][2];
      expect(emailText).toContain('<script>alert("xss")</script>');
      expect(emailText).toContain("<img src=x onerror=");
      expect(emailText).not.toContain("&lt;script&gt;");
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

      // First call: SET NX returns OK → xadd proceeds
      // Second call: SET NX returns null (key already exists) → xadd skipped
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

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

      // Second call with same content — same title+body → deduped
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

      redisClient.set.mockResolvedValueOnce("OK");

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

      // Key should include a content hash suffix after user-1
      const dedupKey: string = redisClient.set.mock.calls[0][0];
      const parts = dedupKey.split(":");
      expect(parts.length).toBeGreaterThanOrEqual(5);
      // Last part is the content hash (alphanumeric)
      expect(parts[parts.length - 1]).toMatch(/^[a-z0-9]+$/);
    });

    it("proceeds with in-app push when dedup SET fails with a Redis error", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      // SET throws an error (e.g. Redis connection lost)
      redisClient.set.mockRejectedValueOnce(new Error("Redis connection lost"));

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

      // SET succeeds
      redisClient.set.mockResolvedValueOnce("OK");
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

      // SET NX returns null → in-app skipped
      redisClient.set.mockResolvedValueOnce(null);

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

      // Two events with different data but same rendered output
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

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

      redisClient.set.mockResolvedValueOnce("OK");

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

    it("distinguishes identical-payload events via streamMsgId in dedup key", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      vi.spyOn(service, "dispatch").mockResolvedValue(undefined);

      templates.build.mockReturnValue({
        ...STUB_CONTENT,
        title: "Order Filled",
        body: "Your order was filled at $0.80.",
      });

      // Two events with same data but different stream entry IDs.
      // Per handle(): idempotency SET NX → in-app dedup SET NX → extend TTL SET
      redisClient.set
        .mockResolvedValueOnce("OK") // idempotency SET NX msg-AAA
        .mockResolvedValueOnce("OK") // in-app dedup msg-AAA
        .mockResolvedValueOnce("OK") // extend TTL msg-AAA
        .mockResolvedValueOnce("OK") // idempotency SET NX msg-BBB
        .mockResolvedValueOnce("OK") // in-app dedup msg-BBB
        .mockResolvedValueOnce("OK"); // extend TTL msg-BBB

      await service.handle(
        "ORDER_FILLED",
        { userId: "user-1", fillPrice: "0.80", size: "100" },
        "msg-AAA",
      );
      expect(redis.xadd).toHaveBeenCalledTimes(1);

      // Same payload, different stream entry — must NOT be deduped
      await service.handle(
        "ORDER_FILLED",
        { userId: "user-1", fillPrice: "0.80", size: "100" },
        "msg-BBB",
      );
      expect(redis.xadd).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Durable idempotency guard (PEL reclaim safety) ─────────────────────

  describe("handle — durable idempotency guard", () => {
    it("throws LockContentionError when the idempotency key holds 'processing' (another worker is in-flight)", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // SET NX fails — another worker holds the delivery lock
      redisClient.set.mockResolvedValueOnce(null);
      // GET returns a value that is not "delivered" — confirms another worker is in-flight
      redisClient.get.mockResolvedValueOnce("some-other-token");

      await expect(
        service.handle(
          "ORDER_FILLED",
          { userId: "user-1", fillPrice: "0.80", size: "100" },
          "msg-replay-1",
        ),
      ).rejects.toThrow(LockContentionError);

      // External dispatch must be skipped
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        "notif:delivered:msg-replay-1",
        expect.any(String),
        "EX",
        300,
        "NX",
      );
    });

    it("returns silently when the idempotency key already holds 'delivered' (successful prior delivery, stale PEL entry)", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // SET NX fails — key exists from a prior successful delivery
      redisClient.set.mockResolvedValueOnce(null);
      // GET returns "delivered" — notification was already delivered
      redisClient.get.mockResolvedValueOnce("delivered");

      await service.handle(
        "ORDER_FILLED",
        { userId: "user-1", fillPrice: "0.80", size: "100" },
        "msg-replay-1",
      );

      // No dispatch, no delivery re-attempted
      expect(dispatchSpy).not.toHaveBeenCalled();
      // Only the SET NX was attempted; no TTL extension
      expect(redisClient.set).toHaveBeenCalledTimes(1);
      expect(redisClient.set).toHaveBeenCalledWith(
        "notif:delivered:msg-replay-1",
        expect.any(String),
        "EX",
        300,
        "NX",
      );
      expect(redisClient.get).toHaveBeenCalledWith(
        "notif:delivered:msg-replay-1",
      );
    });

    it("proceeds with external dispatch when idempotency key is absent (first delivery)", async () => {
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
      mail.send.mockResolvedValue(undefined);

      // SET NX for idempotency guard succeeds (key not held) +
      // SET NX for in-app dedup succeeds
      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

      await service.handle(
        "ORDER_FILLED",
        { userId: "user-1", fillPrice: "0.80", size: "100" },
        "msg-first-1",
      );

      // Must atomically claim with SET NX before delivery
      expect(redisClient.set).toHaveBeenCalledWith(
        "notif:delivered:msg-first-1",
        expect.any(String),
        "EX",
        300,
        "NX",
      );
      // After successful dispatch: atomically verify ownership and extend TTL
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "notif:delivered:msg-first-1",
        expect.any(String),
        "delivered",
        "604800",
      );
    });

    it("still sets delivered marker when individual channel sends fail (errors are handled internally)", async () => {
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
      // SMTP failure — sendEmail catches it internally, dispatch resolves
      mail.send.mockRejectedValue(new Error("SMTP timeout"));

      redisClient.set.mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");

      await service.handle(
        "ORDER_FILLED",
        { userId: "user-1", fillPrice: "0.80", size: "100" },
        "msg-fail-1",
      );

      // Dispatch still proceeds (Promise.allSettled catches per-channel errors)
      // Delivered marker is atomically promoted after successful dispatch
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "notif:delivered:msg-fail-1",
        expect.any(String),
        "delivered",
        "604800",
      );
    });

    it("uses compare-and-delete ownership guard when clearing lock on handleImpl failure", async () => {
      // Lock acquisition succeeds
      redisClient.set.mockResolvedValueOnce("OK"); // idempotency SET NX
      redisClient.set.mockResolvedValueOnce("OK"); // in-app dedup SET NX

      // Cause handleImpl to fail (DB failure in loadPrefs)
      (prisma.notificationPreference.findUnique as any).mockRejectedValue(
        new Error("DB down"),
      );

      // Simulate: this worker still owns the key — DELETE_IF_OWNER_LUA returns 1
      redisClient.eval.mockResolvedValueOnce(1);

      await expect(
        service.handle(
          "ORDER_FILLED",
          { userId: "user-1", fillPrice: "0.80", size: "100" },
          "msg-crash-1",
        ),
      ).rejects.toThrow("DB down");

      // Must call compare-and-delete Lua, not unconditional DEL
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "notif:delivered:msg-crash-1",
        expect.any(String),
      );
      expect(redisClient.del).not.toHaveBeenCalledWith(
        "notif:delivered:msg-crash-1",
      );
    });

    it("does not delete processing lock when another worker has reclaimed the key (stale-writer guard)", async () => {
      // Worker A acquired lock, but TTL expired and Worker B reclaimed
      redisClient.set.mockResolvedValueOnce("OK"); // idempotency SET NX
      redisClient.set.mockResolvedValueOnce("OK"); // in-app dedup SET NX

      // Cause handleImpl to fail
      (prisma.notificationPreference.findUnique as any).mockRejectedValue(
        new Error("DB down"),
      );

      // Simulate: DELETE_IF_OWNER_LUA returns 0 — Worker A's token no
      // longer matches because Worker B has already claimed the key
      redisClient.eval.mockResolvedValueOnce(0);

      await expect(
        service.handle(
          "ORDER_FILLED",
          { userId: "user-1", fillPrice: "0.80", size: "100" },
          "msg-stale-1",
        ),
      ).rejects.toThrow("DB down");

      // eval was called with the compare-and-delete Lua script
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "notif:delivered:msg-stale-1",
        expect.any(String),
      );
      // Never called unconditional del
      expect(redisClient.del).not.toHaveBeenCalledWith(
        "notif:delivered:msg-stale-1",
      );
    });

    it("does not check idempotency when streamMsgId is absent", async () => {
      const prefs = makePrefs({ notificationFreq: "IMMEDIATE" });
      (prisma.notificationPreference.findUnique as any).mockResolvedValue(
        prefs,
      );
      const dispatchSpy = vi
        .spyOn(service, "dispatch")
        .mockResolvedValue(undefined);

      // Only one SET for in-app dedup; no idempotency SET
      redisClient.set.mockResolvedValueOnce("OK");

      await service.handle("ORDER_FILLED", {
        userId: "user-1",
        fillPrice: "0.80",
        size: "100",
      });

      expect(dispatchSpy).toHaveBeenCalledOnce();
      // No idempotency key SET beyond the in-app dedup key
      expect(redisClient.set).toHaveBeenCalledTimes(1);
    });
  });
});
