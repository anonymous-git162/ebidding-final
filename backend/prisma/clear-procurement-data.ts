import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all procurement transaction data...');

  await prisma.$transaction([
    // Level 1: Leaves (no remaining dependencies among procurement data)
    prisma.ebiddingResponse.deleteMany(),
    prisma.file.deleteMany({
      where: { OR: [{ procurementId: { not: null } }, { submissionId: { not: null } }] },
    }),

    // Level 2: Direct children with their own dependents
    prisma.rfqSubmission.deleteMany(),
    prisma.ebiddingRound.deleteMany(),

    // Level 3: Direct children with no further dependents
    prisma.procurementResult.deleteMany(),
    prisma.evaluationConsolidation.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.evaluatorReview.deleteMany(),
    prisma.evaluatorAssignment.deleteMany(),
    prisma.vendorInvitation.deleteMany(),
    prisma.procurementTimeline.deleteMany(),
    prisma.procurementApprover.deleteMany(),

    // Level 4: Main table
    prisma.procurement.deleteMany(),

    // Level 5: Polymorphic references (no FK constraints)
    prisma.auditLog.deleteMany({ where: { entityType: 'procurement' } }),
    prisma.notification.deleteMany({ where: { entityType: 'procurement' } }),
  ]);

  console.log('Done. All procurement data cleared.');
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
