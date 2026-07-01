import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding properties and departments...');

  const properties = [
    { code: 'BKK-001', name: 'CentralWorld Bangkok' },
    { code: 'CNX-001', name: 'Centara Chiang Mai' },
    { code: 'HKT-001', name: 'Centara Phuket' },
    { code: 'PYT-001', name: 'Centara Pattaya' },
    { code: 'KCN-001', name: 'Centara Koh Chang' },
  ];

  const deptList = [
    { code: 'FRONT-OFFICE', name: 'Front Office' },
    { code: 'HOUSEKEEPING', name: 'Housekeeping' },
    { code: 'FNB', name: 'Food & Beverage' },
    { code: 'ENGINEERING', name: 'Engineering' },
    { code: 'FINANCE', name: 'Finance' },
    { code: 'HR', name: 'Human Resources' },
    { code: 'SALES', name: 'Sales & Marketing' },
    { code: 'PROCUREMENT', name: 'Procurement' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'SECURITY', name: 'Security' },
  ];

  for (const p of properties) {
    const prop = await prisma.property.upsert({ where: { code: p.code }, update: {}, create: p });
    console.log(`Property: ${prop.name} (${prop.id})`);

    for (const d of deptList) {
      const existing = await prisma.department.findFirst({ where: { code: d.code, propertyId: prop.id } });
      if (!existing) {
        const dept = await prisma.department.create({ data: { code: d.code, name: d.name, propertyId: prop.id } });
        console.log(`  Department: ${dept.name} (${dept.id})`);
      }
    }
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
