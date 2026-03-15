import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.listen(process.env.AUTH_SERVICE_PORT ?? 3001, '0.0.0.0');
  console.log(`auth-service running on port ${process.env.AUTH_SERVICE_PORT ?? 3001}`);
}

bootstrap();