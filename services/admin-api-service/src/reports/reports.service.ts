import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { ReviewReportDto } from "./dto/review-report.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {};
    if (status) where.status = status as any;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { username: true, email: true } },
          strategy: { select: { name: true, userId: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async review(id: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Report not found",
      });
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status as any,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }
}
