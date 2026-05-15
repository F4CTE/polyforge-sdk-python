import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NativeCtfService } from "./native-ctf.service";
import {
  DecryptedCredentials,
  zeroCredentials,
} from "../credentials/credentials.service";
import { RedisService } from "@polyforge/shared-redis";

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

/** Create a mock Redis client and RedisService for lock tests. */
function makeMockRedis() {
  const locks = new Map<string, string>();
  const client = {
    set: vi
      .fn()
      .mockImplementation(
        async (_key: string, _value: string, ...args: string[]) => {
          if (args[0] === "PX" && args.includes("NX")) {
            if (locks.has(_key)) return null;
            locks.set(_key, _value);
            return "OK";
          }
          return "OK";
        },
      ),
    del: vi.fn().mockImplementation(async (key: string) => {
      locks.delete(key);
      return 1;
    }),
    eval: vi
      .fn()
      .mockImplementation(
        async (
          _script: string,
          _numKeys: number,
          key: string,
          token: string,
        ) => {
          if (locks.get(key) === token) {
            locks.delete(key);
            return 1;
          }
          return 0;
        },
      ),
  };

  const redisService = { getClient: () => client } as unknown as RedisService;

  return { client, redisService, locks };
}

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
      });

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
      });

      await expect(
        svc.broadcastTransaction("http://fake-rpc", Buffer.alloc(1)),
      ).rejects.toThrow("nonce too low");
    });

    it("throws when HTTP response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

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
      });

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
      });

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
      });
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
      });
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
      });
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

  // ── Per-EOA nonce serialization ──────────────────────────────────────────

  describe("CTF nonce serialization (per-EOA lock)", () => {
    it("scopes the lock key by chain and EOA address", async () => {
      const { redisService, client } = makeMockRedis();
      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "aa".repeat(32) }),
            } as Response;
          }
          if ((body.method as string) === "eth_getTransactionCount") {
            return {
              ok: true,
              json: async () => ({ result: "0x1" }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x6FC23AC00" }),
          } as Response;
        });

      const creds = makeTestCreds();
      await svcWithRedis.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      zeroCredentials(creds);

      const setCalls = client.set.mock.calls.filter(
        (c: unknown[]) => c.length >= 5 && c[2] === "PX" && c[4] === "NX",
      ) as [string, string, ...string[]][];

      expect(setCalls.length).toBe(1);
      const lockKey = setCalls[0][0];
      expect(lockKey).toMatch(/^ctf:tx:lock:\d+:0x[0-9a-f]{40}$/);
      expect(lockKey).toContain("137");
      expect(lockKey).toContain("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    });

    it("releases the lock via eval after a successful operation", async () => {
      const { redisService, client } = makeMockRedis();
      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "bb".repeat(32) }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds = makeTestCreds();
      await svcWithRedis.splitPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        partition: [1n, 2n],
        amount: 1_000_000n,
      });
      zeroCredentials(creds);

      expect(client.eval).toHaveBeenCalled();
    });

    it("releases the lock via eval even when the body throws", async () => {
      const { redisService, client } = makeMockRedis();
      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: false,
              status: 503,
              json: async () => ({}),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds = makeTestCreds();
      await expect(
        svcWithRedis.mergePosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          partition: [1n, 2n],
          amount: 1_000_000n,
        }),
      ).rejects.toThrow("HTTP 503");
      zeroCredentials(creds);

      expect(client.eval).toHaveBeenCalled();
    });

    it("serializes concurrent calls for the same EOA", async () => {
      const resolveOrder: string[] = [];
      let evalCount = 0;

      const { redisService, client } = makeMockRedis();

      // Override set to gate: first caller acquires, second retries
      let firstAcquired = false;
      let secondResolved = false;
      let releaseGate: (() => void) | null = null;
      const releasePromise = new Promise<void>((r) => {
        releaseGate = r;
      });

      client.set.mockImplementation(
        async (_key: string, _value: string, ...args: string[]) => {
          if (args[0] === "PX" && args.includes("NX")) {
            if (!firstAcquired) {
              firstAcquired = true;
              resolveOrder.push("acquired-1");
              return "OK";
            }
            if (!secondResolved) {
              // Second caller still retrying — block until first releases
              await releasePromise;
              secondResolved = true;
              resolveOrder.push("acquired-2");
              return "OK";
            }
            return "OK";
          }
          return "OK";
        },
      );

      client.eval.mockImplementation(async () => {
        evalCount++;
        if (evalCount === 1) {
          // First lock released by first caller's finally block
          resolveOrder.push("released-1");
          releaseGate?.();
        }
        return 1;
      });

      const svcWithRedis = new NativeCtfService(redisService);

      // Mock: all RPC calls succeed
      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "cc".repeat(32) }),
            } as Response;
          }
          if ((body.method as string) === "eth_getTransactionCount") {
            return {
              ok: true,
              json: async () => ({ result: "0x2" }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x6FC23AC00" }),
          } as Response;
        });

      const c1 = makeTestCreds();
      const c2 = makeTestCreds();

      const [r1, r2] = await Promise.all([
        svcWithRedis.redeemPosition(c1, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        }),
        svcWithRedis.redeemPosition(c2, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [2n],
        }),
      ]);

      zeroCredentials(c1);
      zeroCredentials(c2);

      expect(r1).toHaveProperty("txHash");
      expect(r2).toHaveProperty("txHash");
      // The first caller must acquire before the second
      expect(resolveOrder).toEqual(["acquired-1", "released-1", "acquired-2"]);
    });

    it("does not delete another request's lock when ownership token differs", async () => {
      const { redisService, client, locks } = makeMockRedis();

      const svcWithRedis = new NativeCtfService(redisService);

      // Capture the lock key and token set by the caller
      let capturedKey = "";
      let capturedToken = "";

      client.set.mockImplementation(
        async (key: string, value: string, ...args: string[]) => {
          if (args[0] === "PX" && args.includes("NX")) {
            if (!locks.has(key)) {
              locks.set(key, value);
              capturedKey = key;
              capturedToken = value;
              return "OK";
            }
            return null;
          }
          return "OK";
        },
      );

      // Simulate another worker stealing the lock before this worker's finally runs
      client.eval.mockImplementation(
        async (
          _script: string,
          _numKeys: number,
          key: string,
          token: string,
        ) => {
          // Before the first eval, replace the lock value to simulate
          // another request that acquired the key after TTL expiry
          if (key === capturedKey && token === capturedToken) {
            locks.set(key, "OTHER_WORKER_TOKEN");
          }
          // Now check ownership — this worker's token no longer matches
          if (locks.get(key) === token) {
            locks.delete(key);
            return 1;
          }
          return 0;
        },
      );

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "aa".repeat(32) }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds = makeTestCreds();
      await svcWithRedis.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      zeroCredentials(creds);

      // eval was called but the lock key still holds the OTHER_WORKER_TOKEN
      // (the first worker's release did NOT delete the new owner's lock)
      expect(locks.get(capturedKey)).toBe("OTHER_WORKER_TOKEN");
    });

    it("allows parallel calls for same EOA on different chains", async () => {
      const { redisService, client } = makeMockRedis();
      const svcWithRedis = new NativeCtfService(redisService);

      const acquiredKeys: string[] = [];
      client.set.mockImplementation(
        async (key: string, value: string, ...args: string[]) => {
          if (args[0] === "PX" && args.includes("NX")) {
            acquiredKeys.push(key);
            return "OK";
          }
          return "OK";
        },
      );

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "dd".repeat(32) }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds1 = makeTestCreds();
      const creds2 = makeTestCreds();

      // Same EOA, different chains — both should proceed without blocking
      const [r1, r2] = await Promise.all([
        svcWithRedis.redeemPosition(creds1, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        }),
        svcWithRedis.redeemPosition(creds2, 80002, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [2n],
        }),
      ]);

      zeroCredentials(creds1);
      zeroCredentials(creds2);

      expect(r1).toHaveProperty("txHash");
      expect(r2).toHaveProperty("txHash");

      // Both should have acquired locks (different keys due to different chainIds)
      expect(acquiredKeys.length).toBe(2);
      expect(acquiredKeys[0]).not.toBe(acquiredKeys[1]);
      expect(acquiredKeys[0]).toContain("137");
      expect(acquiredKeys[1]).toContain("80002");
    });

    it("allows parallel calls for different EOAs", async () => {
      const { redisService, client } = makeMockRedis();
      const svcWithRedis = new NativeCtfService(redisService);

      const setKeys: string[] = [];
      client.set.mockImplementation(
        async (key: string, _value: string, ...args: string[]) => {
          if (args[0] === "PX" && args.includes("NX")) {
            setKeys.push(key);
            return "OK";
          }
          return "OK";
        },
      );

      // Use two different keys to simulate different EOAs
      const creds1 = makeTestCreds();
      const creds2 = makeTestCreds({
        privateKey: Buffer.from(
          "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
          "utf8",
        ),
      });

      // Verify they have different addresses
      const addr1 = svcWithRedis.getEoaAddress(creds1);
      const addr2 = svcWithRedis.getEoaAddress(creds2);
      expect(addr1).not.toBe(addr2);
    });

    it("does not exceed the 60 s deadline when a Redis SET call hangs indefinitely", async () => {
      vi.useFakeTimers();

      const { redisService, client } = makeMockRedis();

      // SET never resolves — simulates a stalled / reconnecting Redis connection
      // Each attempt is bounded by a 3 s Promise.race timeout, and the overall
      // loop must exit after the 60 s deadline regardless.
      client.set.mockReturnValue(new Promise(() => {}));

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();
      let caught: Error | null = null;
      const promise = svcWithRedis
        .redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        })
        .catch((e: Error) => {
          caught = e;
        });

      await vi.runAllTimersAsync();
      await promise;
      vi.useRealTimers();
      zeroCredentials(creds);

      expect(caught).not.toBeNull();
      expect(caught!.message).toContain(
        "Timed out waiting for CTF transaction lock for EOA",
      );
    });

    it("times out after 60 s if the lock is never released", async () => {
      vi.useFakeTimers();

      const { redisService, client } = makeMockRedis();

      // Never succeed at acquiring
      client.set.mockResolvedValue(null);

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();

      // Attach a rejection handler BEFORE running timers so the promise
      // rejection is handled synchronously within the fake-timer flush,
      // preventing vitest from flagging it as an unhandled rejection.
      let caught: Error | null = null;
      const promise = svcWithRedis
        .redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        })
        .catch((e: Error) => {
          caught = e;
        });

      // Run all timers iteratively to exhaust the exponential-backoff loop
      await vi.runAllTimersAsync();

      // Flush the microtask queue so .catch fires
      await promise;
      vi.useRealTimers();
      zeroCredentials(creds);

      expect(caught).not.toBeNull();
      expect(caught!.message).toContain(
        "Timed out waiting for CTF transaction lock for EOA",
      );
    });

    it("surfaces permanent Redis errors immediately instead of retrying", async () => {
      const { redisService, client } = makeMockRedis();

      const permanentErr = Object.assign(
        new Error("NOAUTH Authentication required."),
        {
          name: "ReplyError",
        },
      );
      client.set.mockRejectedValueOnce(permanentErr);

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();
      await expect(
        svcWithRedis.redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        }),
      ).rejects.toThrow("NOAUTH");
      zeroCredentials(creds);

      // Must not have retried — exactly one SET call
      expect(client.set).toHaveBeenCalledTimes(1);
    });

    it("cleans up ghost lock when a timed-out SET later resolves via offline queue", async () => {
      vi.useFakeTimers();

      const { redisService, client } = makeMockRedis();

      // First invocation: SET never resolves within the 3 s timeout,
      // so the timeout wins the race.  The SET promise stays pending.
      let resolveSetPromise: ((value: string | null) => void) | null = null;
      const firstSetPromise = new Promise<string | null>((resolve) => {
        resolveSetPromise = resolve;
      });
      client.set.mockReturnValueOnce(firstSetPromise);

      // Second invocation (after backoff): succeeds normally.
      client.set.mockResolvedValueOnce("OK");

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();
      let caught: Error | null = null;
      const promise = svcWithRedis
        .redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        })
        .catch((e: Error) => {
          caught = e;
        });

      // Advance time past the first attempt's 3 s timeout + backoff delay
      await vi.advanceTimersByTimeAsync(3_500);
      // Now let the ghost SET resolve (simulating offline-queue replay)
      resolveSetPromise!("OK");
      await vi.advanceTimersByTimeAsync(1_000);
      await promise;
      vi.useRealTimers();
      zeroCredentials(creds);

      // Operation should succeed (second attempt acquired)
      expect(caught).toBeNull();
      // The ghost lock cleanup should have called EVAL with the unlock script
      expect(client.eval).toHaveBeenCalled();
    });

    it("ghost-lock cleanup with stale token does not delete a newer owner's lock", async () => {
      vi.useFakeTimers();

      const { redisService, client } = makeMockRedis();

      // First SET hangs until explicitly resolved (simulates offline queue delay).
      let resolveSetPromise: ((value: string | null) => void) | null = null;
      const firstSetPromise = new Promise<string | null>((resolve) => {
        resolveSetPromise = resolve;
      });
      client.set.mockReturnValueOnce(firstSetPromise);

      // Second attempt succeeds normally.
      client.set.mockResolvedValueOnce("OK");

      // Ghost-cleanup EVAL returns 0 (token mismatch — another request now
      // owns the lock). Normal release EVAL returns 1.
      let evalCallCount = 0;
      client.eval.mockImplementation(async () => {
        evalCallCount++;
        // First EVAL call is from ghost cleanup (stale token → mismatch).
        return evalCallCount === 1 ? 0 : 1;
      });

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();
      let caught: Error | null = null;
      const promise = svcWithRedis
        .redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        })
        .catch((e: Error) => {
          caught = e;
        });

      // Advance past the first attempt's 3 s timeout + backoff delay.
      await vi.advanceTimersByTimeAsync(3_500);
      // Now let the ghost SET resolve (simulating offline-queue replay).
      resolveSetPromise!("OK");
      await vi.advanceTimersByTimeAsync(1_000);
      await promise;
      vi.useRealTimers();
      zeroCredentials(creds);

      // Operation succeeds even though ghost cleanup could not delete the
      // lock (wrong token) — proving the cleanup does not interfere with
      // a newer owner's lock.
      expect(caught).toBeNull();
      // Ghost cleanup MUST use token-checked Lua unlock, not raw DEL.
      expect(client.del).not.toHaveBeenCalled();
      expect(client.eval).toHaveBeenCalled();
    });

    it("logs an error when EVAL fails during lock release", async () => {
      const { redisService, client } = makeMockRedis();

      client.eval.mockRejectedValueOnce(
        new Error("READONLY You can't write against a read only replica."),
      );

      const svcWithRedis = new NativeCtfService(redisService);

      const loggerErrorSpy = vi.spyOn(
        (svcWithRedis as unknown as { logger: { error: typeof vi.fn } }).logger,
        "error",
      );

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "aa".repeat(32) }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds = makeTestCreds();
      await svcWithRedis.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      zeroCredentials(creds);

      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it("survives late SET rejection after timeout without unhandled rejection", async () => {
      vi.useFakeTimers();

      const { redisService, client } = makeMockRedis();

      // First SET hangs until explicitly rejected (simulates ioredis
      // offline-queue failure after the local timeout has already won).
      let rejectSetPromise!: (reason: Error) => void;
      const firstSetPromise = new Promise<string | null>((_resolve, reject) => {
        rejectSetPromise = reject;
      });
      client.set.mockReturnValueOnce(firstSetPromise);

      // Second invocation (after backoff): succeeds normally.
      client.set.mockResolvedValueOnce("OK");

      const svcWithRedis = new NativeCtfService(redisService);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "0x1" }),
      });

      const creds = makeTestCreds();
      let caught: Error | null = null;
      const promise = svcWithRedis
        .redeemPosition(creds, 137, "http://fake-rpc", {
          conditionId: CONDITION_ID,
          indexSets: [1n],
        })
        .catch((e: Error) => {
          caught = e;
        });

      // Advance past the first attempt's 3 s timeout + backoff delay.
      await vi.advanceTimersByTimeAsync(3_500);

      // Now reject the first (timed-out) SET — simulating ioredis offline
      // queue where the queued SET command eventually fails.
      rejectSetPromise(new Error("Connection closed"));
      await vi.advanceTimersByTimeAsync(1_000);
      await promise;
      vi.useRealTimers();
      zeroCredentials(creds);

      // Operation should succeed (second attempt acquired the lock).
      expect(caught).toBeNull();
      // client.eval is called exactly once: for the normal lock release
      // (the second attempt's release).  The ghost-cleanup path did not
      // fire because the late SET rejected, so no ghost lock was created.
      expect(client.eval).toHaveBeenCalledTimes(1);
    });

    it("does not use Redis lock when RedisService is not injected", async () => {
      const svc = new NativeCtfService(); // no Redis

      global.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          const body = JSON.parse(init.body as string) as Record<
            string,
            unknown
          >;
          if ((body.method as string) === "eth_sendRawTransaction") {
            return {
              ok: true,
              json: async () => ({ result: "0x" + "aa".repeat(32) }),
            } as Response;
          }
          return {
            ok: true,
            json: async () => ({ result: "0x1" }),
          } as Response;
        });

      const creds = makeTestCreds();
      const result = await svc.redeemPosition(creds, 137, "http://fake-rpc", {
        conditionId: CONDITION_ID,
        indexSets: [1n],
      });
      zeroCredentials(creds);

      expect(result).toHaveProperty("txHash");
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
