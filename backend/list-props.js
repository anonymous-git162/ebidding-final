const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.property.findMany().then(props => {
  props.forEach(prop => {
    console.log('PROP|' + prop.code + '|' + prop.id + '|' + prop.name);
  });
  return p.department.findMany();
}).then(depts => {
  depts.forEach(dept => {
    console.log('DEPT|' + dept.code + '|' + dept.id + '|' + dept.name + '|' + dept.propertyId);
  });
  p.$disconnect();
});
