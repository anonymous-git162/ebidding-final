import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, VendorStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class VendorService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    companyName: string;
    taxId?: string;
    contactName: string;
    contactEmail: string;
    phone?: string;
    address?: string;
    userId?: string;
  }) {
    let userId = data.userId;

    // If no userId provided, create a user account automatically
    if (!userId) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.contactEmail },
      });
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      const password = crypto.randomBytes(8).toString('hex');
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await this.prisma.user.create({
        data: {
          email: data.contactEmail,
          passwordHash,
          fullName: data.contactName,
          role: 'VENDOR',
        },
      });
      userId = user.id;
    }

    return this.prisma.vendor.create({
      data: {
        companyName: data.companyName,
        taxId: data.taxId,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        phone: data.phone,
        address: data.address,
        userId,
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const where: Prisma.VendorWhereInput = search
      ? { OR: [{ companyName: { contains: search, mode: 'insensitive' } }, { contactName: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data: vendors, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id }, include: { user: { select: { email: true, fullName: true } } } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, data: { companyName?: string; taxId?: string; contactName?: string; contactEmail?: string; phone?: string; address?: string; status?: VendorStatus }) {
    return this.prisma.vendor.update({ where: { id }, data });
  }

  async remove(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Soft delete by setting status to INACTIVE
    return this.prisma.vendor.update({
      where: { id },
      data: { status: 'INACTIVE' as any },
    });
  }
}
