import { describe, expect, it } from "vitest";
import { ApiKeyThrottlerGuard } from "./api-key-throttler.guard";

class TestApiKeyThrottlerGuard extends ApiKeyThrottlerGuard {
  tracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe("ApiKeyThrottlerGuard", () => {
  function makeGuard() {
    return new TestApiKeyThrottlerGuard({} as any, {} as any, {} as any);
  }

  it("tracks API-key requests by owning user id instead of key id", async () => {
    const guard = makeGuard();

    await expect(
      guard.tracker({
        user: { sub: "user-1" },
        apiKeyMeta: { keyId: "key-1" },
      }),
    ).resolves.toBe("user:user-1");
  });

  it("falls back to key id only when user id is absent", async () => {
    const guard = makeGuard();

    await expect(
      guard.tracker({
        apiKeyMeta: { keyId: "key-1" },
      }),
    ).resolves.toBe("apikey:key-1");
  });
});
