import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { WsAdapter } from '@nestjs/platform-ws';
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

    // WebSocket adapter (native ws, works alongside Fastify)
    app.useWebSocketAdapter(new WsAdapter(app));

    app.setGlobalPrefix('api/v1', { exclude: ['health'] });

    await app.listen(PORT, '0.0.0.0');
    app.get(Logger).log(`api-service listening on port ${PORT}`);
}

bootstrap().catch(err => {
    console.error('Failed to start api-service', err);
    process.exit(1);
});
