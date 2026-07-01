const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const props = [
    { code: 'BKK-001', name: 'CentralWorld Bangkok' },
    { code: 'CNX-001', name: 'Centara Chiang Mai' },
    { code: 'HKT-001', name: 'Centara Phuket' },
    { code: 'PYT-001', name: 'Centara Pattaya' },
    { code: 'KCN-001', name: 'Centara Koh Chang' },
  ];

  const deptNames = [
    'Front Office', 'Housekeeping', 'Food & Beverage', 'Engineering',
    'Finance', 'Human Resources', 'Sales & Marketing', 'Procurement',
    'Information Technology', 'Security',
  ];

  for (const p of props) {
    const prop = await prisma.property.upsert({ where: { code: p.code }, update: {}, create: p });
    console.log('Property: ' + prop.name);
    for (const name of deptNames) {
      const code = prop.code + '-' + name.replace(/[^A-Z]/gi, '').substring(0, 8).toUpperCase();
      const existing = await prisma.department.findFirst({ where: { code: code } });
      if (!existing) {
        await prisma.department.create({ data: { code: code, name: name, propertyId: prop.id } });
        console.log('  Dept: ' + name);
      }
    }
  }
  console.log('Done');
  prisma.$disconnect();
}
main();
