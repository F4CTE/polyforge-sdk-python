import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";
import { NotFoundException } from "@nestjs/common";
import { Ed25519SigningService } from "./ed25519-signing.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEd25519Seed(): { seedHex: string; publicKey: crypto.KeyObject } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const pkcs8Der = privateKey.export({ type: "pkcs8", format: "der" });
  const seed = (pkcs8Der as Buffer).subarray(pkcs8Der.byteLength - 32);
  return { seedHex: Buffer.from(seed).toString("hex"), publicKey };
}

function makeMockEncryption() {
  const store = new Map<string, { ct: Buffer; iv: Buffer; tag: Buffer }>();

  return {
    encryptWithMasterKey(plaintext: string) {
      const iv = crypto.randomBytes(12);
      const key = crypto.randomBytes(32);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const ct = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      store.set(plaintext, { ct, iv, tag });
      return {
        ciphertext: new Uint8Array(ct),
        iv: new Uint8Array(iv),
        tag: new Uint8Array(tag),
      };
    },

    decryptWithMasterKey(
      _ct: Uint8Array,
      _iv: Uint8Array,
      _tag: Uint8Array,
    ): Buffer {
      for (const [plaintext, { ct }] of store.entries()) {
        if (Buffer.from(_ct).equals(ct)) {
          return Buffer.from(plaintext, "utf8");
        }
      }
      throw new Error("decryption failed — key not in mock store");
    },

    currentKekVersion: 1,
  };
}

