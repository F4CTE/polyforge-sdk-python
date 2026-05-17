import { describe, it, expect, vi, afterEach } from "vitest";
import { TelegramService } from "./telegram.service";

// TelegramService reads TOKEN at module load time.
// We re-import fresh instances in tests that need the enabled path by
// setting the env var before constructing the service manually.

const REAL_TOKEN = "bot-token-12345";

describe("TelegramService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ─── When Telegram is disabled (default dev token) ───────────────────────

  describe('when TELEGRAM_BOT_TOKEN is "dev-disabled" (default)', () => {
    it("does not call fetch and returns without error", async () => {
      vi.stubEnv("TELEGRAM_BOT_TOKEN", "dev-disabled");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const service = new TelegramService();
      await service.send("chat-123", "hello");

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── When Telegram is enabled ─────────────────────────────────────────────

  describe("when TELEGRAM_BOT_TOKEN is set to a real token", () => {
    function makeEnabledService(): TelegramService {
      const svc = new TelegramService();
      (svc as any).enabled = true;
      (svc as any).TOKEN = REAL_TOKEN;
      // Skip actual sleep delays so retry tests run synchronously
      vi.spyOn(svc as any, "sleep").mockResolvedValue(undefined);
      return svc;
    }

    it("calls fetch with the correct Telegram Bot API URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();

      await service.send("chat-999", "<b>Hello</b>");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/https:\/\/api\.telegram\.org\/bot.*\/sendMessage/);
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "Content-Type": "application/json",
      });
    });

    it("sends the correct chat_id and text in the request body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chat-999", "<b>Hello</b>");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.chat_id).toBe("chat-999");
      expect(body.text).toBe("<b>Hello</b>");
      expect(body.parse_mode).toBe("HTML");
    });

    it("throws immediately on 4xx errors without retrying", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"description":"Bad Request"}',
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chat-999", "test")).rejects.toThrow(
        /Telegram API error 400/,
      );

      // 4xx errors are not transient — should not retry
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry on non-fetch errors (plain Error)", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("Unexpected local error"));
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chat-999", "test")).rejects.toThrow(
        "Unexpected local error",
      );

      // Plain Error (not TypeError) is not transient — should not retry
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries on network errors and succeeds on second attempt", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries on 5xx errors", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries on 429 (rate limit) errors", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => '{"description":"Too Many Requests"}',
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries on transient errors", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValue(new TypeError("fetch failed"));
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chat-999", "test")).rejects.toThrow(
        "fetch failed",
      );

      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("does not throw when response is ok", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chat-111", "msg")).resolves.toBeUndefined();
    });

    it("applies jitter to the retry delay", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = new TelegramService();
      (service as any).enabled = true;
      (service as any).TOKEN = REAL_TOKEN;
      const sleepSpy = vi
        .spyOn(service as any, "sleep")
        .mockResolvedValue(undefined);

      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(sleepSpy).toHaveBeenCalledTimes(3);
      // attempt=1 → base=1000, jitter=125, delay=1125
      expect(sleepSpy.mock.calls[0][0]).toBe(1125);
      // attempt=2 → base=2000, jitter=250, delay=2250
      expect(sleepSpy.mock.calls[1][0]).toBe(2250);
      // attempt=3 → base=4000, jitter=500, delay=4500
      expect(sleepSpy.mock.calls[2][0]).toBe(4500);
    });

    it("honours Telegram retry_after hint on 429 instead of exponential backoff", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () =>
            '{"ok":false,"error_code":429,"description":"Too Many Requests","parameters":{"retry_after":15}}',
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = new TelegramService();
      (service as any).enabled = true;
      (service as any).TOKEN = REAL_TOKEN;
      const sleepSpy = vi
        .spyOn(service as any, "sleep")
        .mockResolvedValue(undefined);

      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      // Should use retry_after * 1000 = 15000ms, not exponential backoff
      expect(sleepSpy.mock.calls[0][0]).toBe(15_000);
    });

    it("caps Telegram retry_after delay at MAX_DELAY_MS", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () =>
            '{"ok":false,"error_code":429,"description":"Too Many Requests","parameters":{"retry_after":120}}',
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = new TelegramService();
      (service as any).enabled = true;
      (service as any).TOKEN = REAL_TOKEN;
      const sleepSpy = vi
        .spyOn(service as any, "sleep")
        .mockResolvedValue(undefined);

      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      // 120s hint is capped to MAX_DELAY_MS (30000ms)
      expect(sleepSpy.mock.calls[0][0]).toBe(30_000);
    });

    it("falls back to exponential backoff when retry_after is non-numeric", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () =>
            '{"ok":false,"error_code":429,"description":"Too Many Requests","parameters":{"retry_after":"abc"}}',
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      vi.spyOn(Math, "random").mockReturnValue(0);

      const service = new TelegramService();
      (service as any).enabled = true;
      (service as any).TOKEN = REAL_TOKEN;
      const sleepSpy = vi
        .spyOn(service as any, "sleep")
        .mockResolvedValue(undefined);

      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      // Non-numeric → falls back to exponential:
      // attempt=1 base=1000, jitter=0, delay=1000
      expect(sleepSpy.mock.calls[0][0]).toBe(1000);
    });

    it("falls back to exponential backoff when 429 response has no retry_after", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () =>
            '{"ok":false,"error_code":429,"description":"Too Many Requests"}',
        })
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      vi.spyOn(Math, "random").mockReturnValue(0);

      const service = new TelegramService();
      (service as any).enabled = true;
      (service as any).TOKEN = REAL_TOKEN;
      const sleepSpy = vi
        .spyOn(service as any, "sleep")
        .mockResolvedValue(undefined);

      await service.send("chat-999", "test");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      // Falls back to exponential: attempt=1 base=1000, jitter=0, delay=1000
      expect(sleepSpy.mock.calls[0][0]).toBe(1000);
    });
  });
});
