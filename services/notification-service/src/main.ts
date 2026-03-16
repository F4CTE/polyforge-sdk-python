import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3010', 10);

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('', { exclude: ['health'] });

    await app.listen(PORT, '0.0.0.0');
    app.get(Logger).log(`notification-service listening on port ${PORT}`);
}

bootstrap().catch(err => {
    console.error('Failed to start notification-service', err);
    process.exit(1);
});
