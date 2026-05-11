import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

const IV_LEN = 12; // 96-bit IV for GCM
const TAG_LEN = 16; // 128-bit auth tag

/** Bytes type compatible with Prisma 7 Bytes fields */
type PrismaBytes = Uint8Array<ArrayBuffer>;

export interface EncryptedField {
  ciphertext: PrismaBytes;
  iv: PrismaBytes;
  tag: PrismaBytes;
}

export type AesGcmAad = Buffer | Uint8Array | string;

export interface AesGcmOptions {
  aad?: AesGcmAad;
  allowLegacyNoAadFallback?: boolean;
}

/** Convert any buffer-like to Prisma-compatible Uint8Array<ArrayBuffer> */
function toBytes(buf: Buffer | Uint8Array): PrismaBytes {
  // new Uint8Array(buf) copies into a plain ArrayBuffer
  return new Uint8Array(buf);
}

function parseKekHex(hex: string | undefined, label: string): Buffer {
  if (!hex || hex.length !== 64) {
    throw new Error(`${label} must be a 64-char hex string (32 bytes)`);
  }
  return Buffer.from(hex, "hex");
}

function aadToBuffer(aad: AesGcmAad | undefined): Buffer | undefined {
  if (aad === undefined) return undefined;
  return typeof aad === "string" ? Buffer.from(aad, "utf8") : Buffer.from(aad);
}

function setCipherAad(
  cipher: crypto.CipherGCM | crypto.DecipherGCM,
  aad: AesGcmAad | undefined,
): void {
  const aadBuf = aadToBuffer(aad);
  if (aadBuf) {
    cipher.setAAD(aadBuf);
  }
}

/**
 * Check whether an error is specifically a GCM auth-tag mismatch from the
 * Node.js `crypto` module.  `decipher.final()` on an invalid GCM tag throws
 * with message "Unsupported state or unable to authenticate data" and code
 * `ERR_OSSL_UNSUPPORTED` (OpenSSL 3.x) or `ERR_CRYPTO_OPERATION_FAILED`
 * (some Node.js versions on OpenSSL 1.1.x).
 *
 * We must NOT fall back silently on other exceptions (wrong key length,
 * buffer allocation failures, programming errors, etc.) because that would
 * mask real breakages and unintentionally downgrade integrity checks for
 * legacy rows.
 */
function isAuthTagMismatchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.includes("unable to authenticate data")) return true;
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ERR_CRYPTO_OPERATION_FAILED") return true;
  if (code === "ERR_OSSL_UNSUPPORTED") {
    return (
      err.message.includes("unable to authenticate data") ||
      err.message.includes("bad decrypt")
    );
  }
  return false;
}

