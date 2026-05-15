import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { paginate } from "../common/dto/pagination.dto";
import { TicketCategory, TicketPriority } from "@prisma/client";

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, username: string, dto: CreateTicketDto) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          userId,
          subject: dto.subject,
          category: (dto.category ?? TicketCategory.GENERAL) as TicketCategory,
          priority: (dto.priority ?? TicketPriority.MEDIUM) as TicketPriority,
          status: "OPEN",
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: t.id,
          senderId: userId,
          senderName: username,
          isAdmin: false,
          body: dto.body,
        },
      });

      return t;
    });

    // Emit event for admin notification
    await this.redis.xadd("stream:events", {
      type: "TICKET_CREATED",
      userId,
      ticketId: ticket.id,
      subject: ticket.subject,
      ts: String(Date.now()),
    });

    return ticket;
  }

  async listMy(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
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
      this.prisma.ticket.count({ where: { userId } }),
    ]);

    return paginate(tickets, total, page, limit);
  }

  async getOne(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ticket not found",
      });
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }

    return ticket;
  }

  async addMessage(
    ticketId: string,
    userId: string,
    username: string,
    dto: CreateMessageDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ticket not found",
      });
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }

    if (ticket.status === "CLOSED") {
      throw new ForbiddenException({
        code: "TICKET_CLOSED",
        message: "Cannot reply to a closed ticket",
      });
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: userId,
        senderName: username,
        isAdmin: false,
        body: dto.body,
      },
    });

    // Update ticket status and clear reminder
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "AWAITING_ADMIN",
        reminderSentAt: null,
      },
    });

    return message;
  }
}
