import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCorrelationCategories() {
    const categories = await this.prisma.market.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { category: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    return {
      categories: categories.map((c) => ({
        name: c.category ?? "Unknown",
        marketCount: c._count.id,
        avgCorrelation: 0,
      })),
    };
  }
}
