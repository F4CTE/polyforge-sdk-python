import "./instrument";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import helmet from "@fastify/helmet";
import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "@polyforge/shared-filters";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3006", 10);
const logger = new Logger("Bootstrap");

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[strategy-engine] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  rejectPlaceholderSecrets("strategy-engine", ["INTERNAL_JWT_SECRET"]);
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

  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new GlobalExceptionFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  bootstrapGracefulShutdown(app, logger);

  await app.listen(PORT, "0.0.0.0");
  logger.log(`strategy-engine listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[strategy-engine] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
