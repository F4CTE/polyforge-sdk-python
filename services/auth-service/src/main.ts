import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  // Logger
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = [
        'https://polyforge.app',
        'https://www.polyforge.app',
        // dev origins — stripped in production by env check
        ...(process.env.NODE_ENV !== 'production'
          ? ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4300']
          : []),
      ];
      if (!origin || allowed.includes(origin)) {
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
  app.setGlobalPrefix('auth/v1', { exclude: ['health'] });

  const port = process.env.AUTH_SERVICE_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`auth-service running on port ${port}`);
}

bootstrap();