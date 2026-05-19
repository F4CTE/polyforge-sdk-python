import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { CopyController } from "./copy.controller";

const REQUIRED_SCOPES = "requiredScopes";

function expectGeoBlocked(method: object) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];
  expect(guards).toContain(GeoBlockGuard);
}

function expectTradeScoped(method: object) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];
  expect(guards.map((guard) => (guard as { name?: string }).name)).toContain(
    "ApiKeyScopeGuard",
  );
  expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toEqual(["TRADE"]);
}

describe("CopyController", () => {
  it("blocks new copy configurations by geo", () => {
    expectGeoBlocked(CopyController.prototype.create);
  });

  it("requires TRADE scope for new copy configurations", () => {
    expectTradeScoped(CopyController.prototype.create);
  });

  it("blocks copy resume by geo", () => {
    expectGeoBlocked(CopyController.prototype.resume);
  });

  it("requires TRADE scope for copy resume", () => {
    expectTradeScoped(CopyController.prototype.resume);
  });

  it("requires TRADE scope for copy updates", () => {
    expectTradeScoped(CopyController.prototype.update);
  });

  it("requires TRADE scope for copy pause", () => {
    expectTradeScoped(CopyController.prototype.pause);
  });

  it("requires TRADE scope for copy stop", () => {
    expectTradeScoped(CopyController.prototype.stop);
  });
});
