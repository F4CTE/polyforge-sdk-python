import { describe, it, expect, vi } from "vitest";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: class {},
  PrismaAdminService: class {},
}));
vi.mock("@polyforge/shared-redis", () => ({
  RedisService: class {},
  RedisModule: class {},
  BetaLimitsConfigService: class {},
  BETA_LIMITS_DEFAULTS: {},
  runOncePerCluster: () => () => {},
}));
vi.mock("@polyforge/shared-types", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN",
    SUPPORT: "SUPPORT",
    VIEWER: "VIEWER",
  },
  AdminJwtPayload: class {},
}));
vi.mock("@polyforge/shared-auth", () => ({}));

import { GUARDS_METADATA } from "@nestjs/common/constants";

// Controllers — relative to src/common/guard/
import { AdminsController } from "../../admins/admins.controller";
import { BacktestsController } from "../../backtests/backtests.controller";
import { BuilderController } from "../../builder/builder.controller";
import { CacheAdminController } from "../../cache/cache.controller";
import { ConfigFlagsController } from "../../config-flags/config-flags.controller";
import { DashboardController } from "../../dashboard/dashboard.controller";
import { InvitesController } from "../../invites/invites.controller";
import { KeyRotationController } from "../../key-rotation/key-rotation.controller";
import { LogsController } from "../../logs/logs.controller";
import { NotificationsAdminController } from "../../notifications/notifications.controller";
import { OrdersController } from "../../orders/orders.controller";
import { ReportsController } from "../../reports/reports.controller";
import { RetentionController } from "../../retention/retention.controller";
import { RevenueController } from "../../revenue/revenue.controller";
import { SentimentController } from "../../sentiment/sentiment.controller";
import { TicketsAdminController } from "../../tickets/tickets.controller";
import { UsersController } from "../../users/users.controller";
import { VenuesController } from "../../venues/venues.controller";
import { WaitlistAdminController } from "../../waitlist/waitlist.controller";
import { StrategiesController } from "../../strategies/strategies.controller";
import { HealthController } from "../health.controller";

type ControllerConstructor = new (...args: never[]) => object;

const ADMIN_CONTROLLERS: [string, ControllerConstructor][] = [
  ["AdminsController", AdminsController],
  ["BacktestsController", BacktestsController],
  ["BuilderController", BuilderController],
  ["CacheAdminController", CacheAdminController],
  ["ConfigFlagsController", ConfigFlagsController],
  ["DashboardController", DashboardController],
  ["InvitesController", InvitesController],
  ["KeyRotationController", KeyRotationController],
  ["LogsController", LogsController],
  ["NotificationsAdminController", NotificationsAdminController],
  ["OrdersController", OrdersController],
  ["ReportsController", ReportsController],
  ["RetentionController", RetentionController],
  ["RevenueController", RevenueController],
  ["SentimentController", SentimentController],
  ["TicketsAdminController", TicketsAdminController],
  ["UsersController", UsersController],
  ["VenuesController", VenuesController],
  ["WaitlistAdminController", WaitlistAdminController],
  ["StrategiesController", StrategiesController],
];

function getClassGuards(
  ctrlClass: ControllerConstructor,
): ControllerConstructor[] | undefined {
  return Reflect.getMetadata(GUARDS_METADATA, ctrlClass) as
    | ControllerConstructor[]
    | undefined;
}

function getMethodGuards(
  ctrlClass: ControllerConstructor,
  methodName: string,
): ControllerConstructor[] | undefined {
  const handler = ctrlClass.prototype[methodName];
  if (!handler) {
    return undefined;
  }
  return Reflect.getMetadata(
    GUARDS_METADATA,
    handler,
  ) as ControllerConstructor[] | undefined;
}

