const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.update({ where: { email: 'admin@ebidding.com' }, data: { isActive: true } }).then(u => {
  console.log('Admin fixed: ' + u.email + ' active=' + u.isActive);
  p.$disconnect();
});
