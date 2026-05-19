import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyScopeGuard } from "@polyforge/shared-auth";
import { ConditionalController } from "../orders/conditional.controller";
import { MarketplaceController } from "../marketplace/marketplace.controller";
import { WhalesController } from "../whales/whales.controller";
import { TicketsController } from "../tickets/tickets.controller";
import { StrategiesController } from "../strategies/strategies.controller";

type ControllerClass = { name: string; prototype: any };

const scopedMutationRoutes: Array<{
  controller: ControllerClass;
  method: string;
}> = [
  { controller: ConditionalController, method: "create" },
  { controller: ConditionalController, method: "cancel" },
  { controller: MarketplaceController, method: "createListing" },
  { controller: MarketplaceController, method: "updateListing" },
  { controller: MarketplaceController, method: "purchase" },
  { controller: MarketplaceController, method: "rate" },
  { controller: WhalesController, method: "upsertAlertFilter" },
  { controller: WhalesController, method: "deleteAlertFilter" },
  { controller: WhalesController, method: "follow" },
  { controller: WhalesController, method: "unfollow" },
  { controller: TicketsController, method: "create" },
  { controller: TicketsController, method: "addMessage" },
  { controller: StrategiesController, method: "importStrategy" },
  { controller: StrategiesController, method: "fork" },
  { controller: StrategiesController, method: "like" },
  { controller: StrategiesController, method: "addComment" },
  { controller: StrategiesController, method: "deleteComment" },
  { controller: StrategiesController, method: "report" },
];

function makeExecutionContext(
  controller: ControllerClass,
  method: string,
  scopes: string[],
) {
  return {
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ apiKeyMeta: { scopes } }),
    }),
  } as any;
}

describe("API-key scope guard behavior for mutable routes", () => {
  it.each(scopedMutationRoutes)(
    "$controller.name.$method rejects READ-only API keys",
    ({ controller, method }) => {
      const guard = new ApiKeyScopeGuard(new Reflector());

      expect(() =>
        guard.canActivate(makeExecutionContext(controller, method, ["READ"])),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(scopedMutationRoutes)(
    "$controller.name.$method rejects unscoped API keys",
    ({ controller, method }) => {
      const guard = new ApiKeyScopeGuard(new Reflector());

      expect(() =>
        guard.canActivate(makeExecutionContext(controller, method, [])),
      ).toThrow(ForbiddenException);
    },
  );
});
