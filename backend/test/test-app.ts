import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';

let app: INestApplication;
let prisma: PrismaService;

export async function initTestApp() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();

  prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function closeTestApp() {
  await app?.close();
}

export function getHttpServer() {
  return app.getHttpServer();
}

export function getPrismaClient() {
  return prisma;
}

export function loginAs(app: INestApplication, email: string, password: string) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });
}

export function authRequest(app: INestApplication, token: string, method: string, url: string) {
  const supertest = request(app.getHttpServer());
  const req = (supertest as any)[method](url);
  return req.set('Authorization', `Bearer ${token}`);
}