function makeMockPrisma() {
  const rows = new Map<string, Record<string, unknown>>();

  return {
    polymarketUsCredential: {
      upsert: vi.fn(
        async (args: {
          where: { userId: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          rows.set(args.where.userId, { ...args.create });
          return args.create;
        },
      ),
      findUnique: vi.fn(async (args: { where: { userId: string } }) => {
        return rows.get(args.where.userId) ?? null;
      }),
      delete: vi.fn(async (args: { where: { userId: string } }) => {
        if (!rows.has(args.where.userId)) {
          throw new Error("Record to delete does not exist");
        }
        const row = rows.get(args.where.userId);
        rows.delete(args.where.userId);
        return row;
      }),
    },
    _rows: rows,
  };
}

function makeService() {
  const encryption = makeMockEncryption();
  const prisma = makeMockPrisma();
  const svc = new Ed25519SigningService(prisma as any, encryption as any);
  return { svc, encryption, prisma };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Ed25519SigningService", () => {
  let svc: Ed25519SigningService;
  let prisma: ReturnType<typeof makeMockPrisma>;
  let encryption: ReturnType<typeof makeMockEncryption>;

  beforeEach(() => {
    const deps = makeService();
    svc = deps.svc;
    prisma = deps.prisma;
    encryption = deps.encryption;
  });

  // ─── importUsCredentials ────────────────────────────────────────────

  describe("importUsCredentials()", () => {
    it("stores encrypted credentials via prisma upsert", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-1",
        keyId: "key-001",
        secretKey: seedHex,
      });

      expect(prisma.polymarketUsCredential.upsert).toHaveBeenCalledOnce();
      const call = prisma.polymarketUsCredential.upsert.mock.calls[0][0];
      expect(call.where.userId).toBe("user-1");
      expect(call.create.keyId).toBe("key-001");
      expect(call.create.secretKeyCt).toBeInstanceOf(Uint8Array);
      expect(call.create.secretKeyIv).toBeInstanceOf(Uint8Array);
      expect(call.create.secretKeyTag).toBeInstanceOf(Uint8Array);
    });

    it("round-trips: import then retrieve returns original keyId", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-rt",
        keyId: "key-rt",
        secretKey: seedHex,
      });

      const creds = await svc.getDecryptedUsCredentials("user-rt");
      expect(creds.keyId).toBe("key-rt");
    });

    it("round-trips: import then retrieve returns decrypted secretKey", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-rt2",
        keyId: "key-rt2",
        secretKey: seedHex,
      });

      const creds = await svc.getDecryptedUsCredentials("user-rt2");
      expect(creds.secretKey.toString("utf8")).toBe(seedHex);
    });
  });

  // ─── getDecryptedUsCredentials ──────────────────────────────────────

  describe("getDecryptedUsCredentials()", () => {
    it("throws NotFoundException when no credentials exist", async () => {
      await expect(
        svc.getDecryptedUsCredentials("nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteUsCredentials ────────────────────────────────────────────

  describe("deleteUsCredentials()", () => {
    it("deletes credentials from DB", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-del",
        keyId: "key-del",
        secretKey: seedHex,
      });

      await svc.deleteUsCredentials("user-del");
      expect(prisma.polymarketUsCredential.delete).toHaveBeenCalledWith({
        where: { userId: "user-del" },
      });
    });

    it("throws when credentials do not exist", async () => {
      await expect(svc.deleteUsCredentials("nonexistent")).rejects.toThrow();
    });
  });

  // ─── signRequest ────────────────────────────────────────────────────

  describe("signRequest()", () => {
    it("returns all three Polymarket US auth headers", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-sign",
        keyId: "key-sign",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest("user-sign", "GET", "/v1/markets");

      expect(headers).toHaveProperty("X-PM-Key-Id");
      expect(headers).toHaveProperty("X-PM-Timestamp");
      expect(headers).toHaveProperty("X-PM-Signature");
    });

    it("X-PM-Key-Id matches the stored keyId", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-kid",
        keyId: "my-key-id",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(
        "user-kid",
        "POST",
        "/v1/orders",
        '{"side":"buy"}',
      );

      expect(headers["X-PM-Key-Id"]).toBe("my-key-id");
    });

    it("X-PM-Timestamp is a recent unix timestamp in seconds", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-ts",
        keyId: "key-ts",
        secretKey: seedHex,
      });

      const before = Math.floor(Date.now() / 1000);
      const headers = await svc.signRequest("user-ts", "GET", "/v1/markets");
      const after = Math.floor(Date.now() / 1000);

      const ts = parseInt(headers["X-PM-Timestamp"], 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("produces a valid Ed25519 signature verifiable with the public key", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-verify",
        keyId: "key-verify",
        secretKey: seedHex,
      });

      const method = "POST";
      const path = "/v1/orders";
      const body = '{"slug":"PRES-2028","side":"buy","qty":10}';

      const headers = await svc.signRequest("user-verify", method, path, body);

      const message = `${headers["X-PM-Timestamp"]}${method}${path}${body}`;
      const sig = Buffer.from(headers["X-PM-Signature"], "base64");

      const valid = crypto.verify(null, Buffer.from(message), publicKey, sig);
      expect(valid).toBe(true);
    });

    it("uppercases the HTTP method in the signed message", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-case",
        keyId: "key-case",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest("user-case", "get", "/v1/markets");

      const message = `${headers["X-PM-Timestamp"]}GET/v1/markets`;
      const sig = Buffer.from(headers["X-PM-Signature"], "base64");
      const valid = crypto.verify(null, Buffer.from(message), publicKey, sig);
      expect(valid).toBe(true);
    });

    it("handles empty body (treated as empty string)", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-nobody",
        keyId: "key-nobody",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(
        "user-nobody",
        "DELETE",
        "/v1/orders/abc",
      );

      const message = `${headers["X-PM-Timestamp"]}DELETE/v1/orders/abc`;
      const sig = Buffer.from(headers["X-PM-Signature"], "base64");
      const valid = crypto.verify(null, Buffer.from(message), publicKey, sig);
      expect(valid).toBe(true);
    });

    it("throws NotFoundException when user has no credentials", async () => {
      await expect(
        svc.signRequest("no-user", "GET", "/v1/markets"),
      ).rejects.toThrow(NotFoundException);
    });

    it("zeroes the decrypted secret key buffer after signing", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: "user-zero",
        keyId: "key-zero",
        secretKey: seedHex,
      });

      const decryptSpy = vi.spyOn(encryption, "decryptWithMasterKey");
      await svc.signRequest("user-zero", "GET", "/v1/markets");

      const returnedBuf = decryptSpy.mock.results[0]?.value as Buffer;
      expect(returnedBuf.every((b) => b === 0)).toBe(true);
    });

    it("zeroes the secret key even if signing throws", async () => {
      await svc.importUsCredentials({
        userId: "user-throw",
        keyId: "key-throw",
        secretKey: "ab".repeat(8),
      });

      const decryptSpy = vi.spyOn(encryption, "decryptWithMasterKey");

      await expect(
        svc.signRequest("user-throw", "GET", "/v1/markets"),
      ).rejects.toThrow();

      const returnedBuf = decryptSpy.mock.results[0]?.value as Buffer;
      expect(returnedBuf.every((b) => b === 0)).toBe(true);
    });
  });
});
