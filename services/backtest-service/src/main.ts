import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

const PORT = parseInt(process.env.PORT ?? '3009', 10);

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL'];

function validateEnv() {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length) {
        process.stderr.write(`[backtest-service] Missing required env vars: ${missing.join(', ')}\n`);
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

    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('', { exclude: ['health'] });

    await app.listen(PORT, '0.0.0.0');
    app.get(Logger).log(`backtest-service listening on port ${PORT}`);
}

bootstrap().catch(err => {
    process.stderr.write(`[backtest-service] Fatal startup error: ${String(err)}\n`);
    process.exit(1);
});
