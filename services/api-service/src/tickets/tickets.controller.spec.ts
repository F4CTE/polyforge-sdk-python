import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ApiKeyScopeGuard, REQUIRED_SCOPES } from "@polyforge/shared-auth";
import { TicketsController } from "./tickets.controller";

function expectWriteScoped(method: object) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

  expect(guards).toContain(ApiKeyScopeGuard);
  expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toEqual(["WRITE"]);
}

describe("TicketsController — API-key scope coverage", () => {
  it("requires WRITE scope for ticket creation", () => {
    expectWriteScoped(TicketsController.prototype.create);
  });

  it("requires WRITE scope for message creation", () => {
    expectWriteScoped(TicketsController.prototype.addMessage);
  });
});
