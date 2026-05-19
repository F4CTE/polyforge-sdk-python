import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ClobReadService } from "./clob-read.service";

function makeService() {
  const config = {
    getOrThrow: vi.fn().mockReturnValue("https://clob.example"),
  } as unknown as ConfigService;

  return new ClobReadService(config);
}

function mockFetchResponse(
  ok: boolean,
  json: unknown,
  status = ok ? 200 : 500,
) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(json),
  } as unknown as Response;
}

describe("ClobReadService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("looks up tick size with an encoded token id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(mockFetchResponse(true, "0.001"));
    const service = makeService();

    await expect(service.getTickSize("token/yes")).resolves.toBe("0.001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://clob.example/tick-size/token%2Fyes",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("falls back to 0.01 when tick-size lookup returns a non-ok response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      mockFetchResponse(false, { error: "nope" }, 503),
    );
    const service = makeService();

    await expect(service.getTickSize("token-1")).resolves.toBe("0.01");
  });

  it("looks up fee rate with an encoded token id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(mockFetchResponse(true, 125));
    const service = makeService();

    await expect(service.getFeeRate("token fee")).resolves.toBe("125");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://clob.example/fee-rate/token%20fee",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("falls back to 0 when fee-rate lookup returns a non-ok response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(mockFetchResponse(false, null, 502));
    const service = makeService();

    await expect(service.getFeeRate("token-1")).resolves.toBe("0");
  });

  it("propagates network errors so callers can fail closed", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error("network down"));
    const service = makeService();

    await expect(service.getTickSize("token-1")).rejects.toThrow(
      "network down",
    );
  });

  it("returns positions for an ok response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      mockFetchResponse(true, [
        { asset: "token-1", size: "10", avgPrice: "0.50", realizedPnl: "0" },
      ]),
    );
    const service = makeService();

    const result = await service.getPositions("0xAddr");

    expect(result).toEqual([
      { asset: "token-1", size: "10", avgPrice: "0.50", realizedPnl: "0" },
    ]);
  });

  it("throws on non-ok positions response so reconciler does not process stale data", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(mockFetchResponse(false, null, 503));
    const service = makeService();

    await expect(service.getPositions("0xAddr")).rejects.toThrow("503");
  });

  it("propagates network errors from positions lookup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const service = makeService();

    await expect(service.getPositions("0xAddr")).rejects.toThrow(
      "ECONNREFUSED",
    );
  });
});
