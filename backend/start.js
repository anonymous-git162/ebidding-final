const { execSync } = require('child_process');
try {
  process.stderr.write('>>> BOOT\n');
  const push = execSync('npx --yes prisma db push', { encoding: 'utf-8' });
  process.stderr.write('>>> PUSH: ' + push.trim().split('\n').slice(-2).join(' | ') + '\n');
  const seed = execSync('node prisma/seed.prod.js', { encoding: 'utf-8' });
  process.stderr.write('>>> SEED: ' + seed.trim() + '\n');
} catch (e) {
  process.stderr.write('>>> SETUP FAILED (continuing): ' + e.toString().split('\n')[0] + '\n');
}
process.stderr.write('>>> STARTING APP\n');
require('./dist/src/main.js');
