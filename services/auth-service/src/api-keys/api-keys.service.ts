import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService, runOncePerCluster } from '@polyforge/shared-redis';
import { createHash, randomBytes } from 'crypto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const MAX_ACTIVE_KEYS = 10;
const DEPRECATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    // Enforce max active keys
    const activeCount = await this.prisma.apiKey.count({
      where: { userId, revoked: false },
    });

    if (activeCount >= MAX_ACTIVE_KEYS) {
      throw new HttpException(
        {
          code: 'MAX_API_KEYS',
          message: `You can have at most ${MAX_ACTIVE_KEYS} active API keys`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // Generate plaintext token: pf_ + 32 random bytes hex (64 chars)
    const rawToken = randomBytes(32).toString('hex');
    const plaintext = `pf_${rawToken}`;
    // The prefix is intentionally the first 7 chars ("pf_" + 4 hex) for identification
    // purposes only (similar to GitHub's gh_ tokens). It does not weaken security
    // because the full token is 67 chars and the hash is stored, not the plaintext.
    const prefix = plaintext.slice(0, 7);
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        prefix,
        tokenHash,
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    this.logger.log(`API key created: id=${apiKey.id} user=${userId}`);

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: plaintext, // returned ONCE — never stored
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        revoked: true,
        createdAt: true,
      },
    });

    return keys;
  }

  async revoke(id: string, userId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey || apiKey.userId !== userId) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'API key not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (apiKey.revoked) {
      throw new HttpException(
        { code: 'ALREADY_REVOKED', message: 'API key is already revoked' },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    return { revoked: true };
  }

  // ─── Key Rotation ──────────────────────────────────────────────────────────

  /**
   * Rotates an API key: creates a new key and marks the old one as deprecated.
   * Both keys work during a 24-hour grace period, after which the old key is
   * automatically revoked by the hourly cron job.
   */
  async rotateKey(oldKeyId: string, userId: string) {
    const oldKey = await this.prisma.apiKey.findUnique({
      where: { id: oldKeyId },
    });

    if (!oldKey || oldKey.userId !== userId) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'API key not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (oldKey.revoked) {
      throw new HttpException(
        { code: 'ALREADY_REVOKED', message: 'Cannot rotate a revoked key' },
        HttpStatus.CONFLICT,
      );
    }

    // Create the new key reusing create() logic
    const newKey = await this.create(userId, {
      name: `${oldKey.name} (rotated)`,
      scopes: oldKey.scopes,
      expiresAt: oldKey.expiresAt?.toISOString() ?? undefined,
    });

    // Mark the old key as deprecated with a 24-hour grace period
    const deprecatedAt = new Date();
    const deprecatedExpiresAt = new Date(
      deprecatedAt.getTime() + DEPRECATION_GRACE_PERIOD_MS,
    );

    await this.prisma.apiKey.update({
      where: { id: oldKeyId },
      data: {
        deprecated: true,
        deprecatedAt,
        deprecatedExpiresAt,
      } as any,
    });

    this.logger.log(
      `API key rotated: old=${oldKeyId} new=${newKey.id} user=${userId} ` +
        `graceExpires=${deprecatedExpiresAt.toISOString()}`,
    );

    return {
      newKey,
      oldKeyId,
      graceExpiresAt: deprecatedExpiresAt,
    };
  }

  // ─── Cron: Revoke expired deprecated keys ──────────────────────────────────

  /**
   * Runs every hour to revoke deprecated keys whose grace period has expired.
   */
  @Cron('0 * * * *')
  async revokeExpiredDeprecatedKeys(): Promise<number> {
    return (
      (await runOncePerCluster({
        redis: this.redis,
        key: 'lock:cron:api-keys:revokeExpiredDeprecatedKeys',
        ttlMs: 3_000_000,
        job: async () => {
          const now = new Date();

          const expiredKeys = await this.prisma.apiKey.findMany({
            where: {
              deprecated: true,
              revoked: false,
              deprecatedExpiresAt: { lte: now },
            } as any,
            select: { id: true },
          });

          if (expiredKeys.length === 0) return 0;

          await this.prisma.apiKey.updateMany({
            where: {
              id: { in: expiredKeys.map((k) => k.id) },
            },
            data: {
              revoked: true,
              revokedAt: now,
            },
          });

          this.logger.log(
            `Revoked ${expiredKeys.length} deprecated API key(s) past grace period`,
          );

          return expiredKeys.length;
        },
      })) ?? 0
    );
  }
}
