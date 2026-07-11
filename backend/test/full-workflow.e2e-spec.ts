import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  initTestApp,
  closeTestApp,
  getHttpServer,
  getPrismaClient,
} from './test-app';
import { loginAs, getCookies } from './test-helper';

type RequestType = 'RFI' | 'RFP' | 'RFQ';

describe('Full Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrismaClient>;
  let requester: string, procurement: string, vendor: string, vendor2: string;
  let evaluator: string, lead: string, approver: string, admin: string;
  let evaluatorId: string, leadId: string;
  let vendorOneId: string, vendorTwoId: string;
  let vendorOneUserId: string, vendorTwoUserId: string;

  beforeAll(async () => {
    const testApp = await initTestApp();
    app = testApp.app;
    prisma = getPrismaClient();

    requester = await loginAs(getHttpServer(), 'requester@ebidding.com', 'Password123');
    procurement = await loginAs(getHttpServer(), 'procurement@ebidding.com', 'Password123');
    vendor = await loginAs(getHttpServer(), 'vendor@ebidding.com', 'Password123');
    vendor2 = await loginAs(getHttpServer(), 'vendor2@ebidding.com', 'Password123');
    evaluator = await loginAs(getHttpServer(), 'evaluator@ebidding.com', 'Password123');
    lead = await loginAs(getHttpServer(), 'lead@ebidding.com', 'Password123');
    approver = await loginAs(getHttpServer(), 'approver@ebidding.com', 'Password123');
    admin = await loginAs(getHttpServer(), 'admin@ebidding.com', 'Password123');

    const evaluatorUser = await prisma.user.findUnique({ where: { email: 'evaluator@ebidding.com' } });
    const leadUser = await prisma.user.findUnique({ where: { email: 'lead@ebidding.com' } });
    evaluatorId = evaluatorUser!.id;
    leadId = leadUser!.id;

    const v1 = await prisma.vendor.findFirst({ where: { contactEmail: 'vendor@ebidding.com' } });
    const v2 = await prisma.vendor.findFirst({ where: { contactEmail: 'vendor2@ebidding.com' } });
    vendorOneId = v1!.id;
    vendorTwoId = v2!.id;

    const v1u = await prisma.user.findUnique({ where: { email: 'vendor@ebidding.com' } });
    const v2u = await prisma.user.findUnique({ where: { email: 'vendor2@ebidding.com' } });
    vendorOneUserId = v1u!.id;
    vendorTwoUserId = v2u!.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  function futureDate(days = 60) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  test.each<RequestType>(['RFI', 'RFP', 'RFQ'])(
    'should complete full lifecycle for %s',
    async (requestType) => {
      let pid: string;

      // 1. Requester creates procurement
      const createRes = await request(getHttpServer())
        .post('/api/procurements')
        .set('Cookie', requester)
        .send({ requestType, title: `Full Workflow ${requestType} ${Date.now()}`, description: `Testing ${requestType} lifecycle`, budgetEstimate: 500000 })
        .expect(201);
      pid = createRes.body.id;
      expect(createRes.body.status).toBe('DRAFT');

      // 2. Requester submits
      const submitRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/submit`)
        .set('Cookie', requester)
        .expect(201);
      expect(submitRes.body.status).toBe('SUBMITTED');

      // 3. Procurement starts review
      const reviewStartRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/review/start`)
        .set('Cookie', procurement)
        .expect(201);
      expect(reviewStartRes.body.status).toBe('UNDER_PROCUREMENT_REVIEW');

      // 4. Procurement approves review
      const reviewApproveRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/review/approve`)
        .set('Cookie', procurement)
        .send({ comment: 'Approved' })
        .expect(201);
      expect(reviewApproveRes.body.status).toBe('APPROVED');

      // 5. Publish (type-specific)
      if (requestType === 'RFI') {
        let res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/publish`)
          .set('Cookie', procurement)
          .send({ submissionDeadline: futureDate() })
          .expect(201);
        expect(res.body.status).toBe('RFI_PUBLISHED');

        res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/rfi/start-collection`)
          .set('Cookie', procurement)
          .expect(201);
        expect(res.body.status).toBe('RFI_COLLECTING');

        res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/rfi/close`)
          .set('Cookie', procurement)
          .expect(201);
        expect(res.body.status).toBe('RFI_CLOSED');

        res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/rfp/draft`)
          .set('Cookie', procurement)
          .expect(201);
        expect(res.body.status).toBe('RFP_DRAFTING');

        res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/rfp/publish`)
          .set('Cookie', procurement)
          .send({ submissionDeadline: futureDate() })
          .expect(201);
        expect(res.body.status).toBe('RFP_PUBLISHED');
      } else if (requestType === 'RFP') {
        const res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/publish`)
          .set('Cookie', procurement)
          .send({ submissionDeadline: futureDate() })
          .expect(201);
        expect(res.body.status).toBe('RFP_PUBLISHED');
      } else {
        const res = await request(getHttpServer())
          .post(`/api/procurements/${pid}/publish`)
          .set('Cookie', procurement)
          .send({ submissionDeadline: futureDate() })
          .expect(201);
        expect(res.body.status).toBe('RFQ_OPEN');
      }

      // 6. Invite vendors (procurement)
      const inviteRes = await request(getHttpServer())
        .post('/api/vendor-invitations')
        .set('Cookie', procurement)
        .send({ procurementId: pid, vendorIds: [vendorOneId, vendorTwoId] })
        .expect(201);
      expect(Array.isArray(inviteRes.body)).toBe(true);
      expect(inviteRes.body.length).toBe(2);

      // 7. Vendors accept invitations
      const myInvites1 = await request(getHttpServer())
        .get('/api/vendor-invitations/my')
        .set('Cookie', vendor)
        .expect(200);
      const myInvites2 = await request(getHttpServer())
        .get('/api/vendor-invitations/my')
        .set('Cookie', vendor2)
        .expect(200);

      for (const inv of myInvites1.body) {
        if (inv.procurementId === pid) {
          await request(getHttpServer())
            .put(`/api/vendor-invitations/${inv.id}/accept`)
            .set('Cookie', vendor)
            .expect(200);
        }
      }
      for (const inv of myInvites2.body) {
        if (inv.procurementId === pid) {
          await request(getHttpServer())
            .put(`/api/vendor-invitations/${inv.id}/accept`)
            .set('Cookie', vendor2)
            .expect(200);
        }
      }

      // 8. Vendors submit proposals
      const sub1 = await request(getHttpServer())
        .post('/api/rfq-submissions')
        .set('Cookie', vendor)
        .send({ procurementId: pid, price: 450000, proposalText: 'Vendor One proposal' })
        .expect(201);
      await request(getHttpServer())
        .put(`/api/rfq-submissions/${sub1.body.id}/submit`)
        .set('Cookie', vendor)
        .expect(200);

      const sub2 = await request(getHttpServer())
        .post('/api/rfq-submissions')
        .set('Cookie', vendor2)
        .send({ procurementId: pid, price: 420000, proposalText: 'Vendor Two proposal' })
        .expect(201);
      await request(getHttpServer())
        .put(`/api/rfq-submissions/${sub2.body.id}/submit`)
        .set('Cookie', vendor2)
        .expect(200);

      // 9. Close vendor response
      const vendorRespRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/vendor-response/complete`)
        .set('Cookie', procurement)
        .expect(201);
      expect(vendorRespRes.body.status).toBe('VENDOR_RESPONSE_IN_PROGRESS');

      // 10. Create e-bidding round, open, bid, close
      const roundRes = await request(getHttpServer())
        .post('/api/ebidding/rounds')
        .set('Cookie', procurement)
        .send({ procurementId: pid })
        .expect(201);
      const roundId = roundRes.body.id;

      await request(getHttpServer())
        .post(`/api/ebidding/rounds/${roundId}/open`)
        .set('Cookie', procurement)
        .expect(201);

      await request(getHttpServer())
        .post('/api/ebidding/bid')
        .set('Cookie', vendor)
        .send({ roundId, bidAmount: 430000 })
        .expect(201);

      await request(getHttpServer())
        .post('/api/ebidding/bid')
        .set('Cookie', vendor2)
        .send({ roundId, bidAmount: 400000 })
        .expect(201);

      await request(getHttpServer())
        .post(`/api/ebidding/rounds/${roundId}/close`)
        .set('Cookie', procurement)
        .expect(201);

      // 11. Complete e-bidding → EVALUATION
      const ebiddingRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/ebidding/complete`)
        .set('Cookie', procurement)
        .expect(201);
      expect(ebiddingRes.body.status).toBe('EVALUATION');

      // 12. Set up evaluation
      await request(getHttpServer())
        .post('/api/evaluation/assignments')
        .set('Cookie', procurement)
        .send({ procurementId: pid, evaluatorIds: [evaluatorId], leadEvaluatorId: leadId })
        .expect(201);

      // The winning vendor from bidding is the one with lowest bid
      const bestBidderId = vendorOneUserId;

      await request(getHttpServer())
        .post('/api/evaluation/reviews')
        .set('Cookie', evaluator)
        .send({ procurementId: pid, vendorId: vendorOneId, score: 90, comment: 'Excellent' })
        .expect(201);

      await request(getHttpServer())
        .post('/api/evaluation/reviews')
        .set('Cookie', evaluator)
        .send({ procurementId: pid, vendorId: vendorTwoId, score: 80, comment: 'Good' })
        .expect(201);

      await request(getHttpServer())
        .post(`/api/evaluation/calculate/${pid}`)
        .set('Cookie', lead)
        .expect(201);

      await request(getHttpServer())
        .post(`/api/evaluation/consolidate/${pid}`)
        .set('Cookie', lead)
        .send({ recommendation: `Vendor ${bestBidderId} recommended`, leadCommentary: 'Best value' })
        .expect(201);

      // 13. Complete evaluation → PENDING_APPROVAL
      const evalRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/evaluation/complete`)
        .set('Cookie', procurement)
        .expect(201);
      expect(evalRes.body.status).toBe('PENDING_APPROVAL');

      // 14. Approver approves → AWARD_APPROVED
      const approvalRes = await request(getHttpServer())
        .post(`/api/approval/${pid}/approve`)
        .set('Cookie', approver)
        .send({ comment: 'Approved' })
        .expect(201);
      expect(approvalRes.body.status).toBe('AWARD_APPROVED');

      // 15. Announce award → AWARD_ANNOUNCED
      const announceRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/award/announce`)
        .set('Cookie', procurement)
        .send({ winningVendorId: vendorOneId, announcementText: 'Vendor One wins' })
        .expect(201);
      expect(announceRes.body.status).toBe('AWARD_ANNOUNCED');

      // 16. Complete procurement → COMPLETED
      const completeRes = await request(getHttpServer())
        .post(`/api/procurements/${pid}/award/complete`)
        .set('Cookie', procurement)
        .expect(201);
      expect(completeRes.body.status).toBe('COMPLETED');

      // ponytail: cleanup is best-effort (test DB is ephemeral)
      try {
        await request(getHttpServer())
          .delete(`/api/procurements/${pid}`)
          .set('Cookie', admin);
      } catch {}
    },
    120000,
  );
});
