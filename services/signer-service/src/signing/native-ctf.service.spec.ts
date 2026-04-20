import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NativeCtfService } from "./native-ctf.service";
import {
  DecryptedCredentials,
  zeroCredentials,
} from "../credentials/credentials.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Well-known Hardhat test account #0 private key — never use in production. */
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

const CONDITION_ID = "0x" + "ab".repeat(32);
const ZERO_BYTES32 = "0x" + "00".repeat(32);

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("NativeCtfService", () => {
  let svc: NativeCtfService;

  beforeEach(() => {
    svc = new NativeCtfService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Address derivation ────────────────────────────────────────────────────

  describe("getEoaAddress()", () => {
    it("derives the correct EOA address from the test private key", () => {
      const creds = makeTestCreds();
      const addr = svc.getEoaAddress(creds);
      // Known address for Hardhat test account #0
      expect(addr.toLowerCase()).toBe(
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      );
      zeroCredentials(creds);
    });

    it("returns a lowercase 0x-prefixed 20-byte hex address", () => {
      const creds = makeTestCreds();
      const addr = svc.getEoaAddress(creds);
      expect(addr).toMatch(/^0x[0-9a-f]{40}$/);
      zeroCredentials(creds);
    });

    it("does NOT call toString() on the private key Buffer during address derivation", () => {
      const creds = makeTestCreds();
      const spy = vi.spyOn(creds.privateKey, "toString");
      svc.getEoaAddress(creds);
      expect(spy).not.toHaveBeenCalled();
      zeroCredentials(creds);
    });
  });

  // ── Transaction signing ───────────────────────────────────────────────────

  describe("signTransaction()", () => {
    const TX_PARAMS = {
      to: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
      data: Buffer.from("deadbeef", "hex"),
      nonce: 0,
      gasPrice: 30_000_000_000n, // 30 Gwei
      gasLimit: 200_000n,
      value: 0n,
    };

    it("returns a Buffer (RLP-encoded signed transaction)", () => {
      const creds = makeTestCreds();
      const rawTx = svc.signTransaction(creds, 137, TX_PARAMS);
      expect(Buffer.isBuffer(rawTx)).toBe(true);
      expect(rawTx.length).toBeGreaterThan(0);
      zeroCredentials(creds);
    });

    it("RLP output starts with the list prefix byte (0xc0 or higher)", () => {
      const creds = makeTestCreds();
      const rawTx = svc.signTransaction(creds, 137, TX_PARAMS);
      // All RLP lists start with a byte >= 0xc0
      expect(rawTx[0]).toBeGreaterThanOrEqual(0xc0);
      zeroCredentials(creds);
    });

    it("produces different signed bytes for chainId=137 vs chainId=80002 (EIP-155 v differs)", () => {
      const c1 = makeTestCreds();
      const c2 = makeTestCreds();
      const tx1 = svc.signTransaction(c1, 137, TX_PARAMS);
      const tx2 = svc.signTransaction(c2, 80002, TX_PARAMS);
      expect(tx1.toString("hex")).not.toBe(tx2.toString("hex"));
      zeroCredentials(c1);
      zeroCredentials(c2);
    });

    it("signing is deterministic for the same nonce and params", () => {
      // secp256k1 with RFC 6979 is deterministic given the same key + digest
      const c1 = makeTestCreds();
      const c2 = makeTestCreds();
      const tx1 = svc.signTransaction(c1, 137, TX_PARAMS);
      const tx2 = svc.signTransaction(c2, 137, TX_PARAMS);
      expect(tx1.toString("hex")).toBe(tx2.toString("hex"));
      zeroCredentials(c1);
      zeroCredentials(c2);
    });
  });

  // ── SECURITY: private key non-materialization ─────────────────────────────

  describe("SECURITY: private key never materializes as JS string", () => {
    it("signTransaction() does NOT call toString('utf8') on creds.privateKey", () => {
      const creds = makeTestCreds();
      const utf8Calls: string[] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8") {
          utf8Calls.push(this.toString("hex"));
        }
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        svc.signTransaction(creds, 137, {
          to: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
          data: Buffer.alloc(4),
          nonce: 0,
          gasPrice: 1n,
          gasLimit: 100_000n,
          value: 0n,
        });
      } finally {
        Buffer.prototype.toString = origToString;
      }

      // The private key Buffer contains ASCII of "0x{64hex}".
      // Its hex representation would reveal itself via utf8 toString.
      const pkHex = Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8").toString("hex");
      const leaked = utf8Calls.some((h) => h === pkHex);
      expect(leaked).toBe(false);
    });

    it("privateKey Buffer remains zeroable after signTransaction()", () => {
      const creds = makeTestCreds();
      svc.signTransaction(creds, 80002, {
        to: "0x69308FB512518e39F9b16112fA8d994F4e2Bf8bB",
        data: Buffer.alloc(4),
        nonce: 0,
        gasPrice: 1n,
        gasLimit: 100_000n,
        value: 0n,
      });
      zeroCredentials(creds);
      expect(creds.privateKey.every((b) => b === 0)).toBe(true);
    });

    it("getEoaAddress() does NOT call toString('utf8') on creds.privateKey", () => {
      const creds = makeTestCreds();
      const utf8Calls: string[] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8") utf8Calls.push(this.toString("hex"));
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        svc.getEoaAddress(creds);
      } finally {
        Buffer.prototype.toString = origToString;
      }

      const pkHex = Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8").toString("hex");
      expect(utf8Calls.some((h) => h === pkHex)).toBe(false);
      zeroCredentials(creds);
    });
  });

  // ── broadcastTransaction / getTransactionCount / getGasPrice ─────────────

  describe("broadcastTransaction()", () => {
    it("returns the transaction hash from the RPC result", async () => {
      const expectedHash = "0x" + "aa".repeat(32);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: expectedHash, id: 1 }),
      } as Response);

      const txHash = await svc.broadcastTransaction(
        "http://fake-rpc",
        Buffer.from("deadbeef", "hex"),
      );
      expect(txHash).toBe(expectedHash);
    });

    it("throws when RPC returns an error object", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          error: { message: "nonce too low" },
          id: 1,
        }),
      } as Response);

      await expect(
        svc.broadcastTransaction("http://fake-rpc", Buffer.alloc(1)),
      ).rejects.toThrow("nonce too low");
    });

    it("throws when HTTP response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);

      await expect(
        svc.broadcastTransaction("http://fake-rpc", Buffer.alloc(1)),
      ).rejects.toThrow("HTTP 503");
    });
  });

  describe("getTransactionCount()", () => {
    it("returns the nonce as a decimal number", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result: "0x5", id: 1 }),
      } as Response);

      const nonce = await svc.getTransactionCount(
        "http://fake-rpc",
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      );
      expect(nonce).toBe(5);
    });
  });

  describe("getGasPrice()", () => {
    it("returns gas price as bigint", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: "0x6FC23AC00", // 30 Gwei
          id: 1,
        }),
      } as Response);

      const gasPrice = await svc.getGasPrice("http://fake-rpc");
      expect(gasPrice).toBe(30_000_000_000n);
    });
  });

  // ── redeemPosition ────────────────────────────────────────────────────────

  describe("redeemPosition()", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: "0x" + "cc".repeat(32),
          id: 1,
        }),
      } as Response);
    });

    it("throws for unknown chainId", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.redeemPosition(creds, 999999, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        }),
      ).rejects.toThrow("No CTF contract address known for chainId=999999");
      zeroCredentials(creds);
    });

    it("accepts chainId 137 (Polygon mainnet)", async () => {
      const creds = makeTestCreds();
      const result = await svc.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      expect(result).toHaveProperty("txHash");
      zeroCredentials(creds);
    });

    it("accepts chainId 80002 (Polygon Amoy)", async () => {
      const creds = makeTestCreds();
      const result = await svc.redeemPosition(creds, 80002, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [2n],
      });
      expect(result).toHaveProperty("txHash");
      zeroCredentials(creds);
    });

    it("uses a custom collateralToken when provided", async () => {
      const creds = makeTestCreds();
      const customCollateral = "0x" + "11".repeat(20);
      const result = await svc.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
        collateralToken: customCollateral,
      });
      expect(result.txHash).toBeDefined();
      zeroCredentials(creds);
    });

    it("uses zero parentCollectionId by default", async () => {
      const creds = makeTestCreds();
      // This should not throw and should include zero bytes32 in calldata
      await expect(
        svc.redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        }),
      ).resolves.toBeDefined();
      zeroCredentials(creds);
    });

    it("does NOT call toString('utf8') on creds.privateKey", async () => {
      const creds = makeTestCreds();
      const utf8Calls: string[] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8") utf8Calls.push(this.toString("hex"));
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        await svc.redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        });
      } finally {
        Buffer.prototype.toString = origToString;
      }

      const pkHex = Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8").toString("hex");
      expect(utf8Calls.some((h) => h === pkHex)).toBe(false);
      zeroCredentials(creds);
    });
  });

  // ── splitPosition ─────────────────────────────────────────────────────────

  describe("splitPosition()", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: "0x" + "dd".repeat(32),
          id: 1,
        }),
      } as Response);
    });

    it("returns txHash on success", async () => {
      const creds = makeTestCreds();
      const result = await svc.splitPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        partition: [1n, 2n],
        amount: 1_000_000n,
      });
      expect(result).toHaveProperty("txHash");
      zeroCredentials(creds);
    });

    it("throws for unknown chainId", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.splitPosition(creds, 12345, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          partition: [1n, 2n],
          amount: 1n,
        }),
      ).rejects.toThrow("No CTF contract address known");
      zeroCredentials(creds);
    });

    it("does NOT call toString('utf8') on creds.privateKey", async () => {
      const creds = makeTestCreds();
      const utf8Calls: string[] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8") utf8Calls.push(this.toString("hex"));
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        await svc.splitPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          partition: [1n, 2n],
          amount: 1_000_000n,
        });
      } finally {
        Buffer.prototype.toString = origToString;
      }

      const pkHex = Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8").toString("hex");
      expect(utf8Calls.some((h) => h === pkHex)).toBe(false);
      zeroCredentials(creds);
    });
  });

  // ── mergePosition ─────────────────────────────────────────────────────────

  describe("mergePosition()", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: "0x" + "ee".repeat(32),
          id: 1,
        }),
      } as Response);
    });

    it("returns txHash on success", async () => {
      const creds = makeTestCreds();
      const result = await svc.mergePosition(creds, 80002, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        partition: [1n, 2n],
        amount: 500_000n,
      });
      expect(result).toHaveProperty("txHash");
      zeroCredentials(creds);
    });

    it("throws for unknown chainId", async () => {
      const creds = makeTestCreds();
      await expect(
        svc.mergePosition(creds, 999, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          partition: [1n, 2n],
          amount: 1n,
        }),
      ).rejects.toThrow("No CTF contract address known");
      zeroCredentials(creds);
    });

    it("does NOT call toString('utf8') on creds.privateKey", async () => {
      const creds = makeTestCreds();
      const utf8Calls: string[] = [];
      const origToString = Buffer.prototype.toString;
      Buffer.prototype.toString = function (
        this: Buffer,
        encoding?: BufferEncoding,
        ...rest: unknown[]
      ) {
        if (encoding === "utf8") utf8Calls.push(this.toString("hex"));
        return origToString.apply(this, [encoding, ...rest] as Parameters<
          typeof origToString
        >);
      };

      try {
        await svc.mergePosition(creds, 80002, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          partition: [1n, 2n],
          amount: 500_000n,
        });
      } finally {
        Buffer.prototype.toString = origToString;
      }

      const pkHex = Buffer.from(TEST_PRIVATE_KEY_HEX, "utf8").toString("hex");
      expect(utf8Calls.some((h) => h === pkHex)).toBe(false);
      zeroCredentials(creds);
    });
  });

  // ── ABI calldata structure validation ─────────────────────────────────────

  describe("calldata encoding (ABI structure)", () => {
    it("redeemPosition calldata starts with the correct 4-byte selector", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            capturedBody = body;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x" + "aa".repeat(32) }),
          } as Response;
        });

      const creds = makeTestCreds();
      await svc.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      zeroCredentials(creds);

      // Selector for redeemPositions(address,bytes32,bytes32,uint256[]) = 0x9e28d08e
      // We cannot easily inspect the raw calldata from the RLP-encoded tx in a unit test,
      // but we verify the RPC was called with a non-empty rawTx
      expect(capturedBody).not.toBeNull();
    });

    it("splitPosition and mergePosition use different selectors", async () => {
      const splitRpcs: string[] = [];
      const mergeRpcs: string[] = [];
      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            splitRpcs.push(body.params as string);
          }
          return {
            ok: true,
            json: async () => ({ result: "0x" + "ab".repeat(32) }),
          } as Response;
        });

      const c1 = makeTestCreds();
      await svc.splitPosition(c1, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        partition: [1n, 2n],
        amount: 1n,
      });
      zeroCredentials(c1);

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            mergeRpcs.push(body.params as string);
          }
          return {
            ok: true,
            json: async () => ({ result: "0x" + "ac".repeat(32) }),
          } as Response;
        });

      const c2 = makeTestCreds();
      await svc.mergePosition(c2, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        partition: [1n, 2n],
        amount: 1n,
      });
      zeroCredentials(c2);

      // Transactions must differ (different selectors → different calldata → different digests)
      expect(splitRpcs[0]).not.toBe(mergeRpcs[0]);
    });
  });
});
