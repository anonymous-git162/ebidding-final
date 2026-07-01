const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'admin@ebidding.com' } }).then(u => {
  if (u) console.log('Admin exists: ' + u.email + ' role=' + u.role + ' active=' + u.isActive);
  else console.log('Admin NOT found');
  return p.user.count();
}).then(c => {
  console.log('Total users: ' + c);
  p.$disconnect();
});
