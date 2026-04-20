import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
import { paginate } from "../common/dto/pagination.dto";
import { CreateCopyDto } from "./dto/create-copy.dto";
import { UpdateCopyDto } from "./dto/update-copy.dto";

const MAX_ACTIVE_CONFIGS = 10;

@Injectable()
export class CopyService {
  private readonly logger = new Logger(CopyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCopyDto) {
    // Check active config limit
    const activeCount = await this.prisma.copyConfig.count({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    });

    if (activeCount >= MAX_ACTIVE_CONFIGS) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACTIVE_CONFIGS} active copy configs allowed`,
      );
    }

    // Check duplicate wallet
    const existing = await this.prisma.copyConfig.findUnique({
      where: {
        userId_targetWallet: { userId, targetWallet: dto.targetWallet },
      },
    });

    if (existing && existing.status !== "STOPPED") {
      throw new ConflictException(
        "You already have an active copy config for this wallet",
      );
    }

    const data: Prisma.CopyConfigCreateInput = {
      user: { connect: { id: userId } },
      targetWallet: dto.targetWallet,
      mode: dto.mode ?? "PERCENTAGE",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      ...(dto.sizeValue && { sizeValue: new Prisma.Decimal(dto.sizeValue) }),

      ...(dto.maxExposure && {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        maxExposure: new Prisma.Decimal(dto.maxExposure),
      }),

      ...(dto.maxDailyLoss && {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        maxDailyLoss: new Prisma.Decimal(dto.maxDailyLoss),
      }),

      ...(dto.priceOffset && {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        priceOffset: new Prisma.Decimal(dto.priceOffset),
      }),
    };

    // If there was a STOPPED config for the same wallet, delete it first
    if (existing && existing.status === "STOPPED") {
      await this.prisma.copyTrade.deleteMany({
        where: { configId: existing.id },
      });
      await this.prisma.copyConfig.delete({ where: { id: existing.id } });
    }

    const config = await this.prisma.copyConfig.create({ data });

    this.logger.log(
      `Copy config created: ${config.id} for wallet ${dto.targetWallet}`,
    );
    return config;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async list(userId: string) {
    const configs = await this.prisma.copyConfig.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { trades: true } },
      },
    });

    return configs;
  }

  // ─── Detail ──────────────────────────────────────────────────────────────────

  async getDetail(id: string, userId: string) {
    const config = await this.prisma.copyConfig.findUnique({
      where: { id },
      include: {
        trades: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!config) throw new NotFoundException("Copy config not found");
    if (config.userId !== userId) throw new ForbiddenException();

    return config;
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, userId: string, dto: UpdateCopyDto) {
    await this.findOwnedConfig(id, userId);

    const data: Prisma.CopyConfigUpdateInput = {};
    if (dto.mode) data.mode = dto.mode;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    if (dto.sizeValue) data.sizeValue = new Prisma.Decimal(dto.sizeValue);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    if (dto.maxExposure) data.maxExposure = new Prisma.Decimal(dto.maxExposure);
    if (dto.maxDailyLoss)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      data.maxDailyLoss = new Prisma.Decimal(dto.maxDailyLoss);
    if (dto.priceOffset !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      data.priceOffset = new Prisma.Decimal(dto.priceOffset);

    return this.prisma.copyConfig.update({ where: { id }, data });
  }

  // ─── Pause ───────────────────────────────────────────────────────────────────

  async pause(id: string, userId: string) {
    const config = await this.findOwnedConfig(id, userId);

    if (config.status !== "ACTIVE") {
      throw new BadRequestException("Only ACTIVE configs can be paused");
    }

    return this.prisma.copyConfig.update({
      where: { id },
      data: { status: "PAUSED" },
    });
  }

  // ─── Resume ──────────────────────────────────────────────────────────────────

  async resume(id: string, userId: string) {
    const config = await this.findOwnedConfig(id, userId);

    if (config.status !== "PAUSED") {
      throw new BadRequestException("Only PAUSED configs can be resumed");
    }

    return this.prisma.copyConfig.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }

  // ─── Stop ────────────────────────────────────────────────────────────────────

  async stop(id: string, userId: string) {
    const config = await this.findOwnedConfig(id, userId);

    if (config.status === "STOPPED") {
      throw new BadRequestException("Config is already stopped");
    }

    return this.prisma.copyConfig.update({
      where: { id },
      data: { status: "STOPPED", stoppedAt: new Date() },
    });
  }

  // ─── Trades ──────────────────────────────────────────────────────────────────

  async getTrades(id: string, userId: string, page: number, limit: number) {
    await this.findOwnedConfig(id, userId);

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.copyTrade.findMany({
        where: { configId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.copyTrade.count({ where: { configId: id } }),
    ]);

    return paginate(data, total, page, limit);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findOwnedConfig(id: string, userId: string) {
    const config = await this.prisma.copyConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException("Copy config not found");
    if (config.userId !== userId) throw new ForbiddenException();
    return config;
  }
}
