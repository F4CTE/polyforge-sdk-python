import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAdapterConfigs = vi.hoisted(() => [] as unknown[]);

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class MockPrismaPg {
    constructor(config: unknown) {
      mockAdapterConfigs.push(config);
    }
  },
}));

import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockAdapterConfigs.length = 0;
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://user-db",
      NODE_ENV: "production",
      PRISMA_POOL_SIZE: "7",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("configures the user database pool for cold starts and stale idle sockets", () => {
    new PrismaService();

    expect(mockAdapterConfigs).toEqual([
      {
        connectionString: "postgresql://user-db",
        max: 7,
        idleTimeoutMillis: 0,
        connectionTimeoutMillis: 30_000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
      },
    ]);
  });
});
