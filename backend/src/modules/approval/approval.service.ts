import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class ApprovalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  private async syncApproverAssignments(procurementId: string, approverIds: string[]) {
    await this.prisma.procurementApprover.deleteMany({
      where: { procurementId },
    });
    if (approverIds.length > 0) {
      await this.prisma.procurementApprover.createMany({
        data: approverIds.map(approverId => ({
          procurementId,
          approverId,
        })),
      });
    }
  }

  async routeToApprover(procurementId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      include: {
        requester: {
          select: { id: true, managerId: true, departmentId: true },
        },
      },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    // Route to requester's manager
    let assignedApproverId: string | null =
      procurement.requester?.managerId || null;

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

    if (assignedApproverId) {
      await this.syncApproverAssignments(procurementId, [assignedApproverId]);
    }

    return { assignedApproverId };
  }

  async submitForApproval(procurementId: string, userId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
      include: {
        requester: {
          select: { id: true, managerId: true, departmentId: true },
        },
      },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'EVALUATION') {
      throw new BadRequestException(
        'Procurement must be under evaluation first',
      );
    }

    // Route to requester's manager
    let assignedApproverId: string | null =
      procurement.requester?.managerId || null;

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

    if (assignedApproverId) {
      await this.syncApproverAssignments(procurementId, [assignedApproverId]);
    }

    await this.prisma.procurementTimeline.create({
      data: {
        procurementId,
        eventType: 'SENT_TO_APPROVAL',
        actorRole: 'PROCUREMENT',
        actorId: userId,
        metadata: { assignedApproverId },
      },
    });

    // Notify all assigned approvers
    const approverAssignments = await this.prisma.procurementApprover.findMany({
      where: { procurementId },
      include: { approver: { select: { id: true } } },
    });
    const approverUserIds = approverAssignments.map((a) => a.approver.id);
    if (approverUserIds.length > 0) {
      await this.notificationsService.createForUsers(approverUserIds, {
        title: 'Approval Request',
        message: `"${procurement.title || procurement.requestNo}" is pending your approval`,
        type: 'info',
        entityType: 'Procurement',
        entityId: procurementId,
        link: `/procurements/${procurementId}`,
      });
    }

    await this.auditService.log({
      module: 'approval', entityType: 'Procurement', entityId: procurementId,
      action: 'SUBMITTED_FOR_APPROVAL', actorId: userId,
    });

    return { message: 'Sent for approval', assignedApproverId };
  }

  async getInbox(approverUserId: string) {
    const procurements = await this.prisma.procurement.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
        OR: [
          { approverAssignments: { some: { approverId: approverUserId } } },
          { approverAssignments: { none: {} } },
        ],
      },
      include: {
        requester: { select: { id: true, fullName: true } },
        approverAssignments: {
          include: { approver: { select: { id: true, fullName: true } } },
        },
        approvals: {
          include: { approver: { select: { id: true, fullName: true } } },
          orderBy: { decidedAt: 'desc' },
        },
        consolidations: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Check for overdue items (pending > 24 hours)
    const now = new Date();
    return procurements.map((p) => {
      const hoursPending = Math.floor(
        (now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60),
      );
      const isOverdue = hoursPending > 24;
      const escalationLevel =
        hoursPending > 72
          ? 'CRITICAL'
          : hoursPending > 48
            ? 'WARNING'
            : hoursPending > 24
              ? 'OVERDUE'
              : 'NORMAL';
      return { ...p, hoursPending, isOverdue, escalationLevel };
    });
  }

  async approve(procurementId: string, approverId: string, comment?: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('Not pending approval');

    return this.prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: { procurementId, approverId, decision: 'APPROVED', comment },
      });

      // Consensus: check if all assigned approvers have APPROVED as their most recent decision
      const assignedApprovers = await tx.procurementApprover.findMany({
        where: { procurementId },
        select: { approverId: true },
      });
      const allApprovals = await tx.approval.findMany({
        where: { procurementId },
        orderBy: { decidedAt: 'desc' },
        select: { approverId: true, decision: true },
      });
      // Most recent decision per approver
      const latestDecisions = new Map<string, string>();
      for (const a of allApprovals) {
        if (!latestDecisions.has(a.approverId)) {
          latestDecisions.set(a.approverId, a.decision);
        }
      }
      const allApproved = assignedApprovers.length === 0
        || assignedApprovers.every(aa => latestDecisions.get(aa.approverId) === 'APPROVED');

      if (allApproved) {
        // All assigned approvers have approved (or no explicit assignments)
        const updated = await tx.procurement.update({
          where: { id: procurementId },
          data: { status: 'AWARD_APPROVED', currentOwnerRole: 'PROCUREMENT', currentStage: 'AWARD_APPROVED' },
        });

        await tx.procurementTimeline.create({
          data: {
            procurementId,
            eventType: 'APPROVED',
            actorRole: 'APPROVER',
            actorId: approverId,
            metadata: { comment },
          },
        });

        await this.auditService.log({
          module: 'approval', entityType: 'Procurement', entityId: procurementId,
          action: 'AWARD_APPROVED', actorId: approverId,
        });

        // Notify requester that all approvers have approved
        await this.notificationsService.create(procurement.requesterId, {
          title: 'Award Approved',
          message: `"${procurement.title || procurement.requestNo}" has been approved by all approvers`,
          type: 'success',
          entityType: 'Procurement',
          entityId: procurementId,
          link: `/procurements/${procurementId}`,
        });

        return updated;
      }

      // Not all approvers have approved yet — stay in PENDING_APPROVAL
      const updated = await tx.procurement.update({
        where: { id: procurementId },
        data: { updatedAt: new Date() },
      });

      await tx.procurementTimeline.create({
        data: {
          procurementId,
          eventType: 'PARTIAL_APPROVAL',
          actorRole: 'APPROVER',
          actorId: approverId,
          metadata: { comment, approvedCount: assignedApprovers.filter(aa => latestDecisions.get(aa.approverId) === 'APPROVED').length + 1, assignedCount: assignedApprovers.length },
        },
      });

      return updated;
    });
  }

  async return(procurementId: string, approverId: string, reason?: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          procurementId,
          approverId,
          decision: 'RETURNED',
          comment: reason,
        },
      });

      const updated = await tx.procurement.update({
        where: { id: procurementId },
        data: {
          status: 'RETURNED_FROM_APPROVAL',
          currentOwnerRole: 'PROCUREMENT',
          currentStage: 'RETURNED_FROM_APPROVAL',
        },
      });

      await tx.procurementTimeline.create({
        data: {
          procurementId,
          eventType: 'RETURNED_FROM_APPROVAL',
          actorRole: 'APPROVER',
          actorId: approverId,
          metadata: { reason },
        },
      });

      await this.auditService.log({
        module: 'approval', entityType: 'Procurement', entityId: procurementId,
        action: 'RETURNED_FROM_APPROVAL', actorId: approverId,
      });

      return updated;
    });

    await this.notificationsService.create(procurement.requesterId, {
      title: 'Approval Returned',
      message: `"${procurement.title || procurement.requestNo}" was returned by an approver${reason ? `: ${reason}` : ''}`,
      type: 'warning',
      entityType: 'Procurement',
      entityId: procurementId,
      link: `/procurements/${procurementId}`,
    });

    return result;
  }

  async reject(procurementId: string, approverId: string, reason?: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          procurementId,
          approverId,
          decision: 'REJECTED',
          comment: reason,
        },
      });

      const updated = await tx.procurement.update({
        where: { id: procurementId },
        data: {
          status: 'REJECTED',
          currentOwnerRole: 'CLOSED',
          currentStage: 'REJECTED',
          finalDecisionReason: reason,
        },
      });

      await tx.procurementTimeline.create({
        data: {
          procurementId,
          eventType: 'REJECTED',
          actorRole: 'APPROVER',
          actorId: approverId,
          metadata: { reason },
        },
      });

      await this.auditService.log({
        module: 'approval', entityType: 'Procurement', entityId: procurementId,
        action: 'REJECTED', actorId: approverId,
      });

      return updated;
    });

    await this.notificationsService.create(procurement.requesterId, {
      title: 'Approval Rejected',
      message: `"${procurement.title || procurement.requestNo}" was rejected by an approver${reason ? `: ${reason}` : ''}`,
      type: 'error',
      entityType: 'Procurement',
      entityId: procurementId,
      link: `/procurements/${procurementId}`,
    });

    return result;
  }

  async getOverdueApprovals() {
    const procurements = await this.prisma.procurement.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        requester: { select: { id: true, fullName: true } },
      },
    });

    const now = new Date();
    return procurements
      .filter((p) => {
        const hoursPending = Math.floor(
          (now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60),
        );
        return hoursPending > 24;
      })
      .map((p) => {
        const hoursPending = Math.floor(
          (now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60),
        );
        return {
          ...p,
          hoursPending,
          escalationLevel:
            hoursPending > 72
              ? 'CRITICAL'
              : hoursPending > 48
                ? 'WARNING'
                : 'OVERDUE',
        };
      });
  }

  async escalateApproval(procurementId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id: procurementId },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('Not pending approval');

    const hoursPending = Math.floor(
      (Date.now() - new Date(procurement.updatedAt).getTime()) /
        (1000 * 60 * 60),
    );

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

    await this.auditService.log({
      module: 'approval', entityType: 'Procurement', entityId: procurementId,
      action: 'APPROVAL_ESCALATED', actorId: undefined,
      afterData: { hoursPending },
    });

    return { message: `Escalated after ${hoursPending} hours`, hoursPending };
  }
}
