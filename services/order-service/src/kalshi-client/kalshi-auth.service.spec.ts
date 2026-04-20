import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { KalshiAuthService } from "./kalshi-auth.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(url = "http://signer:3012"): ConfigService {
  return {
    get: (k: string, d?: string) => {
      const map: Record<string, string> = { SIGNER_SERVICE_URL: url };
      return map[k] ?? d ?? "";
    },
  } as any;
}

function makeJwt(): JwtService {
  return { sign: vi.fn().mockReturnValue("mock-service-jwt") } as any;
}

const JWT_RESPONSE = {
  token: "header.payload.sig",
  expiresAt: Math.floor(Date.now() / 1000) + 1800,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("KalshiAuthService", () => {
  let svc: KalshiAuthService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new KalshiAuthService(makeJwt(), makeConfig());
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(JWT_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── Token acquisition ─────────────────────────────────────────────────────

  describe("getToken()", () => {
    it("calls POST /sign/kalshi-jwt on signer-service", async () => {
      await svc.getToken("user-1");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://signer:3012/sign/kalshi-jwt",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("returns the JWT token string", async () => {
      const token = await svc.getToken("user-1");
      expect(token).toBe("header.payload.sig");
    });

    it("attaches internal service JWT in Authorization header", async () => {
      await svc.getToken("user-1");
      const auth = fetchSpy.mock.calls[0][1].headers["Authorization"];
      expect(auth).toMatch(/^Bearer mock-service-jwt$/);
    });
  });

  // ── Caching ───────────────────────────────────────────────────────────────

  describe("token caching", () => {
    it("returns cached token on second call without re-fetching", async () => {
      await svc.getToken("user-1");
      await svc.getToken("user-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refreshes when token expires (expiresAt in the past)", async () => {
      const expiredResponse = {
        token: "expired.token.sig",
        expiresAt: Math.floor(Date.now() / 1000) - 10, // already expired
      };
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(expiredResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(JWT_RESPONSE),
        });

      await svc.getToken("user-1");
      const token = await svc.getToken("user-1");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe("header.payload.sig");
    });

    it("proactively refreshes when token has ≤5 min remaining", async () => {
      const almostExpiredResponse = {
        token: "almost.expired.sig",
        expiresAt: Math.floor(Date.now() / 1000) + 299, // 4m59s left — below 5min threshold
      };
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(almostExpiredResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(JWT_RESPONSE),
        });

      await svc.getToken("user-1");
      const token = await svc.getToken("user-1");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe("header.payload.sig");
    });

    it("does NOT re-fetch when token still has >5 min remaining", async () => {
      const freshResponse = {
        token: "fresh.token.sig",
        expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 min remaining
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(freshResponse),
      });

      await svc.getToken("user-1");
      await svc.getToken("user-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Concurrent refresh dedup ───────────────────────────────────────────────

  describe("concurrent refresh deduplication", () => {
    it("issues only one fetch when multiple calls arrive simultaneously", async () => {
      const [t1, t2, t3] = await Promise.all([
        svc.getToken("user-1"),
        svc.getToken("user-1"),
        svc.getToken("user-1"),
      ]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(t1).toBe(t2);
      expect(t2).toBe(t3);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws ServiceUnavailableException on signer-service error", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("unavailable"),
      });
      await expect(svc.getToken("user-1")).rejects.toThrow();
    });

    it("throws on network failure", async () => {
      fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(svc.getToken("user-1")).rejects.toThrow();
    });
  });
});
