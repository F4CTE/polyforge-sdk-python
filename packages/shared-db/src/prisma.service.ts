import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from ".prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.PRISMA_POOL_SIZE ?? "10", 10),
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 30_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    super({
      adapter,
      log:
        process.env.NODE_ENV !== "production"
          ? [
              { emit: "event", level: "query" },
              { emit: "stdout", level: "warn" },
              { emit: "stdout", level: "error" },
            ]
          : [
              { emit: "stdout", level: "warn" },
              { emit: "stdout", level: "error" },
            ],
    });
  }

  async onModuleInit() {
    // Log slow queries in development
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this as any).$on("query", (e: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.duration > 100) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    await this.$connect();
    this.logger.log("Connected to user database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Disconnected from user database");
  }
}
