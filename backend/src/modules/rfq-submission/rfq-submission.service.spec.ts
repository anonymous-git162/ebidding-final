import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RfqSubmissionService } from './rfq-submission.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('RfqSubmissionService', () => {
  let service: RfqSubmissionService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfqSubmissionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RfqSubmissionService>(RfqSubmissionService);
  });

  describe('create', () => {
    it('should create a draft RFQ submission', async () => {
      prisma.procurement.findUnique.mockResolvedValue({ id: 'p-1' } as any);
      const mockVendor = { id: 'v-1', userId: 'u-1' };
      prisma.vendor.findUnique.mockResolvedValue(mockVendor as any);
      prisma.rfqSubmission.create.mockResolvedValue({
        id: 'sub-1',
        procurementId: 'p-1',
        price: 50000,
        status: 'DRAFT',
      } as any);

      const result = await service.create('p-1', 'u-1', 50000, 'Proposal text');
      expect(result).toHaveProperty('id', 'sub-1');
      expect(prisma.rfqSubmission.create).toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('should submit a draft submission', async () => {
      prisma.rfqSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        vendor: { userId: 'u-1' },
        status: 'DRAFT',
      } as any);
      prisma.rfqSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: 'SUBMITTED',
      } as any);

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
    it('should return submissions for a procurement', async () => {
      const submissions = [{ id: 'sub-1', price: 50000 }];
      prisma.rfqSubmission.findMany.mockResolvedValue(submissions as any);

      const result = await service.findByProcurement('p-1');
      expect(result).toHaveLength(1);
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
