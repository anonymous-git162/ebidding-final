import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EbiddingService } from './ebidding.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('EbiddingService', () => {
  let service: EbiddingService;
  let prisma: MockPrisma;

  const mockRound = {
    id: 'round-1',
    procurementId: 'proc-1',
    roundNo: 1,
    status: 'PENDING',
    startsAt: null,
    endsAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
  };

  const mockVendor = {
    id: 'vendor-1',
    userId: 'vendor-user-1',
    companyName: 'Test Vendor',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.vendorInvitation.count.mockResolvedValue(3);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EbiddingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EbiddingService>(EbiddingService);
  });

  describe('createRound', () => {
    it('should create a new round when enough vendors have accepted', async () => {
      prisma.ebiddingRound.findFirst.mockResolvedValue(null);
      prisma.ebiddingRound.updateMany.mockResolvedValue({ count: 0 });
      prisma.ebiddingRound.create.mockResolvedValue(mockRound);

      const result = await service.createRound('proc-1', 'user-1');
      expect(result).toEqual(mockRound);
      expect(prisma.ebiddingRound.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ procurementId: 'proc-1', roundNo: 1, status: 'PENDING' }),
        }),
      );
    });

    it('should reject creation when fewer than 2 vendors accepted', async () => {
      prisma.vendorInvitation.count.mockResolvedValue(1);

      await expect(service.createRound('proc-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should increment round number for subsequent rounds', async () => {
      prisma.ebiddingRound.findFirst.mockResolvedValue({ ...mockRound, roundNo: 2 });
      prisma.ebiddingRound.updateMany.mockResolvedValue({ count: 0 });
      prisma.ebiddingRound.create.mockResolvedValue({ ...mockRound, roundNo: 3 });

      await service.createRound('proc-1', 'user-1');

      expect(prisma.ebiddingRound.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roundNo: 3 }),
        }),
      );
    });
  });

  describe('openRound', () => {
    it('should open a pending round', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue(mockRound);
      prisma.ebiddingRound.updateMany.mockResolvedValue({ count: 0 });
      prisma.ebiddingRound.update.mockResolvedValue({ ...mockRound, status: 'OPEN', startsAt: new Date() });

      const result = await service.openRound('round-1', 'user-1');
      expect(result).toHaveProperty('status', 'OPEN');
    });

    it('should reject opening a non-pending round', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'CLOSED' });

      await expect(service.openRound('round-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject opening if fewer than 2 vendors accepted', async () => {
      prisma.vendorInvitation.count.mockResolvedValue(1);
      prisma.ebiddingRound.findUnique.mockResolvedValue(mockRound);

      await expect(service.openRound('round-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeRound', () => {
    it('should close an open round', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'OPEN' });
      prisma.ebiddingRound.update.mockResolvedValue({ ...mockRound, status: 'CLOSED', endsAt: new Date() });

      const result = await service.closeRound('round-1', 'user-1');
      expect(result).toHaveProperty('status', 'CLOSED');
    });

    it('should reject closing a non-open round', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue(mockRound);

      await expect(service.closeRound('round-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('placeBid', () => {
    beforeEach(() => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'OPEN' });
      prisma.procurement.findUnique.mockResolvedValue({ id: 'proc-1', requesterId: 'requester-1', submissionDeadline: null });
      prisma.vendorInvitation.findFirst.mockResolvedValue({ id: 'inv-1', invitationStatus: 'ACCEPTED' });
    });

    it('should place a new bid', async () => {
      prisma.ebiddingResponse.findFirst.mockResolvedValue(null);
      prisma.ebiddingResponse.create.mockResolvedValue({ id: 'bid-1', ebiddingRoundId: 'round-1', vendorId: 'vendor-1', bidAmount: 1000 });

      const result = await service.placeBid('round-1', 'vendor-user-1', 1000);
      expect(result).toHaveProperty('id', 'bid-1');
      expect(prisma.ebiddingResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bidAmount: 1000 }),
        }),
      );
    });

    it('should update existing bid', async () => {
      prisma.ebiddingResponse.findFirst.mockResolvedValue({ id: 'bid-1', vendorId: 'vendor-1', bidAmount: 800 });
      prisma.ebiddingResponse.update.mockResolvedValue({ id: 'bid-1', bidAmount: 900 });

      const result = await service.placeBid('round-1', 'vendor-user-1', 900);
      expect(result).toHaveProperty('bidAmount', 900);
    });

    it('should reject bids on non-open rounds', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'CLOSED' });

      await expect(service.placeBid('round-1', 'vendor-user-1', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should reject bids from vendors without accepted invitation', async () => {
      prisma.vendorInvitation.findFirst.mockResolvedValue(null);

      await expect(service.placeBid('round-1', 'vendor-user-1', 1000)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRounds', () => {
    it('should return rounds with bid data for procurement role', async () => {
      prisma.ebiddingRound.findMany.mockResolvedValue([mockRound]);

      const result = await service.getRounds('proc-1', { id: 'proc-user', role: 'PROCUREMENT' });
      expect(result).toHaveLength(1);
    });

    it('should return rounds without bid amounts for vendor role', async () => {
      prisma.ebiddingRound.findMany.mockResolvedValue([{
        ...mockRound,
        responses: [{ vendorId: 'v-1', bidAmount: 100 }],
      }]);

      const result = await service.getRounds('proc-1', { id: 'vendor-user', role: 'VENDOR' }) as any[];
      expect(result[0].responses[0].bidAmount).toBeUndefined();
    });
  });

  describe('placeBid extra cases', () => {
    beforeEach(() => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'OPEN' });
      prisma.vendorInvitation.findFirst.mockResolvedValue({ id: 'inv-1', invitationStatus: 'ACCEPTED' });
    });

    it('should reject bid on own procurement', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'proc-1', requesterId: 'vendor-user-1', submissionDeadline: null });
      await expect(service.placeBid('round-1', 'vendor-user-1', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should reject bid after submission deadline', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'proc-1', requesterId: 'requester-1', submissionDeadline: new Date(Date.now() - 86400000) });
      await expect(service.placeBid('round-1', 'vendor-user-1', 1000)).rejects.toThrow(BadRequestException);
    });

    it('should reject bid from non-existent vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.placeBid('round-1', 'unknown-user', 1000)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAcceptedVendorCount', () => {
    it('should return vendor count with hasEnough flag', async () => {
      prisma.vendorInvitation.count.mockResolvedValue(5);
      const result = await service.getAcceptedVendorCount('proc-1');
      expect(result).toEqual({ count: 5, minimum: 2, hasEnough: true });
    });

    it('should return hasEnough false when below minimum', async () => {
      prisma.vendorInvitation.count.mockResolvedValue(1);
      const result = await service.getAcceptedVendorCount('proc-1');
      expect(result.hasEnough).toBe(false);
    });
  });

  describe('getMyBids', () => {
    it('should return bids for vendor in round', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.ebiddingResponse.findMany.mockResolvedValue([{ id: 'b1', bidAmount: 500, vendorId: 'vendor-1', ebiddingRoundId: 'round-1' }]);

      const result = await service.getMyBids('round-1', 'vendor-user-1');
      expect(result).toHaveLength(1);
    });

    it('should throw for non-existent vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.getMyBids('round-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllMyBids', () => {
    it('should return all bids for vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.ebiddingResponse.findMany.mockResolvedValue([{ id: 'b1', bidAmount: 500, vendorId: 'vendor-1', round: { id: 'round-1', roundNo: 1, status: 'OPEN', procurement: { id: 'proc-1', requestNo: 'RFP-001', title: 'Test', status: 'EVALUATION' } } }]);

      const result = await service.getAllMyBids('vendor-user-1');
      expect(result).toHaveLength(1);
    });

    it('should throw for non-existent vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.getAllMyBids('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBid', () => {
    beforeEach(() => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.ebiddingResponse.findUnique.mockResolvedValue({ id: 'bid-1', vendorId: 'vendor-1', ebiddingRoundId: 'round-1' });
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'OPEN' });
    });

    it('should delete bid in open round', async () => {
      prisma.ebiddingResponse.delete.mockResolvedValue({ id: 'bid-1' });
      const result = await service.deleteBid('bid-1', 'vendor-user-1');
      expect(result).toHaveProperty('id', 'bid-1');
    });

    it('should throw for non-existent vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.deleteBid('bid-1', 'unknown')).rejects.toThrow(NotFoundException);
    });

    it('should throw for non-existent bid', async () => {
      prisma.ebiddingResponse.findUnique.mockResolvedValue(null);
      await expect(service.deleteBid('invalid', 'vendor-user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when bid belongs to another vendor', async () => {
      prisma.ebiddingResponse.findUnique.mockResolvedValue({ id: 'bid-1', vendorId: 'other-vendor', ebiddingRoundId: 'round-1' });
      await expect(service.deleteBid('bid-1', 'vendor-user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when round is not open', async () => {
      prisma.ebiddingRound.findUnique.mockResolvedValue({ ...mockRound, status: 'CLOSED' });
      await expect(service.deleteBid('bid-1', 'vendor-user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
