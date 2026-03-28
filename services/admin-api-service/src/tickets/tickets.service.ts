import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService, PrismaAdminService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { AdminMessageDto } from "./dto/admin-message.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class TicketsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminDb: PrismaAdminService,
    private readonly redis: RedisService,
  ) {}

  /** Resolve admin UUIDs to display names from admin DB */
  private async resolveAdminNames(
    ids: (string | null)[],
  ): Promise<Record<string, string>> {
    const validIds = ids.filter((id): id is string => !!id);
    if (validIds.length === 0) return {};
    const admins = await this.adminDb.admin.findMany({
      where: { id: { in: validIds } },
      select: { id: true, displayName: true },
    });
    return Object.fromEntries(admins.map((a) => [a.id, a.displayName]));
  }

  async findAll(params: {
    page: number;
    limit: number;
    status?: string;
    priority?: string;
    assignedTo?: string;
  }) {
    const { page, limit, status, priority, assignedTo } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (assignedTo) where.assignedTo = assignedTo;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { username: true, email: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              body: true,
              isAdmin: true,
              senderName: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    // Resolve admin display names for assignedTo
    const adminIds = tickets.map((t) => t.assignedTo);
    const adminNames = await this.resolveAdminNames(adminIds);

    const data = tickets.map((t) => ({
      ...t,
      assignedToName: t.assignedTo ? (adminNames[t.assignedTo] ?? null) : null,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
    };
  }

  async findOne(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { username: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ticket not found",
      });
    }

    const adminNames = await this.resolveAdminNames([
      ticket.assignedTo,
      ticket.closedBy,
    ]);

    return {
      ...ticket,
      assignedToName: ticket.assignedTo
        ? (adminNames[ticket.assignedTo] ?? null)
        : null,
      closedByName: ticket.closedBy
        ? (adminNames[ticket.closedBy] ?? null)
        : null,
    };
  }

  async addReply(
    ticketId: string,
    adminId: string,
    adminName: string,
    dto: AdminMessageDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, subject: true, assignedTo: true },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ticket not found",
      });
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        senderName: adminName,
        isAdmin: true,
        body: dto.body,
      },
    });

    // Update ticket status, auto-assign if unassigned, and clear reminder
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "AWAITING_USER",
        assignedTo: ticket.assignedTo ?? adminId,
        reminderSentAt: null,
      },
    });

    // Emit event for user notification
    await this.redis.xadd("stream:events", {
      event_type: "TICKET_REPLY",
      userId: ticket.userId,
      ticketId: ticket.id,
      subject: ticket.subject,
      adminName,
      timestamp: String(Date.now()),
    });

    return message;
  }

  async update(ticketId: string, adminId: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, subject: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ticket not found",
      });
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.priority) data.priority = dto.priority;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    // If closing, record who and when
    if (dto.status === "CLOSED") {
      data.closedBy = adminId;
      data.closedAt = new Date();

      await this.redis.xadd("stream:events", {
        event_type: "TICKET_CLOSED",
        userId: ticket.userId,
        ticketId: ticket.id,
        subject: ticket.subject,
        timestamp: String(Date.now()),
      });
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
  }

  async close(ticketId: string, adminId: string) {
    return this.update(ticketId, adminId, { status: "CLOSED" });
  }
}
