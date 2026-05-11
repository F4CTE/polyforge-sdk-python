import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "./encryption.service";
import {
  credentialDekAad,
  credentialFieldAad,
  polymarketUsCredentialDekAad,
  polymarketUsCredentialFieldAad,
  type UserCredentialField,
} from "../credentials/credential-aad";

export interface RotationProgress {
  total: number;
  rotated: number;
  failed: number;
  skipped: number;
  /** Rows skipped because they use pre-AAD encryption and must be re-imported. */
  legacy: number;
}

const USER_CREDENTIAL_FIELDS = [
  "privateKey",
  "apiKey",
  "apiSecret",
  "apiPassphrase",
] as const satisfies readonly UserCredentialField[];

type UserCredentialRotationRow = {
  userId: string;
  encryptedDek: Uint8Array;
  dekIv: Uint8Array;
  kekVersion: number;
  privateKeyCt: Uint8Array;
  privateKeyIv: Uint8Array;
  privateKeyTag: Uint8Array;
  apiKeyCt: Uint8Array;
  apiKeyIv: Uint8Array;
  apiKeyTag: Uint8Array;
  apiSecretCt: Uint8Array;
  apiSecretIv: Uint8Array;
  apiSecretTag: Uint8Array;
  apiPassphraseCt: Uint8Array;
  apiPassphraseIv: Uint8Array;
  apiPassphraseTag: Uint8Array;
};

type PolymarketUsCredentialRotationRow = {
  userId: string;
  encryptedDek: Uint8Array;
  dekIv: Uint8Array;
  kekVersion: number;
  secretKeyCt: Uint8Array;
  secretKeyIv: Uint8Array;
  secretKeyTag: Uint8Array;
};

class LegacyNoAadCredentialError extends Error {
  constructor(scope: string, userId: string) {
    super(
      `${scope} for user ${userId} requires legacy no-AAD fallback; re-import credentials instead of rotating them`,
    );
  }
}

/**
 * KEK rotation worker for the signer-service.
 *
 * Rotates DEKs from the previous KEK version to the current one.
 * Designed to be called by an admin endpoint or a scheduled job.
 *
 * Safety guarantees:
 *   - Idempotent: skips rows already on the current KEK version
 *   - Per-row transactions: a failure on one user doesn't block others
 *   - Progress tracking: returns counts for monitoring
 */
@Injectable()
export class KekRotationService {
  private readonly logger = new Logger(KekRotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Rotate all DEKs that are not on the current KEK version.
   * Processes in batches to avoid holding long transactions.
   */
  async rotateAll(batchSize = 100): Promise<RotationProgress> {
    const currentVersion = this.encryption.currentKekVersion;
    const progress: RotationProgress = {
      total: 0,
      rotated: 0,
      failed: 0,
      skipped: 0,
      legacy: 0,
    };

    if (!this.encryption.isRotationActive) {
      this.logger.warn(
        "No previous KEK configured — nothing to rotate. " +
          "Set MASTER_ENCRYPTION_KEY_PREVIOUS to enable rotation.",
      );
      return progress;
    }

    this.logger.log(
      `Starting KEK rotation to version ${currentVersion} (batch=${batchSize})`,
    );

    await this.rotateUserCredentials(batchSize, currentVersion, progress);
    await this.rotatePolymarketUsCredentials(
      batchSize,
      currentVersion,
      progress,
    );

    this.logger.log(
      `KEK rotation complete: ${progress.rotated} rotated, ${progress.failed} failed, ${progress.skipped} skipped, ${progress.legacy} legacy out of ${progress.total} total`,
    );

    return progress;
  }

  /**
   * Get count of credentials that still need rotation attention.
   *
   * Counts rows on old KEK versions (fast COUNT query) AND rows on the
   * current KEK version that fail AAD decrypt — same-version legacy rows
   * that were imported or created before the AAD binding was introduced.
   * These rows are surfaced as `legacy` in `rotateAll()` progress and must
   * be re-imported; they must not be silently excluded from the pending
   * metric.
   *
   * The scan of current-KEK rows uses cursor-based batches to stay
   * memory-bounded on large tables.
   */
  async getPendingCount(): Promise<number> {
    const currentVersion = this.encryption.currentKekVersion;
    const whereOld = { kekVersion: { not: currentVersion } };
    const [userOld, polymarketUsOld] = await Promise.all([
      this.prisma.userCredential.count({ where: whereOld }),
      this.prisma.polymarketUsCredential.count({ where: whereOld }),
    ]);
    let pending = userOld + polymarketUsOld;

    const [userLegacy, polymarketUsLegacy] = await Promise.all([
      this.countSameVersionLegacyUser(currentVersion),
      this.countSameVersionLegacyPolymarketUs(currentVersion),
    ]);

    return pending + userLegacy + polymarketUsLegacy;
  }

  private async countSameVersionLegacyUser(
    currentVersion: number,
  ): Promise<number> {
    let count = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.userCredential.findMany({
        where: { kekVersion: currentVersion },
        select: {
          userId: true,
          encryptedDek: true,
          dekIv: true,
          privateKeyCt: true,
          privateKeyIv: true,
          privateKeyTag: true,
          apiKeyCt: true,
          apiKeyIv: true,
          apiKeyTag: true,
          apiSecretCt: true,
          apiSecretIv: true,
          apiSecretTag: true,
          apiPassphraseCt: true,
          apiPassphraseIv: true,
          apiPassphraseTag: true,
        },
        take: 200,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: "asc" },
      });

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].userId;

