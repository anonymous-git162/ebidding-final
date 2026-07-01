const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'aa@a.com' }, select: { id: true, email: true, failedLoginAttempts: true, lockedUntil: true } }).then(u => {
  console.log(JSON.stringify(u));
  p.$disconnect();
});
