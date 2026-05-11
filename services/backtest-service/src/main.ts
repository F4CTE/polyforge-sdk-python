import "./instrument";

import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import helmet from "@fastify/helmet";
import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "@polyforge/shared-filters";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3009", 10);

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[backtest-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  rejectPlaceholderSecrets("backtest-service", ["INTERNAL_JWT_SECRET"]);
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

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
  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  const logger = app.get(Logger);
  bootstrapGracefulShutdown(app, logger);

  await app.listen(PORT, "0.0.0.0");
  logger.log(`backtest-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[backtest-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
