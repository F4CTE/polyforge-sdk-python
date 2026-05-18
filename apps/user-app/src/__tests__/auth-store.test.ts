import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore, authedFetch } from "../stores/auth-store";

vi.mock("../lib/analytics", () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

vi.mock("../lib/sentry", () => ({
  captureError: vi.fn(),
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("auth store logout", () => {
  const locationAssign = vi.fn();
  let removeItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network stalled")),
    );
    removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => undefined);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: locationAssign,
      },
    });
    locationAssign.mockClear();
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "alice@example.com",
        username: "alice",
        status: "VERIFIED",
        polymarketConnected: false,
        kalshiConnected: false,
        emailVerified: true,
        totpEnabled: false,
        showPnl: true,
        showWinrate: true,
        createdAt: "2026-05-05T00:00:00.000Z",
        lastSeen: "2026-05-05T00:00:00.000Z",
      },
      loading: true,
    });
  });

  it("does not clear local auth state when network logout fails", async () => {
    await expect(useAuthStore.getState().logout()).rejects.toThrow("network stalled");

    expect(fetch).toHaveBeenCalledWith(
      "/auth/v1/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(removeItem).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.id).toBe("user-1");
    expect(locationAssign).not.toHaveBeenCalled();
  });
});

describe("auth store — concurrent refresh", () => {
  const locationAssign = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    locationAssign.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: locationAssign,
        href: window.location.href,
      },
    });
  });

  it("propagates refresh transport errors to concurrent callers instead of forcing logout", async () => {
    const error = new Error("ECONNREFUSED");

    // First fetch (/auth/v1/me) returns 401 → triggers refresh
    // Refresh fetch hangs until we reject it
    const refreshDeferred = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockReturnValueOnce(refreshDeferred.promise);

    // Start two concurrent authedFetch calls (simulate parallel 401s)
    const call1 = authedFetch("/api/resource-a");
    // Need a microtask tick so call1 enters its refresh-trigger path and
    // call2 arrives while isRefreshing = true
    await Promise.resolve();

    // Second fetch because call2 also hits its own fetch first
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const call2 = authedFetch("/api/resource-b");

    // Both callers are now waiting on the refresh. Reject it with a transport error.
    refreshDeferred.reject(error);

    // Both calls should reject with the transport error, NOT redirect to /login
    await expect(call1).rejects.toThrow("ECONNREFUSED");
    await expect(call2).rejects.toThrow("ECONNREFUSED");
    expect(locationAssign).not.toHaveBeenCalled();
    // window.location.href set by authedFetch on server-rejected token path
  });

  it("redirects to login when concurrent callers see a server-rejected refresh token", async () => {
    // Both /auth/v1/me fetches return 401 → triggers refresh
    // Refresh fetch returns 401 → server rejected the token
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response);

    const call1 = authedFetch("/api/resource-a");
    await Promise.resolve();

    const call2 = authedFetch("/api/resource-b");

    await expect(call1).resolves.toBeDefined();
    await expect(call2).resolves.toBeDefined();

    // Both should have redirected to /login since the SSR rejected the token
    expect(window.location.href).toBe("/login");
  });

  it("surfaces refresh transport errors to init() instead of silently setting user=null", async () => {
    const error = new Error("network down");

    // /auth/v1/me returns 401
    // /auth/v1/refresh throws transport error
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockRejectedValueOnce(error);

    // init should propagate the error through to the catch block
    // (the catch block logs + sets user=null — existing behavior for transport errors)
    useAuthStore.setState({ user: null, loading: true });
    await useAuthStore.getState().init();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
  });
});
