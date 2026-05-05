import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRequire } from "node:module";

type PrismaBytes = Uint8Array<ArrayBuffer>;

export interface EncryptedField {
  ciphertext: PrismaBytes;
  iv: PrismaBytes;
  tag: PrismaBytes;
}

function toBytes(hex: string): PrismaBytes {
  return new Uint8Array(Buffer.from(hex, "hex")) as PrismaBytes;
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

// Load Rust NAPI addon — MANDATORY, no fallback
const _require = createRequire(__filename);

const nativeCrypto = (() => {
  try {
    return _require("@polyforge/crypto-native");
  } catch (err: unknown) {
    throw new Error(
      `SECURITY: @polyforge/crypto-native NAPI addon is REQUIRED but not available: ${err instanceof Error ? err.message : String(err)}\n` +
        "The signer-service MUST use Rust for key material handling. " +
        "Build with: cd packages/polyforge-crypto-native && pnpm build",
      { cause: err },
    );
  }
})();

/**
 * Rust NAPI-RS encryption service — NO FALLBACK to Node.js crypto.
 *
 * SECURITY: Private keys and DEKs are held in Rust memory with Zeroizing<Vec<u8>>,
 * never entering the V8 heap. If the NAPI addon is not available, the service
 * refuses to start. This ensures:
 *   - Deterministic memory zeroing on drop (no GC ambiguity)
 *   - No string interning of key material in V8's string pool
 *   - Key material isolated from V8 heap dumps
 *
 * KEK Rotation:
 *   - MASTER_ENCRYPTION_KEY is the current KEK (all new encryption)
 *   - MASTER_ENCRYPTION_KEY_PREVIOUS (optional) for decrypt-only during grace period
 *   - MASTER_ENCRYPTION_KEY_VERSION tracks the current version number
 *   - Each UserCredential row stores kekVersion for rotation tracking
 */
@Injectable()
export class NativeEncryptionService {
  private readonly logger = new Logger(NativeEncryptionService.name);
  private readonly hasPreviousKek: boolean;
  readonly currentKekVersion: number;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>("MASTER_ENCRYPTION_KEY");
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
      );
    }

    // Previous KEK is optional — only present during rotation grace period
    const prevHex = this.config.get<string>("MASTER_ENCRYPTION_KEY_PREVIOUS");
    const previousKekHex = prevHex && prevHex.length === 64 ? prevHex : null;
    this.hasPreviousKek = previousKekHex !== null;
    nativeCrypto.configureKeks(keyHex, previousKekHex);

    this.currentKekVersion = Number(
      this.config.get<string>("MASTER_ENCRYPTION_KEY_VERSION") ?? "1",
    );

    this.logger.log(
      "Rust NAPI-RS encryption active — memory-safe key handling enabled",
    );
    if (this.hasPreviousKek) {
      this.logger.log(
        `KEK rotation active: current version=${this.currentKekVersion}, previous KEK loaded`,
      );
    }
  }

  private shouldUsePreviousKek(kekVersion: number): boolean {
    if (kekVersion === this.currentKekVersion) {
      return false;
    }
    if (kekVersion === this.currentKekVersion - 1 && this.hasPreviousKek) {
      return true;
    }
    throw new Error(
      `No KEK available for version ${kekVersion} (current=${this.currentKekVersion})`,
    );
  }

  generateDek(): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    const dek = nativeCrypto.generateDek();
    const wrappedJson = nativeCrypto.wrapDekWithCurrentKek(dek);
    const parsed = JSON.parse(wrappedJson);
    return {
      dek,
      encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
      dekIv: toBytes(parsed.iv),
      kekVersion: this.currentKekVersion,
    };
  }

  decryptDek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    kekVersion?: number,
  ): Buffer {
    const usePrevious = this.shouldUsePreviousKek(
      kekVersion ?? this.currentKekVersion,
    );
    const combined = toHex(encryptedDekRaw);
    const ct = combined.slice(0, combined.length - 32);
    const tag = combined.slice(combined.length - 32);
    const iv = toHex(dekIvRaw);
    return nativeCrypto.decryptDekWithStoredKek(ct, iv, tag, usePrevious);
  }

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
    const dekBuf = this.decryptDek(encryptedDekRaw, dekIvRaw, oldKekVersion);

    try {
      // Re-encrypt with current KEK
      const wrappedJson = nativeCrypto.wrapDekWithCurrentKek(dekBuf);
      const parsed = JSON.parse(wrappedJson);

      return {
        encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
        dekIv: toBytes(parsed.iv),
        kekVersion: this.currentKekVersion,
      };
    } finally {
      // Zero out the JS-side DEK buffer (best-effort)
      dekBuf.fill(0);
    }
  }

  get isRotationActive(): boolean {
    return this.hasPreviousKek;
  }

  encryptField(plaintext: string, dek: Buffer): EncryptedField {
    const plaintextBytes = Buffer.from(plaintext, "utf8");
    try {
      return this.encryptFieldBytes(plaintextBytes, dek);
    } finally {
      plaintextBytes.fill(0);
    }
  }

  encryptFieldBytes(plaintext: Buffer, dek: Buffer): EncryptedField {
    const resultJson = nativeCrypto.encryptAes256GcmBytesWithRawKey(
      plaintext,
      dek,
    );
    const parsed = JSON.parse(resultJson);
    return {
      ciphertext: toBytes(parsed.ciphertext),
      iv: toBytes(parsed.iv),
      tag: toBytes(parsed.tag),
    };
  }

  decryptField(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
  ): Buffer {
    return this.decryptFieldBytes(ctRaw, ivRaw, tagRaw, dek);
  }

  decryptFieldBytes(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
  ): Buffer {
    return nativeCrypto.decryptAes256GcmBytesWithRawKey(
      toHex(ctRaw),
      toHex(ivRaw),
      toHex(tagRaw),
      dek,
    );
  }

  encryptWithMasterKey(plaintext: string): EncryptedField {
    const plaintextBytes = Buffer.from(plaintext, "utf8");
    try {
      const resultJson =
        nativeCrypto.encryptAes256GcmBytesWithConfiguredKek(plaintextBytes);
      const parsed = JSON.parse(resultJson);
      return {
        ciphertext: toBytes(parsed.ciphertext),
        iv: toBytes(parsed.iv),
        tag: toBytes(parsed.tag),
      };
    } finally {
      plaintextBytes.fill(0);
    }
  }

  decryptWithMasterKey(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
  ): Buffer {
    return nativeCrypto.decryptAes256GcmBytesWithConfiguredKek(
      toHex(ctRaw),
      toHex(ivRaw),
      toHex(tagRaw),
    );
  }
}
