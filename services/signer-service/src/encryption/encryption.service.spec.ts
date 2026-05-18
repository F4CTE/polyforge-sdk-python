import { createRequire } from "node:module";
import { describe, it, expect, vi } from "vitest";
import { EncryptionService } from "./encryption.service";
import { NativeEncryptionService } from "./native-encryption.service";
import {
  credentialDekAad,
  credentialFieldAad,
} from "../credentials/credential-aad";

const _require = createRequire(__filename);

// 64 hex chars = 32 bytes (valid KEK)
const TEST_KEK = "a".repeat(64);
const TEST_KEK_V2 = "b".repeat(64);

function makeService(opts?: {
  kek?: string;
  kekPrevious?: string;
  kekVersion?: string;
}): EncryptionService {
  const { kek = TEST_KEK, kekPrevious, kekVersion } = opts ?? {};
  const config = {
    get: (key: string) => {
      if (key === "MASTER_ENCRYPTION_KEY") return kek;
      if (key === "MASTER_ENCRYPTION_KEY_PREVIOUS") return kekPrevious;
      if (key === "MASTER_ENCRYPTION_KEY_VERSION") return kekVersion;
      return undefined;
    },
  } as any;
  return new EncryptionService(config);
}

function makeNativeService(opts?: {
  kek?: string;
  kekPrevious?: string;
  kekVersion?: string;
}): NativeEncryptionService {
  const { kek = TEST_KEK, kekPrevious, kekVersion } = opts ?? {};
  const config = {
    get: (key: string) => {
      if (key === "MASTER_ENCRYPTION_KEY") return kek;
      if (key === "MASTER_ENCRYPTION_KEY_PREVIOUS") return kekPrevious;
      if (key === "MASTER_ENCRYPTION_KEY_VERSION") return kekVersion;
      return undefined;
    },
  } as any;
  return new NativeEncryptionService(config);
}

