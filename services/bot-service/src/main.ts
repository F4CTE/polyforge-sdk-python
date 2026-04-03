import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";

const PORT = parseInt(process.env.PORT ?? "3011", 10);

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "INTERNAL_JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[bot-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets("bot-service", [
    "INTERNAL_JWT_SECRET",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
  ]);
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
  app.get(Logger).log(`bot-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[bot-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
