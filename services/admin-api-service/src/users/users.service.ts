import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { SuspendUserDto } from "./dto/suspend.dto";
import { UpdateLimitsDto } from "./dto/update-limits.dto";
import { Prisma } from "@prisma/client";
import { AdminMailService } from "../mail/mail.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: AdminMailService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    suspended?: boolean;
  }) {
    const { page, limit, search, status, suspended } = params;
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

    if (user.suspended) {
      throw new HttpException(
        { code: "ALREADY_SUSPENDED", message: "User is already suspended" },
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        suspended: true,
        suspendedReason: dto.reason,
      },
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
      .catch((err) => this.logger.error('Failed to send approval email', err));

    return { approved: true, email: user.email, username: user.username };
  }

  async reject(id: string, reason?: string) {
    const user = await this.findUserOrFail(id);

    // Soft-delete the rejected user
    await this.prisma.user.update({
      where: { id },
      data: { deleted: true, deletedAt: new Date(), suspendedReason: reason ?? 'Registration rejected' },
    });

    return { rejected: true, email: user.email };
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
}
