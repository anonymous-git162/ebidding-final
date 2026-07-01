import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Creating test users for each property...');

  const properties = await prisma.property.findMany({ orderBy: { code: 'asc' } });
  const passwordHash = await bcrypt.hash('password123', 10);

  for (const prop of properties) {
    // Create requester
    const reqEmail = `requester-${prop.code.toLowerCase()}@centara.com`;
    const existingReq = await prisma.user.findUnique({ where: { email: reqEmail } });
    if (!existingReq) {
      await prisma.user.create({
        data: {
          email: reqEmail,
          passwordHash,
          fullName: `Requester ${prop.code}`,
          role: 'REQUESTER',
          propertyId: prop.id,
        },
      });
    }

    // Create approver
    const apEmail = `approver-${prop.code.toLowerCase()}@centara.com`;
    const existingAp = await prisma.user.findUnique({ where: { email: apEmail } });
    if (!existingAp) {
      await prisma.user.create({
        data: {
          email: apEmail,
          passwordHash,
          fullName: `Approver ${prop.code}`,
          role: 'APPROVER',
          propertyId: prop.id,
        },
      });
    }

    console.log(`${prop.code}: requester + approver created`);
  }

  console.log(`Done. Created ${properties.length * 2} users.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
