import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initTestApp, closeTestApp, getHttpServer, getPrismaClient } from './test-app';

describe('Account Lockout (e2e)', () => {
  let app: INestApplication;
  let lockoutEmail: string;
  const lockoutPassword = 'TestLock1';

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;
    lockoutEmail = `e2e-lockout-${Date.now()}@test.com`;

    await request(getHttpServer())
      .post('/api/auth/register')
      .send({ email: lockoutEmail, password: lockoutPassword, fullName: 'Lockout Test' })
      .expect(201);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('should lock account after 5 failed login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: lockoutEmail, password: 'WrongPass1' })
        .expect(401);
    }

    const res = await request(getHttpServer())
      .post('/api/auth/login')
      .send({ email: lockoutEmail, password: lockoutPassword })
      .expect(401);

    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should allow login after admin unlocks the account', async () => {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email: lockoutEmail } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const res = await request(getHttpServer())
      .post('/api/auth/login')
      .send({ email: lockoutEmail, password: lockoutPassword })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
  });

  it('should not lock other users when one user is locked', async () => {
    const otherEmail = `e2e-other-${Date.now()}@test.com`;

    await request(getHttpServer())
      .post('/api/auth/register')
      .send({ email: otherEmail, password: lockoutPassword, fullName: 'Other User' })
      .expect(201);

    await request(getHttpServer())
      .post('/api/auth/login')
      .send({ email: otherEmail, password: lockoutPassword })
      .expect(201);
  });
});
