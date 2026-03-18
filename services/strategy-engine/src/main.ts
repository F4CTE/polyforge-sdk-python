import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, RequestMethod } from "@nestjs/common";
import { AppModule } from "./app.module";

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

  app.setGlobalPrefix("", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
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
