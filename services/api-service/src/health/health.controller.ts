import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

/* Internal service URLs — only reachable from within the Docker network */
const INTERNAL_SERVICES: { name: string; label: string; url: string }[] = [
  {
    name: "auth",
    label: "Auth Service",
    url: "http://auth-service:3001/health",
  },
  {
    name: "strategy",
    label: "Strategy Engine",
    url: "http://strategy-engine:3006/health",
  },
  {
    name: "order",
    label: "Order Service",
    url: "http://order-service:3007/health",
  },
  {
    name: "paper",
    label: "Paper Order Service",
    url: "http://paper-order-service:3008/health",
  },
  {
    name: "backtest",
    label: "Backtest Service",
    url: "http://backtest-service:3009/health",
  },
  {
    name: "notification",
    label: "Notification Service",
    url: "http://notification-service:3010/health",
  },
  {
    name: "marketdata",
    label: "Market Data Service",
    url: "http://market-data-service:3005/health",
  },
  {
    name: "signer",
    label: "Signer Service",
    url: "http://signer-service:3012/health",
  },
  { name: "bot", label: "Bot Service", url: "http://bot-service:3011/health" },
];

async function pingService(
  url: string,
): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

@ApiExcludeController()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "api-service" };
  }
}

@ApiTags("Status")
@Controller("status")
export class StatusController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Aggregated service health status" })
  async status() {
    const start = Date.now();

    /* ── Core dependency checks ── */
    const [dbResult, redisResult] = await Promise.allSettled([
      this.prisma.$queryRaw<[{ one: number }]>`SELECT 1 AS one`.then(
        () => true,
      ),
      this.redis
        .getClient()
        .ping()
        .then(() => true),
    ]);

    const dbOk = dbResult.status === "fulfilled" && dbResult.value === true;
    const redisOk =
      redisResult.status === "fulfilled" && redisResult.value === true;

    /* ── Internal service checks (parallel, 2 s timeout each) ── */
    const svcResults = await Promise.all(
      INTERNAL_SERVICES.map(async (svc) => {
        const { ok, latencyMs } = await pingService(svc.url);
        return { name: svc.name, label: svc.label, ok, latencyMs };
      }),
    );

    /* ── Assemble response ── */
    const allOk = dbOk && redisOk && svcResults.every((s) => s.ok);

    return {
      status: allOk ? "operational" : "degraded",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - start,
      services: [
        { name: "api", label: "API Service", ok: true, latencyMs: 0 },
        { name: "database", label: "Database", ok: dbOk, latencyMs: null },
        { name: "cache", label: "Cache (Redis)", ok: redisOk, latencyMs: null },
        ...svcResults.map((s) => ({
          name: s.name,
          label: s.label,
          ok: s.ok,
          latencyMs: s.latencyMs,
        })),
      ],
    };
  }
}
