const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete departments with short codes (old seed data)
  const oldDepts = await prisma.department.findMany({
    where: { code: { in: ['IT', 'FRONT-OFFICE', 'HOUSEKEEPING', 'FNB', 'ENGINEERING', 'FINANCE', 'HR', 'SALES', 'PROCUREMENT', 'SECURITY'] } }
  });
  for (const d of oldDepts) {
    await prisma.department.delete({ where: { id: d.id } });
  }
  console.log('Deleted ' + oldDepts.length + ' old departments');

  // Delete duplicate departments with same name per property
  const allDepts = await prisma.department.findMany({ orderBy: { id: 'asc' } });
  const seen = new Set();
  let deleted = 0;
  for (const d of allDepts) {
    const key = d.name + '|' + d.propertyId;
    if (seen.has(key)) {
      await prisma.department.delete({ where: { id: d.id } });
      deleted++;
    } else {
      seen.add(key);
    }
  }
  console.log('Deleted ' + deleted + ' duplicate departments');

  // Verify
  const count = await prisma.department.count();
  console.log('Total departments: ' + count);

  prisma.$disconnect();
}
main();
