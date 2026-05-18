import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { deriveServiceKey } from '@polyforge/shared-auth';
import { PrismaService } from '@polyforge/shared-db';
import { CURRENT_US_RAIL_TERMS_VERSION } from '@polyforge/shared-types';
import { randomUUID } from 'crypto';
import { ImportPolymarketUsCredentialsDto } from './dto/import-polymarket-us-credentials.dto';

@Injectable()
export class PolymarketUsCredentialsService {
  private readonly logger = new Logger(PolymarketUsCredentialsService.name);
  private readonly signerUrl: string;
  private readonly strategyEngineUrl: string;
  private readonly internalJwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.signerUrl = this.config.get<string>(
      'SIGNER_SERVICE_URL',
      'http://signer-service:3004',
    );
    this.strategyEngineUrl = this.config.get<string>(
      'STRATEGY_ENGINE_URL',
      'http://strategy-engine:3006',
    );
    this.internalJwtSecret = deriveServiceKey(
      this.config.getOrThrow<string>('INTERNAL_JWT_SECRET'),
      'auth-service',
    );
  }

  private issueInternalToken(): string {
    return this.jwt.sign(
      { sub: 'auth-service', jti: randomUUID() },
      {
        secret: this.internalJwtSecret,
        audience: 'signer-service',
        issuer: 'auth-service',
        expiresIn: '30s',
        algorithm: 'HS256',
      },
    );
  }

  // ─── Import ───────────────────────────────────────────────────────────────────

  async import(
    userId: string,
    dto: ImportPolymarketUsCredentialsDto,
    countryCode: string | undefined,
    requestIp?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.assertCurrentUsRailTermsAccepted(dto);

    // Forward to signer-service — encrypts Ed25519 secret via existing DEK/KEK envelope
    await this.forwardToSigner(userId, dto);

    // Mark US rail connected and record jurisdiction
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        polymarketUsConnected: true,
        usRailTermsAcceptedAt: new Date(),
        usRailTermsVersion: CURRENT_US_RAIL_TERMS_VERSION,
        usRailTermsAcceptedIp: requestIp,
        usRailTermsAcceptedUserAgent: userAgent?.slice(0, 512),
        ...(countryCode ? { country: countryCode } : {}),
      },
    });

    this.logger.log(`Polymarket US credentials imported for user ${userId}`);
  }

  private assertCurrentUsRailTermsAccepted(
    dto: ImportPolymarketUsCredentialsDto,
  ): void {
    if (
      dto.usRailTermsAccepted !== true ||
      dto.usRailTermsVersion !== CURRENT_US_RAIL_TERMS_VERSION
    ) {
      throw new HttpException(
        {
          code: 'US_RAIL_TERMS_REQUIRED',
          message: 'Accept the current US-rail legal terms before continuing.',
          requiredVersion: CURRENT_US_RAIL_TERMS_VERSION,
        },
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  async delete(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.polymarketUsConnected) {
      throw new HttpException(
        {
          code: 'CREDENTIALS_NOT_FOUND',
          message: 'No Polymarket US credentials found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Stop US-rail strategies before wiping credentials
    await this.stopUsRailStrategies(userId);

    await this.deleteFromSigner(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { polymarketUsConnected: false },
    });

    this.logger.log(`Polymarket US credentials deleted for user ${userId}`);
  }

  // ─── Stop US-rail strategies ──────────────────────────────────────────────

  private async stopUsRailStrategies(userId: string): Promise<void> {
    try {
      const token = this.issueInternalToken();
      const listUrl = `${this.strategyEngineUrl}/internal/strategies?userId=${encodeURIComponent(userId)}&status=RUNNING&venue=polymarket_us`;

      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!listRes.ok) {
        this.logger.warn(
          `Failed to fetch running US strategies for user ${userId}: ${listRes.status}`,
        );
        return;
      }

      const strategies = (await listRes.json()) as any[];

      for (const s of strategies) {
        try {
          const stopToken = this.issueInternalToken();
          await fetch(`${this.strategyEngineUrl}/internal/strategies/${s.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stopToken}` },
            signal: AbortSignal.timeout(10_000),
          });
          this.logger.log(
            `Stopped US-rail strategy ${s.id} for user ${userId}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to stop US strategy ${s.id}: ${(err as Error)?.message}`,
          );
        }
      }
    } catch (err) {
      // Strategy engine unavailable — log but don't block credential deletion
      this.logger.warn(
        `Could not reach strategy engine to stop US strategies for user ${userId}: ${(err as Error)?.message}`,
      );
    }
  }

  // ─── Internal HTTP to signer-service ─────────────────────────────────────────

  private async forwardToSigner(
    userId: string,
    dto: ImportPolymarketUsCredentialsDto,
  ): Promise<void> {
    const url = `${this.signerUrl}/internal/us-credentials`;

    try {
      const token = this.issueInternalToken();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          keyId: dto.keyId,
          secretKey: dto.secretKey,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.error(
          `signer-service rejected US credentials: ${res.status}`,
        );
        throw new HttpException(
          {
            code: 'SIGNER_ERROR',
            message: 'Failed to store US credentials securely',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('signer-service unreachable for US credentials', err);
      throw new HttpException(
        {
          code: 'SIGNER_UNAVAILABLE',
          message: 'Credential storage service is unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async deleteFromSigner(userId: string): Promise<void> {
    const url = `${this.signerUrl}/internal/us-credentials/${userId}`;

    try {
      const token = this.issueInternalToken();
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok && res.status !== 404) {
        this.logger.error(
          `signer-service US credential delete failed: ${res.status}`,
        );
        throw new HttpException(
          {
            code: 'SIGNER_ERROR',
            message: 'Failed to remove US credentials',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(
        'signer-service unreachable during US credential delete',
        err,
      );
      throw new HttpException(
        {
          code: 'SIGNER_UNAVAILABLE',
          message: 'Credential storage service is unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
