import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { WsAdapter } from '@nestjs/platform-ws';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

const PORT = parseInt(process.env.PORT ?? '3002', 10);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    app.useLogger(app.get(Logger));

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));

    app.useGlobalFilters(new GlobalExceptionFilter());

    app.useWebSocketAdapter(new WsAdapter(app));

    app.setGlobalPrefix('api/v1', { exclude: ['health'] });

    // ─── Swagger ────────────────────────────────────────────────────────────────

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Polyforge API')
        .setDescription(
            'REST API for the Polyforge prediction-market strategy platform. ' +
            'All endpoints require a Bearer JWT obtained from POST /auth/v1/login.',
        )
        .setVersion('1.0')
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'jwt',
        )
        .addTag('markets',    'Market data — list, detail, price history, order book')
        .addTag('strategies', 'Strategy CRUD, lifecycle control, social actions')
        .addTag('orders',     'Order history and close-position')
        .addTag('portfolio',  'Portfolio balances, P&L charts, positions')
        .addTag('paper',      'Paper trading summary and reset')
        .addTag('backtests',  'Backtest runs and results')
        .addTag('discover',   'Public strategy discovery and leaderboard')
        .addTag('profile',    'User profiles and follow/unfollow')
        .addTag('settings',   'Profile, password, notification and TOTP settings')
        .addTag('alerts',     'Price alerts CRUD')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Always write swagger.json alongside the compiled output — consumed by
    // Postman, SDK generators, and the admin builder stats page.
    const outPath = path.join(__dirname, '..', 'swagger.json');
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf8');

    // Serve interactive docs in non-production environments
    if (process.env.NODE_ENV !== 'production') {
        SwaggerModule.setup('api/v1/docs', app, document, {
            swaggerOptions: { persistAuthorization: true },
        });
    }

    await app.listen(PORT, '0.0.0.0');
    app.get(Logger).log(`api-service listening on port ${PORT}`);
    app.get(Logger).log(`Swagger JSON written to ${outPath}`);
}

bootstrap().catch(err => {
    console.error('Failed to start api-service', err);
    process.exit(1);
});
