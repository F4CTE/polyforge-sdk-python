import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiscordService } from "./discord.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeCommandsMock() {
  return {
    execute: vi.fn().mockResolvedValue("command result"),
  } as any;
}

function makeLinkingMock() {
  return {
    getUserId: vi.fn().mockResolvedValue(null),
    connect: vi.fn().mockResolvedValue("linked"),
    disconnect: vi.fn().mockResolvedValue("unlinked"),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DiscordService", () => {
  let commands: ReturnType<typeof makeCommandsMock>;
  let linking: ReturnType<typeof makeLinkingMock>;
  let svc: DiscordService;

  beforeEach(() => {
    commands = makeCommandsMock();
    linking = makeLinkingMock();
    svc = new DiscordService(commands, linking);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── dispatchDiscord (private, accessed via cast) ─────────────────────────

  describe("dispatchDiscord", () => {
    it("/start returns welcome message with Discord-style markdown", async () => {
      const result = await (svc as any).dispatchDiscord("ch-1", "/start");
      expect(result).toContain("Welcome to");
      expect(result).toContain("Polyforge Bot");
      expect(result).toContain("**"); // Discord uses markdown bold
      expect(linking.getUserId).not.toHaveBeenCalled();
    });

    it("/help returns help text without requiring linked account", async () => {
      commands.execute.mockResolvedValue("help text");
      const result = await (svc as any).dispatchDiscord("ch-1", "/help");
      expect(result).toBe("help text");
      expect(commands.execute).toHaveBeenCalledWith(
        "userId-not-needed",
        "/help",
      );
    });

    it("/connect without code returns usage message with Discord formatting", async () => {
      const result = await (svc as any).dispatchDiscord("ch-1", "/connect");
      expect(result).toContain("Usage:");
      expect(result).toContain("`/connect");
    });

    it("/connect with code delegates to linking.connect with DISCORD channel", async () => {
      linking.connect.mockResolvedValue("Account linked!");
      const result = await (svc as any).dispatchDiscord(
        "ch-1",
        "/connect XYZ789",
      );
      expect(result).toBe("Account linked!");
      expect(linking.connect).toHaveBeenCalledWith("DISCORD", "ch-1", "XYZ789");
    });

    it("/disconnect delegates to linking.disconnect with DISCORD channel", async () => {
      linking.disconnect.mockResolvedValue("Unlinked!");
      const result = await (svc as any).dispatchDiscord("ch-1", "/disconnect");
      expect(result).toBe("Unlinked!");
      expect(linking.disconnect).toHaveBeenCalledWith("DISCORD", "ch-1");
    });

    it("returns link prompt for unlinked user on authenticated commands", async () => {
      linking.getUserId.mockResolvedValue(null);
      const result = await (svc as any).dispatchDiscord("ch-1", "/status");
      expect(result).toContain("link your account");
      expect(result).toContain("`/start`");
      expect(commands.execute).not.toHaveBeenCalled();
    });

    it("delegates to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-456");
      commands.execute.mockResolvedValue("pnl data");
      const result = await (svc as any).dispatchDiscord("ch-1", "/pnl");
      expect(result).toBe("pnl data");
      expect(commands.execute).toHaveBeenCalledWith("user-456", "/pnl");
    });

    it("passes full text to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-456");
      await (svc as any).dispatchDiscord("ch-1", "/stop MyStrategy");
      expect(commands.execute).toHaveBeenCalledWith(
        "user-456",
        "/stop MyStrategy",
      );
    });
  });

  // ─── send ─────────────────────────────────────────────────────────────────

  describe("send", () => {
    it("does not send when bot is disabled", async () => {
      // TOKEN defaults to 'dev-disabled' so enabled = false
      await expect(svc.send("ch-1", "test")).resolves.not.toThrow();
    });

    it("does not send when client is null", async () => {
      (svc as any).enabled = true;
      (svc as any).client = null;
      await expect(svc.send("ch-1", "test")).resolves.not.toThrow();
    });

    it("fetches channel and sends content when enabled", async () => {
      const mockChannel = { send: vi.fn().mockResolvedValue({}) };
      const mockClient = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };
      (svc as any).enabled = true;
      (svc as any).client = mockClient;

      await svc.send("ch-1", "hello");

      expect(mockClient.channels.fetch).toHaveBeenCalledWith("ch-1");
      expect(mockChannel.send).toHaveBeenCalledWith("hello");
    });

    it("catches and logs send errors without throwing", async () => {
      const mockClient = {
        channels: {
          fetch: vi.fn().mockRejectedValue(new Error("Channel not found")),
        },
      };
      (svc as any).enabled = true;
      (svc as any).client = mockClient;

      await expect(svc.send("ch-1", "test")).resolves.not.toThrow();
    });
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe("onModuleInit", () => {
    it("does not initialize when disabled", async () => {
      await svc.onModuleInit();
      expect((svc as any).client).toBeNull();
    });
  });

  // ─── onModuleDestroy ──────────────────────────────────────────────────────

  describe("onModuleDestroy", () => {
    it("does nothing when client is null", async () => {
      (svc as any).client = null;
      await expect(svc.onModuleDestroy()).resolves.not.toThrow();
    });

    it("destroys client when present", async () => {
      const mockClient = { destroy: vi.fn().mockResolvedValue(undefined) };
      (svc as any).client = mockClient;

      await svc.onModuleDestroy();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it("handles destroy errors gracefully", async () => {
      const mockClient = {
        destroy: vi.fn().mockRejectedValue(new Error("Already destroyed")),
      };
      (svc as any).client = mockClient;

      await expect(svc.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
