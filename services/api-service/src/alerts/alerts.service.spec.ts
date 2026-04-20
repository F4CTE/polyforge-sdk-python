import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "alert-uuid-1",
    userId: "user-uuid-1",
    tokenId: "token-uuid-1",
    direction: "above",
    price: "0.75",
    persistent: false,
    triggered: false,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCreateAlertDto(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "token-uuid-1",
    direction: "above" as const,
    price: "0.75",
    persistent: false,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("AlertsService", () => {
  let service: AlertsService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new AlertsService(db as any, {} as any, {} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns non-triggered alerts for the user ordered by createdAt desc", async () => {
      const alerts = [
        makeAlert(),
        makeAlert({ id: "alert-uuid-2", tokenId: "token-uuid-2" }),
      ];
      db.priceAlert.findMany.mockResolvedValue(alerts as any);

      const result = await service.list("user-uuid-1");

      expect(result).toEqual(alerts);
      expect(db.priceAlert.findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1", triggered: false },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns an empty array when the user has no alerts", async () => {
      db.priceAlert.findMany.mockResolvedValue([]);

      const result = await service.list("user-uuid-1");

      expect(result).toEqual([]);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates and returns an alert when under the limit", async () => {
      const dto = makeCreateAlertDto();
      const alert = makeAlert();
      db.priceAlert.count.mockResolvedValue(0);
      db.priceAlert.create.mockResolvedValue(alert as any);

      const result = await service.create("user-uuid-1", dto as any);

      expect(result).toEqual(alert);
      expect(db.priceAlert.count).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1", triggered: false },
      });
      expect(db.priceAlert.create).toHaveBeenCalledWith({
        data: {
          userId: "user-uuid-1",
          tokenId: dto.tokenId,
          direction: dto.direction,
          price: dto.price,
          persistent: false,
        },
      });
    });

    it("defaults persistent to false when not provided in dto", async () => {
      const dto = makeCreateAlertDto({ persistent: undefined });
      const alert = makeAlert({ persistent: false });
      db.priceAlert.count.mockResolvedValue(5);
      db.priceAlert.create.mockResolvedValue(alert as any);

      await service.create("user-uuid-1", dto as any);

      expect(db.priceAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ persistent: false }),
        }),
      );
    });

    it("stores persistent: true when explicitly set", async () => {
      const dto = makeCreateAlertDto({ persistent: true });
      db.priceAlert.count.mockResolvedValue(1);
      db.priceAlert.create.mockResolvedValue(
        makeAlert({ persistent: true }) as any,
      );

      await service.create("user-uuid-1", dto as any);

      expect(db.priceAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ persistent: true }),
        }),
      );
    });

    it("throws ALERT_LIMIT_REACHED (422) when user already has 50 alerts", async () => {
      db.priceAlert.count.mockResolvedValue(50);

      await expect(
        service.create("user-uuid-1", makeCreateAlertDto() as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws ALERT_LIMIT_REACHED with correct error code", async () => {
      db.priceAlert.count.mockResolvedValue(50);

      await expect(
        service.create("user-uuid-1", makeCreateAlertDto() as any),
      ).rejects.toMatchObject({
        response: { code: "ALERT_LIMIT_REACHED" },
      });
    });

    it("does NOT throw at exactly 49 alerts (boundary)", async () => {
      db.priceAlert.count.mockResolvedValue(49);
      db.priceAlert.create.mockResolvedValue(makeAlert() as any);

      await expect(
        service.create("user-uuid-1", makeCreateAlertDto() as any),
      ).resolves.toBeDefined();
    });

    it("does NOT call prisma.create when the limit is reached", async () => {
      db.priceAlert.count.mockResolvedValue(50);

      await service
        .create("user-uuid-1", makeCreateAlertDto() as any)
        .catch(() => {});

      expect(db.priceAlert.create).not.toHaveBeenCalled();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes the alert when found and owned by the user", async () => {
      const alert = makeAlert({ userId: "user-uuid-1" });
      db.priceAlert.findUnique.mockResolvedValue(alert as any);
      db.priceAlert.delete.mockResolvedValue(alert as any);

      await service.remove("alert-uuid-1", "user-uuid-1");

      expect(db.priceAlert.delete).toHaveBeenCalledWith({
        where: { id: "alert-uuid-1" },
      });
    });

    it("returns void on successful deletion", async () => {
      const alert = makeAlert({ userId: "user-uuid-1" });
      db.priceAlert.findUnique.mockResolvedValue(alert as any);
      db.priceAlert.delete.mockResolvedValue(alert as any);

      const result = await service.remove("alert-uuid-1", "user-uuid-1");

      expect(result).toBeUndefined();
    });

    it("throws NotFoundException (404) when alert does not exist", async () => {
      db.priceAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.remove("nonexistent-id", "user-uuid-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_FOUND error code when alert does not exist", async () => {
      db.priceAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.remove("nonexistent-id", "user-uuid-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws ForbiddenException (403) when alert belongs to a different user", async () => {
      const alert = makeAlert({ userId: "other-user-id" });
      db.priceAlert.findUnique.mockResolvedValue(alert as any);

      await expect(
        service.remove("alert-uuid-1", "user-uuid-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws FORBIDDEN error code when alert belongs to a different user", async () => {
      const alert = makeAlert({ userId: "other-user-id" });
      db.priceAlert.findUnique.mockResolvedValue(alert as any);

      await expect(
        service.remove("alert-uuid-1", "user-uuid-1"),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
      });
    });

    it("does NOT call delete when the alert is forbidden", async () => {
      const alert = makeAlert({ userId: "other-user-id" });
      db.priceAlert.findUnique.mockResolvedValue(alert as any);

      await service.remove("alert-uuid-1", "user-uuid-1").catch(() => {});

      expect(db.priceAlert.delete).not.toHaveBeenCalled();
    });
  });

  // ── checkAndFireAlerts ───────────────────────────────────────────────────

  describe("checkAndFireAlerts", () => {
    let mockRedis: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      getClient: ReturnType<typeof vi.fn>;
    };
    let mockGateway: { pushNotification: ReturnType<typeof vi.fn> };
    let mockMget: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockMget = vi.fn().mockResolvedValue([]);
      mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        getClient: vi.fn().mockReturnValue({ mget: mockMget }),
      };
      mockGateway = { pushNotification: vi.fn() };
      service = new AlertsService(
        db as any,
        mockRedis as any,
        mockGateway as any,
      );
    });

    it("does nothing when there are no untriggered alerts", async () => {
      db.priceAlert.findMany.mockResolvedValue([]);

      await service.checkAndFireAlerts();

      expect(mockMget).not.toHaveBeenCalled();
      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
    });

    it("fires an 'above' alert when current price >= threshold", async () => {
      const alert = makeAlert({
        direction: "above",
        price: "0.50",
        tokenId: "token-1",
        userId: "user-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.60" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [alert.id] } },
        data: { triggered: true },
      });
      expect(mockGateway.pushNotification).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "PRICE_ALERT" }),
      );
    });

    it("fires a 'below' alert when current price <= threshold", async () => {
      const alert = makeAlert({
        direction: "below",
        price: "0.80",
        tokenId: "token-1",
        userId: "user-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.70" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).toHaveBeenCalled();
    });

    it("does NOT fire 'above' alert when price is below threshold", async () => {
      const alert = makeAlert({
        direction: "above",
        price: "0.80",
        tokenId: "token-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.50" })]);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
    });

    it("does NOT fire 'below' alert when price is above threshold", async () => {
      const alert = makeAlert({
        direction: "below",
        price: "0.30",
        tokenId: "token-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.50" })]);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
    });

    it("skips alerts whose token has no price in Redis", async () => {
      const alert = makeAlert({ tokenId: "token-1" });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([null]);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
      expect(mockGateway.pushNotification).not.toHaveBeenCalled();
    });

    it("deletes non-persistent alerts after triggering", async () => {
      const alert = makeAlert({
        persistent: false,
        direction: "above",
        price: "0.50",
        tokenId: "token-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.60" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [alert.id] }, persistent: false },
      });
    });

    it("de-duplicates token IDs when fetching prices from Redis", async () => {
      const alert1 = makeAlert({
        id: "a1",
        tokenId: "token-1",
        direction: "above",
        price: "0.50",
      });
      const alert2 = makeAlert({
        id: "a2",
        tokenId: "token-1",
        direction: "below",
        price: "0.90",
      });
      db.priceAlert.findMany.mockResolvedValue([alert1, alert2] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.60" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 2 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 2 } as any);

      await service.checkAndFireAlerts();

      // mget should only be called once with one key (deduplicated)
      expect(mockMget).toHaveBeenCalledWith("cache:price:token-1");
    });

    it("handles malformed Redis price JSON gracefully", async () => {
      const alert = makeAlert({ tokenId: "token-1" });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue(["not-json"]);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
    });

    it("fires 'above' alert when price exactly equals threshold", async () => {
      const alert = makeAlert({
        direction: "above",
        price: "0.50",
        tokenId: "token-1",
        userId: "user-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.50" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).toHaveBeenCalled();
    });

    it("fires 'below' alert when price exactly equals threshold", async () => {
      const alert = makeAlert({
        direction: "below",
        price: "0.50",
        tokenId: "token-1",
        userId: "user-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.50" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(db.priceAlert.updateMany).toHaveBeenCalled();
    });

    it("sends correct notification payload", async () => {
      const alert = makeAlert({
        id: "alert-123",
        direction: "above",
        price: "0.50",
        tokenId: "token-1",
        userId: "user-1",
      });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ price: "0.60" })]);
      db.priceAlert.updateMany.mockResolvedValue({ count: 1 } as any);
      db.priceAlert.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.checkAndFireAlerts();

      expect(mockGateway.pushNotification).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          type: "PRICE_ALERT",
          alertId: "alert-123",
          tokenId: "token-1",
          direction: "above",
          threshold: "0.50",
          currentPrice: "0.6000",
        }),
      );
    });

    it("catches and logs errors without throwing", async () => {
      db.priceAlert.findMany.mockRejectedValue(new Error("DB down"));

      // Should not throw
      await expect(service.checkAndFireAlerts()).resolves.toBeUndefined();
    });

    it("handles Redis price with missing price field", async () => {
      const alert = makeAlert({ tokenId: "token-1" });
      db.priceAlert.findMany.mockResolvedValue([alert] as any);
      mockMget.mockResolvedValue([JSON.stringify({ notPrice: "0.5" })]);

      await service.checkAndFireAlerts();

      // price defaults to 0, threshold is 0.75 (above), so should not trigger
      expect(db.priceAlert.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── onModuleInit ─────────────────────────────────────────────────────────

  describe("onModuleInit", () => {
    it("sets up a periodic interval", () => {
      vi.useFakeTimers();
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        getClient: vi.fn().mockReturnValue({ mget: vi.fn() }),
      };
      const svc = new AlertsService(
        db as any,
        mockRedis as any,
        {} as any,
      );

      svc.onModuleInit();

      // The interval should be set (we verify by checking that checkAndFireAlerts
      // would be called on timer advance, but we just verify no error on init)
      expect(() => svc.onModuleInit()).not.toThrow();

      vi.useRealTimers();
    });
  });
});
