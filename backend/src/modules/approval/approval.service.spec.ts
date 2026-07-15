import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let prisma: MockPrisma;

  const mockProcurement = {
    id: 'proc-1',
    requestNo: 'RFP-20260701-0001',
    title: 'Test Procurement',
    status: 'EVALUATION',
    currentOwnerRole: 'PROCUREMENT',
    requesterId: 'requester-1',
    updatedAt: new Date(),
    requester: {
      id: 'requester-1',
      managerId: 'manager-1',
      departmentId: 'dept-1',
    },
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { createForUsers: jest.fn(), create: jest.fn() } },
      ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
  });

  describe('routeToApprover', () => {
    it('should route to requester manager', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        assignedApproverId: 'manager-1',
      });

      const result = await service.routeToApprover('proc-1');
      expect(result.assignedApproverId).toBe('manager-1');
    });

    it('should fallback to any active approver if no manager', async () => {
      const noManager = {
        ...mockProcurement,
        requester: {
          id: 'requester-1',
          managerId: null,
          departmentId: 'dept-1',
        },
      };
      prisma.procurement.findUnique.mockResolvedValue(noManager);
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'approver-1' });
      prisma.procurement.update.mockResolvedValue({
        ...noManager,
        assignedApproverId: 'approver-1',
      });

      const result = await service.routeToApprover('proc-1');
      expect(result.assignedApproverId).toBe('approver-1');
    });

    it('should fallback to department approver if no general approver', async () => {
      const noManager = {
        ...mockProcurement,
        requester: {
          id: 'requester-1',
          managerId: null,
          departmentId: 'dept-1',
        },
      };
      prisma.procurement.findUnique.mockResolvedValue(noManager);
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'dept-approver-1' });
      prisma.procurement.update.mockResolvedValue({
        ...noManager,
        assignedApproverId: 'dept-approver-1',
      });

      const result = await service.routeToApprover('proc-1');
      expect(result.assignedApproverId).toBe('dept-approver-1');
    });

    it('should throw NotFoundException for missing procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(service.routeToApprover('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitForApproval', () => {
    it('should submit evaluation to pending approval', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
      });
      prisma.procurementTimeline.create.mockResolvedValue({});
      prisma.procurementApprover.findMany.mockResolvedValue([]);

      const result = await service.submitForApproval('proc-1', 'user-1');
      expect(result).toHaveProperty('message', 'Sent for approval');
    });

    it('should throw if procurement status is not EVALUATION', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'DRAFT',
      });
      await expect(
        service.submitForApproval('proc-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue(null);
      await expect(
        service.submitForApproval('invalid', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInbox', () => {
    it('should return pending approvals for approver', async () => {
      prisma.procurement.findMany.mockResolvedValue([mockProcurement]);
      const result = await service.getInbox('approver-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('approve', () => {
    it('should approve a pending procurement when all approvers have approved', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
      });
      prisma.approval.create.mockResolvedValue({});
      prisma.approval.count.mockResolvedValue(1);
      prisma.procurementApprover.count.mockResolvedValue(1);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'AWARD_APPROVED',
        currentOwnerRole: 'PROCUREMENT',
      });
      prisma.procurementTimeline.create.mockResolvedValue({});

      const result = await service.approve(
        'proc-1',
        'approver-1',
        'Looks good',
      );
      expect(result).toHaveProperty('status', 'AWARD_APPROVED');
    });

    it('should stay in PENDING_APPROVAL when not all approvers have approved', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
      });
      prisma.approval.create.mockResolvedValue({});
      prisma.approval.count.mockResolvedValue(1);
      prisma.procurementApprover.count.mockResolvedValue(2);
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
      });
      prisma.procurementTimeline.create.mockResolvedValue({});

      const result = await service.approve(
        'proc-1',
        'approver-1',
        'Looks good',
      );
      expect(result).toHaveProperty('status', 'PENDING_APPROVAL');
      expect(prisma.procurementTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'PARTIAL_APPROVAL' }),
        }),
      );
    });

    it('should throw if not pending approval', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'DRAFT',
      });
      await expect(service.approve('proc-1', 'approver-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('return', () => {
    it('should return a pending procurement for revision', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.approval.create.mockResolvedValue({});
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'RETURNED_FROM_APPROVAL',
        currentOwnerRole: 'PROCUREMENT',
      });
      prisma.procurementTimeline.create.mockResolvedValue({});

      const result = await service.return('proc-1', 'approver-1', 'Fix budget');
      expect(result).toHaveProperty('status', 'RETURNED_FROM_APPROVAL');
    });
  });

  describe('reject', () => {
    it('should reject a procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue(mockProcurement);
      prisma.approval.create.mockResolvedValue({});
      prisma.procurement.update.mockResolvedValue({
        ...mockProcurement,
        status: 'REJECTED',
        currentOwnerRole: 'CLOSED',
        finalDecisionReason: 'Not suitable',
      });
      prisma.procurementTimeline.create.mockResolvedValue({});

      const result = await service.reject(
        'proc-1',
        'approver-1',
        'Not suitable',
      );
      expect(result).toHaveProperty('status', 'REJECTED');
    });
  });

  describe('getOverdueApprovals', () => {
    it('should return overdue approvals', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      prisma.procurement.findMany.mockResolvedValue([
        {
          ...mockProcurement,
          updatedAt: oldDate,
          requester: { id: 'r-1', fullName: 'Requester' },
        },
      ]);
      const result = await service.getOverdueApprovals();
      expect(result).toHaveLength(1);
      expect(result[0].hoursPending).toBeGreaterThan(24);
    });

    it('should return empty for none overdue', async () => {
      const recent = new Date();
      prisma.procurement.findMany.mockResolvedValue([
        {
          ...mockProcurement,
          updatedAt: recent,
          requester: { id: 'r-1', fullName: 'Requester' },
        },
      ]);
      const result = await service.getOverdueApprovals();
      expect(result).toHaveLength(0);
    });
  });

  describe('escalateApproval', () => {
    it('should escalate overdue approval', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'PENDING_APPROVAL',
        updatedAt: oldDate,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      prisma.notification.create.mockResolvedValue({});
      prisma.procurementTimeline.create.mockResolvedValue({});

      const result = await service.escalateApproval('proc-1');
      expect(result).toHaveProperty('hoursPending');
      expect(result.hoursPending).toBeGreaterThan(24);
    });

    it('should throw if not pending approval', async () => {
      prisma.procurement.findUnique.mockResolvedValue({
        ...mockProcurement,
        status: 'DRAFT',
      });
      await expect(service.escalateApproval('proc-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
