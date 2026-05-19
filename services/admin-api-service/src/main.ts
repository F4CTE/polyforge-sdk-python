import "./instrument";

// BigInt JSON serialization (Prisma returns BigInt for @id @default(autoincrement()))
// Use toString() to avoid silent precision loss for values > Number.MAX_SAFE_INTEGER
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
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
import {
  createCorsOriginDelegate,
  rejectPlaceholderSecrets,
  validateSesSmtpConfig,
} from "@polyforge/shared-auth";
import { PrismaAdminService } from "@polyforge/shared-db";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "@polyforge/shared-filters";

const REQUIRED_ENV = [
  "ADMIN_JWT_SECRET",
  "ADMIN_DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_JWT_SECRET",
];

function getAllowedAdminCorsOrigins(): string[] {
  return [
    ...(process.env.ADMIN_CORS_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
    ...(process.env.NODE_ENV !== "production"
      ? [
          "http://localhost:4300",
          "http://localhost:8080",
          "http://127.0.0.1:8080",
          "https://localhost:8443",
          "https://polyforge-lab:8443",
        ]
      : []),
  ];
}

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
        `[admin-api-service] ${key} is not properly configured\n`,
      );
      process.exit(1);
    }
  }

  rejectPlaceholderSecrets("admin-api-service", [
    "ADMIN_JWT_SECRET",
    "INTERNAL_JWT_SECRET",
  ]);
  validateSesSmtpConfig("admin-api-service");
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: 1 }),
    { bufferLogs: true },
  );

  await app.register(fastifyCookie as any);

  // Response compression (brotli preferred, gzip fallback)
  await app.register(compress as any, { encodings: ["br", "gzip"] });

  // ETag support for conditional requests (304 Not Modified)
  await app.register(etag as any);

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
    }),
  );

  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new GlobalExceptionFilter(),
  );

  // CORS — admin subdomain only (fail-closed via shared delegate)
  app.enableCors({
    origin: createCorsOriginDelegate({
      configuredOrigins: process.env.ADMIN_CORS_ORIGINS ?? undefined,
      includeDevOrigins: process.env.NODE_ENV !== "production",
      devOrigins: [
        "http://localhost:4300",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://localhost:8443",
        "https://polyforge-lab:8443",
      ] as const,
    }),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.getHttpAdapter().getInstance().addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) return;
    if (getAllowedAdminCorsOrigins().includes(origin)) return;
    reply.code(403).send({ message: "Origin not allowed" });
  });

  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  const appLogger = app.get(Logger);
  bootstrapGracefulShutdown(app, appLogger);

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
