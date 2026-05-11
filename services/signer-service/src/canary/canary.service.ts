import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { EncryptionService } from "../encryption/encryption.service";
import { PrismaService } from "@polyforge/shared-db";
import {
  credentialDekAad,
  credentialFieldAad,
  type UserCredentialField,
} from "../credentials/credential-aad";

const CANARY_USER_ID = "__canary__";

const CANARY_FIELDS = [
  "privateKey",
  "apiKey",
  "apiSecret",
  "apiPassphrase",
] as const satisfies readonly UserCredentialField[];

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

    if (existing) {
      const aad = credentialDekAad(CANARY_USER_ID);
      let testDek: Buffer | undefined;
      let probePlaintext: Buffer | undefined;
      try {
        testDek = this.encryption.decryptDek(
          existing.encryptedDek,
          existing.dekIv,
          existing.kekVersion,
          { aad },
        );
        // Probe all field AADs — a row with AAD-bound DEK but legacy
        // no-AAD fields must be re-seeded, not accepted as healthy.
        for (const field of CANARY_FIELDS) {
          probePlaintext = this.encryption.decryptFieldBytes(
            existing[`${field}Ct`],
            existing[`${field}Iv`],
            existing[`${field}Tag`],
            testDek,
            { aad: credentialFieldAad(CANARY_USER_ID, field) },
          );
          probePlaintext.fill(0);
        }
        return;
      } catch {
        this.logger.log(
          "Existing canary row is pre-AAD — deleting and re-seeding with AAD-bound encryption",
        );
        try {
          await this.prisma.userCredential.delete({
            where: { userId: CANARY_USER_ID },
          });
        } catch (deleteErr: unknown) {
          if (
            deleteErr &&
            typeof deleteErr === "object" &&
            "code" in deleteErr &&
            (deleteErr as Record<string, unknown>).code === "P2025"
          ) {
            this.logger.log(
              "Canary row already deleted by another replica; proceeding to re-seed",
            );
          } else {
            throw deleteErr;
          }
        }
      } finally {
        testDek?.fill(0);
        probePlaintext?.fill(0);
      }
    }

    await this.seedCanaryCredentials();
  }

  private async seedCanaryCredentials() {
    // Generate deterministic-looking but fake credentials
    const fakePrivateKey = "0x" + crypto.randomBytes(32).toString("hex");
    const fakeApiKey = crypto.randomUUID();
    const fakeApiSecret = crypto.randomBytes(32).toString("base64url");
    const fakePassphrase = crypto.randomBytes(16).toString("base64url");

    const { dek, encryptedDek, dekIv } = this.encryption.generateDek({
      aad: credentialDekAad(CANARY_USER_ID),
    });

    const pkEnc = this.encryption.encryptField(fakePrivateKey, dek, {
      aad: credentialFieldAad(CANARY_USER_ID, "privateKey"),
    });
    const akEnc = this.encryption.encryptField(fakeApiKey, dek, {
      aad: credentialFieldAad(CANARY_USER_ID, "apiKey"),
    });
    const asEnc = this.encryption.encryptField(fakeApiSecret, dek, {
      aad: credentialFieldAad(CANARY_USER_ID, "apiSecret"),
    });
    const apEnc = this.encryption.encryptField(fakePassphrase, dek, {
      aad: credentialFieldAad(CANARY_USER_ID, "apiPassphrase"),
    });

    dek.fill(0);

    try {
      await this.prisma.userCredential.create({
        data: {
          userId: CANARY_USER_ID,
          kekVersion: this.encryption.currentKekVersion,
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
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as Record<string, unknown>).code === "P2002"
      ) {
        this.logger.log(
          "Canary row already created by another replica; re-validating",
        );
        // Re-validate the winning row — during rolling deploys an
        // older replica may have inserted a pre-AAD row that must be
        // detected and re-seeded rather than silently accepted.
        await this.ensureCanaryCredentials();
      } else {
        throw err;
      }
    }
  }
}
