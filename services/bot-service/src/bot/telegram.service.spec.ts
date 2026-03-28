import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelegramService } from "./telegram.service";

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

describe("TelegramService", () => {
  let commands: ReturnType<typeof makeCommandsMock>;
  let linking: ReturnType<typeof makeLinkingMock>;
  let svc: TelegramService;

  beforeEach(() => {
    commands = makeCommandsMock();
    linking = makeLinkingMock();
    svc = new TelegramService(commands, linking);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── dispatch (private, accessed via cast) ────────────────────────────────

  describe("dispatch", () => {
    it("/start returns welcome message without requiring linked account", async () => {
      const result = await (svc as any).dispatch("chat-1", "/start");
      expect(result).toContain("Welcome to");
      expect(result).toContain("Polyforge Bot");
      expect(linking.getUserId).not.toHaveBeenCalled();
    });

    it("/help returns help text without requiring linked account", async () => {
      commands.execute.mockResolvedValue("help text");
      const result = await (svc as any).dispatch("chat-1", "/help");
      expect(result).toBe("help text");
      expect(commands.execute).toHaveBeenCalledWith(
        "userId-not-needed",
        "/help",
      );
    });

    it("/connect without code returns usage message", async () => {
      const result = await (svc as any).dispatch("chat-1", "/connect");
      expect(result).toContain("Usage: /connect");
    });

    it("/connect with code delegates to linking.connect", async () => {
      linking.connect.mockResolvedValue("Account linked!");
      const result = await (svc as any).dispatch("chat-1", "/connect ABC123");
      expect(result).toBe("Account linked!");
      expect(linking.connect).toHaveBeenCalledWith(
        "TELEGRAM",
        "chat-1",
        "ABC123",
      );
    });

    it("/disconnect delegates to linking.disconnect", async () => {
      linking.disconnect.mockResolvedValue("Unlinked!");
      const result = await (svc as any).dispatch("chat-1", "/disconnect");
      expect(result).toBe("Unlinked!");
      expect(linking.disconnect).toHaveBeenCalledWith("TELEGRAM", "chat-1");
    });

    it("returns link prompt for unlinked user on authenticated commands", async () => {
      linking.getUserId.mockResolvedValue(null);
      const result = await (svc as any).dispatch("chat-1", "/status");
      expect(result).toContain("link your account");
      expect(commands.execute).not.toHaveBeenCalled();
    });

    it("delegates to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-123");
      commands.execute.mockResolvedValue("status result");
      const result = await (svc as any).dispatch("chat-1", "/status");
      expect(result).toBe("status result");
      expect(commands.execute).toHaveBeenCalledWith("user-123", "/status");
    });

    it("passes full text to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-123");
      commands.execute.mockResolvedValue("pnl result");
      await (svc as any).dispatch("chat-1", "/pnl Alpha");
      expect(commands.execute).toHaveBeenCalledWith("user-123", "/pnl Alpha");
    });
  });

  // ─── send ─────────────────────────────────────────────────────────────────

  describe("send", () => {
    it("does not call fetch when bot is disabled", async () => {
      // TelegramService checks this.enabled which is set at construction
      // Since TOKEN defaults to 'dev-disabled', the bot is disabled
      vi.stubGlobal("fetch", vi.fn());
      await svc.send("chat-1", "test message");
      expect(fetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe("onModuleInit", () => {
    it("does not start polling when disabled", () => {
      svc.onModuleInit();
      expect((svc as any).running).toBe(false);
      expect((svc as any).loopPromise).toBeNull();
    });
  });

  // ─── onModuleDestroy ──────────────────────────────────────────────────────

  describe("onModuleDestroy", () => {
    it("sets running to false and awaits loop promise", async () => {
      (svc as any).running = true;
      (svc as any).loopPromise = Promise.resolve();

      await svc.onModuleDestroy();

      expect((svc as any).running).toBe(false);
    });

    it("handles null loopPromise gracefully", async () => {
      (svc as any).running = false;
      (svc as any).loopPromise = null;

      await expect(svc.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  // ─── sleep ────────────────────────────────────────────────────────────────

  describe("sleep", () => {
    it("returns a promise that resolves", async () => {
      vi.useFakeTimers();
      const promise = (svc as any).sleep(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });
});
