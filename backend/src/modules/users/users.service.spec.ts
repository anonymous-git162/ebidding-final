import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrisma;

  const mockUser = {
    id: 'user-1',
    email: 'user@test.com',
    fullName: 'Test User',
    role: 'REQUESTER',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    propertyId: null,
    departmentId: null,
    managerId: null,
    createdAt: new Date(),
    vendor: null,
  };

  const mockVendorUser = {
    ...mockUser,
    id: 'vendor-user-1',
    email: 'vendor@test.com',
    role: 'VENDOR',
    vendor: { companyName: 'Test Corp' },
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search term', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      await service.findAll({ search: 'test', page: 1, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ fullName: expect.objectContaining({ contains: 'test' }) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      await service.findAll({ role: 'REQUESTER', page: 1, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'REQUESTER' }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, isActive: true });
    });

    it('should block non-admin from seeing admin role filter', async () => {
      const result = await service.findAll({ role: 'ADMIN', page: 1, limit: 20 }, 'REQUESTER');
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getProperties', () => {
    it('should return properties with departments', async () => {
      prisma.property.findMany.mockResolvedValue([{ id: 'prop-1', code: 'BKK', name: 'Bangkok', departments: [] }]);
      const result = await service.getProperties();
      expect(result).toHaveLength(1);
    });
  });

  describe('getDepartments', () => {
    it('should return departments for property', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', code: 'IT', name: 'IT', propertyId: 'prop-1' }]);
      const result = await service.getDepartments('prop-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(result.id).toBe('user-1');
    });

    it('should throw NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findByEmail('user@test.com');
      expect(result).toHaveProperty('id', 'user-1');
    });
  });

  describe('findManyByRole', () => {
    it('should return active users by role', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      const result = await service.findManyByRole('REQUESTER');
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'user@test.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'REQUESTER',
      });
      expect(result.id).toBe('user-1');
    });

    it('should throw on invalid email', async () => {
      await expect(service.create({
        email: 'invalid',
        password: 'password123',
        fullName: 'Test',
        role: 'REQUESTER',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw on short password', async () => {
      await expect(service.create({
        email: 'test@test.com',
        password: '12345',
        fullName: 'Test',
        role: 'REQUESTER',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw on duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.create({
        email: 'user@test.com',
        password: 'password123',
        fullName: 'Test',
        role: 'REQUESTER',
      })).rejects.toThrow(ConflictException);
    });

    it('should create vendor record for VENDOR role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...mockUser, role: 'VENDOR' });
      prisma.vendor.create.mockResolvedValue({});

      const result = await service.create({
        email: 'vendor@test.com',
        password: 'password123',
        fullName: 'Vendor User',
        role: 'VENDOR',
        companyName: 'Test Corp',
      });
      expect(result).toHaveProperty('id');
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, fullName: 'Updated Name' });

      const result = await service.update('user-1', { fullName: 'Updated Name' });
      expect(result.fullName).toBe('Updated Name');
    });

    it('should throw on invalid email in update', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.update('user-1', { email: 'invalid' })).rejects.toThrow(BadRequestException);
    });

    it('should throw on duplicate email in update', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, id: 'other', email: 'other@test.com' });
      await expect(service.update('user-1', { email: 'other@test.com' })).rejects.toThrow(ConflictException);
    });

    it('should create vendor record when role changes to VENDOR', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, role: 'VENDOR' });
      prisma.vendor.findUnique.mockResolvedValue(null);
      prisma.vendor.create.mockResolvedValue({});

      const result = await service.update('user-1', { role: 'VENDOR', companyName: 'New Corp' });
      expect(result).toHaveProperty('role', 'VENDOR');
    });

    it('should update existing vendor record', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, role: 'VENDOR' });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1' });
      prisma.vendor.update.mockResolvedValue({});

      const result = await service.update('user-1', { role: 'VENDOR', companyName: 'Updated Corp' });
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove('user-1');
      expect(result.id).toBe('user-1');
    });

    it('should throw on admin deletion', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'ADMIN' });
      await expect(service.remove('admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unlock', () => {
    it('should unlock a user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, failedLoginAttempts: 0, lockedUntil: null });

      const result = await service.unlock('user-1');
      expect(result.failedLoginAttempts).toBe(0);
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword('user-1', 'NewPass123');
      expect(result).toHaveProperty('id', 'user-1');
    });
  });
});
