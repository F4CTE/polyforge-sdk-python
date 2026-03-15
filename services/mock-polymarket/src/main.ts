import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { GammaAppModule, DataAppModule, ClobAppModule } from './app.module';

const GAMMA_PORT = parseInt(process.env.GAMMA_PORT ?? '3096', 10);
const DATA_PORT  = parseInt(process.env.DATA_PORT  ?? '3097', 10);
const CLOB_PORT  = parseInt(process.env.CLOB_PORT  ?? '3099', 10);
// WS port 3098 is handled by WsFeedService directly (ws library, not NestJS HTTP)

async function bootstrap() {
    const scenario = process.env.SCENARIO ?? 'normal';
    console.log(`[mock-polymarket] Starting in scenario: ${scenario}`);

    // ── CLOB REST + WS Feed (shares ScenarioService via module) ─────────────
    const clobApp = await NestFactory.create<NestFastifyApplication>(
        ClobAppModule,
        new FastifyAdapter({ logger: false }),
        { logger: ['error', 'warn'] },
    );
    clobApp.enableCors();
    await clobApp.listen(CLOB_PORT, '0.0.0.0');
    console.log(`[mock-polymarket] CLOB REST API  → http://0.0.0.0:${CLOB_PORT}`);

    // ── Gamma API ─────────────────────────────────────────────────────────────
    const gammaApp = await NestFactory.create<NestFastifyApplication>(
        GammaAppModule,
        new FastifyAdapter({ logger: false }),
        { logger: ['error', 'warn'] },
    );
    gammaApp.enableCors();
    await gammaApp.listen(GAMMA_PORT, '0.0.0.0');
    console.log(`[mock-polymarket] Gamma API       → http://0.0.0.0:${GAMMA_PORT}`);

    // ── Data API ──────────────────────────────────────────────────────────────
    const dataApp = await NestFactory.create<NestFastifyApplication>(
        DataAppModule,
        new FastifyAdapter({ logger: false }),
        { logger: ['error', 'warn'] },
    );
    dataApp.enableCors();
    await dataApp.listen(DATA_PORT, '0.0.0.0');
    console.log(`[mock-polymarket] Data API        → http://0.0.0.0:${DATA_PORT}`);

    // WS port is logged by WsFeedService.onModuleInit()
    console.log(`[mock-polymarket] WebSocket Feed  → ws://0.0.0.0:${process.env.WS_PORT ?? 3098}`);
}

bootstrap().catch(err => {
    console.error('[mock-polymarket] Failed to start', err);
    process.exit(1);
});
