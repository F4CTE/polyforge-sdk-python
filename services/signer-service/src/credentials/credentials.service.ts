import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "../encryption/encryption.service";
import { ImportCredentialsDto } from "./dto/import-credentials.dto";
import { credentialDekAad, credentialFieldAad } from "./credential-aad";

/**
 * Decrypted credentials with sensitive fields as Buffers (not strings).
 * Buffers can be zeroed via .fill(0) after use; JS strings are immutable
 * and linger in the V8 heap until garbage-collected.
 */
export interface DecryptedCredentials {
  privateKey: Buffer;
  apiKey: Buffer;
  apiSecret: Buffer;
  apiPassphrase: Buffer;
  safeAddress: string | null;
  sigType: number;
}

/** Zero all sensitive Buffer fields in a credentials object (best-effort). */
export function zeroCredentials(creds: DecryptedCredentials): void {
  creds.privateKey.fill(0);
  creds.apiKey.fill(0);
  creds.apiSecret.fill(0);
  creds.apiPassphrase.fill(0);
}

function copyPrivateKeyBytes(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (input instanceof Uint8Array) {
    try {
      return Buffer.from(input);
    } finally {
      input.fill(0);
    }
  }
  if (Array.isArray(input)) {
    try {
      return Buffer.from(input);
    } finally {
      input.fill(0);
    }
  }
  throw new BadRequestException("Invalid private key format");
}

function isAsciiHexByte(byte: number): boolean {
  return (
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x46) ||
    (byte >= 0x61 && byte <= 0x66)
  );
}

function assertPrivateKeyBytes(privateKey: Buffer): void {
  if (
    privateKey.length !== 66 ||
    privateKey[0] !== 0x30 ||
    (privateKey[1] !== 0x78 && privateKey[1] !== 0x58)
  ) {
    throw new BadRequestException("Invalid private key format");
  }
  for (let i = 2; i < privateKey.length; i += 1) {
    if (!isAsciiHexByte(privateKey[i])) {
      throw new BadRequestException("Invalid private key format");
    }
  }
}

/**
 * Stores and retrieves encrypted Polymarket credentials.
 *
 * SECURITY RULES:
 * - Plaintext credentials MUST NEVER be logged.
 * - Plaintext credentials MUST NEVER be persisted (in DB, cache, or disk).
 * - This service is the only place that touches raw key material.
 * - Callers MUST call zeroCredentials() in a finally block after use.
 */
