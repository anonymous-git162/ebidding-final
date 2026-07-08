import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, ProcurementStatus, UserRole, SubmissionStatus } from '@prisma/client';
import { WORKFLOW_TRANSITIONS } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalService } from '../approval/approval.service';
import * as crypto from 'crypto';
import {
  CreateProcurementDto,
  UpdateProcurementDto,
  QueryProcurementDto,
} from './dto/procurement.dto';

@Injectable()
export class ProcurementsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => ApprovalService))
    private approvalService: ApprovalService,
  ) {}

  private generateRequestNo(type: string): string {
    const prefix = type === 'RFP' ? 'RFP' : type === 'RFQ' ? 'RFQ' : 'RFI';
    const date = new Date();
    const seq = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = crypto.randomInt(0, 10000).toString().padStart(4, '0');
    return `${prefix}-${seq}-${rand}`;
  }

  async create(dto: CreateProcurementDto, userId: string) {
    const requestNo = this.generateRequestNo(dto.requestType);

    // Auto-assign user's property if not provided
    let propertyId = dto.propertyId;
    if (!propertyId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { propertyId: true },
      });
      propertyId = user?.propertyId || undefined;
    }

    const procurement = await this.prisma.procurement.create({
      data: {
        requestNo,
        requestType: dto.requestType,
        title: dto.title,
        description: dto.description,
        businessNeed: dto.businessNeed,
        propertyId,
        departmentId: dto.departmentId,
        category: dto.category,
        currency: dto.currency || 'USD',
        budgetEstimate: dto.budgetEstimate,
        justification: dto.justification,
        requesterId: userId,
        status: 'DRAFT',
        currentOwnerRole: 'REQUESTER',
      },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        property: true,
        department: true,
      },
    });

    await this.appendTimeline(
      procurement.id,
      'DRAFT_CREATED',
      'REQUESTER',
      userId,
      {},
    );
    await this.logAudit(
      'procurements',
      procurement.id,
      'CREATE',
      userId,
      'REQUESTER',
      null,
      procurement,
    );

    // Link files to procurement
    if (dto.fileIds && dto.fileIds.length > 0) {
      await this.prisma.file.updateMany({
        where: { id: { in: dto.fileIds } },
        data: { procurementId: procurement.id },
      });
    }

    return procurement;
  }

  async findAll(dto: QueryProcurementDto, user: { id: string; role: string }) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const where: Prisma.ProcurementWhereInput = {};

    if (dto.status) {
      const statuses = dto.status.split(',').map(s => s.trim()) as ProcurementStatus[];
      where.status = { in: statuses };
    }
    if (dto.requestType) where.requestType = dto.requestType;
    if (dto.propertyId) where.propertyId = dto.propertyId;
    if (dto.category) where.category = dto.category;
    if (dto.currency) where.currency = dto.currency;

    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { requestNo: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
        { category: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) where.createdAt.gte = new Date(dto.dateFrom);
      if (dto.dateTo) {
        const to = new Date(dto.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (dto.budgetMin !== undefined || dto.budgetMax !== undefined) {
      where.budgetEstimate = {};
      if (dto.budgetMin !== undefined) where.budgetEstimate.gte = dto.budgetMin;
      if (dto.budgetMax !== undefined) where.budgetEstimate.lte = dto.budgetMax;
    }

    if (user.role === 'REQUESTER') {
      // Filter by requester's property (see all procurements from their property)
      const requester = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { propertyId: true },
      });
      if (requester?.propertyId) where.propertyId = requester.propertyId;
    } else if (user.role === 'APPROVER' || user.role === 'ADMIN') {
      // Filter by approver's property (see all procurements from their property)
      const approver = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { propertyId: true },
      });
      if (approver?.propertyId) where.propertyId = approver.propertyId;
    } else if (user.role === 'VENDOR') {
      where.invitations = { some: { vendor: { userId: user.id } } };
    }

    const sortBy = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder || 'desc';
    const allowedSorts = [
      'createdAt',
      'title',
      'requestNo',
      'status',
      'budgetEstimate',
      'requestType',
    ];
    const finalSortBy = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';

    const [procurements, total, statusCounts] = await Promise.all([
      this.prisma.procurement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [finalSortBy]: sortOrder },
        include: {
          requester: { select: { id: true, fullName: true } },
          property: { select: { code: true, name: true } },
          _count: { select: { invitations: true, submissions: true } },
        },
      }),
      this.prisma.procurement.count({ where }),
      this.prisma.procurement.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const item of statusCounts) {
      counts[item.status] = item._count.status;
    }

    return {
      data: procurements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        statusCounts: counts,
      },
    };
  }

  async findById(id: string, user: { id: string; role: string }) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        property: true,
        department: true,
        files: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
        timelines: { orderBy: { timestamp: 'desc' } },
        invitations: {
          include: {
            vendor: { select: { id: true, companyName: true, userId: true } },
          },
        },
        _count: {
          select: {
            submissions: true,
            ebiddingRounds: true,
            evaluatorAssignments: true,
          },
        },
      },
    });

    if (!procurement) throw new NotFoundException('Procurement not found');

    // Authorization: only allow access based on role
    if (user.role === 'VENDOR') {
      const invitation = procurement.invitations?.find(
        (inv) => inv.vendor?.userId === user.id,
      );
      if (!invitation) throw new ForbiddenException('Access denied');
    } else if (user.role === 'REQUESTER') {
      if (procurement.requesterId !== user.id)
        throw new ForbiddenException('Access denied');
    }

    return procurement;
  }

  async update(id: string, dto: UpdateProcurementDto, userId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (!['DRAFT', 'RETURNED_FOR_REVISION'].includes(procurement.status)) {
      throw new BadRequestException(
        'Can only update draft or returned procurements',
      );
    }
    if (procurement.requesterId !== userId) {
      throw new ForbiddenException('You can only update your own procurement');
    }

    const updated = await this.prisma.procurement.update({
      where: { id },
      data: dto,
    });

    await this.appendTimeline(id, 'DRAFT_UPDATED', 'REQUESTER', userId, {
      fields: Object.keys(dto),
    });
    return updated;
  }

  async submit(id: string, userId: string) {
    return this.transition(id, 'SUBMITTED', 'REQUESTER', userId, 'REQUESTER');
  }

  async startReview(id: string, userId: string) {
    return this.transition(
      id,
      'UNDER_PROCUREMENT_REVIEW',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async approveReview(id: string, userId: string, comment?: string) {
    return this.transition(
      id,
      'APPROVED',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
      { comment },
    );
  }

  async returnReview(id: string, userId: string, reason?: string) {
    return this.transition(
      id,
      'RETURNED_FOR_REVISION',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
      { reason },
    );
  }

  async rejectReview(id: string, userId: string, reason?: string) {
    return this.transition(
      id,
      'REJECTED',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
      { reason },
    );
  }

  async publish(id: string, userId: string, submissionDeadline?: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const publishMap: Record<string, string> = {
      RFI: 'RFI_PUBLISHED',
      RFP: 'RFP_PUBLISHED',
      RFQ: 'RFQ_OPEN',
    };
    const nextStatus = publishMap[procurement.requestType] || 'RFP_PUBLISHED';
    if (!WORKFLOW_TRANSITIONS[procurement.status]?.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot publish from status ${procurement.status}`,
      );
    }

    const updated = await this.prisma.procurement.update({
      where: { id },
      data: {
        status: nextStatus as ProcurementStatus,
        currentOwnerRole: 'VENDOR',
        currentStage: 'PUBLISHED',
        publishedAt: new Date(),
        submissionDeadline: submissionDeadline
          ? new Date(submissionDeadline)
          : null,
      },
    });

    await this.appendTimeline(id, nextStatus, 'PROCUREMENT', userId, {
      submissionDeadline,
    });
    await this.logAudit(
      'procurements',
      id,
      'PUBLISH',
      userId,
      'PROCUREMENT',
      procurement,
      updated,
    );

    return updated;
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.transition(
      id,
      'CANCELLED',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
      { reason },
    );
  }

  async closeRfi(id: string, userId: string) {
    return this.transition(
      id,
      'RFI_CLOSED',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async draftRfp(id: string, userId: string) {
    return this.transition(
      id,
      'RFP_DRAFTING',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async completeVendorResponse(id: string, userId: string) {
    return this.transition(
      id,
      'VENDOR_RESPONSE_IN_PROGRESS',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async startEbidding(id: string, userId: string) {
    const count = await this.prisma.rfqSubmission.count({
      where: { procurementId: id, status: SubmissionStatus.SUBMITTED },
    });
    if (count < 1) {
      throw new BadRequestException(
        'At least 1 vendor must submit a proposal before starting e-bidding.',
      );
    }
    return this.transition(
      id,
      'EBIDDING_PREP',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async completeEbidding(id: string, userId: string) {
    return this.transition(
      id,
      'EVALUATION',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
    );
  }

  async completeEvaluation(id: string, userId: string) {
    // First transition to PENDING_APPROVAL with APPROVER as owner
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const allowedTransitions = WORKFLOW_TRANSITIONS[procurement.status] || [];
    if (!allowedTransitions.includes('PENDING_APPROVAL')) {
      throw new BadRequestException(
        `Cannot transition from ${procurement.status} to PENDING_APPROVAL`,
      );
    }

    const updated = await this.prisma.procurement.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        currentOwnerRole: 'APPROVER',
        currentStage: 'PENDING_APPROVAL',
      },
    });

    await this.appendTimeline(
      id,
      'PENDING_APPROVAL',
      'PROCUREMENT',
      userId,
      {},
    );
    await this.logAudit(
      'procurements',
      id,
      'PENDING_APPROVAL',
      userId,
      'PROCUREMENT',
      procurement,
      updated,
    );

    // Route to the right approver
    await this.approvalService.routeToApprover(id);

    return updated;
  }

  async approveProcurement(id: string, userId: string, comment?: string) {
    return this.transition(
      id,
      'AWARD_APPROVED',
      'APPROVER',
      userId,
      'APPROVER',
      { comment },
    );
  }

  async announceAward(
    id: string,
    userId: string,
    winningVendorId: string,
    announcementText: string,
  ) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'AWARD_APPROVED')
      throw new BadRequestException('Must be award approved first');

    await this.prisma.procurementResult.upsert({
      where: { procurementId: id },
      create: {
        procurementId: id,
        winningVendorId,
        announcementText,
        announcedAt: new Date(),
      },
      update: { winningVendorId, announcementText, announcedAt: new Date() },
    });

    return this.transition(
      id,
      'AWARD_ANNOUNCED',
      'PROCUREMENT',
      userId,
      'PROCUREMENT',
      { winningVendorId },
    );
  }

  async resubmitForApproval(id: string, userId: string) {
    return this.transition(
      id,
      'PENDING_APPROVAL',
      'PROCUREMENT',
      userId,
      'APPROVER',
    );
  }

  async sendContract(id: string, userId: string) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    if (procurement.status !== 'AWARD_ANNOUNCED')
      throw new BadRequestException('Must be AWARD_ANNOUNCED to send contract');

    await this.prisma.procurementResult.update({
      where: { procurementId: id },
      data: { contractSentAt: new Date() },
    });

    await this.appendTimeline(id, 'CONTRACT_SENT', 'PROCUREMENT', userId, {});
    return { message: 'Contract sent' };
  }

  async completeProcurement(id: string, userId: string) {
    return this.transition(id, 'COMPLETED', 'PROCUREMENT', userId, 'CLOSED');
  }

  private async transition(
    id: string,
    targetStatus: string,
    actorRole: string,
    userId: string,
    newOwnerRole: string,
    metadata?: Record<string, any>,
  ) {
    const procurement = await this.prisma.procurement.findUnique({
      where: { id },
    });
    if (!procurement) throw new NotFoundException('Procurement not found');

    const allowedTransitions = WORKFLOW_TRANSITIONS[procurement.status] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${procurement.status} to ${targetStatus}. Allowed: ${allowedTransitions.join(', ')}`,
      );
    }

    const updated = await this.prisma.procurement.update({
      where: { id },
      data: {
        status: targetStatus as ProcurementStatus,
        currentOwnerRole: newOwnerRole as any,
        currentStage: targetStatus,
      },
    });

    await this.appendTimeline(
      id,
      targetStatus,
      actorRole,
      userId,
      metadata || {},
    );
    await this.logAudit(
      'procurements',
      id,
      targetStatus,
      userId,
      actorRole,
      procurement,
      updated,
    );

    // Create notifications
    const notifTitle = `${procurement.requestNo} — ${targetStatus.replace(/_/g, ' ').toLowerCase()}`;
    const notifMessage = `${procurement.title} status changed to ${targetStatus.replace(/_/g, ' ').toLowerCase()}`;
    const notifLink = `/procurements/${id}`;

    // Determine who to notify based on the status change
    const notifyRoles: UserRole[] = [];
    switch (targetStatus) {
      case 'SUBMITTED':
        notifyRoles.push(UserRole.PROCUREMENT);
        break;
      case 'APPROVED':
        notifyRoles.push(UserRole.REQUESTER);
        break;
      case 'RETURNED_FOR_REVISION':
        notifyRoles.push(UserRole.REQUESTER);
        break;
      case 'REJECTED':
        notifyRoles.push(UserRole.REQUESTER);
        break;
      case 'RFP_PUBLISHED':
      case 'RFQ_OPEN':
      case 'RFI_PUBLISHED':
        notifyRoles.push(UserRole.VENDOR);
        break;
      case 'PENDING_APPROVAL':
        notifyRoles.push(UserRole.APPROVER, UserRole.ADMIN);
        break;
      case 'AWARD_APPROVED':
      case 'AWARD_ANNOUNCED':
      case 'COMPLETED':
        notifyRoles.push(UserRole.REQUESTER, UserRole.PROCUREMENT);
        break;
      default:
        notifyRoles.push(UserRole.ADMIN);
        break;
    }

    // Also notify the requester if they aren't the actor
    if (
      procurement.requesterId &&
      procurement.requesterId !== userId &&
      !notifyRoles.includes(UserRole.REQUESTER)
    ) {
      await this.notificationsService.create(procurement.requesterId, {
        title: notifTitle,
        message: notifMessage,
        type: targetStatus === 'REJECTED' ? 'error' : 'info',
        entityType: 'Procurement',
        entityId: id,
        link: notifLink,
      });
    }

    // Notify users with the determined roles (except the actor)
    if (notifyRoles.length > 0) {
      const targetUsers = await this.prisma.user.findMany({
        where: {
          role: { in: notifyRoles },
          isActive: true,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (targetUsers.length > 0) {
        await this.notificationsService.createForUsers(
          targetUsers.map((u) => u.id),
          {
            title: notifTitle,
            message: notifMessage,
            type: targetStatus === 'REJECTED' ? 'error' : 'info',
            entityType: 'Procurement',
            entityId: id,
            link: notifLink,
          },
        );
      }
    }

    return updated;
  }

  private async appendTimeline(
    procurementId: string,
    eventType: string,
    actorRole: string,
    actorId: string,
    metadata: Record<string, any>,
  ) {
    return this.prisma.procurementTimeline.create({
      data: { procurementId, eventType, actorRole, actorId, metadata },
    });
  }

  private async logAudit(
    module: string,
    entityId: string,
    action: string,
    actorId: string,
    actorRole: string,
    beforeData: any,
    afterData: any,
  ) {
    return this.prisma.auditLog.create({
      data: {
        module,
        entityType: 'Procurement',
        entityId,
        action,
        actorId,
        actorRole,
        beforeData: beforeData
          ? JSON.parse(JSON.stringify(beforeData))
          : undefined,
        afterData: afterData
          ? JSON.parse(JSON.stringify(afterData))
          : undefined,
      },
    });
  }

  async getCurrencies() {
    const result = await this.prisma.procurement.groupBy({
      by: ['currency'],
      _count: true,
      where: { currency: { not: null } },
    });
    return result.map((r) => ({ currency: r.currency, count: r._count }));
  }

  async getStats() {
    const [total, byStatus, byType, byCategory, byMonth, recentActivity] =
      await Promise.all([
        this.prisma.procurement.count(),
        this.prisma.procurement.groupBy({ by: ['status'], _count: true }),
        this.prisma.procurement.groupBy({ by: ['requestType'], _count: true }),
        this.prisma.procurement.groupBy({
          by: ['category'],
          _count: true,
          where: { category: { not: null } },
        }),
        this.prisma.procurement.findMany({
          select: { createdAt: true, status: true, budgetEstimate: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.auditLog.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            entityType: true,
            createdAt: true,
            actorRole: true,
          },
        }),
      ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count]),
    );
    const typeMap = Object.fromEntries(
      byType.map((t) => [t.requestType, t._count]),
    );
    const categoryMap = Object.fromEntries(
      byCategory.map((c) => [c.category || 'Uncategorized', c._count]),
    );

    const monthlyData: Record<string, { count: number; budget: number }> = {};
    byMonth.forEach((item) => {
      const month = item.createdAt.toISOString().slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { count: 0, budget: 0 };
      monthlyData[month].count++;
      monthlyData[month].budget += Number(item.budgetEstimate || 0);
    });

    const totalBudget = byMonth.reduce(
      (sum, item) => sum + Number(item.budgetEstimate || 0),
      0,
    );
    const avgBudget = total > 0 ? totalBudget / total : 0;

    return {
      total,
      totalBudget,
      avgBudget,
      byStatus: Object.entries(statusMap).map(([status, count]) => ({
        status,
        count,
      })),
      byType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
      byCategory: Object.entries(categoryMap).map(([category, count]) => ({
        category,
        count,
      })),
      byMonth: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
      })),
      recentActivity,
    };
  }

  async remove(id: string) {
    const procurement = await this.prisma.procurement.findUnique({ where: { id } });
    if (!procurement) throw new NotFoundException('Procurement not found');
    return this.prisma.procurement.delete({ where: { id } });
  }
}
