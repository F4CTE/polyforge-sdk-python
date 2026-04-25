import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";

export interface JournalQueryDto extends PaginationDto {
  mood?: string;
}

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: JournalQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, mood } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      userId,
      mood: mood ?? { not: null },
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          marketId: true,
          mood: true,
          note: true,
          side: true,
          outcome: true,
          price: true,
          size: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(orders, total, page, limit);
  }
}
