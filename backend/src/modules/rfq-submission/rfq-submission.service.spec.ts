import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RfqSubmissionService } from './rfq-submission.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('RfqSubmissionService', () => {
  let service: RfqSubmissionService;
  let prisma: MockPrisma;

  const mockNotificationsService = {
    create: jest.fn(),
    createForUsers: jest.fn(),
    setGateway: jest.fn(),
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfqSubmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<RfqSubmissionService>(RfqSubmissionService);
  });

  describe('create', () => {
    it('should create a draft RFQ submission', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'p-1', status: 'RFQ_OPEN' } as any);
      const mockVendor = { id: 'v-1', userId: 'u-1' };
      prisma.vendor.findUnique.mockResolvedValue(mockVendor as any);
      prisma.vendorInvitation.findFirst.mockResolvedValue({ id: 'inv-1' } as any);
      prisma.rfqSubmission.create.mockResolvedValue({
        id: 'sub-1',
        procurementId: 'p-1',
        price: 50000,
        status: 'DRAFT',
      } as any);
      const audit = (service as any).auditService;

      const result = await service.create('p-1', 'v-1', 50000, 'Proposal text');
      expect(result).toHaveProperty('id', 'sub-1');
      expect(prisma.rfqSubmission.create).toHaveBeenCalledWith({
        data: {
          procurementId: 'p-1',
          vendorId: 'v-1',
          price: 50000,
          proposalText: 'Proposal text',
          status: 'DRAFT',
        },
      });
      // actorId must be User.id (u-1), not Vendor.id (v-1)
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUBMISSION_CREATED',
          actorId: 'u-1',
        }),
      );
    });

    it('should reject create when vendor profile is missing', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'p-1', status: 'RFQ_OPEN' } as any);
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(
        service.create('p-1', 'missing-vendor', 1000, 'x'),
      ).rejects.toThrow('Vendor profile not found');
    });
  });

  describe('submit', () => {
    it('should submit a draft submission', async () => {
      prisma.rfqSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        vendor: { userId: 'u-1', companyName: 'Test Corp' },
        status: 'DRAFT',
        procurement: {
          id: 'p-1',
          title: 'Test',
          requestNo: 'REQ-001',
          requesterId: 'requester-1',
        },
      } as any);
      prisma.rfqSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: 'SUBMITTED',
      } as any);
      prisma.user.findMany.mockResolvedValue([{ id: 'requester-1' }] as any);
      prisma.evaluatorAssignment.findMany.mockResolvedValue([] as any);

      const result = await service.submit('sub-1', 'u-1');
      expect(result.status).toBe('SUBMITTED');
    });

    it('should throw NotFoundException for missing submission', async () => {
      prisma.rfqSubmission.findUnique.mockResolvedValue(null);
      await expect(service.submit('bad-id', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a draft submission', async () => {
      prisma.rfqSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        vendor: { userId: 'u-1' },
        status: 'DRAFT',
      } as any);
      prisma.rfqSubmission.update.mockResolvedValue({
        id: 'sub-1',
        price: 55000,
      } as any);

      const result = await service.update('sub-1', 'u-1', 55000);
      expect(result.price).toBe(55000);
    });
  });

  describe('findByProcurement', () => {
    it('should return submissions when no ebidding round exists', async () => {
      prisma.rfqSubmission.findMany.mockResolvedValue([{ id: 'sub-1', vendorId: 'v-1', price: 50000 }] as any);
      prisma.ebiddingRound.findFirst.mockResolvedValue(null);

      const result = await service.findByProcurement('p-1');
      expect(result).toHaveLength(1);
      expect((result as any)[0].lastBid).toBeUndefined();
    });

    it('should include lastBid from closed ebidding round', async () => {
      const vendorId = 'v-1';
      prisma.rfqSubmission.findMany.mockResolvedValue([{ id: 'sub-1', vendorId, price: 50000 }] as any);
      prisma.ebiddingRound.findFirst.mockResolvedValue({
        id: 'round-1',
        roundNo: 2,
        status: 'CLOSED',
        responses: [{ vendorId, bidAmount: 48000 }],
      } as any);

      const result: any[] = await service.findByProcurement('p-1') as any;
      expect(result).toHaveLength(1);
      expect(result[0].lastBid).toBe(48000);
    });
  });

  describe('findMySubmission', () => {
    it('should return vendor submission for a procurement', async () => {
      const mockVendor = { id: 'v-1', userId: 'u-1' };
      prisma.vendor.findUnique.mockResolvedValue(mockVendor as any);
      prisma.rfqSubmission.findFirst.mockResolvedValue({
        id: 'sub-1',
        price: 50000,
      } as any);

      const result = await service.findMySubmission('p-1', 'u-1');
      expect(result).toHaveProperty('id', 'sub-1');
    });
  });
});
