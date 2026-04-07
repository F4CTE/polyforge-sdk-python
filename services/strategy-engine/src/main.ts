import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

const PORT = parseInt(process.env.PORT ?? "3006", 10);
const logger = new Logger("Bootstrap");

const REQUIRED_ENV = ["INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[strategy-engine] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
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

  // R4-04: Global exception filter to strip stack traces in production
  app.useGlobalFilters(new GlobalExceptionFilter());

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

  // R4-07: Graceful shutdown with timeout
  app.enableShutdownHooks();
  process.on("SIGTERM", () => {
    void (async () => {
      logger.log("SIGTERM received, starting graceful shutdown...");
      const forceTimeout = setTimeout(() => {
        logger.warn("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10_000);
      await app.close();
      clearTimeout(forceTimeout);
      process.exit(0);
    })();
  });

  await app.listen(PORT, "0.0.0.0");
  logger.log(`strategy-engine listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[strategy-engine] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
