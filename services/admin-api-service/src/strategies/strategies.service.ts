import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

const INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET;
if (!INTERNAL_JWT_SECRET) {
  throw new Error("INTERNAL_JWT_SECRET env var is required");
}
const STRATEGY_ENGINE_URL =
  process.env.STRATEGY_ENGINE_URL ?? "http://strategy-engine:3006";

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    userId?: string;
    status?: string;
    visibility?: string;
  }) {
    const { page, limit, userId, status, visibility } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.StrategyWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status as any;
    if (visibility) where.visibility = visibility as any;

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          name: true,
          status: true,
          visibility: true,
          execMode: true,
          template: true,
          likeCount: true,
          forkCount: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { username: true, email: true } },
        },
      }),
      this.prisma.strategy.count({ where }),
    ]);

    return {
      data: strategies,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async forceStop(id: string) {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }

    // Call strategy-engine to stop it if running
    if (strategy.status === "RUNNING" || strategy.status === "PAUSED") {
      try {
        const token = this.issueInternalToken();
        await fetch(`${STRATEGY_ENGINE_URL}/internal/strategies/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
      } catch (err: any) {
        this.logger.warn(
          `Strategy engine call failed for force-stop ${id}: ${err?.message}`,
        );
      }
    }

    // Update DB status regardless
    await this.prisma.strategy.update({
      where: { id },
      data: { status: "IDLE" },
    });

    return { status: "IDLE", stoppedBy: "admin" };
  }

  async unpublish(id: string) {
    const strategy = await this.prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Strategy not found",
      });
    }

    await this.prisma.strategy.update({
      where: { id },
      data: { visibility: "PRIVATE" },
    });

    return { id, visibility: "PRIVATE" };
  }

  private issueInternalToken(): string {
    return this.jwtService.sign(
      { iss: "admin-api-service", aud: "strategy-engine", jti: randomUUID() },
      { secret: INTERNAL_JWT_SECRET, expiresIn: "30s" },
    );
  }
}
