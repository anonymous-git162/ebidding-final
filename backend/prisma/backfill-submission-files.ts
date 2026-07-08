/**
 * Backfill: link orphaned files to their submissions.
 *
 * Matches by uploaded_by = vendor's userId, no procurement_id, no submission_id.
 * Each file is linked at most once (to the earliest submission).
 * Run with --dry-run to preview, without to apply.
 *
 * Usage:
 *   npx ts-node prisma/backfill-submission-files.ts --dry-run
 *   npx ts-node prisma/backfill-submission-files.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const submissions = await prisma.rfqSubmission.findMany({
    include: { vendor: { select: { userId: true } } },
    orderBy: { updatedAt: 'asc' },
  });

  let linked = 0;
  const claimed = new Set<string>();

  for (const sub of submissions) {
    const files = await prisma.file.findMany({
      where: {
        uploadedBy: sub.vendor.userId,
        procurementId: null,
        submissionId: null,
        id: { notIn: [...claimed] },
      },
    });

    if (files.length === 0) continue;

    if (!dryRun) {
      await prisma.file.updateMany({
        where: { id: { in: files.map((f) => f.id) } },
        data: { submissionId: sub.id },
      });
    }

    files.forEach((f) => claimed.add(f.id));
    linked += files.length;
    console.log(
      `${dryRun ? '[DRY RUN] ' : ''}Submission ${sub.id} (${sub.procurementId}): ${dryRun ? 'would link' : 'linked'} ${files.length} file(s)`,
    );
  }

  console.log(`\nDone. ${dryRun ? 'Would link' : 'Linked'} ${linked} file(s) total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
