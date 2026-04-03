import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
import compress from '@fastify/compress';
import etag from '@fastify/etag';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

const REQUIRED_ENV = ['USER_JWT_SECRET', 'INTERNAL_JWT_SECRET', 'DATABASE_URL'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(
      `[auth-service] Missing required env vars: ${missing.join(', ')}\n`,
    );
    process.exit(1);
  }

  // Validate JWT secret minimum length (32 characters)
  const secrets = ['USER_JWT_SECRET', 'INTERNAL_JWT_SECRET'];
  if (process.env.NODE_ENV === 'production') {
    secrets.push('ADMIN_JWT_SECRET', 'BOT_JWT_SECRET');
  }

  for (const key of secrets) {
    const secret = process.env[key];
    if (secret && secret.length < 32) {
      process.stderr.write(
        `[auth-service] ${key} must be at least 32 characters long (current length: ${secret.length})\n`,
      );
      process.exit(1);
    }
  }

  // Reject an all-zero TOTP encryption key in production — it's the insecure default
  if (process.env.NODE_ENV === 'production') {
    const totpKey = process.env.TOTP_ENCRYPTION_KEY ?? '';
    if (!totpKey || /^0+$/.test(totpKey)) {
      process.stderr.write(
        '[auth-service] TOTP_ENCRYPTION_KEY must not be all zeros in production\n',
      );
      process.exit(1);
    }

    // Reject CHANGE_ME default JWT secrets in production
    const secretsForDefaultCheck = [
      'USER_JWT_SECRET',
      'ADMIN_JWT_SECRET',
      'BOT_JWT_SECRET',
      'INTERNAL_JWT_SECRET',
    ];
    for (const key of secretsForDefaultCheck) {
      if (
        process.env[key]?.startsWith('CHANGE_ME') ||
        process.env[key]?.startsWith('dev-')
      ) {
        process.stderr.write(
          `[auth-service] ${key} must be changed from default in production\n`,
        );
        process.exit(1);
      }
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

  // Cookie plugin — must be registered before any route handlers
  await app.register(fastifyCookie as any);

  // Response compression (brotli preferred, gzip fallback)
  await app.register(compress as any, { encodings: ['br', 'gzip'] });

  // ETag support for conditional requests (304 Not Modified)
  await app.register(etag as any);

  // Security headers via helmet (CSP disabled — gateway manages it)
  await app.register(helmet as any, {
    contentSecurityPolicy: false,
  });

  // Logger
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        ...(process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? []),
        // dev origins — stripped in production by env check
        ...(process.env.NODE_ENV !== 'production'
          ? [
              'http://localhost',
              'http://localhost:4200',
              'http://localhost:5173',
              'http://127.0.0.1',
            ] // gateway + vite dev + IP
          : []),
      ];
      if (!origin) {
        // Server-to-server requests (no Origin header) — allow without CORS credentials
        cb(null, false);
      } else if (allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Prefix: auth/v1 — Nginx routes /auth/v1/* to this service
  // Health check excluded so it stays at /health
  app.setGlobalPrefix('auth/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // R4-07: Graceful shutdown with timeout
  app.enableShutdownHooks();
  const appLogger = app.get(Logger);
  process.on('SIGTERM', () => {
    void (async () => {
      appLogger.log('SIGTERM received, starting graceful shutdown...');
      const forceTimeout = setTimeout(() => {
        appLogger.warn('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 10_000);
      await app.close();
      clearTimeout(forceTimeout);
      process.exit(0);
    })();
  });

  const port = process.env.AUTH_SERVICE_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  process.stderr.write(`[auth-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
