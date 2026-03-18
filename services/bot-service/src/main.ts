import { NestFactory } from "@nestjs/core";
import { RequestMethod } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

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
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
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
