import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { StrategiesService } from "./strategies.service";
import { InternalClientService } from "../common/services/internal-client.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { LlmService } from "../news/llm.service";
import { PosthogService } from "@polyforge/shared-posthog";

// ─── Factories ────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() {
  return `id-${++_idCounter}`;
}

function makeStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: uid(),
    userId: "user-1",
    name: "My Strategy",
    description: "A test strategy",
    visibility: "PUBLIC",
    execMode: "TICK",
    tickMs: 1000,
    triggers: [],
    conditions: [],
    actions: [],
    safety: [],
    tags: [],
    status: StrategyStatus.IDLE,
    version: 1,
    template: false,
    forkedFromId: null,
    likeCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: uid(),
    strategyId: "strat-1",
    userId: "user-1",
    content: "A comment",
    deleted: false,
    createdAt: new Date(),
    user: { id: "user-1", username: "alice", displayName: "Alice" },
    ...overrides,
  };
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: uid(),
    reporterId: "user-1",
    targetType: "STRATEGY",
    targetId: "strat-1",
    strategyId: "strat-1",
    reason: "SPAM",
    description: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeQuery(
  overrides: Partial<StrategyQueryDto> = {},
): StrategyQueryDto {
  return {
    page: 1,
    limit: 20,
    sort: "createdAt",
    ...overrides,
  };
}

function makePaginationDto(
  overrides: Partial<PaginationDto> = {},
): PaginationDto {
  return { page: 1, limit: 20, ...overrides };
}

