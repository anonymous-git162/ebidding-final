import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrisma;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    title: 'Test Notification',
    message: 'This is a test',
    type: 'info',
    entityType: 'Procurement',
    entityId: 'proc-1',
    link: '/procurements/proc-1',
    readAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('should create a notification', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);
      const result = await service.create('user-1', {
        title: 'Test Notification',
        message: 'This is a test',
        entityType: 'Procurement',
        entityId: 'proc-1',
        link: '/procurements/proc-1',
      });

      expect(result).toHaveProperty('id', 'notif-1');
      expect(result).toHaveProperty('title', 'Test Notification');
    });

    it('should use default type info', async () => {
      prisma.notification.create.mockResolvedValue({ ...mockNotification, type: 'info' });
      const result = await service.create('user-1', {
        title: 'Test',
        message: 'Test',
      });

      expect(result.type).toBe('info');
    });
  });

  describe('createForUsers', () => {
    it('should create notifications for multiple users', async () => {
      prisma.notification.createMany.mockResolvedValue({ count: 2 });
      const result = await service.createForUsers(['user-1', 'user-2'], {
        title: 'Bulk Notification',
        message: 'For everyone',
      });

      expect(result.count).toBe(2);
    });
  });

  describe('findByUser', () => {
    it('should find notifications for user', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      const result = await service.findByUser('user-1');
      expect(result).toHaveLength(1);
    });

    it('should filter unread only', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      const result = await service.findByUser('user-1', true);
      expect(result).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            readAt: null,
          }),
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      prisma.notification.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.markAsRead('notif-1', 'user-1');
      expect(result.count).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await service.markAllAsRead('user-1');
      expect(result.count).toBe(5);
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.delete('notif-1', 'user-1');
      expect(result.count).toBe(1);
    });
  });
});
