import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, ProcurementStatus, UserRole } from '@prisma/client';
import { WORKFLOW_TRANSITIONS } from '../../common/enums';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  async routeToApprover(procurementId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      include: { requester: { select: { id: true, managerId: true, departmentId: true } } },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    // Route to requester's manager
    let assignedApproverId: string | null = procurement.requester?.managerId || null;

    // Fallback: if requester has no manager, find any active approver
    if (!assignedApproverId) {
      const fallbackApprover = await this.prisma.user.findFirst({
        where: { role: 'APPROVER', isActive: true },
        select: { id: true },
      });
      assignedApproverId = fallbackApprover?.id || null;
    }

    // Final fallback: if still no approver, find department head (any approver in same department)
    if (!assignedApproverId && procurement.requester) {
      const deptApprover = await this.prisma.user.findFirst({
        where: {
          role: 'APPROVER',
          isActive: true,
          departmentId: procurement.requester.departmentId || undefined,
        },
        select: { id: true },
      });
      assignedApproverId = deptApprover?.id || null;
    }

    await this.prisma.procurement.update({
      where: { id: procurementId },
      data: { assignedApproverId },
    });

    return { assignedApproverId };
  }

  async submitForApproval(procurementId: string, userId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      include: { requester: { select: { id: true, managerId: true, departmentId: true } } },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'EVALUATION') {
      throw new BadRequestException('Procurement must be under evaluation first');
    }

    // Route to requester's manager
    let assignedApproverId: string | null = procurement.requester?.managerId || null;

    // Fallback: if requester has no manager, find any active approver
    if (!assignedApproverId) {
      const fallbackApprover = await this.prisma.user.findFirst({
        where: { role: 'APPROVER', isActive: true },
        select: { id: true },
      });
      assignedApproverId = fallbackApprover?.id || null;
    }

    // Final fallback: if still no approver, find department head (any approver in same department)
    if (!assignedApproverId && procurement.requester) {
      const deptApprover = await this.prisma.user.findFirst({
        where: {
          role: 'APPROVER',
          isActive: true,
          departmentId: procurement.requester.departmentId || undefined,
        },
        select: { id: true },
      });
      assignedApproverId = deptApprover?.id || null;
    }

    await this.prisma.procurement.update({
      where: { id: procurementId },
      data: {
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
        assignedApproverId,
      },
    });

    await this.prisma.procurementTimeline.create({
      data: { procurementId, eventType: 'SENT_TO_APPROVAL', actorRole: 'PROCUREMENT', actorId: userId, metadata: { assignedApproverId } },
    });

    return { message: 'Sent for approval', assignedApproverId };
  }

  async getInbox(approverUserId: string) {
    const procurements = await this.prisma.procurement.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
        OR: [
          { assignedApproverId: approverUserId },
          { assignedApproverId: null },
        ],
      },
      include: {
        requester: { select: { id: true, fullName: true } },
        assignedApprover: { select: { id: true, fullName: true } },
        consolidations: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Check for overdue items (pending > 24 hours)
    const now = new Date();
    return procurements.map(p => {
      const hoursPending = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60));
      const isOverdue = hoursPending > 24;
      const escalationLevel = hoursPending > 72 ? 'CRITICAL' : hoursPending > 48 ? 'WARNING' : hoursPending > 24 ? 'OVERDUE' : 'NORMAL';
      return { ...p, hoursPending, isOverdue, escalationLevel };
    });
  }

  async approve(procurementId: string, approverId: string, comment?: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id: procurementId } });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'PENDING_APPROVAL') throw new BadRequestException('Not pending approval');

    await this.prisma.approval.create({
      data: { procurementId, approverId, decision: 'APPROVED', comment },
    });

    const updated = await this.prisma.procurement.update({
      where: { id: procurementId },
      data: { status: 'AWARD_APPROVED', currentOwnerRole: 'PROCUREMENT' },
    });

    await this.prisma.procurementTimeline.create({
      data: { procurementId, eventType: 'APPROVED', actorRole: 'APPROVER', actorId: approverId, metadata: { comment } },
    });

    return updated;
  }

  async return(procurementId: string, approverId: string, reason?: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id: procurementId } });
    if (!procurement) throw new NotFoundException('Procurement not found');

    await this.prisma.approval.create({
      data: { procurementId, approverId, decision: 'RETURNED', comment: reason },
    });

    const updated = await this.prisma.procurement.update({
      where: { id: procurementId },
      data: { status: 'RETURNED_FROM_APPROVAL', currentOwnerRole: 'PROCUREMENT' },
    });

    await this.prisma.procurementTimeline.create({
      data: { procurementId, eventType: 'RETURNED_FROM_APPROVAL', actorRole: 'APPROVER', actorId: approverId, metadata: { reason } },
    });

    return updated;
  }

  async reject(procurementId: string, approverId: string, reason?: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id: procurementId } });
    if (!procurement) throw new NotFoundException('Procurement not found');

    await this.prisma.approval.create({
      data: { procurementId, approverId, decision: 'REJECTED', comment: reason },
    });

    const updated = await this.prisma.procurement.update({
      where: { id: procurementId },
      data: { status: 'REJECTED', currentOwnerRole: 'CLOSED', finalDecisionReason: reason },
    });

    await this.prisma.procurementTimeline.create({
      data: { procurementId, eventType: 'REJECTED', actorRole: 'APPROVER', actorId: approverId, metadata: { reason } },
    });

    return updated;
  }

  async getOverdueApprovals() {
    const procurements = await this.prisma.procurement.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        requester: { select: { id: true, fullName: true } },
      },
    });

    const now = new Date();
    return procurements.filter(p => {
      const hoursPending = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60));
      return hoursPending > 24;
    }).map(p => {
      const hoursPending = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60));
      return {
        ...p,
        hoursPending,
        escalationLevel: hoursPending > 72 ? 'CRITICAL' : hoursPending > 48 ? 'WARNING' : 'OVERDUE',
      };
    });
  }

  async escalateApproval(procurementId: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id: procurementId } });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'PENDING_APPROVAL') throw new BadRequestException('Not pending approval');

    const hoursPending = Math.floor((Date.now() - new Date(procurement.updatedAt).getTime()) / (1000 * 60 * 60));

    // Create escalation notification for admin
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `ESCALATION: ${procurement.requestNo} overdue by ${hoursPending}h`,
          message: `${procurement.title} has been pending approval for ${hoursPending} hours`,
          type: 'warning',
          entityType: 'Procurement',
          entityId: procurementId,
          link: `/procurements/${procurementId}`,
        },
      });
    }

    // Create timeline event
    await this.prisma.procurementTimeline.create({
      data: {
        procurementId,
        eventType: 'ESCALATION',
        actorRole: 'SYSTEM',
        metadata: { hoursPending, reason: 'Approval overdue' },
      },
    });

    return { message: `Escalated after ${hoursPending} hours`, hoursPending };
  }
}
