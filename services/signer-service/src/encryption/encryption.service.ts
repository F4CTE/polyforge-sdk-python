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

/** Convert any buffer-like to Prisma-compatible Uint8Array<ArrayBuffer> */
function toBytes(buf: Buffer | Uint8Array): PrismaBytes {
  // new Uint8Array(buf) copies into a plain ArrayBuffer
  return new Uint8Array(buf) as PrismaBytes;
}

function parseKekHex(hex: string | undefined, label: string): Buffer {
  if (!hex || hex.length !== 64) {
    throw new Error(`${label} must be a 64-char hex string (32 bytes)`);
  }
  return Buffer.from(hex, "hex");
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
  } {
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.kek, iv);
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      dek,
      encryptedDek: toBytes(Buffer.concat([ct, tag])),
      dekIv: toBytes(iv),
      kekVersion: this.currentKekVersion,
    };
  }

  /**
   * Decrypt a stored DEK using the appropriate KEK version.
   */
  decryptDek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    kekVersion?: number,
  ): Buffer {
    const kek = this.resolveKek(kekVersion ?? this.currentKekVersion);
    const encryptedDek = Buffer.from(encryptedDekRaw);
    const iv = Buffer.from(dekIvRaw);
    const tag = encryptedDek.subarray(encryptedDek.length - TAG_LEN);
    const ct = encryptedDek.subarray(0, encryptedDek.length - TAG_LEN);
    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
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
  ): {
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    if (oldKekVersion === this.currentKekVersion) {
      throw new Error("DEK is already on the current KEK version");
    }

    // Decrypt with old KEK
    const dek = this.decryptDek(encryptedDekRaw, dekIvRaw, oldKekVersion);

    try {
      // Re-encrypt with current KEK
      const iv = crypto.randomBytes(IV_LEN);
      const cipher = crypto.createCipheriv("aes-256-gcm", this.kek, iv);
      const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
      const tag = cipher.getAuthTag();
      return {
        encryptedDek: toBytes(Buffer.concat([ct, tag])),
        dekIv: toBytes(iv),
        kekVersion: this.currentKekVersion,
      };
    } finally {
      dek.fill(0);
    }
  }

  /** Check if a previous KEK is loaded (rotation in progress). */
  get isRotationActive(): boolean {
    return this.kekPrevious !== null;
  }

  // ─── Field encryption ─────────────────────────────────────────────────────

  encryptField(plaintext: string, dek: Buffer): EncryptedField {
    const plain = Buffer.from(plaintext, "utf8");
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: toBytes(ciphertext),
      iv: toBytes(iv),
      tag: toBytes(tag),
    };
  }

  decryptField(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
  ): string {
    const ct = Buffer.from(ctRaw);
    const iv = Buffer.from(ivRaw);
    const tag = Buffer.from(tagRaw);
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString("utf8");
  }
}
