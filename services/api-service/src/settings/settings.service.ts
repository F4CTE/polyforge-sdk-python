import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import * as bcrypt from "bcryptjs";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    const data: any = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.twitterHandle !== undefined) data.twitterHandle = dto.twitterHandle;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  async updateNotifications(
    userId: string,
    dto: UpdateNotificationsDto,
  ): Promise<any> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<any> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Current password is incorrect",
      });
    }

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    // R5-02: Mark password change timestamp so JWT guard can reject stale tokens
    try {
      await this.redis.set(`pwchange:${userId}`, Math.floor(Date.now() / 1000).toString(), 300);
    } catch (err) {
      this.logger.error(`Failed to set pwchange key for user ${userId}`, err);
    }

    // Revoke all refresh tokens for this user
    try {
      const client = this.redis.getClient();
      const stream = client.scanStream({ match: `refresh:${userId}:*`, count: 100 });
      stream.on("data", (keys: string[]) => {
        if (keys.length > 0) {
          void client.del(...keys);
        }
      });
    } catch (err) {
      this.logger.error(`Failed to revoke refresh tokens for user ${userId}`, err);
    }

    return { message: "Password updated" };
  }
}
