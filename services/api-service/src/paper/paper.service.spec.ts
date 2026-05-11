import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PaperService } from "./paper.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makePosition(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "token-uuid-1",
    outcome: "YES",
    size: "100.00",
    avgPrice: "0.60",
    realizedPnl: "20.00",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PaperService", () => {
  let service: PaperService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new PaperService(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getSummary ────────────────────────────────────────────────────────────

  describe("getSummary", () => {
    it("returns order count, positions array and total pnl", async () => {
      const positions = [
        makePosition(),
        makePosition({ tokenId: "token-uuid-2", realizedPnl: "5.50" }),
      ];
      db.paperOrder.count.mockResolvedValue(10);
      db.paperPosition.findMany.mockResolvedValue(positions as any);

      const result = await service.getSummary("user-uuid-1");

      expect(result.orderCount).toBe(10);
      expect(result.positions).toHaveLength(2);
      expect(result.pnl).toBe("25.50");
    });

    it('returns pnl "0.00" when there are no positions', async () => {
      db.paperOrder.count.mockResolvedValue(0);
      db.paperPosition.findMany.mockResolvedValue([]);

      const result = await service.getSummary("user-uuid-1");

      expect(result.pnl).toBe("0.00");
      expect(result.positions).toEqual([]);
      expect(result.orderCount).toBe(0);
    });

    it("maps position fields correctly", async () => {
      const position = makePosition({
        tokenId: "token-uuid-1",
        outcome: "NO",
        size: "50.00",
      });
      db.paperOrder.count.mockResolvedValue(2);
      db.paperPosition.findMany.mockResolvedValue([position] as any);

      const result = await service.getSummary("user-uuid-1");

      expect(result.positions[0]).toMatchObject({
        tokenId: "token-uuid-1",
        side: "NO",
        size: "50.00",
        unrealizedPnl: "0",
      });
    });

    it("correctly sums multiple position pnl values", async () => {
      const positions = [
        makePosition({ realizedPnl: "10.50" }),
        makePosition({ tokenId: "token-uuid-2", realizedPnl: "-3.25" }),
        makePosition({ tokenId: "token-uuid-3", realizedPnl: "5.00" }),
      ];
      db.paperOrder.count.mockResolvedValue(5);
      db.paperPosition.findMany.mockResolvedValue(positions as any);

      const result = await service.getSummary("user-uuid-1");

      expect(result.pnl).toBe("12.25");
    });

    it("handles null realizedPnl on a position gracefully", async () => {
      const position = makePosition({ realizedPnl: null });
      db.paperOrder.count.mockResolvedValue(1);
      db.paperPosition.findMany.mockResolvedValue([position] as any);

      const result = await service.getSummary("user-uuid-1");

      expect(result.pnl).toBe("0.00");
    });

    it("queries paperOrder.count and paperPosition.findMany with the given userId", async () => {
      db.paperOrder.count.mockResolvedValue(0);
      db.paperPosition.findMany.mockResolvedValue([]);

      await service.getSummary("user-uuid-42");

      expect(db.paperOrder.count).toHaveBeenCalledWith({
        where: { userId: "user-uuid-42" },
      });
      expect(db.paperPosition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-uuid-42" } }),
      );
    });

    it("selects only the required position fields", async () => {
      db.paperOrder.count.mockResolvedValue(0);
      db.paperPosition.findMany.mockResolvedValue([]);

      await service.getSummary("user-uuid-1");

      expect(db.paperPosition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            tokenId: true,
            outcome: true,
            size: true,
            avgPrice: true,
            realizedPnl: true,
          },
        }),
      );
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("deletes all paper orders and positions for the user", async () => {
      db.paperOrder.deleteMany.mockResolvedValue({ count: 5 });
      db.paperPosition.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.reset("user-uuid-1");

      expect(result).toEqual({ reset: true });
    });

    it("calls deleteMany on both paperOrder and paperPosition with the userId", async () => {
      db.paperOrder.deleteMany.mockResolvedValue({ count: 0 });
      db.paperPosition.deleteMany.mockResolvedValue({ count: 0 });

      await service.reset("user-uuid-1");

      expect(db.paperOrder.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
      });
      expect(db.paperPosition.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
      });
    });

    it("runs both deletions in parallel (Promise.all)", async () => {
      const orderDeleteSpy = vi.fn().mockResolvedValue({ count: 0 });
      const posDeleteSpy = vi.fn().mockResolvedValue({ count: 0 });
      db.paperOrder.deleteMany.mockImplementation(orderDeleteSpy);
      db.paperPosition.deleteMany.mockImplementation(posDeleteSpy);

      await service.reset("user-uuid-1");

      expect(orderDeleteSpy).toHaveBeenCalledOnce();
      expect(posDeleteSpy).toHaveBeenCalledOnce();
    });

    it("returns { reset: true } even when there were no records to delete", async () => {
      db.paperOrder.deleteMany.mockResolvedValue({ count: 0 });
      db.paperPosition.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.reset("user-uuid-1");

      expect(result).toEqual({ reset: true });
    });
  });
});
