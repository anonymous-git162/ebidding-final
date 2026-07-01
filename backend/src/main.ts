import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Security headers
  app.use(helmet());

  // CORS - allow all localhost and ngrok
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok-free.dev')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('E-Bidding API')
    .setDescription('Enterprise E-Bidding Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API docs at http://localhost:${port}/api/docs`);
}
bootstrap();
