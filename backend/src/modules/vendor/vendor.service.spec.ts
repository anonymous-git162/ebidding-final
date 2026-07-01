import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('VendorService', () => {
  let service: VendorService;
  let prisma: MockPrisma;

  const mockVendor = {
    id: 'vendor-1',
    companyName: 'Test Corp',
    taxId: '0105555123456',
    contactName: 'Test Contact',
    contactEmail: 'vendor@test.com',
    phone: '+66-2-123-4567',
    address: '123 Test St',
    status: 'ACTIVE',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { email: 'vendor@test.com', fullName: 'Test Contact' },
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<VendorService>(VendorService);
  });

  describe('create', () => {
    it('should create vendor with existing userId', async () => {
      prisma.vendor.create.mockResolvedValue(mockVendor);

      const result = await service.create({
        companyName: 'Test Corp',
        contactName: 'Test Contact',
        contactEmail: 'vendor@test.com',
        userId: 'user-1',
      });
      expect(result.id).toBe('vendor-1');
    });

    it('should auto-create user account when no userId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-user', email: 'vendor@test.com', fullName: 'Test', role: 'VENDOR', isActive: true, failedLoginAttempts: 0, lockedUntil: null, propertyId: null, departmentId: null, managerId: null, createdAt: new Date() });
      prisma.vendor.create.mockResolvedValue(mockVendor);

      const result = await service.create({
        companyName: 'Test Corp',
        contactName: 'Test Contact',
        contactEmail: 'vendor@test.com',
      });
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'vendor@test.com' });
      await expect(service.create({
        companyName: 'Test Corp',
        contactName: 'Test',
        contactEmail: 'vendor@test.com',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated vendors', async () => {
      prisma.vendor.findMany.mockResolvedValue([mockVendor]);
      prisma.vendor.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should search by company name', async () => {
      prisma.vendor.findMany.mockResolvedValue([mockVendor]);
      prisma.vendor.count.mockResolvedValue(1);

      await service.findAll(1, 20, 'Test');
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ companyName: expect.objectContaining({ contains: 'Test' }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return vendor by id', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      const result = await service.findById('vendor-1');
      expect(result.id).toBe('vendor-1');
      expect(result).toHaveProperty('user');
    });

    it('should throw NotFoundException', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update vendor', async () => {
      prisma.vendor.update.mockResolvedValue({ ...mockVendor, companyName: 'Updated Corp' });
      const result = await service.update('vendor-1', { companyName: 'Updated Corp' });
      expect(result.companyName).toBe('Updated Corp');
    });
  });

  describe('remove', () => {
    it('should soft-delete vendor by setting status to INACTIVE', async () => {
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.vendor.update.mockResolvedValue({ ...mockVendor, status: 'INACTIVE' });

      const result = await service.remove('vendor-1');
      expect(result).toHaveProperty('status', 'INACTIVE');
    });

    it('should throw NotFoundException', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