      for (const row of rows) {
        let probeDek: Buffer | undefined;
        let probePlaintext: Buffer | undefined;
        try {
          probeDek = this.encryption.decryptDek(
            row.encryptedDek,
            row.dekIv,
            currentVersion,
            { aad: credentialDekAad(row.userId) },
          );
          // Probe ALL field AADs — a mixed-state row (AAD-bound DEK
          // but legacy/no-AAD fields) must not be counted as healthy.
          for (const field of USER_CREDENTIAL_FIELDS) {
            probePlaintext = this.encryption.decryptFieldBytes(
              row[`${field}Ct`],
              row[`${field}Iv`],
              row[`${field}Tag`],
              probeDek,
              { aad: credentialFieldAad(row.userId, field) },
            );
            probePlaintext.fill(0);
          }
        } catch {
          count++;
        } finally {
          probeDek?.fill(0);
          probePlaintext?.fill(0);
        }
      }

      if (rows.length < 200) break;
    }

    return count;
  }

  private async countSameVersionLegacyPolymarketUs(
    currentVersion: number,
  ): Promise<number> {
    let count = 0;
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.polymarketUsCredential.findMany({
        where: { kekVersion: currentVersion },
        select: {
          userId: true,
          encryptedDek: true,
          dekIv: true,
          secretKeyCt: true,
          secretKeyIv: true,
          secretKeyTag: true,
        },
        take: 200,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: "asc" },
      });

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].userId;

      for (const row of rows) {
        let probeDek: Buffer | undefined;
        let probePlaintext: Buffer | undefined;
        try {
          probeDek = this.encryption.decryptDek(
            row.encryptedDek,
            row.dekIv,
            currentVersion,
            { aad: polymarketUsCredentialDekAad(row.userId) },
          );
          probePlaintext = this.encryption.decryptFieldBytes(
            row.secretKeyCt,
            row.secretKeyIv,
            row.secretKeyTag,
            probeDek,
            { aad: polymarketUsCredentialFieldAad(row.userId, "secretKey") },
          );
          probePlaintext.fill(0);
        } catch {
          count++;
        } finally {
          probeDek?.fill(0);
          probePlaintext?.fill(0);
        }
      }

      if (rows.length < 200) break;
    }

    return count;
  }

  private async rotateUserCredentials(
    batchSize: number,
    currentVersion: number,
    progress: RotationProgress,
  ): Promise<void> {
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.prisma.userCredential.findMany({
        where: {},
        select: {
          userId: true,
          encryptedDek: true,
          dekIv: true,
          kekVersion: true,
          privateKeyCt: true,
          privateKeyIv: true,
          privateKeyTag: true,
          apiKeyCt: true,
          apiKeyIv: true,
          apiKeyTag: true,
          apiSecretCt: true,
          apiSecretIv: true,
          apiSecretTag: true,
          apiPassphraseCt: true,
          apiPassphraseIv: true,
          apiPassphraseTag: true,
        },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: "asc" },
      });

      if (rows.length === 0) break;

      progress.total += rows.length;
      cursor = rows[rows.length - 1].userId;

      for (const row of rows as UserCredentialRotationRow[]) {
        if (row.kekVersion === currentVersion) {
          let probeDek: Buffer | undefined;
          let probePlaintext: Buffer | undefined;
          try {
            probeDek = this.encryption.decryptDek(
              row.encryptedDek,
              row.dekIv,
              row.kekVersion,
              { aad: credentialDekAad(row.userId) },
            );
            // Verify ALL field AADs before skipping — a mixed-state row
            // (AAD-bound DEK but legacy no-AAD fields) must not be
            // reported healthy.  Each field is independently encrypted
            // and can be in a different AAD state.
            for (const field of USER_CREDENTIAL_FIELDS) {
              probePlaintext = this.encryption.decryptFieldBytes(
                row[`${field}Ct`],
                row[`${field}Iv`],
                row[`${field}Tag`],
                probeDek,
                { aad: credentialFieldAad(row.userId, field) },
              );
              probePlaintext.fill(0);
            }
            progress.skipped++;
            continue;
          } catch {
            // DEK AAD or field AAD failed — legacy row or mixed state.
            // Fall through to rotation path for classification.
          } finally {
            probeDek?.fill(0);
            probePlaintext?.fill(0);
          }
        }

        try {
          const rotated = this.rotateUserCredentialRow(row);

          try {
            await this.prisma.userCredential.update({
              where: { userId: row.userId, kekVersion: row.kekVersion },
              data: rotated,
            });
            progress.rotated++;
          } catch (updateErr: unknown) {
            if (
              updateErr &&
              typeof updateErr === "object" &&
              "code" in updateErr &&
              (updateErr as Record<string, unknown>).code === "P2025"
            ) {
              progress.skipped++;
              this.logger.warn(
                `Skipped rotation for user ${row.userId}: row was modified by a concurrent writer`,
              );
            } else {
              throw updateErr;
            }
          }
        } catch (err) {
          if (err instanceof LegacyNoAadCredentialError) {
            progress.legacy++;
            this.logger.warn(err.message);
          } else {
            progress.failed++;
            this.logger.error(
              `Failed to rotate DEK for user ${row.userId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      if (rows.length < batchSize) hasMore = false;
    }
  }

  private rotateUserCredentialRow(row: UserCredentialRotationRow) {
    const dek = this.decryptDekForRotation(
      row.encryptedDek,
      row.dekIv,
      row.kekVersion,
      credentialDekAad(row.userId),
      "user credential DEK",
      row.userId,
    );
    const plaintexts: Partial<Record<UserCredentialField, Buffer>> = {};

    try {
      for (const field of USER_CREDENTIAL_FIELDS) {
        plaintexts[field] = this.decryptFieldForRotation(
          row[`${field}Ct`],
          row[`${field}Iv`],
          row[`${field}Tag`],
          dek,
          credentialFieldAad(row.userId, field),
          `user credential ${field}`,
          row.userId,
        );
      }

      const rotated = this.encryption.wrapDek(dek, {
        aad: credentialDekAad(row.userId),
      });

      return {
        encryptedDek: rotated.encryptedDek,
        dekIv: rotated.dekIv,
        kekVersion: rotated.kekVersion,
        ...this.encryptUserCredentialFields(row.userId, dek, plaintexts),
      };
    } finally {
      dek.fill(0);
      for (const plaintext of Object.values(plaintexts)) {
        plaintext?.fill(0);
      }
    }
  }

  private encryptUserCredentialFields(
    userId: string,
    dek: Buffer,
    plaintexts: Partial<Record<UserCredentialField, Buffer>>,
  ) {
    const encrypted: Record<string, Uint8Array> = {};

    for (const field of USER_CREDENTIAL_FIELDS) {
      const plaintext = plaintexts[field];
      if (!plaintext) {
        throw new Error(`Missing decrypted ${field} during KEK rotation`);
      }
      const enc = this.encryption.encryptFieldBytes(plaintext, dek, {
        aad: credentialFieldAad(userId, field),
      });
      encrypted[`${field}Ct`] = enc.ciphertext;
      encrypted[`${field}Iv`] = enc.iv;
      encrypted[`${field}Tag`] = enc.tag;
    }

    return encrypted;
  }

  private async rotatePolymarketUsCredentials(
    batchSize: number,
    currentVersion: number,
    progress: RotationProgress,
  ): Promise<void> {
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.prisma.polymarketUsCredential.findMany({
        where: {},
        select: {
          userId: true,
          encryptedDek: true,
          dekIv: true,
          kekVersion: true,
          secretKeyCt: true,
          secretKeyIv: true,
          secretKeyTag: true,
        },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: "asc" },
      });

      if (rows.length === 0) break;

      progress.total += rows.length;
      cursor = rows[rows.length - 1].userId;

      for (const row of rows as PolymarketUsCredentialRotationRow[]) {
        if (row.kekVersion === currentVersion) {
          let probeDek: Buffer | undefined;
          let probePlaintext: Buffer | undefined;
          try {
            probeDek = this.encryption.decryptDek(
              row.encryptedDek,
              row.dekIv,
              row.kekVersion,
              { aad: polymarketUsCredentialDekAad(row.userId) },
            );
            // Verify field AAD before skipping — a row with AAD-bound DEK
            // but legacy no-AAD field blobs must not be reported healthy.
            probePlaintext = this.encryption.decryptFieldBytes(
              row.secretKeyCt,
              row.secretKeyIv,
              row.secretKeyTag,
              probeDek,
              {
                aad: polymarketUsCredentialFieldAad(row.userId, "secretKey"),
              },
            );
            probePlaintext.fill(0);
            progress.skipped++;
            continue;
          } catch {
            // DEK AAD or field AAD failed — legacy row or mixed state.
            // Fall through to rotation path for classification.
          } finally {
            probeDek?.fill(0);
            probePlaintext?.fill(0);
          }
        }

        try {
          const rotated = this.rotatePolymarketUsCredentialRow(row);

          try {
            await this.prisma.polymarketUsCredential.update({
              where: { userId: row.userId, kekVersion: row.kekVersion },
              data: rotated,
            });
            progress.rotated++;
          } catch (updateErr: unknown) {
            if (
              updateErr &&
              typeof updateErr === "object" &&
              "code" in updateErr &&
              (updateErr as Record<string, unknown>).code === "P2025"
            ) {
              progress.skipped++;
              this.logger.warn(
                `Skipped Polymarket US rotation for user ${row.userId}: row was modified by a concurrent writer`,
              );
            } else {
              throw updateErr;
            }
          }
        } catch (err) {
          if (err instanceof LegacyNoAadCredentialError) {
            progress.legacy++;
            this.logger.warn(err.message);
          } else {
            progress.failed++;
            this.logger.error(
              `Failed to rotate Polymarket US DEK for user ${row.userId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      if (rows.length < batchSize) hasMore = false;
    }
  }

  private rotatePolymarketUsCredentialRow(
    row: PolymarketUsCredentialRotationRow,
  ) {
    const dek = this.decryptDekForRotation(
      row.encryptedDek,
      row.dekIv,
      row.kekVersion,
      polymarketUsCredentialDekAad(row.userId),
      "Polymarket US credential DEK",
      row.userId,
    );
    let secretKey: Buffer | undefined;

    try {
      secretKey = this.decryptFieldForRotation(
        row.secretKeyCt,
        row.secretKeyIv,
        row.secretKeyTag,
        dek,
        polymarketUsCredentialFieldAad(row.userId, "secretKey"),
        "Polymarket US credential secretKey",
        row.userId,
      );

      const rotated = this.encryption.wrapDek(dek, {
        aad: polymarketUsCredentialDekAad(row.userId),
      });
      const secretKeyEnc = this.encryption.encryptFieldBytes(secretKey, dek, {
        aad: polymarketUsCredentialFieldAad(row.userId, "secretKey"),
      });

      return {
        encryptedDek: rotated.encryptedDek,
        dekIv: rotated.dekIv,
        kekVersion: rotated.kekVersion,
        secretKeyCt: secretKeyEnc.ciphertext,
        secretKeyIv: secretKeyEnc.iv,
        secretKeyTag: secretKeyEnc.tag,
      };
    } finally {
      dek.fill(0);
      secretKey?.fill(0);
    }
  }

  private decryptDekForRotation(
    encryptedDek: Uint8Array,
    dekIv: Uint8Array,
    kekVersion: number,
    aad: Buffer,
    scope: string,
    userId: string,
  ): Buffer {
    try {
      return this.encryption.decryptDek(encryptedDek, dekIv, kekVersion, {
        aad,
      });
    } catch (aadErr) {
      let legacyDek: Buffer | undefined;
      try {
        legacyDek = this.encryption.decryptDek(
          encryptedDek,
          dekIv,
          kekVersion,
          {
            aad,
            allowLegacyNoAadFallback: true,
          },
        );
      } catch {
        throw aadErr;
      } finally {
        legacyDek?.fill(0);
      }
      throw new LegacyNoAadCredentialError(scope, userId);
    }
  }

  private decryptFieldForRotation(
    ciphertext: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    dek: Buffer,
    aad: Buffer,
    scope: string,
    userId: string,
  ): Buffer {
    try {
      return this.encryption.decryptFieldBytes(ciphertext, iv, tag, dek, {
        aad,
      });
    } catch (aadErr) {
      let legacyPlaintext: Buffer | undefined;
      try {
        legacyPlaintext = this.encryption.decryptFieldBytes(
          ciphertext,
          iv,
          tag,
          dek,
          {
            aad,
            allowLegacyNoAadFallback: true,
          },
        );
      } catch {
        throw aadErr;
      } finally {
        legacyPlaintext?.fill(0);
      }
      throw new LegacyNoAadCredentialError(scope, userId);
    }
  }
}
