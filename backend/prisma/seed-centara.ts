import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Centara properties...');

  const properties = [
    { code: 'AMD', name: 'Centara AMD' },
    { code: 'CAK', name: 'Centara CAK' },
    { code: 'CNK', name: 'Centara CNK' },
    { code: 'CAY', name: 'Centara CAY' },
    { code: 'CGCW', name: 'Centara CGCW' },
    { code: 'CGLB', name: 'Centara CGLB' },
    { code: 'CHBR', name: 'Centara CHBR' },
    { code: 'CPBR', name: 'Centara CPBR' },
    { code: 'CGOJ', name: 'Centara CGOJ' },
    { code: 'CGLM', name: 'Centara CGLM' },
    { code: 'CMBR', name: 'Centara CMBR' },
    { code: 'CHY', name: 'Centara CHY' },
    { code: 'CKR', name: 'Centara CKR' },
    { code: 'CKV', name: 'Centara CKV' },
    { code: 'CKT', name: 'Centara CKT' },
    { code: 'CKC', name: 'Centara CKC' },
    { code: 'CKD', name: 'Centara CKD' },
    { code: 'CCH', name: 'Centara CCH' },
    { code: 'CGC', name: 'Centara CGC' },
    { code: 'CBP', name: 'Centara CBP' },
    { code: 'CMS', name: 'Centara CMS' },
    { code: 'CSA', name: 'Centara CSA' },
    { code: 'CMJ', name: 'Centara CMJ' },
    { code: 'CLOJ', name: 'Centara CLOJ' },
    { code: 'CPP', name: 'Centara CPP' },
    { code: 'CWR', name: 'Centara CWR' },
    { code: 'CDD', name: 'Centara CDD' },
    { code: 'CMLM', name: 'Centara CMLM' },
    { code: 'CMV', name: 'Centara CMV' },
    { code: 'CMO', name: 'Centara CMO' },
    { code: 'NVP', name: 'Centara NVP' },
    { code: 'CPY', name: 'Centara CPY' },
    { code: 'CRF', name: 'Centara CRF' },
    { code: 'CRS', name: 'Centara CRS' },
    { code: 'CCM', name: 'Centara CCM' },
    { code: 'CSS', name: 'Centara CSS' },
    { code: 'CUB', name: 'Centara CUB' },
    { code: 'CUD', name: 'Centara CUD' },
    { code: 'CPI', name: 'Centara CPI' },
    { code: 'CVP', name: 'Centara CVP' },
    { code: 'CSV', name: 'Centara CSV' },
    { code: 'CWB', name: 'Centara CWB' },
    { code: 'CWQ', name: 'Centara CWQ' },
    { code: 'CZKA', name: 'Centara CZKA' },
    { code: 'CZPN', name: 'Centara CZPN' },
    { code: 'CZSC', name: 'Centara CZSC' },
    { code: 'CZVL', name: 'Centara CZVL' },
    { code: 'HHN', name: 'Centara HHN' },
    { code: 'CIRM', name: 'Centara CIRM' },
    { code: 'RKK', name: 'Centara RKK' },
    { code: 'SSA', name: 'Centara SSA' },
    { code: 'VKP', name: 'Centara VKP' },
    { code: 'WSP', name: 'Centara WSP' },
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
    const prop = await prisma.property.upsert({ where: { code: p.code }, update: { name: p.name }, create: p });
    console.log(`Property: ${prop.name} (${prop.code})`);

    for (const d of deptList) {
      const deptCode = `${p.code}-${d.code}`;
      const existing = await prisma.department.findFirst({ where: { code: deptCode } });
      if (!existing) {
        await prisma.department.create({ data: { code: deptCode, name: d.name, propertyId: prop.id } });
      }
    }
  }

  console.log(`Done. Seeded ${properties.length} properties with ${deptList.length} departments each.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
