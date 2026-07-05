import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { AppModule } from './app.module';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

async function bootstrap() {
  requireEnv('JWT_SECRET');
  requireEnv('REFRESH_TOKEN_SECRET');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // CSP nonce generation (one per request)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
    next();
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  // Content-Security-Policy: strict nonce-based for API, relaxed for Swagger UI
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isSwagger = req.path.startsWith('/api/docs');
    res.setHeader(
      'Content-Security-Policy',
      isSwagger
        ? [
            `default-src 'self'`,
            `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
            `style-src 'self' 'unsafe-inline'`,
            `img-src 'self' data: validator.swagger.io`,
            `font-src 'self' data:`,
            `connect-src 'self'`,
            `object-src 'none'`,
            `base-uri 'self'`,
            `form-action 'self'`,
            `frame-ancestors 'none'`,
          ].join('; ')
        : [
            `default-src 'self'`,
            `script-src 'self' 'nonce-${res.locals.cspNonce}'`,
            `style-src 'self' 'nonce-${res.locals.cspNonce}'`,
            `img-src 'self' data:`,
            `font-src 'self'`,
            `connect-src 'self'`,
            `object-src 'none'`,
            `base-uri 'self'`,
            `form-action 'self'`,
            `frame-ancestors 'none'`,
          ].join('; '),
    );
    next();
  });

  // Restrict browser features and cross-origin resource loading
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), display-capture=(), fullscreen=(), payment=()',
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

  // Cookie parser for httpOnly JWT cookies
  app.use(cookieParser());

  // CORS - allow configured frontend URL and localhost for development
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    maxAge: 86400,
  });

  // Cache-Control: prevent caching sensitive data
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  // CSRF protection: custom header check (cross-origin requests can't set custom headers without CORS preflight)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) {
      const csrfHeader = req.headers['x-requested-by'];
      if (!csrfHeader || csrfHeader !== 'ebidding-app') {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
    }
    next();
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
