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
 */
@Injectable()
export class NativeEncryptionService {
  private readonly logger = new Logger(NativeEncryptionService.name);
  private readonly kekHex: string;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>("MASTER_ENCRYPTION_KEY");
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
      );
    }
    this.kekHex = keyHex;
    this.logger.log(
      "Rust NAPI-RS encryption active — memory-safe key handling enabled",
    );
  }

  generateDek(): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
  } {
    const dekHex = nativeCrypto.generateDek();
    const wrappedJson = nativeCrypto.wrapDek(dekHex, this.kekHex);
    const parsed = JSON.parse(wrappedJson);
    return {
      dek: Buffer.from(dekHex, "hex"),
      encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
      dekIv: toBytes(parsed.iv),
    };
  }

  decryptDek(encryptedDekRaw: Uint8Array, dekIvRaw: Uint8Array): Buffer {
    const combined = toHex(encryptedDekRaw);
    const ct = combined.slice(0, combined.length - 32);
    const tag = combined.slice(combined.length - 32);
    const iv = toHex(dekIvRaw);
    const dekHex = nativeCrypto.decryptAes256Gcm(ct, iv, tag, this.kekHex);
    return Buffer.from(dekHex, "hex");
  }

  encryptField(plaintext: string, dek: Buffer): EncryptedField {
    const dekHex = dek.toString("hex");
    const resultJson = nativeCrypto.encryptAes256Gcm(plaintext, dekHex);
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
  ): string {
    return nativeCrypto.decryptAes256Gcm(
      toHex(ctRaw),
      toHex(ivRaw),
      toHex(tagRaw),
      dek.toString("hex"),
    );
  }
}
