import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3010", 10);

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[notification-service] Missing required env vars: ${missing.join(", ")}\n`,
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

  // Security headers via helmet (CSP disabled — gateway manages it)
  await app.register(helmet as any, { contentSecurityPolicy: false });

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
