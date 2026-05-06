import { describe, it, expect, vi, beforeEach } from "vitest";
import { NativeEip712Service } from "./native-eip712.service";
import {
  DecryptedCredentials,
  zeroCredentials,
} from "../credentials/credentials.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A known secp256k1 private key used for deterministic test vectors.
 * This is a well-known test key (Ethereum test-network account 0).
 * NEVER use this in production.
 */
const TEST_PRIVATE_KEY_HEX =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function makeTestCreds(
  overrides: Partial<DecryptedCredentials> = {},
): DecryptedCredentials {
  return {
    privateKey: Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8"),
    apiKey: Buffer.from("test-api-key", "utf8"),
    apiSecret: Buffer.from("test-api-secret", "utf8"),
    apiPassphrase: Buffer.from("test-passphrase", "utf8"),
    safeAddress: null,
    sigType: 0,
    ...overrides,
  };
}

// V2 BASE_PARAMS: no nonce/feeRateBps/taker; adds timestamp
const BASE_PARAMS = {
  tokenId: "12345678901234567890",
  side: "BUY" as "BUY" | "SELL",
  size: "10",
  price: "0.6",
  expiration: 0,
  timestamp: 1_714_000_000_000, // fixed ms timestamp for deterministic tests
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("NativeEip712Service (CLOB V2)", () => {
  let svc: NativeEip712Service;

  beforeEach(() => {
    svc = new NativeEip712Service();
  });

  // ── Basic output shape ────────────────────────────────────────────────────

  describe("signOrder() — output shape", () => {
    it("returns an object with all required V2 order fields", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order).toHaveProperty("salt");
      expect(order).toHaveProperty("maker");
      expect(order).toHaveProperty("signer");
      expect(order).toHaveProperty("tokenId");
      expect(order).toHaveProperty("makerAmount");
      expect(order).toHaveProperty("takerAmount");
      expect(order).toHaveProperty("expiration");
      expect(order).toHaveProperty("timestamp");
      expect(order).toHaveProperty("metadata");
      expect(order).toHaveProperty("builder");
      expect(order).toHaveProperty("side");
      expect(order).toHaveProperty("signatureType");
      expect(order).toHaveProperty("signature");
      zeroCredentials(creds);
    });

    it("does NOT include removed V1 fields (taker, nonce, feeRateBps)", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order).not.toHaveProperty("taker");
      expect(order).not.toHaveProperty("nonce");
      expect(order).not.toHaveProperty("feeRateBps");
      zeroCredentials(creds);
    });

    it("returns a 65-byte (130 hex chars) 0x-prefixed signature", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.signature).toMatch(/^0x[0-9a-f]{130}$/);
      zeroCredentials(creds);
    });

    it("includes a 0x-prefixed 64-byte salt", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.salt).toMatch(/^0x[0-9a-f]{64}$/);
      zeroCredentials(creds);
    });

    it("produces different salts on each call (random salt)", async () => {
      const c1 = makeTestCreds();
      const c2 = makeTestCreds();
      const o1 = await svc.signOrder(c1, 80002, BASE_PARAMS);
      const o2 = await svc.signOrder(c2, 80002, BASE_PARAMS);
      expect(o1.salt).not.toBe(o2.salt);
      zeroCredentials(c1);
      zeroCredentials(c2);
    });
  });

  // ── V2 new fields ─────────────────────────────────────────────────────────

  describe("signOrder() — V2 new fields", () => {
    it("encodes timestamp as a string matching params.timestamp", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        timestamp: 1_714_000_000_000,
      });
      expect(order.timestamp).toBe("1714000000000");
      zeroCredentials(creds);
    });

    it("defaults metadata to 0x (empty bytes)", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.metadata).toBe("0x");
      zeroCredentials(creds);
    });

    it("encodes provided metadata as 0x-prefixed hex", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        metadata: Buffer.from("hello", "utf8"),
      });
      expect(order.metadata).toBe("0x68656c6c6f");
      zeroCredentials(creds);
    });

    it("defaults builder to zero address", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.builder).toBe("0x0000000000000000000000000000000000000000");
      zeroCredentials(creds);
    });

    it("uses provided builder address", async () => {
      const builder = "0x1234567890123456789012345678901234567890";
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        builder,
      });
      expect(order.builder.toLowerCase()).toBe(builder.toLowerCase());
      zeroCredentials(creds);
    });
  });

  // ── Address derivation (maker/signer) ────────────────────────────────────

  describe("signOrder() — maker and signer addresses", () => {
    it("sets signer to the EOA address derived from the private key", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      // The known address for the Hardhat test account #0 private key
      expect(order.signer.toLowerCase()).toBe(
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      );
      zeroCredentials(creds);
    });

    it("sets maker === signer for sigType=0 (EOA)", async () => {
      const creds = makeTestCreds({ sigType: 0 });
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.maker.toLowerCase()).toBe(order.signer.toLowerCase());
      zeroCredentials(creds);
    });

    it("sets maker to safeAddress when provided (sigType=2, Safe wallet)", async () => {
      const safeAddress = "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef";
      const creds = makeTestCreds({ safeAddress, sigType: 2 });
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.maker.toLowerCase()).toBe(safeAddress.toLowerCase());
      expect(order.signer.toLowerCase()).toBe(
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      );
      zeroCredentials(creds);
    });
  });

  // ── Amount calculation ────────────────────────────────────────────────────

  describe("signOrder() — amount computation", () => {
    it("makerAmount = size decimal string scaled by 1_000_000", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        size: "12345678901234.123456",
        price: "0.5",
      });
      expect(order.makerAmount).toBe("12345678901234123456");
      zeroCredentials(creds);
    });

    it("takerAmount = size × price decimal strings scaled by 1_000_000 without IEEE-754 rounding", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        size: "12345678901234.123456",
        price: "0.123456",
      });
      expect(order.takerAmount).toBe("1524148134430759945");
      zeroCredentials(creds);
    });

    it("maps BUY side to 0", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        side: "BUY",
      });
      expect(order.side).toBe(0);
      zeroCredentials(creds);
    });

    it("maps SELL side to 1", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        side: "SELL",
      });
      expect(order.side).toBe(1);
      zeroCredentials(creds);
    });

    it("sets expiration from params", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        expiration: 1_700_000_000,
      });
      expect(order.expiration).toBe("1700000000");
      zeroCredentials(creds);
    });
  });

  // ── negRisk exchange routing ──────────────────────────────────────────────

  describe("signOrder() — negRisk exchange routing", () => {
    it("signs without error for regular market (negRisk=false)", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.signOrder(creds, 80002, { ...BASE_PARAMS, negRisk: false }),
      ).resolves.toBeDefined();
      zeroCredentials(creds);
    });

    it("signs without error for neg-risk market (negRisk=true)", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.signOrder(creds, 80002, { ...BASE_PARAMS, negRisk: true }),
      ).resolves.toBeDefined();
      zeroCredentials(creds);
    });
  });

  // ── Security: private key never leaks as string ───────────────────────────

  describe("SECURITY: private key memory safety", () => {
    it("does NOT call toString() on the private key Buffer", async () => {
      const creds = makeTestCreds();
      const toStringSpy = vi.spyOn(creds.privateKey, "toString");

      await svc.signOrder(creds, 80002, BASE_PARAMS);

      // toString must NOT be called — that would create an immutable V8 string (#548)
      expect(toStringSpy).not.toHaveBeenCalled();
      zeroCredentials(creds);
    });

    it("private key Buffer can be zeroed after signing (Buffer, not string)", async () => {
      const creds = makeTestCreds();
      expect(Buffer.isBuffer(creds.privateKey)).toBe(true);

      await svc.signOrder(creds, 80002, BASE_PARAMS);
      zeroCredentials(creds);

      expect(creds.privateKey.every((b) => b === 0)).toBe(true);
    });

    it("produces a valid signature even when the credentials Buffer is later zeroed", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      zeroCredentials(creds);
      expect(order.signature).toMatch(/^0x[0-9a-f]{130}$/);
    });

    it("signatureType reflects creds.sigType", async () => {
      const creds = makeTestCreds({ sigType: 2 });
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.signatureType).toBe(2);
      zeroCredentials(creds);
    });
  });

  // ── Chain ID validation ───────────────────────────────────────────────────

  describe("signOrder() — chainId validation", () => {
    it("throws for unknown chainId", async () => {
      const creds = makeTestCreds();
      await expect(svc.signOrder(creds, 999999, BASE_PARAMS)).rejects.toThrow(
        "No CTF Exchange V2 contract address known for chainId=999999",
      );
      zeroCredentials(creds);
    });

    it("accepts chainId 137 (Polygon mainnet)", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.signOrder(creds, 137, BASE_PARAMS),
      ).resolves.toBeDefined();
      zeroCredentials(creds);
    });

    it("accepts chainId 80002 (Polygon Amoy testnet)", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.signOrder(creds, 80002, BASE_PARAMS),
      ).resolves.toBeDefined();
      zeroCredentials(creds);
    });
  });

  // ── Signature consistency ─────────────────────────────────────────────────

  describe("signOrder() — signature consistency", () => {
    it("produces valid-format signatures for two independent calls", async () => {
      const c1 = makeTestCreds();
      const c2 = makeTestCreds();
      const o1 = await svc.signOrder(c1, 80002, BASE_PARAMS);
      const o2 = await svc.signOrder(c2, 80002, BASE_PARAMS);

      expect(o1.signature).toMatch(/^0x[0-9a-f]{130}$/);
      expect(o2.signature).toMatch(/^0x[0-9a-f]{130}$/);
      expect(o1.signer.toLowerCase()).toBe(o2.signer.toLowerCase());
      zeroCredentials(c1);
      zeroCredentials(c2);
    });
  });
});
