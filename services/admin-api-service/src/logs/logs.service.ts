import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { PrismaAdminService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminDb: PrismaAdminService,
  ) {}

  async getAuditLogs(params: {
    page: number;
    limit: number;
    adminId?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, adminId, action, targetType, from, to } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      this.adminDb.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          admin: { select: { email: true, displayName: true, role: true } },
        },
      }),
      this.adminDb.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getEventLogs(params: {
    page: number;
    limit: number;
    userId?: string;
    eventType?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, userId, eventType, from, to } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EventLogWhereInput = {};
    if (userId) where.userId = userId;
    if (eventType) where.eventType = eventType;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) (where.createdAt as any).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getLoginHistory(params: {
    page: number;
    limit: number;
    userId?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, userId, from, to } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserLoginHistoryWhereInput = {};
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) (where.createdAt as any).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.userLoginHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          ip: true,
          userAgent: true,
          success: true,
          createdAt: true,
          user: { select: { username: true, email: true } },
        },
      }),
      this.prisma.userLoginHistory.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getNotificationHistory(params: {
    page: number;
    limit: number;
    userId?: string;
    channel?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, userId, channel, from, to } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationHistoryWhereInput = {};
    if (userId) where.userId = userId;
    if (channel) where.channel = channel;
    if (from || to) {
      where.sentAt = {};
      if (from) (where.sentAt as any).gte = new Date(from);
      if (to) (where.sentAt as any).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.notificationHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          userId: true,
          channel: true,
          eventType: true,
          success: true,
          error: true,
          sentAt: true,
          user: { select: { username: true } },
        },
      }),
      this.prisma.notificationHistory.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
