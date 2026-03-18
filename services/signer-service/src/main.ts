import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3012', 10);
const logger = new Logger('Bootstrap');

const REQUIRED_ENV = ['INTERNAL_JWT_SECRET', 'ENCRYPTION_KEY', 'REDIS_URL'];

function validateEnv() {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length) {
        process.stderr.write(`[signer-service] Missing required env vars: ${missing.join(', ')}\n`);
        process.exit(1);
    }
}

async function bootstrap() {
    validateEnv();
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { bufferLogs: true },
    );

    // Health is at /health (no prefix), all other routes are internal-only
    app.setGlobalPrefix('', {
        exclude: [{ path: 'health', method: RequestMethod.GET }],
    });

    // Bind only to localhost — this service MUST NOT be reachable from the
    // internet. In Docker it's on the signer-only network with no published ports.
    await app.listen(PORT, '127.0.0.1');
    logger.log(`signer-service listening on port ${PORT} (localhost only)`);
}

bootstrap().catch((err) => {
    process.stderr.write(`[signer-service] Fatal startup error: ${String(err)}\n`);
    process.exit(1);
});
