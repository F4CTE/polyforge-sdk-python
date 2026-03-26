import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BatchService } from "./batch.service";
import { BatchItemDto } from "./dto/batch-request.dto";

describe("BatchService", () => {
  let service: BatchService;
  const PORT = 3002;
  const AUTH_TOKEN = "test-jwt-token";

  beforeEach(() => {
    service = new BatchService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeItem(overrides: Partial<BatchItemDto> = {}): BatchItemDto {
    return {
      id: "req-1",
      method: "GET",
      path: "/api/v1/markets",
      ...overrides,
    } as BatchItemDto;
  }

  it("should execute items in parallel and return correlated results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const items = [
      makeItem({ id: "a", path: "/api/v1/markets" }),
      makeItem({ id: "b", path: "/api/v1/portfolio" }),
    ];

    const results = await service.executeBatch(items, AUTH_TOKEN, PORT);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("a");
    expect(results[0].status).toBe(200);
    expect(results[1].id).toBe("b");
    expect(results[1].status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should enforce max 10 items at the DTO level (service processes whatever it receives)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `req-${i}`, path: `/api/v1/markets` }),
    );

    const results = await service.executeBatch(items, AUTH_TOKEN, PORT);
    expect(results).toHaveLength(10);
  });

  it("should forward auth token in Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    await service.executeBatch([makeItem()], AUTH_TOKEN, PORT);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe(`Bearer ${AUTH_TOKEN}`);
  });

  it("should send body for POST/PATCH/DELETE requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      json: () => Promise.resolve({ id: "new-1" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const items = [
      makeItem({
        id: "create",
        method: "POST",
        path: "/api/v1/strategies",
        body: { name: "Test" },
      }),
    ];

    await service.executeBatch(items, AUTH_TOKEN, PORT);

    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ name: "Test" }));
  });

  it("should not send body for GET requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    await service.executeBatch(
      [makeItem({ body: { ignored: true } })],
      AUTH_TOKEN,
      PORT,
    );

    expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
  });

  it("should handle fetch failures gracefully with 502", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    const results = await service.executeBatch(
      [makeItem({ id: "fail" })],
      AUTH_TOKEN,
      PORT,
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("fail");
    expect(results[0].status).toBe(502);
    expect(results[0].body.error).toBe("Upstream request failed");
  });

  it("should handle non-JSON responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 204,
      json: () => Promise.reject(new Error("No body")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await service.executeBatch(
      [makeItem({ id: "no-body" })],
      AUTH_TOKEN,
      PORT,
    );

    expect(results[0].status).toBe(204);
    expect(results[0].body).toBeNull();
  });

  it("should handle mixed success and failure responses", async () => {
    let callIdx = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        });
      }
      return Promise.reject(new Error("timeout"));
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await service.executeBatch(
      [
        makeItem({ id: "ok" }),
        makeItem({ id: "fail", path: "/api/v1/markets/slow" }),
      ],
      AUTH_TOKEN,
      PORT,
    );

    expect(results[0].id).toBe("ok");
    expect(results[0].status).toBe(200);
    expect(results[1].id).toBe("fail");
    expect(results[1].status).toBe(502);
  });
});
