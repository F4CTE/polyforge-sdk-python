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
    ...overrides,
  };
  return { get: (k: string, d?: string) => map[k] ?? d ?? "" } as any;
}

const DECRYPTED_CREDS = {
  privateKey: "0x" + "f".repeat(64),
  apiKey: "ak",
  apiSecret: "as",
  apiPassphrase: "ap",
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

  beforeEach(() => {
    credentials = {
      getDecryptedCredentials: vi.fn().mockResolvedValue(DECRYPTED_CREDS),
    } as any;
    svc = new SigningService(credentials, makeConfig());
  });

  // ── Dev stub signing ──────────────────────────────────────────────────────

  describe("signOrder() — dev stub (NODE_ENV != production)", () => {
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
      // Signatures may differ due to different requestId or timestamp
      // At least one of timestamp or signature will differ
      const differ =
        h1.POLY_BUILDER_TIMESTAMP !== h2.POLY_BUILDER_TIMESTAMP ||
        h1.POLY_BUILDER_SIGNATURE !== h2.POLY_BUILDER_SIGNATURE;
      expect(differ).toBe(true);
    });
  });
});
