import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RfqSubmissionService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  async create(
    procurementId: string,
    vendorId: string,
    price: number,
    proposalText?: string,
    fileIds?: string[],
  ) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      select: { id: true, status: true },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (!['RFQ_OPEN', 'VENDOR_RESPONSE_IN_PROGRESS'].includes(procurement.status)) {
      throw new BadRequestException('Submissions are not open for this procurement');
    }

    // vendorId is Vendor.id (profile); AuditLog.actorId must be User.id
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, userId: true },
    });
    if (!vendor) {
      throw new BadRequestException('Vendor profile not found');
    }

    const invitation = await this.prisma.vendorInvitation.findFirst({
      where: { procurementId, vendorId, invitationStatus: 'ACCEPTED' },
    });
    if (!invitation) {
      throw new BadRequestException(
        'You must accept the invitation before submitting a proposal.',
      );
    }

    const existing = await this.prisma.rfqSubmission.findFirst({
      where: { procurementId, vendorId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      if (existing.status === 'SUBMITTED') {
        throw new BadRequestException('You have already submitted a proposal for this procurement');
      }
      if (fileIds && fileIds.length > 0) {
        await this.prisma.file.updateMany({
          where: { submissionId: existing.id },
          data: { submissionId: null },
        });
        await this.prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { submissionId: existing.id },
        });
      }
      const updated = await this.prisma.rfqSubmission.update({
        where: { id: existing.id },
        data: { price, proposalText },
      });
      return this.prisma.rfqSubmission.findUnique({
        where: { id: existing.id },
        include: { files: true },
      });
    }

    const submission = await this.prisma.rfqSubmission.create({
      data: { procurementId, vendorId, price, proposalText, status: 'DRAFT' },
    });

    if (fileIds && fileIds.length > 0) {
      await this.prisma.file.updateMany({
        where: { id: { in: fileIds } },
        data: { submissionId: submission.id },
      });
    }

    await this.auditService.log({
      module: 'rfq-submission',
      entityType: 'RfqSubmission',
      entityId: submission.id,
      action: 'SUBMISSION_CREATED',
      actorId: vendor.userId,
      afterData: { procurementId, price },
    });

    return this.prisma.rfqSubmission.findUnique({
      where: { id: submission.id },
      include: { files: true },
    });
  }

  async submit(id: string, vendorUserId: string) {
    const submission = await this.prisma.rfqSubmission.findUnique({
      where: { id },
      include: {
        vendor: true,
        procurement: {
          select: { id: true, title: true, requestNo: true, requesterId: true },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.vendor.userId !== vendorUserId)
      throw new BadRequestException('Not your submission');
    if (submission.status === 'SUBMITTED')
      throw new BadRequestException('Already submitted');

    const updated = await this.prisma.rfqSubmission.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    const procurementUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: submission.procurement.requesterId },
          { role: 'PROCUREMENT', isActive: true },
        ],
        id: { not: vendorUserId },
      },
      select: { id: true },
    });
    const evaluatorAssignments = await this.prisma.evaluatorAssignment.findMany({
      where: { procurementId: submission.procurement.id },
      select: { evaluatorId: true },
    });
    const userIds = [...new Set([
      ...procurementUsers.map(u => u.id),
      ...evaluatorAssignments.map(a => a.evaluatorId),
    ])].filter(id => id !== vendorUserId);
    if (userIds.length > 0) {
      await this.notificationsService.createForUsers(userIds, {
        title: 'New Proposal Submitted',
        message: `${submission.vendor.companyName} submitted a proposal for ${submission.procurement.requestNo} — ${submission.procurement.title}`,
        type: 'info',
        entityType: 'Submission',
        entityId: id,
        link: `/procurements/${submission.procurement.id}`,
      });
    }

    await this.auditService.log({
      module: 'rfq-submission',
      entityType: 'RfqSubmission',
      entityId: id,
      action: 'SUBMISSION_SUBMITTED',
      actorId: vendorUserId,
      afterData: { procurementId: submission.procurement.id },
    });

    return this.prisma.rfqSubmission.findUnique({
      where: { id },
      include: { files: true },
    });
  }

  async update(
    id: string,
    vendorUserId: string,
    price?: number,
    proposalText?: string,
    fileIds?: string[],
  ) {
    const submission = await this.prisma.rfqSubmission.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.vendor.userId !== vendorUserId)
      throw new BadRequestException('Not your submission');
    if (submission.status === 'SUBMITTED')
      throw new BadRequestException('Cannot edit submitted proposal');

    const updated = await this.prisma.rfqSubmission.update({
      where: { id },
      data: {
        ...(price !== undefined && { price }),
         ...(proposalText !== undefined && { proposalText }),
       },
     });

    if (fileIds !== undefined) {
      await this.prisma.file.updateMany({
        where: { submissionId: id },
        data: { submissionId: null },
      });
      if (fileIds.length > 0) {
        await this.prisma.file.updateMany({
          where: { id: { in: fileIds } },
          data: { submissionId: id },
        });
      }
    }

    await this.auditService.log({
      module: 'rfq-submission',
      entityType: 'RfqSubmission',
      entityId: id,
      action: 'SUBMISSION_UPDATED',
      actorId: vendorUserId,
      afterData: { price, proposalText },
    });

    return updated;
  }

  async findByProcurement(procurementId: string) {
    const submissions = await this.prisma.rfqSubmission.findMany({
      where: { procurementId },
      include: { vendor: { select: { id: true, companyName: true } }, files: true },
    });

    const lastRound = await this.prisma.ebiddingRound.findFirst({
      where: { procurementId, status: 'CLOSED' },
      orderBy: { roundNo: 'desc' },
      include: { responses: true },
    });

    if (!lastRound) return submissions;

    const bidMap = new Map(lastRound.responses.map(r => [r.vendorId, r.bidAmount]));
    return submissions.map(sub => ({ ...sub, lastBid: bidMap.get(sub.vendorId) ?? null }));
  }

  async findMySubmission(procurementId: string, vendorUserId: string) {
    return this.prisma.rfqSubmission.findFirst({
      where: { procurementId, vendor: { userId: vendorUserId } },
    });
  }

  async findAllMySubmissions(vendorUserId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });
    if (!vendor) return [];
    return this.prisma.rfqSubmission.findMany({
      where: { vendorId: vendor.id },
      include: {
        procurement: {
          select: { id: true, requestNo: true, title: true },
        },
        files: true
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
