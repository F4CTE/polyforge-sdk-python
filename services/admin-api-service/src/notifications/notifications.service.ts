import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { BroadcastDto } from './dto/broadcast.dto';

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
            targetIds = users.map(u => u.id);
        }

        // Publish broadcast event to stream:events for each user
        // In a real implementation, notification-service would handle this via a BROADCAST event type
        // For now, publish individual NOTIFICATION events
        const ts = Date.now();
        let queued = 0;

        for (const userId of targetIds) {
            await this.redis.xadd('stream:events', {
                type: 'NOTIFICATION',
                userId,
                channel: dto.channel,
                templateId: dto.templateId,
                subject: dto.subject,
                metadata: JSON.stringify(dto.metadata ?? {}),
                ts: String(ts),
                source: 'admin-broadcast',
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
