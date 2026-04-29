import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { SigningService } from "./signing.service";
import { CredentialsService } from "../credentials/credentials.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NativeCtfService } from "./native-ctf.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUILDER_SECRET = "0123456789abcdef".repeat(4); // 64 hex chars for valid HMAC key

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    CHAIN_ID: "137",
    POLY_BUILDER_API_KEY: "test-builder-key",
    POLY_BUILDER_SECRET: BUILDER_SECRET,
    POLY_BUILDER_PASSPHRASE: "test-builder-pass",
    NODE_ENV: "development", // forces dev stub path
    CLOB_API_URL: "http://clob-api.test:3099",
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
      tokenId: "token-xyz",
      makerAmount: "10000000",
      takerAmount: "6000000",
      expiration: "0",
      timestamp: String(Date.now()),
      metadata: "0x",
      builder: "0x" + "0".repeat(40),
      side: 0,
      signatureType: 0,
      signature: "0x" + "cc".repeat(65),
    }),
    ...override,
  } as any;
}

function makeMockNativeCtf(
  override: Partial<NativeCtfService> = {},
): NativeCtfService {
  return {
    redeemPosition: vi
      .fn()
      .mockResolvedValue({ txHash: "0x" + "ff".repeat(32) }),
    splitPosition: vi
      .fn()
      .mockResolvedValue({ txHash: "0x" + "ee".repeat(32) }),
    mergePosition: vi
      .fn()
      .mockResolvedValue({ txHash: "0x" + "dd".repeat(32) }),
    getEoaAddress: vi.fn().mockReturnValue("0x" + "0".repeat(40)),
    signTransaction: vi.fn().mockReturnValue(Buffer.alloc(100)),
    broadcastTransaction: vi.fn().mockResolvedValue("0x" + "aa".repeat(32)),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
    ...override,
  } as any;
}

