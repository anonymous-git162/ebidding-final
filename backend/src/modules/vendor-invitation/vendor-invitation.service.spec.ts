import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VendorInvitationService } from './vendor-invitation.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('VendorInvitationService', () => {
  let service: VendorInvitationService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorInvitationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn(), createForUsers: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<VendorInvitationService>(VendorInvitationService);
  });

  describe('invite', () => {
    it('should invite multiple vendors to a procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'p-1' } as any);
      prisma.vendorInvitation.create
        .mockResolvedValueOnce({ id: 'inv-1', vendorId: 'v-1' } as any)
        .mockResolvedValueOnce({ id: 'inv-2', vendorId: 'v-2' } as any);
      prisma.procurementTimeline.create.mockResolvedValue({} as any);
      prisma.vendor.findMany.mockResolvedValue([
        { userId: 'vendor-u-1' },
        { userId: 'vendor-u-2' },
      ] as any);

      const result = await service.invite('p-1', ['v-1', 'v-2'], 'u-1');
      expect(result).toHaveLength(2);
    });

    it('should handle single vendor invitation', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'p-1' } as any);
      prisma.vendorInvitation.create.mockResolvedValue({
        id: 'inv-1',
        vendorId: 'v-1',
      } as any);
      prisma.procurementTimeline.create.mockResolvedValue({} as any);
      prisma.vendor.findMany.mockResolvedValue([{ userId: 'vendor-u-1' }] as any);

      const result = await service.invite('p-1', ['v-1'], 'u-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should return all invitations', async () => {
      const invitations = [
        {
          id: 'inv-1',
          procurement: { title: 'Test' },
          vendor: { companyName: 'Acme' },
        },
      ];
      prisma.vendorInvitation.findMany.mockResolvedValue(invitations as any);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findByProcurement', () => {
    it('should return invitations for a procurement', async () => {
      prisma.vendorInvitation.findMany.mockResolvedValue([
        { id: 'inv-1' },
      ] as any);

      const result = await service.findByProcurement('p-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findMyInvitations', () => {
    it('should return invitations for current vendor user', async () => {
      prisma.vendorInvitation.findMany.mockResolvedValue([
        { id: 'inv-1', invitationStatus: 'PENDING' },
      ] as any);

      const result = await service.findMyInvitations('u-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('accept', () => {
    it('should accept an invitation', async () => {
      const invitation = {
        id: 'inv-1',
        invitationStatus: 'PENDING',
        vendorId: 'v-1',
      };
      prisma.vendorInvitation.findUnique.mockResolvedValue(invitation as any);
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
      } as any);
      prisma.vendorInvitation.update.mockResolvedValue({
        ...invitation,
        invitationStatus: 'ACCEPTED',
      } as any);

      const result = (await service.accept('inv-1', 'u-1')) as any;
      expect(result.invitationStatus).toBe('ACCEPTED');
    });

    it('should throw NotFoundException for missing invitation', async () => {
      prisma.vendorInvitation.findUnique.mockResolvedValue(null);

      await expect(service.accept('bad-id', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if invitation belongs to another vendor', async () => {
      prisma.vendorInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        invitationStatus: 'PENDING',
        vendorId: 'v-other',
      } as any);
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
      } as any);

      await expect(service.accept('inv-1', 'u-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('decline', () => {
    it('should decline an invitation', async () => {
      const invitation = {
        id: 'inv-1',
        invitationStatus: 'PENDING',
        vendorId: 'v-1',
      };
      prisma.vendorInvitation.findUnique.mockResolvedValue(invitation as any);
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
      } as any);
      prisma.vendorInvitation.update.mockResolvedValue({
        ...invitation,
        invitationStatus: 'DECLINED',
      } as any);

      const result = (await service.decline('inv-1', 'u-1')) as any;
      expect(result.invitationStatus).toBe('DECLINED');
    });

    it('should throw NotFoundException for missing invitation', async () => {
      prisma.vendorInvitation.findUnique.mockResolvedValue(null);

      await expect(service.decline('bad-id', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
