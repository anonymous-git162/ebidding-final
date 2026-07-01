import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: PaginationDto, requestorRole?: string) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', role, isActive, locked } = dto;
    const where: Prisma.UserWhereInput = {};

    // Non-admin users cannot see admin accounts
    if (requestorRole && requestorRole !== 'ADMIN') {
      where.role = { not: 'ADMIN' as UserRole };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      // Non-admin users cannot see admin accounts at all
      if (requestorRole !== 'ADMIN' && role === 'ADMIN') {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      where.role = role as UserRole;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (locked === true) {
      where.lockedUntil = { gt: new Date() };
    } else if (locked === false) {
      where.OR = [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          propertyId: true,
          departmentId: true,
          createdAt: true,
          vendor: {
            select: { companyName: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProperties() {
    return this.prisma.property.findMany({
      include: { departments: true },
      orderBy: { name: 'asc' },
    });
  }

  async getDepartments(propertyId: string) {
    return this.prisma.department.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findManyByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }

  async create(data: { email: string; password: string; fullName: string; role: UserRole; propertyId?: string; departmentId?: string; managerId?: string; companyName?: string }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new BadRequestException('Invalid email format');
    }
    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
        propertyId: data.propertyId || null,
        departmentId: data.departmentId || null,
        managerId: data.managerId || null,
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, propertyId: true, departmentId: true, managerId: true, createdAt: true },
    });

    if (data.role === 'VENDOR' && data.companyName) {
      await this.prisma.vendor.create({
        data: {
          companyName: data.companyName,
          contactName: data.fullName,
          contactEmail: data.email,
          userId: user.id,
        },
      });
    }

    return user;
  }

  async update(id: string, data: { email?: string; fullName?: string; role?: UserRole; isActive?: boolean; propertyId?: string; departmentId?: string; managerId?: string; password?: string; companyName?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new BadRequestException('Invalid email format');
    }
    if (data.password && data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ConflictException('Email already registered');
    }

    const updateData: any = {
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      isActive: data.isActive,
      propertyId: data.propertyId || null,
      departmentId: data.departmentId || null,
      managerId: data.managerId || null,
    };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, fullName: true, role: true, isActive: true, propertyId: true, departmentId: true, managerId: true, createdAt: true },
    });

    if (data.role === 'VENDOR' && data.companyName) {
      const existingVendor = await this.prisma.vendor.findUnique({ where: { userId: id } });
      if (existingVendor) {
        await this.prisma.vendor.update({
          where: { userId: id },
          data: { companyName: data.companyName!, contactName: data.fullName || user.fullName, contactEmail: data.email || user.email },
        });
      } else {
        await this.prisma.vendor.create({
          data: { companyName: data.companyName!, contactName: data.fullName || user.fullName, contactEmail: data.email || user.email, userId: id },
        });
      }
    }

    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Cannot delete admin users');

    return this.prisma.user.delete({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }

  async unlock(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true, email: true, fullName: true, failedLoginAttempts: true, lockedUntil: true },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
  }
}
