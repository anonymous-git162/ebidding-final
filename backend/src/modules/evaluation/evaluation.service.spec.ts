import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let prisma: MockPrisma;

  const mockAssignment = {
    id: 'assign-1',
    procurementId: 'proc-1',
    evaluatorId: 'eval-1',
    isLead: true,
    assignedAt: new Date(),
  };

  const mockReview = {
    id: 'review-1',
    evaluatorId: 'eval-1',
    procurementId: 'proc-1',
    vendorId: 'vendor-1',
    score: 85,
    comment: 'Good proposal',
    submittedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
  });

  describe('assignEvaluators', () => {
    it('should assign evaluators and update procurement status', async () => {
      prisma.evaluatorAssignment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.evaluatorAssignment.create.mockResolvedValue(mockAssignment);
      prisma.procurement.update.mockResolvedValue({ id: 'proc-1', status: 'EVALUATION', currentOwnerRole: 'EVALUATOR' });

      const result = await service.assignEvaluators('proc-1', ['eval-1', 'eval-2'], 'eval-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getMyAssignments', () => {
    it('should return assignments for evaluator', async () => {
      prisma.evaluatorAssignment.findMany.mockResolvedValue([mockAssignment]);
      const result = await service.getMyAssignments('eval-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('submitReview', () => {
    it('should create a new review', async () => {
      prisma.evaluatorAssignment.findFirst.mockResolvedValue(mockAssignment);
      prisma.evaluatorReview.findFirst.mockResolvedValue(null);
      prisma.evaluatorReview.create.mockResolvedValue(mockReview);

      const result = await service.submitReview('eval-1', 'proc-1', 'vendor-1', 85, 'Good proposal');
      expect(result.score).toBe(85);
    });

    it('should update existing review', async () => {
      prisma.evaluatorAssignment.findFirst.mockResolvedValue(mockAssignment);
      prisma.evaluatorReview.findFirst.mockResolvedValue(mockReview);
      prisma.evaluatorReview.update.mockResolvedValue({ ...mockReview, score: 90 });

      const result = await service.submitReview('eval-1', 'proc-1', 'vendor-1', 90, 'Updated');
      expect(result.score).toBe(90);
    });

    it('should throw if evaluator not assigned', async () => {
      prisma.evaluatorAssignment.findFirst.mockResolvedValue(null);
      await expect(service.submitReview('eval-1', 'proc-1', 'vendor-1', 85)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReviews', () => {
    it('should return reviews for procurement', async () => {
      prisma.evaluatorReview.findMany.mockResolvedValue([mockReview]);
      const result = await service.getReviews('proc-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateScores', () => {
    it('should calculate average scores per vendor', async () => {
      prisma.evaluatorReview.findMany.mockResolvedValue([
        { ...mockReview, vendorId: 'vendor-1', score: 80 },
        { ...mockReview, vendorId: 'vendor-1', score: 90 },
        { ...mockReview, vendorId: 'vendor-2', score: 75 },
      ]);

      const result = await service.calculateScores('proc-1');
      expect(result['vendor-1'].avgScore).toBe(85);
      expect(result['vendor-1'].voteCount).toBe(2);
      expect(result['vendor-2'].avgScore).toBe(75);
    });

    it('should return empty object for no reviews', async () => {
      prisma.evaluatorReview.findMany.mockResolvedValue([]);
      const result = await service.calculateScores('proc-1');
      expect(result).toEqual({});
    });
  });

  describe('consolidate', () => {
    it('should upsert consolidation', async () => {
      prisma.evaluatorReview.findMany.mockResolvedValue([
        { ...mockReview, vendorId: 'vendor-1', score: 85 },
      ]);
      prisma.evaluationConsolidation.upsert.mockResolvedValue({
        procurementId: 'proc-1',
        avgScore: 85,
        voteSummary: { 'vendor-1': { avgScore: 85, voteCount: 1, variance: 0 } },
        recommendation: 'Proceed with vendor-1',
        leadCommentary: 'Strong proposal',
        leadEvaluatorId: 'eval-1',
      });

      const result = await service.consolidate('proc-1', 'eval-1', 'Proceed with vendor-1', 'Strong proposal');
      expect(result.avgScore).toBe(85);
      expect(result.recommendation).toBe('Proceed with vendor-1');
    });
  });

  describe('getConsolidation', () => {
    it('should return consolidation', async () => {
      prisma.evaluationConsolidation.findUnique.mockResolvedValue({
        procurementId: 'proc-1',
        avgScore: 85,
        voteSummary: {},
        recommendation: 'Proceed',
        leadCommentary: 'Good',
        leadEvaluatorId: 'eval-1',
      });

      const result = await service.getConsolidation('proc-1');
      expect(result).toHaveProperty('avgScore', 85);
    });

    it('should return null if no consolidation', async () => {
      prisma.evaluationConsolidation.findUnique.mockResolvedValue(null);
      const result = await service.getConsolidation('proc-1');
      expect(result).toBeNull();
    });
  });
});
