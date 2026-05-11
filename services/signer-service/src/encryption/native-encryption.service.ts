import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRequire } from "node:module";
import type { AesGcmAad, AesGcmOptions } from "./encryption.service";

type PrismaBytes = Uint8Array<ArrayBuffer>;

export interface EncryptedField {
  ciphertext: PrismaBytes;
  iv: PrismaBytes;
  tag: PrismaBytes;
}

function toBytes(hex: string): PrismaBytes {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function aadToHex(aad: AesGcmAad | undefined): string | undefined {
  if (aad === undefined) return undefined;
  return (
    typeof aad === "string" ? Buffer.from(aad, "utf8") : Buffer.from(aad)
  ).toString("hex");
}

const DEK_LEN = 32;

/**
 * Check whether an error is specifically a GCM auth-tag mismatch from the
 * Rust native crypto layer.  The aead crate returns `aead::Error` on
 * authentication failure, and the NAPI-RS binding maps it to
 * `Error::from_reason("Decryption failed: …")`.
 *
 * We must NOT fall back silently on other exceptions (binding failures,
 * programming errors, unknown KEK version, etc.) because that would mask
 * real breakages and unintentionally downgrade integrity checks for
 * legacy rows.
 */
function isAuthTagMismatchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /^Decryption failed:/.test(err.message);
}

function assertDekLength(dek: unknown): asserts dek is Buffer {
  if (!Buffer.isBuffer(dek) || dek.length !== DEK_LEN) {
    throw new Error(
      `DEK must be exactly ${DEK_LEN} bytes, got ${
        Buffer.isBuffer(dek) ? dek.length : typeof dek
      }`,
    );
  }
}

// AAD-aware native functions required by NativeEncryptionService.
// If the loaded platform binary is stale (missing these exports),
// the service must refuse to start rather than fail at runtime.
const REQUIRED_AAD_NATIVE_FUNCTIONS = [
  "encryptAes256GcmBytesWithRawKeyAndAad",
  "decryptAes256GcmBytesWithRawKeyAndAad",
  "wrapDekWithCurrentKekAndAad",
  "unwrapDekWithAadRaw",
] as const;

function verifyNativeAadExports(native: Record<string, unknown>): void {
  const missing = REQUIRED_AAD_NATIVE_FUNCTIONS.filter(
    (f) => typeof native[f] !== "function",
  );
  if (missing.length > 0) {
    const platformTag = `${process.platform}-${process.arch}`;
    if (platformTag === "win32-x64") {
      throw new Error(
        "UNSUPPORTED: Windows native crypto addon is not yet available.\n" +
          "The signer-service requires the @polyforge/crypto-native Rust NAPI addon with AAD support.\n" +
          "A functional Linux x64 binary is shipped; a Windows build is pending.\n" +
          "Deploy on Linux x64 or rebuild for your platform: cd packages/polyforge-crypto-native && pnpm build",
      );
    }
    throw new Error(
      `SECURITY: @polyforge/crypto-native native addon is missing required AAD functions: ${missing.join(", ")}.\n` +
        `The platform binary (${platformTag}) is stale or was built without AAD support.\n` +
        "Rebuild the native addon for this platform: cd packages/polyforge-crypto-native && pnpm build",
    );
  }
}

// Load Rust NAPI addon — MANDATORY, no fallback
const _require = createRequire(__filename);

