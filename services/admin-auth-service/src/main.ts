import "./instrument";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import fastifyCookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { PrismaAdminService } from "@polyforge/shared-db";
import {
  rejectPlaceholderSecrets,
  rejectInsecureCookies,
  createCorsOriginDelegate,
} from "@polyforge/shared-auth";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "@polyforge/shared-filters";

const REQUIRED_ENV = ["ADMIN_JWT_SECRET", "ADMIN_DATABASE_URL"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[admin-auth-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  // Validate JWT secret minimum length (32 characters)
  const jwtSecret = process.env.ADMIN_JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    process.stderr.write(
      `[admin-auth-service] ADMIN_JWT_SECRET is not properly configured\n`,
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    const totpKey = process.env.TOTP_ENCRYPTION_KEY;
    if (!totpKey || totpKey === "0".repeat(64)) {
      process.stderr.write(
        "[admin-auth-service] TOTP_ENCRYPTION_KEY must not be all-zeros in production\n",
      );
      process.exit(1);
    }
  }

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets("admin-auth-service", [
    "ADMIN_JWT_SECRET",
    "TOTP_ENCRYPTION_KEY",
  ]);

  rejectInsecureCookies("admin-auth-service");
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: 1 }),
    { bufferLogs: true },
  );

  // Cookie plugin — must be registered before any route handlers
  await app.register(fastifyCookie as any);

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

  // CORS — admin subdomain only
  app.enableCors({
    origin: createCorsOriginDelegate({
      configuredOrigins: process.env.ADMIN_CORS_ORIGINS,
      includeDevOrigins: process.env.NODE_ENV !== "production",
      devOrigins: [
        "http://localhost:4300",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://localhost:8443",
        "https://localhost:8080",
      ],
    }),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.setGlobalPrefix("auth/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  const appLogger = app.get(Logger);
  bootstrapGracefulShutdown(app, appLogger);

  const port = process.env.ADMIN_AUTH_SERVICE_PORT ?? 3003;
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
    `[admin-auth-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