describe("EncryptionService", () => {
  // ── Construction ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("throws when MASTER_ENCRYPTION_KEY is missing", () => {
      const config = { get: () => undefined } as any;
      expect(() => new EncryptionService(config)).toThrow(
        "MASTER_ENCRYPTION_KEY",
      );
    });

    it("throws when MASTER_ENCRYPTION_KEY is too short", () => {
      const config = { get: () => "abc123" } as any;
      expect(() => new EncryptionService(config)).toThrow(
        "MASTER_ENCRYPTION_KEY",
      );
    });

    it("throws when MASTER_ENCRYPTION_KEY is 63 chars (not 64)", () => {
      const config = { get: () => "a".repeat(63) } as any;
      expect(() => new EncryptionService(config)).toThrow(
        "MASTER_ENCRYPTION_KEY",
      );
    });

    it("constructs successfully with a 64-char hex key", () => {
      expect(() => makeService()).not.toThrow();
    });

    it("defaults kekVersion to 1 when not set", () => {
      const svc = makeService();
      expect(svc.currentKekVersion).toBe(1);
    });

    it("reads kekVersion from env", () => {
      const svc = makeService({ kekVersion: "3" });
      expect(svc.currentKekVersion).toBe(3);
    });

    it("loads previous KEK when provided", () => {
      const svc = makeService({ kekPrevious: TEST_KEK_V2, kekVersion: "2" });
      expect(svc.isRotationActive).toBe(true);
    });

    it("isRotationActive is false without previous KEK", () => {
      const svc = makeService();
      expect(svc.isRotationActive).toBe(false);
    });
  });

  // ── DEK lifecycle ─────────────────────────────────────────────────────────

  describe("generateDek()", () => {
    it("returns a 32-byte DEK buffer", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      expect(dek).toBeInstanceOf(Buffer);
      expect(dek.length).toBe(32);
    });

    it("returns encryptedDek as Uint8Array", () => {
      const svc = makeService();
      const { encryptedDek } = svc.generateDek();
      expect(encryptedDek).toBeInstanceOf(Uint8Array);
    });

    it("returns dekIv as Uint8Array of length 12 (96-bit GCM IV)", () => {
      const svc = makeService();
      const { dekIv } = svc.generateDek();
      expect(dekIv).toBeInstanceOf(Uint8Array);
      expect(dekIv.length).toBe(12);
    });

    it("generates a unique DEK on every call", () => {
      const svc = makeService();
      const { dek: d1 } = svc.generateDek();
      const { dek: d2 } = svc.generateDek();
      expect(d1.toString("hex")).not.toBe(d2.toString("hex"));
    });

    it("generates a unique IV on every call", () => {
      const svc = makeService();
      const { dekIv: iv1 } = svc.generateDek();
      const { dekIv: iv2 } = svc.generateDek();
      expect(Buffer.from(iv1).toString("hex")).not.toBe(
        Buffer.from(iv2).toString("hex"),
      );
    });

    it("encrypted DEK length = 32 (ciphertext) + 16 (tag) = 48 bytes", () => {
      const svc = makeService();
      const { encryptedDek } = svc.generateDek();
      expect(encryptedDek.length).toBe(48);
    });

    it("returns the current KEK version", () => {
      const svc = makeService({ kekVersion: "5" });
      const { kekVersion } = svc.generateDek();
      expect(kekVersion).toBe(5);
    });
  });

  describe("decryptDek()", () => {
    it("round-trips the DEK: decrypt(encrypt(dek)) === dek", () => {
      const svc = makeService();
      const { dek, encryptedDek, dekIv, kekVersion } = svc.generateDek();
      const recovered = svc.decryptDek(encryptedDek, dekIv, kekVersion);
      expect(recovered.toString("hex")).toBe(dek.toString("hex"));
    });

    it("throws when encryptedDek is tampered (GCM auth tag fails)", () => {
      const svc = makeService();
      const { encryptedDek, dekIv, kekVersion } = svc.generateDek();
      const tampered = new Uint8Array(encryptedDek);
      tampered[0] ^= 0xff;
      expect(() => svc.decryptDek(tampered, dekIv, kekVersion)).toThrow();
    });

    it("throws when dekIv is wrong", () => {
      const svc = makeService();
      const { encryptedDek, kekVersion } = svc.generateDek();
      const wrongIv = new Uint8Array(12).fill(0);
      expect(() => svc.decryptDek(encryptedDek, wrongIv, kekVersion)).toThrow();
    });

    it("binds encrypted DEKs to AAD", () => {
      const svc = makeService();
      const aad = credentialDekAad("user-1");
      const wrongAad = credentialDekAad("user-2");
      const { dek, encryptedDek, dekIv, kekVersion } = svc.generateDek({
        aad,
      });

      expect(
        svc
          .decryptDek(encryptedDek, dekIv, kekVersion, { aad })
          .toString("hex"),
      ).toBe(dek.toString("hex"));
      expect(() =>
        svc.decryptDek(encryptedDek, dekIv, kekVersion, { aad: wrongAad }),
      ).toThrow();
      expect(() => svc.decryptDek(encryptedDek, dekIv, kekVersion)).toThrow();
    });

    it("can explicitly decrypt legacy no-AAD DEKs through fallback", () => {
      const svc = makeService();
      const { dek, encryptedDek, dekIv, kekVersion } = svc.generateDek();

      expect(
        svc
          .decryptDek(encryptedDek, dekIv, kekVersion, {
            aad: credentialDekAad("user-1"),
            allowLegacyNoAadFallback: true,
          })
          .toString("hex"),
      ).toBe(dek.toString("hex"));
    });

    it("throws when decrypting with a different KEK", () => {
      const svc1 = makeService({ kek: "a".repeat(64) });
      const svc2 = makeService({ kek: "b".repeat(64) });
      const { encryptedDek, dekIv, kekVersion } = svc1.generateDek();
      expect(() => svc2.decryptDek(encryptedDek, dekIv, kekVersion)).toThrow();
    });

    it("decrypts with previous KEK when version matches", () => {
      // Encrypt with v1 KEK
      const svcV1 = makeService({ kek: TEST_KEK, kekVersion: "1" });
      const { dek, encryptedDek, dekIv } = svcV1.generateDek();

      // Create v2 service with v1 as previous
      const svcV2 = makeService({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });
      const recovered = svcV2.decryptDek(encryptedDek, dekIv, 1);
      expect(recovered.toString("hex")).toBe(dek.toString("hex"));
    });

    it("throws for unknown KEK version", () => {
      const svc = makeService({ kekVersion: "3" });
      const { encryptedDek, dekIv } = svc.generateDek();
      expect(() => svc.decryptDek(encryptedDek, dekIv, 1)).toThrow(
        "No KEK available for version 1",
      );
    });
  });

  // ── KEK Rotation ──────────────────────────────────────────────────────────

  describe("rotateUserDek()", () => {
    it("re-encrypts DEK from old KEK to new KEK", () => {
      // Encrypt with v1
      const svcV1 = makeService({ kek: TEST_KEK, kekVersion: "1" });
      const { dek: originalDek, encryptedDek, dekIv } = svcV1.generateDek();

      // Rotate with v2 service (v1 as previous)
      const svcV2 = makeService({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });
      const rotated = svcV2.rotateUserDek(encryptedDek, dekIv, 1);

      expect(rotated.kekVersion).toBe(2);

      // Verify the rotated DEK decrypts to the same original DEK
      const recoveredDek = svcV2.decryptDek(
        rotated.encryptedDek,
        rotated.dekIv,
        2,
      );
      expect(recoveredDek.toString("hex")).toBe(originalDek.toString("hex"));
    });

    it("converts a legacy no-AAD DEK to row-bound AAD during rotation", () => {
      const svcV1 = makeService({ kek: TEST_KEK, kekVersion: "1" });
      const { dek: originalDek, encryptedDek, dekIv } = svcV1.generateDek();
      const aad = credentialDekAad("user-1");

      const svcV2 = makeService({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });
      const rotated = svcV2.rotateUserDek(encryptedDek, dekIv, 1, {
        aad,
        allowLegacyNoAadFallback: true,
      });

      expect(
        svcV2
          .decryptDek(rotated.encryptedDek, rotated.dekIv, 2, { aad })
          .toString("hex"),
      ).toBe(originalDek.toString("hex"));
      expect(() =>
        svcV2.decryptDek(rotated.encryptedDek, rotated.dekIv, 2),
      ).toThrow();
      expect(() =>
        svcV2.decryptDek(rotated.encryptedDek, rotated.dekIv, 2, {
          aad: credentialDekAad("user-2"),
          allowLegacyNoAadFallback: true,
        }),
      ).toThrow();
    });

    it("throws when DEK is already on current version", () => {
      const svc = makeService({ kekVersion: "2" });
      const { encryptedDek, dekIv } = svc.generateDek();
      expect(() => svc.rotateUserDek(encryptedDek, dekIv, 2)).toThrow(
        "already on the current KEK version",
      );
    });

    it("full roundtrip: encrypt fields → rotate KEK → decrypt fields", () => {
      // Step 1: Encrypt with v1
      const svcV1 = makeService({ kek: TEST_KEK, kekVersion: "1" });
      const { dek, encryptedDek, dekIv } = svcV1.generateDek();
      const field = svcV1.encryptField("my-secret-key", dek);
      dek.fill(0); // Simulate zeroing

      // Step 2: Rotate DEK to v2
      const svcV2 = makeService({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });
      const rotated = svcV2.rotateUserDek(encryptedDek, dekIv, 1);

      // Step 3: Decrypt field using rotated DEK (now on v2)
      const recoveredDek = svcV2.decryptDek(
        rotated.encryptedDek,
        rotated.dekIv,
        2,
      );
      const plaintext = svcV2.decryptField(
        field.ciphertext,
        field.iv,
        field.tag,
        recoveredDek,
      );
      expect(Buffer.isBuffer(plaintext)).toBe(true);
      expect(plaintext.toString("utf8")).toBe("my-secret-key");
    });
  });

  // ── Field encryption ──────────────────────────────────────────────────────

  describe("encryptField()", () => {
    it("returns ciphertext, iv, and tag all as Uint8Array", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("hello", dek);
      expect(enc.ciphertext).toBeInstanceOf(Uint8Array);
      expect(enc.iv).toBeInstanceOf(Uint8Array);
      expect(enc.tag).toBeInstanceOf(Uint8Array);
    });

    it("iv is 12 bytes", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("test", dek);
      expect(enc.iv.length).toBe(12);
    });

    it("tag is 16 bytes", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("test", dek);
      expect(enc.tag.length).toBe(16);
    });

    it("uses a fresh IV per call (no IV reuse)", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc1 = svc.encryptField("same plaintext", dek);
      const enc2 = svc.encryptField("same plaintext", dek);
      expect(Buffer.from(enc1.iv).toString("hex")).not.toBe(
        Buffer.from(enc2.iv).toString("hex"),
      );
    });

    it("produces different ciphertexts for different IVs (probabilistic encryption)", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc1 = svc.encryptField("same", dek);
      const enc2 = svc.encryptField("same", dek);
      expect(Buffer.from(enc1.ciphertext).toString("hex")).not.toBe(
        Buffer.from(enc2.ciphertext).toString("hex"),
      );
    });

    it("encrypts a long private key (66 chars)", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const pk = "0x" + "f".repeat(64);
      expect(() => svc.encryptField(pk, dek)).not.toThrow();
    });
  });

  describe("decryptField()", () => {
    it("round-trips a short string", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("hello", dek);
      expect(
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek).toString("utf8"),
      ).toBe("hello");
    });

    it("round-trips a Polymarket private key (0x + 64 hex chars)", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const pk = "0x" + "a1b2c3d4".repeat(8);
      const enc = svc.encryptField(pk, dek);
      expect(
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek).toString("utf8"),
      ).toBe(pk);
    });

    it("round-trips an empty string", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("", dek);
      expect(
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek).toString("utf8"),
      ).toBe("");
    });

    it("throws when ciphertext is tampered", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("secret", dek);
      const tampered = new Uint8Array(enc.ciphertext);
      tampered[0] ^= 0xff;
      expect(() => svc.decryptField(tampered, enc.iv, enc.tag, dek)).toThrow();
    });

    it("throws when auth tag is tampered", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("secret", dek);
      const tampered = new Uint8Array(enc.tag);
      tampered[0] ^= 0xff;
      expect(() =>
        svc.decryptField(enc.ciphertext, enc.iv, tampered, dek),
      ).toThrow();
    });

    it("throws when IV is wrong", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("secret", dek);
      const wrongIv = new Uint8Array(12).fill(0x42);
      expect(() =>
        svc.decryptField(enc.ciphertext, wrongIv, enc.tag, dek),
      ).toThrow();
    });

    it("throws when decrypting with a different DEK", () => {
      const svc = makeService();
      const { dek: dek1 } = svc.generateDek();
      const { dek: dek2 } = svc.generateDek();
      const enc = svc.encryptField("secret", dek1);
      expect(() =>
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek2),
      ).toThrow();
    });

    it("binds fields to field-level AAD", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const aad = credentialFieldAad("user-1", "apiSecret");
      const enc = svc.encryptField("secret", dek, { aad });

      expect(
        svc
          .decryptField(enc.ciphertext, enc.iv, enc.tag, dek, { aad })
          .toString("utf8"),
      ).toBe("secret");
      expect(() =>
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek, {
          aad: credentialFieldAad("user-1", "apiKey"),
        }),
      ).toThrow();
      expect(() =>
        svc.decryptField(enc.ciphertext, enc.iv, enc.tag, dek),
      ).toThrow();
    });

    it("can explicitly decrypt legacy no-AAD fields through fallback", () => {
      const svc = makeService();
      const { dek } = svc.generateDek();
      const enc = svc.encryptField("legacy-secret", dek);

      expect(
        svc
          .decryptField(enc.ciphertext, enc.iv, enc.tag, dek, {
            aad: credentialFieldAad("user-1", "apiSecret"),
            allowLegacyNoAadFallback: true,
          })
          .toString("utf8"),
      ).toBe("legacy-secret");
    });
  });

  // ── Full envelope roundtrip ────────────────────────────────────────────────

  describe("full envelope roundtrip", () => {
    it("stores DEK encrypted, retrieves it, and decrypts fields correctly", () => {
      const svc = makeService();

      // 1. Generate fresh DEK
      const { dek, encryptedDek, dekIv, kekVersion } = svc.generateDek();

      // 2. Encrypt multiple credential fields with the DEK
      const privateKey = "0x" + "f".repeat(64);
      const apiKey = "test-api-key";
      const apiSecret = "test-api-secret-long";
      const apiPassphrase = "test-passphrase";

      const pkEnc = svc.encryptField(privateKey, dek);
      const akEnc = svc.encryptField(apiKey, dek);
      const asEnc = svc.encryptField(apiSecret, dek);
      const apEnc = svc.encryptField(apiPassphrase, dek);

      // 3. Simulate storage: keep encryptedDek + iv + all field blobs
      // 4. Simulate retrieval: decrypt DEK first, then decrypt fields
      const recoveredDek = svc.decryptDek(encryptedDek, dekIv, kekVersion);

      expect(
        svc
          .decryptField(pkEnc.ciphertext, pkEnc.iv, pkEnc.tag, recoveredDek)
          .toString("utf8"),
      ).toBe(privateKey);
      expect(
        svc
          .decryptField(akEnc.ciphertext, akEnc.iv, akEnc.tag, recoveredDek)
          .toString("utf8"),
      ).toBe(apiKey);
      expect(
        svc
          .decryptField(asEnc.ciphertext, asEnc.iv, asEnc.tag, recoveredDek)
          .toString("utf8"),
      ).toBe(apiSecret);
      expect(
        svc
          .decryptField(apEnc.ciphertext, apEnc.iv, apEnc.tag, recoveredDek)
          .toString("utf8"),
      ).toBe(apiPassphrase);
    });
  });
});

