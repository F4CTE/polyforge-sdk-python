import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WhatsAppService } from "./whatsapp.service";

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

// ─── Webhook payload helpers ──────────────────────────────────────────────────

function makeWebhookPayload(from: string, text: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeImagePayload(from: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  type: "image",
                  image: { id: "img-1" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WhatsAppService", () => {
  let commands: ReturnType<typeof makeCommandsMock>;
  let linking: ReturnType<typeof makeLinkingMock>;
  let svc: WhatsAppService;

  beforeEach(() => {
    commands = makeCommandsMock();
    linking = makeLinkingMock();
    svc = new WhatsAppService(commands, linking);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Webhook verification ──────────────────────────────────────────────

  describe("handleVerification", () => {
    it("returns 200 with challenge when mode and token match", () => {
      const result = svc.handleVerification({
        "hub.mode": "subscribe",
        "hub.verify_token": "polyforge-verify",
        "hub.challenge": "test-challenge-123",
      });
      expect(result.status).toBe(200);
      expect(result.body).toBe("test-challenge-123");
    });

    it("returns 403 when verify token does not match", () => {
      const result = svc.handleVerification({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "test-challenge",
      });
      expect(result.status).toBe(403);
      expect(result.body).toBe("Forbidden");
    });

    it("returns 403 when mode is not subscribe", () => {
      const result = svc.handleVerification({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "polyforge-verify",
        "hub.challenge": "test-challenge",
      });
      expect(result.status).toBe(403);
    });

    it("returns 403 when mode is missing", () => {
      const result = svc.handleVerification({
        "hub.verify_token": "polyforge-verify",
        "hub.challenge": "test-challenge",
      });
      expect(result.status).toBe(403);
    });

    it("returns empty string when challenge is undefined", () => {
      const result = svc.handleVerification({
        "hub.mode": "subscribe",
        "hub.verify_token": "polyforge-verify",
      });
      expect(result.status).toBe(200);
      expect(result.body).toBe("");
    });
  });

  // ─── Message parsing ──────────────────────────────────────────────────

  describe("parseWebhookMessages (static)", () => {
    it("extracts text messages from webhook payload", () => {
      const payload = makeWebhookPayload("+1234567890", "Hello world");
      const messages = WhatsAppService.parseWebhookMessages(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe("+1234567890");
      expect(messages[0].text).toBe("Hello world");
    });

    it("ignores non-text messages", () => {
      const payload = makeImagePayload("+1234567890");
      const messages = WhatsAppService.parseWebhookMessages(payload);
      expect(messages).toHaveLength(0);
    });

    it("handles empty payload gracefully", () => {
      expect(WhatsAppService.parseWebhookMessages({})).toEqual([]);
      expect(WhatsAppService.parseWebhookMessages(null)).toEqual([]);
      expect(WhatsAppService.parseWebhookMessages(undefined)).toEqual([]);
    });

    it("handles payload with no messages", () => {
      const payload = {
        entry: [{ changes: [{ value: {} }] }],
      };
      const messages = WhatsAppService.parseWebhookMessages(payload);
      expect(messages).toHaveLength(0);
    });

    it("extracts multiple messages from multiple entries", () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { from: "+111", type: "text", text: { body: "msg1" } },
                    { from: "+222", type: "text", text: { body: "msg2" } },
                  ],
                },
              },
            ],
          },
        ],
      };
      const messages = WhatsAppService.parseWebhookMessages(payload);
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe("msg1");
      expect(messages[1].text).toBe("msg2");
    });
  });

  // ─── dispatch (private, accessed via cast) ────────────────────────────

  describe("dispatch", () => {
    it("/start returns welcome message with WhatsApp formatting", async () => {
      const result = await (svc as any).dispatch("+1234567890", "/start");
      expect(result).toContain("Welcome to");
      expect(result).toContain("Polyforge Bot");
      expect(result).toContain("WhatsApp"); // mentions WhatsApp specifically
      expect(linking.getUserId).not.toHaveBeenCalled();
    });

    it("/help returns help text without requiring linked account", async () => {
      commands.execute.mockResolvedValue("help text");
      const result = await (svc as any).dispatch("+1234567890", "/help");
      expect(result).toBe("help text");
      expect(commands.execute).toHaveBeenCalledWith(
        "userId-not-needed",
        "/help",
      );
    });

    it("/connect without code returns usage message", async () => {
      const result = await (svc as any).dispatch("+1234567890", "/connect");
      expect(result).toContain("Usage: /connect");
    });

    it("/connect with code delegates to linking.connect with WHATSAPP", async () => {
      linking.connect.mockResolvedValue("Account linked!");
      const result = await (svc as any).dispatch(
        "+1234567890",
        "/connect ABC123",
      );
      expect(result).toBe("Account linked!");
      expect(linking.connect).toHaveBeenCalledWith(
        "WHATSAPP",
        "+1234567890",
        "ABC123",
      );
    });

    it("/disconnect delegates to linking.disconnect with WHATSAPP", async () => {
      linking.disconnect.mockResolvedValue("Unlinked!");
      const result = await (svc as any).dispatch("+1234567890", "/disconnect");
      expect(result).toBe("Unlinked!");
      expect(linking.disconnect).toHaveBeenCalledWith(
        "WHATSAPP",
        "+1234567890",
      );
    });

    it("returns link prompt for unlinked user on authenticated commands", async () => {
      linking.getUserId.mockResolvedValue(null);
      const result = await (svc as any).dispatch("+1234567890", "/status");
      expect(result).toContain("link your account");
      expect(commands.execute).not.toHaveBeenCalled();
    });

    it("delegates to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-789");
      commands.execute.mockResolvedValue("status result");
      const result = await (svc as any).dispatch("+1234567890", "/status");
      expect(result).toBe("status result");
      expect(commands.execute).toHaveBeenCalledWith("user-789", "/status");
    });

    it("passes full text to commands.execute for linked user", async () => {
      linking.getUserId.mockResolvedValue("user-789");
      commands.execute.mockResolvedValue("whale result");
      await (svc as any).dispatch("+1234567890", "/whale 0xabc");
      expect(commands.execute).toHaveBeenCalledWith(
        "user-789",
        "/whale 0xabc",
      );
    });
  });

  // ─── send ─────────────────────────────────────────────────────────────

  describe("send", () => {
    it("does not call fetch when bot is disabled", async () => {
      // WhatsAppService checks this.enabled which is set at construction
      // Since TOKEN defaults to 'dev-disabled', the bot is disabled
      vi.stubGlobal("fetch", vi.fn());
      await svc.send("+1234567890", "test message");
      expect(fetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  // ─── handleIncoming ───────────────────────────────────────────────────

  describe("handleIncoming", () => {
    it("does nothing when disabled", async () => {
      const payload = makeWebhookPayload("+1234567890", "/help");
      await svc.handleIncoming(payload);
      // Since bot is disabled, commands.execute should not be called
      expect(commands.execute).not.toHaveBeenCalled();
    });

    it("ignores non-command messages when enabled", async () => {
      // Simulate enabled state
      (svc as any).enabled = true;
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      const payload = makeWebhookPayload("+1234567890", "hello world");
      await svc.handleIncoming(payload);

      // Non-command messages (no leading /) are ignored
      expect(commands.execute).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("ignores non-text message types when enabled", async () => {
      (svc as any).enabled = true;
      const payload = makeImagePayload("+1234567890");
      await svc.handleIncoming(payload);
      expect(commands.execute).not.toHaveBeenCalled();
    });

    it("handles empty payload gracefully", async () => {
      (svc as any).enabled = true;
      await expect(svc.handleIncoming({})).resolves.not.toThrow();
      await expect(svc.handleIncoming(null)).resolves.not.toThrow();
      await expect(svc.handleIncoming(undefined)).resolves.not.toThrow();
    });
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────

  describe("onModuleInit", () => {
    it("does not throw when disabled", () => {
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  // ─── Response formatting ──────────────────────────────────────────────

  describe("WhatsApp response formatting", () => {
    it("/start uses WhatsApp bold syntax (*text*)", async () => {
      const result = await (svc as any).dispatch("+1234567890", "/start");
      expect(result).toContain("*Polyforge Bot*");
      expect(result).toContain("*Settings");
    });
  });
});
