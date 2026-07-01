import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: { module: string; entityType: string; entityId: string; action: string; actorId?: string; actorRole?: string; beforeData?: any; afterData?: any }) {
    return this.prisma.auditLog.create({
      data: {
        module: data.module,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actorId: data.actorId,
        actorRole: data.actorRole,
        beforeData: data.beforeData,
        afterData: data.afterData,
      },
    });
  }

  async findByProcurement(procurementId: string, page = 1, limit = 50) {
    const where = { entityType: 'Procurement', entityId: procurementId };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
