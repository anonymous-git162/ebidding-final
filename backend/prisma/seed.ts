import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('Password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ebidding.com' },
    update: {},
    create: { email: 'admin@ebidding.com', passwordHash: password, fullName: 'System Admin', role: 'ADMIN' },
  });

  const requester = await prisma.user.upsert({
    where: { email: 'requester@ebidding.com' },
    update: {},
    create: { email: 'requester@ebidding.com', passwordHash: password, fullName: 'John Requester', role: 'REQUESTER' },
  });

  const procurement = await prisma.user.upsert({
    where: { email: 'procurement@ebidding.com' },
    update: {},
    create: { email: 'procurement@ebidding.com', passwordHash: password, fullName: 'Jane Procurement', role: 'PROCUREMENT' },
  });

  const evaluator = await prisma.user.upsert({
    where: { email: 'evaluator@ebidding.com' },
    update: {},
    create: { email: 'evaluator@ebidding.com', passwordHash: password, fullName: 'Bob Evaluator', role: 'EVALUATOR' },
  });

  const leadEvaluator = await prisma.user.upsert({
    where: { email: 'lead@ebidding.com' },
    update: {},
    create: { email: 'lead@ebidding.com', passwordHash: password, fullName: 'Alice Lead Evaluator', role: 'LEAD_EVALUATOR' },
  });

  const approver = await prisma.user.upsert({
    where: { email: 'approver@ebidding.com' },
    update: {},
    create: { email: 'approver@ebidding.com', passwordHash: password, fullName: 'Charlie Approver', role: 'APPROVER' },
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@ebidding.com' },
    update: {},
    create: { email: 'vendor@ebidding.com', passwordHash: password, fullName: 'Vendor Manager', role: 'VENDOR' },
  });

  const property = await prisma.property.upsert({
    where: { code: 'BKK-001' },
    update: {},
    create: { code: 'BKK-001', name: 'CentralWorld Bangkok' },
  });

  const dept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { code: 'IT', name: 'Information Technology', propertyId: property.id },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      companyName: 'Tech Solutions Co., Ltd.',
      taxId: '0105555123456',
      contactName: 'Diana Vendor',
      contactEmail: 'vendor@ebidding.com',
      phone: '+66-2-123-4567',
      address: '123 Tech Park, Bangkok',
      userId: vendorUser.id,
    },
  });

  const vendor2User = await prisma.user.upsert({
    where: { email: 'vendor2@ebidding.com' },
    update: {},
    create: { email: 'vendor2@ebidding.com', passwordHash: password, fullName: 'Vendor 2 Manager', role: 'VENDOR' },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { userId: vendor2User.id },
    update: {},
    create: {
      companyName: 'Digital Partners Ltd.',
      contactName: 'Eric Partner',
      contactEmail: 'vendor2@ebidding.com',
      phone: '+66-2-987-6543',
      userId: vendor2User.id,
    },
  });

  const procurementItem = await prisma.procurement.create({
    data: {
      requestNo: 'RFP-20260620-0001',
      requestType: 'RFP',
      title: 'IT Infrastructure Upgrade 2026',
      description: 'Complete upgrade of network infrastructure across all departments including switches, routers, and wireless access points.',
      businessNeed: 'Current infrastructure is outdated and causing frequent downtime',
      propertyId: property.id,
      departmentId: dept.id,
      category: 'IT Infrastructure',
      budgetEstimate: 500000,
      justification: 'Critical infrastructure upgrade needed for business continuity',
      requesterId: requester.id,
      status: 'DRAFT',
      currentOwnerRole: 'REQUESTER',
    },
  });

  await prisma.procurementTimeline.create({
    data: {
      procurementId: procurementItem.id,
      eventType: 'DRAFT_CREATED',
      actorRole: 'REQUESTER',
      actorId: requester.id,
    },
  });

  console.log('Seed data created successfully!');
  console.log('---');
  console.log('Login credentials (all passwords: Password123):');
  console.log('Admin:       admin@ebidding.com');
  console.log('Requester:   requester@ebidding.com');
  console.log('Procurement: procurement@ebidding.com');
  console.log('Evaluator:   evaluator@ebidding.com');
  console.log('Lead Eval:   lead@ebidding.com');
  console.log('Approver:    approver@ebidding.com');
  console.log('Vendor:      vendor@ebidding.com');
  console.log('Vendor 2:    vendor2@ebidding.com');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
