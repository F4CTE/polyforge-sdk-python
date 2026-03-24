import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PrismaService } from "@polyforge/shared-db";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";
import { createHmac } from "crypto";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-1",
    url: "https://example.com/hook",
    secret: "test-secret-hex",
    ...overrides,
  };
}

function makeMockPrisma() {
  return {
    webhook: {
      findMany: vi.fn(),
    },
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────────────

describe("WebhookDispatcherService", () => {
  let service: WebhookDispatcherService;
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new WebhookDispatcherService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── dispatch ────────────────────────────────────────────────────────────────

  describe("dispatch", () => {
    it("dispatches to matching webhooks", async () => {
      const webhook = makeWebhook();
      prisma.webhook.findMany.mockResolvedValue([webhook]);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "ORDER_FILLED", { orderId: "123" });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toBe("https://example.com/hook");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event).toBe("ORDER_FILLED");
      expect(callBody.data.orderId).toBe("123");
    });

    it("skips inactive webhooks via the query filter", async () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "ORDER_FILLED", {});

      const whereArg = prisma.webhook.findMany.mock.calls[0][0].where;
      expect(whereArg.active).toBe(true);
      expect(whereArg.events).toEqual({ has: "ORDER_FILLED" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("signs payload with HMAC-SHA256", async () => {
      const secret = "my-webhook-secret";
      const webhook = makeWebhook({ secret });
      prisma.webhook.findMany.mockResolvedValue([webhook]);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "ORDER_FILLED", { test: true });
      await new Promise((r) => setTimeout(r, 50));

      const sentBody = mockFetch.mock.calls[0][1].body;
      const sentHeaders = mockFetch.mock.calls[0][1].headers;
      const expectedSignature = createHmac("sha256", secret)
        .update(sentBody)
        .digest("hex");

      expect(sentHeaders["X-Polyforge-Signature"]).toBe(expectedSignature);
    });

    it("handles fetch failure without crashing", async () => {
      const webhook = makeWebhook();
      prisma.webhook.findMany.mockResolvedValue([webhook]);

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      // Should not throw
      await service.dispatch("user-1", "ORDER_FILLED", {});
      await new Promise((r) => setTimeout(r, 100));

      // Retried once (2 total calls)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does nothing when no webhooks match", async () => {
      prisma.webhook.findMany.mockResolvedValue([]);

      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "NONEXISTENT_EVENT", {});

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
