import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod } from "@nestjs/common";
import { AppModule } from "./app.module";

const PORT = parseInt(process.env.PORT ?? "3005", 10);
const logger = new Logger("Bootstrap");

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL"];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[market-data-service] Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const clobUrl = process.env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes('mock')) {
      throw new Error('CLOB_API_URL must point to real Polymarket API in production');
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

  // Health check is at /health (no prefix)
  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  await app.listen(PORT, "0.0.0.0");
  logger.log(`market-data-service listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[market-data-service] Fatal startup error: ${String(err)}\n`,
  );
  process.exit(1);
});
