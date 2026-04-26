import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { BroadcastDto } from "./dto/broadcast.dto";

const MAX_BROADCAST_RECIPIENTS = 5000;

@Injectable()
export class NotificationsAdminService {
  private readonly logger = new Logger(NotificationsAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async broadcast(dto: BroadcastDto) {
    // Resolve target user IDs
    let targetIds: string[];
    if (dto.userIds && dto.userIds.length > 0) {
      targetIds = dto.userIds;
    } else {
      // All active users
      const users = await this.prisma.user.findMany({
        where: { deleted: false, suspended: false, emailVerified: true },
        select: { id: true },
      });
      targetIds = users.map((u) => u.id);
    }

    if (targetIds.length > MAX_BROADCAST_RECIPIENTS) {
      throw new BadRequestException({
        code: "BROADCAST_TOO_LARGE",
        message: `Broadcast exceeds the ${MAX_BROADCAST_RECIPIENTS}-recipient cap. Segment your audience or use multiple batches.`,
      });
    }

    const ts = Date.now();
    let queued = 0;

    for (const userId of targetIds) {
      await this.redis.xadd("stream:events", {
        type: "NOTIFICATION",
        userId,
        channel: dto.channel,
        templateId: dto.templateId,
        subject: dto.subject,
        metadata: JSON.stringify(dto.metadata ?? {}),
        ts: String(ts),
        source: "admin-broadcast",
      });
      queued++;
    }

    this.logger.log(`Broadcast queued for ${queued} users via ${dto.channel}`);
    return { queued, channel: dto.channel };
  }

  async getStats() {
    const [total, last24h, failed] = await Promise.all([
      this.prisma.notificationHistory.count(),
      this.prisma.notificationHistory.count({
        where: { sentAt: { gte: new Date(Date.now() - 86400_000) } },
      }),
      this.prisma.notificationHistory.count({
        where: { success: false },
      }),
    ]);

    return { total, last24h, failed };
  }
}
