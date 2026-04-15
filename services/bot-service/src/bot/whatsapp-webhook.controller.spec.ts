import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
});

import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";
import * as crypto from "crypto";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeWhatsAppServiceMock() {
  return {
    handleVerification: vi
      .fn()
      .mockReturnValue({ status: 200, body: "challenge-ok" }),
    handleIncoming: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeReplyMock() {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

function signPayload(body: string, secret: string): string {
  return (
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex")
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WhatsAppWebhookController", () => {
  let whatsapp: ReturnType<typeof makeWhatsAppServiceMock>;
  let controller: WhatsAppWebhookController;

  beforeEach(() => {
    whatsapp = makeWhatsAppServiceMock();
    controller = new WhatsAppWebhookController(whatsapp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET /webhook/whatsapp — verification ─────────────────────────────

  describe("verify", () => {
    it("delegates to whatsapp.handleVerification and returns result", () => {
      whatsapp.handleVerification.mockReturnValue({
        status: 200,
        body: "my-challenge",
      });
      const reply = makeReplyMock();

      controller.verify("subscribe", "polyforge-verify", "my-challenge", reply);

      expect(whatsapp.handleVerification).toHaveBeenCalledWith({
        "hub.mode": "subscribe",
        "hub.verify_token": "polyforge-verify",
        "hub.challenge": "my-challenge",
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith("my-challenge");
    });

    it("returns 403 when service rejects verification", () => {
      whatsapp.handleVerification.mockReturnValue({
        status: 403,
        body: "Forbidden",
      });
      const reply = makeReplyMock();

      controller.verify("subscribe", "wrong-token", "challenge", reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith("Forbidden");
    });
  });

  // ─── POST /webhook/whatsapp — incoming ────────────────────────────────

  describe("incoming", () => {
    it("validates signature and processes valid payload", async () => {
      const body = JSON.stringify({ entry: [] });
      const signature = signPayload(body, "test-app-secret");
      const request = {
        headers: { "x-hub-signature-256": signature },
        body,
      } as any;
      const reply = makeReplyMock();

      await controller.incoming(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith("EVENT_RECEIVED");
      expect(whatsapp.handleIncoming).toHaveBeenCalledWith(body);
    });

    it("rejects with 401 when signature header is missing", async () => {
      const request = {
        headers: {},
        body: JSON.stringify({ entry: [] }),
      } as any;
      const reply = makeReplyMock();

      await controller.incoming(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith("Missing signature");
      expect(whatsapp.handleIncoming).not.toHaveBeenCalled();
    });

    it("rejects with 403 when signature is invalid", async () => {
      const body = JSON.stringify({ entry: [] });
      const request = {
        headers: { "x-hub-signature-256": "sha256=invalid" },
        body,
      } as any;
      const reply = makeReplyMock();

      await controller.incoming(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith("Invalid signature");
      expect(whatsapp.handleIncoming).not.toHaveBeenCalled();
    });

    it("rejects with 500 when app secret is not configured", async () => {
      // Create controller with empty appSecret
      const ctrl = new WhatsAppWebhookController(whatsapp);
      (ctrl as any).appSecret = "";

      const request = {
        headers: { "x-hub-signature-256": "sha256=abc" },
        body: JSON.stringify({ entry: [] }),
      } as any;
      const reply = makeReplyMock();

      await ctrl.incoming(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith("Webhook not configured");
    });

    it("handles object body by stringifying for signature check", async () => {
      const bodyObj = { entry: [{ changes: [] }] };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = signPayload(bodyStr, "test-app-secret");
      const request = {
        headers: { "x-hub-signature-256": signature },
        body: bodyObj,
      } as any;
      const reply = makeReplyMock();

      await controller.incoming(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(whatsapp.handleIncoming).toHaveBeenCalledWith(bodyObj);
    });
  });
});
