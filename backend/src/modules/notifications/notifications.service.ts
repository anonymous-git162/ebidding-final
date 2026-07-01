import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsGateway } from '../../common/gateway/notifications.gateway';

@Injectable()
export class NotificationsService {
  private gateway: NotificationsGateway | null = null;

  constructor(private prisma: PrismaService) {}

  setGateway(gateway: NotificationsGateway) {
    this.gateway = gateway;
  }

  async create(userId: string, data: { title: string; message: string; type?: string; entityType?: string; entityId?: string; link?: string }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        entityType: data.entityType,
        entityId: data.entityId,
        link: data.link,
      },
    });

    // Send real-time notification via WebSocket
    this.gateway?.sendNotification(userId, {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      link: notification.link || undefined,
    });

    return notification;
  }

  async createForUsers(userIds: string[], data: { title: string; message: string; type?: string; entityType?: string; entityId?: string; link?: string }) {
    const result = await this.prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        entityType: data.entityType,
        entityId: data.entityId,
        link: data.link,
      })),
    });

    // Send real-time notifications via WebSocket
    this.gateway?.sendBulkNotification(userIds, {
      id: 'bulk',
      title: data.title,
      message: data.message,
      link: data.link,
    });

    return result;
  }

  async findByUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async delete(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }
}
