import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { SigningService } from "./signing.service";
import { CredentialsService } from "../credentials/credentials.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NotFoundException, NotImplementedException } from "@nestjs/common";

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

// Well-known Hardhat account #0 — valid secp256k1 key, safe for test use only.
const TEST_PK_HEX =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeFreshCreds(sigType = 0) {
  return {
    privateKey: Buffer.from(TEST_PK_HEX, "utf8"),
    apiKey: Buffer.from("ak", "utf8"),
    apiSecret: Buffer.from("as", "utf8"),
    apiPassphrase: Buffer.from("ap", "utf8"),
    safeAddress: null,
    sigType,
  };
}

// Shared reference only used to read sigType in stub tests (never zeroed there)
const DECRYPTED_CREDS = makeFreshCreds();

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

function makeMockNativeEip712(
  override: Partial<NativeEip712Service> = {},
): NativeEip712Service {
  return {
    signOrder: vi.fn().mockResolvedValue({
      salt: "0x" + "ab".repeat(32),
      maker: "0x" + "0".repeat(40),
      signer: "0x" + "0".repeat(40),
      taker: "0x" + "0".repeat(40),
      tokenId: "token-xyz",
      makerAmount: "10000000",
      takerAmount: "6000000",
      expiration: "0",
      nonce: "0",
      feeRateBps: "0",
      side: 0,
      signatureType: 0,
      signature: "0x" + "cc".repeat(65),
    }),
    ...override,
  } as any;
}

describe("SigningService", () => {
  let svc: SigningService;
  let credentials: CredentialsService;
  let redis: ReturnType<typeof makeMockRedis>;
  let nativeEip712: NativeEip712Service;

  beforeEach(() => {
    credentials = {
      getDecryptedCredentials: vi.fn().mockResolvedValue(DECRYPTED_CREDS),
    } as any;
    redis = makeMockRedis();
    nativeEip712 = makeMockNativeEip712();
    svc = new SigningService(
      credentials,
      makeConfig(),
      redis as any,
      nativeEip712,
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
            nativeEip712,
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
            nativeEip712,
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
            nativeEip712,
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
            nativeEip712,
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
        nativeEip712,
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
        nativeEip712,
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
        nativeEip712,
      );

      expect(() => devSvc.onModuleInit()).not.toThrow();
    });
  });

  // ── Regression: private key must never become a JS string (POLA-136 / #671) ──

  describe("signOrder() — production mode POLA-136 regression", () => {
    let prodSvc: SigningService;
    let prodCredentials: CredentialsService;
    let prodRedis: ReturnType<typeof makeMockRedis>;

    beforeEach(() => {
      // Each test gets fresh Buffers so zeroCredentials() in finally blocks
      // doesn't corrupt subsequent tests (Buffers are mutable — zeroing one
      // instance would affect all tests sharing the same reference).
      prodCredentials = {
        getDecryptedCredentials: vi
          .fn()
          .mockImplementation(async () => makeFreshCreds()),
      } as any;
      // Return cached values so fetchNonce/fetchFeeRate never hit external HTTP
      prodRedis = {
        get: vi.fn().mockResolvedValue("0"),
        set: vi.fn().mockResolvedValue("OK"),
      };
      prodSvc = new SigningService(
        prodCredentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          SIGNING_MODE: "production",
        }),
        prodRedis as any,
        nativeEip712,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("routes through NativeEip712Service — private key stays as Buffer", async () => {
      await prodSvc.signOrder(BASE_REQ);
      expect(nativeEip712.signOrder).toHaveBeenCalledOnce();
    });

    it("passes creds with privateKey as Buffer (not string) to NativeEip712Service", async () => {
      await prodSvc.signOrder(BASE_REQ);
      const [calledCreds] = (nativeEip712.signOrder as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(calledCreds.privateKey).toBeInstanceOf(Buffer);
      expect(typeof calledCreds.privateKey).not.toBe("string");
    });

    it("never calls toString('utf8') on creds.privateKey", async () => {
      // Track every Buffer.prototype.toString("utf8") call made during signOrder.
      // The private key buffer must not appear as a "utf8" conversion.
      const utf8Calls: unknown[][] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8")
          utf8Calls.push([this.toString("hex"), encoding, ...rest]);
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        await prodSvc.signOrder(BASE_REQ);
      } finally {
        Buffer.prototype.toString = origToString;
      }

      // creds.privateKey contains ASCII bytes of "0x{64hex}" — if it were
      // converted to a JS string via toString("utf8"), the hex representation
      // of the private key string would appear in utf8Calls.
      const pkHex = Buffer.from(TEST_PK_HEX, "utf8").toString("hex");
      const pkLeaked = utf8Calls.some((c) => c[0] === pkHex);
      expect(pkLeaked).toBe(false);
    });

    it("returns order with builderHeaders in production mode", async () => {
      const result = await prodSvc.signOrder(BASE_REQ);
      expect(result).toHaveProperty("order");
      expect(result).toHaveProperty("builderHeaders");
    });

    it("redeemPosition throws NotImplementedException in production (no ClobClient string exposure)", async () => {
      await expect(
        prodSvc["redeemPosition"]("user-1", "token-1"),
      ).rejects.toThrow(NotImplementedException);
    });

    it("splitPosition throws NotImplementedException in production (no ClobClient string exposure)", async () => {
      await expect(
        prodSvc["splitPosition"]("user-1", "token-1", "100"),
      ).rejects.toThrow(NotImplementedException);
    });

    it("mergePosition throws NotImplementedException in production (no ClobClient string exposure)", async () => {
      await expect(
        prodSvc["mergePosition"]("user-1", "token-1", "100"),
      ).rejects.toThrow(NotImplementedException);
    });
  });
});
