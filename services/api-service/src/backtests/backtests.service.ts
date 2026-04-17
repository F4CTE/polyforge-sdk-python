import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { type BacktestRun, type BacktestOrder } from "@prisma/client";
import { RedisService } from "@polyforge/shared-redis";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";
import { CreateBacktestDto } from "./dto/create-backtest.dto";
import { BETA_LIMITS } from "../common/beta-limits.config";

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

    const where: Record<string, unknown> = { userId };
    if (strategyId) where.strategyId = strategyId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      this.prisma.backtestRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          strategy: { select: { name: true } },
        },
      }),
      this.prisma.backtestRun.count({ where }),
    ]);

    type RunWithStrategy = BacktestRun & { strategy: { name: string } | null };
    const mapped = (runs as RunWithStrategy[]).map((r) => ({
      ...r,
      strategyName: r.strategy?.name ?? null,
      strategy: undefined,
    }));

    return paginate(mapped, total, page, limit);
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

    // Enforce 90-day history window
    if (dto.dateRangeStart) {
      const start = new Date(dto.dateRangeStart);
      const maxStart = new Date();
      maxStart.setDate(maxStart.getDate() - BETA_LIMITS.maxBacktestHistoryDays);
      if (start < maxStart) {
        throw new UnprocessableEntityException({
          code: "BACKTEST_HISTORY_WINDOW_EXCEEDED",
          message: `Beta limit: backtest history is limited to the last ${BETA_LIMITS.maxBacktestHistoryDays} days.`,
        });
      }
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
        status: "QUEUED",
      },
    });

    // Publish to stream:backtests so backtest-service picks it up
    await this.redis.xadd("stream:backtests", {
      runId: run.id,
      userId,
      strategyId: dto.strategyId ?? "",
      marketBindings: dto.marketBindings
        ? JSON.stringify(dto.marketBindings)
        : "",
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

  async findOrders(id: string, userId: string): Promise<any[]> {
    const run = await this.prisma.backtestRun.findUnique({ where: { id } });
    if (!run || run.userId !== userId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Backtest run not found",
      });
    }
    const orders = await this.prisma.backtestOrder.findMany({
      where: { runId: id },
      orderBy: { simulatedAt: "asc" },
      select: {
        id: true,
        tokenId: true,
        side: true,
        outcome: true,
        size: true,
        price: true,
        fillPrice: true,
        pnl: true,
        equityCurve: true,
        simulatedAt: true,
      },
    });
    return (orders as BacktestOrder[]).map((o) => ({
      ...o,
      size: String(o.size),
      price: String(o.price),
      fillPrice: o.fillPrice != null ? String(o.fillPrice) : null,
      pnl: o.pnl != null ? String(o.pnl) : null,
      equityCurve: String(o.equityCurve),
    }));
  }
}
