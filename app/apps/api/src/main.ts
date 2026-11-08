import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: config.corsOrigin });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`Project Flow API listening on http://localhost:${config.port}/api/v1`);
}
bootstrap();
