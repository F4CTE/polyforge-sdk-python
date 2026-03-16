import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3005', 10);
const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    // Health check is at /health (no prefix)
    app.setGlobalPrefix('', { exclude: ['/health'] });

    await app.listen(PORT, '0.0.0.0');
    logger.log(`market-data-service listening on port ${PORT}`);
}

bootstrap().catch(err => {
    console.error('Failed to start market-data-service', err);
    process.exit(1);
});