describe("SigningService (CLOB V2)", () => {
  let svc: SigningService;
  let credentials: CredentialsService;
  let nativeEip712: NativeEip712Service;
  let nativeCtf: NativeCtfService;

  beforeEach(() => {
    credentials = {
      getDecryptedCredentials: vi.fn().mockResolvedValue(DECRYPTED_CREDS),
    } as any;
    nativeEip712 = makeMockNativeEip712();
    nativeCtf = makeMockNativeCtf();
    svc = new SigningService(
      credentials,
      makeConfig(),
      nativeEip712,
      nativeCtf,
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

    // ── V2 order fields ──

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

    it("sets expiration to the provided value for GTD", async () => {
      const futureExpiration = Math.floor(Date.now() / 1000) + 60;
      const { order } = await svc.signOrder({
        ...BASE_REQ,
        orderType: "GTD",
        expiration: futureExpiration,
      });
      expect(order.expiration).toBe(String(futureExpiration));
    });

    it("rejects FOK with non-zero expiration", async () => {
      await expect(
        svc.signOrder({
          ...BASE_REQ,
          orderType: "FOK",
          expiration: Math.floor(Date.now() / 1000) + 60,
        }),
      ).rejects.toThrow("FOK orders require expiration=0");
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

    it("includes timestamp in stub order (ms since epoch string)", async () => {
      const before = Date.now();
      const { order } = await svc.signOrder(BASE_REQ);
      const after = Date.now();
      const ts = Number(order.timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("sets metadata to 0x (empty) in stub order", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.metadata).toBe("0x");
    });

    it("sets builder to zero address in stub order when POLYMARKET_BUILDER_CODE is unset", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order.builder).toBe("0x0000000000000000000000000000000000000000");
    });

    it("sets builder to POLYMARKET_BUILDER_CODE when configured", async () => {
      const builderCode = "0x1234567890abcdef1234567890abcdef12345678";
      const svcWithBuilder = new SigningService(
        credentials,
        makeConfig({ POLYMARKET_BUILDER_CODE: builderCode }),
        nativeEip712,
        nativeCtf,
      );
      const { order } = await svcWithBuilder.signOrder(BASE_REQ);
      expect(order.builder).toBe(builderCode);
    });

    it("does NOT include V1 taker field in stub order", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order).not.toHaveProperty("taker");
    });

    it("does NOT include V1 nonce field in stub order", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order).not.toHaveProperty("nonce");
    });

    it("does NOT include V1 feeRateBps field in stub order", async () => {
      const { order } = await svc.signOrder(BASE_REQ);
      expect(order).not.toHaveProperty("feeRateBps");
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
            nativeEip712,
            nativeCtf,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("throws when SIGNING_MODE=stub and NODE_ENV=test", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "test", SIGNING_MODE: "stub" }),
            nativeEip712,
            nativeCtf,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("throws when SIGNING_MODE=stub and NODE_ENV=production", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "production", SIGNING_MODE: "stub" }),
            nativeEip712,
            nativeCtf,
          ),
      ).toThrow("Stub signing mode is only allowed in development");
    });

    it("allows stub mode when NODE_ENV=development", () => {
      expect(
        () =>
          new SigningService(
            credentials,
            makeConfig({ NODE_ENV: "development", SIGNING_MODE: "stub" }),
            nativeEip712,
            nativeCtf,
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
          CLOB_API_URL: "http://mock-clob:3099",
          POLYGON_RPC_URL: "https://polygon-rpc.com",
        }),
        nativeEip712,
        nativeCtf,
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
        nativeEip712,
        nativeCtf,
      );

      expect(() => prodSvc.onModuleInit()).toThrow(
        "Production requires POLY_BUILDER_API_KEY",
      );
    });

    it("throws when POLYGON_RPC_URL is unset in production (POLA-266)", () => {
      const prodSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
        }),
        nativeEip712,
        nativeCtf,
      );
      expect(() => prodSvc.onModuleInit()).toThrow("POLYGON_RPC_URL");
    });

    it("throws when POLYGON_RPC_URL is the public fallback in production (POLA-266)", () => {
      const prodSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYGON_RPC_URL: "https://polygon-rpc.com",
        }),
        nativeEip712,
        nativeCtf,
      );
      expect(() => prodSvc.onModuleInit()).toThrow("POLYGON_RPC_URL");
    });

    it("throws when POLYGON_RPC_URL is localhost in production (POLA-148)", () => {
      const prodSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYGON_RPC_URL: "http://localhost:8545",
        }),
        nativeEip712,
        nativeCtf,
      );
      expect(() => prodSvc.onModuleInit()).toThrow("POLYGON_RPC_URL");
    });

    it("does not throw in dev mode even with mock URLs", () => {
      const devSvc = new SigningService(
        credentials,
        makeConfig({ NODE_ENV: "development" }),
        nativeEip712,
        nativeCtf,
      );

      expect(() => devSvc.onModuleInit()).not.toThrow();
    });

    it("allows localhost RPC in dev with SIGNING_MODE=production (POLA-916)", () => {
      const devProdSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "development",
          SIGNING_MODE: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYGON_RPC_URL: "http://localhost:8545",
        }),
        nativeEip712,
        nativeCtf,
      );

      expect(() => devProdSvc.onModuleInit()).not.toThrow();
    });

    it("falls back to public RPC in dev with production signing and no URL (POLA-916)", () => {
      const devProdSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "development",
          SIGNING_MODE: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYGON_RPC_URL: "",
        }),
        nativeEip712,
        nativeCtf,
      );

      expect(() => devProdSvc.onModuleInit()).not.toThrow();
    });

    it("allows localhost RPC in test env with production signing (POLA-916)", () => {
      const testSvc = new SigningService(
        credentials,
        makeConfig({
          NODE_ENV: "test",
          SIGNING_MODE: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          POLYGON_RPC_URL: "http://localhost:8545",
        }),
        nativeEip712,
        nativeCtf,
      );

      expect(() => testSvc.onModuleInit()).not.toThrow();
    });
  });

  // ── Regression: private key must never become a JS string (POLA-136 / #671) ──

  describe("signOrder() — production mode POLA-136 regression", () => {
    let prodSvc: SigningService;
    let prodCredentials: CredentialsService;

    beforeEach(() => {
      prodCredentials = {
        getDecryptedCredentials: vi
          .fn()
          .mockImplementation(async () => makeFreshCreds()),
      } as any;
      prodSvc = new SigningService(
        prodCredentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          SIGNING_MODE: "production",
          POLYGON_RPC_URL: "https://polygon-mainnet.g.alchemy.com/v2/test",
        }),
        nativeEip712,
        nativeCtf,
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

      const pkHex = Buffer.from(TEST_PK_HEX, "utf8").toString("hex");
      const pkLeaked = utf8Calls.some((c) => c[0] === pkHex);
      expect(pkLeaked).toBe(false);
    });

    it("returns order with builderHeaders in production mode", async () => {
      const result = await prodSvc.signOrder(BASE_REQ);
      expect(result).toHaveProperty("order");
      expect(result).toHaveProperty("builderHeaders");
    });

    it("passes POLYMARKET_BUILDER_CODE to NativeEip712Service.signOrder", async () => {
      const builderCode = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
      const prodSvcWithBuilder = new SigningService(
        prodCredentials,
        makeConfig({
          NODE_ENV: "production",
          CLOB_API_URL: "https://clob.polymarket.com",
          SIGNING_MODE: "production",
          POLYGON_RPC_URL: "https://polygon-mainnet.g.alchemy.com/v2/test",
          POLYMARKET_BUILDER_CODE: builderCode,
        }),
        nativeEip712,
        nativeCtf,
      );
      await prodSvcWithBuilder.signOrder(BASE_REQ);
      const [, , params] = (nativeEip712.signOrder as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(params.builder).toBe(builderCode);
    });

    it("rejects GTD without expiration before credentials are decrypted", async () => {
      await expect(
        prodSvc.signOrder({
          ...BASE_REQ,
          orderType: "GTD",
          expiration: undefined,
        }),
      ).rejects.toThrow("GTD order requires expiration");

      expect(prodCredentials.getDecryptedCredentials).not.toHaveBeenCalled();
      expect(nativeEip712.signOrder).not.toHaveBeenCalled();
    });

    it("passes validated GTD expiration to NativeEip712Service.signOrder", async () => {
      const futureExpiration = Math.floor(Date.now() / 1000) + 60;

      await prodSvc.signOrder({
        ...BASE_REQ,
        orderType: "GTD",
        expiration: futureExpiration,
      });

      const [, , params] = (nativeEip712.signOrder as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(params.expiration).toBe(futureExpiration);
    });

    it("redeemPosition delegates to NativeCtfService in production (POLA-148)", async () => {
      const result = await prodSvc["redeemPosition"]({
        userId: "user-1",
        conditionId: "0x" + "ab".repeat(32),
        indexSets: ["1"],
      });
      expect(nativeCtf.redeemPosition).toHaveBeenCalledOnce();
      expect(result).toHaveProperty("txHash");
    });

    it("redeemPosition rejects negative index sets before loading credentials", async () => {
      await expect(
        prodSvc["redeemPosition"]({
          userId: "user-1",
          conditionId: "0x" + "ab".repeat(32),
          indexSets: ["-1"],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prodCredentials.getDecryptedCredentials).not.toHaveBeenCalled();
      expect(nativeCtf.redeemPosition).not.toHaveBeenCalled();
    });

    it("splitPosition delegates to NativeCtfService in production (POLA-148)", async () => {
      const result = await prodSvc["splitPosition"]({
        userId: "user-1",
        conditionId: "0x" + "ab".repeat(32),
        partition: ["1", "2"],
        amount: "1000000",
      });
      expect(nativeCtf.splitPosition).toHaveBeenCalledOnce();
      expect(result).toHaveProperty("txHash");
    });

    it("splitPosition rejects negative amount before loading credentials", async () => {
      await expect(
        prodSvc["splitPosition"]({
          userId: "user-1",
          conditionId: "0x" + "ab".repeat(32),
          partition: ["1", "2"],
          amount: "-1",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prodCredentials.getDecryptedCredentials).not.toHaveBeenCalled();
      expect(nativeCtf.splitPosition).not.toHaveBeenCalled();
    });

    it("splitPosition rejects uint256 overflow before loading credentials", async () => {
      await expect(
        prodSvc["splitPosition"]({
          userId: "user-1",
          conditionId: "0x" + "ab".repeat(32),
          partition: ["1", "2"],
          amount: (2n ** 256n).toString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prodCredentials.getDecryptedCredentials).not.toHaveBeenCalled();
      expect(nativeCtf.splitPosition).not.toHaveBeenCalled();
    });

    it("mergePosition delegates to NativeCtfService in production (POLA-148)", async () => {
      const result = await prodSvc["mergePosition"]({
        userId: "user-1",
        conditionId: "0x" + "ab".repeat(32),
        partition: ["1", "2"],
        amount: "1000000",
      });
      expect(nativeCtf.mergePosition).toHaveBeenCalledOnce();
      expect(result).toHaveProperty("txHash");
    });

    it("mergePosition rejects negative partition values before loading credentials", async () => {
      await expect(
        prodSvc["mergePosition"]({
          userId: "user-1",
          conditionId: "0x" + "ab".repeat(32),
          partition: ["1", "-2"],
          amount: "1000000",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prodCredentials.getDecryptedCredentials).not.toHaveBeenCalled();
      expect(nativeCtf.mergePosition).not.toHaveBeenCalled();
    });

    it("redeemPosition passes privateKey as Buffer (not string) to NativeCtfService (POLA-148)", async () => {
      await prodSvc["redeemPosition"]({
        userId: "user-1",
        conditionId: "0x" + "ab".repeat(32),
        indexSets: ["1"],
      });
      const [calledCreds] = (
        nativeCtf.redeemPosition as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(calledCreds.privateKey).toBeInstanceOf(Buffer);
      expect(typeof calledCreds.privateKey).not.toBe("string");
    });
  });
});
