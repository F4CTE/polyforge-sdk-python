import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "../encryption/encryption.service";
import { ImportCredentialsDto } from "./dto/import-credentials.dto";

/**
 * Stores and retrieves encrypted Polymarket credentials.
 *
 * SECURITY RULES:
 * - Plaintext credentials MUST NEVER be logged.
 * - Plaintext credentials MUST NEVER be persisted (in DB, cache, or disk).
 * - This service is the only place that touches raw key material.
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

    // Validate private key format (0x + 64 hex chars)
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new BadRequestException("Invalid private key format");
    }

    // Generate per-user DEK (always uses current KEK version)
    const { dek, encryptedDek, dekIv, kekVersion } =
      this.encryption.generateDek();

    // Encrypt each field separately (fresh IV per field).
    // try/finally guarantees DEK is zeroed even if an encryptField call throws.
    let pkEnc: ReturnType<typeof this.encryption.encryptField>;
    let akEnc: ReturnType<typeof this.encryption.encryptField>;
    let asEnc: ReturnType<typeof this.encryption.encryptField>;
    let apEnc: ReturnType<typeof this.encryption.encryptField>;
    try {
      pkEnc = this.encryption.encryptField(privateKey, dek);
      akEnc = this.encryption.encryptField(apiKey, dek);
      asEnc = this.encryption.encryptField(apiSecret, dek);
      apEnc = this.encryption.encryptField(apiPassphrase, dek);
    } finally {
      // Zero out plaintext DEK from memory (best-effort in JS)
      dek.fill(0);
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
   */
  async getDecryptedCredentials(userId: string): Promise<{
    privateKey: string;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    safeAddress: string | null;
    sigType: number;
  }> {
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
    );

    // try/finally guarantees DEK is zeroed even if a decryptField call throws.
    try {
      return {
        privateKey: this.encryption.decryptField(
          row.privateKeyCt,
          row.privateKeyIv,
          row.privateKeyTag,
          dek,
        ),
        apiKey: this.encryption.decryptField(
          row.apiKeyCt,
          row.apiKeyIv,
          row.apiKeyTag,
          dek,
        ),
        apiSecret: this.encryption.decryptField(
          row.apiSecretCt,
          row.apiSecretIv,
          row.apiSecretTag,
          dek,
        ),
        apiPassphrase: this.encryption.decryptField(
          row.apiPassphraseCt,
          row.apiPassphraseIv,
          row.apiPassphraseTag,
          dek,
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
