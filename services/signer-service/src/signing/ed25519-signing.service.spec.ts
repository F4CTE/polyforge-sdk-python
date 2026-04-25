import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";
import { NotFoundException } from "@nestjs/common";
import { Ed25519SigningService } from "./ed25519-signing.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEd25519Seed(): {
  seedHex: string;
  seedRaw: Buffer;
  publicKey: crypto.KeyObject;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const pkcs8Der = privateKey.export({ type: "pkcs8", format: "der" });
  const seedRaw = Buffer.from(
    (pkcs8Der as Buffer).subarray(pkcs8Der.byteLength - 32),
  );
  return { seedHex: seedRaw.toString("hex"), seedRaw, publicKey };
}

function makeMockEncryption() {
  const dekStore = new Map<
    string,
    { dek: Buffer; encDek: Buffer; dekIv: Buffer }
  >();
  const fieldStore = new Map<
    string,
    { plainBuf: Buffer; ct: Buffer; iv: Buffer; tag: Buffer }
  >();
  let callId = 0;

  return {
    generateDek() {
      const dek = crypto.randomBytes(32);
      const encDek = crypto.randomBytes(48);
      const dekIv = crypto.randomBytes(12);
      const id = `dek-${callId++}`;
      dekStore.set(id, { dek: Buffer.from(dek), encDek, dekIv });
      return {
        dek,
        encryptedDek: new Uint8Array(encDek),
        dekIv: new Uint8Array(dekIv),
        kekVersion: 1,
      };
    },

    decryptDek(
      encryptedDekRaw: Uint8Array,
      dekIvRaw: Uint8Array,
      _kekVersion?: number,
    ): Buffer {
      const encBuf = Buffer.from(encryptedDekRaw);
      for (const entry of dekStore.values()) {
        if (encBuf.equals(entry.encDek)) {
          return Buffer.from(entry.dek);
        }
      }
      throw new Error("DEK not found in mock store");
    },

    encryptField(plaintext: string, dek: Buffer) {
      const plainBuf = Buffer.from(plaintext, "binary");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
      const ct = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
      const tag = cipher.getAuthTag();
      const fid = `field-${callId++}`;
      fieldStore.set(fid, { plainBuf: Buffer.from(plainBuf), ct, iv, tag });
      return {
        ciphertext: new Uint8Array(ct),
        iv: new Uint8Array(iv),
        tag: new Uint8Array(tag),
      };
    },

    decryptField(
      ctRaw: Uint8Array,
      ivRaw: Uint8Array,
      tagRaw: Uint8Array,
      dek: Buffer,
    ): Buffer {
      const ctBuf = Buffer.from(ctRaw);
      for (const entry of fieldStore.values()) {
        if (ctBuf.equals(entry.ct)) {
          return Buffer.from(entry.plainBuf);
        }
      }
      const iv = Buffer.from(ivRaw);
      const tag = Buffer.from(tagRaw);
      const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv, {
        authTagLength: 16,
      });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ctBuf), decipher.final()]);
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

