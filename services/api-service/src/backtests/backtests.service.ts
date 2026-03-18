import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";
import { CreateBacktestDto } from "./dto/create-backtest.dto";

export interface BacktestQueryDto extends PaginationDto {
  strategyId?: string;
  status?: string;
}

@Injectable()
export class BacktestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(
    userId: string,
    query: BacktestQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, strategyId, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (strategyId) where.strategyId = strategyId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      this.prisma.backtestRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.backtestRun.count({ where }),
    ]);

    return paginate(runs, total, page, limit);
  }

  async create(userId: string, dto: CreateBacktestDto): Promise<any> {
    if (dto.quickMode) {
      // Quick mode: return a stub result (backtest-service not yet implemented)
      return {
        totalOrders: 0,
        filledOrders: 0,
        totalPnl: "0.00",
        winRate: "0.00",
        hasDataGaps: false,
      };
    }

    const run = await this.prisma.backtestRun.create({
      data: {
        userId,
        strategyId: dto.strategyId ?? "",
        dateRangeStart: dto.dateRangeStart
          ? new Date(dto.dateRangeStart)
          : new Date(0),
        dateRangeEnd: dto.dateRangeEnd
          ? new Date(dto.dateRangeEnd)
          : new Date(),
        status: "QUEUED" as any,
      },
    });

    // Publish to stream:backtests so backtest-service picks it up
    await this.redis.xadd("stream:backtests", {
      runId: run.id,
      userId,
      strategyId: dto.strategyId ?? "",
      ts: String(Date.now()),
    });

    return { runId: run.id, status: "QUEUED" };
  }

  async findOne(id: string, userId: string): Promise<any> {
    const run = await this.prisma.backtestRun.findUnique({ where: { id } });
    if (!run || run.userId !== userId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Backtest run not found",
      });
    }
    return run;
  }
}
