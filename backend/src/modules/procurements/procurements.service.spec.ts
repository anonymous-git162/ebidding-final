import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProcurementsService } from './procurements.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalService } from '../approval/approval.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('ProcurementsService', () => {
  let service: ProcurementsService;
  let prisma: MockPrisma;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    fullName: 'Test',
    role: 'REQUESTER',
  };
  const mockProcurement = {
    id: 'proc-1',
    requestNo: 'RFP-20260701-0001',
    requestType: 'RFP',
    title: 'Test Procurement',
    description: 'Test description',
    businessNeed: 'Test need',
    propertyId: 'prop-1',
    departmentId: 'dept-1',
    category: 'IT',
    currency: 'USD',
    budgetEstimate: 100000,
    justification: 'Test justification',
    requesterId: 'user-1',
    status: 'DRAFT',
    currentOwnerRole: 'REQUESTER',
    currentStage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    submissionDeadline: null,
  };

  const mockNotificationsService = {
    create: jest.fn(),
    createForUsers: jest.fn(),
    setGateway: jest.fn(),
  };

  const mockApprovalService = {
    routeToApprover: jest.fn(),
  };

  const mockEvaluationService = {
    assignEvaluators: jest.fn(),
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ApprovalService, useValue: mockApprovalService },
        { provide: EvaluationService, useValue: mockEvaluationService },
      ],
    }).compile();

    service = module.get<ProcurementsService>(ProcurementsService);
  });

  describe('create', () => {
    it('should create a procurement with generated request number', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        propertyId: 'prop-1',
      });
      prisma.procurement.create.mockResolvedValue(mockProcurement);
      prisma.file.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.create(
        {
          requestType: 'RFP',
          title: 'Test Procurement',
          description: 'Test description',
          businessNeed: 'Test need',
          category: 'IT',
          budgetEstimate: 100000,
          justification: 'Test justification',
          departmentId: 'dept-1',
          fileIds: [],
        },
        'user-1',
      );

      expect(result).toHaveProperty('status', 'DRAFT');
      expect(result).toHaveProperty('requestNo');
      expect(result.requestNo).toMatch(/^RFP-/);
    });

    it('should auto-assign user property if not provided', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        propertyId: 'prop-1',
      });
      prisma.procurement.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...mockProcurement, ...data }),
      );
      prisma.file.updateMany.mockResolvedValue({ count: 0 });

      await service.create(
        {
          requestType: 'RFP',
          title: 'Test',
          departmentId: 'dept-1',
        } as any,
        'user-1',
      );

      expect(prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ propertyId: 'prop-1' }),
        }),
      );
    });

    it('should link files when fileIds provided', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        propertyId: 'prop-1',
      });
      prisma.procurement.create.mockResolvedValue(mockProcurement);
      prisma.file.updateMany.mockResolvedValue({ count: 2 });

      await service.create(
        {
          requestType: 'RFP',
          title: 'With Files',
          fileIds: ['file-1', 'file-2'],
        } as any,
        'user-1',
      );

      expect(prisma.file.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['file-1', 'file-2'] } },
        data: { procurementId: 'proc-1' },
      });
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        propertyId: null,
      });
      prisma.procurement.findMany.mockResolvedValue([mockProcurement]);
      prisma.procurement.count.mockResolvedValue(1);
      prisma.procurement.groupBy.mockResolvedValue([
        { status: 'DRAFT', _count: { status: 1 } },
      ]);
    });

    it('should return paginated procurements', async () => {
      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status and requestType', async () => {
      await service.findAll(
        { status: 'DRAFT', requestType: 'RFP' } as any,
        mockUser,
      );
      expect(prisma.procurement.findMany).toHaveBeenCalled();
    });

    it('should filter by search term', async () => {
      await service.findAll({ search: 'test' }, mockUser);
    });

    it('should filter by date range', async () => {
      await service.findAll(
        { dateFrom: '2026-01-01', dateTo: '2026-12-31' },
        mockUser,
      );
    });

    it('should filter by budget range', async () => {
      await service.findAll({ budgetMin: 1000, budgetMax: 500000 }, mockUser);
    });

    it('should filter by propertyId and category', async () => {
      await service.findAll({ propertyId: 'prop-1', category: 'IT' }, mockUser);
    });

    it('should filter by VENDOR role via invitations', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'vendor-user',
        propertyId: null,
      });
      await service.findAll({}, { id: 'vendor-user', role: 'VENDOR' });
    });
  });

  describe('findById', () => {
    it('should return procurement with relations', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      const result = await service.findById('proc-1', mockUser);
      expect(result).toHaveProperty('id', 'proc-1');
    });

    it('should throw NotFoundException', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(service.findById('invalid', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a DRAFT procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        title: 'Updated Title',
      });

      const result = await service.update(
        'proc-1',
        { title: 'Updated Title' },
        'user-1',
      );
      expect(result).toHaveProperty('title', 'Updated Title');
    });

    it('should reject updates to non-DRAFT procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'SUBMITTED',
      });

      await expect(
        service.update('proc-1', { title: 'Hack' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return NotFound for missing procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(
        service.update('invalid', { title: 'Test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('workflow transitions', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([]);
    });

    it('should submit from DRAFT to SUBMITTED', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'SUBMITTED',
        currentOwnerRole: 'REQUESTER',
      });

      const result = await service.submit('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'SUBMITTED');
    });

    it('should start review from SUBMITTED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'SUBMITTED',
        currentOwnerRole: 'REQUESTER',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'UNDER_PROCUREMENT_REVIEW',
        currentOwnerRole: 'PROCUREMENT',
      });

      const result = await service.startReview('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'UNDER_PROCUREMENT_REVIEW');
    });

    it('should approve review from UNDER_PROCUREMENT_REVIEW', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'UNDER_PROCUREMENT_REVIEW',
        currentOwnerRole: 'PROCUREMENT',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'APPROVED',
        currentOwnerRole: 'PROCUREMENT',
      });

      const result = await service.approveReview(
        'proc-1',
        'user-1',
        'Looks good',
      );
      expect(result).toHaveProperty('status', 'APPROVED');
    });

    it('should return for revision from UNDER_PROCUREMENT_REVIEW', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'UNDER_PROCUREMENT_REVIEW',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RETURNED_FOR_REVISION',
      });

      const result = await service.returnReview(
        'proc-1',
        'user-1',
        'Fix budget',
      );
      expect(result).toHaveProperty('status', 'RETURNED_FOR_REVISION');
    });

    it('should reject review from UNDER_PROCUREMENT_REVIEW', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'UNDER_PROCUREMENT_REVIEW',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'REJECTED',
        currentOwnerRole: 'PROCUREMENT',
      });

      const result = await service.rejectReview(
        'proc-1',
        'user-1',
        'Not suitable',
      );
      expect(result).toHaveProperty('status', 'REJECTED');
    });

    it('should publish from APPROVED to RFP_PUBLISHED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'APPROVED',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RFP_PUBLISHED',
        currentOwnerRole: 'VENDOR',
      });
      prisma.vendorInvitation.findMany.mockResolvedValue([]);

      const result = await service.publish(
        'proc-1',
        'user-1',
        '2026-08-01T00:00:00Z',
      );
      expect(result).toHaveProperty('status', 'RFP_PUBLISHED');
    });

    it('should publish RFI from APPROVED to RFI_PUBLISHED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'APPROVED',
        requestType: 'RFI',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RFI_PUBLISHED',
        requestType: 'RFI',
        currentOwnerRole: 'VENDOR',
      });
      prisma.vendorInvitation.findMany.mockResolvedValue([]);

      const result = await service.publish('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'RFI_PUBLISHED');
    });

    it('should publish RFQ from APPROVED to RFQ_OPEN', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'APPROVED',
        requestType: 'RFQ',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RFQ_OPEN',
        requestType: 'RFQ',
        currentOwnerRole: 'VENDOR',
      });
      prisma.vendorInvitation.findMany.mockResolvedValue([]);

      const result = await service.publish('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'RFQ_OPEN');
    });

    it('should throw if procurement not found on publish', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(service.publish('invalid', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should cancel from any status', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'CANCELLED',
      });

      const result = await service.cancel(
        'proc-1',
        'user-1',
        'No longer needed',
      );
      expect(result).toHaveProperty('status', 'CANCELLED');
    });

    it('should close RFI from RFI_COLLECTING', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'RFI_COLLECTING',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RFI_CLOSED',
      });

      const result = await service.closeRfi('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'RFI_CLOSED');
    });

    it('should draft RFP from RFI_CLOSED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'RFI_CLOSED',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RFP_DRAFTING',
      });

      const result = await service.draftRfp('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'RFP_DRAFTING');
    });

    it('should complete vendor response from RFQ_OPEN', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'RFQ_OPEN',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'VENDOR_RESPONSE_IN_PROGRESS',
      });

      const result = await service.completeVendorResponse('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'VENDOR_RESPONSE_IN_PROGRESS');
    });

    it('should start ebidding from VENDOR_RESPONSE_IN_PROGRESS', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'VENDOR_RESPONSE_IN_PROGRESS',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'EBIDDING_PREP',
      });

      const result = await service.startEbidding('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'EBIDDING_PREP');
    });

    it('should complete ebidding', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'EBIDDING_PREP',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'EVALUATION',
      });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.completeEbidding('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'EVALUATION');
    });

    it('should complete evaluation and route to approver', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'EVALUATION',
      });
      prisma.evaluatorReview.count.mockResolvedValue(3);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
      });

      const result = await service.completeEvaluation('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'PENDING_APPROVAL');
      expect(mockApprovalService.routeToApprover).toHaveBeenCalledWith(
        'proc-1',
      );
    });

    it('should reject invalid transition from completeEvaluation', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      await expect(
        service.completeEvaluation('proc-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve procurement from PENDING_APPROVAL to AWARD_APPROVED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_APPROVED',
        currentOwnerRole: 'APPROVER',
      });

      const result = await service.approveProcurement(
        'proc-1',
        'user-1',
        'Approved',
      );
      expect(result).toHaveProperty('status', 'AWARD_APPROVED');
    });

    it('should announce award from AWARD_APPROVED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_APPROVED',
      });
      prisma.procurementResult.upsert.mockResolvedValue({});
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_ANNOUNCED',
      });

      const result = await service.announceAward(
        'proc-1',
        'user-1',
        'vendor-1',
        'Winner!',
      );
      expect(result).toHaveProperty('status', 'AWARD_ANNOUNCED');
    });

    it('should throw on announceAward if not AWARD_APPROVED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'DRAFT',
      });
      await expect(
        service.announceAward('proc-1', 'user-1', 'vendor-1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send contract from AWARD_ANNOUNCED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_ANNOUNCED',
      });
      prisma.procurementResult.update.mockResolvedValue({} as any);

      const result = await service.sendContract('proc-1', 'user-1');
      expect(result).toHaveProperty('message', 'Contract sent');
    });

    it('should throw on sendContract if not AWARD_ANNOUNCED', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);

      await expect(service.sendContract('proc-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should complete from AWARD_ANNOUNCED to COMPLETED', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_ANNOUNCED',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'COMPLETED',
        currentOwnerRole: 'CLOSED',
      });

      const result = await service.completeProcurement('proc-1', 'user-1');
      expect(result).toHaveProperty('status', 'COMPLETED');
    });

    it('should reject invalid transitions', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);

      await expect(
        service.completeProcurement('proc-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should notify role-specific users on transition', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'procurement-user' }]);
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'SUBMITTED',
        currentOwnerRole: 'REQUESTER',
      });

      await service.submit('proc-1', 'user-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ['PROCUREMENT'] },
          }),
        }),
      );
      expect(mockNotificationsService.createForUsers).toHaveBeenCalled();
    });

    it('should notify requester separately when not in notifyRoles', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        requesterId: 'requester-id',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'SUBMITTED',
        currentOwnerRole: 'REQUESTER',
      });

      await service.submit('proc-1', 'other-user');

      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'requester-id',
        expect.objectContaining({ title: expect.stringContaining('RFP') }),
      );
    });

    it('should notify for APPROVED status to REQUESTER role', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'requester-2' }]);
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'UNDER_PROCUREMENT_REVIEW',
        requesterId: 'other',
      });
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'APPROVED',
      });

      await service.approveReview('proc-1', 'user-1', 'Looks good');

      expect(mockNotificationsService.createForUsers).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      const now = new Date();
      prisma.procurement.count.mockResolvedValue(10);
      prisma.procurement.groupBy
        .mockResolvedValueOnce([{ status: 'DRAFT', _count: 5 }])
        .mockResolvedValueOnce([{ requestType: 'RFP', _count: 8 }])
        .mockResolvedValueOnce([{ category: 'IT', _count: 3 }]);
      prisma.procurement.findMany.mockResolvedValue([
        { createdAt: now, status: 'DRAFT', budgetEstimate: 100000 },
      ]);
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getStats();
      expect(result).toHaveProperty('total', 10);
      expect(result).toHaveProperty('totalBudget', 100000);
      expect(result).toHaveProperty('avgBudget', 10000);
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('byType');
    });
  });

  describe('getCurrencies', () => {
    it('should return distinct currencies', async () => {
      prisma.procurement.groupBy.mockResolvedValue([
        { currency: 'USD', _count: 5 },
        { currency: 'THB', _count: 3 },
      ]);

      const result = await service.getCurrencies();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ currency: 'USD', count: 5 });
    });
  });

  describe('error cases', () => {
    it('should throw BadRequestException for missing procurement on cancel', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(service.cancel('invalid', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
