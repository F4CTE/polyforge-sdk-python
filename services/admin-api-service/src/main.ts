// BigInt JSON serialization (Prisma returns BigInt for @id @default(autoincrement()))
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import fastifyCookie from "@fastify/cookie";
import compress from "@fastify/compress";
import etag from "@fastify/etag";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaAdminService } from "@polyforge/shared-db";

const REQUIRED_ENV = [
  "ADMIN_JWT_SECRET",
  "ADMIN_DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_JWT_SECRET",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[admin-api-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  // Validate JWT secret minimum length (32 characters)
  const secrets = ["ADMIN_JWT_SECRET", "INTERNAL_JWT_SECRET"];
  for (const key of secrets) {
    const secret = process.env[key];
    if (secret && secret.length < 32) {
      process.stderr.write(
        `[admin-api-service] ${key} must be at least 32 characters long (current length: ${secret.length})\n`,
      );
      process.exit(1);
    }
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  await app.register(fastifyCookie as any);

  // Response compression (brotli preferred, gzip fallback)
  await app.register(compress as any, { encodings: ["br", "gzip"] });

  // ETag support for conditional requests (304 Not Modified)
  await app.register(etag as any);

  // Security headers via helmet (CSP disabled — gateway manages it)
  await app.register(helmet as any, {
    contentSecurityPolicy: false,
  });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS — admin subdomain only
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        ...(process.env.ADMIN_CORS_ORIGINS?.split(",").map((s) => s.trim()) ??
          []),
        ...(process.env.NODE_ENV !== "production"
          ? [
              "http://localhost:4300",
              "http://localhost:8080",
              "http://127.0.0.1:8080",
            ]
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
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

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

  const port = process.env.PORT ?? 3004;
  await app.listen(port, "0.0.0.0");

  const logger = app.get(Logger);
  const prisma = app.get(PrismaAdminService);
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.log("Database connection verified");
  } catch (err) {
    logger.error("Database connection failed on startup, retrying...", err);
    await new Promise((r) => setTimeout(r, 2000));
    await prisma.$queryRaw`SELECT 1`;
    logger.log("Database connection verified on retry");
  }
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[admin-api-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
