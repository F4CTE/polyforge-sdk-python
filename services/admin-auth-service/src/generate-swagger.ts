/**
 * Standalone script — generates dist/swagger.admin-auth.json without starting an HTTP server.
 * Run via: pnpm build:swagger
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { AppModule } from './app.module';

async function generate() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: false },
    );

    app.setGlobalPrefix('auth/v1', {
        exclude: [{ path: 'health', method: RequestMethod.GET }],
    });

    const config = new DocumentBuilder()
        .setTitle('Polyforge Admin Auth API')
        .setDescription('Admin authentication — login with Redis session, logout with session revocation')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
        .addServer('http://localhost:3003', 'Local dev')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    const outDir = join(__dirname, '..', 'dist');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'swagger.admin-auth.json'), JSON.stringify(document, null, 2));

    console.log('✓ dist/swagger.admin-auth.json written');
    // Force exit — Redis/DB connections are not available during swagger generation
    process.exit(0);
}

generate().catch(err => {
    console.error(err);
    process.exit(1);
});