@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async importCredentials(dto: ImportCredentialsDto): Promise<void> {
    const {
      userId,
      privateKey,
      apiKey,
      apiSecret,
      apiPassphrase,
      safeAddress,
      sigType,
    } = dto;

    const privateKeyBytes = copyPrivateKeyBytes(privateKey);
    try {
      assertPrivateKeyBytes(privateKeyBytes);
    } catch (err) {
      privateKeyBytes.fill(0);
      throw err;
    }

    // Generate per-user DEK (always uses current KEK version)
    const { dek, encryptedDek, dekIv, kekVersion } =
      this.encryption.generateDek({ aad: credentialDekAad(userId) });

    // Encrypt each field separately (fresh IV per field).
    // try/finally guarantees DEK is zeroed even if an encryptField call throws.
    let pkEnc: ReturnType<typeof this.encryption.encryptField>;
    let akEnc: ReturnType<typeof this.encryption.encryptField>;
    let asEnc: ReturnType<typeof this.encryption.encryptField>;
    let apEnc: ReturnType<typeof this.encryption.encryptField>;
    try {
      pkEnc = this.encryption.encryptFieldBytes(privateKeyBytes, dek, {
        aad: credentialFieldAad(userId, "privateKey"),
      });
      akEnc = this.encryption.encryptField(apiKey, dek, {
        aad: credentialFieldAad(userId, "apiKey"),
      });
      asEnc = this.encryption.encryptField(apiSecret, dek, {
        aad: credentialFieldAad(userId, "apiSecret"),
      });
      apEnc = this.encryption.encryptField(apiPassphrase, dek, {
        aad: credentialFieldAad(userId, "apiPassphrase"),
      });
    } finally {
      // Zero out plaintext DEK from memory (best-effort in JS)
      dek.fill(0);
      privateKeyBytes.fill(0);
    }

    await this.prisma.userCredential.upsert({
      where: { userId },
      create: {
        userId,
        encryptedDek,
        dekIv,
        kekVersion,
        privateKeyCt: pkEnc.ciphertext,
        privateKeyIv: pkEnc.iv,
        privateKeyTag: pkEnc.tag,
        apiKeyCt: akEnc.ciphertext,
        apiKeyIv: akEnc.iv,
        apiKeyTag: akEnc.tag,
        apiSecretCt: asEnc.ciphertext,
        apiSecretIv: asEnc.iv,
        apiSecretTag: asEnc.tag,
        apiPassphraseCt: apEnc.ciphertext,
        apiPassphraseIv: apEnc.iv,
        apiPassphraseTag: apEnc.tag,
        safeAddress: safeAddress ?? null,
        sigType,
      },
      update: {
        encryptedDek,
        dekIv,
        kekVersion,
        privateKeyCt: pkEnc.ciphertext,
        privateKeyIv: pkEnc.iv,
        privateKeyTag: pkEnc.tag,
        apiKeyCt: akEnc.ciphertext,
        apiKeyIv: akEnc.iv,
        apiKeyTag: akEnc.tag,
        apiSecretCt: asEnc.ciphertext,
        apiSecretIv: asEnc.iv,
        apiSecretTag: asEnc.tag,
        apiPassphraseCt: apEnc.ciphertext,
        apiPassphraseIv: apEnc.iv,
        apiPassphraseTag: apEnc.tag,
        safeAddress: safeAddress ?? null,
        sigType,
      },
    });

    this.logger.log(
      `Credentials stored for user ${userId} (sigType=${sigType})`,
    );
  }

  async deleteCredentials(userId: string): Promise<void> {
    const existing = await this.prisma.userCredential.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException("No credentials found for user");
    }

    await this.prisma.userCredential.delete({ where: { userId } });
    this.logger.log(`Credentials deleted for user ${userId}`);
  }

  /**
   * Retrieve decrypted credentials for signing.
   * Called ONLY by SigningService — result must never be logged.
   *
   * Returns sensitive fields as Buffers so callers can zero them after use.
   * Callers MUST call zeroCredentials(creds) in a finally block.
   */
  async getDecryptedCredentials(userId: string): Promise<DecryptedCredentials> {
    const row = await this.prisma.userCredential.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new NotFoundException("No credentials found for user");
    }

    const dek = this.encryption.decryptDek(
      row.encryptedDek,
      row.dekIv,
      row.kekVersion,
      { aad: credentialDekAad(userId), allowLegacyNoAadFallback: true },
    );

    // try/finally guarantees DEK is zeroed even if a decryptField call throws.
    try {
      return {
        privateKey: this.encryption.decryptField(
          row.privateKeyCt,
          row.privateKeyIv,
          row.privateKeyTag,
          dek,
          {
            aad: credentialFieldAad(userId, "privateKey"),
            allowLegacyNoAadFallback: true,
          },
        ),
        apiKey: this.encryption.decryptField(
          row.apiKeyCt,
          row.apiKeyIv,
          row.apiKeyTag,
          dek,
          {
            aad: credentialFieldAad(userId, "apiKey"),
            allowLegacyNoAadFallback: true,
          },
        ),
        apiSecret: this.encryption.decryptField(
          row.apiSecretCt,
          row.apiSecretIv,
          row.apiSecretTag,
          dek,
          {
            aad: credentialFieldAad(userId, "apiSecret"),
            allowLegacyNoAadFallback: true,
          },
        ),
        apiPassphrase: this.encryption.decryptField(
          row.apiPassphraseCt,
          row.apiPassphraseIv,
          row.apiPassphraseTag,
          dek,
          {
            aad: credentialFieldAad(userId, "apiPassphrase"),
            allowLegacyNoAadFallback: true,
          },
        ),
        safeAddress: row.safeAddress,
        sigType: row.sigType,
      };
    } finally {
      // Zero out DEK from memory (best-effort in JS)
      dek.fill(0);
    }
  }
}
