import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3012', 10);
const logger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    // Health is at /health (no prefix), all other routes are internal-only
    app.setGlobalPrefix('', { exclude: ['/health'] });

    // Bind only to localhost — this service MUST NOT be reachable from the
    // internet. In Docker it's on the signer-only network with no published ports.
    await app.listen(PORT, '127.0.0.1');
    logger.log(`signer-service listening on port ${PORT} (localhost only)`);
}

bootstrap().catch(err => {
    console.error('Failed to start signer-service', err);
    process.exit(1);
});
