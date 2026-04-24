import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { ImportKalshiCredentialsDto } from './dto/import-kalshi-credentials.dto';

@Injectable()
export class KalshiCredentialsService {
  private readonly logger = new Logger(KalshiCredentialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async import(
    authenticatedUserId: string,
    dto: ImportKalshiCredentialsDto,
  ): Promise<void> {
    await this.prisma.user.findUniqueOrThrow({
      where: { id: authenticatedUserId },
    });

    await this.prisma.user.update({
      where: { id: authenticatedUserId },
      data: {
        kalshiConnected: true,
        kalshiUserId: dto.userId,
      },
    });

    this.logger.log(
      `Kalshi credentials stored for user ${authenticatedUserId}`,
    );
  }

  async delete(authenticatedUserId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authenticatedUserId },
    });

    if (!user.kalshiConnected) {
      throw new HttpException(
        {
          code: 'CREDENTIALS_NOT_FOUND',
          message: 'No Kalshi credentials found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.user.update({
      where: { id: authenticatedUserId },
      data: {
        kalshiConnected: false,
        kalshiUserId: null,
      },
    });

    this.logger.log(
      `Kalshi credentials deleted for user ${authenticatedUserId}`,
    );
  }
}
