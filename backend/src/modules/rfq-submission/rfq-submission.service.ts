import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RfqSubmissionService {
  constructor(private prisma: PrismaService) {}

  async create(procurementId: string, vendorId: string, price: number, proposalText?: string) {
    return this.prisma.rfqSubmission.create({
      data: { procurementId, vendorId, price, proposalText, status: 'DRAFT' },
    });
  }

  async submit(id: string, vendorUserId: string) {
    const submission = await this.prisma.rfqSubmission.findUnique({ where: { id }, include: { vendor: true } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.vendor.userId !== vendorUserId) throw new BadRequestException('Not your submission');
    if (submission.status === 'SUBMITTED') throw new BadRequestException('Already submitted');

    return this.prisma.rfqSubmission.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }

  async update(id: string, vendorUserId: string, price?: number, proposalText?: string) {
    const submission = await this.prisma.rfqSubmission.findUnique({ where: { id }, include: { vendor: true } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.vendor.userId !== vendorUserId) throw new BadRequestException('Not your submission');
    if (submission.status === 'SUBMITTED') throw new BadRequestException('Cannot edit submitted proposal');

    return this.prisma.rfqSubmission.update({
      where: { id },
      data: { ...(price !== undefined && { price }), ...(proposalText !== undefined && { proposalText }) },
    });
  }

  async findByProcurement(procurementId: string) {
    return this.prisma.rfqSubmission.findMany({
      where: { procurementId },
      include: { vendor: { select: { id: true, companyName: true } } },
    });
  }

  async findMySubmission(procurementId: string, vendorUserId: string) {
    return this.prisma.rfqSubmission.findFirst({
      where: { procurementId, vendor: { userId: vendorUserId } },
    });
  }
}
