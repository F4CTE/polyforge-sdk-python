import { describe, it, expect, beforeEach } from "vitest";
import { JournalService } from "./journal.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

const USER_ID = "user-uuid-1";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-uuid-1",
    marketId: "market-slug",
    mood: "CONFIDENT",
    note: "good entry",
    side: "BUY",
    outcome: "YES",
    price: "0.65",
    size: "100.00",
    status: "CONFIRMED",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("JournalService", () => {
  let service: JournalService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new JournalService(db as any);
  });

  describe("list", () => {
    it("returns paginated orders where mood is not null", async () => {
      const orders = [makeOrder()];
      db.order.findMany.mockResolvedValue(orders as any);
      db.order.count.mockResolvedValue(1);

      const result = await service.list(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual(orders);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, mood: { not: null } },
        }),
      );
    });

    it("returns empty data when no orders have mood set", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      const result = await service.list(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("filters by specific mood when provided", async () => {
      const orders = [makeOrder({ mood: "FOMO" })];
      db.order.findMany.mockResolvedValue(orders as any);
      db.order.count.mockResolvedValue(1);

      const result = await service.list(USER_ID, {
        page: 1,
        limit: 20,
        mood: "FOMO",
      });

      expect(result.data).toHaveLength(1);
      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, mood: "FOMO" },
        }),
      );
    });

    it("paginates correctly with skip and take", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(50);

      const result = await service.list(USER_ID, { page: 3, limit: 10 });

      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("selects only the fields needed for journal display", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(USER_ID, { page: 1, limit: 20 });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            marketId: true,
            mood: true,
            note: true,
            side: true,
            outcome: true,
            price: true,
            size: true,
            status: true,
            createdAt: true,
          }),
        }),
      );
    });

    it("orders by createdAt desc", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(USER_ID, { page: 1, limit: 20 });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });
});