const nativeCrypto = (() => {
  try {
    const native = _require("@polyforge/crypto-native");
    verifyNativeAadExports(native);
    return native;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes("missing required AAD functions") ||
        err.message.includes("UNSUPPORTED"))
    ) {
      throw err;
    }
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

    // Previous KEK is optional — only present during rotation grace period.
    // Any non-empty value must be 64 hex chars; Rust configureKeks
    // performs full hex-decode validation.  Fail fast here rather than
    // silently treating a malformed previous KEK as absent.
    const prevHex = this.config.get<string>("MASTER_ENCRYPTION_KEY_PREVIOUS");
    if (prevHex && prevHex.length !== 64) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY_PREVIOUS must be a 64-char hex string (32 bytes) when present",
      );
    }
    const previousKekHex = prevHex || null;
    this.hasPreviousKek = previousKekHex !== null;

    // Store KEKs exclusively in Rust memory — no JS string fields
    // retaining master-key material on the V8 heap.
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

  // ── Envelope Encryption (DEK/KEK) ───────────────────────────────────────

  generateDek(options?: AesGcmOptions): {
    dek: Buffer;
    encryptedDek: PrismaBytes;
    dekIv: PrismaBytes;
    kekVersion: number;
  } {
    const dek = nativeCrypto.generateDek();

    // Fast path: no AAD — raw-Buffer API, zero hex conversion.
    // DEK never enters the V8 heap as a string.
    if (!options?.aad) {
      const wrappedJson = nativeCrypto.wrapDekWithCurrentKek(dek);
      const parsed = JSON.parse(wrappedJson);
      return {
        dek,
        encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
        dekIv: toBytes(parsed.iv),
        kekVersion: this.currentKekVersion,
      };
    }

    // AAD path: binds DEK to a specific user row.
    // Uses raw-key Rust API — DEK never enters the V8 heap as a string.
    assertDekLength(dek);
    const aadHex = aadToHex(options.aad)!;
    const wrappedJson = nativeCrypto.wrapDekWithCurrentKekAndAad(dek, aadHex);
    const parsed = JSON.parse(wrappedJson);
    return {
      dek,
      encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
      dekIv: toBytes(parsed.iv),
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
    assertDekLength(dek);

    // Fast path: no AAD — raw-Buffer API.
    if (!options?.aad) {
      const wrappedJson = nativeCrypto.wrapDekWithCurrentKek(dek);
      const parsed = JSON.parse(wrappedJson);
      return {
        encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
        dekIv: toBytes(parsed.iv),
        kekVersion: this.currentKekVersion,
      };
    }

    // AAD path — uses raw-key Rust API, DEK never enters the V8 heap as a string.
    const aadHex = aadToHex(options.aad)!;
    const wrappedJson = nativeCrypto.wrapDekWithCurrentKekAndAad(dek, aadHex);
    const parsed = JSON.parse(wrappedJson);
    return {
      encryptedDek: toBytes(parsed.ciphertext + parsed.tag),
      dekIv: toBytes(parsed.iv),
      kekVersion: this.currentKekVersion,
    };
  }

  decryptDek(
    encryptedDekRaw: Uint8Array,
    dekIvRaw: Uint8Array,
    kekVersion?: number,
    options?: AesGcmOptions,
  ): Buffer {
    const combined = toHex(encryptedDekRaw);
    const ct = combined.slice(0, combined.length - 32);
    const tag = combined.slice(combined.length - 32);
    const iv = toHex(dekIvRaw);

    // Fast path: no AAD — uses Rust-stored KEK, zero hex-key exposure.
    if (!options?.aad) {
      const usePrevious = this.shouldUsePreviousKek(
        kekVersion ?? this.currentKekVersion,
      );
      return nativeCrypto.decryptDekWithStoredKek(ct, iv, tag, usePrevious);
    }

    // AAD path: try AAD-aware unwrap, fall back to legacy if configured.
    // At this point options.aad is guaranteed to be defined (guarded above).

    return this.decryptDekWithAad(
      ct,
      iv,
      tag,
      kekVersion,
      options.aad,
      options.allowLegacyNoAadFallback,
    );
  }

  private decryptDekWithAad(
    ct: string,
    iv: string,
    tag: string,
    kekVersion: number | undefined,
    aad: AesGcmAad,
    allowLegacyNoAadFallback?: boolean,
  ): Buffer {
    const aadHex = aadToHex(aad)!;
    const usePrevious = this.shouldUsePreviousKek(
      kekVersion ?? this.currentKekVersion,
    );
    const wrappedJson = JSON.stringify({ ciphertext: ct, iv, tag });
    try {
      return nativeCrypto.unwrapDekWithAadRaw(wrappedJson, usePrevious, aadHex);
    } catch (err) {
      if (allowLegacyNoAadFallback && isAuthTagMismatchError(err)) {
        return nativeCrypto.decryptDekWithStoredKek(ct, iv, tag, usePrevious);
      }
      throw err;
    }
  }

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
    const dekBuf = this.decryptDek(
      encryptedDekRaw,
      dekIvRaw,
      oldKekVersion,
      options,
    );

    try {
      assertDekLength(dekBuf);
      return this.wrapDek(dekBuf, options);
    } finally {
      // Zero out the JS-side DEK buffer (best-effort)
      dekBuf.fill(0);
    }
  }

  get isRotationActive(): boolean {
    return this.hasPreviousKek;
  }

  // ── Field Encryption (DEK-level) ────────────────────────────────────────

  encryptField(
    plaintext: string,
    dek: Buffer,
    options?: AesGcmOptions,
  ): EncryptedField {
    const plaintextBytes = Buffer.from(plaintext, "utf8");
    try {
      return this.encryptFieldBytes(plaintextBytes, dek, options);
    } finally {
      plaintextBytes.fill(0);
    }
  }

  encryptFieldBytes(
    plaintext: Buffer,
    dek: Buffer,
    options?: AesGcmOptions,
  ): EncryptedField {
    assertDekLength(dek);

    // Fast path: no AAD — pass raw DEK Buffer to Rust, zero hex conversion.
    if (!options?.aad) {
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

    // AAD path: uses raw-key Rust API — DEK never enters the V8 heap as a string.
    const aadHex = aadToHex(options.aad)!;
    const resultJson = nativeCrypto.encryptAes256GcmBytesWithRawKeyAndAad(
      plaintext,
      dek,
      aadHex,
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
    options?: AesGcmOptions,
  ): Buffer {
    assertDekLength(dek);

    // Fast path: no AAD — raw-key API returns Buffer directly.
    if (!options?.aad) {
      return nativeCrypto.decryptAes256GcmBytesWithRawKey(
        toHex(ctRaw),
        toHex(ivRaw),
        toHex(tagRaw),
        dek,
      );
    }

    // AAD path with legacy fallback.
    // At this point options.aad is guaranteed to be defined (guarded above).

    return this.decryptFieldWithAad(
      ctRaw,
      ivRaw,
      tagRaw,
      dek,
      options.aad,
      options.allowLegacyNoAadFallback,
    );
  }

  private decryptFieldWithAad(
    ctRaw: Uint8Array,
    ivRaw: Uint8Array,
    tagRaw: Uint8Array,
    dek: Buffer,
    aad: AesGcmAad,
    allowLegacyNoAadFallback?: boolean,
  ): Buffer {
    try {
      const aadHex = aadToHex(aad)!;
      return nativeCrypto.decryptAes256GcmBytesWithRawKeyAndAad(
        toHex(ctRaw),
        toHex(ivRaw),
        toHex(tagRaw),
        dek,
        aadHex,
      );
    } catch (err) {
      if (allowLegacyNoAadFallback && isAuthTagMismatchError(err)) {
        return nativeCrypto.decryptAes256GcmBytesWithRawKey(
          toHex(ctRaw),
          toHex(ivRaw),
          toHex(tagRaw),
          dek,
        );
      }
      throw err;
    }
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