describe("Admin Controller Guard Coverage (POLA-4446)", () => {
  describe("all admin controllers have AdminJwtGuard + RolesGuard at class level", () => {
    for (const [name, ctrlClass] of ADMIN_CONTROLLERS) {
      it(`${name} has class-level @UseGuards with AdminJwtGuard and RolesGuard`, () => {
        const guards = getClassGuards(ctrlClass);

        expect(guards).toBeDefined();
        expect(Array.isArray(guards)).toBe(true);
        expect(guards!.length).toBeGreaterThanOrEqual(2);

        const guardNames = guards!.map((g) => g.name);
        expect(guardNames).toContain("AdminJwtGuard");
        expect(guardNames).toContain("RolesGuard");
      });
    }
  });

  describe("StrategiesController POLA-4446 regression — resolved guard chain on forceStop/unpublish", () => {
    it("forceStop resolved guard chain includes AdminJwtGuard before RolesGuard", () => {
      const classGuards = getClassGuards(StrategiesController);
      const methodGuards = getMethodGuards(StrategiesController, "forceStop");

      expect(classGuards).toBeDefined();
      const classGuardNames = classGuards!.map((g) => g.name);
      expect(classGuardNames).toContain("AdminJwtGuard");
      expect(classGuardNames).toContain("RolesGuard");

      // No method-level @UseGuards(RolesGuard) bypass
      if (methodGuards) {
        const methodGuardNames = methodGuards.map((g) => g.name);
        expect(methodGuardNames).not.toContain("RolesGuard");
      }

      // NestJS 11 concatenates guards across levels — method-level guards are
      // additive, not overriding. The resolved chain is class.concat(method).
      const resolved = [...(classGuards ?? []), ...(methodGuards ?? [])];
      const resolvedNames = resolved.map((g) => g.name);

      expect(resolvedNames[0]).toBe("AdminJwtGuard");
      expect(resolvedNames.filter((n) => n === "RolesGuard").length).toBeGreaterThanOrEqual(1);
    });

    it("unpublish resolved guard chain includes AdminJwtGuard before RolesGuard", () => {
      const classGuards = getClassGuards(StrategiesController);
      const methodGuards = getMethodGuards(StrategiesController, "unpublish");

      expect(classGuards).toBeDefined();
      const classGuardNames = classGuards!.map((g) => g.name);
      expect(classGuardNames).toContain("AdminJwtGuard");
      expect(classGuardNames).toContain("RolesGuard");

      // No method-level @UseGuards(RolesGuard) bypass
      if (methodGuards) {
        const methodGuardNames = methodGuards.map((g) => g.name);
        expect(methodGuardNames).not.toContain("RolesGuard");
      }

      const resolved = [...(classGuards ?? []), ...(methodGuards ?? [])];
      const resolvedNames = resolved.map((g) => g.name);

      expect(resolvedNames[0]).toBe("AdminJwtGuard");
      expect(resolvedNames.filter((n) => n === "RolesGuard").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POLA-4446 regression — guard chain integrity", () => {
    it("AdminJwtGuard executes before RolesGuard on all admin controllers", () => {
      for (const [name, ctrlClass] of ADMIN_CONTROLLERS) {
        const guards = getClassGuards(ctrlClass);
        const guardNames = guards!.map((g) => g.name);

        const jwtIdx = guardNames.indexOf("AdminJwtGuard");
        const rolesIdx = guardNames.indexOf("RolesGuard");

        expect(
          jwtIdx,
          `${name}: AdminJwtGuard missing from class-level guards`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          rolesIdx,
          `${name}: RolesGuard missing from class-level guards`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          jwtIdx,
          `${name}: AdminJwtGuard must run before RolesGuard`,
        ).toBeLessThan(rolesIdx);
      }
    });

    it("no admin controller has RolesGuard without AdminJwtGuard", () => {
      for (const [name, ctrlClass] of ADMIN_CONTROLLERS) {
        const guards = getClassGuards(ctrlClass);
        const guardNames = guards!.map((g) => g.name);

        if (guardNames.includes("RolesGuard")) {
          expect(
            guardNames,
            `${name}: RolesGuard present but AdminJwtGuard missing (POLA-4446 regression)`,
          ).toContain("AdminJwtGuard");
        }
      }
    });
  });

  describe("health controller is intentionally unguarded", () => {
    it("HealthController has no @UseGuards at class level", () => {
      const guards = getClassGuards(HealthController);
      expect(guards).toBeUndefined();
    });
  });
});