const TEST_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

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
    it("stores credentials with DEK/KEK envelope via prisma upsert", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-001",
        secretKey: seedHex,
      });

      expect(prisma.polymarketUsCredential.upsert).toHaveBeenCalledOnce();
      const call = prisma.polymarketUsCredential.upsert.mock.calls[0][0];
      expect(call.where.userId).toBe(TEST_UUID);
      expect(call.create.keyId).toBe("key-001");
      expect(call.create.encryptedDek).toBeInstanceOf(Uint8Array);
      expect(call.create.dekIv).toBeInstanceOf(Uint8Array);
      expect(call.create.kekVersion).toBe(1);
      expect(call.create.secretKeyCt).toBeInstanceOf(Uint8Array);
      expect(call.create.secretKeyIv).toBeInstanceOf(Uint8Array);
      expect(call.create.secretKeyTag).toBeInstanceOf(Uint8Array);
    });

    it("calls generateDek() for per-user key isolation", async () => {
      const genDekSpy = vi.spyOn(encryption, "generateDek");
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-dek",
        secretKey: seedHex,
      });

      expect(genDekSpy).toHaveBeenCalledOnce();
    });

    it("encrypts secretKey via encryptField with DEK (not encryptWithMasterKey)", async () => {
      const encFieldSpy = vi.spyOn(encryption, "encryptField");
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-field",
        secretKey: seedHex,
      });

      expect(encFieldSpy).toHaveBeenCalledOnce();
    });
  });

  // ─── deleteUsCredentials ────────────────────────────────────────────

  describe("deleteUsCredentials()", () => {
    it("deletes credentials from DB", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-del",
        secretKey: seedHex,
      });

      await svc.deleteUsCredentials(TEST_UUID);
      expect(prisma.polymarketUsCredential.delete).toHaveBeenCalledWith({
        where: { userId: TEST_UUID },
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
        userId: TEST_UUID,
        keyId: "key-sign",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(TEST_UUID, "GET", "/v1/markets");

      expect(headers).toHaveProperty("X-PM-Key-Id");
      expect(headers).toHaveProperty("X-PM-Timestamp");
      expect(headers).toHaveProperty("X-PM-Signature");
    });

    it("X-PM-Key-Id matches the stored keyId", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "my-key-id",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(
        TEST_UUID,
        "POST",
        "/v1/orders",
        '{"side":"buy"}',
      );

      expect(headers["X-PM-Key-Id"]).toBe("my-key-id");
    });

    it("X-PM-Timestamp is a recent unix timestamp in seconds", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-ts",
        secretKey: seedHex,
      });

      const before = Math.floor(Date.now() / 1000);
      const headers = await svc.signRequest(TEST_UUID, "GET", "/v1/markets");
      const after = Math.floor(Date.now() / 1000);

      const ts = parseInt(headers["X-PM-Timestamp"], 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("produces a valid Ed25519 signature verifiable with the public key", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-verify",
        secretKey: seedHex,
      });

      const method = "POST";
      const path = "/v1/orders";
      const body = '{"slug":"PRES-2028","side":"buy","qty":10}';

      const headers = await svc.signRequest(TEST_UUID, method, path, body);

      const message = `${headers["X-PM-Timestamp"]}${method}${path}${body}`;
      const sig = Buffer.from(headers["X-PM-Signature"], "base64");

      const valid = crypto.verify(null, Buffer.from(message), publicKey, sig);
      expect(valid).toBe(true);
    });

    it("uppercases the HTTP method in the signed message", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-case",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(TEST_UUID, "get", "/v1/markets");

      const message = `${headers["X-PM-Timestamp"]}GET/v1/markets`;
      const sig = Buffer.from(headers["X-PM-Signature"], "base64");
      const valid = crypto.verify(null, Buffer.from(message), publicKey, sig);
      expect(valid).toBe(true);
    });

    it("handles empty body (treated as empty string)", async () => {
      const { seedHex, publicKey } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-nobody",
        secretKey: seedHex,
      });

      const headers = await svc.signRequest(
        TEST_UUID,
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
        userId: TEST_UUID,
        keyId: "key-zero",
        secretKey: seedHex,
      });

      const decryptFieldSpy = vi.spyOn(encryption, "decryptField");
      await svc.signRequest(TEST_UUID, "GET", "/v1/markets");

      const returnedBuf = decryptFieldSpy.mock.results[0]?.value as Buffer;
      expect(returnedBuf.every((b) => b === 0)).toBe(true);
    });

    it("zeroes the DEK after decrypting the secret key", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-dek-zero",
        secretKey: seedHex,
      });

      const decryptDekSpy = vi.spyOn(encryption, "decryptDek");
      await svc.signRequest(TEST_UUID, "GET", "/v1/markets");

      const dekBuf = decryptDekSpy.mock.results[0]?.value as Buffer;
      expect(dekBuf.every((b) => b === 0)).toBe(true);
    });

    it("zeroes the secret key even if signing throws", async () => {
      const { seedHex } = makeEd25519Seed();
      await svc.importUsCredentials({
        userId: TEST_UUID,
        keyId: "key-throw",
        secretKey: seedHex,
      });

      const badBuf = Buffer.alloc(16, 0xab);
      const decryptFieldSpy = vi
        .spyOn(encryption, "decryptField")
        .mockReturnValueOnce(badBuf);

      await expect(
        svc.signRequest(TEST_UUID, "GET", "/v1/markets"),
      ).rejects.toThrow();

      expect(badBuf.every((b) => b === 0)).toBe(true);
    });
  });
});
