import "./instrument";

import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import helmet from "@fastify/helmet";
import {
  rejectPlaceholderSecrets,
  validateSesSmtpConfig,
} from "@polyforge/shared-auth";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3010", 10);

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[notification-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  rejectPlaceholderSecrets("notification-service", ["INTERNAL_JWT_SECRET"]);
  validateSesSmtpConfig("notification-service");
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
  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  await app.listen(PORT, "0.0.0.0");
  app.get(Logger).log(`notification-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[notification-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
