import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UnprocessableEntityException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ArbitrageAlertService } from "./arbitrage-alert.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

describe("ArbitrageAlertService", () => {
  let service: ArbitrageAlertService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new ArbitrageAlertService(db as any);
  });

  describe("list", () => {
    it("returns active alerts for user", async () => {
      const alerts = [
        {
          id: "a1",
          userId: "u1",
          minSpreadPct: 5,
          active: true,
          marketId: null,
          triggeredAt: null,
          createdAt: new Date(),
        },
      ];
      db.arbitrageAlert.findMany.mockResolvedValue(alerts);

      const result = await service.list("u1");

      expect(result).toEqual(alerts);
      expect(db.arbitrageAlert.findMany).toHaveBeenCalledWith({
        where: { userId: "u1", active: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when user has no alerts", async () => {
      db.arbitrageAlert.findMany.mockResolvedValue([]);

      const result = await service.list("u2");

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("creates an alert with required fields", async () => {
      db.arbitrageAlert.count.mockResolvedValue(0);
      db.arbitrageAlert.create.mockResolvedValue({
        id: "a1",
        userId: "u1",
        minSpreadPct: 5,
        marketId: null,
        active: true,
        triggeredAt: null,
        createdAt: new Date(),
      });

      const result = await service.create("u1", { minSpreadPct: "5" });

      expect(result.id).toBe("a1");
      expect(db.arbitrageAlert.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          minSpreadPct: "5",
          marketId: null,
        },
      });
    });

    it("creates an alert with optional marketId", async () => {
      db.arbitrageAlert.count.mockResolvedValue(0);
      db.arbitrageAlert.create.mockResolvedValue({
        id: "a2",
        userId: "u1",
        minSpreadPct: 3,
        marketId: "market-123",
        active: true,
        triggeredAt: null,
        createdAt: new Date(),
      });

      await service.create("u1", {
        minSpreadPct: "3",
        marketId: "market-123",
      });

      expect(db.arbitrageAlert.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          minSpreadPct: "3",
          marketId: "market-123",
        },
      });
    });

    it("throws when alert limit reached", async () => {
      db.arbitrageAlert.count.mockResolvedValue(20);

      await expect(service.create("u1", { minSpreadPct: "5" })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe("remove", () => {
    it("deactivates the alert", async () => {
      db.arbitrageAlert.findUnique.mockResolvedValue({
        id: "a1",
        userId: "u1",
        active: true,
      } as any);
      db.arbitrageAlert.update.mockResolvedValue({} as any);

      await service.remove("a1", "u1");

      expect(db.arbitrageAlert.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: { active: false },
      });
    });

    it("throws NotFoundException for missing alert", async () => {
      db.arbitrageAlert.findUnique.mockResolvedValue(null);

      await expect(service.remove("missing", "u1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException for wrong user", async () => {
      db.arbitrageAlert.findUnique.mockResolvedValue({
        id: "a1",
        userId: "u1",
        active: true,
      } as any);

      await expect(service.remove("a1", "other-user")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