describe("NativeEncryptionService", () => {
  it("binds native DEKs and fields to AAD", () => {
    const svc = makeNativeService();
    const dekAad = credentialDekAad("native-user");
    const fieldAad = credentialFieldAad("native-user", "apiSecret");
    const { dek, encryptedDek, dekIv, kekVersion } = svc.generateDek({
      aad: dekAad,
    });
    const field = svc.encryptField("native-secret", dek, { aad: fieldAad });

    expect(
      svc
        .decryptDek(encryptedDek, dekIv, kekVersion, { aad: dekAad })
        .toString("hex"),
    ).toBe(dek.toString("hex"));
    expect(
      svc
        .decryptField(field.ciphertext, field.iv, field.tag, dek, {
          aad: fieldAad,
        })
        .toString("utf8"),
    ).toBe("native-secret");
    expect(() =>
      svc.decryptDek(encryptedDek, dekIv, kekVersion, {
        aad: credentialDekAad("other-user"),
      }),
    ).toThrow();
    expect(() =>
      svc.decryptField(field.ciphertext, field.iv, field.tag, dek, {
        aad: credentialFieldAad("native-user", "apiKey"),
      }),
    ).toThrow();
  });

  it("converts legacy hex-string DEKs returned from unwrap into raw 32-byte keys", () => {
    const svc = makeNativeService();
    const nativeCrypto = _require("@polyforge/crypto-native");
    const legacyDekHex = "11".repeat(32);
    const wrappedJson = nativeCrypto.wrapDek(legacyDekHex, TEST_KEK);
    const parsed = JSON.parse(wrappedJson);

    const recovered = svc.decryptDek(
      Buffer.from(parsed.ciphertext + parsed.tag, "hex"),
      Buffer.from(parsed.iv, "hex"),
      1,
    );

    expect(recovered).toBeInstanceOf(Buffer);
    expect(recovered.length).toBe(32);
    expect(recovered.toString("hex")).toBe(legacyDekHex);
  });

  describe("encryptFieldBytes()", () => {
    it("round-trips high-bit seed bytes without stringifying the plaintext buffer", () => {
      const svc = makeNativeService();
      const { dek } = svc.generateDek();
      const seed = Buffer.from([
        0x80, 0x81, 0xfe, 0xff, 0x00, 0x01, 0x7f, 0x42, 0x99, 0xaa, 0xbb, 0xcc,
        0xdd, 0xee, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x71, 0x72, 0x73,
        0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b,
      ]);
      const expectedSeed = Buffer.from(seed);
      const toStringSpy = vi.spyOn(seed, "toString");

      const enc = svc.encryptFieldBytes(seed, dek);
      const recovered = svc.decryptFieldBytes(
        enc.ciphertext,
        enc.iv,
        enc.tag,
        dek,
      );

      expect(toStringSpy).not.toHaveBeenCalled();
      expect(recovered).toEqual(expectedSeed);
    });
  });
});
