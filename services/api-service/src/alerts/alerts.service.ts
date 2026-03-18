import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { CreateAlertDto } from "./dto/create-alert.dto";

const MAX_ALERTS = 50;

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<any[]> {
    return this.prisma.priceAlert.findMany({
      where: { userId, triggered: false },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateAlertDto): Promise<any> {
    const count = await this.prisma.priceAlert.count({
      where: { userId, triggered: false },
    });
    if (count >= MAX_ALERTS) {
      throw new UnprocessableEntityException({
        code: "ALERT_LIMIT_REACHED",
        message: "Maximum 50 alerts allowed",
      });
    }

    return this.prisma.priceAlert.create({
      data: {
        userId,
        tokenId: dto.tokenId,
        direction: dto.direction as any,
        price: dto.price,
        persistent: dto.persistent ?? false,
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
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
    await this.prisma.priceAlert.delete({ where: { id } });
  }
}
