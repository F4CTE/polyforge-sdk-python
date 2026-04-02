import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "./encryption.service";

export interface RotationProgress {
  total: number;
  rotated: number;
  failed: number;
  skipped: number;
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

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.prisma.userCredential.findMany({
        where: { kekVersion: { not: currentVersion } },
        select: {
          userId: true,
          encryptedDek: true,
          dekIv: true,
          kekVersion: true,
        },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: "asc" },
      });

      if (rows.length === 0) {
        break;
      }

      progress.total += rows.length;
      cursor = rows[rows.length - 1].userId;

      for (const row of rows) {
        if (row.kekVersion === currentVersion) {
          progress.skipped++;
          continue;
        }

        try {
          const rotated = this.encryption.rotateUserDek(
            row.encryptedDek,
            row.dekIv,
            row.kekVersion,
          );

          await this.prisma.userCredential.update({
            where: { userId: row.userId },
            data: {
              encryptedDek: rotated.encryptedDek,
              dekIv: rotated.dekIv,
              kekVersion: rotated.kekVersion,
            },
          });

          progress.rotated++;
        } catch (err) {
          progress.failed++;
          this.logger.error(
            `Failed to rotate DEK for user ${row.userId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (rows.length < batchSize) {
        hasMore = false;
      }
    }

    this.logger.log(
      `KEK rotation complete: ${progress.rotated} rotated, ${progress.failed} failed, ${progress.skipped} skipped out of ${progress.total} total`,
    );

    return progress;
  }

  /** Get count of credentials still on old KEK versions. */
  async getPendingCount(): Promise<number> {
    return this.prisma.userCredential.count({
      where: { kekVersion: { not: this.encryption.currentKekVersion } },
    });
  }
}
