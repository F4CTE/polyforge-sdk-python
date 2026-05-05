import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SignerClientService } from "./signer-client.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(url = "http://signer:3012"): ConfigService {
  return {
    get: (key: string, def?: string) => {
      const map: Record<string, string> = {
        SIGNER_SERVICE_URL: url,
        INTERNAL_JWT_SECRET: "test-secret",
      };
      return map[key] ?? def ?? "";
    },
  } as any;
}

function makeJwt(): JwtService {
  return { sign: vi.fn().mockReturnValue("mock-service-jwt") } as any;
}

const SIGN_REQ = {
  userId: "user-1",
  requestId: "req-abc",
  tokenId: "token-xyz",
  side: "BUY" as const,
  size: 10,
  price: 0.6,
  orderType: "GTC" as const,
};

const SIGN_RESPONSE = {
  order: { tokenId: "token-xyz", signature: "0x1234" },
  builderHeaders: {
    POLY_BUILDER_API_KEY: "k",
    POLY_BUILDER_TIMESTAMP: "1",
    POLY_BUILDER_PASSPHRASE: "p",
    POLY_BUILDER_SIGNATURE: "s",
  },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("SignerClientService", () => {
  let svc: SignerClientService;
  let jwt: JwtService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jwt = makeJwt();
    svc = new SignerClientService(jwt, makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── successful request ────────────────────────────────────────────────────

  describe("signOrder() — success", () => {
    beforeEach(() => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(SIGN_RESPONSE),
      });
    });

    it("POSTs to /sign/order on the configured signer URL", async () => {
      await svc.signOrder(SIGN_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://signer:3012/sign/order");
    });

    it("uses POST method", async () => {
      await svc.signOrder(SIGN_REQ);
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("attaches Authorization: Bearer <jwt> header", async () => {
      await svc.signOrder(SIGN_REQ);
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer mock-service-jwt",
      );
    });

    it("sets Content-Type: application/json", async () => {
      await svc.signOrder(SIGN_REQ);
      expect(fetchSpy.mock.calls[0][1].headers["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("serialises the request body as JSON", async () => {
      await svc.signOrder(SIGN_REQ);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.userId).toBe("user-1");
      expect(body.tokenId).toBe("token-xyz");
    });

    it("returns the parsed JSON response", async () => {
      const logSpy = vi
        .spyOn((svc as any).logger, "log")
        .mockImplementation(() => undefined);
      const result = await svc.signOrder(SIGN_REQ);
      expect(result.order.signature).toBe("0x1234");
      expect(result.builderHeaders.POLY_BUILDER_API_KEY).toBe("k");
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _aws: expect.any(Object),
          Service: "order-service",
          SignerLatencyMs: expect.any(Number),
          Operation: "signOrder",
        }),
        "cloudwatch metric",
      );
    });

    it("requests a fresh service JWT on every call", async () => {
      await svc.signOrder(SIGN_REQ);
      await svc.signOrder(SIGN_REQ);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it("JWT has correct issuer, audience, and short expiry", async () => {
      await svc.signOrder(SIGN_REQ);
      const [, options] = (jwt.sign as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.issuer).toBe("order-service");
      expect(options.audience).toBe("signer-service");
      expect(options.expiresIn).toBe(30);
    });
  });

  // ── error handling ────────────────────────────────────────────────────────

  describe("signOrder() — errors", () => {
    it("throws ServiceUnavailableException when fetch rejects (ECONNREFUSED)", async () => {
      const errorSpy = vi
        .spyOn((svc as any).logger, "error")
        .mockImplementation(() => undefined);
      fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(svc.signOrder(SIGN_REQ)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "SIGNER_REQUEST_FAILED",
          operation: "signOrder",
        }),
        expect.any(Error),
      );
    });

    it("throws ServiceUnavailableException on AbortSignal timeout", async () => {
      fetchSpy.mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError"),
      );
      await expect(svc.signOrder(SIGN_REQ)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("throws ServiceUnavailableException on HTTP 500", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });
      await expect(svc.signOrder(SIGN_REQ)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("throws ServiceUnavailableException on HTTP 401 (expired internal JWT)", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });
      await expect(svc.signOrder(SIGN_REQ)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("error message contains the signer response status code", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue(""),
      });
      await expect(svc.signOrder(SIGN_REQ)).rejects.toThrow("503");
    });

    it("uses empty string when res.text() rejects (graceful degradation)", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error("read err")),
      });
      await expect(svc.signOrder(SIGN_REQ)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  // ── URL config ────────────────────────────────────────────────────────────

  describe("URL configuration", () => {
    it("uses the configured SIGNER_SERVICE_URL", async () => {
      const customSvc = new SignerClientService(
        makeJwt(),
        makeConfig("http://custom-signer:9999"),
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(SIGN_RESPONSE),
      });

      await customSvc.signOrder(SIGN_REQ);

      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://custom-signer:9999/sign/order",
      );
    });

    it("falls back to default signer URL when config returns undefined", async () => {
      const config = { get: () => undefined } as any as ConfigService;
      const fallbackSvc = new SignerClientService(makeJwt(), config);
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(SIGN_RESPONSE),
      });

      await fallbackSvc.signOrder(SIGN_REQ);

      expect(fetchSpy.mock.calls[0][0]).toContain("signer-service");
    });
  });
});
