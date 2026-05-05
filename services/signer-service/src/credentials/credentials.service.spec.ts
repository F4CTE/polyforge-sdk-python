import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CredentialsService } from "./credentials.service";
import { EncryptionService } from "../encryption/encryption.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_KEK = "a".repeat(64);

function makeEncryption(): EncryptionService {
  const configMap: Record<string, string> = {
    MASTER_ENCRYPTION_KEY: TEST_KEK,
    MASTER_ENCRYPTION_KEY_VERSION: "1",
  };
  const config = {
    get: (key: string) => configMap[key],
  } as any as ConfigService;
  return new EncryptionService(config);
}

function makePrisma() {
  return {
    userCredential: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

const VALID_PK = "0x" + "f".repeat(64);
const VALID_PK_BYTES = Buffer.from(VALID_PK, "utf8");

const VALID_DTO = {
  userId: "user-1",
  get privateKey() {
    return Array.from(VALID_PK_BYTES);
  },
  apiKey: "ak-value",
  apiSecret: "as-value",
  apiPassphrase: "ap-value",
  safeAddress: undefined,
  sigType: 0 as const,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("CredentialsService", () => {
  let svc: CredentialsService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: EncryptionService;

  beforeEach(() => {
    prisma = makePrisma();
    encryption = makeEncryption();
    svc = new CredentialsService(prisma, encryption);
  });

  // ── importCredentials ─────────────────────────────────────────────────────

  describe("importCredentials()", () => {
    it("rejects private key strings at the signer boundary", async () => {
      await expect(
        svc.importCredentials({ ...VALID_DTO, privateKey: VALID_PK } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userCredential.upsert).not.toHaveBeenCalled();
    });

    it("encrypts private key bytes without sending them through string encryption and then zeroes them", async () => {
      const privateKey = Buffer.from(VALID_PK_BYTES);
      const encryptFieldSpy = vi.spyOn(encryption, "encryptField");
      const encryptFieldBytesSpy = vi.spyOn(encryption, "encryptFieldBytes");

      await svc.importCredentials({
        ...VALID_DTO,
        privateKey,
      } as any);

      expect(encryptFieldBytesSpy).toHaveBeenCalledWith(privateKey, expect.any(Buffer));
      expect(encryptFieldSpy.mock.calls.map(([plaintext]) => plaintext)).not.toContain(
        privateKey,
      );
      expect(encryptFieldSpy.mock.calls.map(([plaintext]) => plaintext)).not.toContain(
        VALID_PK,
      );
      expect(privateKey.every((b) => b === 0)).toBe(true);
    });

    it("zeroes the original JSON private key byte array after copying it", async () => {
      const privateKey = Array.from(VALID_PK_BYTES);

      await svc.importCredentials({
        ...VALID_DTO,
        privateKey,
      } as any);

      expect(privateKey.every((byte) => byte === 0)).toBe(true);
    });

    it("zeroes the original Uint8Array private key after copying it", async () => {
      const privateKey = new Uint8Array(VALID_PK_BYTES);

      await svc.importCredentials({
        ...VALID_DTO,
        privateKey,
      } as any);

      expect(privateKey.every((byte) => byte === 0)).toBe(true);
    });

    it("rejects a private key without 0x prefix", async () => {
      await expect(
        svc.importCredentials({
          ...VALID_DTO,
          privateKey: Array.from(Buffer.from("f".repeat(64), "utf8")),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a private key with wrong length (< 64 hex chars after 0x)", async () => {
      await expect(
        svc.importCredentials({
          ...VALID_DTO,
          privateKey: Array.from(Buffer.from("0x" + "f".repeat(63), "utf8")),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a private key with non-hex characters", async () => {
      await expect(
        svc.importCredentials({
          ...VALID_DTO,
          privateKey: Array.from(Buffer.from("0x" + "g".repeat(64), "utf8")),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts a valid 0x + 64 hex char private key", async () => {
      await expect(svc.importCredentials(VALID_DTO)).resolves.toBeUndefined();
    });

    it("calls prisma.userCredential.upsert once", async () => {
      await svc.importCredentials(VALID_DTO);
      expect(prisma.userCredential.upsert).toHaveBeenCalledOnce();
    });

    it("upserts with correct userId in where clause", async () => {
      await svc.importCredentials(VALID_DTO);
      const args = prisma.userCredential.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ userId: "user-1" });
      expect(args.create.userId).toBe("user-1");
    });

    it("stores privateKeyCt as Uint8Array (not plaintext)", async () => {
      await svc.importCredentials(VALID_DTO);
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.privateKeyCt).toBeInstanceOf(Uint8Array);
      // Must not store the raw key string
      expect(Buffer.from(create.privateKeyCt).toString()).not.toBe(VALID_PK);
    });

    it("stores privateKeyIv and privateKeyTag as Uint8Array", async () => {
      await svc.importCredentials(VALID_DTO);
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.privateKeyIv).toBeInstanceOf(Uint8Array);
      expect(create.privateKeyTag).toBeInstanceOf(Uint8Array);
    });

    it("stores encryptedDek and dekIv", async () => {
      await svc.importCredentials(VALID_DTO);
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.encryptedDek).toBeInstanceOf(Uint8Array);
      expect(create.dekIv).toBeInstanceOf(Uint8Array);
    });

    it("stores different ciphertexts for different fields (unique IVs)", async () => {
      await svc.importCredentials(VALID_DTO);
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      const pkCt = Buffer.from(create.privateKeyCt).toString("hex");
      const akCt = Buffer.from(create.apiKeyCt).toString("hex");
      expect(pkCt).not.toBe(akCt);
    });

    it("stores safeAddress as null when not provided", async () => {
      await svc.importCredentials(VALID_DTO);
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.safeAddress).toBeNull();
    });

    it("stores safeAddress when provided", async () => {
      await svc.importCredentials({ ...VALID_DTO, safeAddress: "0xSafe" });
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.safeAddress).toBe("0xSafe");
    });

    it("stores sigType correctly", async () => {
      await svc.importCredentials({ ...VALID_DTO, sigType: 1 });
      const { create } = prisma.userCredential.upsert.mock.calls[0][0];
      expect(create.sigType).toBe(1);
    });

    it("uses upsert so a second import overwrites the first", async () => {
      await svc.importCredentials(VALID_DTO);
      await svc.importCredentials({ ...VALID_DTO, apiKey: "new-key" });
      expect(prisma.userCredential.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ── deleteCredentials ─────────────────────────────────────────────────────

  describe("deleteCredentials()", () => {
    it("throws NotFoundException when no credentials exist", async () => {
      prisma.userCredential.findUnique.mockResolvedValue(null);
      await expect(svc.deleteCredentials("user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("calls prisma.userCredential.delete when credentials exist", async () => {
      prisma.userCredential.findUnique.mockResolvedValue({ userId: "user-1" });
      await svc.deleteCredentials("user-1");
      expect(prisma.userCredential.delete).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("does not call delete when findUnique returns null", async () => {
      prisma.userCredential.findUnique.mockResolvedValue(null);
      await expect(svc.deleteCredentials("user-1")).rejects.toThrow();
      expect(prisma.userCredential.delete).not.toHaveBeenCalled();
    });
  });

  // ── getDecryptedCredentials — full roundtrip ──────────────────────────────

  describe("getDecryptedCredentials() — encrypt → store → retrieve → decrypt roundtrip", () => {
    it("throws NotFoundException when no credentials exist", async () => {
      prisma.userCredential.findUnique.mockResolvedValue(null);
      await expect(
        svc.getDecryptedCredentials("missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns original private key after store and retrieve", async () => {
      let storedRow: Record<string, unknown>;

      prisma.userCredential.upsert.mockImplementation(
        async ({ create }: any) => {
          storedRow = create;
          return create;
        },
      );
      prisma.userCredential.findUnique.mockImplementation(
        async () => storedRow!,
      );

      await svc.importCredentials(VALID_DTO);
      const result = await svc.getDecryptedCredentials("user-1");

      expect(result.privateKey.toString("utf8")).toBe(VALID_PK);
    });

    it("returns correct apiKey, apiSecret, apiPassphrase", async () => {
      let storedRow: Record<string, unknown>;

      prisma.userCredential.upsert.mockImplementation(
        async ({ create }: any) => {
          storedRow = create;
          return create;
        },
      );
      prisma.userCredential.findUnique.mockImplementation(
        async () => storedRow!,
      );

      await svc.importCredentials(VALID_DTO);
      const result = await svc.getDecryptedCredentials("user-1");

      expect(result.apiKey.toString("utf8")).toBe("ak-value");
      expect(result.apiSecret.toString("utf8")).toBe("as-value");
      expect(result.apiPassphrase.toString("utf8")).toBe("ap-value");
    });

    it("returns correct sigType", async () => {
      let storedRow: Record<string, unknown>;

      prisma.userCredential.upsert.mockImplementation(
        async ({ create }: any) => {
          storedRow = create;
          return create;
        },
      );
      prisma.userCredential.findUnique.mockImplementation(
        async () => storedRow!,
      );

      await svc.importCredentials({ ...VALID_DTO, sigType: 2 });
      const result = await svc.getDecryptedCredentials("user-1");

      expect(result.sigType).toBe(2);
    });

    it("returns correct safeAddress", async () => {
      let storedRow: Record<string, unknown>;

      prisma.userCredential.upsert.mockImplementation(
        async ({ create }: any) => {
          storedRow = create;
          return create;
        },
      );
      prisma.userCredential.findUnique.mockImplementation(
        async () => storedRow!,
      );

      await svc.importCredentials({ ...VALID_DTO, safeAddress: "0xSafeAddr" });
      const result = await svc.getDecryptedCredentials("user-1");

      expect(result.safeAddress).toBe("0xSafeAddr");
    });

    it("two different users get independent key material", async () => {
      const rows: Record<string, Record<string, unknown>> = {};

      prisma.userCredential.upsert.mockImplementation(
        async ({ where, create }: any) => {
          rows[where.userId] = create;
          return create;
        },
      );
      prisma.userCredential.findUnique.mockImplementation(
        async ({ where }: any) => rows[where.userId] ?? null,
      );

      await svc.importCredentials({
        ...VALID_DTO,
        userId: "user-A",
        apiKey: "key-A",
      });
      await svc.importCredentials({
        ...VALID_DTO,
        userId: "user-B",
        apiKey: "key-B",
      });

      const a = await svc.getDecryptedCredentials("user-A");
      const b = await svc.getDecryptedCredentials("user-B");

      expect(a.apiKey.toString("utf8")).toBe("key-A");
      expect(b.apiKey.toString("utf8")).toBe("key-B");
    });
  });
});
