import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from ".prisma/admin-client";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaAdminService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaAdminService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.ADMIN_DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Connected to admin database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Disconnected from admin database");
  }
}
