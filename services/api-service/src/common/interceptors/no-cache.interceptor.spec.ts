import { describe, it, expect, vi } from "vitest";
import { of } from "rxjs";
import { NoCacheInterceptor } from "./no-cache.interceptor";
import type { ExecutionContext, CallHandler } from "@nestjs/common";

function makeContext(reply: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => Object,
    getHandler: () => Object,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => "http",
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = { ok: true }): CallHandler {
  return { handle: () => of(value) };
}

describe("NoCacheInterceptor", () => {
  const interceptor = new NoCacheInterceptor();

  it("sets Cache-Control, Pragma, and Expires headers", async () => {
    const headers: Record<string, string> = {};
    const reply = {
      header: vi.fn((name: string, value: string) => {
        headers[name] = value;
      }),
    };

    const result$ = interceptor.intercept(makeContext(reply), makeHandler());
    await new Promise<void>((resolve) =>
      result$.subscribe({ complete: resolve }),
    );

    expect(reply.header).toHaveBeenCalledTimes(3);
    expect(headers["Cache-Control"]).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
    expect(headers["Pragma"]).toBe("no-cache");
    expect(headers["Expires"]).toBe("0");
  });

  it("passes through the response from next.handle()", async () => {
    const reply = { header: vi.fn() };
    const payload = { data: [1, 2, 3] };

    const result$ = interceptor.intercept(
      makeContext(reply),
      makeHandler(payload),
    );
    const result = await new Promise((resolve) => result$.subscribe(resolve));

    expect(result).toEqual(payload);
  });

  it("does not throw when reply has no header method (WebSocket context)", async () => {
    const result$ = interceptor.intercept(makeContext({}), makeHandler());
    const result = await new Promise((resolve) => result$.subscribe(resolve));

    expect(result).toEqual({ ok: true });
  });
});
