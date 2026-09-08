import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './common/zod-exception.filter';

/**
 * NestJS'in sardığı Fastify tipi ile eklenti augmentasyonları arasındaki
 * bilinen tip uyumsuzluğu — çalışma zamanında sorun değil, kayıt için daraltıyoruz.
 */
type FastifyPlugin = Parameters<NestFastifyApplication['register']>[0];
const helmet = fastifyHelmet as unknown as FastifyPlugin;
const rateLimit = fastifyRateLimit as unknown as FastifyPlugin;

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger: false,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // OTP uçları servis içinde ayrıca sınırlanıyor
  });

  app.enableCors({
    origin: [process.env.ADMIN_URL ?? 'http://localhost:3000'],
    credentials: true,
  });

  // Girdi doğrulama zod ile controller/procedure seviyesinde yapılır (tRPC ile ortak sözleşme).
  app.useGlobalFilters(new ZodExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  new Logger('bootstrap').log(`API hazır: http://localhost:${port}`);
}

void bootstrap();
