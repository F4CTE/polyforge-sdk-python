import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
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
import { PosthogService } from "@polyforge/shared-posthog";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import { InternalClientService } from "../common/services/internal-client.service";
import { CreateStrategyDto } from "./dto/create-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ReportStrategyDto } from "./dto/report-strategy.dto";
import { StrategyQueryDto } from "./dto/strategy-query.dto";
import { ImportStrategyDto } from "./dto/import-strategy.dto";
import { CreateFromDescriptionDto } from "./dto/create-from-description.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { LlmService } from "../news/llm.service";
import { BETA_LIMITS } from "../common/beta-limits.config";
import { assertCurrentUsRailTermsAccepted } from "../common/us-rail-terms";

const MAX_COMMENTS_PER_USER_PER_STRATEGY = 50;

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);
  private readonly engineUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly client: InternalClientService,
    private readonly llm: LlmService,
    private readonly posthog: PosthogService,
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
    if (count >= BETA_LIMITS.maxActiveStrategies) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: `Beta limit: maximum ${BETA_LIMITS.maxActiveStrategies} active strategies allowed. Archive existing strategies to create new ones.`,
      });
    }

    // Auto-assign US rail venue when user is a verified US participant with US credentials.
    // Phase 1 (POLA-956) adds POLYMARKET_US to the Venue enum and
    // polymarketUsConnected/country to User — cast until that migration lands.
    let autoVenue: string | undefined;
    if (!dto.kalshiSubaccount) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, polymarketUsConnected: true } as any,
      });
      if (
        (user as any)?.country === "US" &&
        (user as any)?.polymarketUsConnected
      ) {
        autoVenue = "POLYMARKET_US";
      }
    }

    const strategy = await this.prisma.strategy.create({
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
        ...(dto.marketId ? { marketId: dto.marketId } : {}),
        ...(dto.kalshiSubaccount != null
          ? { kalshiSubaccount: dto.kalshiSubaccount }
          : {}),
        ...(autoVenue ? { venue: autoVenue as any } : {}),
        status: StrategyStatus.IDLE,
        version: 1,
        template: false,
      },
    });

    this.posthog.capture(userId, "strategy_created", {
      strategyId: strategy.id,
      type: strategy.execMode,
      market: strategy.marketId ?? undefined,
    });

    return strategy;
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<Strategy & { childCount: number }> {
    const [strategy, childCount] = await Promise.all([
      this.prisma.strategy.findUnique({ where: { id } }),
      this.prisma.strategy.count({
        where: {
          parentStrategyId: id,
          status: { not: StrategyStatus.ARCHIVED },
        },
      }),
    ]);
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
    if (dto.marketId !== undefined) {
      data.market = dto.marketId
        ? { connect: { id: dto.marketId } }
        : { disconnect: true };
    }
    if (dto.kalshiSubaccount !== undefined)
      data.kalshiSubaccount = dto.kalshiSubaccount;

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
    // R4-01: Atomic check-and-update to prevent race conditions
    const newStatus =
      dto.mode === "paper" ? StrategyStatus.PAPER : StrategyStatus.RUNNING;
    const updated = await this.prisma.strategy.updateMany({
      where: { id, userId, status: StrategyStatus.IDLE },
      data: { status: newStatus },
    });
    if (updated.count === 0) {
      // Either not found, not owned, or not in IDLE state
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
      throw new ConflictException({
        code: "ALREADY_RUNNING",
        message: "Strategy is already running or not in IDLE state",
      });
    }

    if (dto.mode === "live") {
      const strategy = await this.prisma.strategy.findUnique({
        where: { id },
        select: { venue: true },
      });
      // Phase 1 (POLA-956) adds POLYMARKET_US to Venue enum — cast until migration lands
      const isUsRailStrategy = (strategy?.venue as any) === "POLYMARKET_US";

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          polymarketConnected: true,
          polymarketUsConnected: true,
          usRailTermsAcceptedAt: true,
          usRailTermsVersion: true,
        } as any,
      });

      const hasCredentials = isUsRailStrategy
        ? !!(user as any)?.polymarketUsConnected
        : !!user?.polymarketConnected;

      if (!hasCredentials) {
        await this.prisma.strategy.update({
          where: { id },
          data: { status: StrategyStatus.IDLE },
        });
        throw new UnprocessableEntityException({
          code: "NOT_CONNECTED",
          message: isUsRailStrategy
            ? "Polymarket US credentials required for live mode"
            : "Polymarket credentials required for live mode",
        });
      }

      if (isUsRailStrategy) {
        try {
          assertCurrentUsRailTermsAccepted(user as any);
        } catch (err) {
          await this.prisma.strategy.update({
            where: { id },
            data: { status: StrategyStatus.IDLE },
          });
          throw err;
        }
      }
    }

    let res: Response;
    try {
      res = await this.client.post(
        this.engineUrl,
        "strategy-engine",
        `/internal/strategies/${id}/start`,
      );
    } catch (err) {
      await this.prisma.strategy.update({
        where: { id },
        data: { status: StrategyStatus.IDLE },
      });
      throw err;
    }

    if (!res.ok && res.status !== 204) {
      // Roll back status on engine failure
      await this.prisma.strategy.update({
        where: { id },
        data: { status: StrategyStatus.IDLE },
      });
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
      };
      throw new UnprocessableEntityException({
        code: body.code ?? "ENGINE_ERROR",
        message: "Failed to start strategy",
      });
    }

    this.posthog.capture(userId, "strategy_started", {
      strategyId: id,
      mode: dto.mode,
    });

    return { status: newStatus, startedAt: new Date().toISOString() };
  }

  async stop(
    id: string,
    userId: string,
  ): Promise<{ status: string; stoppedAt: string }> {
    // R4-01: Atomic check-and-update — only stop if currently RUNNING or PAPER
    const updated = await this.prisma.strategy.updateMany({
      where: {
        id,
        userId,
        status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] },
      },
      data: { status: StrategyStatus.IDLE },
    });
    if (updated.count === 0) {
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
      throw new ConflictException({
        code: "NOT_RUNNING",
        message: "Strategy is not in a running state",
      });
    }

    // Stop managed children first
    const children = await this.prisma.strategy.findMany({
      where: {
        parentStrategyId: id,
        status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] },
      },
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

    this.posthog.capture(userId, "strategy_stopped", { strategyId: id });

    return { status: "IDLE", stoppedAt: new Date().toISOString() };
  }

  async pause(id: string, userId: string): Promise<{ status: string }> {
    // R4-01: Atomic check-and-update — only pause if currently RUNNING or PAPER
    const updated = await this.prisma.strategy.updateMany({
      where: {
        id,
        userId,
        status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] },
      },
      data: { status: StrategyStatus.PAUSED },
    });
    if (updated.count === 0) {
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
      throw new ConflictException({
        code: "NOT_RUNNING",
        message: "Strategy is not in a running state",
      });
    }

    await this.client.post(
      this.engineUrl,
      "strategy-engine",
      `/internal/strategies/${id}/pause`,
    );
    return { status: "PAUSED" };
  }

  async resume(id: string, userId: string): Promise<{ status: string }> {
    // R4-01: Atomic check-and-update — only resume if currently PAUSED
    const updated = await this.prisma.strategy.updateMany({
      where: { id, userId, status: StrategyStatus.PAUSED },
      data: { status: StrategyStatus.RUNNING },
    });
    if (updated.count === 0) {
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
      throw new ConflictException({
        code: "NOT_PAUSED",
        message: "Strategy is not in PAUSED state",
      });
    }

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
    if (count >= BETA_LIMITS.maxActiveStrategies) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: `Beta limit: maximum ${BETA_LIMITS.maxActiveStrategies} active strategies allowed. Archive existing strategies to create new ones.`,
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

    // Use transaction to consolidate 4-5 DB calls into 2
    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.strategyLike.delete({
          where: { userId_strategyId: { userId, strategyId: id } },
        });
        const updated = await tx.strategy.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: updated.likeCount };
      } else {
        await tx.strategyLike.create({
          data: { userId, strategyId: id },
        });
        const updated = await tx.strategy.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: updated.likeCount };
      }
    });
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

    // R5-03: Strip HTML tags from comment content to prevent XSS
    const sanitizedContent = dto.content.replace(/<[^>]*>/g, "");

    const userCommentCount = await this.prisma.strategyComment.count({
      where: { strategyId: id, userId, deleted: false },
    });
    if (userCommentCount >= MAX_COMMENTS_PER_USER_PER_STRATEGY) {
      throw new BadRequestException({
        code: "TOO_MANY_COMMENTS",
        message: "Delete an existing comment before adding another one",
      });
    }

    return this.prisma.strategyComment.create({
      data: { strategyId: id, userId, content: sanitizedContent },
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
  ): Promise<{
    children: Array<{ id: string; name: string; status: string }>;
  }> {
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

    if (strategy.visibility === StrategyVisibility.PRIVATE && !isOwner) {
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
        variables: (strategy as Record<string, unknown>).variables ?? [],
        blocks: {
          safety: strategy.safety ?? [],
          triggers: strategy.triggers ?? [],
          conditions: strategy.conditions ?? [],
          actions: strategy.actions ?? [],
        },
        // Only include canvas layout for the owner
        ...(isOwner && strategy.canvas ? { canvas: strategy.canvas } : {}),
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
    if (count >= BETA_LIMITS.maxActiveStrategies) {
      throw new UnprocessableEntityException({
        code: "STRATEGY_LIMIT_REACHED",
        message: `Beta limit: maximum ${BETA_LIMITS.maxActiveStrategies} active strategies allowed. Archive existing strategies to create new ones.`,
      });
    }

    const s = dto.strategy;
    const blocks = s.blocks ?? {};

    // ── Import validation (R3-M3) ──────────────────────────────────────────

    // Max total block count: 100
    const totalBlocks =
      (Array.isArray(blocks.triggers) ? blocks.triggers.length : 0) +
      (Array.isArray(blocks.conditions) ? blocks.conditions.length : 0) +
      (Array.isArray(blocks.actions) ? blocks.actions.length : 0) +
      (Array.isArray(blocks.safety) ? blocks.safety.length : 0);
    if (totalBlocks > 100) {
      throw new UnprocessableEntityException({
        code: "IMPORT_TOO_MANY_BLOCKS",
        message: `Import exceeds maximum block count (${totalBlocks} > 100)`,
      });
    }

    // Validate variables: max expression length 200 chars
    const variables = Array.isArray(s.variables) ? s.variables : [];
    for (const v of variables) {
      if (typeof v.expression === "string" && v.expression.length > 200) {
        throw new UnprocessableEntityException({
          code: "IMPORT_EXPRESSION_TOO_LONG",
          message: `Variable "${v.name}" expression exceeds 200 characters`,
        });
      }
    }

    // Validate block types against known types
    const KNOWN_BLOCK_TYPES = new Set([
      // Safety (engine registry names)
      "DAILY_LOSS_LIMIT",
      "CONSECUTIVE_LOSS",
      "MAX_POSITION_SIZE",
      "EXPOSURE_EXCEEDS",
      "LOSS_STREAK",
      "WIN_STREAK",
      "ORDERS_PER_MIN",
      "BETS_TODAY_LESS_THAN",
      // Safety (UI names)
      "STOP_IF_DAILY_LOSS",
      "STOP_IF_CONSECUTIVE_LOSSES",
      "STOP_IF_DRAWDOWN",
      "STOP_IF_POSITION_SIZE",
      "MAX_DAILY_BETS",
      // Triggers
      "PRICE_ABOVE",
      "PRICE_BELOW",
      "PRICE_CROSSES_UP",
      "PRICE_CROSSES_DOWN",
      "PRICE_IN_RANGE",
      "SPREAD_ABOVE",
      "TICK",
      "WAIT",
      "PAUSE_AFTER_FILL",
      "PRICE_CHANGE_PCT",
      "VOLUME_SPIKE",
      "TIME_WINDOW",
      "TIME_IN_WINDOW",
      // Conditions
      "POSITION_OPEN",
      "NO_POSITION",
      "POSITION_SIZE_BELOW",
      "NO_RECENT_BET",
      "LIQUIDITY_ABOVE",
      "MIN_LIQUIDITY",
      "MIN_PRICE",
      "MAX_PRICE",
      "MAX_SPREAD",
      "SPREAD_BELOW",
      "MARKET_OPEN",
      "MARKET_RESOLVED",
      "MARKET_RESOLVING",
      "DAILY_LOSS_BELOW",
      "TIME_BETWEEN",
      // Actions
      "BUY",
      "SELL",
      "BUY_YES",
      "BUY_NO",
      "SELL_YES",
      "SELL_NO",
      "CLOSE_POSITION",
      "SET_STOP_LOSS",
      "SET_TAKE_PROFIT",
      "TAKE_PROFIT",
      "SCALE_IN",
      "SCALE_OUT",
      "CANCEL_ALL_ORDERS",
      "NOTIFY",
      "RUN_STRATEGY",
      // Logic
      "IF_THEN_ELSE",
      "AND_GATE",
      "OR_GATE",
      "NOT_GATE",
      "DELAY",
      // Calc
      "MATH",
      "AGGREGATION",
      "COMPARISON",
      "ABS_ROUND",
    ]);
    const allBlocks = [
      ...(Array.isArray(blocks.triggers) ? blocks.triggers : []),
      ...(Array.isArray(blocks.conditions) ? blocks.conditions : []),
      ...(Array.isArray(blocks.actions) ? blocks.actions : []),
      ...(Array.isArray(blocks.safety) ? blocks.safety : []),
    ];
    for (const block of allBlocks) {
      if (
        block &&
        typeof block.type === "string" &&
        !KNOWN_BLOCK_TYPES.has(block.type) &&
        !KNOWN_BLOCK_TYPES.has(block.type.toUpperCase())
      ) {
        throw new UnprocessableEntityException({
          code: "IMPORT_UNKNOWN_BLOCK_TYPE",
          message: `Unknown block type: ${block.type}`,
        });
      }
    }

    // Strip HTML from name/description
    const stripHtml = (str: string) => str.replace(/<[^>]*>/g, "");
    if (s.name) s.name = stripHtml(s.name);
    if (s.description) s.description = stripHtml(s.description);

    // ── End import validation ──────────────────────────────────────────────

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

  async createFromDescription(
    userId: string,
    dto: CreateFromDescriptionDto,
  ): Promise<Strategy> {
    const blockTypes = [
      "Safety: DAILY_LOSS_LIMIT, CONSECUTIVE_LOSS, MAX_POSITION_SIZE, STOP_IF_DRAWDOWN, MAX_DAILY_BETS",
      "Triggers: PRICE_ABOVE, PRICE_BELOW, PRICE_CROSSES_UP, PRICE_CROSSES_DOWN, PRICE_IN_RANGE, SPREAD_ABOVE, TICK, WAIT, PAUSE_AFTER_FILL, PRICE_CHANGE_PCT, VOLUME_SPIKE, TIME_WINDOW",
      "Conditions: POSITION_OPEN, NO_POSITION, POSITION_SIZE_BELOW, NO_RECENT_BET, LIQUIDITY_ABOVE, MIN_LIQUIDITY, MIN_PRICE, MAX_PRICE, MAX_SPREAD, SPREAD_BELOW, MARKET_OPEN, DAILY_LOSS_BELOW",
      "Actions: BUY, SELL, BUY_YES, BUY_NO, SELL_YES, SELL_NO, CLOSE_POSITION, SET_STOP_LOSS, SET_TAKE_PROFIT, SCALE_IN, SCALE_OUT, CANCEL_ALL_ORDERS, NOTIFY, RUN_STRATEGY",
      "Logic: IF_THEN_ELSE, AND_GATE, OR_GATE, NOT_GATE, DELAY",
      "Calc: MATH, AGGREGATION, COMPARISON, ABS_ROUND",
    ].join("\n");

    const prompt = [
      `Given this trading strategy description: "${dto.description}"`,
      "",
      "Generate a Polyforge strategy configuration with blocks.",
      `Available block types:\n${blockTypes}`,
      "",
      "Return ONLY valid JSON (no markdown, no explanation):",
      '{ "name": "string", "description": "string", "execMode": "TICK"|"EVENT"|"HYBRID",',
      '  "safety": [{ "type": "BLOCK_TYPE", "config": {...} }],',
      '  "triggers": [{ "type": "BLOCK_TYPE", "config": {...} }],',
      '  "conditions": [{ "type": "BLOCK_TYPE", "config": {...} }],',
      '  "actions": [{ "type": "BLOCK_TYPE", "config": {...} }] }',
    ].join("\n");

    const raw = await this.llm.analyze(prompt);

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: {
      name?: string;
      description?: string;
      execMode?: string;
      safety?: Array<{ type?: string }>;
      triggers?: Array<{ type?: string }>;
      conditions?: Array<{ type?: string }>;
      actions?: Array<{ type?: string }>;
    };
    try {
      parsed = JSON.parse(jsonStr) as typeof parsed;
    } catch {
      throw new UnprocessableEntityException({
        code: "LLM_PARSE_ERROR",
        message: "Failed to parse LLM response as valid strategy JSON",
      });
    }

    // Validate block types against known types
    const KNOWN = new Set([
      "DAILY_LOSS_LIMIT",
      "CONSECUTIVE_LOSS",
      "MAX_POSITION_SIZE",
      "EXPOSURE_EXCEEDS",
      "LOSS_STREAK",
      "WIN_STREAK",
      "ORDERS_PER_MIN",
      "BETS_TODAY_LESS_THAN",
      "STOP_IF_DAILY_LOSS",
      "STOP_IF_CONSECUTIVE_LOSSES",
      "STOP_IF_DRAWDOWN",
      "STOP_IF_POSITION_SIZE",
      "MAX_DAILY_BETS",
      "PRICE_ABOVE",
      "PRICE_BELOW",
      "PRICE_CROSSES_UP",
      "PRICE_CROSSES_DOWN",
      "PRICE_IN_RANGE",
      "SPREAD_ABOVE",
      "TICK",
      "WAIT",
      "PAUSE_AFTER_FILL",
      "PRICE_CHANGE_PCT",
      "VOLUME_SPIKE",
      "TIME_WINDOW",
      "TIME_IN_WINDOW",
      "POSITION_OPEN",
      "NO_POSITION",
      "POSITION_SIZE_BELOW",
      "NO_RECENT_BET",
      "LIQUIDITY_ABOVE",
      "MIN_LIQUIDITY",
      "MIN_PRICE",
      "MAX_PRICE",
      "MAX_SPREAD",
      "SPREAD_BELOW",
      "MARKET_OPEN",
      "MARKET_RESOLVED",
      "MARKET_RESOLVING",
      "DAILY_LOSS_BELOW",
      "TIME_BETWEEN",
      "BUY",
      "SELL",
      "BUY_YES",
      "BUY_NO",
      "SELL_YES",
      "SELL_NO",
      "CLOSE_POSITION",
      "SET_STOP_LOSS",
      "SET_TAKE_PROFIT",
      "TAKE_PROFIT",
      "SCALE_IN",
      "SCALE_OUT",
      "CANCEL_ALL_ORDERS",
      "NOTIFY",
      "RUN_STRATEGY",
      "IF_THEN_ELSE",
      "AND_GATE",
      "OR_GATE",
      "NOT_GATE",
      "DELAY",
      "MATH",
      "AGGREGATION",
      "COMPARISON",
      "ABS_ROUND",
    ]);

    const allBlocks: Array<{ type?: string }> = [
      ...(parsed.safety ?? []),
      ...(parsed.triggers ?? []),
      ...(parsed.conditions ?? []),
      ...(parsed.actions ?? []),
    ];
    const invalidTypes = allBlocks
      .filter((b) => b?.type && !KNOWN.has(b.type))
      .map((b) => b.type);

    if (invalidTypes.length > 0) {
      throw new UnprocessableEntityException({
        code: "LLM_INVALID_BLOCKS",
        message: `LLM generated unknown block types: ${invalidTypes.join(", ")}`,
      });
    }

    // Create the strategy via existing create method
    return this.create(userId, {
      name: parsed.name ?? "AI-Generated Strategy",
      description: parsed.description ?? dto.description,
      execMode: (["TICK", "EVENT", "HYBRID"].includes(parsed.execMode ?? "")
        ? parsed.execMode
        : "TICK") as string,
      safety: parsed.safety ?? [],
      triggers: parsed.triggers ?? [],
      conditions: parsed.conditions ?? [],
      actions: parsed.actions ?? [],
    } as CreateStrategyDto);
  }

  async listVersions(strategyId: string, userId: string) {
    // Verify ownership
    const strategy = await this.prisma.strategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new ForbiddenException("Strategy not found");
    return this.prisma.strategyVersion.findMany({
      where: { strategyId },
      orderBy: { version: "desc" },
    });
  }

  async rollbackToVersion(
    strategyId: string,
    versionId: string,
    userId: string,
  ) {
    const strategy = await this.prisma.strategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new ForbiddenException("Strategy not found");
    const version = await this.prisma.strategyVersion.findFirst({
      where: { id: versionId, strategyId },
    });
    if (!version) throw new ForbiddenException("Version not found");
    // Apply version to strategy
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: {
        triggers: version.triggers as unknown as Prisma.InputJsonValue,
        conditions: version.conditions as unknown as Prisma.InputJsonValue,
        actions: version.actions as unknown as Prisma.InputJsonValue,
        safety: version.safety as unknown as Prisma.InputJsonValue,
      },
    });
    return { message: "Rolled back successfully", version: version.version };
  }

  async listEventLog(strategyId: string, userId: string, limit = 50) {
    await this.getOwned(strategyId, userId);
    const events = await this.prisma.strategyEvent.findMany({
      where: { strategyId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      select: { id: true, eventType: true, payload: true, createdAt: true },
    });
    return events;
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
