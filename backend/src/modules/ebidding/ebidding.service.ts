import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EbiddingService {
  private readonly logger = new Logger(EbiddingService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async checkMinVendors(procurementId: string) {
    const acceptedCount = await this.prisma.vendorInvitation.count({
      where: { procurementId, invitationStatus: 'ACCEPTED' },
    });
    console.log(
      `[E-Bidding] Vendor count check: procurement=${procurementId}, accepted=${acceptedCount}, minimum=2`,
    );
    if (acceptedCount < 2) {
      console.log(
        `[E-Bidding] BLOCKED: Only ${acceptedCount} vendor(s) accepted, need at least 2`,
      );
      throw new BadRequestException(
        `At least 2 vendors must accept invitations before starting e-bidding. Currently ${acceptedCount} vendor(s) accepted.`,
      );
    }
  }

  async createRound(procurementId: string, createdBy: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      select: { status: true },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (['EVALUATION','PENDING_APPROVAL','RETURNED_FROM_APPROVAL','AWARD_APPROVED','AWARD_ANNOUNCED','COMPLETED','REJECTED','CANCELLED'].includes(procurement.status)) {
      throw new BadRequestException('Cannot create rounds after evaluation has started');
    }

    await this.checkMinVendors(procurementId);

    const lastRound = await this.prisma.ebiddingRound.findFirst({
      where: { procurementId },
      orderBy: { roundNo: 'desc' },
    });

    // Close all OPEN rounds when creating a new round
    await this.prisma.ebiddingRound.updateMany({
      where: { procurementId, status: 'OPEN' },
      data: { status: 'CLOSED', endsAt: new Date() },
    });

    return this.prisma.ebiddingRound.create({
      data: {
        procurementId,
        roundNo: (lastRound?.roundNo || 0) + 1,
        createdBy,
        status: 'PENDING',
      },
    });
  }

  async openRound(id: string, _userId: string) {
    const round = await this.prisma.ebiddingRound.findUnique({ where: { id } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status !== 'PENDING')
      throw new BadRequestException('Round is not pending');

    await this.checkMinVendors(round.procurementId);

    // Close all other OPEN rounds for this procurement
    await this.prisma.ebiddingRound.updateMany({
      where: {
        procurementId: round.procurementId,
        status: 'OPEN',
        id: { not: id },
      },
      data: { status: 'CLOSED', endsAt: new Date() },
    });

    const updated = await this.prisma.ebiddingRound.update({
      where: { id },
      data: { status: 'OPEN', startsAt: new Date() },
    });

    await this.prisma.procurement.update({
      where: { id: round.procurementId },
      data: { status: 'EBIDDING_OPEN' },
    });

    await this.notifyVendorsRoundOpen(round, updated);
    return updated;
  }

  private async notifyVendorsRoundOpen(
    round: { procurementId: string; roundNo: number },
    _updated: { id: string },
  ) {
    try {
      const [procurement, vendors] = await Promise.all([
        this.prisma.procurement.findUnique({
          where: { id: round.procurementId },
          select: { title: true },
        }),
        this.prisma.vendorInvitation.findMany({
          where: {
            procurementId: round.procurementId,
            invitationStatus: 'ACCEPTED',
          },
          include: { vendor: { select: { userId: true } } },
        }),
      ]);

      const userIds = vendors.map((v) => v.vendor.userId);
      if (!userIds.length) return;

      await this.notificationsService.createForUsers(userIds, {
        title: 'New Bidding Round Open',
        message: `Round ${round.roundNo} is now open for "${procurement?.title || round.procurementId}". Place your bid now.`,
        type: 'info',
        entityType: 'ebidding_round',
        entityId: _updated.id,
        link: '/bidding',
      });

      this.logger.log(
        `Notified ${userIds.length} vendor(s) about round ${round.roundNo} opening`,
      );
    } catch (error) {
      this.logger.error(`Failed to send round-open notification: ${error}`);
    }
  }

  async closeRound(id: string, _userId: string) {
    const round = await this.prisma.ebiddingRound.findUnique({ where: { id } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status !== 'OPEN')
      throw new BadRequestException('Round is not open');

    return this.prisma.ebiddingRound.update({
      where: { id },
      data: { status: 'CLOSED', endsAt: new Date() },
    });
  }

  async placeBid(roundId: string, vendorUserId: string, bidAmount: number) {
    const round = await this.prisma.ebiddingRound.findUnique({
      where: { id: roundId },
    });
    if (!round) throw new NotFoundException('Round not found');
    if (round.status !== 'OPEN')
      throw new BadRequestException('Round is not open');

    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Prevent vendor from bidding on their own procurement
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: round.procurementId },
    });
    if (procurement && procurement.requesterId === vendorUserId) {
      throw new BadRequestException('Cannot bid on your own procurement');
    }

    // Reject bids after submission deadline
    if (
      procurement?.submissionDeadline &&
      new Date() > new Date(procurement.submissionDeadline)
    ) {
      throw new BadRequestException('Submission deadline has passed');
    }

    const invitation = await this.prisma.vendorInvitation.findFirst({
      where: {
        procurementId: round.procurementId,
        vendorId: vendor.id,
        invitationStatus: 'ACCEPTED',
      },
    });
    if (!invitation)
      throw new BadRequestException('Not invited or invitation not accepted');

    const existingBid = await this.prisma.ebiddingResponse.findFirst({
      where: { ebiddingRoundId: roundId, vendorId: vendor.id },
    });

    if (existingBid) {
      return this.prisma.ebiddingResponse.update({
        where: { id: existingBid.id },
        data: { bidAmount, submittedAt: new Date() },
      });
    }

    return this.prisma.ebiddingResponse.create({
      data: { ebiddingRoundId: roundId, vendorId: vendor.id, bidAmount },
    });
  }

  async getRounds(procurementId: string, user?: { id: string; role: string }) {
    const canSeeBids = user?.role === 'PROCUREMENT' || user?.role === 'ADMIN';
    const rounds = await this.prisma.ebiddingRound.findMany({
      where: { procurementId },
      include: {
        responses: canSeeBids
          ? { select: { vendorId: true, bidAmount: true } }
          : { select: { vendorId: true } },
      },
      orderBy: { roundNo: 'desc' },
    });

    if (!canSeeBids) {
      return rounds.map((r) => ({
        ...r,
        responses: r.responses.map((resp) => ({
          ...resp,
          bidAmount: undefined,
        })),
      }));
    }

    return rounds;
  }

  async getAcceptedVendorCount(procurementId: string) {
    const count = await this.prisma.vendorInvitation.count({
      where: { procurementId, invitationStatus: 'ACCEPTED' },
    });
    console.log(
      `[E-Bidding] Vendor count check: procurement=${procurementId}, accepted=${count}, minimum=2, hasEnough=${count >= 2}`,
    );
    return { count, minimum: 2, hasEnough: count >= 2 };
  }

  async getRoundBids(roundId: string) {
    return this.prisma.ebiddingResponse.findMany({
      where: { ebiddingRoundId: roundId },
      include: { vendor: { select: { id: true, companyName: true } } },
      orderBy: { bidAmount: 'asc' },
    });
  }

  async getMyBids(roundId: string, vendorUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.ebiddingResponse.findMany({
      where: { ebiddingRoundId: roundId, vendorId: vendor.id },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getAllMyBids(vendorUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.ebiddingResponse.findMany({
      where: { vendorId: vendor.id },
      orderBy: { submittedAt: 'desc' },
      include: {
        round: {
          select: {
            id: true,
            roundNo: true,
            status: true,
            procurement: {
              select: { id: true, requestNo: true, title: true, status: true },
            },
          },
        },
      },
    });
  }

  async deleteBid(bidId: string, vendorUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const bid = await this.prisma.ebiddingResponse.findUnique({
      where: { id: bidId },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.vendorId !== vendor.id)
      throw new BadRequestException('Not your bid');

    const round = await this.prisma.ebiddingRound.findUnique({
      where: { id: bid.ebiddingRoundId },
    });
    if (round?.status !== 'OPEN')
      throw new BadRequestException('Round is not open');

    return this.prisma.ebiddingResponse.delete({ where: { id: bidId } });
  }
}
