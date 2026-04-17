import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { SigningService } from "./signing.service";
import { CredentialsService } from "../credentials/credentials.service";
import { NotFoundException } from "@nestjs/common";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUILDER_SECRET = "0123456789abcdef".repeat(4); // 64 hex chars for valid HMAC key

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    CHAIN_ID: "137",
    POLY_BUILDER_API_KEY: "test-builder-key",
    POLY_BUILDER_SECRET: BUILDER_SECRET,
    POLY_BUILDER_PASSPHRASE: "test-builder-pass",
    NODE_ENV: "development", // forces dev stub path
    CLOB_API_URL: "http://mock-polymarket:3099",
    ...overrides,
  };
  return {
    get: (k: string, d?: string) => map[k] ?? d,
    getOrThrow: (k: string) => {
      if (!map[k]) throw new Error(`Missing ${k}`);
      return map[k];
    },
  } as any;
}

function makeMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  };
}

const DECRYPTED_CREDS = {
  privateKey: Buffer.from("0x" + "f".repeat(64), "utf8"),
  apiKey: Buffer.from("ak", "utf8"),
  apiSecret: Buffer.from("as", "utf8"),
  apiPassphrase: Buffer.from("ap", "utf8"),
  safeAddress: null,
  sigType: 0,
};

const BASE_REQ = {
  userId: "user-1",
  requestId: "req-abc",
  tokenId: "token-xyz",
  side: "BUY" as "BUY" | "SELL",
  size: 10,
  price: 0.6,
  orderType: "GTC" as "GTC" | "FOK" | "GTD",
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("SigningService", () => {
  let svc: SigningService;
  let credentials: CredentialsService;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    credentials = {
      getDecryptedCredentials: vi.fn().mockResolvedValue(DECRYPTED_CREDS),
    } as any;
    redis = makeMockRedis();
    svc = new SigningService(
      credentials,
      makeConfig(),
      redis as any,
    );
  });

  // ── Dev stub signing ──────────────────────────────────────────────────────

  describe("signOrder() — dev stub (NODE_ENV=development)", () => {
    it("resolves without throwing", async () => {
      await expect(svc.signOrder(BASE_REQ)).resolves.toBeDefined();
    });

    it("returns an object with order and builderHeaders", async () => {
      const result = await svc.signOrder(BASE_REQ);
      expect(result).toHaveProperty("order");
      expect(result).toHaveProperty("builderHeaders");
    });

    it("calls getDecryptedCredentials with the correct userId", async () => {
      await svc.signOrder(BASE_REQ);
      expect(credentials.getDecryptedCredentials).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("propagates error when credentials are not found", async () => {
      vi.mocked(credentials.getDecryptedCredentials).mockRejectedValue(
        new NotFoundException("No credentials"),
      );
      await expect(svc.signOrder(BASE_REQ)).rejects.toThrow(NotFoundException);
    });

    // ── order fields ──

    it("sets tokenId on the signed order", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.tokenId).toBe("token-xyz");
    });

    it("maps BUY side to 0", async () => {
      const { order } = await svc.signOrder({ ...BASE_REQ, side: "BUY" });
      expect(order.side).toBe(0);
    });

    it("maps SELL side to 1", async () => {
      const { order } = await svc.signOrder({ ...BASE_REQ, side: "SELL" });
      expect(order.side).toBe(1);
    });

    it("sets signatureType from creds.sigType", async () => {
      vi.mocked(credentials.getDecryptedCredentials).mockResolvedValue({
        ...DECRYPTED_CREDS,
        sigType: 1,
      });
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.signatureType).toBe(1);
    });

    it("sets expiration to 0 when not provided", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.expiration).toBe("0");
    });

    it("sets expiration to the provided value", async () => {
      const { order } = await svc.signOrder({
        ...BASE_REQ,
        expiration: 1_700_000_000,
      });
      expect(order.expiration).toBe("1700000000");
    });

    it("sets makerAmount = round(size * 1_000_000)", async () => {
      const { order } = await svc.signOrder({
        ...BASE_REQ,
        size: 10,
        price: 0.6,
      });
      expect(Number(order.makerAmount)).toBe(10_000_000);
    });

    it("sets takerAmount = round(size * price * 1_000_000)", async () => {
      const { order } = await svc.signOrder({
        ...BASE_REQ,
        size: 10,
        price: 0.6,
      });
      expect(Number(order.takerAmount)).toBe(6_000_000);
    });

    it("sets signature as a 0x-prefixed hex string (65 bytes = 130 hex chars)", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(typeof order.signature).toBe("string");
      expect(order.signature as string).toMatch(/^0x[0-9a-f]{130}$/);
    });

    it("includes a random salt on every call", async () => {
      const { order: o1 } = await svc.signOrder(BASE_REQ);
      const { order: o2 } = await svc.signOrder(BASE_REQ);
      expect(o1.salt).not.toBe(o2.salt);
    });

    it('sets nonce to "0"', async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.nonce).toBe("0");
    });

    it("sets maker and signer to the dev stub address", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.maker).toBe("0x0000000000000000000000000000000000000001");
      expect(order.signer).toBe("0x0000000000000000000000000000000000000001");
    });

    // ── builderHeaders ──

    it("builderHeaders.POLY_BUILDER_API_KEY matches config", async () => {
      const { builderHeaders } = await svc.signOrder(BASE_REQ);
      expect(builderHeaders.POLY_BUILDER_API_KEY).toBe("test-builder-key");
    });

    it("builderHeaders.POLY_BUILDER_PASSPHRASE matches config", async () => {
      const { builderHeaders } = await svc.signOrder(BASE_REQ);
      expect(builderHeaders.POLY_BUILDER_PASSPHRASE).toBe("test-builder-pass");
    });

    it("builderHeaders.POLY_BUILDER_TIMESTAMP is a numeric string", async () => {
      const { builderHeaders } = await svc.signOrder(BASE_REQ);
      expect(builderHeaders.POLY_BUILDER_TIMESTAMP).toMatch(/^\d+$/);
    });

    it("builderHeaders.POLY_BUILDER_SIGNATURE is a 64-char hex string (HMAC-SHA256)", async () => {
      const { builderHeaders } = await svc.signOrder(BASE_REQ);
      expect(builderHeaders.POLY_BUILDER_SIGNATURE).toMatch(/^[0-9a-f]{64}$/);
    });

    it("HMAC signature differs per call (different timestamp)", async () => {
      const { builderHeaders: h1 } = await svc.signOrder({
        ...BASE_REQ,
        requestId: "r1",
      });
      const { builderHeaders: h2 } = await svc.signOrder({
        ...BASE_REQ,
        requestId: "r2",
      });
      const differ =
        h1.POLY_BUILDER_TIMESTAMP !== h2.POLY_BUILDER_TIMESTAMP ||
        h1.POLY_BUILDER_SIGNATURE !== h2.POLY_BUILDER_SIGNATURE;
      expect(differ).toBe(true);
    });
  });

  // ── Stub mode environment restriction ─────────────────────────────────────

  describe("constructor — stub mode only allowed in development", () => {
    it("throws when SIGNING_MODE=stub and NODE_ENV=staging", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "staging", SIGNING_MODE: "stub" }),
            redis as any,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("throws when SIGNING_MODE=stub and NODE_ENV=test", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "test", SIGNING_MODE: "stub" }),
            redis as any,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("throws when SIGNING_MODE=stub and NODE_ENV=production", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "production", SIGNING_MODE: "stub" }),
            redis as any,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("allows stub mode when NODE_ENV=development", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "development", SIGNING_MODE: "stub" }),
            redis as any,
          ),
      ).not.toThrow();
    });
  });

  // ── Production validation ─────────────────────────────────────────────────

  describe("onModuleInit — production validation", () => {
    it("throws when CLOB_API_URL contains 'mock' in production", () => {
      const prodSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "http://mock-polymarket:3099",
        }),
        redis as any,
      );

      expect(() => prodSvc.onModuleInit()).toThrow(
        "Production requires real CLOB_API_URL",
      );
    });

    it("throws when builder keys are missing in production", () => {
      const prodSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLY_BUILDER_API_KEY: "",
        }),
        redis as any,
      );

      expect(() => prodSvc.onModuleInit()).toThrow(
        "Production requires POLY_BUILDER_API_KEY",
      );
    });

    it("does not throw in dev mode even with mock URLs", () => {
      const devSvc = new SigningService(
        credentials,
        makeConfig({ NODE_ENV: "development" }),
        redis as any,
      );

      expect(() => devSvc.onModuleInit()).not.toThrow();
    });
  });

});