/**
 * Envelope encryption for Polymarket credentials.
 *
 * Architecture:
 *   KEK (32 bytes) — stored in MASTER_ENCRYPTION_KEY env var in dev,
 *                     AWS Secrets Manager in production.
 *   DEK (32 bytes) — generated fresh per user, encrypted with KEK.
 *   Fields          — each encrypted separately with the DEK (fresh IV per field).
 *
 * Format: AES-256-GCM, 12-byte IV, 16-byte auth tag stored separately.
 * Key material MUST NEVER be logged.
 *
 * KEK Rotation:
 *   - MASTER_ENCRYPTION_KEY is the current KEK (used for all new encryption)
 *   - MASTER_ENCRYPTION_KEY_PREVIOUS (optional) is the previous KEK (decrypt-only, grace period)
 *   - MASTER_ENCRYPTION_KEY_VERSION (int) tracks the current version number
 *   - Each UserCredential row stores kekVersion so we know which KEK encrypted its DEK
 *   - rotateUserDek() re-encrypts a single user's DEK from previous → current KEK
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly kek: Buffer;
  private readonly kekPrevious: Buffer | null;
  readonly currentKekVersion: number;

  constructor(private readonly config: ConfigService) {
    this.kek = parseKekHex(
      this.config.get<string>("MASTER_ENCRYPTION_KEY"),
      "MASTER_ENCRYPTION_KEY",
    );

    // Previous KEK is optional — only present during rotation grace period
    const prevHex = this.config.get<string>("MASTER_ENCRYPTION_KEY_PREVIOUS");
    this.kekPrevious =
      prevHex && prevHex.length === 64 ? Buffer.from(prevHex, "hex") : null;

    this.currentKekVersion = Number(
      this.config.get<string>("MASTER_ENCRYPTION_KEY_VERSION") ?? "1",
    );

    if (this.kekPrevious) {
      this.logger.log(
        `KEK rotation active: current version=${this.currentKekVersion}, previous KEK loaded`,
      );
    }
  }

  // ─── KEK resolution ───────────────────────────────────────────────────────

  /**
   * Resolve the KEK for a given version.
   * - currentKekVersion → current KEK
   * - currentKekVersion - 1 → previous KEK (if available)
   * - anything else → error
   */
  private resolveKek(kekVersion: number): Buffer {
    if (kekVersion === this.currentKekVersion) {
      return this.kek;
    }
    if (kekVersion === this.currentKekVersion - 1 && this.kekPrevious) {
      return this.kekPrevious;
    }
    throw new Error(
      `No KEK available for version ${kekVersion} (current=${this.currentKekVersion})`,
    );
  }

  // ─── DEK lifecycle ────────────────────────────────────────────────────────

  /**
   * Generate a new DEK and return it plain (for encrypting fields)
   * alongside its encrypted form (for storage).
   * Encrypted DEK = ciphertext + tag concatenated.
   * Always uses the current KEK version.
   */
  generateDek(): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  };
  generateDek(options: AesGcmOptions): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  };
  generateDek(options?: AesGcmOptions): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    const dek = crypto.randomBytes(32);
    const wrapped = this.wrapDekWithKek(dek, this.kek, options?.aad);
    return {
      dek,
      ...wrapped,
      kekVersion: this.currentKekVersion,
    };
  }

  wrapDek(
    dek: Buffer,
    options?: AesGcmOptions,
  ): {
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    return {
      ...this.wrapDekWithKek(dek, this.kek, options?.aad),
      kekVersion: this.currentKekVersion,
    };
  }

  private wrapDekWithKek(
    dek: Buffer,
    kek: Buffer,
    aad: AesGcmAad | undefined,
  ): {
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
  } {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
    setCipherAad(cipher, aad);
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      encryptedDek: toBytes(Buffer.concat([ct, tag])),
      dekIv: toBytes(iv),
    };
  }

  /**
   * Decrypt a stored DEK using the appropriate KEK version.
   */
  decryptDek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    kekVersion?: number,
    options?: AesGcmOptions,
  ): Buffer {
    const kek = this.resolveKek(kekVersion ?? this.currentKekVersion);
    try {
      return this.decryptDekWithKek(
        encryptedDekRaw,
        dekIvRaw,
        kek,
        options?.aad,
      );
    } catch (err) {
      if (
        options?.aad &&
        options.allowLegacyNoAadFallback &&
        isAuthTagMismatchError(err)
      ) {
        return this.decryptDekWithKek(
          encryptedDekRaw,
          dekIvRaw,
          kek,
          undefined,
        );
      }
      throw err;
    }
  }

  private decryptDekWithKek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    kek: Buffer,
    aad: AesGcmAad | undefined,
  ): Buffer {
    const encryptedDek = Buffer.from(encryptedDekRaw);
    const iv = Buffer.from(dekIvRaw);
    const tag = encryptedDek.subarray(encryptedDek.length - TAG_LEN);
    const ct = encryptedDek.subarray(0, encryptedDek.length - TAG_LEN);
    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv, {
      authTagLength: TAG_LEN,
    });
    setCipherAad(decipher, aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  /**
   * Re-encrypt a DEK from its current KEK version to the current KEK.
   * Returns the new encrypted DEK, IV, and kekVersion.
   * Used during KEK rotation to migrate credentials.
   */
  rotateUserDek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    oldKekVersion: number,
    options?: AesGcmOptions,
  ): {
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    if (oldKekVersion === this.currentKekVersion) {
      throw new Error("DEK is already on the current KEK version");
    }

    // Decrypt with old KEK
    const dek = this.decryptDek(
      encryptedDekRaw,
      dekIvRaw,
      oldKekVersion,
      options,
    );

    try {
      // Re-encrypt with current KEK
      return this.wrapDek(dek, options);
    } finally {
      dek.fill(0);
    }
  }

  /** Check if a previous KEK is loaded (rotation in progress). */
  get isRotationActive(): boolean {
    return this.kekPrevious !== null;
  }

  // ─── Field encryption ─────────────────────────────────────────────────────

  encryptField(
    plaintext: string,
    dek: Buffer,
    options?: AesGcmOptions,
  ): EncryptedField {
    const plain = Buffer.from(plaintext, "utf8");
    try {
      return this.encryptFieldBytes(plain, dek, options);
    } finally {
      plain.fill(0);
    }
  }

  encryptFieldBytes(
    plaintext: Buffer,
    dek: Buffer,
    options?: AesGcmOptions,
  ): EncryptedField {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
    setCipherAad(cipher, options?.aad);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: toBytes(ciphertext),
      iv: toBytes(iv),
      tag: toBytes(tag),
    };
  }

  /**
   * Decrypt a field and return as Buffer so callers can .fill(0) when done.
   * Avoids materializing secrets as immutable JS strings in memory.
   */
  decryptField(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
    options?: AesGcmOptions,
  ): Buffer {
    try {
      return this.decryptFieldWithAad(ctRaw, ivRaw, tagRaw, dek, options?.aad);
    } catch (err) {
      if (
        options?.aad &&
        options.allowLegacyNoAadFallback &&
        isAuthTagMismatchError(err)
      ) {
        return this.decryptFieldWithAad(ctRaw, ivRaw, tagRaw, dek, undefined);
      }
      throw err;
    }
  }

  private decryptFieldWithAad(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
    aad: AesGcmAad | undefined,
  ): Buffer {
    const ct = Buffer.from(ctRaw);
    const iv = Buffer.from(ivRaw);
    const tag = Buffer.from(tagRaw);
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv, {
      authTagLength: TAG_LEN,
    });
    setCipherAad(decipher, aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  decryptFieldBytes(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
    options?: AesGcmOptions,
  ): Buffer {
    return this.decryptField(ctRaw, ivRaw, tagRaw, dek, options);
  }
}
