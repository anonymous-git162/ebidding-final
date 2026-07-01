import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  async announceWinner(procurementId: string, winningVendorId: string, announcementText: string, userId: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id: procurementId } });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'COMPLETED') throw new BadRequestException('Procurement must be completed first');

    return this.prisma.procurementResult.upsert({
      where: { procurementId },
      create: {
        procurementId,
        winningVendorId,
        announcementText,
        announcedAt: new Date(),
      },
      update: {
        winningVendorId,
        announcementText,
        announcedAt: new Date(),
      },
    });
  }

  async getResult(procurementId: string, userId: string, userRole: string, vendorUserId?: string) {
    const result = await this.prisma.procurementResult.findUnique({
      where: { procurementId },
      include: {
        procurement: { select: { id: true, title: true, requestNo: true, status: true } },
        winningVendor: { select: { id: true, companyName: true } },
      },
    });

    if (!result) throw new NotFoundException('Result not found');

    if (userRole === 'VENDOR') {
      if (!vendorUserId) throw new BadRequestException('Vendor user ID required');

      const vendor = await this.prisma.vendor.findUnique({ where: { userId: vendorUserId } });
      if (!vendor) throw new NotFoundException('Vendor not found');

      const isWinner = result.winningVendorId === vendor.id;
      return {
        ...result,
        status: isWinner ? 'Selected' : 'Not Selected',
        winningVendor: undefined,
        announcementText: isWinner ? result.announcementText : undefined,
      };
    }

    return result;
  }

  async closeCase(procurementId: string, userId: string) {
    const result = await this.prisma.procurementResult.findUnique({ where: { procurementId } });
    if (!result) throw new NotFoundException('Result not found');

    return this.prisma.procurementResult.update({
      where: { procurementId },
      data: { closedAt: new Date() },
    });
  }
}
