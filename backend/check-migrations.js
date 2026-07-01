const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT * FROM _prisma_migrations ORDER BY applied_at').then(r => {
  r.forEach(m => console.log(m.migration_name + ' | ' + m.applied_at));
  p.$disconnect();
});
