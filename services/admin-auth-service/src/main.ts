import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaAdminService } from "@polyforge/shared-db";

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
      `[admin-auth-service] ADMIN_JWT_SECRET must be at least 32 characters long (current length: ${jwtSecret.length})\n`,
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
    if (jwtSecret?.startsWith("dev-") || jwtSecret?.startsWith("CHANGE_ME")) {
      process.stderr.write(
        "[admin-auth-service] ADMIN_JWT_SECRET must be changed from default in production\n",
      );
      process.exit(1);
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

  // Cookie plugin — must be registered before any route handlers
  await app.register(fastifyCookie as any);

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
        "https://admin.polyforge.app",
        ...(process.env.NODE_ENV !== "production"
          ? ["http://localhost:4300", "http://localhost:8080", "http://127.0.0.1:8080"]
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

  app.setGlobalPrefix("auth/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

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

  const port = process.env.ADMIN_AUTH_SERVICE_PORT ?? 3003;
  await app.listen(port, "0.0.0.0");

  const logger = app.get(Logger);
  const prisma = app.get(PrismaAdminService);
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.log('Database connection verified');
  } catch (err) {
    logger.error('Database connection failed on startup, retrying...', err);
    await new Promise(r => setTimeout(r, 2000));
    await prisma.$queryRaw`SELECT 1`;
    logger.log('Database connection verified on retry');
  }
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[admin-auth-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
