import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { execSync } from 'child_process';

let app: INestApplication;
let prisma: PrismaService;
let moduleFixture: TestingModule;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ebidding_test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-testing';

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: __dirname + '/..',
  });

  moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();

  prisma = app.get(PrismaService);
});

afterAll(async () => {
  if (prisma) {
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }
  }
  await app?.close();
});

export const getApp = () => app;
export const getPrisma = () => prisma;
export const getModule = () => moduleFixture;
