import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3007', 10);
const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    app.setGlobalPrefix('', { exclude: ['/health'] });

    await app.listen(PORT, '0.0.0.0');
    logger.log(`order-service listening on port ${PORT}`);
}

bootstrap().catch(err => {
    console.error('Failed to start order-service', err);
    process.exit(1);
});
