import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DiscordService } from "./discord.service";

describe("DiscordService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // ─── When Discord is disabled (default dev token) ─────────────────────────

  describe('when DISCORD_BOT_TOKEN is "dev-disabled" (default)', () => {
    it("does not call fetch and resolves without error", async () => {
      vi.stubEnv("DISCORD_BOT_TOKEN", "dev-disabled");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const service = new DiscordService();
      await service.send("channel-123", "hello");

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── When Discord is enabled ──────────────────────────────────────────────

  describe("when DISCORD_BOT_TOKEN is set to a real token", () => {
    function makeEnabledService(): DiscordService {
      const service = new DiscordService();
      (service as any).enabled = true;
      return service;
    }

    it("calls fetch with the correct Discord channel messages URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chan-456", "**Alert**\n\nSomething happened.");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://discord.com/api/v10/channels/chan-456/messages",
      );
    });

    it("sends the request with correct method and headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chan-456", "Hello Discord!");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      // Authorization header must be present and use Bot scheme
      expect((init.headers as Record<string, string>)["Authorization"]).toMatch(
        /^Bot /,
      );
    });

    it("includes the message content in the request body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      const message = "**Price Alert**\n\nToken reached 0.90.";
      await service.send("chan-456", message);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      // Discord now sends embeds instead of plain content
      expect(body.embeds?.[0]?.description ?? body.content).toContain("Token reached 0.90");
    });

    it("throws when the Discord API responds with a non-ok status", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => '{"message":"Missing Permissions"}',
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chan-456", "test")).rejects.toThrow(
        /Discord API error 403/,
      );
    });

    it("propagates fetch network errors", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chan-456", "test")).rejects.toThrow(
        "ETIMEDOUT",
      );
    });

    it("resolves without error on successful send", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await expect(service.send("chan-789", "msg")).resolves.toBeUndefined();
    });

    it("embeds the channelId in the URL per call", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const service = makeEnabledService();
      await service.send("chan-AAA", "first");
      await service.send("chan-BBB", "second");

      const [url1] = fetchMock.mock.calls[0] as [string, RequestInit];
      const [url2] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(url1).toContain("chan-AAA");
      expect(url2).toContain("chan-BBB");
    });
  });
});
