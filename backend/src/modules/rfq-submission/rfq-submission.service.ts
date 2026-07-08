import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RfqSubmissionService {
  constructor(private prisma: PrismaService) {}

  async create(
    procurementId: string,
    vendorId: string,
    price: number,
    proposalText?: string,
    fileIds?: string[],
  ) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      select: { id: true },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const invitation = await this.prisma.vendorInvitation.findFirst({
      where: { procurementId, vendorId, invitationStatus: 'ACCEPTED' },
    });
    if (!invitation) {
      throw new BadRequestException(
        'You must accept the invitation before submitting a proposal.',
      );
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

    return submission;
  }

  async submit(id: string, vendorUserId: string) {
    const submission = await this.prisma.rfqSubmission.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.vendor.userId !== vendorUserId)
      throw new BadRequestException('Not your submission');
    if (submission.status === 'SUBMITTED')
      throw new BadRequestException('Already submitted');

    return this.prisma.rfqSubmission.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
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

    return updated;
  }

  async findByProcurement(procurementId: string) {
    return this.prisma.rfqSubmission.findMany({
      where: { procurementId },
      include: { vendor: { select: { id: true, companyName: true } }, files: true },
    });
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
