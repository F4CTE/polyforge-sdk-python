import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";

@Injectable()
export class BacktestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page: number;
    limit: number;
    userId?: string;
    status?: string;
  }) {
    const { page, limit, userId, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BacktestRunWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status as any;

    const [runs, total] = await Promise.all([
      this.prisma.backtestRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          strategyId: true,
          status: true,
          dateRangeStart: true,
          dateRangeEnd: true,
          totalPnl: true,
          winRate: true,
          sharpeRatio: true,
          createdAt: true,
          completedAt: true,
          user: { select: { username: true } },
          strategy: { select: { name: true } },
        },
      }),
      this.prisma.backtestRun.count({ where }),
    ]);

    return {
      data: runs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
