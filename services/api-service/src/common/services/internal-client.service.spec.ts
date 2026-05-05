import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InternalClientService } from "./internal-client.service";

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    getOrThrow: vi.fn().mockReturnValue("test-secret"),
    get: vi.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

function makeJwt(): JwtService {
  return { sign: vi.fn().mockReturnValue("internal-jwt") } as any;
}

function mockResponse(ok: boolean, status: number): Response {
  return { ok, status } as Response;
}

describe("InternalClientService", () => {
  let service: InternalClientService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new InternalClientService(
      makeConfig({
        INTERNAL_CLIENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD: "2",
        INTERNAL_CLIENT_CIRCUIT_BREAKER_RESET_MS: "30000",
      }),
      makeJwt(),
    );
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs with an internal bearer token", async () => {
    fetchSpy.mockResolvedValue(mockResponse(true, 204));

    await service.post(
      "http://strategy-engine:3006",
      "strategy-engine",
      "/internal/strategies/strat-1/start",
    );

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://strategy-engine:3006/internal/strategies/strat-1/start",
    );
    expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer internal-jwt",
    );
  });

  it("opens on repeated downstream HTTP failures and fails fast without fetch", async () => {
    fetchSpy.mockResolvedValue(mockResponse(false, 503));

    await expect(
      service.post("http://strategy-engine:3006", "strategy-engine", "/one"),
    ).resolves.toMatchObject({ status: 503 });
    await expect(
      service.post("http://strategy-engine:3006", "strategy-engine", "/two"),
    ).resolves.toMatchObject({ status: 503 });
    fetchSpy.mockClear();

    await expect(
      service.post("http://strategy-engine:3006", "strategy-engine", "/three"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps circuit state isolated by downstream audience and base URL", async () => {
    service = new InternalClientService(
      makeConfig({
        INTERNAL_CLIENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD: "1",
        INTERNAL_CLIENT_CIRCUIT_BREAKER_RESET_MS: "30000",
      }),
      makeJwt(),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(false, 503));

    await expect(
      service.delete("http://strategy-engine:3006", "strategy-engine", "/one"),
    ).resolves.toMatchObject({ status: 503 });
    fetchSpy.mockResolvedValue(mockResponse(true, 204));
    fetchSpy.mockClear();

    await expect(
      service.delete(
        "http://strategy-engine-alt:3006",
        "strategy-engine",
        "/one",
      ),
    ).resolves.toMatchObject({ status: 204 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    await expect(
      service.delete("http://strategy-engine:3006", "strategy-engine", "/two"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a half-open probe after reset and closes on success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));
    service = new InternalClientService(
      makeConfig({
        INTERNAL_CLIENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD: "1",
        INTERNAL_CLIENT_CIRCUIT_BREAKER_RESET_MS: "1000",
      }),
      makeJwt(),
    );
    fetchSpy.mockResolvedValueOnce(mockResponse(false, 503));

    await expect(
      service.get("http://strategy-engine:3006", "strategy-engine", "/one"),
    ).resolves.toMatchObject({ status: 503 });
    fetchSpy.mockClear();

    vi.setSystemTime(new Date("2026-05-05T00:00:01.001Z"));
    fetchSpy.mockResolvedValue(mockResponse(true, 204));

    await expect(
      service.get("http://strategy-engine:3006", "strategy-engine", "/probe"),
    ).resolves.toMatchObject({ status: 204 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    await expect(
      service.get("http://strategy-engine:3006", "strategy-engine", "/closed"),
    ).resolves.toMatchObject({ status: 204 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
