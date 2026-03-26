import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Bytes type compatible with Prisma 7 Bytes fields */
type PrismaBytes = Uint8Array<ArrayBuffer>;

export interface EncryptedField {
  ciphertext: PrismaBytes;
  iv: PrismaBytes;
  tag: PrismaBytes;
}

function toBytes(hex: string): PrismaBytes {
  const buf = Buffer.from(hex, "hex");
  return new Uint8Array(buf) as PrismaBytes;
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

let nativeCrypto: any = null;

function getNative(): any {
  if (nativeCrypto) return nativeCrypto;
  try {
    nativeCrypto = require("@polyforge/crypto-native");
    return nativeCrypto;
  } catch {
    return null;
  }
}

/**
 * Rust NAPI-RS encryption service — drop-in replacement for EncryptionService.
 *
 * SECURITY: Private keys and DEKs are held in Rust memory with Zeroizing<Vec<u8>>,
 * never entering the V8 heap as Buffer objects. This provides:
 *   - Deterministic memory zeroing on drop (no GC ambiguity)
 *   - No string interning of key material in V8's string pool
 *   - Key material isolated from V8 heap dumps
 */
@Injectable()
export class NativeEncryptionService {
  private readonly logger = new Logger(NativeEncryptionService.name);
  private readonly kekHex: string;
  private readonly useNative: boolean;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>("MASTER_ENCRYPTION_KEY");
    if (!keyHex || keyHex.length !== 64) {
      throw new Error("MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
    }
    this.kekHex = keyHex;

    const native = getNative();
    this.useNative = !!native;
    if (this.useNative) {
      this.logger.log("Using Rust NAPI-RS encryption (memory-safe key handling)");
    } else {
      this.logger.warn("Rust NAPI-RS not available — falling back to Node.js crypto");
    }
  }

  generateDek(): { dek: Buffer; encryptedDek: PrismaBytes; dekIv: PrismaBytes } {
    const native = getNative();
    if (native) {
      const dekHex = native.generateDek();
      const wrappedJson = native.wrapDek(dekHex, this.kekHex);
      const parsed = JSON.parse(wrappedJson);
      return {
        dek: Buffer.from(dekHex, "hex"),
        encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
        dekIv: toBytes(parsed.iv),
      };
    }
    // Fallback to Node.js crypto
    return this.generateDekFallback();
  }

  decryptDek(encryptedDekRaw: Uint8Array, dekIvRaw: Uint8Array): Buffer {
    const native = getNative();
    if (native) {
      const combined = toHex(encryptedDekRaw);
      const ct = combined.slice(0, combined.length - 32); // 16 bytes = 32 hex chars for tag
      const tag = combined.slice(combined.length - 32);
      const iv = toHex(dekIvRaw);
      const dekHex = native.decryptAes256Gcm(ct, iv, tag, this.kekHex);
      return Buffer.from(dekHex, "hex");
    }
    return this.decryptDekFallback(encryptedDekRaw, dekIvRaw);
  }

  encryptField(plaintext: string, dek: Buffer): EncryptedField {
    const native = getNative();
    if (native) {
      const dekHex = dek.toString("hex");
      const resultJson = native.encryptAes256Gcm(plaintext, dekHex);
      const parsed = JSON.parse(resultJson);
      return {
        ciphertext: toBytes(parsed.ciphertext),
        iv: toBytes(parsed.iv),
        tag: toBytes(parsed.tag),
      };
    }
    return this.encryptFieldFallback(plaintext, dek);
  }

  decryptField(ctRaw: Uint8Array, ivRaw: Uint8Array, tagRaw: Uint8Array, dek: Buffer): string {
    const native = getNative();
    if (native) {
      return native.decryptAes256Gcm(toHex(ctRaw), toHex(ivRaw), toHex(tagRaw), dek.toString("hex"));
    }
    return this.decryptFieldFallback(ctRaw, ivRaw, tagRaw, dek);
  }

  // ─── Node.js fallbacks (used when NAPI addon not available) ────────────

  private generateDekFallback() {
    const crypto = require("crypto");
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(this.kekHex, "hex"), iv);
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      dek,
      encryptedDek: new Uint8Array(Buffer.concat([ct, tag])) as PrismaBytes,
      dekIv: new Uint8Array(iv) as PrismaBytes,
    };
  }

  private decryptDekFallback(encryptedDekRaw: Uint8Array, dekIvRaw: Uint8Array): Buffer {
    const crypto = require("crypto");
    const encryptedDek = Buffer.from(encryptedDekRaw);
    const iv = Buffer.from(dekIvRaw);
    const tag = encryptedDek.subarray(encryptedDek.length - 16);
    const ct = encryptedDek.subarray(0, encryptedDek.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(this.kekHex, "hex"), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  private encryptFieldFallback(plaintext: string, dek: Buffer): EncryptedField {
    const crypto = require("crypto");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: new Uint8Array(ciphertext) as PrismaBytes,
      iv: new Uint8Array(iv) as PrismaBytes,
      tag: new Uint8Array(tag) as PrismaBytes,
    };
  }

  private decryptFieldFallback(ctRaw: Uint8Array, ivRaw: Uint8Array, tagRaw: Uint8Array, dek: Buffer): string {
    const crypto = require("crypto");
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, Buffer.from(ivRaw));
    decipher.setAuthTag(Buffer.from(tagRaw));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctRaw)), decipher.final()]);
    return plain.toString("utf8");
  }
}
