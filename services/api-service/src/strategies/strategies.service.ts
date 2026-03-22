import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  ReportReason,
  Strategy,
  StrategyStatus,
  StrategyVisibility,
  ExecMode,
} from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import { InternalClientService } from "../common/services/internal-client.service";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { ImportStrategyDto } from "./dto/import-strategy.dto";
import { PaginationDto } from "../common/dto/pagination.dto";

const MAX_STRATEGIES = 50;

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);
  private readonly engineUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly client: InternalClientService,
  ) {
    this.engineUrl = this.config.get<string>(
      "STRATEGY_ENGINE_URL",
      "http://strategy-engine:3006",
    );
  }

  async list(
    userId: string,
    query: StrategyQueryDto,
  ): Promise<PaginatedResponse<Strategy>> {
    const { page, limit, status, sort } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StrategyWhereInput = {
      userId,
      status: { not: StrategyStatus.ARCHIVED },
    };
    if (status) where.status = status as StrategyStatus;

    const orderBy = { [sort ?? "createdAt"]: "desc" as const };

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.strategy.count({ where }),
    ]);

    return paginate(strategies, total, page, limit);
  }

  async create(userId: string, dto: CreateStrategyDto): Promise<Strategy> {
    const count = await this.prisma.strategy.count({
      where: { userId, status: { not: StrategyStatus.ARCHIVED } },
    });
    if (count >= MAX_STRATEGIES) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: "Strategy limit reached",
      });
    }

    return this.prisma.strategy.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        visibility:
          (dto.visibility as StrategyVisibility) ?? StrategyVisibility.PRIVATE,
        execMode: (dto.execMode as ExecMode) ?? ExecMode.TICK,
        tickMs: dto.tickMs ?? 1000,
        triggers: (dto.triggers ?? []) as unknown as Prisma.InputJsonValue,
        conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions: (dto.actions ?? []) as unknown as Prisma.InputJsonValue,
        safety: (dto.safety ?? []) as unknown as Prisma.InputJsonValue,
        tags: dto.tags ?? [],
        canvas: dto.canvas as unknown as Prisma.InputJsonValue | undefined,
        status: StrategyStatus.IDLE,
        version: 1,
        template: false,
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Strategy & { childCount: number }> {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }
    if (
      strategy.visibility === StrategyVisibility.PRIVATE &&
      strategy.userId !== userId
    ) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }
    const childCount = await this.prisma.strategy.count({
      where: { parentStrategyId: id, status: { not: StrategyStatus.ARCHIVED } },
    });
    return { ...strategy, childCount };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateStrategyDto,
  ): Promise<Strategy> {
    const strategy = await this.getOwned(id, userId);
    if (strategy.status === StrategyStatus.RUNNING) {
      const blocksChanged =
        dto.triggers !== undefined ||
        dto.conditions !== undefined ||
        dto.actions !== undefined ||
        dto.safety !== undefined;
      if (blocksChanged) {
        throw new UnprocessableEntityException({
          code: "STRATEGY_IS_RUNNING",
          message: "Cannot edit blocks while strategy is running",
        });
      }
    }

    const data: Prisma.StrategyUpdateInput = {
      updatedAt: new Date(),
      version: { increment: 1 },
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.visibility !== undefined)
      data.visibility = dto.visibility as StrategyVisibility;
    if (dto.execMode !== undefined) data.execMode = dto.execMode as ExecMode;
    if (dto.tickMs !== undefined) data.tickMs = dto.tickMs;
    if (dto.triggers !== undefined)
      data.triggers = dto.triggers as unknown as Prisma.InputJsonValue;
    if (dto.conditions !== undefined)
      data.conditions = dto.conditions as unknown as Prisma.InputJsonValue;
    if (dto.actions !== undefined)
      data.actions = dto.actions as unknown as Prisma.InputJsonValue;
    if (dto.safety !== undefined)
      data.safety = dto.safety as unknown as Prisma.InputJsonValue;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.canvas !== undefined)
      data.canvas = dto.canvas as unknown as Prisma.InputJsonValue;

    return this.prisma.strategy.update({ where: { id }, data });
  }

  async remove(id: string, userId: string): Promise<void> {
    const strategy = await this.getOwned(id, userId);
    if (strategy.status === StrategyStatus.RUNNING) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_IS_RUNNING",
        message: "Stop strategy before deleting",
      });
    }
    // Detach children (don't delete them)
    await this.prisma.strategy.updateMany({
      where: { parentStrategyId: id },
      data: { parentStrategyId: null },
    });
    await this.prisma.strategy.update({
      where: { id },
      data: { status: StrategyStatus.ARCHIVED },
    });
  }

  async start(
    id: string,
    userId: string,
    dto: StartStrategyDto,
  ): Promise<{ status: string; startedAt: string }> {
    const strategy = await this.getOwned(id, userId);

    if (strategy.status === StrategyStatus.RUNNING) {
      throw new UnprocessableEntityException({
        code: "ALREADY_RUNNING",
        message: "Strategy is already running",
      });
    }

    if (dto.mode === "live") {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { polymarketConnected: true },
      });
      if (!user?.polymarketConnected) {
        throw new UnprocessableEntityException({
          code: "NOT_CONNECTED",
          message: "Polymarket credentials required for live mode",
        });
      }
    }

    // Set PAPER status before calling engine so the engine routes to stream:paper_orders
    if (dto.mode === "paper") {
      await this.prisma.strategy.update({
        where: { id },
        data: { status: StrategyStatus.PAPER },
      });
    }

    const res = await this.client.post(
      this.engineUrl,
      "strategy-engine",
      `/internal/strategies/${id}/start`,
    );
    if (!res.ok && res.status !== 204) {
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      throw new UnprocessableEntityException({
        code: body.code ?? "ENGINE_ERROR",
        message: body.message ?? "Failed to start strategy",
      });
    }

    return { status: "RUNNING", startedAt: new Date().toISOString() };
  }

  async stop(
    id: string,
    userId: string,
  ): Promise<{ status: string; stoppedAt: string }> {
    await this.getOwned(id, userId);

    // Stop managed children first
    const children = await this.prisma.strategy.findMany({
      where: { parentStrategyId: id, status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] } },
      select: { id: true },
    });
    for (const child of children) {
      try {
        await this.client.delete(
          this.engineUrl,
          "strategy-engine",
          `/internal/strategies/${child.id}`,
        );
      } catch {
        this.logger.warn(`Failed to stop child strategy ${child.id}`);
      }
    }

    const res = await this.client.delete(
      this.engineUrl,
      "strategy-engine",
      `/internal/strategies/${id}`,
    );
    if (!res.ok && res.status !== 204) {
      this.logger.warn(`Engine stop returned ${res.status} for ${id}`);
    }
    await this.prisma.strategy.update({
      where: { id },
      data: { status: StrategyStatus.IDLE },
    });
    return { status: "IDLE", stoppedAt: new Date().toISOString() };
  }

  async pause(id: string, userId: string): Promise<{ status: string }> {
    await this.getOwned(id, userId);
    await this.client.post(
      this.engineUrl,
      "strategy-engine",
      `/internal/strategies/${id}/pause`,
    );
    return { status: "PAUSED" };
  }

  async resume(id: string, userId: string): Promise<{ status: string }> {
    await this.getOwned(id, userId);
    await this.client.post(
      this.engineUrl,
      "strategy-engine",
      `/internal/strategies/${id}/resume`,
    );
    return { status: "RUNNING" };
  }

  async fork(id: string, userId: string): Promise<Strategy> {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }
    if (
      strategy.visibility === StrategyVisibility.PRIVATE &&
      strategy.userId !== userId
    ) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Cannot fork a private strategy",
      });
    }

    const count = await this.prisma.strategy.count({
      where: { userId, status: { not: StrategyStatus.ARCHIVED } },
    });
    if (count >= MAX_STRATEGIES) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: "Strategy limit reached",
      });
    }

    return this.prisma.strategy.create({
      data: {
        userId,
        name: `Fork of ${strategy.name}`,
        description: strategy.description,
        visibility: StrategyVisibility.PRIVATE,
        execMode: strategy.execMode,
        tickMs: strategy.tickMs,
        triggers: strategy.triggers as unknown as Prisma.InputJsonValue,
        conditions: strategy.conditions as unknown as Prisma.InputJsonValue,
        actions: strategy.actions as unknown as Prisma.InputJsonValue,
        safety: strategy.safety as unknown as Prisma.InputJsonValue,
        tags: strategy.tags ?? [],
        status: StrategyStatus.IDLE,
        version: 1,
        template: false,
        forkedFromId: id,
      },
    });
  }

  async like(
    id: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy || strategy.visibility === StrategyVisibility.PRIVATE) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }

    // StrategyLike composite PK: [userId, strategyId]
    const existing = await this.prisma.strategyLike.findUnique({
      where: { userId_strategyId: { userId, strategyId: id } },
    });

    let liked: boolean;
    if (existing) {
      await this.prisma.strategyLike.delete({
        where: { userId_strategyId: { userId, strategyId: id } },
      });
      await this.prisma.strategy.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
      liked = false;
    } else {
      await this.prisma.strategyLike.create({
        data: { userId, strategyId: id },
      });
      await this.prisma.strategy.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      });
      liked = true;
    }

    const updated = await this.prisma.strategy.findUnique({
      where: { id },
      select: { likeCount: true },
    });
    return { liked, likeCount: updated?.likeCount ?? 0 };
  }

  async listComments(
    id: string,
    query: PaginationDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.strategyComment.findMany({
        where: { strategyId: id, deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      }),
      this.prisma.strategyComment.count({
        where: { strategyId: id, deleted: false },
      }),
    ]);

    return paginate(comments, total, page, limit);
  }

  async addComment(
    id: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<unknown> {
    await this.findOne(id, userId);
    return this.prisma.strategyComment.create({
      data: { strategyId: id, userId, content: dto.content },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
  }

  async deleteComment(
    strategyId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    const comment = await this.prisma.strategyComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.strategyId !== strategyId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Comment not found",
      });
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Not the comment author",
      });
    }
    await this.prisma.strategyComment.update({
      where: { id: commentId },
      data: { deleted: true },
    });
  }

  async report(
    id: string,
    userId: string,
    dto: ReportStrategyDto,
  ): Promise<{ reportId: string }> {
    await this.findOne(id, userId);
    // Report model: reporterId, targetType, targetId, strategyId, reason, description
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: "STRATEGY",
        targetId: id,
        strategyId: id,
        reason: dto.reason as ReportReason,
        description: dto.description,
      },
    });
    return { reportId: report.id };
  }

  async listChildren(
    id: string,
    userId: string,
  ): Promise<{ children: Array<{ id: string; name: string; status: string }> }> {
    await this.getOwned(id, userId);
    const children = await this.prisma.strategy.findMany({
      where: { parentStrategyId: id, status: { not: StrategyStatus.ARCHIVED } },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    return { children };
  }

  async listTemplates(
    query: PaginationDto,
  ): Promise<PaginatedResponse<Strategy>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where: { template: true, status: { not: StrategyStatus.ARCHIVED } },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.strategy.count({
        where: { template: true, status: { not: StrategyStatus.ARCHIVED } },
      }),
    ]);

    return paginate(templates, total, page, limit);
  }

  async exportStrategy(
    id: string,
    userId: string,
  ): Promise<{ payload: object; filename: string }> {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }

    const isOwner = strategy.userId === userId;

    if (
      strategy.visibility === StrategyVisibility.PRIVATE &&
      !isOwner
    ) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }

    const payload = {
      polyforge: "1.0",
      exportedAt: new Date().toISOString(),
      strategy: {
        name: strategy.name,
        description: strategy.description ?? "",
        execMode: strategy.execMode,
        tickMs: strategy.tickMs,
        visibility: strategy.visibility,
        tags: strategy.tags ?? [],
        variables: (strategy as any).variables ?? [],
        blocks: {
          safety: strategy.safety ?? [],
          triggers: strategy.triggers ?? [],
          conditions: strategy.conditions ?? [],
          actions: strategy.actions ?? [],
        },
        // Only include canvas layout for the owner
        ...(isOwner && strategy.canvas
          ? { canvas: strategy.canvas }
          : {}),
      },
    };

    const safeName = strategy.name
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const filename = `${safeName}.polyforge`;

    return { payload, filename };
  }

  async importStrategy(
    dto: ImportStrategyDto,
    userId: string,
  ): Promise<Strategy> {
    const count = await this.prisma.strategy.count({
      where: { userId, status: { not: StrategyStatus.ARCHIVED } },
    });
    if (count >= MAX_STRATEGIES) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: "Strategy limit reached",
      });
    }

    const s = dto.strategy;
    const blocks = s.blocks ?? {};

    return this.prisma.strategy.create({
      data: {
        userId,
        name: s.name,
        description: s.description ?? "",
        visibility: StrategyVisibility.PRIVATE,
        execMode: (s.execMode as ExecMode) ?? ExecMode.TICK,
        tickMs: s.tickMs ?? 1000,
        triggers: (blocks.triggers ?? []) as unknown as Prisma.InputJsonValue,
        conditions: (blocks.conditions ??
          []) as unknown as Prisma.InputJsonValue,
        actions: (blocks.actions ?? []) as unknown as Prisma.InputJsonValue,
        safety: (blocks.safety ?? []) as unknown as Prisma.InputJsonValue,
        tags: s.tags ?? [],
        canvas: s.canvas as unknown as Prisma.InputJsonValue | undefined,
        status: StrategyStatus.IDLE,
        version: 1,
        template: false,
      },
    });
  }

  private async getOwned(id: string, userId: string): Promise<Strategy> {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy || strategy.status === StrategyStatus.ARCHIVED) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }
    if (strategy.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }
    return strategy;
  }
}
