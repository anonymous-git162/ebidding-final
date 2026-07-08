import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VendorInvitationService {
  constructor(private prisma: PrismaService) {}

  async invite(
    procurementId: string,
    vendorIds: string[],
    userId: string,
    deadline?: string,
  ) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      select: { id: true },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const invitations = await Promise.all(
      vendorIds.map((vendorId) =>
        this.prisma.vendorInvitation.create({
          data: {
            procurementId,
            vendorId,
            invitedAt: new Date(),
            deadline: deadline ? new Date(deadline) : null,
          },
        }),
      ),
    );

    for (const inv of invitations) {
      await this.prisma.procurementTimeline.create({
        data: {
          procurementId,
          eventType: 'VENDOR_INVITED',
          actorRole: 'PROCUREMENT',
          actorId: userId,
          metadata: { vendorId: inv.vendorId },
        },
      });
    }

    return invitations;
  }

  async findByProcurement(procurementId: string) {
    return this.prisma.vendorInvitation.findMany({
      where: { procurementId },
      include: {
        vendor: { select: { id: true, companyName: true, contactName: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.vendorInvitation.findMany({
      include: {
        procurement: {
          select: {
            id: true,
            title: true,
            requestNo: true,
            requestType: true,
            status: true,
            submissionDeadline: true,
          },
        },
        vendor: { select: { id: true, companyName: true, contactName: true } },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  async findMyInvitations(userId: string) {
    return this.prisma.vendorInvitation.findMany({
      where: { vendor: { userId } },
      include: {
        procurement: {
          select: {
            id: true,
            title: true,
            requestNo: true,
            status: true,
            submissionDeadline: true,
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  async accept(id: string, userId: string) {
    const invitation = await this.prisma.vendorInvitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.invitationStatus !== 'PENDING')
      throw new BadRequestException('Invitation is not pending');

    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    if (!vendor || vendor.id !== invitation.vendorId) {
      throw new BadRequestException('This invitation is not for your account');
    }

    return this.prisma.vendorInvitation.update({
      where: { id },
      data: { invitationStatus: 'ACCEPTED', acceptedAt: new Date() },
    });
  }

  async decline(id: string, userId: string) {
    const invitation = await this.prisma.vendorInvitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    if (!vendor || vendor.id !== invitation.vendorId) {
      throw new BadRequestException('This invitation is not for your account');
    }

    return this.prisma.vendorInvitation.update({
      where: { id },
      data: { invitationStatus: 'DECLINED', declinedAt: new Date() },
    });
  }
}
