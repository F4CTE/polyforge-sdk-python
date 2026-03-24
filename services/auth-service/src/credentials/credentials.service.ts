import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@polyforge/shared-db';
import { ImportCredentialsDto } from './dto/import-credentials.dto';
import { randomUUID } from 'crypto';

/**
 * Forwards encrypted credential storage to signer-service.
 *
 * Security boundary: auth-service NEVER sees or stores the raw private key beyond
 * the duration of this HTTP forwarding request. signer-service owns all encryption.
 */
@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
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
    this.internalJwtSecret = this.config.getOrThrow<string>('INTERNAL_JWT_SECRET');
  }

  private issueInternalToken(): string {
    return this.jwt.sign(
      { sub: 'auth-service', jti: randomUUID() },
      { secret: this.internalJwtSecret, audience: 'signer-service', expiresIn: '30s' },
    );
  }

  // ─── Import ───────────────────────────────────────────────────────────────────

  async import(userId: string, dto: ImportCredentialsDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.emailVerified) {
      throw new HttpException(
        {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'You must verify your email before connecting Polymarket',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Forward to signer-service — it handles AES-256-GCM encryption + storage
    await this.forwardToSigner(userId, dto);

    // Mark user as connected
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        polymarketConnected: true,
        polymarketAddress: dto.walletAddress,
        polymarketSigType: dto.sigType,
      },
    });

    this.logger.log(`Polymarket credentials imported for user ${userId}`);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  async delete(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.polymarketConnected) {
      throw new HttpException(
        {
          code: 'CREDENTIALS_NOT_FOUND',
          message: 'No Polymarket credentials found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Stop all running strategies before deleting credentials
    await this.stopRunningStrategies(userId);

    // Notify signer-service to remove the stored credentials
    await this.deleteFromSigner(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        polymarketConnected: false,
        polymarketAddress: null,
        polymarketSigType: null,
      },
    });

    this.logger.log(`Polymarket credentials deleted for user ${userId}`);
  }

  // ─── Stop running strategies ──────────────────────────────────────────────

  private async stopRunningStrategies(userId: string): Promise<void> {
    try {
      const token = this.issueInternalToken();
      const listUrl = `${this.strategyEngineUrl}/internal/strategies?userId=${encodeURIComponent(userId)}&status=RUNNING`;

      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!listRes.ok) {
        this.logger.warn(
          `Failed to fetch running strategies for user ${userId}: ${listRes.status}`,
        );
        return;
      }

      const strategies: any[] = await listRes.json();

      for (const s of strategies) {
        try {
          const stopToken = this.issueInternalToken();
          await fetch(`${this.strategyEngineUrl}/internal/strategies/${s.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stopToken}` },
            signal: AbortSignal.timeout(10_000),
          });
          this.logger.log(`Stopped strategy ${s.id} before credential deletion for user ${userId}`);
        } catch (err) {
          this.logger.warn(`Failed to stop strategy ${s.id}: ${(err as Error)?.message}`);
        }
      }
    } catch (err) {
      // Strategy engine may be unavailable — log but don't block credential deletion
      this.logger.warn(
        `Could not reach strategy engine to stop strategies for user ${userId}: ${(err as Error)?.message}`,
      );
    }
  }

  // ─── Internal HTTP to signer-service ─────────────────────────────────────────

  private async forwardToSigner(
    userId: string,
    dto: ImportCredentialsDto,
  ): Promise<void> {
    const url = `${this.signerUrl}/internal/v1/credentials`;

    try {
      const token = this.issueInternalToken();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...dto }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this.logger.error(
          `signer-service rejected credentials: ${res.status}`,
          body,
        );
        throw new HttpException(
          {
            code: 'SIGNER_ERROR',
            message: 'Failed to store credentials securely',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('signer-service unreachable', err);
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
    const url = `${this.signerUrl}/internal/v1/credentials/${userId}`;

    try {
      const token = this.issueInternalToken();
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok && res.status !== 404) {
        this.logger.error(
          `signer-service credential delete failed: ${res.status}`,
        );
        throw new HttpException(
          { code: 'SIGNER_ERROR', message: 'Failed to remove credentials' },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('signer-service unreachable during delete', err);
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
