import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../../..");

const REDIS_THROTTLED_SERVICES = [
  "order-service",
  "signer-service",
  "strategy-engine",
  "market-data-service",
  "paper-order-service",
  "bot-service",
  "backtest-service",
  "notification-service",
] as const;

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("service rate-limit storage", () => {
  it.each(REDIS_THROTTLED_SERVICES)(
    "%s uses Redis-backed throttler storage",
    (service) => {
      const source = read(`services/${service}/src/app.module.ts`);
      const packageJson = JSON.parse(
        read(`services/${service}/package.json`),
      ) as { dependencies?: Record<string, string> };

      expect(source).toContain("ThrottlerModule.forRootAsync");
      expect(source).toContain("ThrottlerStorageRedisService");
      expect(source).toContain("storage: new ThrottlerStorageRedisService");
      expect(source).not.toContain("ThrottlerModule.forRoot([");
      expect(
        packageJson.dependencies?.["@nest-lab/throttler-storage-redis"],
      ).toBeDefined();
    },
  );
});
