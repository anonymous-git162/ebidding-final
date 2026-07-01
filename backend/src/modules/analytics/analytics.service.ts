import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getVendorAnalytics(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true, companyName: true },
    });

    if (!vendor) return null;

    const [invitations, submissions, bidCount, evaluations] = await Promise.all([
      this.prisma.vendorInvitation.findMany({
        where: { vendorId: vendor.id },
        select: { id: true, invitationStatus: true, invitedAt: true, procurement: { select: { id: true, requestNo: true, title: true, status: true, budgetEstimate: true } } },
        orderBy: { invitedAt: 'desc' },
      }),
      this.prisma.rfqSubmission.findMany({
        where: { vendorId: vendor.id },
        select: { id: true, price: true, status: true, submittedAt: true, procurement: { select: { id: true, requestNo: true, title: true, status: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.ebiddingResponse.count({
        where: { vendorId: vendor.id },
      }),
      this.prisma.evaluatorReview.findMany({
        where: { vendorId: vendor.id },
        select: { id: true, score: true, comment: true, submittedAt: true, evaluator: { select: { fullName: true } }, procurement: { select: { id: true, requestNo: true, title: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const invitedCount = invitations.length;
    const acceptedCount = invitations.filter(i => i.invitationStatus === 'ACCEPTED').length;
    const declinedCount = invitations.filter(i => i.invitationStatus === 'DECLINED').length;
    const pendingCount = invitations.filter(i => i.invitationStatus === 'PENDING').length;

    const submissionCount = submissions.length;
    const totalBids = bidCount;
    const avgScore = evaluations.length > 0 ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length : 0;

    // Win rate based on evaluations with score >= 80
    const highScoreCount = evaluations.filter(e => e.score >= 80).length;
    const winRate = evaluations.length > 0 ? Math.round((highScoreCount / evaluations.length) * 100) : 0;

    const recentInvitations = invitations.slice(0, 5).map(i => ({
      id: i.id,
      status: i.invitationStatus,
      invitedAt: i.invitedAt,
      procurement: i.procurement,
    }));

    const recentSubmissions = submissions.slice(0, 5).map(s => ({
      id: s.id,
      price: s.price,
      status: s.status,
      submittedAt: s.submittedAt,
      procurement: s.procurement,
    }));

    const scoreHistory = evaluations.map(e => ({
      score: e.score,
      comment: e.comment,
      submittedAt: e.submittedAt,
      evaluator: e.evaluator.fullName,
      procurement: e.procurement,
    }));

    return {
      vendor: { id: vendor.id, companyName: vendor.companyName },
      summary: {
        invitedCount,
        acceptedCount,
        declinedCount,
        pendingCount,
        submissionCount,
        totalBids,
        avgScore: Math.round(avgScore * 100) / 100,
        winRate: Math.round(winRate),
      },
      recentInvitations,
      recentSubmissions,
      scoreHistory,
    };
  }

  async getVendorPerformance(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendor) return null;

    const reviews = await this.prisma.evaluatorReview.findMany({
      where: { vendorId: vendor.id },
      select: { score: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    });

    const monthlyScores: Record<string, { total: number; count: number }> = {};
    reviews.forEach(r => {
      const month = r.submittedAt.toISOString().slice(0, 7);
      if (!monthlyScores[month]) monthlyScores[month] = { total: 0, count: 0 };
      monthlyScores[month].total += r.score;
      monthlyScores[month].count++;
    });

    const scoreTimeline = Object.entries(monthlyScores).map(([month, data]) => ({
      month,
      avgScore: Math.round((data.total / data.count) * 100) / 100,
      reviewCount: data.count,
    }));

    const scoreDistribution = [
      { range: '90-100', count: reviews.filter(r => r.score >= 90).length },
      { range: '80-89', count: reviews.filter(r => r.score >= 80 && r.score < 90).length },
      { range: '70-79', count: reviews.filter(r => r.score >= 70 && r.score < 80).length },
      { range: '60-69', count: reviews.filter(r => r.score >= 60 && r.score < 70).length },
      { range: 'Below 60', count: reviews.filter(r => r.score < 60).length },
    ];

    return { scoreTimeline, scoreDistribution, totalReviews: reviews.length };
  }
}
