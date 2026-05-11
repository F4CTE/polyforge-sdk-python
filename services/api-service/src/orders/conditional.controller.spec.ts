import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConditionalController } from "./conditional.controller";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

const API_PARAMETERS = "swagger/apiParameters";

function expectRequiredIdempotencyKey(method: object) {
  const interceptors: unknown[] =
    Reflect.getMetadata(INTERCEPTORS_METADATA, method) ?? [];
  const parameters: Array<Record<string, unknown>> =
    Reflect.getMetadata(API_PARAMETERS, method) ?? [];

  expect(interceptors).toContain(IdempotencyInterceptor);
  expect(parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        in: "header",
        name: "Idempotency-Key",
        required: true,
      }),
    ]),
  );
}

// ─── Factories ────────────────────────────────────────────────────────────────

function makeJwtPayload(overrides: Record<string, unknown> = {}) {
  return { sub: "user-uuid-1", ...overrides };
}

function makeConditionalOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "cond-uuid-1",
    userId: "user-uuid-1",
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    type: "TAKE_PROFIT",
    side: "BUY",
    outcome: "YES",
    size: "50.00",
    triggerPrice: "0.75",
    limitPrice: null,
    trailingPct: null,
    peakPrice: null,
    status: "PENDING",
    triggeredAt: null,
    orderId: null,
    expiresAt: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    type: "TAKE_PROFIT",
    side: "BUY",
    outcome: "YES",
    size: "50.00",
    triggerPrice: "0.75",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("ConditionalController", () => {
  let controller: ConditionalController;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    controller = new ConditionalController(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("requires Idempotency-Key", () => {
      expectRequiredIdempotencyKey(ConditionalController.prototype.create);
    });

    it("creates a conditional order and returns it", async () => {
      db.conditionalOrder.count.mockResolvedValue(0);
      db.conditionalOrder.create.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      const result = await controller.create(
        makeJwtPayload() as any,
        makeCreateDto() as any,
      );

      expect(result).toMatchObject({
        id: "cond-uuid-1",
        type: "TAKE_PROFIT",
        status: "PENDING",
      });
    });

    it("throws CONDITIONAL_ORDER_LIMIT when user has 50 pending orders", async () => {
      db.conditionalOrder.count.mockResolvedValue(50);

      await expect(
        controller.create(makeJwtPayload() as any, makeCreateDto() as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws CONDITIONAL_ORDER_LIMIT error code", async () => {
      db.conditionalOrder.count.mockResolvedValue(50);

      await expect(
        controller.create(makeJwtPayload() as any, makeCreateDto() as any),
      ).rejects.toMatchObject({
        response: { code: "CONDITIONAL_ORDER_LIMIT" },
      });
    });

    it("allows creation when user has fewer than 50 pending orders", async () => {
      db.conditionalOrder.count.mockResolvedValue(49);
      db.conditionalOrder.create.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      const result = await controller.create(
        makeJwtPayload() as any,
        makeCreateDto() as any,
      );

      expect(result.id).toBe("cond-uuid-1");
    });

    it("stores expiresAt as Date when provided", async () => {
      db.conditionalOrder.count.mockResolvedValue(0);
      db.conditionalOrder.create.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      await controller.create(
        makeJwtPayload() as any,
        makeCreateDto({ expiresAt: "2025-12-31T23:59:59.000Z" }) as any,
      );

      expect(db.conditionalOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: new Date("2025-12-31T23:59:59.000Z"),
          }),
        }),
      );
    });

    it("sets expiresAt to null when not provided", async () => {
      db.conditionalOrder.count.mockResolvedValue(0);
      db.conditionalOrder.create.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      await controller.create(makeJwtPayload() as any, makeCreateDto() as any);

      expect(db.conditionalOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: null,
          }),
        }),
      );
    });

    it("sets limitPrice and trailingPct to null when not provided", async () => {
      db.conditionalOrder.count.mockResolvedValue(0);
      db.conditionalOrder.create.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      await controller.create(makeJwtPayload() as any, makeCreateDto() as any);

      expect(db.conditionalOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            limitPrice: null,
            trailingPct: null,
          }),
        }),
      );
    });
  });

  // ── list ─────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns paginated conditional orders", async () => {
      const orders = [makeConditionalOrder()];
      db.conditionalOrder.findMany.mockResolvedValue(orders as any);
      db.conditionalOrder.count.mockResolvedValue(1);

      const result = await controller.list(makeJwtPayload() as any, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it("scopes query to requesting user", async () => {
      db.conditionalOrder.findMany.mockResolvedValue([]);
      db.conditionalOrder.count.mockResolvedValue(0);

      await controller.list(makeJwtPayload({ sub: "user-99" }) as any, {
        page: 1,
        limit: 20,
      });

      expect(db.conditionalOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-99" }),
        }),
      );
    });

    it("adds status filter when provided", async () => {
      db.conditionalOrder.findMany.mockResolvedValue([]);
      db.conditionalOrder.count.mockResolvedValue(0);

      await controller.list(makeJwtPayload() as any, {
        page: 1,
        limit: 20,
        status: "TRIGGERED",
      });

      expect(db.conditionalOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { equals: "TRIGGERED" },
          }),
        }),
      );
    });

    it("adds type filter when provided", async () => {
      db.conditionalOrder.findMany.mockResolvedValue([]);
      db.conditionalOrder.count.mockResolvedValue(0);

      await controller.list(makeJwtPayload() as any, {
        page: 1,
        limit: 20,
        type: "STOP_LOSS",
      });

      expect(db.conditionalOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { equals: "STOP_LOSS" },
          }),
        }),
      );
    });

    it("calculates correct skip for page 3 limit 10", async () => {
      db.conditionalOrder.findMany.mockResolvedValue([]);
      db.conditionalOrder.count.mockResolvedValue(0);

      await controller.list(makeJwtPayload() as any, {
        page: 3,
        limit: 10,
      });

      expect(db.conditionalOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── detail ───────────────────────────────────────────────────────────────

  describe("detail", () => {
    it("returns the conditional order when found and owned by user", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder() as any,
      );

      const result = await controller.detail(
        makeJwtPayload() as any,
        "cond-uuid-1",
      );

      expect(result).toMatchObject({ id: "cond-uuid-1" });
    });

    it("throws NOT_FOUND when order does not exist", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(null);

      await expect(
        controller.detail(makeJwtPayload() as any, "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws FORBIDDEN when order belongs to another user", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder({ userId: "other-user" }) as any,
      );

      await expect(
        controller.detail(makeJwtPayload() as any, "cond-uuid-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws FORBIDDEN error code when order belongs to another user", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder({ userId: "other-user" }) as any,
      );

      await expect(
        controller.detail(makeJwtPayload() as any, "cond-uuid-1"),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
      });
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("cancels an order and returns the updated record", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder() as any,
      );
      db.conditionalOrder.update.mockResolvedValue(
        makeConditionalOrder({ status: "CANCELLED" }) as any,
      );

      const result = await controller.cancel(
        makeJwtPayload() as any,
        "cond-uuid-1",
      );

      expect(result.status).toBe("CANCELLED");
    });

    it("throws NOT_FOUND when order does not exist", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(null);

      await expect(
        controller.cancel(makeJwtPayload() as any, "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws FORBIDDEN when order belongs to another user", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder({ userId: "other-user" }) as any,
      );

      await expect(
        controller.cancel(makeJwtPayload() as any, "cond-uuid-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("updates order status to CANCELLED in database", async () => {
      db.conditionalOrder.findUnique.mockResolvedValue(
        makeConditionalOrder() as any,
      );
      db.conditionalOrder.update.mockResolvedValue(
        makeConditionalOrder({ status: "CANCELLED" }) as any,
      );

      await controller.cancel(makeJwtPayload() as any, "cond-uuid-1");

      expect(db.conditionalOrder.update).toHaveBeenCalledWith({
        where: { id: "cond-uuid-1" },
        data: { status: "CANCELLED" },
      });
    });
  });
});
