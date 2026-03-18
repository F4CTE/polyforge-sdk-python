import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RedisService } from "@polyforge/shared-redis";
import { PrismaService } from "@polyforge/shared-db";

const SERVICES = [
  {
    name: "auth-service",
    url: process.env.AUTH_SERVICE_URL ?? "http://auth-service:3001",
  },
  {
    name: "api-service",
    url: process.env.API_SERVICE_URL ?? "http://api-service:3002",
  },
  {
    name: "admin-auth-service",
    url: process.env.ADMIN_AUTH_SERVICE_URL ?? "http://admin-auth-service:3003",
  },
  {
    name: "market-data-service",
    url:
      process.env.MARKET_DATA_SERVICE_URL ?? "http://market-data-service:3005",
  },
  {
    name: "strategy-engine",
    url: process.env.STRATEGY_ENGINE_URL ?? "http://strategy-engine:3006",
  },
  {
    name: "order-service",
    url: process.env.ORDER_SERVICE_URL ?? "http://order-service:3007",
  },
  {
    name: "paper-order-service",
    url:
      process.env.PAPER_ORDER_SERVICE_URL ?? "http://paper-order-service:3008",
  },
  {
    name: "backtest-service",
    url: process.env.BACKTEST_SERVICE_URL ?? "http://backtest-service:3009",
  },
  {
    name: "notification-service",
    url:
      process.env.NOTIFICATION_SERVICE_URL ??
      "http://notification-service:3010",
  },
  {
    name: "bot-service",
    url: process.env.BOT_SERVICE_URL ?? "http://bot-service:3011",
  },
  {
    name: "signer-service",
    url: process.env.SIGNER_SERVICE_URL ?? "http://signer-service:3012",
  },
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron("*/10 * * * * *") // every 10 seconds
  async pollHealthChecks() {
    await Promise.allSettled(SERVICES.map((svc) => this.checkService(svc)));
  }

  private async checkService(svc: { name: string; url: string }) {
    const start = Date.now();
    try {
      const res = await fetch(`${svc.url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      const status = res.ok ? "healthy" : "degraded";
      await this.redis.getClient().set(
        `health:${svc.name}`,
        JSON.stringify({
          status,
          latencyMs,
          checkedAt: new Date().toISOString(),
        }),
        "EX",
        15,
      );
    } catch {
      await this.redis.getClient().set(
        `health:${svc.name}`,
        JSON.stringify({
          status: "down",
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        }),
        "EX",
        15,
      );
    }
  }

  async getHealth() {
    const services: Record<string, any> = {};

    for (const svc of SERVICES) {
      const raw = await this.redis.getClient().get(`health:${svc.name}`);
      services[svc.name] = raw ? JSON.parse(raw) : { status: "unknown" };
    }

    // DB connectivity
    let dbStatus = "healthy";
    let dbConnections = 0;
    try {
      const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
            `;
      dbConnections = Number(result[0]?.count ?? 0);
    } catch {
      dbStatus = "down";
    }

    // Redis connectivity
    let redisStatus = "healthy";
    let redisMemoryMb = 0;
    try {
      const info = await this.redis.getClient().info("memory");
      const match = info.match(/used_memory:(\d+)/);
      if (match) redisMemoryMb = Math.round(Number(match[1]) / 1024 / 1024);
    } catch {
      redisStatus = "down";
    }

    const allHealthy = Object.values(services).every(
      (s: any) => s.status === "healthy",
    );

    return {
      status: allHealthy ? "healthy" : "degraded",
      services,
      db: { status: dbStatus, connections: dbConnections },
      redis: { status: redisStatus, memoryUsageMb: redisMemoryMb },
    };
  }
}