/** Build a mock Response-like object for engine calls */
function mockEngineResponse(ok: boolean, status: number, body: unknown = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("StrategiesService", () => {
  let service: StrategiesService;
  let db: MockDb;
  let config: ConfigService;
  let client: InternalClientService;
  let llm: LlmService;
  let posthog: PosthogService;

  beforeEach(() => {
    db = createMockDb();
    // Make $transaction execute its callback with the mock db (for like/unlike)
    (db.$transaction as any).mockImplementation(async (fn: any) => {
      if (typeof fn === "function") return fn(db);
      return Promise.all(fn); // array of promises
    });

    config = {
      get: vi.fn().mockReturnValue("http://strategy-engine:3006"),
    } as unknown as ConfigService;

    client = {
      post: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
    } as unknown as InternalClientService;

    llm = {
      analyze: vi.fn(),
    } as unknown as LlmService;

    posthog = {
      capture: vi.fn(),
      identify: vi.fn(),
    } as unknown as PosthogService;

    // Wire db into PrismaService shape (PrismaService extends PrismaClient)
    service = new StrategiesService(
      db as unknown as PrismaService,
      config,
      client,
      llm,
      posthog,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns paginated strategies for the user", async () => {
      const strategies = [makeStrategy(), makeStrategy()];
      db.strategy.findMany.mockResolvedValue(strategies as any);
      db.strategy.count.mockResolvedValue(2);

      const result = await service.list("user-1", makeQuery());

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
    });

    it("applies status filter when provided", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.list("user-1", makeQuery({ status: "RUNNING" }));

      const whereArg = (db.strategy.findMany as any).mock.calls[0][0].where;
      expect(whereArg.status).toBe("RUNNING");
    });

    it("excludes ARCHIVED strategies when no status filter", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.list("user-1", makeQuery());

      const whereArg = (db.strategy.findMany as any).mock.calls[0][0].where;
      expect(whereArg.status).toEqual({ not: StrategyStatus.ARCHIVED });
    });

    it("calculates skip from page and limit", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(100);

      await service.list("user-1", makeQuery({ page: 3, limit: 10 }));

      const callArg = (db.strategy.findMany as any).mock.calls[0][0];
      expect(callArg.skip).toBe(20);
      expect(callArg.take).toBe(10);
    });

    it("uses default sort by createdAt desc", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.list("user-1", makeQuery({ sort: undefined }));

      const callArg = (db.strategy.findMany as any).mock.calls[0][0];
      expect(callArg.orderBy).toEqual({ createdAt: "desc" });
    });

    it("sets hasNext when more pages exist", async () => {
      const strategies = Array.from({ length: 10 }, () => makeStrategy());
      db.strategy.findMany.mockResolvedValue(strategies as any);
      db.strategy.count.mockResolvedValue(25);

      const result = await service.list(
        "user-1",
        makeQuery({ page: 1, limit: 10 }),
      );

      expect(result.hasNext).toBe(true);
      expect(result.totalPages).toBe(3);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates and returns a new strategy", async () => {
      const dto: CreateStrategyDto = { name: "Alpha" };
      const created = makeStrategy({ name: "Alpha" });
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(created as any);

      const result = await service.create("user-1", dto);

      expect(result).toEqual(created);
      expect(db.strategy.create).toHaveBeenCalledOnce();
    });

    it("passes correct defaults to prisma.create", async () => {
      const dto: CreateStrategyDto = { name: "Beta" };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.create("user-1", dto);

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.status).toBe(StrategyStatus.IDLE);
      expect(dataArg.version).toBe(1);
      expect(dataArg.template).toBe(false);
      expect(dataArg.visibility).toBe("PRIVATE");
      expect(dataArg.execMode).toBe("TICK");
      expect(dataArg.tickMs).toBe(1000);
    });

    it("uses dto values when provided", async () => {
      const dto: CreateStrategyDto = {
        name: "Gamma",
        description: "desc",
        visibility: "PUBLIC",
        execMode: "EVENT",
        tickMs: 500,
        triggers: [{ type: "MARKET_MOVE", config: {} }],
        tags: ["tag1"],
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.create("user-1", dto);

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.name).toBe("Gamma");
      expect(dataArg.description).toBe("desc");
      expect(dataArg.visibility).toBe("PUBLIC");
      expect(dataArg.execMode).toBe("EVENT");
      expect(dataArg.tickMs).toBe(500);
      expect(dataArg.tags).toEqual(["tag1"]);
    });

    it("throws STRATEGY_LIMIT_REACHED when user is at beta limit (3 strategies)", async () => {
      db.strategy.count.mockResolvedValue(3);

      await expect(
        service.create("user-1", { name: "Over limit" } as any),
      ).rejects.toMatchObject({
        response: { code: "STRATEGY_LIMIT_REACHED" },
        status: 422,
      });
      expect(db.strategy.create).not.toHaveBeenCalled();
    });

    it("throws STRATEGY_LIMIT_REACHED at exactly 3 (boundary check)", async () => {
      db.strategy.count.mockResolvedValue(3);

      await expect(
        service.create("user-1", { name: "Limit" } as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it("passes kalshiSubaccount to prisma.create when provided", async () => {
      const dto: CreateStrategyDto = {
        name: "Kalshi strategy",
        kalshiSubaccount: 3,
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.create("user-1", dto);

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.kalshiSubaccount).toBe(3);
    });

    it("omits kalshiSubaccount from prisma.create when not provided", async () => {
      const dto: CreateStrategyDto = { name: "No subaccount" };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.create("user-1", dto);

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect("kalshiSubaccount" in dataArg).toBe(false);
    });

    it("allows creation when count is 2 (under beta limit)", async () => {
      db.strategy.count.mockResolvedValue(2);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await expect(
        service.create("user-1", { name: "Under limit" } as any),
      ).resolves.toBeDefined();
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns the strategy when found and accessible", async () => {
      const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.findOne(strategy.id, "user-1");

      expect(result).toEqual({ ...strategy, childCount: 0 });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne("missing-id", "user-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws NotFoundException when strategy is ARCHIVED", async () => {
      const strategy = makeStrategy({ status: StrategyStatus.ARCHIVED });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.findOne(strategy.id, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws ForbiddenException when PRIVATE strategy is accessed by non-owner", async () => {
      const strategy = makeStrategy({
        userId: "owner-id",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.findOne(strategy.id, "other-user"),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
        status: 403,
      });
    });

    it("allows owner to access their own PRIVATE strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);

      await expect(service.findOne(strategy.id, "user-1")).resolves.toEqual({
        ...strategy,
        childCount: 0,
      });
    });

    it("allows any user to view a PUBLIC strategy", async () => {
      const strategy = makeStrategy({
        userId: "owner-id",
        visibility: "PUBLIC",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);

      await expect(service.findOne(strategy.id, "any-user")).resolves.toEqual({
        ...strategy,
        childCount: 0,
      });
    });

    it("allows any user to view an UNLISTED strategy", async () => {
      const strategy = makeStrategy({
        userId: "owner-id",
        visibility: "UNLISTED",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.findOne(strategy.id, "random-user"),
      ).resolves.toEqual({ ...strategy, childCount: 0 });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates and returns the strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      const updated = { ...strategy, name: "Updated Name", version: 2 };
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue(updated as any);

      const result = await service.update(strategy.id, "user-1", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(db.strategy.update).toHaveBeenCalledOnce();
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.update("missing", "user-1", {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.update(strategy.id, "user-1", {} as any),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
        status: 403,
      });
    });

    it("throws STRATEGY_IS_RUNNING when editing blocks on a running strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      const dto: UpdateStrategyDto = {
        triggers: [{ type: "PRICE", config: {} }],
      };

      await expect(
        service.update(strategy.id, "user-1", dto),
      ).rejects.toMatchObject({
        response: { code: "STRATEGY_IS_RUNNING" },
        status: 422,
      });
    });

    it("throws STRATEGY_IS_RUNNING when editing conditions on a running strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.update(strategy.id, "user-1", { conditions: [] } as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it("throws STRATEGY_IS_RUNNING when editing actions on a running strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.update(strategy.id, "user-1", { actions: [] } as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it("throws STRATEGY_IS_RUNNING when editing safety on a running strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.update(strategy.id, "user-1", { safety: [] } as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it("allows non-block updates while strategy is RUNNING", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      const updated = { ...strategy, name: "New Name" };
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue(updated as any);

      await expect(
        service.update(strategy.id, "user-1", { name: "New Name" } as any),
      ).resolves.toBeDefined();
    });

    it("increments version on update", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue({ ...strategy, version: 2 } as any);

      await service.update(strategy.id, "user-1", { name: "v2" });

      const dataArg = (db.strategy.update as any).mock.calls[0][0].data;
      expect(dataArg.version).toEqual({ increment: 1 });
    });

    it("only sends defined fields to prisma.update", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue(strategy as any);

      await service.update(strategy.id, "user-1", { name: "Only name" });

      const dataArg = (db.strategy.update as any).mock.calls[0][0].data;
      expect(dataArg.name).toBe("Only name");
      // Description was not in dto, should not appear
      expect("description" in dataArg).toBe(false);
    });

    it("updates kalshiSubaccount when provided", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue({
        ...strategy,
        kalshiSubaccount: 5,
      } as any);

      await service.update(strategy.id, "user-1", {
        kalshiSubaccount: 5,
      });

      const dataArg = (db.strategy.update as any).mock.calls[0][0].data;
      expect(dataArg.kalshiSubaccount).toBe(5);
    });

    it("allows kalshiSubaccount update while strategy is RUNNING (non-block field)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.update.mockResolvedValue({
        ...strategy,
        kalshiSubaccount: 2,
      } as any);

      await expect(
        service.update(strategy.id, "user-1", { kalshiSubaccount: 2 } as any),
      ).resolves.toBeDefined();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("soft-deletes by setting status to ARCHIVED", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.update.mockResolvedValue({
        ...strategy,
        status: StrategyStatus.ARCHIVED,
      } as any);

      await service.remove(strategy.id, "user-1");

      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.ARCHIVED },
      });
    });

    it("returns undefined (void)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.update.mockResolvedValue(strategy as any);

      const result = await service.remove(strategy.id, "user-1");

      expect(result).toBeUndefined();
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.remove("missing", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when user is not the owner", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.remove(strategy.id, "user-1")).rejects.toMatchObject(
        {
          response: { code: "FORBIDDEN" },
          status: 403,
        },
      );
    });

    it("throws STRATEGY_IS_RUNNING when strategy is currently running", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.remove(strategy.id, "user-1")).rejects.toMatchObject(
        {
          response: { code: "STRATEGY_IS_RUNNING" },
          status: 422,
        },
      );
    });
  });

  // ── start ─────────────────────────────────────────────────────────────────

  describe("start", () => {
    it("calls engine and returns PAPER status for paper mode", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      const result = await service.start(strategy.id, "user-1", {
        mode: "paper",
      });

      expect(result.status).toBe("PAPER");
      expect(result.startedAt).toBeDefined();
    });

    it("sets PAPER status in DB via atomic updateMany for paper mode", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      await service.start(strategy.id, "user-1", {
        mode: "paper",
      });

      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.IDLE,
        },
        data: { status: StrategyStatus.PAPER },
      });
    });

    it("calls engine and returns RUNNING status for live mode when polymarketConnected", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
      } as any);
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      const result = await service.start(strategy.id, "user-1", {
        mode: "live",
      });

      expect(result.status).toBe("RUNNING");
    });

    it("sets RUNNING status via updateMany for live mode", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
      } as any);
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      await service.start(strategy.id, "user-1", {
        mode: "live",
      });

      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.IDLE,
        },
        data: { status: StrategyStatus.RUNNING },
      });
    });

    it("throws ALREADY_RUNNING when strategy is already running", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).rejects.toMatchObject({
        response: { code: "ALREADY_RUNNING" },
      });
    });

    it("throws NOT_CONNECTED for live mode when polymarketConnected is false", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue({
        polymarketConnected: false,
      } as any);
      db.strategy.update.mockResolvedValue(strategy as any); // rollback

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "live",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
        status: 422,
      });
    });

    it("throws NOT_CONNECTED for live mode when user record is null", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue(null);
      db.strategy.update.mockResolvedValue(strategy as any); // rollback

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "live",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
        status: 422,
      });
    });

    it("throws US_RAIL_TERMS_REQUIRED and rolls back before starting a US-rail live strategy when acceptance is stale", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
        venue: "POLYMARKET_US",
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.findUnique.mockResolvedValue({
        venue: "POLYMARKET_US",
      } as any);
      db.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
        polymarketUsConnected: true,
        usRailTermsAcceptedAt: new Date("2026-04-01T00:00:00.000Z"),
        usRailTermsVersion: "us-rail-2026-01-01",
      } as any);
      db.strategy.update.mockResolvedValue(strategy as any);

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "live",
        }),
      ).rejects.toMatchObject({
        response: { code: "US_RAIL_TERMS_REQUIRED" },
        status: 428,
      });

      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.IDLE },
      });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("throws ENGINE_ERROR when engine returns non-ok and non-204", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any); // rollback
      vi.mocked(client.post).mockResolvedValue(
        mockEngineResponse(false, 500, {
          code: "ENGINE_ERROR",
          message: "Internal error",
        }),
      );

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).rejects.toMatchObject({
        response: {
          code: "ENGINE_ERROR",
          message: "Failed to start strategy",
        },
        status: 422,
      });
    });

    it("uses code from engine error body without exposing engine message", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any); // rollback
      vi.mocked(client.post).mockResolvedValue(
        mockEngineResponse(false, 503, {
          code: "STRATEGY_TIMEOUT",
          message: "timeout",
        }),
      );

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).rejects.toMatchObject({
        response: {
          code: "STRATEGY_TIMEOUT",
          message: "Failed to start strategy",
        },
      });
    });

    it("rolls back status when engine start throws before returning a response", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      const err = new ServiceUnavailableException(
        "strategy-engine unavailable",
      );
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      vi.mocked(client.post).mockRejectedValue(err);

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).rejects.toBe(err);

      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.IDLE },
      });
      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it("succeeds when engine returns 204", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(false, 204));

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).resolves.toBeDefined();
    });

    it("throws NotFoundException when strategy not found", async () => {
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.start("bad-id", "user-1", {
          mode: "paper",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({
        userId: "other-user",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.start(strategy.id, "user-1", {
          mode: "paper",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────────

  describe("stop", () => {
    it("claims the DB transition before the engine call and sets IDLE on success", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([]); // no children
      vi.mocked(client.delete).mockResolvedValue(mockEngineResponse(true, 200));

      const result = await service.stop(strategy.id, "user-1");

      expect(result.status).toBe("IDLE");
      expect(result.stoppedAt).toBeDefined();
      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.RUNNING,
        },
        data: { status: StrategyStatus.IDLE },
      });
      expect(client.delete).toHaveBeenCalledWith(
        "http://strategy-engine:3006",
        "strategy-engine",
        `/internal/strategies/${strategy.id}`,
      );
      expect(db.strategy.update).not.toHaveBeenCalled();
    });

    it("reverts the DB claim when engine returns non-ok", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([]); // no children
      vi.mocked(client.delete).mockResolvedValue(
        mockEngineResponse(false, 503),
      );

      await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(db.strategy.updateMany).toHaveBeenCalled();
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.RUNNING },
      });
    });

    it("sets IDLE when engine returns 404 (runner already gone)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([]); // no children
      vi.mocked(client.delete).mockResolvedValue(
        mockEngineResponse(false, 404),
      );

      const result = await service.stop(strategy.id, "user-1");

      expect(result.status).toBe("IDLE");
      expect(result.stoppedAt).toBeDefined();
      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.RUNNING,
        },
        data: { status: StrategyStatus.IDLE },
      });
      expect(db.strategy.update).not.toHaveBeenCalled();
    });

    it("reverts the DB claim when engine stop throws before returning a response", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.PAPER,
      });
      const err = new ServiceUnavailableException(
        "strategy-engine unavailable",
      );
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.findMany.mockResolvedValue([]); // no children
      db.strategy.update.mockResolvedValue(strategy as any);
      vi.mocked(client.delete).mockRejectedValue(err);

      await expect(service.stop(strategy.id, "user-1")).rejects.toBe(err);

      expect(db.strategy.updateMany).toHaveBeenCalled();
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.PAPER },
      });
      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.stop("bad-id", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── pause ─────────────────────────────────────────────────────────────────

  describe("pause", () => {
    it("calls engine pause endpoint and returns PAUSED status", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      const result = await service.pause(strategy.id, "user-1");

      expect(result.status).toBe("PAUSED");
      expect(client.post).toHaveBeenCalledWith(
        "http://strategy-engine:3006",
        "strategy-engine",
        `/internal/strategies/${strategy.id}/pause`,
      );
      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.RUNNING,
        },
        data: { status: StrategyStatus.PAUSED },
      });
    });

    it("rolls back status when engine pause throws before returning a response", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.PAPER,
      });
      const err = new ServiceUnavailableException(
        "strategy-engine unavailable",
      );
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      vi.mocked(client.post).mockRejectedValue(err);

      await expect(service.pause(strategy.id, "user-1")).rejects.toBe(err);

      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.PAPER },
      });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.pause("bad-id", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.pause(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── resume ────────────────────────────────────────────────────────────────

  describe("resume", () => {
    it("calls engine resume endpoint and returns RUNNING status", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.PAUSED,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));

      const result = await service.resume(strategy.id, "user-1");

      expect(result.status).toBe("RUNNING");
      expect(client.post).toHaveBeenCalledWith(
        "http://strategy-engine:3006",
        "strategy-engine",
        `/internal/strategies/${strategy.id}/resume`,
      );
      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          id: strategy.id,
          userId: "user-1",
          status: StrategyStatus.PAUSED,
        },
        data: { status: StrategyStatus.RUNNING },
      });
    });

    it("rolls back status when engine resume throws before returning a response", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.PAUSED,
      });
      const err = new ServiceUnavailableException(
        "strategy-engine unavailable",
      );
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      vi.mocked(client.post).mockRejectedValue(err);

      await expect(service.resume(strategy.id, "user-1")).rejects.toBe(err);

      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.PAUSED },
      });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.resume("bad-id", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.resume(strategy.id, "user-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── fork ──────────────────────────────────────────────────────────────────

  describe("fork", () => {
    it("creates a forked copy of the strategy", async () => {
      const original = makeStrategy({
        id: "orig-1",
        userId: "owner-id",
        name: "Original",
        visibility: "PUBLIC",
      });
      const forked = makeStrategy({
        userId: "user-1",
        name: "Fork of Original",
        forkedFromId: "orig-1",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(original as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(forked as any);
      db.strategy.update.mockResolvedValue(original as any);

      const result = await service.fork("orig-1", "user-1");

      expect(result.name).toBe("Fork of Original");
      expect(result.forkedFromId).toBe("orig-1");
      expect(db.strategy.update).not.toHaveBeenCalled();
    });

    it("sets forked strategy to IDLE with version 1 and template false", async () => {
      const original = makeStrategy({
        id: "orig-1",
        userId: "owner-id",
        visibility: "PUBLIC",
      });
      db.strategy.findUnique.mockResolvedValue(original as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);
      db.strategy.update.mockResolvedValue(original as any);

      await service.fork("orig-1", "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.status).toBe(StrategyStatus.IDLE);
      expect(dataArg.version).toBe(1);
      expect(dataArg.template).toBe(false);
      expect(dataArg.visibility).toBe("PRIVATE");
      expect(dataArg.forkedFromId).toBe("orig-1");
    });

    it('prefixes forked name with "Fork of "', async () => {
      const original = makeStrategy({
        id: "orig-1",
        name: "Great Strategy",
        visibility: "PUBLIC",
      });
      db.strategy.findUnique.mockResolvedValue(original as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);
      db.strategy.update.mockResolvedValue(original as any);

      await service.fork("orig-1", "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.name).toBe("Fork of Great Strategy");
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.fork("missing", "user-1")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws NotFoundException when strategy is ARCHIVED", async () => {
      const strategy = makeStrategy({ status: StrategyStatus.ARCHIVED });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.fork(strategy.id, "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when forking a PRIVATE strategy not owned by user", async () => {
      const strategy = makeStrategy({
        userId: "owner-id",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.fork(strategy.id, "other-user"),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
        status: 403,
      });
    });

    it("allows owner to fork their own PRIVATE strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await expect(service.fork(strategy.id, "user-1")).resolves.toBeDefined();
    });

    it("throws STRATEGY_LIMIT_REACHED when user already has 3 strategies (beta limit)", async () => {
      const strategy = makeStrategy({
        userId: "owner-id",
        visibility: "PUBLIC",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(3);

      await expect(service.fork(strategy.id, "user-1")).rejects.toMatchObject({
        response: { code: "STRATEGY_LIMIT_REACHED" },
        status: 422,
      });
    });
  });

  // ── like ──────────────────────────────────────────────────────────────────

  describe("like", () => {
    it("likes a strategy and returns liked=true with incremented count", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 5 });
      db.strategy.findUnique.mockResolvedValueOnce(strategy as any);
      db.strategyLike.findUnique.mockResolvedValue(null); // not yet liked
      db.strategyLike.create.mockResolvedValue({} as any);
      // $transaction callback calls tx.strategy.update which returns the select
      db.strategy.update.mockResolvedValue({ likeCount: 6 } as any);

      const result = await service.like(strategy.id, "user-1");

      expect(result.liked).toBe(true);
      expect(result.likeCount).toBe(6);
    });

    it("unlikes a strategy and returns liked=false with decremented count", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 5 });
      db.strategy.findUnique.mockResolvedValueOnce(strategy as any);
      db.strategyLike.findUnique.mockResolvedValue({
        userId: "user-1",
        strategyId: strategy.id,
      } as any);
      db.strategyLike.delete.mockResolvedValue({} as any);
      db.strategy.update.mockResolvedValue({ likeCount: 4 } as any);

      const result = await service.like(strategy.id, "user-1");

      expect(result.liked).toBe(false);
      expect(result.likeCount).toBe(4);
    });

    it("calls strategyLike.delete when toggling off", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValueOnce(strategy as any);
      db.strategyLike.findUnique.mockResolvedValue({
        userId: "user-1",
        strategyId: strategy.id,
      } as any);
      db.strategyLike.delete.mockResolvedValue({} as any);
      db.strategy.update.mockResolvedValue(strategy as any);

      await service.like(strategy.id, "user-1");

      expect(db.strategyLike.delete).toHaveBeenCalledWith({
        where: {
          userId_strategyId: { userId: "user-1", strategyId: strategy.id },
        },
      });
    });

    it("calls strategyLike.create when liking", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValueOnce(strategy as any);
      db.strategyLike.findUnique.mockResolvedValue(null);
      db.strategyLike.create.mockResolvedValue({} as any);
      db.strategy.update.mockResolvedValue(strategy as any);

      await service.like(strategy.id, "user-1");

      expect(db.strategyLike.create).toHaveBeenCalledWith({
        data: { userId: "user-1", strategyId: strategy.id },
      });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(service.like("missing", "user-1")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws NotFoundException when strategy is PRIVATE", async () => {
      const strategy = makeStrategy({ visibility: "PRIVATE" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.like(strategy.id, "user-1")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("returns the likeCount from the update result", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 10 });
      db.strategy.findUnique.mockResolvedValueOnce(strategy as any);
      db.strategyLike.findUnique.mockResolvedValue(null);
      db.strategyLike.create.mockResolvedValue({} as any);
      db.strategy.update.mockResolvedValue({ likeCount: 11 } as any);

      const result = await service.like(strategy.id, "user-1");

      expect(result.likeCount).toBe(11);
    });
  });

  // ── listComments ──────────────────────────────────────────────────────────

  describe("listComments", () => {
    it("returns paginated non-deleted comments", async () => {
      const comments = [makeComment(), makeComment()];
      db.strategyComment.findMany.mockResolvedValue(comments as any);
      db.strategyComment.count.mockResolvedValue(2);

      const result = await service.listComments("strat-1", makePaginationDto());

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("queries only non-deleted comments", async () => {
      db.strategyComment.findMany.mockResolvedValue([]);
      db.strategyComment.count.mockResolvedValue(0);

      await service.listComments("strat-1", makePaginationDto());

      const whereArg = (db.strategyComment.findMany as any).mock.calls[0][0]
        .where;
      expect(whereArg.deleted).toBe(false);
      expect(whereArg.strategyId).toBe("strat-1");
    });

    it("includes user data in response", async () => {
      db.strategyComment.findMany.mockResolvedValue([]);
      db.strategyComment.count.mockResolvedValue(0);

      await service.listComments("strat-1", makePaginationDto());

      const includeArg = (db.strategyComment.findMany as any).mock.calls[0][0]
        .include;
      expect(includeArg.user).toBeDefined();
    });

    it("applies pagination correctly", async () => {
      db.strategyComment.findMany.mockResolvedValue([]);
      db.strategyComment.count.mockResolvedValue(50);

      await service.listComments(
        "strat-1",
        makePaginationDto({ page: 2, limit: 10 }),
      );

      const callArg = (db.strategyComment.findMany as any).mock.calls[0][0];
      expect(callArg.skip).toBe(10);
      expect(callArg.take).toBe(10);
    });
  });

  // ── addComment ────────────────────────────────────────────────────────────

  describe("addComment", () => {
    it("creates and returns a new comment", async () => {
      const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
      const comment = makeComment({ content: "Great strategy!" });
      // findOne calls strategy.findUnique + strategy.count (for childCount)
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategyComment.create.mockResolvedValue(comment as any);

      const result = await service.addComment(strategy.id, "user-1", {
        content: "Great strategy!",
      });

      expect((result as any).content).toBe("Great strategy!");
    });

    it("creates comment with correct data", async () => {
      const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategyComment.count.mockResolvedValue(0);
      db.strategyComment.create.mockResolvedValue(makeComment() as any);

      await service.addComment(strategy.id, "user-1", {
        content: "Hello",
      });

      expect(db.strategyComment.create).toHaveBeenCalledWith({
        data: { strategyId: strategy.id, userId: "user-1", content: "Hello" },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      });
    });

    it("throws TOO_MANY_COMMENTS when user reaches the per-strategy comment cap", async () => {
      const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategyComment.count.mockResolvedValue(50);

      await expect(
        service.addComment(strategy.id, "user-1", {
          content: "extra",
        }),
      ).rejects.toMatchObject({
        response: {
          code: "TOO_MANY_COMMENTS",
        },
      });
      expect(db.strategyComment.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.addComment("bad-id", "user-1", {
          content: "x",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when commenting on a PRIVATE strategy not owned", async () => {
      const strategy = makeStrategy({
        userId: "other-user",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.addComment(strategy.id, "user-1", {
          content: "x",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── deleteComment ─────────────────────────────────────────────────────────

  describe("deleteComment", () => {
    it("soft-deletes the comment by setting deleted=true", async () => {
      const comment = makeComment({ strategyId: "strat-1", userId: "user-1" });
      db.strategyComment.findUnique.mockResolvedValue(comment as any);
      db.strategyComment.update.mockResolvedValue({
        ...comment,
        deleted: true,
      } as any);

      await service.deleteComment("strat-1", comment.id, "user-1");

      expect(db.strategyComment.update).toHaveBeenCalledWith({
        where: { id: comment.id },
        data: { deleted: true },
      });
    });

    it("returns undefined (void)", async () => {
      const comment = makeComment({ strategyId: "strat-1", userId: "user-1" });
      db.strategyComment.findUnique.mockResolvedValue(comment as any);
      db.strategyComment.update.mockResolvedValue(comment as any);

      const result = await service.deleteComment(
        "strat-1",
        comment.id,
        "user-1",
      );

      expect(result).toBeUndefined();
    });

    it("throws NotFoundException when comment does not exist", async () => {
      db.strategyComment.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteComment("strat-1", "bad-id", "user-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws NotFoundException when comment belongs to a different strategy", async () => {
      const comment = makeComment({
        strategyId: "other-strat",
        userId: "user-1",
      });
      db.strategyComment.findUnique.mockResolvedValue(comment as any);

      await expect(
        service.deleteComment("strat-1", comment.id, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
        status: 404,
      });
    });

    it("throws ForbiddenException when user is not the comment author", async () => {
      const comment = makeComment({
        strategyId: "strat-1",
        userId: "comment-owner",
      });
      db.strategyComment.findUnique.mockResolvedValue(comment as any);

      await expect(
        service.deleteComment("strat-1", comment.id, "other-user"),
      ).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
        status: 403,
      });
    });
  });

  // ── report ────────────────────────────────────────────────────────────────

  describe("report", () => {
    it("creates a report and returns reportId", async () => {
      const strategy = makeStrategy({ userId: "owner", visibility: "PUBLIC" });
      const report = makeReport({ id: "report-abc" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.report.create.mockResolvedValue(report as any);

      const result = await service.report(strategy.id, "user-1", {
        reason: "SPAM",
      });

      expect(result.reportId).toBe("report-abc");
    });

    it("creates report with correct fields", async () => {
      const strategy = makeStrategy({
        id: "strat-1",
        userId: "owner",
        visibility: "PUBLIC",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.report.create.mockResolvedValue(makeReport() as any);

      await service.report("strat-1", "reporter-1", {
        reason: "MISLEADING",
        description: "False claims",
      });

      expect(db.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: "reporter-1",
          targetType: "STRATEGY",
          targetId: "strat-1",
          strategyId: "strat-1",
          reason: "MISLEADING",
          description: "False claims",
        },
      });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.report("bad-id", "user-1", {
          reason: "SPAM",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when reporting a PRIVATE strategy not visible to reporter", async () => {
      const strategy = makeStrategy({ userId: "owner", visibility: "PRIVATE" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.report(strategy.id, "other-user", {
          reason: "SPAM",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows reporting with no description (optional field)", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.report.create.mockResolvedValue(makeReport() as any);

      await expect(
        service.report(strategy.id, "user-1", {
          reason: "OTHER",
        }),
      ).resolves.toBeDefined();
    });
  });

  // ── listTemplates ─────────────────────────────────────────────────────────

  describe("listTemplates", () => {
    it("returns only template strategies", async () => {
      const templates = [
        makeStrategy({ template: true }),
        makeStrategy({ template: true }),
      ];
      db.strategy.findMany.mockResolvedValue(templates as any);
      db.strategy.count.mockResolvedValue(2);

      const result = await service.listTemplates(makePaginationDto());

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("queries with template=true and excludes ARCHIVED", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.listTemplates(makePaginationDto());

      const whereArg = (db.strategy.findMany as any).mock.calls[0][0].where;
      expect(whereArg.template).toBe(true);
      expect(whereArg.status).toEqual({ not: StrategyStatus.ARCHIVED });
    });

    it("applies pagination correctly", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(30);

      await service.listTemplates(makePaginationDto({ page: 2, limit: 5 }));

      const callArg = (db.strategy.findMany as any).mock.calls[0][0];
      expect(callArg.skip).toBe(5);
      expect(callArg.take).toBe(5);
    });

    it("orders by createdAt desc", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.listTemplates(makePaginationDto());

      const callArg = (db.strategy.findMany as any).mock.calls[0][0];
      expect(callArg.orderBy).toEqual({ createdAt: "desc" });
    });

    it("sets hasNext correctly when more templates exist", async () => {
      db.strategy.findMany.mockResolvedValue(
        Array.from({ length: 10 }, () =>
          makeStrategy({ template: true }),
        ) as any,
      );
      db.strategy.count.mockResolvedValue(15);

      const result = await service.listTemplates(
        makePaginationDto({ page: 1, limit: 10 }),
      );

      expect(result.hasNext).toBe(true);
      expect(result.totalPages).toBe(2);
    });
  });

  // ── canvas persistence ─────────────────────────────────────────────────

  describe("canvas persistence", () => {
    it("create strategy with canvas positions saves correctly", async () => {
      const canvas = {
        blocks: [
          { id: "b1", x: 80, y: 80 },
          { id: "b2", x: 420, y: 80 },
        ],
        connections: [{ id: "c1", fromBlockId: "b1", toBlockId: "b2" }],
      };
      const dto: CreateStrategyDto = {
        name: "Canvas Strat",
        canvas,
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(
        makeStrategy({ name: "Canvas Strat", canvas }) as any,
      );

      const result = await service.create("user-1", dto);

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.canvas).toEqual(canvas);
      expect(result.canvas).toEqual(canvas);
    });

    it("update strategy canvas positions updates correctly", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      const newCanvas = {
        blocks: [{ id: "b1", x: 200, y: 300 }],
        connections: [],
      };
      db.strategy.update.mockResolvedValue(
        makeStrategy({ ...strategy, canvas: newCanvas }) as any,
      );

      const result = await service.update(strategy.id, "user-1", {
        canvas: newCanvas,
      });

      const dataArg = (db.strategy.update as any).mock.calls[0][0].data;
      expect(dataArg.canvas).toEqual(newCanvas);
      expect(result.canvas).toEqual(newCanvas);
    });

    it("strategy without canvas loads with null/undefined canvas (backward compat)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "PUBLIC",
      });
      // Simulate old strategy without canvas field
      delete (strategy as any).canvas;
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.findOne(strategy.id, "user-1");

      expect(result.canvas).toBeUndefined();
    });
  });

  // ── exportStrategy ─────────────────────────────────────────────────────

  describe("exportStrategy", () => {
    it("returns correct .polyforge format for owner", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        name: "My Momentum Strategy",
        description: "Test desc",
        execMode: "TICK",
        tickMs: 5000,
        visibility: "PRIVATE",
        tags: ["momentum"],
        triggers: [{ type: "PRICE_CROSSES_UP", config: { threshold: "0.6" } }],
        conditions: [
          { type: "PRICE_IN_RANGE", config: { min: "0.3", max: "0.8" } },
        ],
        actions: [{ type: "BUY_YES", config: { size: "50" } }],
        safety: [{ type: "STOP_IF_DAILY_LOSS", config: { maxLoss: "50" } }],
        canvas: { positions: { b1: { x: 100, y: 100 } }, connections: [] },
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      const result = await service.exportStrategy(strategy.id, "user-1");

      expect(result.payload).toHaveProperty("polyforge", "1.0");
      expect(result.payload).toHaveProperty("exportedAt");
      expect((result.payload as any).strategy.name).toBe(
        "My Momentum Strategy",
      );
      expect((result.payload as any).strategy.blocks.triggers).toHaveLength(1);
      expect((result.payload as any).strategy.blocks.safety).toHaveLength(1);
      expect((result.payload as any).strategy.blocks.conditions).toHaveLength(
        1,
      );
      expect((result.payload as any).strategy.blocks.actions).toHaveLength(1);
      expect((result.payload as any).strategy.canvas).toBeDefined();
      expect(result.filename).toBe("my-momentum-strategy.polyforge");
    });

    it("throws NOT_FOUND for archived strategy", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.ARCHIVED,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.exportStrategy(strategy.id, "user-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws FORBIDDEN for private strategy when not owner", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "PRIVATE",
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.exportStrategy(strategy.id, "other-user"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows export of public strategy by non-owner (without canvas)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "PUBLIC",
        canvas: { positions: { b1: { x: 100, y: 100 } }, connections: [] },
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      const result = await service.exportStrategy(strategy.id, "other-user");

      expect((result.payload as any).strategy.name).toBe("My Strategy");
      expect((result.payload as any).strategy.canvas).toBeUndefined();
    });

    it("allows export of unlisted strategy by non-owner (without canvas)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        visibility: "UNLISTED",
        canvas: { positions: {}, connections: [] },
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      const result = await service.exportStrategy(strategy.id, "other-user");

      expect((result.payload as any).strategy.canvas).toBeUndefined();
    });

    it("throws NOT_FOUND when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.exportStrategy("nonexistent", "user-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── importStrategy ─────────────────────────────────────────────────────

  describe("importStrategy", () => {
    it("creates a new strategy from import data", async () => {
      const importDto = {
        polyforge: "1.0",
        exportedAt: "2026-03-22T12:00:00Z",
        strategy: {
          name: "Imported Strategy",
          description: "Imported desc",
          execMode: "TICK",
          tickMs: 5000,
          visibility: "PUBLIC",
          tags: ["tag1"],
          blocks: {
            safety: [{ type: "STOP_IF_DAILY_LOSS", config: { maxLoss: "50" } }],
            triggers: [
              { type: "PRICE_CROSSES_UP", config: { threshold: "0.6" } },
            ],
            conditions: [],
            actions: [{ type: "BUY_YES", config: { size: "50" } }],
          },
          canvas: { positions: {}, connections: [] },
        },
      };
      const created = makeStrategy({ name: "Imported Strategy" });
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(created as any);

      const result = await service.importStrategy(importDto, "user-2");

      expect(result).toEqual(created);
      expect(db.strategy.create).toHaveBeenCalledOnce();

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.userId).toBe("user-2");
      expect(dataArg.name).toBe("Imported Strategy");
      expect(dataArg.visibility).toBe("PRIVATE");
      expect(dataArg.status).toBe(StrategyStatus.IDLE);
      expect(dataArg.version).toBe(1);
      expect(dataArg.template).toBe(false);
    });

    it("strips original ID and generates new one (no id in data)", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Test Import",
          blocks: {
            triggers: [{ type: "PRICE_CROSSES_UP", config: {} }],
          },
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.id).toBeUndefined();
    });

    it("always sets visibility to PRIVATE regardless of import data", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Public Strat",
          visibility: "PUBLIC",
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.visibility).toBe("PRIVATE");
    });

    it("sets owner to the authenticated user", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Someone Else's Strategy",
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-42");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.userId).toBe("user-42");
    });

    it("throws STRATEGY_LIMIT_REACHED when at max strategies", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Over limit",
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(50);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "STRATEGY_LIMIT_REACHED" },
        status: 422,
      });
      expect(db.strategy.create).not.toHaveBeenCalled();
    });

    it("handles missing blocks gracefully", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "No blocks",
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.triggers).toEqual([]);
      expect(dataArg.conditions).toEqual([]);
      expect(dataArg.actions).toEqual([]);
      expect(dataArg.safety).toEqual([]);
    });

    it("uses default execMode and tickMs when not provided", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Defaults",
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.execMode).toBe("TICK");
      expect(dataArg.tickMs).toBe(1000);
    });

    it("rejects import with unknown block type", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Bad Blocks",
          blocks: {
            triggers: [{ type: "TOTALLY_FAKE_BLOCK", config: {} }],
          },
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "IMPORT_UNKNOWN_BLOCK_TYPE" },
        status: 422,
      });
    });

    it("rejects MAX_POSITION_SIZE in safety section during import", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Position in Safety",
          blocks: {
            safety: [{ type: "MAX_POSITION_SIZE", config: { maxUsdc: "100" } }],
            conditions: [{ type: "PRICE_ABOVE", config: { threshold: "0.5" } }],
          },
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "IMPORT_MAX_POSITION_SIZE_IN_SAFETY" },
        status: 422,
      });
    });

    it("rejects import exceeding 100 total blocks", async () => {
      const triggers = Array.from({ length: 101 }, (_, i) => ({
        type: "PRICE_ABOVE",
        config: { threshold: String(i) },
      }));
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Too Many Blocks",
          blocks: { triggers },
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "IMPORT_TOO_MANY_BLOCKS" },
        status: 422,
      });
    });

    it("rejects import with expression exceeding 200 chars", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Long Expression",
          variables: [{ name: "v1", expression: "x+".repeat(150) + "x" }],
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "IMPORT_EXPRESSION_TOO_LONG" },
        status: 422,
      });
    });

    it("strips HTML from imported name and description", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "<script>alert('xss')</script>Clean Name",
          description: "<b>Bold</b> description",
          blocks: {},
        },
      };
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(makeStrategy() as any);

      await service.importStrategy(importDto, "user-1");

      const dataArg = (db.strategy.create as any).mock.calls[0][0].data;
      expect(dataArg.name).toBe("alert('xss')Clean Name");
      expect(dataArg.description).toBe("Bold description");
    });

    it("rejects import with invalid stop-loss pct (zero)", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Bad Stop Loss",
          blocks: {
            actions: [{ type: "SET_STOP_LOSS", config: { pct: "0" } }],
          },
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "INVALID_BLOCK_CONFIG" },
        status: 400,
      });
      expect(db.strategy.create).not.toHaveBeenCalled();
    });

    it("rejects import with invalid take-profit pct (>=1)", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Bad Take Profit",
          blocks: {
            actions: [{ type: "TAKE_PROFIT", config: { pct: "1.5" } }],
          },
        },
      };
      db.strategy.count.mockResolvedValue(0);

      await expect(
        service.importStrategy(importDto as any, "user-1"),
      ).rejects.toMatchObject({
        response: { code: "INVALID_BLOCK_CONFIG" },
        status: 400,
      });
      expect(db.strategy.create).not.toHaveBeenCalled();
    });

    it("accepts import with valid stop-loss and take-profit pct", async () => {
      const importDto = {
        polyforge: "1.0",
        strategy: {
          name: "Valid Import",
          blocks: {
            actions: [
              { type: "SET_STOP_LOSS", config: { pct: "0.1" } },
              { type: "TAKE_PROFIT", config: { pct: "0.25" } },
            ],
          },
        },
      };
      const created = makeStrategy({ name: "Valid Import" });
      db.strategy.count.mockResolvedValue(0);
      db.strategy.create.mockResolvedValue(created as any);

      await service.importStrategy(importDto as any, "user-1");
      expect(db.strategy.create).toHaveBeenCalledOnce();
    });
  });

  // ── stop — conflict case ────────────────────────────────────────────────────

  describe("stop — conflict case", () => {
    it("throws ConflictException when strategy is owned but not in a running state", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("stops running children before stopping the parent", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.findMany.mockResolvedValue([
        { id: "child-1" },
        { id: "child-2" },
      ] as any);
      vi.mocked(client.delete).mockResolvedValue(mockEngineResponse(true, 200));

      await service.stop(strategy.id, "user-1");

      // Should have called delete for both children + parent
      expect(client.delete).toHaveBeenCalledTimes(3);
    });

    it("fails closed when a child strategy stop request throws", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([{ id: "child-1" }] as any);
      vi.mocked(client.delete).mockRejectedValue(new Error("engine down"));

      await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(db.strategy.updateMany).toHaveBeenCalled();
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.RUNNING },
      });
    });

    it("fails closed when a child strategy stop request is rejected by the engine", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([{ id: "child-1" }] as any);
      vi.mocked(client.delete).mockResolvedValue(
        mockEngineResponse(false, 503),
      );

      await expect(service.stop(strategy.id, "user-1")).rejects.toMatchObject({
        response: { code: "ENGINE_CHILD_STOP_FAILED" },
      });

      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(db.strategy.updateMany).toHaveBeenCalled();
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.RUNNING },
      });
    });

    it("proceeds when child strategy returns 404 (runner already gone)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([{ id: "child-1" }] as any);
      vi.mocked(client.delete).mockResolvedValue(
        mockEngineResponse(false, 404),
      );

      const result = await service.stop(strategy.id, "user-1");

      expect(result.status).toBe("IDLE");
      // Child delete + parent delete both called
      expect(client.delete).toHaveBeenCalledTimes(2);
      expect(db.strategy.updateMany).toHaveBeenCalled();
      expect(db.strategy.update).not.toHaveBeenCalled();
    });

    it("restores child DB status before restart, rolls back to IDLE on restart failure (parent stop rollback)", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 1 });
      db.strategy.update.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([
        { id: "child-1", status: StrategyStatus.RUNNING },
      ] as any);

      // child-1 stop succeeds → added to stoppedChildren
      vi.mocked(client.delete).mockResolvedValueOnce(
        mockEngineResponse(true, 200),
      );
      // parent stop fails → triggers rollback
      vi.mocked(client.delete).mockRejectedValueOnce(new Error("engine down"));

      // child-1 restart fails → DB must be rolled back to IDLE
      vi.mocked(client.post).mockResolvedValueOnce(
        mockEngineResponse(false, 503),
      );

      await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      // child delete + parent delete both called
      expect(client.delete).toHaveBeenCalledTimes(2);
      // child restart was attempted
      expect(client.post).toHaveBeenCalledTimes(1);
      // parent rollback: status restored
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: strategy.id },
        data: { status: StrategyStatus.RUNNING },
      });
      // child DB restored to RUNNING BEFORE engine restart
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: { status: StrategyStatus.RUNNING, parentStrategyId: strategy.id },
      });
      // child DB rolled back to IDLE after failed restart
      expect(db.strategy.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: { status: StrategyStatus.IDLE, parentStrategyId: null },
      });
    });
  });

  it("restores child DB status before restart on child stop failure rollback", async () => {
    const strategy = makeStrategy({
      userId: "user-1",
      status: StrategyStatus.RUNNING,
    });
    db.strategy.findUnique.mockResolvedValue(strategy as any);
    db.strategy.updateMany.mockResolvedValue({ count: 1 });
    db.strategy.update.mockResolvedValue(strategy as any);
    db.strategy.findMany.mockResolvedValue([
      { id: "child-1", status: StrategyStatus.RUNNING },
      { id: "child-2", status: StrategyStatus.PAPER },
    ] as any);

    // child-1 stop succeeds
    vi.mocked(client.delete).mockResolvedValueOnce(
      mockEngineResponse(true, 200),
    );
    // child-2 stop fails → triggers rollback
    vi.mocked(client.delete).mockResolvedValueOnce(
      mockEngineResponse(false, 503),
    );

    // engine restart calls for the one successfully stopped child
    vi.mocked(client.post).mockResolvedValueOnce(mockEngineResponse(true, 200));

    await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    // child-1 DB restored to RUNNING BEFORE engine restart
    expect(db.strategy.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { status: StrategyStatus.RUNNING, parentStrategyId: strategy.id },
    });
    // engine restart called for child-1
    expect(client.post).toHaveBeenCalledTimes(1);
    // child-2 (failed stop) was NOT added to stoppedChildren → no restart
    const child2UpdateCalls = (db.strategy.update as any).mock.calls.filter(
      (call: any) =>
        call[0].where.id === "child-2" && call[0].data.status !== undefined,
    );
    expect(child2UpdateCalls).toHaveLength(0);
  });

  it("rehydrates PAPER child in paper mode during parent stop rollback", async () => {
    const strategy = makeStrategy({
      userId: "user-1",
      status: StrategyStatus.RUNNING,
    });
    db.strategy.findUnique.mockResolvedValue(strategy as any);
    db.strategy.updateMany.mockResolvedValue({ count: 1 });
    db.strategy.update.mockResolvedValue(strategy as any);
    db.strategy.findMany.mockResolvedValue([
      { id: "child-1", status: StrategyStatus.PAPER },
    ] as any);

    // child-1 stop succeeds → added to stoppedChildren
    vi.mocked(client.delete).mockResolvedValueOnce(
      mockEngineResponse(true, 200),
    );
    // parent stop fails → triggers rollback
    vi.mocked(client.delete).mockRejectedValueOnce(new Error("engine down"));

    // engine restart succeeds
    vi.mocked(client.post).mockResolvedValueOnce(mockEngineResponse(true, 200));

    await expect(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    // child DB restored to PAPER BEFORE engine restart (so engine reads PAPER mode)
    expect(db.strategy.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { status: StrategyStatus.PAPER, parentStrategyId: strategy.id },
    });
    // engine restart called
    expect(client.post).toHaveBeenCalledTimes(1);
    // child DB NOT rolled back to IDLE (restart succeeded)
    const idleCalls = (db.strategy.update as any).mock.calls.filter(
      (call: any) =>
        call[0].where.id === "child-1" &&
        call[0].data.status === StrategyStatus.IDLE,
    );
    expect(idleCalls).toHaveLength(0);
  });

  // ── pause — conflict case ───────────────────────────────────────────────────

  describe("pause — conflict case", () => {
    it("throws ConflictException when strategy is owned but not in RUNNING/PAPER state", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(service.pause(strategy.id, "user-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ── resume — conflict case ──────────────────────────────────────────────────

  describe("resume — conflict case", () => {
    it("throws ConflictException when strategy is owned but not in PAUSED state", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.RUNNING,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.resume(strategy.id, "user-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── start — ARCHIVED fallback case ─────────────────────────────────────────

  describe("start — ARCHIVED fallback case", () => {
    it("throws NotFoundException when strategy is ARCHIVED", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.ARCHIVED,
      });
      db.strategy.updateMany.mockResolvedValue({ count: 0 });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.start(strategy.id, "user-1", { mode: "paper" } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── listChildren ──────────────────────────────────────────────────────────

  describe("listChildren", () => {
    it("returns children of a strategy", async () => {
      const strategy = makeStrategy({ userId: "user-1" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.findMany.mockResolvedValue([
        { id: "child-1", name: "Child 1", status: "IDLE" },
        { id: "child-2", name: "Child 2", status: "RUNNING" },
      ] as any);

      const result = await service.listChildren(strategy.id, "user-1");

      expect(result.children).toHaveLength(2);
      expect(result.children[0].id).toBe("child-1");
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      db.strategy.findUnique.mockResolvedValue(null);

      await expect(
        service.listChildren("missing", "user-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when user does not own the strategy", async () => {
      const strategy = makeStrategy({ userId: "other-user" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);

      await expect(
        service.listChildren(strategy.id, "user-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── addComment — HTML stripping ─────────────────────────────────────────────

  describe("addComment — XSS stripping", () => {
    it("strips HTML tags from comment content", async () => {
      const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.count.mockResolvedValue(0);
      db.strategyComment.count.mockResolvedValue(0);
      db.strategyComment.create.mockResolvedValue(
        makeComment({ content: "Clean text" }) as any,
      );

      await service.addComment(strategy.id, "user-1", {
        content: "<script>alert('xss')</script>Clean text",
      });

      expect(db.strategyComment.create).toHaveBeenCalledWith({
        data: {
          strategyId: strategy.id,
          userId: "user-1",
          content: "alert('xss')Clean text",
        },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      });
    });
  });

  // ── remove — detach children ──────────────────────────────────────────────

  describe("remove — child detachment", () => {
    it("detaches children by setting parentStrategyId to null before archiving", async () => {
      const strategy = makeStrategy({
        userId: "user-1",
        status: StrategyStatus.IDLE,
      });
      db.strategy.findUnique.mockResolvedValue(strategy as any);
      db.strategy.updateMany.mockResolvedValue({ count: 2 });
      db.strategy.update.mockResolvedValue({
        ...strategy,
        status: StrategyStatus.ARCHIVED,
      } as any);

      await service.remove(strategy.id, "user-1");

      // updateMany should be called to detach children
      expect(db.strategy.updateMany).toHaveBeenCalledWith({
        where: { parentStrategyId: strategy.id },
        data: { parentStrategyId: null },
      });
    });
  });

  // ── createFromDescription ─────────────────────────────────────────────────

  describe("createFromDescription", () => {
    it("calls LLM with block types in the prompt", async () => {
      const llmResponse = JSON.stringify({
        name: "AI Strategy",
        description: "Test",
        execMode: "TICK",
        safety: [],
        triggers: [{ type: "PRICE_ABOVE", config: { price: 0.5 } }],
        conditions: [],
        actions: [{ type: "BUY_YES", config: { size: "10" } }],
      });
      (llm.analyze as any).mockResolvedValue(llmResponse);
      db.strategy.count.mockResolvedValue(0);
      (db.strategy.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: "new-id",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      await service.createFromDescription("user-1", {
        description: "Buy YES when price goes above 0.5",
      });

      const prompt = (llm.analyze as any).mock.calls[0][0];
      expect(prompt).toContain("PRICE_ABOVE");
      expect(prompt).toContain("BUY_YES");
      expect(prompt).toContain("DAILY_LOSS_LIMIT");
    });

    it("parses valid LLM JSON response and creates a strategy", async () => {
      const llmResponse = JSON.stringify({
        name: "Momentum Bot",
        description: "Buys on dips",
        execMode: "TICK",
        safety: [{ type: "DAILY_LOSS_LIMIT", config: { limit: 50 } }],
        triggers: [{ type: "PRICE_BELOW", config: { price: 0.3 } }],
        conditions: [{ type: "MIN_LIQUIDITY", config: { min: 5000 } }],
        actions: [{ type: "BUY_YES", config: { size: "25" } }],
      });
      (llm.analyze as any).mockResolvedValue(llmResponse);
      db.strategy.count.mockResolvedValue(0);
      (db.strategy.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: "new-id",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await service.createFromDescription("user-1", {
        description: "Buy YES on any market where price drops below 0.30",
      });

      expect(result.name).toBe("Momentum Bot");
      expect(db.strategy.create).toHaveBeenCalled();
    });

    it("rejects invalid block types from LLM", async () => {
      const llmResponse = JSON.stringify({
        name: "Bad Strategy",
        triggers: [{ type: "INVALID_BLOCK_TYPE", config: {} }],
        conditions: [],
        actions: [],
        safety: [],
      });
      (llm.analyze as any).mockResolvedValue(llmResponse);

      await expect(
        service.createFromDescription("user-1", {
          description: "Do something invalid",
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("handles LLM failure gracefully", async () => {
      (llm.analyze as any).mockRejectedValue(
        new Error("All LLM providers failed"),
      );

      await expect(
        service.createFromDescription("user-1", {
          description: "Create a basic strategy",
        }),
      ).rejects.toThrow();
    });

    it("handles non-JSON LLM response", async () => {
      (llm.analyze as any).mockResolvedValue("This is not valid JSON at all");

      await expect(
        service.createFromDescription("user-1", {
          description: "Create something",
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("handles markdown-wrapped JSON response from LLM", async () => {
      const json = JSON.stringify({
        name: "Wrapped Strategy",
        triggers: [{ type: "TICK", config: {} }],
        conditions: [],
        actions: [{ type: "BUY_YES", config: { size: "10" } }],
        safety: [],
      });
      (llm.analyze as any).mockResolvedValue("```json\n" + json + "\n```");
      db.strategy.count.mockResolvedValue(0);
      (db.strategy.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: "new-id",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await service.createFromDescription("user-1", {
        description: "Simple tick strategy",
      });

      expect(result.name).toBe("Wrapped Strategy");
    });
  });
});
