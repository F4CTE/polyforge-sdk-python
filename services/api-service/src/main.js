"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const platform_ws_1 = require("@nestjs/platform-ws");
const swagger_1 = require("@nestjs/swagger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const compress_1 = __importDefault(require("@fastify/compress"));
const etag_1 = __importDefault(require("@fastify/etag"));
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
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
        process.stderr.write(`[api-service] Missing required env vars: ${missing.join(", ")}\n`);
        process.exit(1);
    }
    // Validate JWT secret minimum length (32 characters)
    const secrets = ['INTERNAL_JWT_SECRET'];
    for (const key of secrets) {
        const secret = process.env[key];
        if (secret && secret.length < 32) {
            process.stderr.write(`[api-service] ${key} must be at least 32 characters long (current length: ${secret.length})\n`);
            process.exit(1);
        }
    }
    if (process.env.NODE_ENV === 'production') {
        // Reject CHANGE_ME default JWT secrets
        const secretsForDefaultCheck = ['USER_JWT_SECRET', 'ADMIN_JWT_SECRET', 'BOT_JWT_SECRET', 'INTERNAL_JWT_SECRET'];
        for (const key of secretsForDefaultCheck) {
            if (process.env[key]?.startsWith('CHANGE_ME')) {
                throw new Error(`${key} must be changed from default in production`);
            }
        }
        // Reject mock URLs in production
        const clobUrl = process.env.CLOB_API_URL;
        if (!clobUrl || clobUrl.includes('mock')) {
            throw new Error('CLOB_API_URL must point to real Polymarket API in production');
        }
    }
}
async function bootstrap() {
    validateEnv();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter(), { bufferLogs: true });
    await app.register(cookie_1.default);
    // Response compression (brotli preferred, gzip fallback)
    await app.register(compress_1.default, { encodings: ["gzip", "deflate"] });
    // ETag support for conditional requests (304 Not Modified)
    await app.register(etag_1.default);
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.GlobalExceptionFilter());
    // CORS
    app.enableCors({
        origin: (origin, cb) => {
            const allowed = [
                "https://polyforge.app",
                "https://www.polyforge.app",
                ...(process.env.NODE_ENV !== "production"
                    ? ["http://localhost", "http://localhost:4200", "http://localhost:5173", "http://127.0.0.1"] // gateway + vite dev + IP
                    : []),
            ];
            if (!origin || allowed.includes(origin)) {
                cb(null, true);
            }
            else {
                cb(new Error(`CORS: origin ${origin} not allowed`), false);
            }
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        credentials: true,
    });
    app.useWebSocketAdapter(new platform_ws_1.WsAdapter(app));
    app.setGlobalPrefix("api/v1", {
        exclude: [{ path: "health", method: common_1.RequestMethod.GET }],
    });
    // ─── Swagger ────────────────────────────────────────────────────────────────
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle("Polyforge API")
        .setDescription("REST API for the Polyforge prediction-market strategy platform. " +
        "All endpoints require a Bearer JWT obtained from POST /auth/v1/login.")
        .setVersion("1.0")
        .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "jwt")
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
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
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
        .addHook("onSend", (_req, reply, _payload, done) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Frame-Options", "DENY");
        reply.header("X-XSS-Protection", "1; mode=block");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        done();
    });
    // ─── Public OpenAPI / Swagger UI ────────────────────────────────────────────
    // These routes are public (no auth) so AI agents and SDK generators can
    // discover the API schema programmatically.
    const fastify = app.getHttpAdapter().getInstance();
    // Gate all Swagger/OpenAPI docs behind non-production environment
    if (process.env.NODE_ENV !== "production") {
        fastify.get("/api/v1/docs/openapi.json", (_req, reply) => {
            reply.type("application/json").send(document);
        });
        fastify.get("/api/v1/docs", (_req, reply) => {
            reply.type("text/html").send(`<!DOCTYPE html>
<html><head><title>Polyforge API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/v1/docs/openapi.json',dom_id:'#swagger-ui'})</script>
</body></html>`);
        });
        swagger_1.SwaggerModule.setup("api/v1/swagger", app, document, {
            swaggerOptions: { persistAuthorization: false },
        });
    }
    // R4-07: Graceful shutdown with timeout
    app.enableShutdownHooks();
    const appLogger = app.get(nestjs_pino_1.Logger);
    process.on('SIGTERM', async () => {
        appLogger.log('SIGTERM received, starting graceful shutdown...');
        const forceTimeout = setTimeout(() => {
            appLogger.warn('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10_000);
        await app.close();
        clearTimeout(forceTimeout);
        process.exit(0);
    });
    await app.listen(PORT, "0.0.0.0");
    appLogger.log(`api-service listening on port ${PORT}`);
    appLogger.log(`Swagger JSON written to ${outPath}`);
}
bootstrap().catch((err) => {
    process.stderr.write(`[api-service] Fatal startup error: ${String(err)}\n`);
    process.exit(1);
});
//# sourceMappingURL=main.js.map