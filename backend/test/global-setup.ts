import { execSync } from 'child_process';

export default async function globalSetup() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ebidding_test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-testing';

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: __dirname + '/..',
    stdio: 'pipe',
  });

  execSync('npx ts-node prisma/seed.ts', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: __dirname + '/..',
    stdio: 'pipe',
  });
}
