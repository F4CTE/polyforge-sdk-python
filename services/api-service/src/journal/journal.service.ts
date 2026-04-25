import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";
import { UpdateJournalEntryDto } from "./dto/update-journal-entry.dto";
import type { JournalEntry } from "@prisma/client";

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: PaginationDto,
  ): Promise<PaginatedResponse<JournalEntry>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async create(
    userId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    return this.prisma.journalEntry.create({
      data: {
        userId,
        orderId: order.id,
        marketTitle: order.marketId,
        outcome: order.outcome,
        side: order.side,
        price: Number(order.price),
        size: Number(order.size),
        pnl: order.fillPrice
          ? (Number(order.fillPrice) - Number(order.price)) * Number(order.size)
          : null,
        note: dto.note ?? "",
        tags: dto.tags ?? [],
        mood: dto.mood ?? "neutral",
      },
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateJournalEntryDto,
  ): Promise<JournalEntry> {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
    if (entry.userId !== userId) throw new ForbiddenException();

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.mood !== undefined && { mood: dto.mood }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
    if (entry.userId !== userId) throw new ForbiddenException();

    await this.prisma.journalEntry.delete({ where: { id } });
  }
}
