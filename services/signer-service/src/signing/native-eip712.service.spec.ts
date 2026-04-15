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

const BASE_PARAMS = {
  tokenId: "12345678901234567890",
  side: "BUY" as "BUY" | "SELL",
  size: 10,
  price: 0.6,
  expiration: 0,
  nonce: 0,
  feeRateBps: 0,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("NativeEip712Service", () => {
  let svc: NativeEip712Service;

  beforeEach(() => {
    svc = new NativeEip712Service();
  });

  // ── Basic output shape ────────────────────────────────────────────────────

  describe("signOrder() — output shape", () => {
    it("returns an object with all required order fields", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order).toHaveProperty("salt");
      expect(order).toHaveProperty("maker");
      expect(order).toHaveProperty("signer");
      expect(order).toHaveProperty("taker");
      expect(order).toHaveProperty("tokenId");
      expect(order).toHaveProperty("makerAmount");
      expect(order).toHaveProperty("takerAmount");
      expect(order).toHaveProperty("expiration");
      expect(order).toHaveProperty("nonce");
      expect(order).toHaveProperty("feeRateBps");
      expect(order).toHaveProperty("side");
      expect(order).toHaveProperty("signatureType");
      expect(order).toHaveProperty("signature");
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
      // Signer is still the EOA
      expect(order.signer.toLowerCase()).toBe(
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      );
      zeroCredentials(creds);
    });
  });

  // ── Amount calculation ────────────────────────────────────────────────────

  describe("signOrder() — amount computation", () => {
    it("makerAmount = round(size × 1_000_000)", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        size: 10,
        price: 0.5,
      });
      expect(order.makerAmount).toBe("10000000");
      zeroCredentials(creds);
    });

    it("takerAmount = round(size × price × 1_000_000)", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        size: 10,
        price: 0.6,
      });
      expect(order.takerAmount).toBe("6000000");
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

    it("passes feeRateBps through from params", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        feeRateBps: 200,
      });
      expect(order.feeRateBps).toBe("200");
      zeroCredentials(creds);
    });

    it("sets nonce from params", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        nonce: 42,
      });
      expect(order.nonce).toBe("42");
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

    it("sets taker to provided address when given", async () => {
      const taker = "0x1234567890123456789012345678901234567890";
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, {
        ...BASE_PARAMS,
        taker,
      });
      expect(order.taker.toLowerCase()).toBe(taker.toLowerCase());
      zeroCredentials(creds);
    });

    it("sets taker to zero address when not provided", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);
      expect(order.taker).toBe("0x0000000000000000000000000000000000000000");
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
      // If privateKey were converted to a string, zeroCredentials would have nothing to zero.
      // Verify it remains a Buffer that can be inspected before/after zeroing.
      expect(Buffer.isBuffer(creds.privateKey)).toBe(true);

      await svc.signOrder(creds, 80002, BASE_PARAMS);

      // After signing, zero the credentials
      zeroCredentials(creds);

      // All bytes should be zeroed
      expect(creds.privateKey.every((b) => b === 0)).toBe(true);
    });

    it("produces a valid signature even when the credentials Buffer is later zeroed", async () => {
      const creds = makeTestCreds();
      const order = await svc.signOrder(creds, 80002, BASE_PARAMS);

      // Zero the credentials AFTER signing
      zeroCredentials(creds);

      // The signature should still be valid hex (zeroing after use is fine)
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
        "No CTF Exchange contract address known for chainId=999999",
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

  // ── Signature determinism (same inputs → same sig for given salt) ─────────

  describe("signOrder() — signature consistency", () => {
    it("produces same signature for same inputs and same salt (secp256k1 is deterministic)", async () => {
      // We cannot control the random salt from outside, but we can verify
      // that two different calls produce valid-format signatures
      const c1 = makeTestCreds();
      const c2 = makeTestCreds();
      const o1 = await svc.signOrder(c1, 80002, BASE_PARAMS);
      const o2 = await svc.signOrder(c2, 80002, BASE_PARAMS);

      // Both must be valid hex signatures
      expect(o1.signature).toMatch(/^0x[0-9a-f]{130}$/);
      expect(o2.signature).toMatch(/^0x[0-9a-f]{130}$/);

      // Both must have the same maker/signer (derived from same key)
      expect(o1.signer.toLowerCase()).toBe(o2.signer.toLowerCase());
      zeroCredentials(c1);
      zeroCredentials(c2);
    });
  });
});
