import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCorrelationCategories() {
    const groups = await this.prisma.market.groupBy({
      by: ["category"],
      _count: { id: true },
      _sum: { volume24h: true },
      where: { category: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const names = groups.map((c) => c.category!);
    const n = names.length;

    const matrix = buildCorrelationMatrix(
      groups.map((c) => Number(c._sum.volume24h ?? 0)),
      groups.map((c) => c._count.id),
    );

    return {
      categories: names,
      matrix,
      updatedAt: new Date().toISOString(),
    };
  }
}

function buildCorrelationMatrix(
  volumes: number[],
  counts: number[],
): number[][] {
  const n = volumes.length;
  if (n === 0) return [];

  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );

  const maxVol = Math.max(...volumes);
  const maxCount = Math.max(...counts);
  const normVols = volumes.map((v) => (maxVol > 0 ? v / maxVol : 0));
  const normCounts = counts.map((c) => (maxCount > 0 ? c / maxCount : 0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const volSim =
        Math.min(normVols[i], normVols[j]) /
        Math.max(normVols[i], normVols[j], 0.001);
      const countSim =
        Math.min(normCounts[i], normCounts[j]) /
        Math.max(normCounts[i], normCounts[j], 1);
      const raw = volSim * 0.5 + countSim * 0.3 - 0.15;
      matrix[i][j] = Math.round(Math.max(-1, Math.min(1, raw)) * 100) / 100;
      matrix[j][i] = matrix[i][j];
    }
  }

  return matrix;
}
