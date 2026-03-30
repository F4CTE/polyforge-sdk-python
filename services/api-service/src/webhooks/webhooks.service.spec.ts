import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { WebhooksService } from "./webhooks.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() {
  return `wh-${++_idCounter}`;
}

function makeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: uid(),
    userId: "user-1",
    url: "https://example.com/hook",
    events: ["ORDER_FILLED"],
    secret: "abc123hex",
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────────────

describe("WebhooksService", () => {
  let service: WebhooksService;
  let db: MockDb;

  beforeEach(() => {
    _idCounter = 0;
    db = createMockDb();
    service = new WebhooksService(db as unknown as PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("generates an HMAC secret and returns it on creation", async () => {
      db.webhook.count.mockResolvedValue(0);
      (db.webhook.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: uid(),
          ...data,
          createdAt: new Date(),
        }),
      );

      const result = await service.create("user-1", {
        url: "https://example.com/hook",
        events: ["ORDER_FILLED"],
      });

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBe(64); // 32 bytes = 64 hex chars
      expect(result.url).toBe("https://example.com/hook");
      expect(result.events).toEqual(["ORDER_FILLED"]);
      expect(result.active).toBe(true);
    });

    it("validates URL is passed to Prisma create", async () => {
      db.webhook.count.mockResolvedValue(0);
      (db.webhook.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: uid(),
          ...data,
          createdAt: new Date(),
        }),
      );

      await service.create("user-1", {
        url: "https://my-api.com/callback",
        events: ["WHALE_TRADE"],
      });

      const createArg = (db.webhook.create as any).mock.calls[0][0];
      expect(createArg.data.url).toBe("https://my-api.com/callback");
      expect(createArg.data.events).toEqual(["WHALE_TRADE"]);
      expect(createArg.data.userId).toBe("user-1");
    });

    it("rejects when user already has 10 webhooks", async () => {
      db.webhook.count.mockResolvedValue(10);

      await expect(
        service.create("user-1", {
          url: "https://example.com/hook",
          events: ["ORDER_FILLED"],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns only the requesting user's webhooks", async () => {
      const webhooks = [
        makeWebhook({ userId: "user-1" }),
        makeWebhook({ userId: "user-1" }),
      ];
      db.webhook.findMany.mockResolvedValue(webhooks as any);

      const result = await service.list("user-1");

      expect(result).toHaveLength(2);
      const whereArg = (db.webhook.findMany as any).mock.calls[0][0].where;
      expect(whereArg.userId).toBe("user-1");
    });

    it("does not include the secret field in list results", async () => {
      db.webhook.findMany.mockResolvedValue([]);

      await service.list("user-1");

      const selectArg = (db.webhook.findMany as any).mock.calls[0][0].select;
      expect(selectArg.secret).toBeUndefined();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes webhook when owned by the user", async () => {
      const webhook = makeWebhook({ userId: "user-1" });
      db.webhook.findUnique.mockResolvedValue(webhook as any);
      db.webhook.delete.mockResolvedValue(webhook as any);

      await service.remove(webhook.id, "user-1");

      expect(db.webhook.delete).toHaveBeenCalledWith({ where: { id: webhook.id } });
    });

    it("throws ForbiddenException when user does not own the webhook", async () => {
      const webhook = makeWebhook({ userId: "user-2" });
      db.webhook.findUnique.mockResolvedValue(webhook as any);

      await expect(service.remove(webhook.id, "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws NotFoundException for unknown webhook id", async () => {
      db.webhook.findUnique.mockResolvedValue(null);

      await expect(service.remove("unknown-id", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── test ────────────────────────────────────────────────────────────────────

  describe("test", () => {
    it("sends a test event to the webhook URL", async () => {
      const webhook = makeWebhook({ userId: "user-1" });
      db.webhook.findUnique.mockResolvedValue(webhook as any);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.test(webhook.id, "user-1");

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toBe(webhook.url);
    });

    it("throws NotFoundException for unknown webhook", async () => {
      db.webhook.findUnique.mockResolvedValue(null);

      await expect(service.test("unknown", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException for webhook owned by another user", async () => {
      const webhook = makeWebhook({ userId: "user-2" });
      db.webhook.findUnique.mockResolvedValue(webhook as any);

      await expect(service.test(webhook.id, "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── dispatch ────────────────────────────────────────────────────────────────

  describe("dispatch", () => {
    it("finds matching webhooks by event type and delivers payload", async () => {
      const webhook = makeWebhook({ events: ["ORDER_FILLED"], active: true });
      db.webhook.findMany.mockResolvedValue([webhook] as any);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "ORDER_FILLED", { orderId: "123" });

      // Wait for fire-and-forget promise
      await new Promise((r) => setTimeout(r, 50));

      expect(db.webhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-1",
            active: true,
            events: { has: "ORDER_FILLED" },
          }),
        }),
      );

      expect(mockFetch).toHaveBeenCalled();
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event).toBe("ORDER_FILLED");
      expect(callBody.data.orderId).toBe("123");
    });

    it("signs the payload with HMAC-SHA256", async () => {
      const webhook = makeWebhook({ secret: "test-secret-hex" });
      db.webhook.findMany.mockResolvedValue([webhook] as any);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      await service.dispatch("user-1", "ORDER_FILLED", {});
      await new Promise((r) => setTimeout(r, 50));

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["X-Polyforge-Signature"]).toBeDefined();
      expect(typeof headers["X-Polyforge-Signature"]).toBe("string");
      expect(headers["X-Polyforge-Signature"].length).toBeGreaterThan(0);
    });

    it("skips inactive webhooks via the query filter", async () => {
      db.webhook.findMany.mockResolvedValue([]);

      await service.dispatch("user-1", "ORDER_FILLED", {});

      const whereArg = (db.webhook.findMany as any).mock.calls[0][0].where;
      expect(whereArg.active).toBe(true);
    });
  });
});
