import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { EncryptionService } from "../encryption/encryption.service";
import { PrismaService } from "@polyforge/shared-db";

const CANARY_USER_ID = "__canary__";

/**
 * Honeypot credential breach detection.
 *
 * At startup, signer-service stores a canary (fake credential set) in the DB.
 * If those credentials are ever submitted to Polymarket and the L2 auth
 * succeeds — an external monitoring system should alert immediately.
 *
 * This service only stores the canary. Actual alert triggering requires
 * a Polymarket L2 auth attempt monitor (out of scope for this service).
 */
@Injectable()
export class CanaryService implements OnModuleInit {
  private readonly logger = new Logger(CanaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureCanaryCredentials();
  }

  private async ensureCanaryCredentials() {
    const existing = await this.prisma.userCredential.findUnique({
      where: { userId: CANARY_USER_ID },
    });

    if (existing) return; // Already seeded

    // Generate deterministic-looking but fake credentials
    const fakePrivateKey = "0x" + crypto.randomBytes(32).toString("hex");
    const fakeApiKey = crypto.randomUUID();
    const fakeApiSecret = crypto.randomBytes(32).toString("base64url");
    const fakePassphrase = crypto.randomBytes(16).toString("base64url");

    const { dek, encryptedDek, dekIv } = this.encryption.generateDek();

    const pkEnc = this.encryption.encryptField(fakePrivateKey, dek);
    const akEnc = this.encryption.encryptField(fakeApiKey, dek);
    const asEnc = this.encryption.encryptField(fakeApiSecret, dek);
    const apEnc = this.encryption.encryptField(fakePassphrase, dek);

    dek.fill(0);

    await this.prisma.userCredential.create({
      data: {
        userId: CANARY_USER_ID,
        encryptedDek,
        dekIv,
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
        sigType: 0,
      },
    });

    this.logger.log("Canary credentials initialized");
  }
}
