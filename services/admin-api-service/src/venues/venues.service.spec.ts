import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VenuesService } from "./venues.service";

function createMockRedis() {
  return {
    getClient: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
    }),
  };
}

function createMockConfig(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => overrides[key]),
  };
}

describe("VenuesService", () => {
  let service: VenuesService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockConfig: ReturnType<typeof createMockConfig>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockConfig = createMockConfig({ KALSHI_ENABLED: "true" });
    service = new VenuesService(mockRedis as any, mockConfig as any);

    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns health for both venues when kalshi is enabled", async () => {
    const redisGet = vi.fn().mockResolvedValue(null);
    mockRedis.getClient.mockReturnValue({ get: redisGet });
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await service.getHealth();

    expect(result).toHaveLength(2);
    expect(result[0].venueId).toBe("polymarket");
    expect(result[1].venueId).toBe("kalshi");
  });

  it("marks venue as not connected when service is down", async () => {
    const redisGet = vi.fn().mockResolvedValue(null);
    mockRedis.getClient.mockReturnValue({ get: redisGet });
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await service.getHealth();

    expect(result[0].wsConnected).toBe(false);
    expect(result[0].latencyMs).toBeNull();
  });

  it("marks venue as connected when health check passes", async () => {
    const healthData = JSON.stringify({
      status: "healthy",
      latencyMs: 10,
      checkedAt: new Date().toISOString(),
    });
    const redisGet = vi
      .fn()
      .mockResolvedValueOnce(healthData) // health:market-data-service
      .mockResolvedValueOnce("2026-04-24T10:00:00Z") // venue:lastEvent:polymarket
      .mockResolvedValueOnce(healthData) // health:market-data-service (kalshi)
      .mockResolvedValueOnce(null); // venue:lastEvent:kalshi
    mockRedis.getClient.mockReturnValue({ get: redisGet });
    fetchSpy.mockResolvedValue({ ok: true });

    const result = await service.getHealth();

    expect(result[0].wsConnected).toBe(true);
    expect(result[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(result[0].lastEventAt).toBe("2026-04-24T10:00:00Z");
  });

  it("shows kalshi as disabled when KALSHI_ENABLED is not true", async () => {
    mockConfig = createMockConfig({});
    service = new VenuesService(mockRedis as any, mockConfig as any);

    const redisGet = vi.fn().mockResolvedValue(null);
    mockRedis.getClient.mockReturnValue({ get: redisGet });
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await service.getHealth();

    expect(result[1].venueId).toBe("kalshi");
    expect(result[1].wsConnected).toBe(false);
    expect(result[1].latencyMs).toBeNull();
  });

  it("includes venue display names", async () => {
    const redisGet = vi.fn().mockResolvedValue(null);
    mockRedis.getClient.mockReturnValue({ get: redisGet });
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await service.getHealth();

    expect(result[0].displayName).toBe("Polymarket");
    expect(result[1].displayName).toBe("Kalshi");
  });
});
