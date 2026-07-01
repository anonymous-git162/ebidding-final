import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EvaluationService {
  constructor(private prisma: PrismaService) {}

  async assignEvaluators(procurementId: string, evaluatorIds: string[], leadEvaluatorId: string) {
    await this.prisma.evaluatorAssignment.deleteMany({ where: { procurementId } });

    const assignments = await Promise.all(
      evaluatorIds.map((evaluatorId) =>
        this.prisma.evaluatorAssignment.create({
          data: {
            procurementId,
            evaluatorId,
            isLead: evaluatorId === leadEvaluatorId,
          },
        }),
      ),
    );

    await this.prisma.procurement.update({
      where: { id: procurementId },
      data: { currentOwnerRole: 'EVALUATOR', status: 'EVALUATION' },
    });

    return assignments;
  }

  async getMyAssignments(evaluatorUserId: string) {
    return this.prisma.evaluatorAssignment.findMany({
      where: { evaluatorId: evaluatorUserId },
      include: {
        procurement: {
          select: { id: true, requestNo: true, title: true, status: true, category: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async submitReview(evaluatorId: string, procurementId: string, vendorId: string, score: number, comment?: string) {
    const assignment = await this.prisma.evaluatorAssignment.findFirst({
      where: { procurementId, evaluatorId },
    });
    if (!assignment) throw new BadRequestException('Evaluator not assigned to this procurement');

    const existing = await this.prisma.evaluatorReview.findFirst({
      where: { evaluatorId, procurementId, vendorId },
    });

    if (existing) {
      return this.prisma.evaluatorReview.update({
        where: { id: existing.id },
        data: { score, comment, submittedAt: new Date() },
      });
    }

    return this.prisma.evaluatorReview.create({
      data: { evaluatorId, procurementId, vendorId, score, comment },
    });
  }

  async getReviews(procurementId: string) {
    return this.prisma.evaluatorReview.findMany({
      where: { procurementId },
      include: {
        evaluator: { select: { id: true, fullName: true } },
        vendor: { select: { id: true, companyName: true } },
      },
    });
  }

  async calculateScores(procurementId: string) {
    const reviews = await this.prisma.evaluatorReview.findMany({
      where: { procurementId },
    });

    const vendorScores: Record<string, number[]> = {};
    for (const review of reviews) {
      if (!vendorScores[review.vendorId]) vendorScores[review.vendorId] = [];
      vendorScores[review.vendorId].push(review.score);
    }

    const result: Record<string, { avgScore: number; voteCount: number; variance: number }> = {};
    for (const [vendorId, scores] of Object.entries(vendorScores)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
      result[vendorId] = { avgScore: avg, voteCount: scores.length, variance };
    }

    return result;
  }

  async consolidate(procurementId: string, leadEvaluatorId: string, recommendation: string, leadCommentary: string) {
    const scores = await this.calculateScores(procurementId);
    const avgScore = Object.values(scores).reduce((sum, s) => sum + s.avgScore, 0) / Object.values(scores).length || 0;

    return this.prisma.evaluationConsolidation.upsert({
      where: { procurementId },
      create: {
        procurementId,
        avgScore,
        voteSummary: scores,
        recommendation,
        leadCommentary,
        leadEvaluatorId,
      },
      update: {
        avgScore,
        voteSummary: scores,
        recommendation,
        leadCommentary,
        leadEvaluatorId,
      },
    });
  }

  async getConsolidation(procurementId: string) {
    return this.prisma.evaluationConsolidation.findUnique({
      where: { procurementId },
    });
  }
}
