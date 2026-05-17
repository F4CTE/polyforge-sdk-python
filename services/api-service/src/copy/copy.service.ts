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
import {
  checksumEthereumAddress,
  tryChecksumEthereumAddress,
} from "./wallet-address";

const MAX_ACTIVE_CONFIGS = 10;
const MAX_ACTIVE_CONFIGS_PER_TARGET = 25;

@Injectable()
export class CopyService {
  private readonly logger = new Logger(CopyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCopyDto) {
    const targetWallet = await checksumEthereumAddress(dto.targetWallet);

    // Self-copy guard — reject copying the user's own connected wallet to
    // prevent self-feedback loops and accidental circular mirroring.
    // Only enforces when the user's Polymarket account is actively connected;
    // stale addresses from disconnected accounts are ignored.
    // Uses tryChecksumEthereumAddress for the stored polymarketAddress so that
    // legacy or malformed profile data does not block unrelated copy creation.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketConnected: true, polymarketAddress: true },
    });
    if (user?.polymarketConnected && user.polymarketAddress) {
      let ownWallet = await tryChecksumEthereumAddress(user.polymarketAddress);

      // Backward compatibility: legacy stored addresses may have invalid
      // mixed-case checksums while still being valid hex bytes. For the
      // self-copy safety check, canonicalize those to checksum form instead of
      // silently skipping the comparison.
      if (!ownWallet) {
        ownWallet = await tryChecksumEthereumAddress(
          user.polymarketAddress.toLowerCase(),
        );
      }

      if (ownWallet && ownWallet === targetWallet) {
        throw new BadRequestException(
          "Cannot create a copy config for your own wallet",
        );
      }
    }

    // Check active config limit
    const activeCount = await this.prisma.copyConfig.count({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    });

    if (activeCount >= MAX_ACTIVE_CONFIGS) {
      throw new BadRequestException(
        `Maximum of ${MAX_ACTIVE_CONFIGS} active copy configs allowed`,
      );
    }

    const targetSubscriberCount = await this.prisma.copyConfig.count({
      where: {
        targetWallet: { equals: targetWallet, mode: "insensitive" },
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });
    if (targetSubscriberCount >= MAX_ACTIVE_CONFIGS_PER_TARGET) {
      throw new BadRequestException({
        code: "TARGET_AT_CAPACITY",
        message:
          "This wallet already has the maximum number of copy subscribers; try again later",
      });
    }

    // Check duplicate wallet — use findMany to resolve all case-insensitive
    // matches so legacy multi-case rows don't let a STOPPED row hide an ACTIVE one.
    const existingConfigs = await this.prisma.copyConfig.findMany({
      where: {
        userId,
        targetWallet: { equals: targetWallet, mode: "insensitive" },
      },
    });

    if (existingConfigs.some((c) => c.status !== "STOPPED")) {
      throw new ConflictException(
        "You already have an active copy config for this wallet",
      );
    }

    const data: Prisma.CopyConfigCreateInput = {
      user: { connect: { id: userId } },
      targetWallet,
      mode: dto.mode ?? "PERCENTAGE",

      ...(dto.sizeValue && { sizeValue: new Prisma.Decimal(dto.sizeValue) }),

      ...(dto.maxExposure && {
        maxExposure: new Prisma.Decimal(dto.maxExposure),
      }),

      ...(dto.maxDailyLoss && {
        maxDailyLoss: new Prisma.Decimal(dto.maxDailyLoss),
      }),

      ...(dto.priceOffset && {
        priceOffset: new Prisma.Decimal(dto.priceOffset),
      }),
    };

    // If there were STOPPED configs for the same wallet, delete them all
    // and create the new config atomically in a transaction so that a
    // failure in create doesn't leave the user with lost historical data.
    const stoppedConfigs = existingConfigs.filter(
      (c) => c.status === "STOPPED",
    );

    if (stoppedConfigs.length > 0) {
      const config = await this.prisma.$transaction(async (tx) => {
        for (const sc of stoppedConfigs) {
          await tx.copyTrade.deleteMany({
            where: { configId: sc.id },
          });
          await tx.copyConfig.delete({
            where: { id: sc.id },
          });
        }
        return tx.copyConfig.create({ data });
      });

      this.logger.log(
        `Copy config created: ${config.id} for wallet ${targetWallet}`,
      );
      return config;
    }

    const config = await this.prisma.copyConfig.create({ data });

    this.logger.log(
      `Copy config created: ${config.id} for wallet ${targetWallet}`,
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

    if (dto.sizeValue) data.sizeValue = new Prisma.Decimal(dto.sizeValue);

    if (dto.maxExposure) data.maxExposure = new Prisma.Decimal(dto.maxExposure);
    if (dto.maxDailyLoss)
      data.maxDailyLoss = new Prisma.Decimal(dto.maxDailyLoss);
    if (dto.priceOffset !== undefined)
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
