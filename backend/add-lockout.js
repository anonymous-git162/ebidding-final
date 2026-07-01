const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0").then(() => {
  return p.$queryRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP(3)");
}).then(() => {
  console.log('Columns added successfully');
  return p.user.findUnique({ where: { email: 'aa@a.com' }, select: { id: true, email: true, failedLoginAttempts: true, lockedUntil: true } });
}).then(u => {
  console.log(JSON.stringify(u));
  p.$disconnect();
});
