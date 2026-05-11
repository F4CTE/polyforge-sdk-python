import "./instrument";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import helmet from "@fastify/helmet";
import {
  bootstrapGracefulShutdown,
  GlobalExceptionFilter,
  PrismaExceptionFilter,
} from "@polyforge/shared-filters";
import { AppModule } from "./app.module";
import { validateEnv } from "./validate-env";

const PORT = parseInt(process.env.PORT ?? "3012", 10);
const logger = new Logger("Bootstrap");

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

  // Health is at /health (no prefix), all other routes are internal-only
  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  bootstrapGracefulShutdown(app, logger);

  // In Docker, bind to 0.0.0.0 so other containers on the signer-only network
  // can reach this service. It has no published ports, so it remains unreachable
  // from the internet.
  await app.listen(PORT, "0.0.0.0");
  logger.log(`signer-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[signer-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
