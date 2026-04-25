import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { JournalService } from "./journal.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

const USER_ID = "user-uuid-1";
const OTHER_USER = "user-uuid-other";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-uuid-1",
    userId: USER_ID,
    marketId: "market-slug",
    outcome: "YES",
    side: "BUY",
    price: "0.65",
    size: "100.00",
    fillPrice: "0.70",
    ...overrides,
  };
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-uuid-1",
    userId: USER_ID,
    orderId: "order-uuid-1",
    marketTitle: "market-slug",
    outcome: "YES",
    side: "BUY",
    price: 0.65,
    size: 100,
    pnl: 5,
    note: "test note",
    tags: ["tag1"],
    mood: "confident",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
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
    it("returns paginated entries for the user", async () => {
      const entries = [makeEntry()];
      db.journalEntry.findMany.mockResolvedValue(entries as any);
      db.journalEntry.count.mockResolvedValue(1);

      const result = await service.list(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual(entries);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(db.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
    });

    it("returns empty data for users with no entries", async () => {
      db.journalEntry.findMany.mockResolvedValue([]);
      db.journalEntry.count.mockResolvedValue(0);

      const result = await service.list(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("create", () => {
    it("creates an entry from order data", async () => {
      const order = makeOrder();
      const entry = makeEntry();
      db.order.findFirst.mockResolvedValue(order as any);
      db.journalEntry.create.mockResolvedValue(entry as any);

      const result = await service.create(USER_ID, {
        orderId: "order-uuid-1",
        note: "test note",
        tags: ["tag1"],
        mood: "confident",
      });

      expect(result).toEqual(entry);
      expect(db.order.findFirst).toHaveBeenCalledWith({
        where: { id: "order-uuid-1", userId: USER_ID },
      });
      expect(db.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            orderId: "order-uuid-1",
            outcome: "YES",
            side: "BUY",
          }),
        }),
      );
    });

    it("throws NotFoundException when order does not exist", async () => {
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, { orderId: "missing" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("uses defaults for optional fields", async () => {
      const order = makeOrder();
      db.order.findFirst.mockResolvedValue(order as any);
      db.journalEntry.create.mockResolvedValue(makeEntry() as any);

      await service.create(USER_ID, { orderId: "order-uuid-1" });

      expect(db.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            note: "",
            tags: [],
            mood: "neutral",
          }),
        }),
      );
    });

    it("computes pnl as null when fillPrice is missing", async () => {
      const order = makeOrder({ fillPrice: null });
      db.order.findFirst.mockResolvedValue(order as any);
      db.journalEntry.create.mockResolvedValue(makeEntry({ pnl: null }) as any);

      await service.create(USER_ID, { orderId: "order-uuid-1" });

      expect(db.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pnl: null }),
        }),
      );
    });
  });

  describe("update", () => {
    it("updates note, tags, and mood", async () => {
      const entry = makeEntry();
      const updated = { ...entry, note: "updated" };
      db.journalEntry.findUnique.mockResolvedValue(entry as any);
      db.journalEntry.update.mockResolvedValue(updated as any);

      const result = await service.update(USER_ID, "entry-uuid-1", {
        note: "updated",
      });

      expect(result.note).toBe("updated");
    });

    it("throws NotFoundException when entry does not exist", async () => {
      db.journalEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, "missing", { note: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when userId does not match", async () => {
      db.journalEntry.findUnique.mockResolvedValue(
        makeEntry({ userId: OTHER_USER }) as any,
      );

      await expect(
        service.update(USER_ID, "entry-uuid-1", { note: "x" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("remove", () => {
    it("deletes the entry", async () => {
      db.journalEntry.findUnique.mockResolvedValue(makeEntry() as any);
      db.journalEntry.delete.mockResolvedValue(makeEntry() as any);

      await service.remove(USER_ID, "entry-uuid-1");

      expect(db.journalEntry.delete).toHaveBeenCalledWith({
        where: { id: "entry-uuid-1" },
      });
    });

    it("throws NotFoundException when entry does not exist", async () => {
      db.journalEntry.findUnique.mockResolvedValue(null);

      await expect(service.remove(USER_ID, "missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when userId does not match", async () => {
      db.journalEntry.findUnique.mockResolvedValue(
        makeEntry({ userId: OTHER_USER }) as any,
      );

      await expect(service.remove(USER_ID, "entry-uuid-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
