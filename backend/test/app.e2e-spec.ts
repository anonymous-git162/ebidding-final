import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initTestApp, closeTestApp, getHttpServer } from './test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;

    const res = await request(getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'requester@ebidding.com', password: 'Password123' });
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /api/procurements/currencies should return 200 with auth', async () => {
    await request(getHttpServer())
      .get('/api/procurements/currencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
