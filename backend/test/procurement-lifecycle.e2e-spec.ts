import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initTestApp, closeTestApp, getHttpServer, getPrismaClient } from './test-app';

describe('Procurement Lifecycle (e2e)', () => {
  let app: INestApplication;
  let requesterToken: string;
  let procurementToken: string;
  let prisma: ReturnType<typeof getPrismaClient>;
  let procurementId: string;

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;
    prisma = getPrismaClient();

    const login = async (email: string) => {
      const res = await request(getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123' });
      return res.body.accessToken;
    };

    requesterToken = await login('requester@ebidding.com');
    procurementToken = await login('procurement@ebidding.com');
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('should create a procurement in DRAFT status', async () => {
    const res = await request(getHttpServer())
      .post('/api/procurements')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requestType: 'RFP',
        title: 'Full Lifecycle Test',
        description: 'Testing full lifecycle',
        budgetEstimate: 500000,
      })
      .expect(201);

    procurementId = res.body.id;
    expect(res.body.status).toBe('DRAFT');
  });

  it('should transition from DRAFT to SUBMITTED', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
  });

  it('should transition from SUBMITTED to UNDER_PROCUREMENT_REVIEW', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/review/start`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .expect(201);

    expect(res.body.status).toBe('UNDER_PROCUREMENT_REVIEW');
  });

  it('should transition from UNDER_PROCUREMENT_REVIEW to RETURNED_FOR_REVISION', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/review/return`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .send({ reason: 'Please update budget estimate' })
      .expect(201);

    expect(res.body.status).toBe('RETURNED_FOR_REVISION');
  });

  it('should re-submit after revision', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
  });

  it('should re-start review from SUBMITTED', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/review/start`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .expect(201);

    expect(res.body.status).toBe('UNDER_PROCUREMENT_REVIEW');
  });

  it('should approve review from UNDER_PROCUREMENT_REVIEW', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/review/approve`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .send({ comment: 'Approved, ready for publication' })
      .expect(201);

    expect(res.body.status).toBe('APPROVED');
  });

  it('should publish from APPROVED to RFP_PUBLISHED', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/publish`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .send({ submissionDeadline: futureDate })
      .expect(201);

    expect(res.body.status).toBe('RFP_PUBLISHED');
  });

  it('should cancel from RFP_PUBLISHED', async () => {
    const res = await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/cancel`)
      .set('Authorization', `Bearer ${procurementToken}`)
      .send({ reason: 'Testing cancellation flow' })
      .expect(201);

    expect(res.body.status).toBe('CANCELLED');
  });

  it('should reject invalid transitions on CANCELLED procurement', async () => {
    await request(getHttpServer())
      .post(`/api/procurements/${procurementId}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(400);
  });
});
