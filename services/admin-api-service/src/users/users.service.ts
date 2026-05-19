import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { SuspendUserDto } from "./dto/suspend.dto";
import { UpdateLimitsDto } from "./dto/update-limits.dto";
import { Prisma } from "@prisma/client";
import { AdminMailService } from "../mail/mail.service";
import { randomUUID } from "node:crypto";

const REFRESH_KEY_PATTERN = (userId: string) => `refresh:${userId}:*`;
const SUSPENDED_USER_KEY = (userId: string) => `suspended:${userId}`;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: AdminMailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    suspended?: boolean;
    polymarketConnected?: boolean;
  }) {
    const { page, limit, search, status, suspended, polymarketConnected } =
      params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deleted: false,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    if (suspended !== undefined) {
      where.suspended = suspended;
    }

    if (polymarketConnected !== undefined) {
      where.polymarketConnected = polymarketConnected;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          emailVerified: true,
          polymarketConnected: true,
          suspended: true,
          suspendedReason: true,
          createdAt: true,
          lastSeen: true,
          _count: {
            select: {
              strategies: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        limits: true,
        loginHistory: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            ip: true,
            userAgent: true,
            success: true,
            createdAt: true,
          },
        },
        strategies: {
          select: {
            id: true,
            name: true,
            status: true,
            visibility: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            orders: true,
            positions: true,
            strategies: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Exclude passwordHash
    const { passwordHash, totpSecret, totpBackupCodes, ...safe } = user as any;
    return safe;
  }

  async suspend(id: string, dto: SuspendUserDto) {
    const user = await this.findUserOrFail(id);

    await this.replaySuspendSideEffects(id);

    const updated = user.suspended
      ? user
      : await this.prisma.user
          .update({
            where: { id },
            data: {
              suspended: true,
              suspendedReason: dto.reason,
            },
          })
          .catch(async (err) => {
            await this.redis.del(SUSPENDED_USER_KEY(id)).catch(() => {});
            throw err;
          });

    return {
      suspended: true,
      suspendedAt: new Date().toISOString(),
      reason: updated.suspendedReason,
    };
  }

  async unsuspend(id: string) {
    await this.findUserOrFail(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        suspended: false,
        suspendedReason: null,
      },
    });
    await this.redis.del(SUSPENDED_USER_KEY(id));

    return { suspended: false };
  }

  async approve(id: string, adminId: string) {
    const user = await this.findUserOrFail(id);

    if (user.approved) {
      throw new HttpException(
        { code: "ALREADY_APPROVED", message: "User is already approved" },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { approved: true, approvedAt: new Date(), approvedBy: adminId },
    });

    // Send approval email — fire-and-forget
    this.mailService
      .sendAccountApprovedEmail(user.email, user.username)
      .catch((err) => this.logger.error("Failed to send approval email", err));

    return { approved: true, email: user.email, username: user.username };
  }

  async reject(id: string, reason?: string) {
    const user = await this.findUserOrFail(id);

    // Soft-delete the rejected user
    await this.prisma.user.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date(),
        suspendedReason: reason ?? "Registration rejected",
      },
    });

    return { rejected: true, email: user.email };
  }

  async getRiskSettings(userId: string) {
    await this.findUserOrFail(userId);

    const limits = await this.prisma.userLimit.findUnique({
      where: { userId },
    });

    return {
      enabled: limits?.drawdownEnabled ?? false,
      maxPositionSize: limits
        ? parseFloat(String(limits.maxOrderSizeUsdc))
        : 1000,
      maxOpenPositions: limits?.maxRunningStrategies ?? 5,
      maxOrdersPerDay: limits?.maxOrdersPerDay ?? 500,
      maxBacktestRunsPerDay: limits?.maxBacktestRunsPerDay ?? 10,
      circuitBreakerErrors: limits?.circuitBreakerErrors ?? 5,
      drawdownEnabled: limits?.drawdownEnabled ?? false,
      drawdownLookbackHours: limits?.drawdownLookbackHours ?? 24,
      drawdownThresholdPct: limits
        ? parseFloat(String(limits.drawdownThresholdPct))
        : 0.1,
      circuitBreakerTripped: limits?.circuitBreakerTripped ?? false,
      circuitBreakerTrippedAt: limits?.circuitBreakerTrippedAt ?? null,
    };
  }

  async updateLimits(id: string, dto: UpdateLimitsDto) {
    await this.findUserOrFail(id);

    const limits = await this.prisma.userLimit.upsert({
      where: { userId: id },
      create: {
        userId: id,
        ...dto,
      },
      update: dto,
    });

    return limits;
  }

  async listApiKeys(userId: string) {
    await this.findUserOrFail(userId);

    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        revoked: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.findUserOrFail(userId);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== userId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "API key not found",
      });
    }

    if (apiKey.revoked) {
      throw new HttpException(
        { code: "ALREADY_REVOKED", message: "API key is already revoked" },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    return { revoked: true };
  }

  async getUserAccuracy(userId: string): Promise<any> {
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        resolutionStatus: { in: ["RESOLVED", "REDEEMED"] as any[] },
      },
    });

    if (positions.length === 0) {
      return {
        brierScore: null,
        totalPredictions: 0,
        correctPredictions: 0,
        winRate: "0",
        calibration: [],
        byCategory: {},
      };
    }

    let brierSum = 0;
    let correct = 0;
    for (const p of positions) {
      const prob = parseFloat(String((p as any).avgPrice ?? 0));
      const won = parseFloat(String((p as any).realizedPnl ?? 0)) > 0 ? 1 : 0;
      if (won) correct++;
      brierSum += Math.pow(prob - won, 2);
    }
    const brierScore = brierSum / positions.length;

    const buckets: Record<number, { sum: number; count: number }> = {};
    for (let b = 0; b <= 9; b++) buckets[b] = { sum: 0, count: 0 };
    for (const p of positions) {
      const prob = Math.min(
        0.999,
        Math.max(0.001, parseFloat(String((p as any).avgPrice ?? 0))),
      );
      const bucket = Math.floor(prob * 10);
      const won = parseFloat(String((p as any).realizedPnl ?? 0)) > 0 ? 1 : 0;
      buckets[bucket].sum += won;
      buckets[bucket].count++;
    }
    const calibration = Object.entries(buckets)
      .filter(([, v]) => v.count > 0)
      .map(([k, v]) => ({
        bucketMid: (parseInt(k) + 0.5) / 10,
        frequency: v.sum / v.count,
        count: v.count,
      }));

    return {
      brierScore: parseFloat(brierScore.toFixed(4)),
      totalPredictions: positions.length,
      correctPredictions: correct,
      winRate: ((correct / positions.length) * 100).toFixed(1),
      calibration,
      byCategory: {},
    };
  }

  private async findUserOrFail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deleted) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    return user;
  }

  private async replaySuspendSideEffects(userId: string): Promise<void> {
    // Set the Redis suspended marker FIRST so queued order intents
    // are blocked immediately even before side-effects complete.
    // If any subsequent step fails the marker is rolled back so that
    // a failed suspend does not permanently block the user.
    await this.redis.set(SUSPENDED_USER_KEY(userId), String(Date.now()));
    try {
      await this.stopStrategyRunners(userId);
      await this.publishOrderCancellations(userId);
      await this.prisma.apiKey.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      });
      await this.revokeRefreshTokensForUser(userId);
      await this.redis.xadd("stream:events", {
        type: "USER_SUSPENDED",
        userId,
        ts: String(Date.now()),
      });
    } catch (err) {
      await this.redis.del(SUSPENDED_USER_KEY(userId)).catch(() => {});
      throw err;
    }
  }

  private async revokeRefreshTokensForUser(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const stream = client.scanStream({
      match: REFRESH_KEY_PATTERN(userId),
      count: 100,
    });
    const pipeline = client.pipeline();
    let count = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keys: string[]) => {
        for (const key of keys) {
          pipeline.del(key);
          const tokenHash = key.split(":").at(-1);
          if (tokenHash) pipeline.del(`refresh_lookup:${tokenHash}`);
          count++;
        }
      });
      stream.on("end", () => resolve());
      stream.on("error", (err: Error) => reject(err));
    });

    if (count > 0) {
      await pipeline.exec();
    }
  }

  private async stopStrategyRunners(userId: string): Promise<void> {
    const strategies = await this.prisma.strategy.findMany({
      where: {
        userId,
        status: { in: ["RUNNING", "PAUSED"] as any[] },
      },
      select: { id: true },
    });
    if (strategies.length === 0) return;

    const strategyEngineUrl =
      this.config.get<string>("STRATEGY_ENGINE_URL") ??
      "http://strategy-engine:3011";
    for (const strategy of strategies) {
      const res = await fetch(
        `${strategyEngineUrl}/internal/strategies/${encodeURIComponent(strategy.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${this.issueInternalToken()}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok && res.status !== 404) {
        const body = await res.text().catch(() => "");
        throw new HttpException(
          {
            code: "STRATEGY_STOP_FAILED",
            message: `Failed to stop strategy runner ${strategy.id}: ${res.status} ${body}`,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    await this.prisma.strategy.updateMany({
      where: { id: { in: strategies.map((s: { id: string }) => s.id) } },
      data: { status: "IDLE" as any },
    });
  }

  private async publishOrderCancellations(userId: string): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "SUBMITTED", "LIVE"] as any[] },
      },
      select: {
        id: true,
        clobOrderId: true,
        venueOrderId: true,
      },
    });

    for (const order of orders) {
      await this.redis.xadd("stream:cancellations", {
        orderId: order.id,
        userId,
        ...(order.clobOrderId ? { clobOrderId: order.clobOrderId } : {}),
        ...(order.venueOrderId ? { venueOrderId: order.venueOrderId } : {}),
      });
    }
  }

  private issueInternalToken(): string {
    return this.jwt.sign(
      { sub: "admin-api-service", jti: randomUUID() },
      {
        secret: deriveServiceKey(
          this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
          "admin-api-service",
        ),
        audience: "strategy-engine",
        issuer: "admin-api-service",
        expiresIn: "30s",
        algorithm: "HS256",
      },
    );
  }
}
