import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { SessionOnlyGuard } from "./session-only.guard";

function makeContext(request: { apiKeyMeta?: unknown }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe("SessionOnlyGuard", () => {
  it("allows JWT session requests without API key metadata", () => {
    const guard = new SessionOnlyGuard();

    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it("rejects API-key-authenticated requests", () => {
    const guard = new SessionOnlyGuard();

    expect(() =>
      guard.canActivate(makeContext({ apiKeyMeta: { keyId: "key-1" } })),
    ).toThrow(ForbiddenException);
  });
});
