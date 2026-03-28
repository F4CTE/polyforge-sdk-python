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
 * TODO: MASTER_ENCRYPTION_KEY ROTATION NOT IMPLEMENTED
 * ─────────────────────────────────────────────────────
 * Currently, MASTER_ENCRYPTION_KEY (KEK) is static. To rotate it safely:
 *
 * 1. Add a "key_version" field to encrypted_deks table (tracks which KEK version encrypted each DEK)
 * 2. Implement a key_rotation service with dual-key support:
 *    - Keep 2 KEKs in rotation (current + previous)
 *    - Previous KEK only for decryption (grace period ~24-48 hours)
 *    - All new encryption uses current KEK
 * 3. Add background job to re-encrypt DEKs from previous → current KEK
 *    - Runs during low-traffic windows (e.g., 2-4 AM UTC)
 *    - Must be idempotent (check key_version before re-encrypting)
 * 4. Update AWS Secrets Manager with new KEK
 * 5. Drain previous KEK from memory after grace period (restart signer-service)
 *
 * Implementation notes:
 *   - See docs/14-backup-recovery.md for disaster recovery context
 *   - DEK format: ciphertext + tag (concatenated); add key_version to stored format
 *   - Consider automated rotation via AWS Lambda triggered by SNS from Secrets Manager
 *   - Non-compliance with key rotation may be flagged in SOC 2 audits
 *
 * Reference: JWT secret rotation in admin-api-service/src/key-rotation/ shows grace-period pattern
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly kek: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>("MASTER_ENCRYPTION_KEY");
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
      );
    }
    this.kek = Buffer.from(keyHex, "hex");
  }

  // ─── DEK lifecycle ────────────────────────────────────────────────────────

  /**
   * Generate a new DEK and return it plain (for encrypting fields)
   * alongside its encrypted form (for storage).
   * Encrypted DEK = ciphertext + tag concatenated.
   */
  generateDek(): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
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
    };
  }

  /**
   * Decrypt a stored DEK using the KEK.
   */
  decryptDek(encryptedDekRaw: Uint8Array, dekIvRaw: Uint8Array): Buffer {
    const encryptedDek = Buffer.from(encryptedDekRaw);
    const iv = Buffer.from(dekIvRaw);
    const tag = encryptedDek.subarray(encryptedDek.length - TAG_LEN);
    const ct = encryptedDek.subarray(0, encryptedDek.length - TAG_LEN);
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
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
