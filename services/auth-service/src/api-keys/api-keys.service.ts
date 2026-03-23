import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { createHash, randomBytes } from 'crypto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const MAX_ACTIVE_KEYS = 10;

// TODO: Implement API key rotation flow (create new key → deprecation period → revoke old).
// This allows users to rotate keys without downtime and should be added in a future version.

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
