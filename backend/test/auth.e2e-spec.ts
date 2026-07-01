import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initTestApp, closeTestApp, getHttpServer, getPrismaClient } from './test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const testEmail = `e2e-auth-${Date.now()}@test.com`;
  const testPassword = 'TestPass123';

  describe('POST /api/auth/register', () => {
    it('should register a new user with REQUESTER role', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'E2E Auth User' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe('REQUESTER');
    });

    it('should reject duplicate email', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'Duplicate' })
        .expect(401);

      expect(res.body.message).toBe('Email already registered');
    });

    it('should reject weak password', async () => {
      await request(getHttpServer())
        .post('/api/auth/register')
        .send({ email: `weak-${Date.now()}@test.com`, password: 'short', fullName: 'Weak' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'requester@ebidding.com', password: 'Password123' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('requester@ebidding.com');
    });

    it('should return generic error for wrong password', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'requester@ebidding.com', password: 'WrongPass1' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should return generic error for non-existent email', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'TestPass123' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'requester@ebidding.com', password: 'Password123' });
      token = res.body.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const res = await request(getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe('requester@ebidding.com');
    });

    it('should return 401 without token', async () => {
      await request(getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'requester@ebidding.com', password: 'Password123' });
      refreshToken = res.body.refreshToken;
    });

    it('should rotate tokens with valid refresh token', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.accessToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await request(getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let token: string;
    const newPassword = 'NewPass456';

    beforeAll(async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });
      token = res.body.accessToken;
    });

    it('should change password with valid request', async () => {
      await request(getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: testPassword, newPassword })
        .expect(201);
    });

    it('should login with new password', async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: newPassword })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject wrong current password', async () => {
      await request(getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPass1', newPassword: 'Another1' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'requester@ebidding.com', password: 'Password123' });
      token = res.body.accessToken;
    });

    it('should logout successfully', async () => {
      await request(getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    });

    it('should require auth for logout', async () => {
      await request(getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });
  });
});
