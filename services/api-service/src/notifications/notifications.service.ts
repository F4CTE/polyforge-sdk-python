import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { paginate } from "../common/dto/pagination.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notificationHistory.findMany({
        where: { userId },
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notificationHistory.count({ where: { userId } }),
    ]);

    return paginate(data, total, page, limit);
  }
}
