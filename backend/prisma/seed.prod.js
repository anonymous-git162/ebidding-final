const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const password = await bcrypt.hash('Password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@ebidding.com' },
    update: {},
    create: { email: 'admin@ebidding.com', passwordHash: password, fullName: 'System Admin', role: 'ADMIN' },
  });
  console.log('Seeded admin user');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
