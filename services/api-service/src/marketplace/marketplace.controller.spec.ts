import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ApiKeyScopeGuard, REQUIRED_SCOPES } from "@polyforge/shared-auth";
import { MarketplaceController } from "./marketplace.controller";

function expectRequiredScope(method: object, scope: string) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

  expect(guards).toContain(ApiKeyScopeGuard);
  expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toEqual([scope]);
}

describe("MarketplaceController — API-key scope coverage", () => {
  it("requires WRITE scope for listing mutations", () => {
    expectRequiredScope(MarketplaceController.prototype.createListing, "WRITE");
    expectRequiredScope(MarketplaceController.prototype.updateListing, "WRITE");
  });

  it("requires TRADE scope for purchases", () => {
    expectRequiredScope(MarketplaceController.prototype.purchase, "TRADE");
  });

  it("requires WRITE scope for ratings", () => {
    expectRequiredScope(MarketplaceController.prototype.rate, "WRITE");
  });
});
