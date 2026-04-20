import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import helmet from "@fastify/helmet";
import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3007", 10);
const logger = new Logger("Bootstrap");

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[order-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  rejectPlaceholderSecrets("order-service", ["INTERNAL_JWT_SECRET"]);

  if (process.env.NODE_ENV === "production") {
    const clobUrl = process.env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes("mock")) {
      throw new Error(
        "CLOB_API_URL must point to real Polymarket API in production",
      );
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

  // Security headers via helmet (restrictive CSP — API-only, no HTML served)
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

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
  logger.log(`order-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[order-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
