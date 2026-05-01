import "./instrument";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { WsAdapter } from "@nestjs/platform-ws";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import type { FastifyRequest, FastifyReply } from "fastify";
import * as fs from "fs";
import * as path from "path";
import fastifyCookie from "@fastify/cookie";
import compress from "@fastify/compress";
import etag from "@fastify/etag";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaExceptionFilter } from "@polyforge/shared-db";
import {
  rejectPlaceholderSecrets,
  validateInternalJwtConfig,
} from "@polyforge/shared-auth";

type FastifyPlugin = Parameters<NestFastifyApplication["register"]>[0];

const PORT = parseInt(process.env.PORT ?? "3002", 10);

const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_JWT_SECRET",
  "INTERNAL_JWT_AUDIENCE",
  "INTERNAL_JWT_ISSUERS",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[api-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  // Validate JWT secret minimum length (32 characters)
  const secrets = ["JWT_SECRET", "INTERNAL_JWT_SECRET"];
  for (const key of secrets) {
    const secret = process.env[key];
    if (secret && secret.length < 32) {
      process.stderr.write(
        `[api-service] ${key} must be at least 32 characters long (current length: ${secret.length})\n`,
      );
      process.exit(1);
    }
  }

  if (process.env.NODE_ENV === "production") {
    const clobUrl = process.env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes("mock")) {
      throw new Error(
        "CLOB_API_URL must point to real Polymarket API in production",
      );
    }
  }

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets("api-service", [
    "JWT_SECRET",
    "INTERNAL_JWT_SECRET",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "POLY_BUILDER_API_KEY",
    "POLY_BUILDER_SECRET",
    "POLY_BUILDER_PASSPHRASE",
  ]);

  validateInternalJwtConfig("api-service");
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: 1 }),
    { bufferLogs: true },
  );

  await app.register(fastifyCookie);

  // Response compression (brotli preferred, gzip fallback)
  await app.register(compress, {
    encodings: ["gzip", "deflate"],
  });

  // ETag support for conditional requests (304 Not Modified)
  await app.register(etag);

  // Security headers via helmet (restrictive CSP — API-only, no HTML served)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
  );

  // CORS
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        ...(process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
        ...(process.env.NODE_ENV !== "production" || process.env.CI === "true"
          ? [
              "http://localhost",
              "http://localhost:4200",
              "http://localhost:5173",
              "http://127.0.0.1",
            ] // gateway + vite dev + IP
          : []),
      ];
      if (!origin) {
        // Server-to-server requests (no Origin header) — allow without CORS credentials
        cb(null, false);
      } else if (allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
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

  // ENABLE_SWAGGER: explicit opt-in only (defaults to false).
  // Must be set to "true" to expose API docs — prevents accidental exposure.
  // Blocked unconditionally in production to prevent API reconnaissance.
  const enableSwagger =
    process.env.ENABLE_SWAGGER === "true" &&
    process.env.NODE_ENV !== "production";

  if (
    process.env.ENABLE_SWAGGER === "true" &&
    process.env.NODE_ENV === "production"
  ) {
    process.stderr.write(
      "[api-service] ENABLE_SWAGGER ignored in production — Swagger UI is disabled for security. Use build-time swagger.json for SDK generation.\n",
    );
  }

  // Write swagger.json alongside the compiled output — consumed by
  // Postman, SDK generators, and the admin builder stats page.
  // Written regardless of enableSwagger so CI/CD can use it for codegen.
  const outPath = path.join(__dirname, "..", "swagger.json");
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");

  // ─── Public OpenAPI / Swagger UI ────────────────────────────────────────────
  // These routes are only available in non-production environments.

  const fastify = app.getHttpAdapter().getInstance();

  // Gate all Swagger/OpenAPI docs behind the dedicated ENABLE_SWAGGER flag
  if (enableSwagger) {
    fastify.get(
      "/api/v1/docs/openapi.json",
      (_req: FastifyRequest, reply: FastifyReply) => {
        void reply.type("application/json").send(document);
      },
    );

    fastify.get("/api/v1/docs", (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.type("text/html").send(`<!DOCTYPE html>
<html><head><title>Polyforge API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.1/swagger-ui.css" integrity="sha384-F7uqyyVZgBbuOv+8gNy6ZGJB8Rf12CczPWm130Pxrau0cyZlj1Dl18cDOWpQSrGh" crossorigin="anonymous">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.1/swagger-ui-bundle.js" integrity="sha384-SlhRXPBpOIwNajIYH/STl3rsa6P/qCR82bZVQk1pDmWr/+Mh9g/RhaUJ1JBmM99R" crossorigin="anonymous"></script>
<script>SwaggerUIBundle({url:'/api/v1/docs/openapi.json',dom_id:'#swagger-ui'})</script>
</body></html>`);
    });

    SwaggerModule.setup("api/v1/swagger", app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }

  // R4-07: Graceful shutdown with timeout
  app.enableShutdownHooks();
  const appLogger = app.get(Logger);
  process.on("SIGTERM", () => {
    void (async () => {
      appLogger.log("SIGTERM received, starting graceful shutdown...");
      const forceTimeout = setTimeout(() => {
        appLogger.warn("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10_000);
      await app.close();
      clearTimeout(forceTimeout);
      process.exit(0);
    })();
  });

  await app.listen(PORT, "0.0.0.0");
  appLogger.log(`api-service listening on port ${PORT}`);
  appLogger.log(`Swagger JSON written to ${outPath}`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[api-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
