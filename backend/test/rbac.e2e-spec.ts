import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initTestApp, closeTestApp, getHttpServer, getPrismaClient } from './test-app';

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let requesterToken: string;
  let procurementToken: string;
  let adminToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;

    const login = async (email: string) => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123' });
      return res.body.accessToken;
    };

    requesterToken = await login('requester@ebidding.com');
    procurementToken = await login('procurement@ebidding.com');
    adminToken = await login('admin@ebidding.com');
    vendorToken = await login('vendor@ebidding.com');
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /api/procurements (create)', () => {
    const createPayload = {
      requestType: 'RFP',
      title: 'RBAC Test Procurement',
      description: 'For RBAC testing',
      budgetEstimate: 100000,
    };

    it('should allow REQUESTER to create procurement', async () => {
      const res = await request(getHttpServer())
        .post('/api/procurements')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send(createPayload)
        .expect(201);

      expect(res.body.status).toBe('DRAFT');
    });

    it('should allow PROCUREMENT to create procurement', async () => {
      await request(getHttpServer())
        .post('/api/procurements')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send(createPayload)
        .expect(201);
    });

    it('should allow ADMIN to create procurement', async () => {
      await request(getHttpServer())
        .post('/api/procurements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayload)
        .expect(201);
    });

    it('should reject VENDOR from creating procurement', async () => {
      await request(getHttpServer())
        .post('/api/procurements')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(createPayload)
        .expect(403);
    });
  });

  describe('GET /api/procurements', () => {
    it('should allow all roles to list procurements', async () => {
      await request(getHttpServer())
        .get('/api/procurements')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      await request(getHttpServer())
        .get('/api/procurements')
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);
    });

    it('should reject unauthenticated requests', async () => {
      await request(getHttpServer()).get('/api/procurements').expect(401);
    });
  });

  describe('Admin-only endpoints', () => {
    it('should reject non-ADMIN from accessing /api/procurements/stats', async () => {
      await request(getHttpServer())
        .get('/api/procurements/stats')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(403);
    });

    it('should allow ADMIN to access stats', async () => {
      await request(getHttpServer())
        .get('/api/procurements/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Unauthenticated access', () => {
    it('should allow unauthenticated registration', async () => {
      await request(getHttpServer())
        .post('/api/auth/register')
        .send({ email: `e2e-rbac-${Date.now()}@test.com`, password: 'TestPass123', fullName: 'RBAC Test' })
        .expect(201);
    });

    it('should reject unauthenticated access to procurements', async () => {
      await request(getHttpServer())
        .get('/api/procurements')
        .expect(401);
    });
  });
});
