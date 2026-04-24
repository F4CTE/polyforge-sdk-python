import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { CreateArbitrageAlertDto } from "./dto/create-arbitrage-alert.dto";

const MAX_ALERTS = 20;

@Injectable()
export class ArbitrageAlertService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.arbitrageAlert.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateArbitrageAlertDto) {
    const count = await this.prisma.arbitrageAlert.count({
      where: { userId, active: true },
    });
    if (count >= MAX_ALERTS) {
      throw new UnprocessableEntityException({
        code: "ALERT_LIMIT_REACHED",
        message: `Maximum ${MAX_ALERTS} arbitrage alerts allowed`,
      });
    }

    return this.prisma.arbitrageAlert.create({
      data: {
        userId,
        minSpreadPct: dto.minSpreadPct,
        marketId: dto.marketId ?? null,
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const alert = await this.prisma.arbitrageAlert.findUnique({
      where: { id },
    });
    if (!alert)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Alert not found",
      });
    if (alert.userId !== userId)
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    await this.prisma.arbitrageAlert.update({
      where: { id },
      data: { active: false },
    });
  }
}
