import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { WsAdapter } from "@nestjs/platform-ws";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_JWT_SECRET",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[api-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    // Reject CHANGE_ME default JWT secrets
    const secrets = ['USER_JWT_SECRET', 'ADMIN_JWT_SECRET', 'BOT_JWT_SECRET', 'INTERNAL_JWT_SECRET'];
    for (const key of secrets) {
      if (process.env[key]?.startsWith('CHANGE_ME')) {
        throw new Error(`${key} must be changed from default in production`);
      }
    }

    // Reject mock URLs in production
    const clobUrl = process.env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes('mock')) {
      throw new Error('CLOB_API_URL must point to real Polymarket API in production');
    }
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  await app.register(fastifyCookie as any);

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        "https://polyforge.app",
        "https://www.polyforge.app",
        ...(process.env.NODE_ENV !== "production"
          ? ["http://localhost", "http://localhost:4200", "http://localhost:5173", "http://127.0.0.1"] // gateway + vite dev + IP
          : []),
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // ─── Swagger ────────────────────────────────────────────────────────────────

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Polyforge API")
    .setDescription(
      "REST API for the Polyforge prediction-market strategy platform. " +
        "All endpoints require a Bearer JWT obtained from POST /auth/v1/login.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "jwt",
    )
    .addTag("markets", "Market data — list, detail, price history, order book")
    .addTag("strategies", "Strategy CRUD, lifecycle control, social actions")
    .addTag("orders", "Order history and close-position")
    .addTag("portfolio", "Portfolio balances, P&L charts, positions")
    .addTag("paper", "Paper trading summary and reset")
    .addTag("backtests", "Backtest runs and results")
    .addTag("discover", "Public strategy discovery and leaderboard")
    .addTag("profile", "User profiles and follow/unfollow")
    .addTag("settings", "Profile, password, notification and TOTP settings")
    .addTag("alerts", "Price alerts CRUD")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Write swagger.json alongside the compiled output — consumed by
  // Postman, SDK generators, and the admin builder stats page.
  const outPath = path.join(__dirname, "..", "swagger.json");
  if (process.env.NODE_ENV !== "production") {
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  }

  // Security headers
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onSend", (_req: any, reply: any, _payload: any, done: any) => {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("X-XSS-Protection", "1; mode=block");
      reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
      done();
    });

  // ─── Public OpenAPI / Swagger UI ────────────────────────────────────────────
  // These routes are public (no auth) so AI agents and SDK generators can
  // discover the API schema programmatically.

  const fastify = app.getHttpAdapter().getInstance();

  fastify.get("/api/v1/docs/openapi.json", (_req: any, reply: any) => {
    reply.type("application/json").send(document);
  });

  fastify.get("/api/v1/docs", (_req: any, reply: any) => {
    reply.type("text/html").send(`<!DOCTYPE html>
<html><head><title>Polyforge API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/v1/docs/openapi.json',dom_id:'#swagger-ui'})</script>
</body></html>`);
  });

  // Also keep NestJS Swagger UI in non-production for backwards compat
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("api/v1/swagger", app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }

  // R4-07: Graceful shutdown with timeout
  app.enableShutdownHooks();
  const appLogger = app.get(Logger);
  process.on('SIGTERM', async () => {
    appLogger.log('SIGTERM received, starting graceful shutdown...');
    const forceTimeout = setTimeout(() => {
      appLogger.warn('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    await app.close();
    clearTimeout(forceTimeout);
    process.exit(0);
  });

  await app.listen(PORT, "0.0.0.0");
  appLogger.log(`api-service listening on port ${PORT}`);
  appLogger.log(`Swagger JSON written to ${outPath}`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[api-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
