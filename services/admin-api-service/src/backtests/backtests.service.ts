import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";

@Injectable()
export class BacktestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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

  async cancel(id: string) {
    const run = await this.prisma.backtestRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Backtest run not found",
      });
    }

    await this.prisma.backtestRun.update({
      where: { id },
      data: { status: "CANCELLED" as any, completedAt: new Date() },
    });

    // Publish cancellation event to stream
    await this.redis.xadd("stream:backtests:cancel", {
      runId: id,
      ts: String(Date.now()),
    });

    return { id, status: "CANCELLED" };
  }
}
