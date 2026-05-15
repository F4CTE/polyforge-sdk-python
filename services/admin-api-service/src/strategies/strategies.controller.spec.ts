import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: class {},
  PrismaAdminService: class {},
}));
vi.mock("@polyforge/shared-redis", () => ({
  RedisService: class {},
}));
vi.mock("@polyforge/shared-types", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN",
    SUPPORT: "SUPPORT",
    VIEWER: "VIEWER",
  },
  AdminJwtPayload: {} as any,
}));
vi.mock("@polyforge/shared-auth", () => ({}));

import { GUARDS_METADATA } from "@nestjs/common/constants";
import { StrategiesController } from "./strategies.controller";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { ROLES_KEY } from "../common/guard/roles.guard";
function createMockStrategiesService() {
  return {
    findAll: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      pages: 0,
    }),
    forceStop: vi
      .fn()
      .mockResolvedValue({ status: "IDLE", stoppedBy: "admin" }),
    unpublish: vi.fn().mockResolvedValue({ id: "s1", visibility: "PRIVATE" }),
    createTemplate: vi.fn().mockResolvedValue({ id: "s1", template: true }),
  } as any;
}

function createMockAuditService() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    logSafe: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("StrategiesController", () => {
  let controller: StrategiesController;
  let strategiesService: ReturnType<typeof createMockStrategiesService>;
  let auditService: ReturnType<typeof createMockAuditService>;

  beforeEach(() => {
    strategiesService = createMockStrategiesService();
    auditService = createMockAuditService();
    controller = new StrategiesController(strategiesService, auditService);
  });

  // ── Service delegation ──────────────────────────────────────────────────

  describe("findAll", () => {
    it("delegates to strategiesService.findAll with parsed params", async () => {
      await controller.findAll(1, 20, "u1", "RUNNING", "PUBLIC");

      expect(strategiesService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        userId: "u1",
        status: "RUNNING",
        visibility: "PUBLIC",
      });
    });

    it("returns paginated result from service", async () => {
      strategiesService.findAll.mockResolvedValue({
        data: [{ id: "s1", name: "Test" }],
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      });

      const result = await controller.findAll(1, 20);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("forceStop", () => {
    it("delegates to strategiesService.forceStop and logs attempt (log) + success (logSafe) audit", async () => {
      const admin = { sub: "a1", role: "SUPER_ADMIN" } as any;
      const ip = "127.0.0.1";

      const result = await controller.forceStop("s1", admin, ip);

      expect(strategiesService.forceStop).toHaveBeenCalledWith("s1");
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith({
        adminId: "a1",
        action: "FORCE_STOP_STRATEGY",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "attempt",
      });
      expect(auditService.logSafe).toHaveBeenCalledTimes(1);
      expect(auditService.logSafe).toHaveBeenCalledWith({
        adminId: "a1",
        action: "FORCE_STOP_STRATEGY",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "success",
      });
      expect(result).toEqual({ status: "IDLE", stoppedBy: "admin" });
    });
  });

  describe("unpublish", () => {
    it("delegates to strategiesService.unpublish and logs attempt (log) + success (logSafe) audit", async () => {
      const admin = { sub: "a1", role: "SUPER_ADMIN" } as any;
      const ip = "127.0.0.1";

      const result = await controller.unpublish("s1", admin, ip);

      expect(strategiesService.unpublish).toHaveBeenCalledWith("s1");
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith({
        adminId: "a1",
        action: "UNPUBLISH_STRATEGY",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "attempt",
      });
      expect(auditService.logSafe).toHaveBeenCalledTimes(1);
      expect(auditService.logSafe).toHaveBeenCalledWith({
        adminId: "a1",
        action: "UNPUBLISH_STRATEGY",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "success",
      });
      expect(result).toEqual({ id: "s1", visibility: "PRIVATE" });
    });
  });

  describe("createTemplate", () => {
    it("delegates to strategiesService.createTemplate and logs attempt (log) + success (logSafe) audit", async () => {
      const admin = { sub: "a1", role: "SUPER_ADMIN" } as any;
      const ip = "127.0.0.1";

      const result = await controller.createTemplate("s1", admin, ip);

      expect(strategiesService.createTemplate).toHaveBeenCalledWith("s1");
      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith({
        adminId: "a1",
        action: "CREATE_STRATEGY_TEMPLATE",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "attempt",
      });
      expect(auditService.logSafe).toHaveBeenCalledTimes(1);
      expect(auditService.logSafe).toHaveBeenCalledWith({
        adminId: "a1",
        action: "CREATE_STRATEGY_TEMPLATE",
        targetType: "strategy",
        targetId: "s1",
        ip,
        status: "success",
      });
      expect(result).toEqual({ id: "s1", template: true });
    });
  });

  // ── Guard metadata — regression tests for POLA-4446 ───────────────────

  describe("guard metadata", () => {
    it("has class-level @UseGuards with both AdminJwtGuard and RolesGuard", () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        StrategiesController,
      ) as Array<{ name?: string }>;

      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThanOrEqual(2);

      const guardNames = guards.map((g) => g.name);
      expect(guardNames).toContain("AdminJwtGuard");
      expect(guardNames).toContain("RolesGuard");
    });

    it("class-level guards include AdminJwtGuard (POLA-4446 regression)", () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        StrategiesController,
      ) as Array<{ name?: string }>;

      expect(guards.some((g) => g === AdminJwtGuard)).toBe(true);
    });

    it("class-level @Roles permits SUPER_ADMIN and ADMIN", () => {
      const roles = Reflect.getMetadata(ROLES_KEY, StrategiesController);

      expect(roles).toContain("SUPER_ADMIN");
      expect(roles).toContain("ADMIN");
    });

    it("findAll has no method-level @Roles — inherits class-level", () => {
      const methodRoles = Reflect.getMetadata(
        ROLES_KEY,
        StrategiesController.prototype.findAll,
      );

      expect(methodRoles).toBeUndefined();
    });

    it("forceStop has method-level @Roles matching class-level", () => {
      const methodRoles = Reflect.getMetadata(
        ROLES_KEY,
        StrategiesController.prototype.forceStop,
      );

      expect(methodRoles).toContain("SUPER_ADMIN");
      expect(methodRoles).toContain("ADMIN");
    });

    it("unpublish has method-level @Roles matching class-level", () => {
      const methodRoles = Reflect.getMetadata(
        ROLES_KEY,
        StrategiesController.prototype.unpublish,
      );

      expect(methodRoles).toContain("SUPER_ADMIN");
      expect(methodRoles).toContain("ADMIN");
    });

    it("createTemplate overrides with method-level @Roles (SUPER_ADMIN only)", () => {
      const methodRoles = Reflect.getMetadata(
        ROLES_KEY,
        StrategiesController.prototype.createTemplate,
      );

      expect(methodRoles).toContain("SUPER_ADMIN");
      expect(methodRoles).not.toContain("ADMIN");
    });
  });
});
