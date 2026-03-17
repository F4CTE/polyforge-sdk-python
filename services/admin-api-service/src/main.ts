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

    app.useLogger(app.get(Logger));

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    app.useGlobalFilters(new GlobalExceptionFilter());

    // CORS — admin subdomain only
    app.enableCors({
        origin: (origin, cb) => {
            const allowed = [
                'https://admin.polyforge.app',
                ...(process.env.NODE_ENV !== 'production'
                    ? ['http://localhost:4300']
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

    app.setGlobalPrefix('api/v1', { exclude: ['health'] });

    const port = process.env.PORT ?? 3004;
    await app.listen(port, '0.0.0.0');
}

bootstrap();
