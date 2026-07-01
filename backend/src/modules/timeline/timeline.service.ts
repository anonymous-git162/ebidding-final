import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TimelineService {
  constructor(private prisma: PrismaService) {}

  async append(data: { procurementId: string; eventType: string; actorRole: string; actorId?: string; metadata?: any }) {
    return this.prisma.procurementTimeline.create({ data });
  }

  async findByProcurement(procurementId: string) {
    return this.prisma.procurementTimeline.findMany({
      where: { procurementId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
