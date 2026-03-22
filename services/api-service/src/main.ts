import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { WsAdapter } from "@nestjs/platform-ws";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_JWT_SECRET",
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[api-service] Missing required env vars: ${missing.join(", ")}\n`,
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

  await app.register(fastifyCookie as any);

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        "https://polyforge.app",
        "https://www.polyforge.app",
        ...(process.env.NODE_ENV !== "production"
          ? ["http://localhost", "http://localhost:4200"] // gateway + ng serve
          : []),
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // ─── Swagger ────────────────────────────────────────────────────────────────

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Polyforge API")
    .setDescription(
      "REST API for the Polyforge prediction-market strategy platform. " +
        "All endpoints require a Bearer JWT obtained from POST /auth/v1/login.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "jwt",
    )
    .addTag("markets", "Market data — list, detail, price history, order book")
    .addTag("strategies", "Strategy CRUD, lifecycle control, social actions")
    .addTag("orders", "Order history and close-position")
    .addTag("portfolio", "Portfolio balances, P&L charts, positions")
    .addTag("paper", "Paper trading summary and reset")
    .addTag("backtests", "Backtest runs and results")
    .addTag("discover", "Public strategy discovery and leaderboard")
    .addTag("profile", "User profiles and follow/unfollow")
    .addTag("settings", "Profile, password, notification and TOTP settings")
    .addTag("alerts", "Price alerts CRUD")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Write swagger.json alongside the compiled output — consumed by
  // Postman, SDK generators, and the admin builder stats page.
  const outPath = path.join(__dirname, "..", "swagger.json");
  if (process.env.NODE_ENV !== "production") {
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  }

  // Security headers
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onSend", (_req: any, reply: any, _payload: any, done: any) => {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("X-XSS-Protection", "1; mode=block");
      reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
      done();
    });

  // Serve interactive docs in non-production environments
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("api/v1/docs", app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }

  await app.listen(PORT, "0.0.0.0");
  app.get(Logger).log(`api-service listening on port ${PORT}`);
  app.get(Logger).log(`Swagger JSON written to ${outPath}`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[api-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
